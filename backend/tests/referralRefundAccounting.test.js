const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateRefundCommissionReversal,
  applyRecoveryToCommission,
  calculateRecoveryRestore,
} = require("../services/referralRefundAccounting");

test("partial refund reverses only the proportional commission", () => {
  assert.deepEqual(
    calculateRefundCommissionReversal({
      grossAmount: 199,
      originalCommissionAmount: 39.8,
      refundAmount: 49.75,
    }),
    { nextRefundedAmount: 49.75, targetReversal: 9.95, reversalDelta: 9.95 }
  );
});

test("sequential partial refunds calculate only the additional reversal", () => {
  const result = calculateRefundCommissionReversal({
    grossAmount: 199,
    originalCommissionAmount: 39.8,
    previouslyRefundedAmount: 49.75,
    previouslyReversedAmount: 9.95,
    refundAmount: 49.75,
  });
  assert.deepEqual(result, {
    nextRefundedAmount: 99.5,
    targetReversal: 19.9,
    reversalDelta: 9.95,
  });
});

test("full refund reverses the commission once and caps at original commission", () => {
  assert.deepEqual(
    calculateRefundCommissionReversal({
      grossAmount: 199,
      originalCommissionAmount: 39.8,
      refundAmount: 199,
    }),
    { nextRefundedAmount: 199, targetReversal: 39.8, reversalDelta: 39.8 }
  );
  assert.deepEqual(
    calculateRefundCommissionReversal({
      grossAmount: 199,
      originalCommissionAmount: 39.8,
      previouslyRefundedAmount: 199,
      previouslyReversedAmount: 39.8,
      refundAmount: 50,
    }),
    { nextRefundedAmount: 199, targetReversal: 39.8, reversalDelta: 0 }
  );
});

test("refund amounts are capped at the original payment amount", () => {
  assert.deepEqual(
    calculateRefundCommissionReversal({
      grossAmount: 199,
      originalCommissionAmount: 39.8,
      refundAmount: 250,
    }),
    { nextRefundedAmount: 199, targetReversal: 39.8, reversalDelta: 39.8 }
  );
});

test("invalid refund accounting amounts are rejected", () => {
  assert.throws(() => calculateRefundCommissionReversal({
    grossAmount: 0,
    originalCommissionAmount: 39.8,
    refundAmount: 10,
  }), RangeError);
  assert.throws(() => calculateRefundCommissionReversal({
    grossAmount: 199,
    originalCommissionAmount: 39.8,
    refundAmount: 0,
  }), RangeError);
});

test("recovery is offset against a later commission without going below zero", () => {
  assert.deepEqual(
    applyRecoveryToCommission({ commissionAmount: 39.8, recoveryDue: 20 }),
    { recoveryApplied: 20, commissionPayable: 19.8, recoveryRemaining: 0 }
  );
  assert.deepEqual(
    applyRecoveryToCommission({ commissionAmount: 10, recoveryDue: 15 }),
    { recoveryApplied: 10, commissionPayable: 0, recoveryRemaining: 5 }
  );
});

test("recovery calculation rejects negative or non-finite amounts", () => {
  assert.throws(() => applyRecoveryToCommission({
    commissionAmount: -1,
    recoveryDue: 5,
  }), RangeError);
  assert.throws(() => applyRecoveryToCommission({
    commissionAmount: 10,
    recoveryDue: Number.NaN,
  }), RangeError);
});


test("partial refunds restore only the proportional amount of an earlier recovery offset", () => {
  assert.deepEqual(calculateRecoveryRestore({
    grossAmount: 199,
    recoveryApplied: 20,
    cumulativeRefundAmount: 49.75,
  }), { targetRecoveryRestore: 5, recoveryRestoreDelta: 5 });

  assert.deepEqual(calculateRecoveryRestore({
    grossAmount: 199,
    recoveryApplied: 20,
    previouslyRestoredAmount: 5,
    cumulativeRefundAmount: 99.5,
  }), { targetRecoveryRestore: 10, recoveryRestoreDelta: 5 });
});

test("full refund restores all previously applied recovery, capped at the applied amount", () => {
  assert.deepEqual(calculateRecoveryRestore({
    grossAmount: 199,
    recoveryApplied: 20,
    cumulativeRefundAmount: 250,
  }), { targetRecoveryRestore: 20, recoveryRestoreDelta: 20 });
});

test("recovery restoration rejects invalid amounts", () => {
  assert.throws(() => calculateRecoveryRestore({
    grossAmount: 0,
    recoveryApplied: 20,
    cumulativeRefundAmount: 10,
  }), RangeError);
});
