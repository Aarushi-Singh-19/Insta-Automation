import test from "node:test";
import assert from "node:assert/strict";
import { verifyStagingFollowPostback } from "./staging-follow-verifier.js";
const env = { ENABLE_STAGING_FOLLOW_VERIFICATION: "true", MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging" };
const postback = { entryId: "123", senderId: "456", postback: { payload: "VERIFY:follow:comment:123:789" } };
test("verification is disabled unless explicitly enabled", async () => {
  assert.deepEqual(await verifyStagingFollowPostback({ env: { ...env, ENABLE_STAGING_FOLLOW_VERIFICATION: "false" } }), { skipped: "disabled" });
});
test("rejects forged or cross-account payload before database access", async () => {
  let calls = 0;
  class Client { constructor() { calls++; } }
  const args = { env, MongoClient: Client, fetchImpl: async () => {} };
  assert.deepEqual(await verifyStagingFollowPostback({ ...args, postback: { ...postback, entryId: "999" } }),
    { unlocked: false, reason: "UNTRUSTED_POSTBACK" });
  assert.deepEqual(await verifyStagingFollowPostback({ ...args, postback: { ...postback, postback: { payload: "VERIFY" } } }),
    { unlocked: false, reason: "UNTRUSTED_POSTBACK" });
  assert.equal(calls, 0);
});
test("only verified follower with matching waiting session can unlock; no DM sent", async () => {
  const events = [];
  const MongoClient = class {
    async connect() { events.push("connect"); }
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection(collection) {
      if (collection === "cloudflare_staging_follow_gate_sessions") return { async findOne(q) {
        assert.equal(q.recipientId, "456"); assert.equal(q.inboxId, "comment:123:789");
        return { userId: "a".repeat(24) };
      } };
      if (collection === "instagramaccounts") return { async findOne(q) {
        assert.equal(String(q.userId), "a".repeat(24)); return { accessToken: "staging-token" };
      } };
      throw new Error("Unexpected collection");
    } }; }
    async close() { events.push("close"); }
  };
  let confirmed = 0;
  const base = { env, MongoClient, postback, fetchImpl: async () => {},
    confirm: async args => { confirmed++; assert.equal(args.senderId, "456"); return { unlocked: true }; } };
  const noFollow = await verifyStagingFollowPostback({ ...base,
    getFollower: async () => ({ followsBusiness: false }) });
  assert.equal(noFollow.reason, "FOLLOW_NOT_VERIFIED");
  assert.equal(confirmed, 0);
  const yesFollow = await verifyStagingFollowPostback({ ...base,
    getFollower: async args => { assert.equal(args.instagramScopedUserId, "456"); return { followsBusiness: true }; } });
  assert.deepEqual(yesFollow, { unlocked: true, instagramMessagesSent: 0 });
  assert.equal(confirmed, 1);
  assert.deepEqual(events, ["connect", "close", "connect", "close"]);
});
