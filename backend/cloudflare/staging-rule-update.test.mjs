import test from "node:test";
import assert from "node:assert/strict";
import { updateStagingRule } from "./staging-rule-update.js";
const id = "507f1f77bcf86cd799439011";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://u:p@cluster.example.net/triggerdm_staging" };
test("native rule update modifies only authenticated owner's allowed fields", async () => {
  let query, update;
  class Client {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection(name) {
        assert.equal(name, "rules");
        return { async findOneAndUpdate(filter, change) {
          query = filter; update = change;
          return { ruleName: change.$set.ruleName };
        } };
      } };
    }
    async close() {}
  }
  const result = await updateStagingRule({ env, MongoClient: Client, authenticatedUserId: id, ruleId: id, input: { ruleName: "updated" } });
  assert.equal(result.status, 200);
  assert.equal(String(query.userId), id);
  assert.equal(update.$set.ruleName, "updated");
});
test("native rule update rejects userId override", async () => {
  await assert.rejects(updateStagingRule({ env, MongoClient: class {}, authenticatedUserId: id, ruleId: id, input: { userId: id } }), /INVALID_RULE_FIELD/);
});
