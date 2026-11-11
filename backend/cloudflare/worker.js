// Isolated Cloudflare runtime probe. No production routes or side effects.
// This is intentionally NOT the TriggerDM API or an automation worker.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/__cloudflare/health") {
      return Response.json({ ok: true, runtime: "cloudflare", mode: "probe-only" });
    }
    return Response.json({ error: "Not implemented: migration in progress" }, { status: 501 });
  },
};
