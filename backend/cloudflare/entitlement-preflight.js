// Conservative entitlement preflight. Pure function: NEVER authorizes a send.
// A successful preflight only permits the next independently verified stage.
const LIMITS = Object.freeze({ trial: 500, active: 10000 });
export function checkAutomationEntitlement({ user, usage, now = new Date() } = {}) {
  if (!user || !usage || !(now instanceof Date) || Number.isNaN(now.getTime()))
    return { eligible: false, reason: "MISSING_VERIFIED_DATA" };
  const status = user.subscriptionStatus;
  if (status !== "trial" && status !== "active")
    return { eligible: false, reason: "SUBSCRIPTION_NOT_ACTIVE" };
  const expiry = status === "trial" ? user.trialEnd : user.planEndDate;
  if (!expiry) return { eligible: false, reason: "MISSING_EXPIRY" };
  const expiresAt = new Date(expiry);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime())
    return { eligible: false, reason: "SUBSCRIPTION_EXPIRED" };
  if (!Number.isSafeInteger(usage.sent) || usage.sent < 0)
    return { eligible: false, reason: "UNVERIFIED_USAGE" };
  if (typeof usage.periodStart !== "string" || !usage.periodStart ||
      typeof usage.periodEnd !== "string" || !usage.periodEnd)
    return { eligible: false, reason: "UNVERIFIED_USAGE_PERIOD" };
  const start = new Date(usage.periodStart), end = new Date(usage.periodEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      start.getTime() > now.getTime() || end.getTime() <= now.getTime() ||
      end.getTime() > expiresAt.getTime())
    return { eligible: false, reason: "INVALID_USAGE_PERIOD" };
  const limit = LIMITS[status];
  if (usage.sent >= limit) return { eligible: false, reason: "DM_QUOTA_EXHAUSTED", limit };
  return { eligible: true, reason: "PREFLIGHT_ONLY", remaining: limit - usage.sent,
    limit, requiresAtomicReservation: true, sendAuthorized: false };
}
