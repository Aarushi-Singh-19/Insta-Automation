import test from "node:test";
import assert from "node:assert/strict";
import { inspectStagingAutomationReadiness } from "./staging-automation-readiness.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging" };
test("read-only preflight rejects production database before connecting", async () => {
  let connected = false;
  class MongoClient { async connect() { connected = true; } }
  await assert.rejects(inspectStagingAutomationReadiness({
    env: { ...env, MONGODB_STAGING_DB: "automationDB" }, MongoClient
  }), /STAGING_DATABASE_REQUIRED/);
  assert.equal(connected, false);
});
test("preflight reports only aggregate readiness and never sends or mutates", async () => {
  const operations = [];
  class MongoClient {
    async connect() { operations.push("connect"); }
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection(name) {
        return {
          async countDocuments() { operations.push("count:" + name); return 1; },
          find() { operations.push("find:" + name); return {
            project() { return this; }, limit() { return this; },
            async toArray() { return [{ userId: "abc", period: "trial", limit: 500,
              baselineVerified: true, baselineSource: "render-reconciliation",
              baselineSent: 2, reserved: 1 }]; }
          }; }
        };
      } };
    }
    async close() { operations.push("close"); }
  }
  const result = await inspectStagingAutomationReadiness({ env, MongoClient });
  assert.equal(result.ok, true);
  assert.equal(result.checks.activeInstagramAccounts, 1);
  assert.equal(result.checks.verifiedQuotaCounters, 1);
  assert.equal(result.realInstagramMessagesSentByProbe, 0);
  assert.equal(operations.at(-1), "close");
  assert.equal(operations.some(op => /update|insert|delete|send/.test(op)), false);
});
