// Cloudflare Queues producer adapter for the future isolated TriggerDM runtime.
// Do not replace the production BullMQ queue with this module until the
// Cloudflare consumer preserves the existing action processing invariants.
const ACTION_NAMES = new Set(["process-comment", "process-gate-resume"]);

export function validateActionJob(job) {
  if (!job || typeof job !== "object" || Array.isArray(job)) throw new TypeError("Job must be an object");
  if (!ACTION_NAMES.has(job.name)) throw new TypeError("Unsupported job name");
  const data = job.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("Missing job data");
  for (const key of ["commentId", "userId", "campaignId", "ruleId"]) {
    if (data[key] === undefined || data[key] === null || String(data[key]).trim() === "") {
      throw new TypeError("Missing " + key);
    }
  }
  if (job.name === "process-comment") {
    if (!data.action || !["reply", "send_dm"].includes(data.action.type)) {
      throw new TypeError("Invalid comment action");
    }
  } else if (!data.isGateResume || !Array.isArray(data.actions) || !data.actions.length ||
    data.actions.some(action => !action || !["reply", "send_dm"].includes(action.type))) {
    throw new TypeError("Invalid gate-resume actions");
  }
  return job;
}

export async function enqueueAction(queue, job) {
  if (!queue || typeof queue.send !== "function") throw new TypeError("Cloudflare Queue binding missing");
  const validJob = validateActionJob(job);
  // Preserve the BullMQ job name and payload shape. IDs are strings in transit.
  const normalized = JSON.parse(JSON.stringify(validJob));
  await queue.send(normalized);
  return { queued: true };
}

// An executor must be explicitly supplied after it has been migrated and tested.
// Never acknowledge a message merely because it was received: only acknowledge
// successful, durably recorded execution (including already-processed actions).
export async function consumeActionBatch(batch, executeActionJob) {
  if (!batch || !Array.isArray(batch.messages)) throw new TypeError("Invalid queue batch");
  const ready = typeof executeActionJob === "function";
  const results = [];
  for (const message of batch.messages) {
    if (!ready) {
      message.retry();
      results.push({ status: "retry", reason: "EXECUTOR_NOT_CONFIGURED" });
      continue;
    }
    try {
      const job = validateActionJob(message.body);
      const outcome = await executeActionJob(job);
      // Executor must explicitly confirm that all actions have been durably
      // processed or deduplicated. A falsy/ambiguous outcome is not success.
      if (!outcome || outcome.durable !== true) throw new Error("EXECUTION_NOT_DURABLE");
      message.ack();
      results.push({ status: "ack" });
    } catch (error) {
      message.retry();
      results.push({ status: "retry", reason: error?.message || "EXECUTION_FAILED" });
    }
  }
  return results;
}
