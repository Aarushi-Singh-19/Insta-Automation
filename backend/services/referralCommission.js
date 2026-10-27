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
  return {
    referrerId: user.referredBy,
    referredUserId: user._id,
    razorpayPaymentId: payment.id,
    grossAmount,
    commissionRate: 20,
    commissionAmount: Math.round(grossAmount * 20) / 100,
    originalCommissionAmount: Math.round(grossAmount * 20) / 100,
    currency: payment.currency,
    status: "eligible",
  };
}

async function recordReferralCommission({ ReferralEarning, user, payment }) {
  const earning = buildReferralEarning(user, payment);
  if (!earning) return { eligible: false, recorded: false };

  try {
    const result = await ReferralEarning.updateOne(
      { razorpayPaymentId: earning.razorpayPaymentId },
      { $setOnInsert: earning },
      { upsert: true }
    );
    return {
      eligible: true,
      recorded: Boolean(result.upsertedCount),
      duplicate: !result.upsertedCount,
    };
  } catch (error) {
    // The unique payment ID index is the final safeguard against concurrent
    // webhook deliveries attempting to create the same commission.
    if (error.code === 11000) {
      return { eligible: true, recorded: false, duplicate: true };
    }
    throw error;
  }
}

module.exports = { isEligibleReferralPayment, buildReferralEarning, recordReferralCommission };
