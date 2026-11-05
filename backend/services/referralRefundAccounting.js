function calculateRefundCommissionReversal({
  grossAmount,
  originalCommissionAmount,
  previouslyRefundedAmount = 0,
  previouslyReversedAmount = 0,
  refundAmount,
}) {
  const gross = Number(grossAmount);
  const originalCommission = Number(originalCommissionAmount);
  const priorRefunded = Number(previouslyRefundedAmount);
  const priorReversed = Number(previouslyReversedAmount);
  const refund = Number(refundAmount);

  if (
    !Number.isFinite(gross) || gross <= 0 ||
    !Number.isFinite(originalCommission) || originalCommission < 0 ||
    !Number.isFinite(priorRefunded) || priorRefunded < 0 ||
    !Number.isFinite(priorReversed) || priorReversed < 0 ||
    !Number.isFinite(refund) || refund <= 0
  ) {
    throw new RangeError("Invalid referral refund accounting amounts");
  }

  const nextRefundedAmount = Math.min(
    gross,
    Number((priorRefunded + refund).toFixed(2))
  );
  const targetReversal = Math.min(
    originalCommission,
    Math.round((nextRefundedAmount / gross * originalCommission) * 100) / 100
  );
  const reversalDelta = Math.max(
    0,
    Number((targetReversal - priorReversed).toFixed(2))
  );

  return { nextRefundedAmount, targetReversal, reversalDelta };
}

function applyRecoveryToCommission({ commissionAmount, recoveryDue }) {
  const commission = Number(commissionAmount);
  const recovery = Number(recoveryDue);
  if (
    !Number.isFinite(commission) || commission < 0 ||
    !Number.isFinite(recovery) || recovery < 0
  ) {
    throw new RangeError("Invalid referral commission recovery amounts");
  }

  const recoveryApplied = Math.min(commission, recovery);
  return {
    recoveryApplied: Number(recoveryApplied.toFixed(2)),
    commissionPayable: Number((commission - recoveryApplied).toFixed(2)),
    recoveryRemaining: Number((recovery - recoveryApplied).toFixed(2)),
  };
}


function calculateRecoveryRestore({
  grossAmount,
  recoveryApplied,
  previouslyRestoredAmount = 0,
  cumulativeRefundAmount,
}) {
  const gross = Number(grossAmount);
  const applied = Number(recoveryApplied);
  const previouslyRestored = Number(previouslyRestoredAmount);
  const cumulativeRefund = Number(cumulativeRefundAmount);
  if (
    !Number.isFinite(gross) || gross <= 0 ||
    !Number.isFinite(applied) || applied < 0 ||
    !Number.isFinite(previouslyRestored) || previouslyRestored < 0 ||
    !Number.isFinite(cumulativeRefund) || cumulativeRefund < 0
  ) {
    throw new RangeError("Invalid recovery restoration amounts");
  }
  const targetRecoveryRestore = Math.min(
    applied,
    Math.round((Math.min(gross, cumulativeRefund) / gross * applied) * 100) / 100
  );
  const recoveryRestoreDelta = Math.max(
    0,
    Number((targetRecoveryRestore - previouslyRestored).toFixed(2))
  );
  return { targetRecoveryRestore, recoveryRestoreDelta };
}

module.exports = { calculateRefundCommissionReversal, applyRecoveryToCommission, calculateRecoveryRestore };
