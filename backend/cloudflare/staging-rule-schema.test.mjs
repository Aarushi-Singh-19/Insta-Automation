import test from "node:test";
import assert from "node:assert/strict";
import { validateRule } from "./staging-rule-create.js";

test("maps API keywords alias to the canonical Rule.js field", () => {
  assert.deepEqual(validateRule({ keywords: ["test"] }), {
    triggerKeywords: ["test"]
  });
});

test("preserves canonical Rule.js triggerKeywords", () => {
  assert.deepEqual(validateRule({ triggerKeywords: ["hello"] }), {
    triggerKeywords: ["hello"]
  });
});

test("rejects conflicting keyword aliases instead of silently dropping rules", () => {
  assert.throws(() => validateRule({ keywords: ["a"], triggerKeywords: ["b"] }), /CONFLICTING_KEYWORDS/);
});

test("rejects malformed keyword arrays and unknown fields", () => {
  assert.throws(() => validateRule({ keywords: [123] }), /INVALID_RULE/);
  assert.throws(() => validateRule({ arbitraryField: "value" }), /INVALID_RULE_FIELD/);
});
