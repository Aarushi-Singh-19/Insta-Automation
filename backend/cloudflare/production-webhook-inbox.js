import { validateProductionMongoConfig } from "./production-mongodb.js";

// Production multi-account ingress. Do not acknowledge events unless every
// accepted event is durably stored. Execution remains a separate release gate.
export async function persistProductionInstagramEvents({ env, MongoClient, events }) {
  if (!events || !Array.isArray(events.comments) || !Array.isArray(events.postbacks)) throw new Error("INVALID_EVENTS");
  // Reject malformed events before opening a connection or writing a partial batch.
  for (const event of events.comments) {
    if (!/^\d+$/.test(String(event?.entryId || "")) ||
        !/^\d+$/.test(String(event?.eventId || "")) ||
        !/^\d+$/.test(String(event?.postId || ""))) throw new Error("INVALID_COMMENT_EVENT");
  }
  for (const event of events.postbacks) {
    if (!/^\d+$/.test(String(event?.entryId || "")) ||
        !/^\d+$/.test(String(event?.senderId || "")) ||
        !/^\d+$/.test(String(event?.recipientId || "")) ||
        !event?.postback || typeof event.postback !== "object") throw new Error("INVALID_POSTBACK_EVENT");
  }
  const { uri, dbName } = validateProductionMongoConfig(env);
  if (events.comments.length + events.postbacks.length > 1000) throw new Error("TOO_MANY_EVENTS");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const entries = [...events.comments.map(event => ({ kind: "comment", event })),
      ...events.postbacks.map(event => ({ kind: "postback", event }))];
    const owners = [...new Set(entries.map(row => String(row.event.entryId || "")))];
    if (owners.some(x => !/^\d+$/.test(x))) throw new Error("INVALID_WEBHOOK_OWNER");
    // The existing InstagramAccount model uses instagramBusinessId for the
    // subscribed account. Only active known accounts can enter the inbox.
    const accounts = await db.collection("instagramaccounts")
      .find({ $or: [{ instagramBusinessId: { $in: owners } }, { pageId: { $in: owners } }], status: "active" })
      .project({ instagramBusinessId: 1, pageId: 1, userId: 1 }).toArray();
    const ownersById = new Map();
    const ambiguousOwners = new Set();
    for (const account of accounts) {
      for (const key of [String(account.instagramBusinessId), String(account.pageId)]) {
        if (!owners.includes(key)) continue;
        if (ownersById.has(key) && (String(ownersById.get(key).userId) !== String(account.userId) ||
            ownersById.get(key).instagramBusinessId !== String(account.instagramBusinessId))) {
          ambiguousOwners.add(key);
        }
        ownersById.set(key, { userId: account.userId, instagramBusinessId: String(account.instagramBusinessId) });
      }
    }
    let needsReview = 0;
    let inserted = 0;
    const inbox = db.collection("cloudflare_production_webhook_inbox");
    for (const row of entries) {
      const event = row.event;
      const ownerId = String(event.entryId);
      const account = ownersById.get(ownerId);
      const reason = ambiguousOwners.has(ownerId) ? "AMBIGUOUS_ACCOUNT_OWNER" :
        !/^\d+$/.test(account?.instagramBusinessId || "") || !/^[a-f0-9]{24}$/i.test(String(account?.userId || ""))
          ? "UNMAPPED_INSTAGRAM_OWNER" : null;
      const accountId = reason ? ownerId : account.instagramBusinessId;
      if (!reason && row.kind === "comment" && String(event.recipientId || "") === accountId) continue;
      let key = "comment:" + accountId + ":" + event.eventId;
      if (row.kind === "postback") {
        const source = JSON.stringify([accountId, event.senderId, event.recipientId, event.timestamp ?? null, event.postback]);
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
        key = "postback:" + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
      }
      if (reason) {
        key = "review:" + key;
        needsReview++;
      }
      try {
        const result = await inbox.updateOne({ _id: key }, { $setOnInsert: {
          _id: key, kind: row.kind, webhookEntryId: ownerId,
          ...(reason ? { status: "needs_review", outcome: reason } :
            { accountId, userId: account.userId, status: "pending" }),
          event: { ...event, webhookEntryId: ownerId, entryId: accountId }, receivedAt: new Date()
        } }, { upsert: true });
        inserted += result.upsertedCount;
      } catch (error) { if (error.code !== 11000) throw error; }
    }
    return { durable: true, received: entries.length, inserted, needsReview };
  } finally { await client.close(); }
}

 // Read-only production inbox diagnostics. No event bodies, tokens or user IDs.
export async function productionInboxReadiness({ env, MongoClient }) {
  const { uri, dbName } = validateProductionMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const inbox = client.db(dbName).collection("cloudflare_production_webhook_inbox");
    const statuses = ["pending", "planning", "planned", "ignored", "needs_review"];
    const counts = Object.fromEntries(await Promise.all(statuses.map(async status =>
      [status, await inbox.countDocuments({ status }, { maxTimeMS: 5000 })])));
    return { ok: true, durableInbox: true, executionReady: false, counts };
  } finally {
    await client.close();
  }
}

/**
 * Read-only production backlog audit, including the number of unresolved
 * comment events. This does not dispatch any actions or change state.
 */
export async function auditProductionInbox({ env, MongoClient }) {
  const { uri, dbName } = validateProductionMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const inbox = db.collection("cloudflare_production_webhook_inbox");
    const [unprocessedComments, unprocessedPostbacks, ambiguous, plans] = await Promise.all([
      inbox.countDocuments({ kind: "comment", status: "pending" }),
      inbox.countDocuments({ kind: "postback", status: "pending" }),
      inbox.countDocuments({ status: "needs_review" }),
      db.collection("cloudflare_production_action_plans").countDocuments({})
    ]);
    return { ok: true, unprocessedComments, unprocessedPostbacks,
      needsReview: ambiguous, preparedPlans: plans, executionReady: false };
  } finally { await client.close(); }
}
