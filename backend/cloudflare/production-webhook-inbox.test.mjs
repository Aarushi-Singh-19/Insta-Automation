import assert from "node:assert/strict";
import { test } from "node:test";
import { ObjectId } from "mongodb";
import { persistProductionInstagramEvents } from "./production-webhook-inbox.js";

const env = {
  TRIGGERDM_RUNTIME: "production", PRODUCTION_CUTOVER_APPROVED: "true",
  MONGODB_PRODUCTION_DB: "automationDB",
  MONGODB_PRODUCTION_URI: "mongodb://fixture:fixture@localhost/automationDB",
};

test("production maps two owners and deduplicates a comment replay through an account alias", async () => {
  const users = [new ObjectId(), new ObjectId()];
  const accounts = [
    { instagramBusinessId: "123", pageId: "124", userId: users[0] },
    { instagramBusinessId: "456", pageId: "457", userId: users[1] },
  ];
  const rows = new Map();
  class MongoClient {
    async connect() {}
    db(database) {
      assert.equal(database, "automationDB");
      return { collection(name) {
        if (name === "instagramaccounts") return { find() { return {
          project() { return this; }, async toArray() { return accounts; },
        }; } };
        assert.equal(name, "cloudflare_production_webhook_inbox");
        return { async updateOne({ _id }, update) {
          if (rows.has(_id)) return { upsertedCount: 0 };
          rows.set(_id, update.$setOnInsert);
          return { upsertedCount: 1 };
        } };
      } };
    }
    async close() {}
  }
  const persist = comments => persistProductionInstagramEvents({ env, MongoClient, events: { comments, postbacks: [] } });
  const comment = { eventId: "10", postId: "20", recipientId: "30" };
  assert.equal((await persist([{ ...comment, entryId: "124" }, { ...comment, entryId: "456" }])).inserted, 2);
  assert.equal((await persist([{ ...comment, entryId: "123" }])).inserted, 0);
  assert.equal(rows.get("comment:123:10").userId, users[0]);
  assert.equal(rows.get("comment:456:10").userId, users[1]);
  assert.equal(rows.get("comment:123:10").event.entryId, "123");
  const mixed = await persist([{ ...comment, entryId: "999" }, { ...comment, entryId: "456", eventId: "11" }]);
  assert.equal(mixed.needsReview, 1);
  assert.equal(rows.get("review:comment:999:10").status, "needs_review");
  assert.equal(rows.get("comment:456:11").status, "pending");
});
