// Pure Instagram webhook normalizer. No database writes or external calls.
// Preserve the existing TriggerDM rule: replies and own-account comments
// must never trigger another automation.
export function extractInstagramEvents(payload) {
  if (!payload || payload.object !== "instagram" || !Array.isArray(payload.entry)) {
    throw new TypeError("Invalid Instagram webhook payload");
  }
  // Bound parser work before traversing untrusted webhook input.
  if (payload.entry.length > 1000) throw new TypeError("Too many Instagram webhook entries");
  const comments = [];
  const postbacks = [];
  for (const entry of payload.entry) {
    const ownerId = String(entry?.id || "");
    const changeCount = Array.isArray(entry?.changes) ? entry.changes.length : 0;
    const messageCount = Array.isArray(entry?.messaging) ? entry.messaging.length : 0;
    if (changeCount + messageCount > 1000 || comments.length + postbacks.length + changeCount + messageCount > 1000) {
      throw new TypeError("Too many Instagram webhook events");
    }
    for (const item of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (item?.field !== "comments") continue;
      const value = item.value;
      if (!value || value.parent_id) continue;
      const authorId = String(value.from?.id || "");
      if (ownerId && authorId && ownerId === authorId) continue;
      const eventId = value.id == null ? "" : String(value.id);
      const postId = value.media?.id ?? value.media_id;
      if (!/^\d+$/.test(ownerId) || !/^\d+$/.test(eventId) || !/^\d+$/.test(String(postId || ""))) continue;
      comments.push({
        entryId: ownerId,
        eventId,
        postId: String(postId),
        commentText: typeof value.text === "string" ? value.text : "",
        username: typeof value.from?.username === "string" ? value.from.username : "unknown",
        recipientId: authorId || null,
        commentTimestamp: value.timestamp || null,
      });
    }
    for (const item of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      if (!item?.postback || !/^\d+$/.test(ownerId) || !/^\d+$/.test(String(item.sender?.id || "")) ||
          !/^\d+$/.test(String(item.recipient?.id || ""))) continue;
      // Preserve full postback metadata for Follow Gate routing; never execute
      // directly in the ingress parser.
      postbacks.push({ entryId: ownerId, senderId: item.sender?.id || null,
        recipientId: item.recipient?.id || null, postback: item.postback });
    }
  }
  return { comments, postbacks };
}
