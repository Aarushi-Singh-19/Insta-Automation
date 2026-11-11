import test from "node:test";
import assert from "node:assert/strict";
import { validateRule } from "./staging-rule-create.js";

test("maps TriggerDM keywords to both compatible staging fields", () => {
  assert.deepEqual(validateRule({ keywords: ["test"] }), {
    keywords: ["test"], triggerKeywords: ["test"]
  });
});

test("maps older staging triggerKeywords to production keywords", () => {
  assert.deepEqual(validateRule({ triggerKeywords: ["hello"] }), {
    triggerKeywords: ["hello"], keywords: ["hello"]
  });
});

test("rejects conflicting keyword aliases instead of silently dropping rules", () => {
  assert.throws(() => validateRule({ keywords: ["a"], triggerKeywords: ["b"] }), /CONFLICTING_KEYWORDS/);
});

test("rejects malformed keyword arrays and unknown fields", () => {
  assert.throws(() => validateRule({ keywords: [123] }), /INVALID_RULE/);
  assert.throws(() => validateRule({ arbitraryField: "value" }), /INVALID_RULE_FIELD/);
});
