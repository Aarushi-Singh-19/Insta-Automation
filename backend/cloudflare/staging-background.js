// Staging-only durable inbox drain. No Instagram API calls or quota mutations.
import { planPendingInbox } from "./staging-inbox-planner.js";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";

export async function drainStagingInbox({ env, MongoClient, plan = planPendingInbox, prepare = prepareStagingActionOutbox }) {
  if (env?.ENABLE_STAGING_BACKGROUND !== "true") return { skipped: "disabled" };
  if (env?.MONGODB_STAGING_DB !== "triggerdm_staging") throw new Error("STAGING_DB_ISOLATION_REQUIRED");
  if (env?.ENABLE_STAGING_PLANNER !== "true" || env?.ENABLE_STAGING_ACTION_PREPARATION !== "true") {
    throw new Error("STAGING_PLANNER_FLAGS_REQUIRED");
  }
  const planned = await plan({ env, MongoClient, limit: 10 });
  const prepared = await prepare({ env, MongoClient, limit: 10 });
  return { planned: planned.processed, prepared: prepared.prepared, instagramMessagesSent: false };
}
