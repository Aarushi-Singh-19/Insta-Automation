// Staging-only durable inbox drain. No Instagram API calls or quota mutations.
import { planPendingInbox } from "./staging-inbox-planner.js";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";
import { reconcileStagingStates } from "./staging-reconciliation.js";
import { triageStagingPostbacks } from "./staging-postback-triage.js";

export async function drainStagingInbox({ env, MongoClient, plan = planPendingInbox, prepare = prepareStagingActionOutbox, reconcile = reconcileStagingStates, triage = triageStagingPostbacks }) {
  if (env?.ENABLE_STAGING_BACKGROUND !== "true") return { skipped: "disabled" };
  if (env?.MONGODB_STAGING_DB !== "triggerdm_staging") throw new Error("STAGING_DB_ISOLATION_REQUIRED");
  if (env?.ENABLE_STAGING_PLANNER !== "true" || env?.ENABLE_STAGING_ACTION_PREPARATION !== "true") {
    throw new Error("STAGING_PLANNER_FLAGS_REQUIRED");
  }
  const reconciliation = await reconcile({ env, MongoClient });
  const postbacks = await triage({ env, MongoClient, limit: 10 });
  const planned = await plan({ env, MongoClient, limit: 10 });
  const prepared = await prepare({ env, MongoClient, limit: 10 });
  return { planned: planned.processed, prepared: prepared.prepared, reconciliation, postbacks, instagramMessagesSent: false };
}
