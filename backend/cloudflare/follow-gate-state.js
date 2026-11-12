// Follow Gate state machine. No direct Graph calls; every transition is
// conditional and idempotent, so a repeated verification cannot unlock twice.
export function followGateDecision({ gate, followerStatus }) {
  if (gate?.gateType !== "FOLLOW" || gate?.status !== "enabled") return { action: "deliver" };
  if (followerStatus === true) return { action: "deliver" };
  if (followerStatus === false) return { action: "request_follow" };
  return { action: "hold", reason: "FOLLOW_STATUS_UNVERIFIED" };
}
export async function startFollowGate({ db, inboxId, campaignId, userId, recipientId, commentId, now = new Date() }) {
  if (!db || !inboxId || !/^[a-f0-9]{24}$/i.test(String(campaignId)) ||
      !/^[a-f0-9]{24}$/i.test(String(userId)) ||
      !/^\d+$/.test(String(recipientId)) || !/^\d+$/.test(String(commentId))) {
    throw new TypeError("INVALID_FOLLOW_GATE_CONTEXT");
  }
  if (!/^comment:[0-9]+:[0-9]+$/.test(String(inboxId))) throw new TypeError("INVALID_FOLLOW_GATE_INBOX");
  const sessions = db.collection("cloudflare_staging_follow_gate_sessions");
  const key = "follow:" + String(inboxId);
  const result = await sessions.updateOne({ _id: key }, { $setOnInsert: {
    _id: key, inboxId: String(inboxId), campaignId: String(campaignId),
    userId: String(userId), recipientId: String(recipientId),
    commentId: String(commentId), status: "WAITING", createdAt: now
  } }, { upsert: true });
  return { sessionId: key, created: result.upsertedCount === 1 };
}
export async function confirmFollowGate({ db, sessionId, followerStatus, now = new Date() }) {
  if (!db || typeof sessionId !== "string" || !/^follow:comment:[0-9]+:[0-9]+$/.test(sessionId)) {
    throw new TypeError("INVALID_FOLLOW_GATE_SESSION");
  }
  if (followerStatus !== true) return { unlocked: false, reason: "FOLLOW_NOT_VERIFIED" };
  const sessions = db.collection("cloudflare_staging_follow_gate_sessions");
  const updated = await sessions.findOneAndUpdate(
    { _id: sessionId, status: "WAITING" },
    { $set: { status: "VERIFIED", verifiedAt: now } },
    { returnDocument: "after" }
  );
  const session = updated?.value ?? updated;
  return session?._id ? { unlocked: true, sessionId } : { unlocked: false, reason: "ALREADY_VERIFIED_OR_MISSING" };
}
