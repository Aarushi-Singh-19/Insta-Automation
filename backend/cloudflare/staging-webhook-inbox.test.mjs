import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { persistInstagramInbox } from "./staging-webhook-inbox.js";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://test:pass@cluster.example.net/triggerdm_staging" };
test("persists only in isolated staging inbox and deduplicates repeated comments", async () => {
  const stored = new Set();
  let closed = false;
  class Client {
    async connect() {}
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection(collection) {
      assert.equal(collection, "cloudflare_staging_webhook_inbox");
      return { async updateOne(filter, update, options) {
        assert.equal(options.upsert, true);
        assert.equal(update.$setOnInsert.status, "pending");
        if (stored.has(filter._id)) return { upsertedCount: 0 };
        stored.add(filter._id);
        return { upsertedCount: 1 };
      } };
    } }; }
    async close() { closed = true; }
  }
  const events = { comments: [{ entryId: "789", eventId: "123", postId: "456" }], postbacks: [] };
  assert.equal((await persistInstagramInbox({ env, MongoClient: Client, events })).inserted, 1);
  assert.equal((await persistInstagramInbox({ env, MongoClient: Client, events })).inserted, 0);
  assert.equal(closed, true);
});
test("invalid event IDs fail before any database access", async () => {
  await assert.rejects(persistInstagramInbox({ env, MongoClient: class {}, events: { comments: [{ eventId: "abc" }], postbacks: [] } }), /INVALID_COMMENT_ID/);
});
test("empty webhook envelope does not open a database connection", async () => {
  assert.deepEqual(await persistInstagramInbox({ env, MongoClient: class {}, events: { comments: [], postbacks: [] } }), { durable: true, received: 0, inserted: 0 });
});
