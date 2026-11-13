import test from "node:test";
import assert from "node:assert/strict";
import { billingConfig, subscriptionUpdate, razorpayApi } from "./staging-razorpay.js";
const env = { ENABLE_STAGING_RAZORPAY: "true", MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost/triggerdm_staging",
  RAZORPAY_KEY_ID: "rzp_test_example", RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_MONTHLY_PLAN_ID: "plan_example", RAZORPAY_WEBHOOK_SECRET: "webhook-secret" };
test("billing is disabled unless explicitly opted in", () => {
  assert.throws(() => billingConfig({ ...env, ENABLE_STAGING_RAZORPAY: "false" }), /BILLING_DISABLED/);
});
test("production database name is rejected", () => {
  assert.throws(() => billingConfig({ ...env, MONGODB_STAGING_DB: "automationDB" }), /STAGING_DATABASE_REQUIRED/);
});
test("missing Razorpay credentials fail closed", () => {
  assert.throws(() => billingConfig({ ...env, RAZORPAY_WEBHOOK_SECRET: "" }), /BILLING_NOT_CONFIGURED/);
});
test("charged subscription sets paid access and period dates", () => {
  const result = subscriptionUpdate("subscription.charged",
    { current_start: 1700000000, current_end: 1702592000 });
  assert.equal(result.subscriptionStatus, "active");
  assert.equal(result.currentPlan, "starter");
  assert.equal(result.planEndDate.toISOString(), new Date(1702592000 * 1000).toISOString());
});
test("cancelled subscription retains existing period end", () => {
  const result = subscriptionUpdate("subscription.cancelled", {});
  assert.deepEqual(result, { subscriptionStatus: "cancelled" });
});
test("completed and halted transitions preserve period metadata", () => {
  assert.equal(subscriptionUpdate("subscription.completed", {}).subscriptionStatus, "expired");
  assert.equal(subscriptionUpdate("subscription.halted", {}).subscriptionStatus, "halted");
  assert.equal(subscriptionUpdate("subscription.pending", {}).subscriptionStatus, "past_due");
});
test("Razorpay API uses credential authentication and rejects non-2xx", async () => {
  let called = false;
  await assert.rejects(() => razorpayApi(env, "GET", "payments/pay_123", { fetchImpl: async (url, options) => {
    called = true;
    assert.equal(url, "https://api.razorpay.com/v1/payments/pay_123");
    assert.match(options.headers.Authorization, /^Basic /);
    return { ok: false, status: 401 };
  } }), /RAZORPAY_API_UNAVAILABLE/);
  assert.equal(called, true);
});
