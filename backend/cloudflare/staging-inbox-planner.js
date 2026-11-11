// Staging inbox dispatcher. Produces planning records, never sends Instagram DMs.
// Durable state transitions protect against concurrent workers and duplicate events.
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { planCommentAutomation } from "./comment-planner.js";
import { resolveStagingComment } from "./staging-comment-resolver.js";

export async function planPendingInbox({ env, MongoClient, resolveCampaignAndRule = resolveStagingComment, limit = 10 }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MongoClient required");
  if (typeof resolveCampaignAndRule !== "function") throw new TypeError("Resolver required");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("INVALID_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const inbox = db.collection("cloudflare_staging_webhook_inbox");
    const plans = db.collection("cloudflare_staging_action_plans");
    const results = [];
    for (let i = 0; i < limit; i++) {
      // Atomic claim prevents two dispatchers planning the same inbox event.
      // No automatic lease reclaim: an interrupted claim requires reconciliation.
      const claimed = await inbox.findOneAndUpdate(
        { status: "pending", kind: "comment" },
        { $set: { status: "planning", planningStartedAt: new Date() } },
        { sort: { receivedAt: 1, _id: 1 }, returnDocument: "after" }
      );
      const item = claimed?.value ?? claimed;
      if (!item?._id) break;
      try {
        const resolution = await resolveCampaignAndRule({ db, comment: item.event });
        const decision = planCommentAutomation({
          comment: item.event, campaign: resolution?.campaign, rule: resolution?.rule
        });
        if (decision.matched) {
          // Upsert is idempotent; _id is the inbox key, unique by default.
          await plans.updateOne(
            { _id: item._id },
            { $setOnInsert: {
              plan: decision.plan, status: "awaiting_authorization",
              createdAt: new Date()
            } },
            { upsert: true }
          );
        }
        const updated = await inbox.updateOne(
          { _id: item._id, status: "planning" },
          { $set: { status: decision.matched ? "planned" : "ignored",
            outcome: decision.matched ? "REQUIRES_AUTHORIZATION" : decision.reason,
            updatedAt: new Date() } }
        );
        if (updated?.matchedCount !== 1) throw new Error("INBOX_STATE_CONFLICT");
        results.push({ id: item._id, status: decision.matched ? "planned" : "ignored" });
      } catch (error) {
        // Fail closed: mark for manual reconciliation rather than blindly
        // reprocessing ambiguous partial state or sending duplicate messages.
        await inbox.updateOne(
          { _id: item._id, status: "planning" },
          { $set: { status: "needs_review", outcome: "PLANNING_FAILED", updatedAt: new Date() } }
        );
        throw error;
      }
    }
    return { processed: results.length, results };
  } finally {
    await client.close();
  }
}
