import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { resolveStagingComment } from "./staging-comment-resolver.js";

const userId = new ObjectId();
const ruleId = new ObjectId();
const comment = { entryId: "999", postId: "202", commentText: "TEST please" };
const campaign = { _id: new ObjectId(), userId, status: "active", instagramAccountId: "999",
  triggerType: "specific-post", instagramMediaId: "202", ruleIds: [ruleId] };
function fakeDb({ accounts = [{ userId }], campaigns = [campaign], rules = [{
  _id: ruleId, userId, isActive: true, triggerType: "keyword", keywords: ["test"]
}] } = {}) {
  const data = { instagramaccounts: accounts, campaigns, rules };
  return { collection(name) {
    return { find(query) {
      assert.ok(data[name], "Unexpected collection");
      if (name === "instagramaccounts") assert.equal(query.instagramBusinessId, "999");
      if (name === "campaigns") {
        assert.equal(String(query.userId), String(userId));
        assert.equal(query.instagramAccountId, "999");
      }
      if (name === "rules") assert.equal(String(query.userId), String(userId));
      return { project() { return this; }, limit() { return this; },
        async toArray() { return data[name]; } };
    } };
  } };
}

test("resolves owned campaign and production keywords field", async () => {
  const result = await resolveStagingComment({ db: fakeDb(), comment });
  assert.equal(String(result.campaign._id), String(campaign._id));
  assert.equal(String(result.rule._id), String(ruleId));
});

test("fails closed on duplicate Instagram account ownership", async () => {
  const result = await resolveStagingComment({ db: fakeDb({ accounts: [{ userId }, { userId }] }), comment });
  assert.equal(result, null);
});

test("fails closed on ambiguous matching campaigns", async () => {
  const result = await resolveStagingComment({ db: fakeDb({ campaigns: [campaign, { ...campaign }] }), comment });
  assert.equal(result, null);
});

test("does not resolve rules with unmatched keywords", async () => {
  const result = await resolveStagingComment({ db: fakeDb(), comment: { ...comment, commentText: "hello" } });
  assert.equal(result, null);
});

test("rejects malformed webhook account and post IDs before database reads", async () => {
  assert.equal(await resolveStagingComment({ db: fakeDb(), comment: { ...comment, entryId: "bad" } }), null);
  assert.equal(await resolveStagingComment({ db: fakeDb(), comment: { ...comment, postId: "bad" } }), null);
});
