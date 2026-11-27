import { automationRuntime } from "./automation-runtime.js";
import { planProductionInbox } from "./production-inbox-planner.js";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";
import { processStagingFollowPostbacks } from "./staging-follow-postback-processor.js";
import { executeStagingActions } from "./staging-action-executor.js";
import { reconcileStagingStates } from "./staging-reconciliation.js";

async function measureStage(stage, run) {
  const startedAt = Date.now();
  try {
    return await run();
  } finally {
    console.info("Production Instagram runner stage timing", {
      stage, elapsedMs: Date.now() - startedAt
    });
  }
}

export async function drainProductionAutomation({ env, MongoClient, fetchImpl = fetch, runReconciliation = true, postbackIds = [] }) {
  if (env?.TRIGGERDM_RUNTIME !== "production" || env.ENABLE_PRODUCTION_AUTOMATION !== "true")
    return { skipped: "disabled" };
  automationRuntime(env);
  const cutoff = env.PRODUCTION_AUTOMATIC_SEND_NOT_BEFORE;
  if (typeof cutoff !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(cutoff) || !Number.isFinite(Date.parse(cutoff)))
    throw new Error("INVALID_PRODUCTION_AUTOMATION_CUTOFF");
  const reconciliation = runReconciliation
    ? await measureStage("reconciliation", () => reconcileStagingStates({ env, MongoClient }))
    : { skipped: "scheduled_only" };
  if (!runReconciliation && postbackIds.length) {
    // Keep each click paired with its own send and leave overflow for cron.
    for (const postbackId of postbackIds.slice(0, 5)) {
      let followInboxId;
      await measureStage("targeted_follow_verification", () => processStagingFollowPostbacks({
        env, MongoClient, fetchImpl, limit: 1, postbackId,
        onUnlock: inboxId => { followInboxId = inboxId; }
      }));
      if (followInboxId && env.ENABLE_PRODUCTION_INSTAGRAM_SEND === "true") {
        await measureStage("targeted_follow_execution", () => executeStagingActions({
          env, MongoClient, fetchImpl, receivedNotBefore: new Date(cutoff), limit: 1, followInboxId
        }));
      }
    }
    return;
  }
  const planned = await measureStage("comment_planning", () => planProductionInbox({ env, MongoClient, claimNextPost: true }));
  const prepared = await measureStage("outbox_preparation", () => prepareStagingActionOutbox({ env, MongoClient }));
  const postbacks = await measureStage("follow_verification", () => processStagingFollowPostbacks({ env, MongoClient, fetchImpl }));
  const execution = env.ENABLE_PRODUCTION_INSTAGRAM_SEND === "true"
    ? await measureStage("action_execution", () =>
      executeStagingActions({ env, MongoClient, fetchImpl, receivedNotBefore: new Date(cutoff) }))
    : { skipped: "disabled" };
  return { reconciliation, planned, prepared, postbacks, execution };
}
