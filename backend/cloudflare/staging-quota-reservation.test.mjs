import test from "node:test";
import assert from "node:assert/strict";
import { reserveStagingDmQuota } from "./staging-quota-reservation.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://user:pass@cluster.example.net/triggerdm_staging" };
const userId = "507f1f77bcf86cd799439011";
const start = new Date(Date.now() - 3600000).toISOString();
const end = new Date(Date.now() + 3600000).toISOString();
test("transactionally increments staging quota and creates one reservation", async () => {
  const calls = [];
  const session = { async withTransaction(fn) { calls.push("transaction"); await fn(); }, async endSession() { calls.push("end"); } };
  class Client {
    startSession() { return session; }
    async connect() { calls.push("connect"); }
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection: collection => {
      if (collection === "cloudflare_staging_dm_reservations") return {
        async findOne() { return null; },
        async insertOne(row, options) { assert.equal(options.session, session); assert.equal(row.status, "reserved"); calls.push("insert"); }
      };
      if (collection === "cloudflare_staging_dm_quota") return {
        async updateOne(filter, update, options) { assert.equal(options.session, session); assert.equal(update.$setOnInsert.used, 0); calls.push("initialize"); },
        async findOneAndUpdate(filter, update, options) {
          assert.equal(filter.used.$lt, 500); assert.equal(update.$inc.used, 1);
          assert.equal(options.session, session); calls.push("increment"); return { _id: filter._id };
        }
      };
      throw Error("unexpected collection");
    } }; }
    async close() { calls.push("close"); }
  }
  const result = await reserveStagingDmQuota({ env, MongoClient: Client, userId, actionId: "comment:123:dm", periodStart: start, periodEnd: end, limit: 500 });
  assert.equal(result.reserved, true);
  assert.equal(result.duplicate, false);
  assert.deepEqual(calls, ["connect", "transaction", "initialize", "increment", "insert", "end", "close"]);
});
test("existing reservation is idempotent and does not increment quota", async () => {
  let updates = 0;
  const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
  class Client {
    startSession() { return session; }
    async connect() {}
    db() { return { collection: () => ({
      async findOne() { return { bucketId: userId + ":" + start + ":" + end }; },
      async updateOne() { updates++; }
    }) }; }
    async close() {}
  }
  const result = await reserveStagingDmQuota({ env, MongoClient: Client, userId, actionId: "comment:123:dm", periodStart: start, periodEnd: end, limit: 500 });
  assert.equal(result.duplicate, true);
  assert.equal(updates, 0);
});
test("rejects invalid identifiers and limits before opening a session", async () => {
  for (const overrides of [{ userId: "bad" }, { actionId: "a/b" }, { limit: 501 }, { periodEnd: start }]) {
    await assert.rejects(reserveStagingDmQuota({ env, MongoClient: class {}, userId, actionId: "comment:123:dm", periodStart: start, periodEnd: end, limit: 500, ...overrides }));
  }
});
