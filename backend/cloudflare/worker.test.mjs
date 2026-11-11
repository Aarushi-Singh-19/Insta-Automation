import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const fakeEnv = { VERIFY_TOKEN: "verify-test" };
test("health endpoint identifies probe-only runtime", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/health"), fakeEnv);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, "probe-only");
});
test("Instagram verification accepts only configured challenge token", async () => {
  const good = await worker.fetch(new Request("https://example.workers.dev/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=abc123"), fakeEnv);
  assert.equal(good.status, 200);
  assert.equal(await good.text(), "abc123");
  const bad = await worker.fetch(new Request("https://example.workers.dev/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123"), fakeEnv);
  assert.equal(bad.status, 403);
});
test("unsigned Instagram and Razorpay webhooks are rejected", async () => {
  for (const path of ["/api/webhook/instagram", "/api/billing/razorpay-webhook"]) {
    const response = await worker.fetch(new Request("https://example.workers.dev" + path, { method: "POST", body: "{}" }), fakeEnv);
    assert.equal(response.status, 403);
  }
});
test("queue handler retries without configured durable executor", async () => {
  const message = { body: { name: "process-comment" }, acked: 0, retried: 0,
    ack() { this.acked++; }, retry() { this.retried++; } };
  await worker.queue({ messages: [message] }, {});
  assert.equal(message.acked, 0);
  assert.equal(message.retried, 1);
});

test("staging campaign endpoint is disabled unless explicitly opted in", async () => {
  const request = new Request("https://example.workers.dev/__cloudflare/api/campaigns");
  const response = await worker.fetch(request, fakeEnv);
  assert.equal(response.status, 404);
});
test("enabled staging campaign endpoint rejects missing or invalid JWT", async () => {
  const env = { ...fakeEnv, ENABLE_STAGING_CAMPAIGN_API: "true", STAGING_JWT_SECRET: "a-long-isolated-staging-secret-for-tests" };
  const missing = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/api/campaigns"), env);
  assert.equal(missing.status, 401);
  const invalid = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/api/campaigns", { headers: { Authorization: "Bearer not.a.jwt" } }), env);
  assert.equal(invalid.status, 401);
});

test("staging ingestion is disabled unless explicitly opted in", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/staging-ingest", { method: "POST", body: "{}" }), fakeEnv);
  assert.equal(response.status, 404);
});
test("staging ingestion rejects unsigned payload even with operator authorization", async () => {
  const env = { ENABLE_STAGING_INGEST: "true", STAGING_PROBE_TOKEN: "test-token", META_APP_SECRET: "test-meta-secret" };
  const response = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/staging-ingest", {
    method: "POST", headers: { Authorization: "Bearer test-token" }, body: "{}"
  }), env);
  assert.equal(response.status, 403);
});
test("staging ingestion rejects requests without operator token", async () => {
  const env = { ENABLE_STAGING_INGEST: "true", STAGING_PROBE_TOKEN: "test-token", META_APP_SECRET: "test-meta-secret" };
  const response = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/staging-ingest", { method: "POST", body: "{}" }), env);
  assert.equal(response.status, 404);
});

test("staging planner is disabled by default", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/staging-plan", { method: "POST" }), fakeEnv);
  assert.equal(response.status, 404);
});
test("staging planner rejects missing operator authorization before database access", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/staging-plan", { method: "POST" }),
    { ENABLE_STAGING_PLANNER: "true", STAGING_PROBE_TOKEN: "test-token" });
  assert.equal(response.status, 404);
});

test("native staging routes remain opt-in and never intercept production-style traffic by default", async () => {
  const cases = [
    ["POST", "/api/auth/login", '{"email":"x","password":"x"}'],
    ["GET", "/api/auth/me"],
    ["GET", "/api/rules"],
    ["POST", "/api/rules", '{"ruleName":"x"}'],
    ["PATCH", "/api/rules/507f1f77bcf86cd799439011", '{"ruleName":"x"}'],
    ["PATCH", "/api/rules/507f1f77bcf86cd799439011/toggle"],
    ["DELETE", "/api/rules/507f1f77bcf86cd799439011"]
  ];
  for (const [method, path, body] of cases) {
    const response = await worker.fetch(new Request("https://example.workers.dev" + path, { method, ...(body ? { body } : {}) }), fakeEnv);
    assert.equal(response.status, 501, method + " " + path);
  }
});
test("native staging rule mutation routes reject unauthenticated requests without touching MongoDB", async () => {
  const env = {
    ...fakeEnv,
    STAGING_JWT_SECRET: "a-long-isolated-staging-secret-for-tests",
    ENABLE_NATIVE_STAGING_RULE_CREATE: "true",
    ENABLE_NATIVE_STAGING_RULE_UPDATE: "true",
    ENABLE_NATIVE_STAGING_RULE_DELETE: "true",
    ENABLE_NATIVE_STAGING_RULE_TOGGLE: "true"
  };
  const paths = [
    ["POST", "/api/rules", "{}"],
    ["PATCH", "/api/rules/507f1f77bcf86cd799439011", "{}"],
    ["PATCH", "/api/rules/507f1f77bcf86cd799439011/toggle"],
    ["DELETE", "/api/rules/507f1f77bcf86cd799439011"]
  ];
  for (const [method, path, body] of paths) {
    const response = await worker.fetch(new Request("https://example.workers.dev" + path, { method, ...(body ? { body } : {}) }), env);
    assert.equal(response.status, 401, method + " " + path);
  }
});

test("native JSON responses allow only configured frontend origins", async () => {
  const allowed = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/health", {
    headers: { Origin: "https://triggerdm-staging-frontend.onrender.com" }
  }), fakeEnv);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://triggerdm-staging-frontend.onrender.com");
  assert.equal(allowed.headers.get("cache-control"), "no-store");
  const blocked = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/health", {
    headers: { Origin: "https://untrusted.example" }
  }), fakeEnv);
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);
});
