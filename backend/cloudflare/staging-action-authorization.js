// Staging-only authorization coordinator. No Graph API access or DM sends.
// The supplied usage snapshot is a preflight, not the source of quota truth.
// A transactionally committed reservation is required for progression.
import { checkAutomationEntitlement } from "./entitlement-preflight.js";

export async function authorizeStagingAction({
  user, usage, userId, actionId, now = new Date(),
  reserveQuota, followGateSatisfied = false
} = {}) {
  if (typeof reserveQuota !== "function") throw new TypeError("RESERVATION_ADAPTER_REQUIRED");
  if (typeof userId !== "string" || !/^[a-f0-9]{24}$/i.test(userId) ||
      typeof actionId !== "string" || !/^[a-zA-Z0-9:_-]{1,160}$/.test(actionId))
    return { authorized: false, reason: "INVALID_ACTION_IDENTITY" };
  if (!followGateSatisfied) return { authorized: false, reason: "FOLLOW_GATE_NOT_VERIFIED" };
  const preflight = checkAutomationEntitlement({ user, usage, now });
  if (!preflight.eligible) return { authorized: false, reason: preflight.reason };
  let reservation;
  try {
    reservation = await reserveQuota({
      userId, actionId, periodStart: usage.periodStart, periodEnd: usage.periodEnd,
      limit: preflight.limit
    });
  } catch {
    return { authorized: false, reason: "QUOTA_RESERVATION_UNCONFIRMED" };
  }
  if (reservation?.reserved !== true || reservation?.duplicate !== false || !reservation?.reservationId)
    return { authorized: false, reason: reservation?.reason || "QUOTA_RESERVATION_UNCONFIRMED" };
  // The caller still must verify action ownership, consent, token validity,
  // recipient eligibility, and durable send state. This is NOT send permission.
  return { authorized: false, reservationConfirmed: true,
    reservationId: reservation.reservationId,
    reason: "AWAITING_FINAL_SEND_SAFETY_CHECKS" };
}
