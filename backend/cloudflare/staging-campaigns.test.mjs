import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { listOwnCampaigns } from "./staging-campaigns.js";
const userId = "507f1f77bcf86cd799439011";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://user:pass@cluster.example.net/triggerdm_staging" };
test("rejects unauthenticated and malformed user IDs before database access", async () => {
  for (const id of [undefined, "", "not-an-id", "automationDB"]) {
    await assert.rejects(listOwnCampaigns({ env, MongoClient: class {}, authenticatedUserId: id }), /AUTHENTICATED_USER_REQUIRED/);
  }
});
test("reads only caller campaigns with an allowlisted projection", async () => {
  let closed = false;
  const calls = {};
  const record = { _id: new ObjectId(), status: "active", triggerType: "specific-post", instagramMediaId: "123", accessToken: "must-not-leak" };
  class Client {
    async connect() {}
    db(dbName) {
      assert.equal(dbName, "triggerdm_staging");
      return { collection(name) {
        assert.equal(name, "campaigns");
        return { find(filter) {
          calls.filter = filter;
          return { project(projection) {
            calls.projection = projection;
            return { sort() { return { limit() { return { async toArray() { return [record]; } }; } }; } };
          } };
        } };
      } };
    }
    async close() { closed = true; }
  }
  const rows = await listOwnCampaigns({ env, MongoClient: Client, authenticatedUserId: userId });
  assert.equal(String(calls.filter.userId), userId);
  assert.equal(calls.projection.accessToken, undefined);
  assert.equal(rows[0].accessToken, undefined);
  assert.equal(rows[0].id, String(record._id));
  assert.equal(closed, true);
});
test("rejects excessive page size", async () => {
  await assert.rejects(listOwnCampaigns({ env, MongoClient: class {}, authenticatedUserId: userId, limit: 100 }), /INVALID_PAGE_LIMIT/);
});
