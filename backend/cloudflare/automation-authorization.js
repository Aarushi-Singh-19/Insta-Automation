// Pure staging automation authorization. Must run immediately before any
// Graph API side effect; never infer eligibility from the existence of a plan.
export function authorizeCommentActions({ user, campaign, rule, account, usage, now = new Date() }) {
  if (!user || !campaign || !rule || !account || !usage) return { authorized: false, reason: "MISSING_CONTEXT" };
  if (account.status !== "active" || campaign.status !== "active" || rule.isActive !== true) {
    return { authorized: false, reason: "INACTIVE_AUTOMATION" };
  }
  if (String(account.userId) !== String(user._id) || String(campaign.userId) !== String(user._id) ||
      String(rule.userId) !== String(user._id)) {
    return { authorized: false, reason: "OWNER_MISMATCH" };
  }
  const status = user.subscriptionStatus;
  const trial = status === "trial" && user.trialEndDate && new Date(user.trialEndDate) > now;
  const paid = ["active", "cancelled"].includes(status) && user.planEndDate && new Date(user.planEndDate) > now;
  if (!trial && !paid) return { authorized: false, reason: "SUBSCRIPTION_INACTIVE" };
  const limit = trial ? 500 : 10000;
  if (!Number.isSafeInteger(usage.sent) || usage.sent < 0 || usage.period !== (trial ? "trial" : "billing")) {
    return { authorized: false, reason: "USAGE_UNVERIFIED" };
  }
  if (usage.sent >= limit) return { authorized: false, reason: "DM_QUOTA_EXHAUSTED" };
  if (campaign.gate?.gateType === "FOLLOW" && campaign.gate?.status === "enabled") {
    return { authorized: false, reason: "FOLLOW_GATE_REQUIRED" };
  }
  return { authorized: true, remainingBeforeSend: limit - usage.sent,
    // This result is advisory only; executor must atomically reserve quota,
    // deduplicate by action ID and confirm durable completion before sending.
    requiresAtomicReservation: true, requiresDurableDeduplication: true };
}
