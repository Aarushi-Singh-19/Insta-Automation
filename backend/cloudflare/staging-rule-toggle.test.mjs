import test from "node:test";
import assert from "node:assert/strict";
import { toggleStagingRule } from "./staging-rule-toggle.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://u:p@cluster.example.net/triggerdm_staging" };
const id = "507f1f77bcf86cd799439011";
test("toggle uses atomic update scoped to authenticated owner", async () => {
  let query, pipeline;
  class Client {
    async connect() {}
    db() { return { collection() { return { async findOneAndUpdate(filter, update) {
      query = filter; pipeline = update; return { isActive: false };
    } }; } }; }
    async close() {}
  }
  const result = await toggleStagingRule({ env, MongoClient: Client, authenticatedUserId: id, ruleId: id });
  assert.equal(result.status, 200);
  assert.equal(String(query.userId), id);
  assert.equal(pipeline[0].$set.isActive.$not[0], "$isActive");
});
test("toggle rejects invalid IDs without DB access", async () => {
  const result = await toggleStagingRule({ env, MongoClient: class {}, authenticatedUserId: id, ruleId: "bad" });
  assert.equal(result.status, 400);
});
