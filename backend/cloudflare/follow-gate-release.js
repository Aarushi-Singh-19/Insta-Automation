// Pure, fail-closed Follow Gate release authorization. A verified session
// permits evaluation of the waiting DM; it never authorizes a Graph send itself.
export function verifiedFollowGateRelease({ session, inboxId, campaignId, userId, recipientId, commentId }) {
  if (!session || session.status !== "VERIFIED") return { allowed: false, reason: "FOLLOW_NOT_VERIFIED" };
  const ids = [inboxId, campaignId, userId, recipientId, commentId];
  if (ids.some(v => v === null || v === undefined || String(v).length === 0)) {
    return { allowed: false, reason: "FOLLOW_CONTEXT_MISSING" };
  }
  const expected = {
    _id: "follow:" + String(inboxId), inboxId: String(inboxId),
    campaignId: String(campaignId), userId: String(userId),
    recipientId: String(recipientId), commentId: String(commentId)
  };
  if (Object.entries(expected).some(([key, value]) => String(session[key] ?? "") !== value)) {
    return { allowed: false, reason: "FOLLOW_CONTEXT_MISMATCH" };
  }
  if (!/^comment:[0-9]+:[0-9]+$/.test(String(inboxId)) ||
      String(inboxId).split(":")[2] !== String(commentId)) {
    return { allowed: false, reason: "FOLLOW_INBOX_INVALID" };
  }
  return { allowed: true };
}
