// Staging-only durable action outbox. This is a preparation stage, not a
// sending executor: it cannot call Instagram or debit quotas.
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export async function prepareStagingActionOutbox({ env, MongoClient, limit = 10 }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MongoClient required");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("INVALID_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const plans = db.collection("cloudflare_staging_action_plans");
    const outbox = db.collection("cloudflare_staging_action_outbox");
    const cursor = plans.find({ status: "awaiting_authorization" }).sort({ createdAt: 1, _id: 1 }).limit(limit);
    const results = [];
    for await (const record of cursor) {
      if (!record?._id || !record.plan || record.plan.actionsNotAuthorized !== true ||
          record.plan.requiresSubscriptionAndQuotaCheck !== true) {
        results.push({ status: "skipped_invalid_plan" });
        continue;
      }
      const plan = record.plan;
      if (![plan.eventId, plan.postId].every(id => /^\d+$/.test(String(id || ""))) ||
          ![plan.campaignId, plan.ruleId].every(id => /^[a-f0-9]{24}$/i.test(String(id || "")))) {
        results.push({ status: "skipped_invalid_plan" });
        continue;
      }
      const key = String(record._id);
      const write = await outbox.updateOne({ _id: key }, { $setOnInsert: {
        _id: key,
        plan: { eventId: String(plan.eventId), postId: String(plan.postId),
          campaignId: String(plan.campaignId), ruleId: String(plan.ruleId) },
        status: "awaiting_authorization",
        // Explicitly impossible to dispatch without a separate executor.
        authorized: false, dispatched: false, createdAt: new Date()
      } }, { upsert: true });
      results.push({ status: write.upsertedCount ? "prepared" : "already_prepared" });
    }
    return { processed: results.length, prepared: results.filter(row => row.status === "prepared").length,
      instagramMessagesSent: false };
  } finally { await client.close(); }
}
