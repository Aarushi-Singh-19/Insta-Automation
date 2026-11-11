// Opt-in edge proxy for testing every existing TriggerDM API route on Cloudflare.
// IMPORTANT: This is a hybrid architecture; the upstream Node/Express server,
// MongoDB and BullMQ worker remain necessary. It does NOT replace Render.
const ALLOWED_ORIGINS = new Set([
  "https://triggerdm.in", "https://www.triggerdm.in",
  "https://triggerdm-staging-frontend.onrender.com", "http://localhost:5173",
]);
const ALLOWED_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Authorization, Content-Type, X-Requested-With";
export function cors(origin) {
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS, "Vary": "Origin" };
}
export async function proxyRequest(request, env, fetchImpl = fetch) {
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith("/api/") && incoming.pathname !== "/") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const origin = request.headers.get("Origin");
  const headers = cors(origin);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: Object.keys(headers).length ? 204 : 403, headers });
  }
  if (!env?.UPSTREAM_ORIGIN) return Response.json({ error: "UPSTREAM_NOT_CONFIGURED" }, { status: 503, headers });
  let upstream;
  try { upstream = new URL(env.UPSTREAM_ORIGIN); } catch { return Response.json({ error: "INVALID_UPSTREAM" }, { status: 503, headers }); }
  if (upstream.protocol !== "https:" || upstream.username || upstream.password || upstream.search || upstream.hash || upstream.pathname !== "/") {
    return Response.json({ error: "INVALID_UPSTREAM" }, { status: 503, headers });
  }
  if (upstream.host === incoming.host) return Response.json({ error: "PROXY_LOOP" }, { status: 503, headers });
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;
  const forwarded = new Headers(request.headers);
  for (const h of ["host", "connection", "cf-connecting-ip", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for", "forwarded"]) forwarded.delete(h);
  // Never let upstream redirects or cache behavior silently rewrite API responses.
  const response = await fetchImpl(new Request(upstream, { method: request.method, headers: forwarded,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual", duplex: "half" }));
  const outgoing = new Headers(response.headers);
  for (const h of ["access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-headers", "access-control-allow-methods"]) outgoing.delete(h);
  for (const [k,v] of Object.entries(headers)) outgoing.set(k,v);
  outgoing.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers: outgoing });
}
