// Staging-only durable inbox drain. No Instagram API calls or quota mutations.
import { planPendingInbox } from "./staging-inbox-planner.js";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";
import { reconcileStagingStates } from "./staging-reconciliation.js";
import { triageStagingPostbacks } from "./staging-postback-triage.js";
import { processStagingFollowPostbacks } from "./staging-follow-postback-processor.js";

export async function drainStagingInbox({ env, MongoClient, plan = planPendingInbox, prepare = prepareStagingActionOutbox, reconcile = reconcileStagingStates, triage = triageStagingPostbacks, verifyPostbacks = processStagingFollowPostbacks, fetchImpl = fetch }) {
  if (env?.ENABLE_STAGING_BACKGROUND !== "true") return { skipped: "disabled" };
  if (env?.MONGODB_STAGING_DB !== "triggerdm_staging") throw new Error("STAGING_DB_ISOLATION_REQUIRED");
  if (env?.ENABLE_STAGING_PLANNER !== "true" || env?.ENABLE_STAGING_ACTION_PREPARATION !== "true") {
    throw new Error("STAGING_PLANNER_FLAGS_REQUIRED");
  }
  const reconciliation = await reconcile({ env, MongoClient });
  const postbacks = env?.ENABLE_STAGING_FOLLOW_POSTBACK_PROCESSOR === "true"
    ? await verifyPostbacks({ env, MongoClient, fetchImpl, limit: 5 })
    : await triage({ env, MongoClient, limit: 10 });
  const planned = await plan({ env, MongoClient, limit: 10 });
  const prepared = await prepare({ env, MongoClient, limit: 10 });
  return { planned: planned.processed, prepared: prepared.prepared, reconciliation, postbacks, instagramMessagesSent: false };
}
