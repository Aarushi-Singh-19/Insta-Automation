# Cloudflare-native compatibility audit — 2026-11-11

**Scope:** isolated migration branch only. This is not production-ready.

## Verified against current Cloudflare documentation

- MongoDB Atlas can connect to Workers using native TCP and Node compatibility. Cloudflare recommends a Durable Object to reuse the MongoDB connection; Hyperdrive does **not** support MongoDB. See https://developers.cloudflare.com/workers/databases/third-party-integrations/mongodb/
- Mongoose 9+ supports Workers. Existing backend package.json declares mongoose ^9.6.2, so an incremental reuse path is plausible, **but models and operations must be tested in Workers**.
- A Worker request cannot own a permanent BullMQ Worker loop. Queue-based action execution requires Cloudflare Queues or a Durable Object-based scheduler, persistent idempotency, retry handling, and a consumer deployed independently from webhook ingress.
- Existing Express 5 routing and CommonJS imports cannot be assumed to work just because nodejs_compat is enabled. Route migration needs integration tests, especially raw-body Razorpay verification, Instagram OAuth callback, auth cookies/JWT, and redirects.

## Existing implementation gaps

1. The deployed Worker currently implements health, signature validation, and optional proxying to Render. It does not connect to MongoDB or execute jobs.
2. Cloudflare action-executor and Mongo action-adapter are dependency-injected scaffolds; no Worker runtime supplies live models, database connections, queue binding, or actual Instagram action service.
3. Existing Mongo action adapter must be hardened before activation: ensure a unique index, distinguish ambiguous sends from retryable failures, and test that queued actions cannot be claimed twice. A process crash after Graph API success but before persistence is an inherently ambiguous result requiring reconciliation.
4. Follow Gate, billing, referral payouts, quota enforcement and account authorization need full end-to-end staging verification before production cutover.
5. UPSTREAM_ORIGIN currently targets a manually suspended Render staging service. That is expected to fail for proxied /api requests. **Do not point it to production as a workaround.**

## Safe implementation order

1. Create a staging-only MongoDB connection test with a secret MONGODB_URI; test connection, read and write against isolated staging collections only.
2. Port auth and campaign API with request/response regression tests.
3. Add Cloudflare Queue producer/consumer with durable action state and no acknowledgment before persisted completion; test duplicate delivery, crashes and quota limits.
4. Port Instagram webhook processing and Follow Gate, verify against staging IG professional account.
5. Port Razorpay in test mode, then commission, refund and payout accounting with existing idempotency tests.
6. Verify the complete application, observe metrics and retain Render rollback; only then change live DNS/webhooks.

**Never enable live webhooks on the probe Worker**: successful verification challenge does not imply a working webhook consumer. Avoid installing a Queue consumer until its executor is integrated.
