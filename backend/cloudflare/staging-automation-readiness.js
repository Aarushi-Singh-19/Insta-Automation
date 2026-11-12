// Staging-only, read-only preflight. Never creates quota baselines or sends messages.
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { verifiedQuotaState } from "./quota-reconciliation.js";
export async function inspectStagingAutomationReadiness({ env, MongoClient, now = new Date() }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MONGO_CLIENT_REQUIRED");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const accounts = await db.collection("instagramaccounts").countDocuments({
      status: "active", accessToken: { $type: "string", $ne: "" },
      pageAccessToken: { $type: "string", $ne: "" }
    });
    const campaigns = await db.collection("campaigns").countDocuments({ status: "active" });
    const pending = await db.collection("cloudflare_staging_action_outbox").countDocuments({
      status: { $in: ["awaiting_authorization", "awaiting_follow"] }
    });
    const counters = await db.collection("cloudflare_staging_dm_quotas")
      .find({ baselineVerified: true, baselineSource: "render-reconciliation" })
      .project({ _id: 0, userId: 1, period: 1, limit: 1, baselineVerified: 1,
        baselineSource: 1, baselineSent: 1, reserved: 1 })
      .limit(100).toArray();
    const validCounters = counters.filter(counter => verifiedQuotaState(counter, {
      period: counter.period, limit: counter.limit
    }, counter.userId));
    return { ok: true, database: dbName, checks: {
      activeInstagramAccounts: accounts, activeCampaigns: campaigns,
      pendingOutboxActions: pending, verifiedQuotaCounters: validCounters.length,
      quotaAuditTruncated: counters.length === 100,
      followerVerificationEnabled: env.ENABLE_STAGING_FOLLOW_VERIFICATION === "true",
      postbackProcessorEnabled: env.ENABLE_STAGING_FOLLOW_POSTBACK_PROCESSOR === "true",
      backgroundEnabled: env.ENABLE_STAGING_BACKGROUND === "true",
      backgroundSendEnabled: env.ENABLE_STAGING_BACKGROUND_SEND === "true",
      instagramSendEnabled: env.ENABLE_STAGING_INSTAGRAM_SEND === "true"
    }, realInstagramMessagesSentByProbe: 0 };
  } finally { await client.close(); }
}
