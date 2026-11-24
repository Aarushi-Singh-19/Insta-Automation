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
        if (name === "instagramaccounts") return { find(filter) { return {
          project() { return this; }, async toArray() {
            return accounts.filter(account => account.status !== "revoked" &&
              (filter.$or || [filter]).some(match => Object.entries(match)
                .some(([key, value]) => value?.$in?.includes(account[key]))));
          },
        }; } };
        assert.equal(name, "cloudflare_production_webhook_inbox");
        return { async findOne({ _id }) { return rows.get(_id) ?? null; },
          async updateOne({ _id }, update) {
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

  accounts[0].webhookEntryId = "999";
  assert.equal((await persist([{ ...comment, entryId: "999" }])).inserted, 0);
  assert.equal((await persist([{ ...comment, entryId: "999", eventId: "12" }])).inserted, 1);
  assert.equal(rows.get("comment:123:12").webhookEntryId, "999");
  assert.equal((await persist([{ ...comment, entryId: "124", eventId: "12" }])).inserted, 0);

  const postbacks = ["999", "456"].map(recipientId => ({
    entryId: "999", senderId: "30", recipientId, postback: { payload: "fixture" },
  }));
  const result = await persistProductionInstagramEvents({ env, MongoClient, events: { comments: [], postbacks } });
  assert.equal(result.inserted, 2);
  assert.equal(result.needsReview, 1);
  assert.ok([...rows.values()].some(row => row.kind === "postback" && row.accountId === "123"));
  assert.ok([...rows.values()].some(row => row.outcome === "MISMATCHED_POSTBACK_RECIPIENT"));

  accounts[1].webhookEntryId = "999";
  await persist([{ ...comment, entryId: "999", eventId: "13" }]);
  assert.equal(rows.get("review:comment:999:13").outcome, "AMBIGUOUS_ACCOUNT_OWNER");
  delete accounts[1].webhookEntryId;
  accounts[1].pageId = "999";
  await persist([{ ...comment, entryId: "999", eventId: "14" }]);
  assert.equal(rows.get("review:comment:999:14").outcome, "AMBIGUOUS_ACCOUNT_OWNER");
  accounts[1].pageId = "457";
  accounts.push({ instagramBusinessId: "123", pageId: "125", userId: users[1] });
  await persist([{ ...comment, entryId: "999", eventId: "15" }]);
  assert.equal(rows.get("review:comment:999:15").outcome, "AMBIGUOUS_ACCOUNT_OWNER");
});
