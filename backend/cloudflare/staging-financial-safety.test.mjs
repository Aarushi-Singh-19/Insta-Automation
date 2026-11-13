import test from "node:test";
import assert from "node:assert/strict";
import { reverseRefund, recordCommission } from "./staging-referrals.js";

function mockDb({ status = "eligible", commissionAmount = 39.8 } = {}) {
  const earning = { _id: "earning1", referrerId: "referrer1", razorpayPaymentId: "pay_test",
    grossAmount: 199, originalCommissionAmount: 39.8, commissionAmount, status,
    refundedAmount: 0, commissionReversedAmount: 0, recoveryApplied: 0, recoveryDue: 0 };
  const refunds = new Map();
  const db = { collection(name) {
    if (name === "referralrefundrecords") return {
      findOne: async q => refunds.get(q.razorpayRefundId) || null,
      insertOne: async doc => {
        if (refunds.has(doc.razorpayRefundId)) throw Error("DUPLICATE_REFUND");
        refunds.set(doc.razorpayRefundId, doc);
      }
    };
    if (name === "referralearnings") return {
      findOne: async q => q.razorpayPaymentId === earning.razorpayPaymentId ? { ...earning } : null,
      updateOne: async (q, update) => { assert.equal(q._id, earning._id); Object.assign(earning, update.$set); return { modifiedCount: 1 }; }
    };
    throw Error("Unexpected collection: " + name);
  } };
  return { db, earning, refunds };
}

test("partial refund reduces eligible commission proportionally, and replay is idempotent", async () => {
  const state = mockDb();
  const refund = { id: "rfnd_half", payment_id: "pay_test", amount: 9950 };
  await reverseRefund(state.db, null, refund);
  assert.equal(state.earning.refundedAmount, 99.5);
  assert.equal(state.earning.commissionAmount, 19.9);
  assert.equal(state.earning.commissionReversedAmount, 19.9);
  await reverseRefund(state.db, null, refund);
  assert.equal(state.earning.commissionAmount, 19.9);
  assert.equal(state.refunds.size, 1);
});

test("multiple refunds fully reverse an eligible commission without going negative", async () => {
  const state = mockDb();
  await reverseRefund(state.db, null, { id: "rfnd_half", payment_id: "pay_test", amount: 9950 });
  await reverseRefund(state.db, null, { id: "rfnd_rest", payment_id: "pay_test", amount: 9950 });
  assert.equal(state.earning.commissionAmount, 0);
  assert.equal(state.earning.status, "reversed");
  assert.equal(state.earning.commissionReversedAmount, 39.8);
  assert.equal(state.refunds.size, 2);
});

test("refund of paid commission creates recovery debt without rewriting paid payout", async () => {
  const state = mockDb({ status: "paid" });
  await reverseRefund(state.db, null, { id: "rfnd_paid", payment_id: "pay_test", amount: 19900 });
  assert.equal(state.earning.status, "paid");
  assert.equal(state.earning.recoveryDue, 39.8);
  assert.equal(state.earning.commissionReversedAmount, 39.8);
  await reverseRefund(state.db, null, { id: "rfnd_paid", payment_id: "pay_test", amount: 19900 });
  assert.equal(state.earning.recoveryDue, 39.8);
});

test("replayed captured commission never applies recovery twice", async () => {
  let inserts = 0, recoveryQueries = 0;
  const db = { collection(name) {
    assert.equal(name, "referralearnings");
    return {
      updateOne: async () => { inserts++; return { upsertedCount: inserts === 1 ? 1 : 0 }; },
      find: () => { recoveryQueries++; return { sort: () => ({ toArray: async () => [] }) }; }
    };
  } };
  const user = { _id: "user1", referredBy: "aaaaaaaaaaaaaaaaaaaaaaaa" };
  const payment = { id: "pay_test", status: "captured", currency: "INR", amount: 19900 };
  await recordCommission(db, null, user, payment);
  await recordCommission(db, null, user, payment);
  assert.equal(recoveryQueries, 1);
});
