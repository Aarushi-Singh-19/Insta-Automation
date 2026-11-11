import test from "node:test";
import assert from "node:assert/strict";
import { proxyRequest } from "./upstream-proxy.js";
const env = { UPSTREAM_ORIGIN: "https://backend.example.com" };
test("proxies API request path, query and authorization without changing body", async () => {
  let target, method, auth, raw;
  const result = await proxyRequest(new Request("https://edge.example.com/api/billing/razorpay-webhook?x=1", {
    method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
    body: '{"signed":"unchanged"}'
  }), env, async request => {
    target = request.url; method = request.method;
    auth = request.headers.get("authorization"); raw = await request.text();
    return new Response("processed", { status: 200 });
  });
  assert.equal(target, "https://backend.example.com/api/billing/razorpay-webhook?x=1");
  assert.equal(method, "POST"); assert.equal(auth, "Bearer test");
  assert.equal(raw, '{"signed":"unchanged"}'); assert.equal(result.status, 200);
});
test("rejects insecure upstream and proxy loops", async () => {
  const request = new Request("https://edge.example.com/api/auth/login");
  assert.equal((await proxyRequest(request, { UPSTREAM_ORIGIN: "http://backend.example.com" })).status, 503);
  assert.equal((await proxyRequest(request, { UPSTREAM_ORIGIN: "https://edge.example.com" })).status, 503);
});
test("handles CORS preflight for approved frontend", async () => {
  const req = new Request("https://edge.example.com/api/auth/login", { method: "OPTIONS", headers: { Origin: "https://triggerdm.in" } });
  const response = await proxyRequest(req, env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://triggerdm.in");
});
test("does not allow arbitrary CORS origins", async () => {
  const req = new Request("https://edge.example.com/api/auth/login", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  assert.equal((await proxyRequest(req, env)).status, 403);
});
test("returns 503 without upstream and 404 for unknown paths", async () => {
  assert.equal((await proxyRequest(new Request("https://edge.example.com/api/auth/login"), {})).status, 503);
  assert.equal((await proxyRequest(new Request("https://edge.example.com/unknown"), env)).status, 404);
});
