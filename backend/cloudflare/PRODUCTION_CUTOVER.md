# Cloudflare production cutover — blocking audit

**State:** NOT READY. The current Cloudflare Worker is a staging/hybrid implementation; this document is a release gate, not approval to change production.

## Verified from migration branch source
- `backend/cloudflare/worker.js` still proxies unmatched routes to `UPSTREAM_ORIGIN` (Render).
- Native login, signup, rules, parts of automations, billing, referrals and Instagram inbox are staging-specific.
- `backend/cloudflare/staging-mongodb.js` requires staging database isolation.
- Meta callback `/api/webhook/instagram` currently maps only the configured staging Instagram account and is gated by `ENABLE_NATIVE_STAGING_META_WEBHOOK`.
- Scheduled processing calls `drainStagingInbox` and `recoverStagingBilling`, both staging-specific.
- Current Meta app is shared with production: updating the app callback affects production delivery.

## Must complete before switching
1. Inventory every Express route and replace all `UPSTREAM_ORIGIN` fallbacks with native, authenticated Cloudflare handlers. Verify frontend calls (including OAuth callbacks, account connection, campaign editing, dashboard, billing, referrals, settings and admin).
2. Implement production MongoDB isolation and schema compatibility, using production-specific environment configuration and no staging-only hard-coded collection/database assumptions.
3. Build production multi-account Meta webhook processing with signature verification, durable inbox, account ownership resolution, idempotency, and safe failure/retry behavior.
4. Enforce exclusive Instagram send ownership across Render and Cloudflare, including Follow Gate postbacks, queue/cron, deduplication and quotas.
5. Validate Razorpay LIVE webhook signature + API payment verification, automatic subscription activation, duplicate delivery, refunds, commissions, payout safety and scheduled recovery against isolated fixtures. Do not use real payment experiments to prove this.
6. Verify OAuth redirects, Meta subscriptions, CORS, secrets, frontend API base URL, production account reconnect and rollback plan.
7. Run complete staging regression, then pre-cutover read-only production smoke checks; rehearse rollback.
8. During a controlled cutover, update shared Meta callback, verify signed events and one real authorized test account end-to-end, monitor failures, and only then retire Render after a defined observation window.

## Immediate operational rules
- Never set `TRIGGERDM_RUNTIME=production` on this hybrid Worker expecting production to work: it deliberately returns HTTP 503.
- Do not switch Meta callback or suspend Render until all gates above pass.
- Do not point a staging Worker at the production database.
- Do not enable simultaneous send ownership for the same Instagram account.
