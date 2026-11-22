import { ObjectId } from "mongodb";
import { validateNativeServiceMongoConfig } from "./native-service-mongodb.js";

export async function productionCampaignInsights({ env, MongoClient, authenticatedUserId, campaignId, view }) {
  const { uri, dbName } = validateNativeServiceMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const id = new ObjectId(campaignId);
    const campaign = await db.collection("campaigns").findOne(
      { _id: id, userId: new ObjectId(authenticatedUserId) }, { projection: { metrics: 1 } });
    if (!campaign) return { status: 404, body: { error: "Campaign not found" } };
    const logs = db.collection("actionlogs");
    const metrics = campaign.metrics || {};
    if (view === "health") {
      const last10Actions = await logs.find({ campaignId: id }).sort({ createdAt: -1 }).limit(10).toArray();
      const total = metrics.commentsProcessed || 0;
      const successRate = total ? ((metrics.repliesSent || 0) + (metrics.dmsSent || 0)) * 100 / total : 0;
      const failureRate = total ? (metrics.errors || 0) * 100 / total : 0;
      const healthScore = successRate / 100;
      return { body: { success: true, data: { metrics, successRate, failureRate, healthScore,
        status: healthScore < 0.4 ? "FAILING" : healthScore < 0.7 ? "DEGRADED" : "HEALTHY", last10Actions } } };
    }

    const now = Date.now();
    const dayStart = new Date(now - 24 * 3600000);
    const hourStart = new Date(now - 3600000);
    const match = { campaignId: id, createdAt: { $gte: dayStart } };
    if (view === "trend") {
      const rows = await logs.aggregate([{ $match: match }, { $group: {
        _id: { status: "$status", hour: { $gte: ["$createdAt", hourStart] } }, count: { $sum: 1 },
      } }]).toArray();
      const stats = selected => {
        const totals = { total: 0, success: 0, failed: 0, successRate: 0 };
        for (const row of selected) {
          totals.total += row.count;
          if (row._id.status === "success") totals.success += row.count;
          if (row._id.status === "failed") totals.failed += row.count;
        }
        totals.successRate = totals.total ? totals.success * 100 / totals.total : 0;
        return totals;
      };
      const last1h = stats(rows.filter(row => row._id.hour));
      const last24h = stats(rows);
      const expectedHourlyFailure = last24h.failed / 24;
      return { body: { success: true, data: { last1h, last24h,
        failureSpike: last1h.failed > expectedHourlyFailure * 1.5,
        trend: { successRateDelta: last1h.successRate - last24h.successRate,
          failureRateDelta: last1h.failed - expectedHourlyFailure } } } };
    }

    const [rows, failedJobs] = await Promise.all([
      logs.aggregate([{ $match: match }, { $group: { _id: {
        status: "$status", reason: { $ifNull: ["$errorType", "unknown"] },
      }, count: { $sum: 1 } } }]).toArray(),
      db.collection("failedjobs").countDocuments({ campaignId: { $in: [id, campaignId] }, createdAt: match.createdAt }),
    ]);
    let success = 0;
    let failed = 0;
    const reasons = new Map();
    for (const row of rows) {
      if (row._id.status === "success") success += row.count;
      else {
        failed += row.count;
        reasons.set(row._id.reason, (reasons.get(row._id.reason) || 0) + row.count);
      }
    }
    const totalActions = success + failed || 1;
    const successRate = success / totalActions;
    const failureRate = failed / totalActions;
    const [dominantFailure, maxCount] = [...reasons].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const healthScore = Math.min(1, successRate * 0.7 + (1 - failureRate) * 0.2 + (failedJobs === 0 ? 0.1 : 0));
    const status = healthScore < 0.5 || maxCount / totalActions > 0.6 ? "FAILING" : healthScore < 0.8 ? "DEGRADED" : "HEALTHY";
    return { body: { campaignId, healthScore, status, successRate, failureRate, totalActions,
      failureReasons: Object.fromEntries(reasons), dominantFailure, failedJobs } };
  } finally {
    await client.close();
  }
}
