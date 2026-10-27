function calculateRecoveryOffset(commissionAmount, recoverySources) {
  let remainingCommission = Number(commissionAmount);
  if (!Number.isFinite(remainingCommission) || remainingCommission < 0) {
    throw new RangeError("Invalid commission amount for recovery offset");
  }
  let recoveryApplied = 0;
  const allocations = [];

  for (const source of recoverySources) {
    if (remainingCommission <= 0) break;
    const due = Number(source.recoveryDue || 0);
    if (!Number.isFinite(due) || due < 0) {
      throw new RangeError("Invalid outstanding recovery amount");
    }
    const applied = Number(Math.min(remainingCommission, due).toFixed(2));
    if (applied <= 0) continue;
    allocations.push({ source, amount: applied, remainingDue: Number((due - applied).toFixed(2)) });
    remainingCommission = Number((remainingCommission - applied).toFixed(2));
    recoveryApplied = Number((recoveryApplied + applied).toFixed(2));
  }

  return { remainingCommission, recoveryApplied, allocations };
}

async function applyOutstandingRecovery({ ReferralEarning, earning, session }) {
  const recoverySources = await ReferralEarning.find({
    referrerId: earning.referrerId,
    _id: { $ne: earning._id },
    recoveryDue: { $gt: 0 },
  }).sort({ createdAt: 1, _id: 1 }).session(session);

  const allocation = calculateRecoveryOffset(earning.commissionAmount, recoverySources);
  for (const item of allocation.allocations) {
    item.source.recoveryDue = item.remainingDue;
    await item.source.save({ session });
  }

  earning.recoveryApplied = allocation.recoveryApplied;
  earning.commissionAmount = allocation.remainingCommission;
  await earning.save({ session });
}

function isEligibleReferralPayment(user, payment) {
  return Boolean(
    user?.referredBy &&
    payment?.id &&
    payment.status === "captured" &&
    payment.currency === "INR" &&
    payment.amount === 19900
  );
}

function buildReferralEarning(user, payment) {
  if (!isEligibleReferralPayment(user, payment)) return null;

  const grossAmount = payment.amount / 100;
  const commissionAmount = Math.round(grossAmount * 20) / 100;
  return {
    referrerId: user.referredBy,
    referredUserId: user._id,
    razorpayPaymentId: payment.id,
    grossAmount,
    commissionRate: 20,
    commissionAmount,
    originalCommissionAmount: commissionAmount,
    recoveryApplied: 0,
    recoveryAppliedReversedAmount: 0,
    currency: payment.currency,
    status: "eligible",
  };
}

async function recordReferralCommission({ ReferralEarning, user, payment }) {
  const earningData = buildReferralEarning(user, payment);
  if (!earningData) return { eligible: false, recorded: false };

  // Production Mongoose models use a transaction so the payment commission and
  // any recovery offset commit together. Lightweight test doubles use the
  // fallback path below.
  if (ReferralEarning.db?.startSession) {
    const session = await ReferralEarning.db.startSession();
    try {
      let outcome = { eligible: true, recorded: false, duplicate: false };
      await session.withTransaction(async () => {
        const result = await ReferralEarning.updateOne(
          { razorpayPaymentId: earningData.razorpayPaymentId },
          { $setOnInsert: earningData },
          { upsert: true, session }
        );
        if (!result.upsertedCount) {
          outcome = { eligible: true, recorded: false, duplicate: true };
          return;
        }
        const earning = await ReferralEarning.findOne({
          razorpayPaymentId: earningData.razorpayPaymentId,
        }).session(session);
        if (earning) await applyOutstandingRecovery({ ReferralEarning, earning, session });
        outcome = { eligible: true, recorded: true, duplicate: false };
      });
      return outcome;
    } catch (error) {
      if (error.code === 11000) return { eligible: true, recorded: false, duplicate: true };
      throw error;
    } finally {
      await session.endSession();
    }
  }

  try {
    const result = await ReferralEarning.updateOne(
      { razorpayPaymentId: earningData.razorpayPaymentId },
      { $setOnInsert: earningData },
      { upsert: true }
    );
    return {
      eligible: true,
      recorded: Boolean(result.upsertedCount),
      duplicate: !result.upsertedCount,
    };
  } catch (error) {
    if (error.code === 11000) return { eligible: true, recorded: false, duplicate: true };
    throw error;
  }
}

module.exports = {
  isEligibleReferralPayment,
  buildReferralEarning,
  recordReferralCommission,
  applyOutstandingRecovery,
};
