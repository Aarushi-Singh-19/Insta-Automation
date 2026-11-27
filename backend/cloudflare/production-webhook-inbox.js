import { validateProductionMongoConfig } from "./production-mongodb.js";

async function inboxKey(kind, accountId, event) {
  if (kind === "comment") return "comment:" + accountId + ":" + event.eventId;
  const source = JSON.stringify([accountId, event.senderId, event.recipientId, event.timestamp ?? null, event.postback]);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return "postback:" + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

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
    const accountCollection = db.collection("instagramaccounts");
    const accounts = await accountCollection.find({ status: "active", $or: [
      { instagramBusinessId: { $in: owners } }, { pageId: { $in: owners } },
      { webhookEntryId: { $in: owners } },
    ] }).project({ instagramBusinessId: 1, pageId: 1, webhookEntryId: 1, userId: 1 }).toArray();
    const ownerIds = new Set(owners);
    const ownersById = new Map();
    const ambiguousOwners = new Set();
    for (const account of accounts) {
      const directIds = new Set([String(account.instagramBusinessId), String(account.pageId)]);
      const keys = new Set([...directIds, account.webhookEntryId]);
      for (const key of keys) {
        if (!ownerIds.has(key)) continue;
        const approvedAlias = !directIds.has(key);
        const existing = ownersById.get(key);
        if (existing && (approvedAlias || existing.approvedAlias ||
            String(existing.userId) !== String(account.userId) ||
            existing.instagramBusinessId !== String(account.instagramBusinessId))) {
          ambiguousOwners.add(key);
        }
        ownersById.set(key, { userId: account.userId, instagramBusinessId: String(account.instagramBusinessId), approvedAlias });
      }
    }
    const aliasTargets = [...new Set([...ownersById.values()]
      .filter(account => account.approvedAlias).map(account => account.instagramBusinessId))];
    if (aliasTargets.length) {
      const targets = await accountCollection.find({ status: "active", instagramBusinessId: { $in: aliasTargets } })
        .project({ instagramBusinessId: 1 }).toArray();
      const counts = new Map();
      for (const { instagramBusinessId } of targets) {
        counts.set(instagramBusinessId, (counts.get(instagramBusinessId) || 0) + 1);
      }
      for (const [key, account] of ownersById) {
        if (account.approvedAlias && counts.get(account.instagramBusinessId) !== 1) ambiguousOwners.add(key);
      }
    }
    let needsReview = 0;
    let inserted = 0;
    const insertedPostbackIds = [];
    const inbox = db.collection("cloudflare_production_webhook_inbox");
    for (const row of entries) {
      const event = row.event;
      const ownerId = String(event.entryId);
      const account = ownersById.get(ownerId);
      const reason = ambiguousOwners.has(ownerId) ? "AMBIGUOUS_ACCOUNT_OWNER" :
        !/^\d+$/.test(account?.instagramBusinessId || "") || !/^[a-f0-9]{24}$/i.test(String(account?.userId || ""))
          ? "UNMAPPED_INSTAGRAM_OWNER" :
          account.approvedAlias && row.kind === "postback" &&
            ![ownerId, account.instagramBusinessId].includes(String(event.recipientId))
            ? "MISMATCHED_POSTBACK_RECIPIENT" : null;
      const accountId = reason ? ownerId : account.instagramBusinessId;
      if (!reason && row.kind === "comment" && String(event.recipientId || "") === accountId) continue;
      let key = await inboxKey(row.kind, accountId, event);
      if (!reason && account.approvedAlias) {
        // A Meta redelivery must not activate an event already held for review.
        const reviewKey = "review:" + await inboxKey(row.kind, ownerId, event);
        if (await inbox.findOne({ _id: reviewKey }, { projection: { _id: 1 } })) {
          needsReview++;
          continue;
        }
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
        if (result.upsertedCount && !reason && row.kind === "postback") insertedPostbackIds.push(key);
      } catch (error) { if (error.code !== 11000) throw error; }
    }
    return { durable: true, received: entries.length, inserted, needsReview, insertedPostbackIds };
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
