# TriggerDM

**Instagram comment-to-DM automation for creators and businesses.**

TriggerDM helps Instagram account owners configure keyword-based automations for comments on selected posts and Reels, including public comment replies and private replies/DMs where supported by Instagram's APIs and permissions.

> TriggerDM is a deployed project. This README documents the product and the known stack; verify the live deployment and current provider settings before making production changes.

## What it does

- Connects an Instagram professional account through the configured Instagram Login flow.
- Lets users configure comment automation rules and keywords.
- Associates automations with selected Instagram posts/Reels.
- Processes matching comments and triggers configured reply actions.
- Provides a post selector that displays recent media and supports finding content by link.
- Includes account authentication and a subscription/trial billing flow.
- Sends transactional email for supported account workflows.

Actual behavior depends on the connected account, Meta permissions, messaging policies, and the current configuration.

## Architecture

```text
Instagram comment
      |
      v
Instagram event ingestion
(webhook or configured polling path)
      |
      v
Validation and deduplication
      |
      v
Campaign / post resolution
      |
      v
Keyword and rule matching
      |
      v
Action creation and BullMQ queue
      |
      v
Worker / action service
      |
      v
Instagram API
(public reply and/or private reply)
```

The exact production ingestion path and operational guarantees should be confirmed against the current deployment before changing the pipeline.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Axios |
| Backend | Node.js, Express |
| Database | MongoDB Atlas, Mongoose |
| Background jobs | BullMQ, Redis |
| Instagram integration | Instagram Login / Instagram Graph API, webhooks where configured |
| Authentication | JWT |
| Billing | Razorpay |
| Transactional email | Resend |
| Deployment | Render for the backend; confirm current frontend hosting in deployment settings |

## Repository layout

- `frontend/` — React/Vite application.
- `backend/` — Express API, Instagram integration, data models, and background processing.

For current route names, schemas, and service boundaries, use the implementation in the repository as the source of truth.

## Run locally

Use a supported Node.js version compatible with the versions in the package files.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Production build and lint:

```bash
npm run build
npm run lint
```

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend also provides `npm start` for running `node server.js`.

### Environment configuration

Configure required values through local environment files or your hosting provider's secret/environment settings. Determine the exact variable names from the existing code and deployment configuration. Depending on the features being tested, configuration may include:

- MongoDB connection string
- JWT/authentication secret
- Instagram app credentials and redirect/callback settings
- Instagram webhook verification/configuration
- Redis connection settings
- Razorpay keys and webhook configuration
- Resend API key and verified sender settings
- Frontend API base URL and allowed origins

**Never commit real credentials, access tokens, payment secrets, or production environment files.** Use test credentials and test accounts for local development; do not run test payment or messaging flows against real users.

## Production and security notes

- Keep Instagram account ownership checks and trial eligibility safeguards intact.
- Verify webhook signatures/tokens and payment events according to the provider's documented requirements.
- Treat external events as potentially duplicated; preserve safe deduplication and retry behavior.
- Do not log access tokens, authorization headers, payment secrets, or unnecessary personal data.
- Respect Instagram API permissions, rate limits, and messaging rules.
- Test changes in a safe environment before deploying to the live application.
- Do not change OAuth providers, billing behavior, DNS, or deployment configuration without a specific reason and a rollback plan.

This section is a checklist, not a claim that every item has been independently audited.

## Subscription

The intended plan documented during development is **₹199/month with a 7-day free trial**. Confirm the live Razorpay plan, subscription lifecycle, and current pricing in the production configuration before relying on this README for a billing change.

## Useful development commands

From `frontend/`:

- `npm run dev` — local Vite development server
- `npm run build` — production build
- `npm run lint` — ESLint checks
- `npm run preview` — preview a built frontend

From `backend/`:

- `npm run dev` — backend with nodemon
- `npm start` — start the backend

## Further documentation

- [GitHub repository](https://github.com/Aarushi-Singh-19/Insta-Automation)
- [TriggerDM favicon source](frontend/public/favicon.svg)
- See `frontend/src/pages/Automations.jsx` for the post/Reel selector UI.
- See `backend/routes/instagram.routes.js` and `backend/controllers/instagram.controller.js` for the Instagram media route and related controller logic.

## Project owner

Built and maintained by **Aarushi Singh**.

When extending TriggerDM, prefer small, tested changes that preserve the working production flows. Verify current code and provider configuration before assuming any integration detail is unchanged.
