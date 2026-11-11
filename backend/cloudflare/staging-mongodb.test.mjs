import test from "node:test";
import assert from "node:assert/strict";
import { validateStagingMongoConfig, probeStagingMongo } from "./staging-mongodb.js";
const env = { MONGODB_STAGING_URI: "mongodb+srv://test:password@example.mongodb.net/", MONGODB_STAGING_DB: "triggerdm_staging" };
test("only explicit staging database is permitted", () => {
  assert.equal(validateStagingMongoConfig(env).dbName, "triggerdm_staging");
  for (const db of ["automationDB", "admin", "triggerdm_prod", "", "../triggerdm_staging"]) {
    assert.throws(() => validateStagingMongoConfig({ ...env, MONGODB_STAGING_DB: db }), /STAGING_DATABASE_REQUIRED/);
  }
});
test("requires a MongoDB URI and never falls back to production", () => {
  assert.throws(() => validateStagingMongoConfig({ MONGODB_STAGING_DB: "triggerdm_staging" }), /STAGING_MONGODB_URI_REQUIRED/);
  assert.throws(() => validateStagingMongoConfig({ ...env, MONGODB_STAGING_URI: "https://example.com" }), /STAGING_MONGODB_URI_REQUIRED/);
});
test("connects, pings staging database, and always closes client", async () => {
  const calls = [];
  class FakeMongoClient {
    constructor(uri, opts) { calls.push(["construct", uri, opts.maxPoolSize]); }
    async connect() { calls.push(["connect"]); }
    db(name) { calls.push(["db", name]); return { command: async command => calls.push(["command", command]) }; }
    async close() { calls.push(["close"]); }
  }
  assert.deepEqual(await probeStagingMongo(env, FakeMongoClient), { ok: true, database: "triggerdm_staging", access: "read-only-probe" });
  assert.deepEqual(calls.map(x => x[0]), ["construct", "connect", "db", "command", "close"]);
});
test("closes MongoDB client when ping fails", async () => {
  let closed = false;
  class FailingClient {
    async connect() {}
    db() { return { command: async () => { throw new Error("Atlas unavailable"); } }; }
    async close() { closed = true; }
  }
  await assert.rejects(probeStagingMongo(env, FailingClient), /Atlas unavailable/);
  assert.equal(closed, true);
});
