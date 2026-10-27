const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isEligibleReferralPayment,
  buildReferralEarning,
  recordReferralCommission,
} = require("../services/referralCommission");

const user = { _id: "referred-user", referredBy: "referrer-user" };
const validPayment = {
  id: "pay_test_199",
  status: "captured",
  currency: "INR",
  amount: 19900,
};

test("captured ₹199 INR payment earns exactly ₹39.80", () => {
  assert.equal(isEligibleReferralPayment(user, validPayment), true);
  assert.deepEqual(buildReferralEarning(user, validPayment), {
    referrerId: "referrer-user",
    referredUserId: "referred-user",
    razorpayPaymentId: "pay_test_199",
    grossAmount: 199,
    commissionRate: 20,
    commissionAmount: 39.8,
    originalCommissionAmount: 39.8,
    currency: "INR",
    status: "eligible",
  });
});

test("failed, wrong-currency, wrong-amount, and non-referral payments do not qualify", () => {
  assert.equal(isEligibleReferralPayment(user, { ...validPayment, status: "failed" }), false);
  assert.equal(isEligibleReferralPayment(user, { ...validPayment, currency: "USD" }), false);
  assert.equal(isEligibleReferralPayment(user, { ...validPayment, amount: 20000 }), false);
  assert.equal(isEligibleReferralPayment({ _id: "user", referredBy: null }, validPayment), false);
});

test("same payment ID is only inserted once across repeated webhook handling", async () => {
  const records = new Map();
  const fakeModel = {
    async updateOne(filter, update) {
      if (records.has(filter.razorpayPaymentId)) {
        return { matchedCount: 1, upsertedCount: 0 };
      }
      records.set(filter.razorpayPaymentId, update.$setOnInsert);
      return { matchedCount: 0, upsertedCount: 1 };
    },
  };

  const first = await recordReferralCommission({ ReferralEarning: fakeModel, user, payment: validPayment });
  const second = await recordReferralCommission({ ReferralEarning: fakeModel, user, payment: validPayment });

  assert.equal(first.recorded, true);
  assert.equal(second.duplicate, true);
  assert.equal(records.size, 1);
  assert.equal(records.get("pay_test_199").commissionAmount, 39.8);
});

test("duplicate-key race is treated as already recorded", async () => {
  const fakeModel = {
    async updateOne() {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    },
  };
  const result = await recordReferralCommission({ ReferralEarning: fakeModel, user, payment: validPayment });
  assert.equal(result.duplicate, true);
});

test("non-qualifying payment is not written", async () => {
  let called = false;
  const fakeModel = { async updateOne() { called = true; } };
  const result = await recordReferralCommission({
    ReferralEarning: fakeModel,
    user,
    payment: { ...validPayment, amount: 5000 },
  });
  assert.equal(result.eligible, false);
  assert.equal(called, false);
});
