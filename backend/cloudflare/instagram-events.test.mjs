import test from "node:test";
import assert from "node:assert/strict";
import { extractInstagramEvents } from "./instagram-events.js";
const wrap = (changes = [], messaging = []) => ({ object: "instagram", entry: [{ id: "123456", changes, messaging }] });
const comment = value => ({ field: "comments", value });
test("normalizes a top-level Instagram comment without losing sender and post", () => {
  const payload = wrap([comment({ id: "111", media: { id: "222" }, text: "test", from: { id: "333", username: "visitor" } })]);
  assert.deepEqual(extractInstagramEvents(payload).comments[0], { entryId: "123456", eventId: "111", postId: "222", commentText: "test", username: "visitor", recipientId: "333", commentTimestamp: null });
});
test("ignores comment replies and own business comments", () => {
  const payload = wrap([comment({ id: "444", parent_id: "555", media_id: "222" }), comment({ id: "666", media_id: "222", from: { id: "123456" } })]);
  assert.equal(extractInstagramEvents(payload).comments.length, 0);
});
test("ignores non-comment changes and missing event identifiers", () => {
  const payload = wrap([{ field: "mentions", value: { id: "m1" } }, comment({ id: "777" }), comment({ media_id: "222" })]);
  assert.equal(extractInstagramEvents(payload).comments.length, 0);
});
test("preserves Follow Gate postbacks without executing them", () => {
  const payload = wrap([], [{ sender: { id: "333" }, recipient: { id: "123456" }, postback: { payload: "VERIFY" } }]);
  assert.equal(extractInstagramEvents(payload).postbacks[0].postback.payload, "VERIFY");
  assert.equal(extractInstagramEvents(payload).comments.length, 0);
});
test("rejects malformed envelopes rather than silently acknowledging", () => {
  assert.throws(() => extractInstagramEvents({ object: "page", entry: [] }));
  assert.throws(() => extractInstagramEvents({ object: "instagram", entry: null }));
});
