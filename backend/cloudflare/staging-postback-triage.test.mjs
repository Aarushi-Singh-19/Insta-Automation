import test from "node:test";
import assert from "node:assert/strict";
import { triageStagingPostbacks } from "./staging-postback-triage.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging",
  ENABLE_STAGING_POSTBACK_TRIAGE: "true" };
test("triage disabled by default without database connection", async () => {
  assert.deepEqual(await triageStagingPostbacks({ env: { ...env, ENABLE_STAGING_POSTBACK_TRIAGE: "false" } }), { skipped: "disabled" });
});
test("triage rejects production DB and invalid batch size", async () => {
  await assert.rejects(triageStagingPostbacks({ env: { ...env, MONGODB_STAGING_DB: "automationDB" } }), /STAGING_DATABASE_REQUIRED/);
  await assert.rejects(triageStagingPostbacks({ env, MongoClient: class {}, limit: 0 }), /INVALID_LIMIT/);
});
test("pending postbacks are quarantined without follower verification or DM sends", async () => {
  const calls = [];
  let remaining = 2;
  class MongoClient {
    async connect() {}
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection(name) {
      assert.equal(name, "cloudflare_staging_webhook_inbox");
      return { async findOneAndUpdate(filter, update) {
        calls.push({ filter, update });
        return remaining-- > 0 ? { _id: "postback:test" } : null;
      } };
    } }; }
    async close() { calls.push("closed"); }
  }
  assert.deepEqual(await triageStagingPostbacks({ env, MongoClient }), { reviewed: 2, verified: 0, instagramMessagesSent: 0 });
  assert.equal(calls[0].filter.kind, "postback");
  assert.equal(calls[0].filter.status, "pending");
  assert.equal(calls[0].update.$set.status, "needs_review");
  assert.equal(calls[0].update.$set.outcome, "FOLLOW_VERIFICATION_REQUIRED");
  assert.equal(calls.at(-1), "closed");
});
