import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { listStagingRules } from "./staging-rules.js";
import worker from "./worker.js";
const id = "507f1f77bcf86cd799439011";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://u:p@cluster.example.net/triggerdm_staging" };
test("native rules reads only authenticated owner from staging", async () => {
  let closed = false;
  class Client {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection(name) {
        assert.equal(name, "rules");
        return { find(query) {
          assert.equal(String(query.userId), id);
          return { project(projection) {
            assert.equal(projection.accessToken, 0);
            return { sort(order) {
              assert.deepEqual(order, { priority: -1 });
              return { limit(n) {
                assert.ok(n <= 200);
                return { async toArray() {
                  return [{ _id: new ObjectId(), userId: new ObjectId(id), triggerKeywords: ["test"] }];
                } };
              } };
            } };
          } };
        } };
      } };
    }
    async close() { closed = true; }
  }
  const rows = await listStagingRules({ env, MongoClient: Client, authenticatedUserId: id });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, id);
  assert.equal(closed, true);
});
test("native rules rejects untrusted user identity", async () => {
  await assert.rejects(listStagingRules({ env, MongoClient: class {}, authenticatedUserId: "bad" }), /AUTHENTICATED_USER_REQUIRED/);
});
test("native rules requires opt-in and a valid session", async () => {
  const url = "https://example.workers.dev/api/rules";
  const res = await worker.fetch(new Request(url), { ...env, ENABLE_NATIVE_STAGING_RULES: "true", STAGING_JWT_SECRET: "staging-secret-for-tests" });
  assert.equal(res.status, 401);
});
