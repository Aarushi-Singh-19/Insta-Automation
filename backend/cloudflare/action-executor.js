// Cloudflare action executor adapter. All persistence and Instagram operations
// must be supplied by a tested runtime integration; no production dependencies
// are imported here. Never acknowledge an action based only on an API response.
import { validateActionJob } from "./action-queue.js";

export function createActionExecutor(deps) {
  const required = ["getSubscriptionAccess", "claimAction", "getInstagramAccount", "executeAction", "markSuccess", "markFailure"];
  for (const key of required) {
    if (typeof deps?.[key] !== "function") throw new TypeError("Missing executor dependency: " + key);
  }

  return async function executeActionJob(input) {
    const job = validateActionJob(input);
    const { data } = job;
    const access = await deps.getSubscriptionAccess(data.userId);
    if (!access || !access.user || !access.hasAccess) {
      // Do not retry indefinitely or claim that denied jobs were executed.
      // A future integration must persist an explicit terminal blocked result.
      throw new Error("SUBSCRIPTION_ACCESS_DENIED_NOT_RECORDED");
    }
    const actions = job.name === "process-gate-resume" ? data.actions : [data.action];
    for (const action of actions) {
      const key = { eventId: String(data.commentId), actionType: action.type };
      const claim = await deps.claimAction(key, data);
      if (claim?.state === "success") continue; // durable prior success
      if (claim?.state !== "claimed") throw new Error("ACTION_NOT_CLAIMED");

      try {
        const account = await deps.getInstagramAccount(data.userId);
        if (!account) throw new Error("NO_INSTAGRAM_ACCOUNT_CONNECTED");
        const normalize = value => String(value || "").replace(/^@/, "").trim().toLowerCase();
        const ownComment = (normalize(data.username) && normalize(data.username) === normalize(account.username)) ||
          (data.recipientId && String(data.recipientId) === String(account.instagramBusinessId));
        if (!ownComment) {
          await deps.executeAction(action, { ...data, instagramAccount: account });
        }
        // markSuccess must commit durable idempotency status before returning.
        const recorded = await deps.markSuccess(key, { skippedSelfComment: Boolean(ownComment) });
        if (recorded !== true) throw new Error("SUCCESS_NOT_DURABLE");
      } catch (error) {
        try { await deps.markFailure(key, error); } catch (recordError) {
          throw new AggregateError([error, recordError], "ACTION_FAILURE_RECORD_FAILED");
        }
        throw error;
      }
    }
    return { durable: true };
  };
}
