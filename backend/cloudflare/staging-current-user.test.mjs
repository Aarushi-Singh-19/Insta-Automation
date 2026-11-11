import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { getStagingCurrentUser } from "./staging-current-user.js";
import worker from "./worker.js";
const id = "507f1f77bcf86cd799439011";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://u:p@cluster.example.net/triggerdm_staging" };
test("native current user selects staging DB, excludes secrets, preserves response fields", async () => {
  let closed = false;
  class Client {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection(table) {
        assert.equal(table, "users");
        return { async findOne(query, options) {
          assert.equal(String(query._id), id);
          for (const key of ["password", "accessToken", "passwordResetTokenHash", "razorpaySubscriptionId"]) {
            assert.equal(options.projection[key], 0);
          }
          return { _id: new ObjectId(id), name: "Fixture", subscriptionStatus: "trial",
            trialEndDate: new Date("2020-01-01") };
        } };
      } };
    }
    async close() { closed = true; }
  }
  const user = await getStagingCurrentUser({ env, MongoClient: Client, authenticatedUserId: id });
  assert.equal(user._id, id);
  assert.equal(user.subscriptionStatus, "expired");
  assert.equal(closed, true);
});
test("native current user rejects malformed user IDs before connecting", async () => {
  await assert.rejects(getStagingCurrentUser({ env, MongoClient: class {}, authenticatedUserId: "invalid" }), /AUTHENTICATED_USER_REQUIRED/);
});
test("native auth/me stays opt-in and rejects missing JWT when enabled", async () => {
  const url = "https://staging.workers.dev/api/auth/me";
  const enabled = await worker.fetch(new Request(url), { ...env, ENABLE_NATIVE_STAGING_AUTH_ME: "true", STAGING_JWT_SECRET: "staging-only-test-secret" });
  assert.equal(enabled.status, 401);
});
