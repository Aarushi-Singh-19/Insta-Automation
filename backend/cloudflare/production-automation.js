import { automationRuntime } from "./automation-runtime.js";
import { planProductionInbox } from "./production-inbox-planner.js";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";
import { processStagingFollowPostbacks } from "./staging-follow-postback-processor.js";
import { executeStagingActions } from "./staging-action-executor.js";
import { reconcileStagingStates } from "./staging-reconciliation.js";

export async function drainProductionAutomation({ env, MongoClient, fetchImpl = fetch }) {
  if (env?.TRIGGERDM_RUNTIME !== "production" || env.ENABLE_PRODUCTION_AUTOMATION !== "true")
    return { skipped: "disabled" };
  automationRuntime(env);
  const cutoff = env.PRODUCTION_AUTOMATIC_SEND_NOT_BEFORE;
  if (typeof cutoff !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(cutoff) || !Number.isFinite(Date.parse(cutoff)))
    throw new Error("INVALID_PRODUCTION_AUTOMATION_CUTOFF");
  const reconciliation = await reconcileStagingStates({ env, MongoClient });
  const planned = await planProductionInbox({ env, MongoClient, claimNextPost: true });
  const prepared = await prepareStagingActionOutbox({ env, MongoClient });
  const postbacks = await processStagingFollowPostbacks({ env, MongoClient, fetchImpl });
  const execution = env.ENABLE_PRODUCTION_INSTAGRAM_SEND === "true"
    ? await executeStagingActions({ env, MongoClient, fetchImpl, receivedNotBefore: new Date(cutoff) })
    : { skipped: "disabled" };
  return { reconciliation, planned, prepared, postbacks, execution };
}
