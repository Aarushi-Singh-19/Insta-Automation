// Final staging action eligibility gate. Pure validation only; NEVER calls Meta.
// No authorization is inferred from a previously stored quota reservation.
export function inspectStagingSendSafety({
  plan, reservation, account, recipient, followGate, now = new Date()
} = {}) {
  const deny = reason => ({ readyForExecution: false, reason });
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return deny("INVALID_CLOCK");
  if (!plan || plan.actionsNotAuthorized !== true ||
      !/^[0-9]+$/.test(String(plan.eventId || "")) ||
      !/^[0-9]+$/.test(String(plan.postId || "")) ||
      !plan.campaignId || !plan.ruleId) return deny("INVALID_ACTION_PLAN");
  if (!reservation || reservation.reserved !== true || reservation.duplicate !== false ||
      typeof reservation.reservationId !== "string" || !reservation.reservationId)
    return deny("UNCONFIRMED_QUOTA_RESERVATION");
  if (!account || account.isActive !== true || !account.ownerVerified ||
      !account.instagramAccountId || !account.accessTokenPresent)
    return deny("UNVERIFIED_INSTAGRAM_ACCOUNT");
  if (!recipient || !/^[0-9]+$/.test(String(recipient.id || "")) ||
      String(recipient.id) === String(account.instagramAccountId) ||
      recipient.eligibleForPrivateReply !== true)
    return deny("RECIPIENT_NOT_ELIGIBLE");
  if (!followGate || followGate.verified !== true ||
      followGate.accountId !== String(account.instagramAccountId) ||
      followGate.recipientId !== String(recipient.id))
    return deny("FOLLOW_GATE_UNVERIFIED");
  // Meta's private reply rules, token validity and exact-once Graph API
  // delivery must still be verified in the actual executor.
  return { readyForExecution: false, reason: "AWAITING_META_POLICY_AND_DELIVERY_GUARDS",
    passedLocalChecks: true };
}
