import test from "node:test";
import assert from "node:assert/strict";
import { extractInstagramEvents } from "./instagram-events.js";
const wrap = (changes = [], messaging = []) => ({ object: "instagram", entry: [{ id: "business-1", changes, messaging }] });
const comment = value => ({ field: "comments", value });
test("normalizes a top-level Instagram comment without losing sender and post", () => {
  const payload = wrap([comment({ id: "c1", media: { id: "p1" }, text: "test", from: { id: "person", username: "visitor" } })]);
  assert.deepEqual(extractInstagramEvents(payload).comments[0], { entryId: "business-1", eventId: "c1", postId: "p1", commentText: "test", username: "visitor", recipientId: "person", commentTimestamp: null });
});
test("ignores comment replies and own business comments", () => {
  const payload = wrap([comment({ id: "reply", parent_id: "parent", media_id: "p1" }), comment({ id: "own", media_id: "p1", from: { id: "business-1" } })]);
  assert.equal(extractInstagramEvents(payload).comments.length, 0);
});
test("ignores non-comment changes and missing event identifiers", () => {
  const payload = wrap([{ field: "mentions", value: { id: "m1" } }, comment({ id: "c2" }), comment({ media_id: "p1" })]);
  assert.equal(extractInstagramEvents(payload).comments.length, 0);
});
test("preserves Follow Gate postbacks without executing them", () => {
  const payload = wrap([], [{ sender: { id: "person" }, recipient: { id: "business-1" }, postback: { payload: "VERIFY" } }]);
  assert.equal(extractInstagramEvents(payload).postbacks[0].postback.payload, "VERIFY");
  assert.equal(extractInstagramEvents(payload).comments.length, 0);
});
test("rejects malformed envelopes rather than silently acknowledging", () => {
  assert.throws(() => extractInstagramEvents({ object: "page", entry: [] }));
  assert.throws(() => extractInstagramEvents({ object: "instagram", entry: null }));
});
