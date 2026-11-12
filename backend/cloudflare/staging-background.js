// Staging-only durable inbox drain. No Instagram API calls or quota mutations.
import { planPendingInbox } from "./staging-inbox-planner.js";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";
import { reconcileStagingStates } from "./staging-reconciliation.js";
import { triageStagingPostbacks } from "./staging-postback-triage.js";
import { processStagingFollowPostbacks } from "./staging-follow-postback-processor.js";
import { executeStagingActions } from "./staging-action-executor.js";

export async function drainStagingInbox({ env, MongoClient, plan = planPendingInbox, prepare = prepareStagingActionOutbox, reconcile = reconcileStagingStates, triage = triageStagingPostbacks, verifyPostbacks = processStagingFollowPostbacks, execute = executeStagingActions, fetchImpl = fetch }) {
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
  // Explicit opt-in only. No automatic Graph sends during migration validation.
  // The same Instagram account may still be handled by production Render.
  // Never automatically send without an explicit operator confirmation that
  // the staging event stream has exclusive sending ownership.
  const execution = env?.ENABLE_STAGING_BACKGROUND_SEND === "true"
    ? (env?.ENABLE_STAGING_INSTAGRAM_SEND === "true" &&
       env?.ENABLE_STAGING_EXCLUSIVE_SEND_OWNERSHIP === "true" &&
       /^\d+$/.test(String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || ""))
      ? await execute({ env, MongoClient, fetchImpl, limit: 5 })
      : (() => { throw new Error("STAGING_EXCLUSIVE_SEND_OWNERSHIP_REQUIRED"); })())
    : { skipped: "disabled" };
  return { planned: planned.processed, prepared: prepared.prepared, reconciliation, postbacks,
    execution, instagramMessagesSent: execution.skipped === "disabled" ? false : "requires-provider-verification" };
}
