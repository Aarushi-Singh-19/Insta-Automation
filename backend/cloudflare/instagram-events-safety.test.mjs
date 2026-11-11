import test from "node:test";
import assert from "node:assert/strict";
import { extractInstagramEvents } from "./instagram-events.js";

const comment = (id = "123", owner = "999", author = "111") => ({
  object: "instagram",
  entry: [{ id: owner, changes: [{ field: "comments", value: {
    id, text: "test", from: { id: author, username: "tester" }, media: { id: "888" }
  } }] }]
});

test("normalizes a valid Instagram comment without executing actions", () => {
  const events = extractInstagramEvents(comment());
  assert.equal(events.comments.length, 1);
  assert.equal(events.comments[0].eventId, "123");
  assert.equal(events.comments[0].entryId, "999");
  assert.equal(events.postbacks.length, 0);
});

test("ignores own-account comments and replies", () => {
  assert.equal(extractInstagramEvents(comment("123", "999", "999")).comments.length, 0);
  const reply = comment();
  reply.entry[0].changes[0].value.parent_id = "42";
  assert.equal(extractInstagramEvents(reply).comments.length, 0);
});

test("ignores malformed Instagram owner, comment, and media identifiers", () => {
  assert.equal(extractInstagramEvents(comment("abc")).comments.length, 0);
  assert.equal(extractInstagramEvents(comment("123", "invalid")).comments.length, 0);
  const payload = comment();
  payload.entry[0].changes[0].value.media.id = "bad";
  assert.equal(extractInstagramEvents(payload).comments.length, 0);
});

test("rejects malformed payload and oversized entry count", () => {
  assert.throws(() => extractInstagramEvents({ object: "other", entry: [] }), TypeError);
  assert.throws(() => extractInstagramEvents({ object: "instagram", entry: Array(1001).fill({}) }), /Too many/);
});

test("rejects oversized event arrays before processing", () => {
  const payload = comment();
  payload.entry[0].changes = Array(1001).fill(payload.entry[0].changes[0]);
  assert.throws(() => extractInstagramEvents(payload), /Too many/);
});

test("preserves postbacks for later Follow Gate processing without executing them", () => {
  const payload = { object: "instagram", entry: [{
    id: "999", messaging: [{ sender: { id: "111" }, recipient: { id: "999" },
      postback: { payload: "FOLLOW_VERIFY", mid: "m1" } }]
  }] };
  const result = extractInstagramEvents(payload);
  assert.equal(result.postbacks.length, 1);
  assert.equal(result.postbacks[0].postback.payload, "FOLLOW_VERIFY");
});
