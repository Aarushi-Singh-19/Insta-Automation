import test from "node:test";
import assert from "node:assert/strict";
import { isRetryableTransactionError, withStagingTransactionRetry } from "./staging-transaction-retry.js";
test("retries only explicitly transient MongoDB transaction errors", async () => {
  let attempts = 0;
  const result = await withStagingTransactionRetry(async () => {
    attempts++;
    if (attempts < 3) throw { hasErrorLabel: label => label === "TransientTransactionError" };
    return "reserved";
  });
  assert.equal(result, "reserved");
  assert.equal(attempts, 3);
});
test("does not retry unknown commit result or ordinary errors", async () => {
  let attempts = 0;
  await assert.rejects(withStagingTransactionRetry(async () => {
    attempts++;
    throw { hasErrorLabel: label => label === "UnknownTransactionCommitResult" };
  }), () => true);
  assert.equal(attempts, 1);
  assert.equal(isRetryableTransactionError(new Error("network failure")), false);
});
test("stops after three transient failures", async () => {
  let attempts = 0;
  await assert.rejects(withStagingTransactionRetry(async () => {
    attempts++;
    throw { hasErrorLabel: label => label === "TransientTransactionError" };
  }), () => true);
  assert.equal(attempts, 3);
});
