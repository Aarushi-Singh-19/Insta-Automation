import { validateProductionMongoConfig } from "./production-mongodb.js";

// Production multi-account ingress. Do not acknowledge events unless every
// accepted event is durably stored. Execution remains a separate release gate.
export async function persistProductionInstagramEvents({ env, MongoClient, events }) {
  if (!events || !Array.isArray(events.comments) || !Array.isArray(events.postbacks)) throw new Error("INVALID_EVENTS");
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
      .find({ instagramBusinessId: { $in: owners }, status: "active" })
      .project({ instagramBusinessId: 1, userId: 1 }).toArray();
    const ownersById = new Map();
    for (const account of accounts) {
      const key = String(account.instagramBusinessId);
      if (ownersById.has(key) && String(ownersById.get(key)) !== String(account.userId)) throw new Error("AMBIGUOUS_ACCOUNT_OWNER");
      ownersById.set(key, account.userId);
    }
    // Unknown accounts must not be silently acknowledged and lost.
    if (owners.some(x => !ownersById.has(x))) throw new Error("UNMAPPED_INSTAGRAM_OWNER");
    let inserted = 0;
    const inbox = db.collection("cloudflare_production_webhook_inbox");
    for (const row of entries) {
      const event = row.event;
      const ownerId = String(event.entryId);
      const source = row.kind === "comment" ? ownerId + ":" + String(event.eventId) :
        JSON.stringify([ownerId, event.senderId, event.recipientId, event.postback]);
      if (row.kind === "comment" && !/^\d+$/.test(String(event.eventId))) throw new Error("INVALID_EVENT_ID");
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(row.kind + ":" + source));
      const key = row.kind + ":" + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
      try {
        const result = await inbox.updateOne({ _id: key }, { $setOnInsert: {
          _id: key, kind: row.kind, accountId: ownerId, userId: ownersById.get(ownerId),
          event, status: "pending", receivedAt: new Date()
        } }, { upsert: true });
        inserted += result.upsertedCount;
      } catch (error) { if (error.code !== 11000) throw error; }
    }
    return { durable: true, received: entries.length, inserted };
  } finally { await client.close(); }
}
