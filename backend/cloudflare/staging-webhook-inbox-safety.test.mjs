import test from "node:test";
import assert from "node:assert/strict";
import { persistInstagramInbox } from "./staging-webhook-inbox.js";

const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging" };
const comment = { eventId: "123", entryId: "999", postId: "888", commentText: "test" };
function fakeMongo() {
  const docs = new Map();
  const collection = { async updateOne(filter, update) {
    if (docs.has(filter._id)) return { upsertedCount: 0 };
    docs.set(filter._id, update.$setOnInsert);
    return { upsertedCount: 1 };
  } };
  class MongoClient {
    async connect() {}
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection: () => collection }; }
    async close() {}
  }
  return { MongoClient, docs };
}

test("deduplicates repeated comment deliveries without duplicate inserts", async () => {
  const { MongoClient, docs } = fakeMongo();
  const input = { env, MongoClient, events: { comments: [comment, comment], postbacks: [] } };
  const first = await persistInstagramInbox(input);
  const second = await persistInstagramInbox(input);
  assert.equal(first.received, 2);
  assert.equal(first.inserted, 1);
  assert.equal(second.inserted, 0);
  assert.equal(docs.size, 1);
});

test("scopes comment idempotency to Instagram owner", async () => {
  const { MongoClient, docs } = fakeMongo();
  const result = await persistInstagramInbox({ env, MongoClient, events: {
    comments: [comment, { ...comment, entryId: "998" }], postbacks: []
  } });
  assert.equal(result.inserted, 2);
  assert.equal(docs.size, 2);
});

test("rejects invalid IDs before connecting to MongoDB", async () => {
  let constructed = false;
  class MongoClient { constructor() { constructed = true; } }
  await assert.rejects(persistInstagramInbox({ env, MongoClient, events: {
    comments: [{ ...comment, postId: "invalid" }], postbacks: []
  } }), /INVALID_COMMENT_SOURCE/);
  assert.equal(constructed, false);
});

test("rejects oversized batches before connecting to MongoDB", async () => {
  let constructed = false;
  class MongoClient { constructor() { constructed = true; } }
  await assert.rejects(persistInstagramInbox({ env, MongoClient, events: {
    comments: Array(1001).fill(comment), postbacks: []
  } }), /TOO_MANY_EVENTS/);
  assert.equal(constructed, false);
});

test("rejects non-staging database configuration", async () => {
  const { MongoClient } = fakeMongo();
  await assert.rejects(persistInstagramInbox({ env: { ...env, MONGODB_STAGING_DB: "automationDB" },
    MongoClient, events: { comments: [], postbacks: [] } }), /STAGING_DATABASE_REQUIRED/);
});
