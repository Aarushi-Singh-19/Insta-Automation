// Staging-only durable webhook inbox. Does not send Instagram messages.
// Mongo unique index on _id makes repeated Meta deliveries idempotent.
import { validateStagingMongoConfig } from "./staging-mongodb.js";
export async function persistInstagramInbox({ env, MongoClient, events, receivedAt = new Date() }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MongoClient required");
  if (!events || !Array.isArray(events.comments) || !Array.isArray(events.postbacks)) throw new TypeError("INVALID_EVENTS");
  // Reject oversized or malformed envelopes before any database writes.
  // Meta may retry failed deliveries; bounded input prevents excessive work.
  if (events.comments.length + events.postbacks.length > 1000) throw new TypeError("TOO_MANY_EVENTS");
  const rows = [];
  for (const comment of events.comments) {
    if (!/^\d+$/.test(String(comment.eventId || ""))) throw new TypeError("INVALID_COMMENT_ID");
    if (!/^\d+$/.test(String(comment.entryId || "")) || !/^\d+$/.test(String(comment.postId || ""))) throw new TypeError("INVALID_COMMENT_SOURCE");
    // A comment ID must never be accepted under two different Instagram owners.
    // Include owner in the key so distinct account events cannot collide.
    rows.push({ _id: "comment:" + comment.entryId + ":" + comment.eventId, kind: "comment", event: comment });
  }
  for (const postback of events.postbacks) {
    // Meta postback may have no event ID. Hash canonical payload for redelivery
    // deduplication; do not collapse unrelated events from the same sender.
    if (!postback.senderId || !postback.postback) continue;
    const source = JSON.stringify([postback.entryId, postback.senderId, postback.recipientId, postback.postback]);
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    const digest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
    rows.push({ _id: "postback:" + digest, kind: "postback", event: postback });
  }
  if (!rows.length) return { durable: true, received: 0, inserted: 0 };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1, retryWrites: true });
  try {
    await client.connect();
    const collection = client.db(dbName).collection("cloudflare_staging_webhook_inbox");
    let inserted = 0;
    for (const row of rows) {
      try {
        const result = await collection.updateOne(
          { _id: row._id },
          { $setOnInsert: { ...row, status: "pending", receivedAt } },
          { upsert: true }
        );
        if (result.upsertedCount === 1) inserted++;
      } catch (error) {
        // Duplicate key from concurrent deliveries is a successful dedup.
        if (error?.code !== 11000) throw error;
      }
    }
    return { durable: true, received: rows.length, inserted };
  } finally {
    await client.close();
  }
}
