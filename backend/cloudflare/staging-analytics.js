import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

// Native equivalents of /api/analytics/dashboard and /api/analytics/trends.
// All queries are restricted to the authenticated user. Never return logs or tokens.
export async function stagingAnalytics({ env, MongoClient, authenticatedUserId, kind }) {
  if (!/^[a-f0-9]{24}$/i.test(String(authenticatedUserId || ""))) throw new Error("AUTHENTICATED_USER_REQUIRED");
  if (!["dashboard", "trends"].includes(kind)) throw new Error("INVALID_ANALYTICS_KIND");
  const { uri, dbName } = validateStagingMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const userId = new ObjectId(authenticatedUserId);
    if (kind === "trends") {
      const rows = await db.collection("actionlogs").aggregate([
        { $match: { $or: [{ userId }, { userId: String(userId) }] } },
        { $group: { _id: "$status", total: { $sum: 1 } } }
      ]).toArray();
      const result = { queued: 0, success: 0, failed: 0 };
      for (const row of rows) if (Object.hasOwn(result, row._id)) result[row._id] = row.total;
      return result;
    }
    const [activeAutomations, connectedAccounts, metrics] = await Promise.all([
      db.collection("automations").countDocuments({ user: userId, status: "active" }),
      db.collection("instagramaccounts").countDocuments({ userId, status: "active" }),
      db.collection("campaigns").aggregate([
        { $match: { userId } },
        { $group: { _id: null, dmsSent: { $sum: { $ifNull: ["$metrics.dmsSent", 0] } },
          commentsProcessed: { $sum: { $ifNull: ["$metrics.commentsProcessed", 0] } } } }
      ]).toArray()
    ]);
    return { activeAutomations, connectedAccounts, dmsSent: metrics[0]?.dmsSent || 0,
      commentsProcessed: metrics[0]?.commentsProcessed || 0 };
  } finally { await client.close(); }
}
