import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { resolveStagingComment } from "./staging-comment-resolver.js";
const uid = new ObjectId(), rid = new ObjectId(), cid = new ObjectId();
const comment = { entryId: "123456", postId: "789012", commentText: "test", eventId: "123" };
function dbFor({ accounts = [{ _id: new ObjectId(), instagramBusinessId: comment.entryId, userId: uid }],
  campaigns = [{ _id: cid, userId: uid, ruleIds: [rid], status: "active", triggerType: "specific-post", instagramMediaId: comment.postId }],
  rule = { _id: rid, userId: uid, isActive: true, triggerType: "keyword", triggerKeywords: ["test"] } } = {}) {
  return { collection(name) {
    if (name === "instagramaccounts") return { find(query) {
      assert.equal(query.instagramBusinessId, comment.entryId);
      return { project() { return { limit() { return { toArray: async () => accounts }; } }; } };
    } };
    if (name === "campaigns") return { find(query) {
      assert.equal(String(query.userId), String(uid));
      assert.equal(query.status, "active");
      assert.equal(query.instagramAccountId, comment.entryId);
      assert.deepEqual(query.$or, [
        { triggerType: "any-post" },
        { triggerType: "specific-post", instagramMediaId: comment.postId },
        { triggerType: "specific-post", postIds: comment.postId }
      ]);
      return { project() { return { limit() { return { toArray: async () => campaigns }; } }; } };
    } };
    if (name === "rules") return { find(query) {
      assert.ok(query._id.$in.some(id => String(id) === String(rid)));
      assert.equal(String(query.userId), String(uid));
      return { project() { return { toArray: async () => rule ? (Array.isArray(rule) ? rule : [rule]) : [] }; } };
    } };
    throw Error("Unexpected collection");
  } };
}
test("resolves a unique account campaign and owned active rule", async () => {
  const resolved = await resolveStagingComment({ db: dbFor(), comment });
  assert.equal(String(resolved.campaign._id), String(cid));
  assert.equal(String(resolved.rule._id), String(rid));
});
test("rejects ambiguous accounts or campaigns and missing rule", async () => {
  assert.equal(await resolveStagingComment({ db: dbFor({ accounts: [{ userId: uid }, { userId: uid }] }), comment }), null);
  assert.equal(await resolveStagingComment({ db: dbFor({ campaigns: [{ ruleIds: [rid] }, { ruleIds: [rid] }] }), comment }), null);
  assert.equal(await resolveStagingComment({ db: dbFor({ rule: null }), comment }), null);
});
test("rejects malformed webhook IDs without querying database", async () => {
  assert.equal(await resolveStagingComment({ db: dbFor(), comment: { ...comment, entryId: "bad" } }), null);
});

test("selects first matching owned rule from multi-rule campaign", async () => {
  const second = new ObjectId();
  const result = await resolveStagingComment({ db: dbFor({ campaigns: [{ _id: cid, userId: uid, ruleIds: [second, rid] }] }), comment });
  assert.equal(String(result.rule._id), String(rid));
});
