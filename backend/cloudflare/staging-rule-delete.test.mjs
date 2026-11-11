import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { deleteStagingRule } from "./staging-rule-delete.js";
const id = "507f1f77bcf86cd799439011";
const ruleId = "507f191e810c19729de860ea";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://u:p@cluster.example.net/triggerdm_staging" };
test("deletes only a rule owned by the authenticated user in staging", async () => {
  let filter, closed = false;
  class Client {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection(name) {
        assert.equal(name, "rules");
        return { async findOneAndDelete(query) {
          filter = query;
          return { _id: new ObjectId(ruleId) };
        } };
      } };
    }
    async close() { closed = true; }
  }
  const result = await deleteStagingRule({ env, MongoClient: Client, authenticatedUserId: id, ruleId });
  assert.equal(result.status, 200);
  assert.equal(String(filter.userId), id);
  assert.equal(String(filter._id), ruleId);
  assert.equal(closed, true);
});
test("rejects invalid IDs before touching MongoDB", async () => {
  const result = await deleteStagingRule({ env, MongoClient: class {}, authenticatedUserId: id, ruleId: "bad" });
  assert.equal(result.status, 400);
});
