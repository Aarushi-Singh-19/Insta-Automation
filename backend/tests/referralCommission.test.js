const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isEligibleReferralPayment,
  buildReferralEarning,
  recordReferralCommission,
} = require("../services/referralCommission");

const user = { _id: "referred-user-1", referredBy: "referrer-1" };
const payment = {
  id: "pay_test_1",
  status: "captured",
  currency: "INR",
  amount: 19900,
};

test("qualifying ₹199 captured INR payment earns exactly ₹39.80", () => {
  assert.equal(isEligibleReferralPayment(user, payment), true);
  const earning = buildReferralEarning(user, payment);
  assert.equal(earning.grossAmount, 199);
  assert.equal(earning.commissionAmount, 39.8);
  assert.equal(earning.referrerId, user.referredBy);
  assert.equal(earning.referredUserId, user._id);
  assert.equal(earning.razorpayPaymentId, payment.id);
});

test("free trial/no referral/failed/wrong amount or currency cannot earn commission", () => {
  assert.equal(buildReferralEarning({ ...user, referredBy: null }, payment), null);
  assert.equal(buildReferralEarning(user, { ...payment, status: "failed" }), null);
  assert.equal(buildReferralEarning(user, { ...payment, amount: 10000 }), null);
  assert.equal(buildReferralEarning(user, { ...payment, currency: "USD" }), null);
  assert.equal(buildReferralEarning(user, { ...payment, id: null }), null);
});

test("payment ID upsert makes repeated commission delivery idempotent", async () => {
  let inserted = false;
  const ReferralEarning = {
    async updateOne(filter, update, options) {
      assert.deepEqual(filter, { razorpayPaymentId: payment.id });
      assert.ok(update.$setOnInsert);
      assert.equal(options.upsert, true);
      if (inserted) return { upsertedCount: 0 };
      inserted = true;
      return { upsertedCount: 1 };
    },
  };
  const first = await recordReferralCommission({ ReferralEarning, user, payment });
  const second = await recordReferralCommission({ ReferralEarning, user, payment });
  assert.equal(first.recorded, true);
  assert.equal(second.recorded, false);
  assert.equal(second.duplicate, true);
});

test("duplicate-key race is treated as an already-recorded commission", async () => {
  const ReferralEarning = {
    async updateOne() {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    },
  };
  const result = await recordReferralCommission({ ReferralEarning, user, payment });
  assert.equal(result.recorded, false);
  assert.equal(result.duplicate, true);
});


const { calculateRecoveryOffset } = require("../services/referralCommission");

test("outstanding recovery is deducted from a new commission oldest-first", () => {
  const sources = [
    { _id: "oldest", recoveryDue: 15 },
    { _id: "next", recoveryDue: 20 },
  ];
  const result = calculateRecoveryOffset(39.8, sources);
  assert.equal(result.recoveryApplied, 35);
  assert.equal(result.remainingCommission, 4.8);
  assert.deepEqual(result.allocations.map(({ source, amount, remainingDue }) => ({
    id: source._id, amount, remainingDue,
  })), [
    { id: "oldest", amount: 15, remainingDue: 0 },
    { id: "next", amount: 20, remainingDue: 0 },
  ]);
});

test("recovery offset cannot make a commission payable amount negative", () => {
  const result = calculateRecoveryOffset(10, [
    { _id: "recovery", recoveryDue: 25 },
  ]);
  assert.equal(result.recoveryApplied, 10);
  assert.equal(result.remainingCommission, 0);
  assert.equal(result.allocations[0].remainingDue, 15);
});

test("recovery offset rejects invalid commission or debt values", () => {
  assert.throws(() => calculateRecoveryOffset(-1, []), RangeError);
  assert.throws(() => calculateRecoveryOffset(10, [
    { _id: "bad", recoveryDue: -5 },
  ]), RangeError);
});
