// Expose runtime readiness without revealing credentials or private endpoints.
// A healthy Worker process is not equivalent to a working TriggerDM backend.
export function runtimeReadiness(env = {}) {
  const upstreamConfigured = typeof env.UPSTREAM_ORIGIN === "string" && env.UPSTREAM_ORIGIN.trim().length > 0;
  return {
    ok: true,
    runtime: "cloudflare",
    mode: upstreamConfigured ? "hybrid-proxy" : "probe-only",
    nativeBackendReady: false,
    dependencies: {
      upstream: upstreamConfigured ? "configured" : "not-configured",
      mongodb: "not-integrated",
      instagramQueueConsumer: "not-integrated",
      billing: "not-integrated",
    },
  };
}
