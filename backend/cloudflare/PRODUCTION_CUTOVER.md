# TriggerDM Cloudflare cutover

The production Worker has a separate configuration in `wrangler.production.jsonc`.
Its default configuration has no public route, no preview URL, and disables
production writes. The existing staging Worker still uses `wrangler.jsonc`.

## Read-only preflight

After approval, make the production Worker reachable through an access-controlled
test route or service binding. Bind an Atlas account with read access to
`automationDB` through `MONGODB_PRODUCTION_URI`. Set
`PRODUCTION_READ_ONLY_PROBE_ENABLED=true`, configure `PRODUCTION_PROBE_TOKEN`,
and leave `PRODUCTION_CUTOVER_APPROVED=false`. Request
`GET /__cloudflare/production-db-readiness` with the probe token as a bearer
token. Verify the MongoDB connection and collection inventory. Investigate
missing collections or permissions before proceeding. Configure all secrets
through Worker bindings.

On an isolated copy of the existing schema, validate subscription, recovery,
duplicate charge, refund and payout transactions. Check pre-existing unique
indexes and resolve duplicate Instagram business IDs or duplicate account
owners before enabling OAuth. Verify both public replies and DMs using two
distinct Instagram accounts, including alias-based webhook delivery, a user
who already follows, and a user who follows after the prompt. Reconcile
pre-cutover usage for open trial and billing periods before releasing DMs.
A new period started after the cutoff receives its normal limit automatically.
The optional fresh-start policy requires a separate decision because it resets
the initial usage baseline for existing periods.

## Production bindings

Set `PRODUCTION_JWT_SECRET` to the current Render JWT signing secret to retain
existing sessions. Bind the live Instagram app using
`PRODUCTION_INSTAGRAM_APP_ID`, `PRODUCTION_INSTAGRAM_APP_SECRET`,
`PRODUCTION_INSTAGRAM_REDIRECT_URI_V2`, `PRODUCTION_META_VERIFY_TOKEN` and
`PRODUCTION_META_APP_SECRET`. Bind live Razorpay credentials and plan through
`PRODUCTION_RAZORPAY_KEY_ID`, `PRODUCTION_RAZORPAY_KEY_SECRET`,
`PRODUCTION_RAZORPAY_MONTHLY_PLAN_ID` and `PRODUCTION_RAZORPAY_WEBHOOK_SECRET`.
Use `PRODUCTION_ADMIN_EMAIL` for admin and payout access, and
`PRODUCTION_RESEND_API_KEY` plus `PRODUCTION_EMAIL_FROM` for email delivery.

## Cutover order

1. Obtain separate approval for production deployment and live routing. Confirm
   Atlas backups, the protected verification endpoint, and the rollback route.
2. Confirm the Cloudflare worker can run MongoDB transactions against the
   isolated copy. Provision and test a least-privilege production write account.
3. Drain or record Render Instagram jobs and in-flight billing work. Confirm
   exclusive ownership before enabling Worker side effects. Set the exact
   handover time in `PRODUCTION_AUTOMATIC_SEND_NOT_BEFORE`.
4. Enable `PRODUCTION_CUTOVER_APPROVED`, customer API and auth flags,
   OAuth, Meta ingress, planner, automation, Follow Gate, and Instagram send
   flags in the approved cutover. Set
   `ENABLE_PRODUCTION_EXCLUSIVE_SEND_OWNERSHIP` only after the old sender drains.
   Change the frontend API origin and Meta callbacks in the approved window.
5. Enable `ENABLE_PRODUCTION_FINANCIAL_OWNERSHIP`,
   `ENABLE_PRODUCTION_RAZORPAY`, `ENABLE_PRODUCTION_REFERRALS` and
   `ENABLE_PRODUCTION_BILLING_RECOVERY` after handing over Razorpay processing.
   Verify one payment, a duplicate event, recovery, and referral accounting
   with an authorized test account.
6. Verify login, signup and reset, the admin dashboard, Instagram OAuth, two
   account automations, and Follow Gate on the routed deployment. Monitor inbox
   review items and payment failures. Keep Render available for rollback. Obtain
   explicit approval before stopping it.

For rollback, disable Cloudflare sends and financial ownership first, reconcile
in-flight states against Meta and Razorpay, then restore Render routing and
exclusive ownership. Preserve Worker inbox, outbox and send records for
deduplication review before replaying events.
