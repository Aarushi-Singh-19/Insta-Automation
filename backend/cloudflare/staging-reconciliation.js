// Inspect abandoned staging states without replaying uncertain external sends.
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export async function reconcileStagingStates({ env, MongoClient, now = new Date(), ageMinutes = 15 }) {
  if (env?.ENABLE_STAGING_RECONCILIATION !== "true") return { skipped: "disabled" };
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MONGO_CLIENT_REQUIRED");
  if (!Number.isInteger(ageMinutes) || ageMinutes < 5 || ageMinutes > 1440) throw new RangeError("INVALID_AGE");
  const cutoff = new Date(now.getTime() - ageMinutes * 60000);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const inbox = db.collection("cloudflare_staging_webhook_inbox");
    const outbox = db.collection("cloudflare_staging_action_outbox");
    const sends = db.collection("cloudflare_staging_action_sends");
    // A crashed planner has not called Instagram, but may have written a plan.
    // Mark for inspection instead of re-claiming; do not overwrite newer states.
    const abandonedPlanning = await inbox.updateMany({
      kind: "comment", status: "planning", planningStartedAt: { $lte: cutoff }
    }, { $set: { status: "needs_review", outcome: "ABANDONED_PLANNING", updatedAt: now } });
    // A crashed Meta verification may have unlocked the session before the
    // inbox acknowledgment. Never re-verify or re-trigger the DM automatically.
    const abandonedFollowVerification = await inbox.updateMany({
      kind: "postback", status: "verifying", verificationStartedAt: { $lte: cutoff }
    }, { $set: { status: "needs_review", outcome: "UNCERTAIN_FOLLOW_VERIFICATION",
      updatedAt: now } });
    // An abandoned executor may have sent a reply or DM before crashing.
    // NEVER automatically retry. Preserve send rows and quota reservations.
    const abandonedExecution = await outbox.updateMany({
      status: "executing", executionStartedAt: { $lte: cutoff }
    }, { $set: { status: "needs_review", reconciliationReason: "UNCERTAIN_PROVIDER_OUTCOME", updatedAt: now } });
    // Send rows are evidence; mark stale in-flight sends for operator review only.
    const uncertainSends = await sends.updateMany({
      status: "sending", startedAt: { $lte: cutoff }
    }, { $set: { status: "needs_review", reconciliationReason: "UNCERTAIN_PROVIDER_OUTCOME", updatedAt: now } });
    return { abandonedPlanning: abandonedPlanning.modifiedCount,
      abandonedExecution: abandonedExecution.modifiedCount, uncertainSends: uncertainSends.modifiedCount,
      abandonedFollowVerification: abandonedFollowVerification.modifiedCount,
      retriedInstagramMessages: 0 };
  } finally {
    await client.close();
  }
}
