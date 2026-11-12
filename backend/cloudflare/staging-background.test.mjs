import test from "node:test";
import assert from "node:assert/strict";
import { drainStagingInbox } from "./staging-background.js";

const base = { MONGODB_STAGING_DB: "triggerdm_staging", ENABLE_STAGING_BACKGROUND: "true",
  ENABLE_STAGING_PLANNER: "true", ENABLE_STAGING_ACTION_PREPARATION: "true" };
test("disabled background makes no DB calls", async () => {
  let called = false;
  const result = await drainStagingInbox({ env: { ...base, ENABLE_STAGING_BACKGROUND: "false" },
    plan: async () => { called = true; } });
  assert.deepEqual(result, { skipped: "disabled" });
  assert.equal(called, false);
});
test("rejects production database and incomplete flags", async () => {
  await assert.rejects(drainStagingInbox({ env: { ...base, MONGODB_STAGING_DB: "automationDB" } }), /STAGING_DB_ISOLATION_REQUIRED/);
  await assert.rejects(drainStagingInbox({ env: { ...base, ENABLE_STAGING_PLANNER: "false" } }), /STAGING_PLANNER_FLAGS_REQUIRED/);
});
test("runs planning before preparation without executing Graph sends", async () => {
  const order = [];
  const result = await drainStagingInbox({ env: base, plan: async () => {
    order.push("plan"); return { processed: 3 };
  }, prepare: async () => { order.push("prepare"); return { prepared: 2 }; } });
  assert.deepEqual(order, ["plan", "prepare"]);
  assert.deepEqual(result, { planned: 3, prepared: 2, reconciliation: { skipped: "disabled" }, postbacks: { skipped: "disabled" }, instagramMessagesSent: false });
});
test("planner failure stops preparation", async () => {
  let prepared = false;
  await assert.rejects(drainStagingInbox({ env: base, plan: async () => { throw new Error("DB_DOWN"); },
    prepare: async () => { prepared = true; } }), /DB_DOWN/);
  assert.equal(prepared, false);
});
