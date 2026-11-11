import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { createStagingRule } from "./staging-rule-create.js";
const id = "507f1f77bcf86cd799439011";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://u:p@cluster.example.net/triggerdm_staging" };
test("creates rule only for authenticated staging user with valid subscription", async () => {
  let inserted;
  class Client {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection(table) {
        if (table === "users") return { async findOne() {
          return { subscriptionStatus: "cancelled", planEndDate: new Date(Date.now() + 86400000) };
        } };
        return { async insertOne(doc) { inserted = doc; return { insertedId: new ObjectId() }; } };
      } };
    }
    async close() {}
  }
  const result = await createStagingRule({ env, MongoClient: Client, authenticatedUserId: id,
    input: { ruleName: "sample", triggerKeywords: ["test"] } });
  assert.equal(result.status, 201);
  assert.equal(String(inserted.userId), id);
});
test("rejects unauthorized fields and malformed rule inputs", async () => {
  for (const input of [{ userId: id }, { priority: "high" }, { triggerKeywords: [42] }]) {
    await assert.rejects(createStagingRule({ env, MongoClient: class {}, authenticatedUserId: id, input }));
  }
});
