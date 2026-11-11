// Pure Instagram webhook normalizer. No database writes or external calls.
// Preserve the existing TriggerDM rule: replies and own-account comments
// must never trigger another automation.
export function extractInstagramEvents(payload) {
  if (!payload || payload.object !== "instagram" || !Array.isArray(payload.entry)) {
    throw new TypeError("Invalid Instagram webhook payload");
  }
  const comments = [];
  const postbacks = [];
  for (const entry of payload.entry) {
    const ownerId = String(entry?.id || "");
    for (const item of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (item?.field !== "comments") continue;
      const value = item.value;
      if (!value || value.parent_id) continue;
      const authorId = String(value.from?.id || "");
      if (ownerId && authorId && ownerId === authorId) continue;
      const eventId = value.id == null ? "" : String(value.id);
      const postId = value.media?.id ?? value.media_id;
      if (!eventId || postId == null || String(postId).trim() === "") continue;
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
      if (!item?.postback) continue;
      // Preserve full postback metadata for Follow Gate routing; never execute
      // directly in the ingress parser.
      postbacks.push({ entryId: ownerId, senderId: item.sender?.id || null,
        recipientId: item.recipient?.id || null, postback: item.postback });
    }
  }
  return { comments, postbacks };
}
