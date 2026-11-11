import test from "node:test";
import assert from "node:assert/strict";
import { runtimeReadiness } from "./runtime-readiness.js";

test("no upstream means probe-only, never native ready", () => {
  const status = runtimeReadiness({});
  assert.equal(status.mode, "probe-only");
  assert.equal(status.nativeBackendReady, false);
});
test("configured upstream is correctly described as hybrid proxy", () => {
  const status = runtimeReadiness({ UPSTREAM_ORIGIN: "https://staging.example.com" });
  assert.equal(status.mode, "hybrid-proxy");
  assert.equal(status.dependencies.upstream, "configured");
  assert.equal(status.nativeBackendReady, false);
});
test("health status never exposes secrets or backend URL", () => {
  const serialized = JSON.stringify(runtimeReadiness({
    UPSTREAM_ORIGIN: "https://secret-upstream.example.com",
    MONGODB_URI: "mongodb+srv://username:password@secret.example.com",
    META_APP_SECRET: "top-secret",
  }));
  for (const value of ["secret-upstream", "password", "top-secret"]) assert.equal(serialized.includes(value), false);
});
