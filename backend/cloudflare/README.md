# TriggerDM Cloudflare migration — actual deployment state

This branch contains a **working-design hybrid edge proxy** and experimental standalone adapters. **It is not a replacement for the Node backend.** Production must remain on Render until all services are migrated and validated.

## Safe hybrid staging test

1. In Cloudflare Workers, deploy the Worker defined in `backend/cloudflare/wrangler.jsonc` from the `backend/cloudflare` working directory.
2. Set a **plain-text environment variable** `UPSTREAM_ORIGIN` to the HTTPS origin of the existing **staging** Node backend, with no path or trailing slash (example: `https://your-staging-backend.example.com`). Do not point at the Worker itself. Do not use the production backend for first tests.
3. Request `/__cloudflare/health` on the Worker URL. Then test `/api/health` and authenticated API endpoints. The Worker forwards all `/api/*` requests, including the original raw webhook request bodies, to staging Express.
4. Run tests from `backend/cloudflare`: `node --test *.test.mjs`. CI runs the same tests automatically on the migration branch.
5. **Do not** point Meta, Razorpay, DNS or production frontend to the Worker. The Worker has not been verified with real webhook processing, payment events or end-to-end actions.

Without `UPSTREAM_ORIGIN`, the Worker remains a fail-closed probe. Its webhook POST handlers return 501 even when signatures are valid, and the queue handler retries rather than acknowledging unprocessed events.

## Architecture and costs

Hybrid mode routes traffic through Cloudflare but **still requires a running Node/Express server and its MongoDB/Redis/BullMQ worker**. It does not eliminate Render compute or bandwidth, and may increase hops. This mode is for safe edge compatibility tests only, not the promised cost-saving migration.

A true Cloudflare-native deployment still needs the full API rewritten or a verified compatible Express adapter, supported MongoDB connectivity, a reliable queue consumer with durable action accounting, the original DM quota rules, Instagram webhook processing, Follow Gate, and the full Razorpay/referral webhook logic. Do not enable a queue binding without a real executor: messages will retry until exhausted.

## Safety constraints

- Never copy live database credentials into GitHub, commit secrets, or logs.
- Use isolated staging MongoDB and Razorpay test credentials for tests.
- Preserve signature verification and raw bodies for Meta/Razorpay webhooks.
- Keep the production Render deployment and rollback available.
- Do not infer full application readiness from passing unit tests alone.

Deployment trigger note (2026-11-11): Push to the isolated migration branch to request a fresh Cloudflare Git build; verify the build's branch and entrypoint before testing. A Git push does not guarantee Cloudflare will build or activate it.
