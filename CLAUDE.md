# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

idcheck is self-service account recovery for Microsoft Entra ID. The user enters a mobile number, approves a **simulated** Vipps prompt, gets matched to exactly one Entra account in a single fixed demo tenant, and receives a **real, sign-in-capable one-time Temporary Access Pass (TAP)** via Microsoft Graph. UI text, README and `PLAN.md` are in Norwegian; keep user-facing copy Norwegian.

`PLAN.md` holds design decisions, security rules and an "Forbedringspotensial" backlog. `README.md` covers Entra app registration, admin consent, tenant setup and Unraid deployment.

## Commands

```sh
npm run dev          # Next.js dev server (Basic Auth proxy is skipped outside production)
npm run build        # production build (output: standalone)
npx tsc --noEmit     # typecheck
npm run db:migrate   # apply db/schema.sql (idempotent CREATE ... IF NOT EXISTS); needs DATABASE_URL
npm run worker       # notification worker (needs DATABASE_URL, SMTP_*, ALERT_EMAIL)
docker compose up -d --build   # db + migrate + web + notifications
```

There is no lint script and no test suite yet. CI (`.github/workflows/publish-image.yml`) only builds the Docker image (pushes to GHCR on `main`/tags).

## Architecture

- **Next.js App Router, server routes under `src/app/api/`**; the whole client UI is one component, `src/components/demo.tsx`, driven by a `phase` state machine.
- **Flow across routes:** `/api/start` (rate-limit, create attempt, return one-time simulation token) → `/api/verify` (consume simulation token, Graph lookup by exact `mobilePhone`, eligibility check, create DB flow session + CSRF token, set session cookie) → `/api/tap` (claim session `verified→issuing`, re-check eligibility and that mobile hash is unchanged, create TAP) → `/api/session` DELETE cancels. `/api/config` tells the UI whether the demo is configured.
- **Config gate:** `getDemoConfig()` in `src/lib/config.ts` validates all required env vars and returns `null` if anything is missing/invalid — every route fails closed on `null`. Access is granted by membership (transitive) in `DEMO_ALLOWED_GROUP_ID`; there is no per-user allowlist.
- **Graph (`src/lib/graph.ts`):** MSAL client-credentials against the fixed tenant. `isEligibleForDemo` requires enabled Member account, group membership, inclusion in the tenant's TAP policy with a lifetime allowing `LIFETIME_MINUTES`, and no active directory role assignment (direct or via group). PIM eligibility is intentionally not checked. `createOneTimeTap` refuses if a live TAP already exists.
- **State in PostgreSQL (`db/schema.sql`):** `attempts` (audit + rate limiting), `flow_sessions`, `notification_outbox`, `admin_consent_states`. Tokens/state are stored only as SHA-256 hashes; phone numbers and IPs only as HMAC (`RATE_LIMIT_HMAC_KEY`). TAP values are never persisted.
- **Concurrency:** TAP issuance runs inside a DB transaction holding `pg_advisory_xact_lock` per tenant+user; rate limiting locks per phone/IP hash. A failed/timed-out Graph POST is recorded as `unknown` and must never be retried automatically.
- **Notifications:** routes only insert into `notification_outbox` (via `src/lib/audit.ts`). `scripts/notification-worker.mjs` is a separate long-running process (same image) that sends SMTP alerts, optional Pling SMS (single attempt, no retry — no idempotency key), expires stale attempts/sessions, redacts recipients and prunes data after 90 days.
- **Admin consent:** `/admin` + `/api/admin/consent-link` create a 15-minute single-use state; `/api/admin/consent-callback` consumes it and verifies Graph token roles via `checkRequiredDemoPermissions`.
- **Access control:** `proxy.ts` (Next 16 proxy/middleware) enforces Basic Auth (`APP_ACCESS_USER`/`APP_ACCESS_PASSWORD`, ≥20 chars) in production for everything except the consent callback. Security headers/CSP are in `next.config.ts`.

## Conventions and invariants

- All failures shown to users use the same generic message (`genericFailure`); specific reason codes go only to `attempts.reason_code`. Don't leak why an account was rejected.
- Mutating routes check `requireSameOrigin`, read bodies with `readJsonLimited`, and wrap responses in `noStore`. Keep that pattern.
- Never log or store TAP values, Graph tokens, cookies or full phone numbers; the worker deliberately writes only generic stderr lines.
- Env vars added for runtime must also be added to `.env.example` and the relevant service in `compose.yaml` (web and worker have separate environment lists).
- Required Graph application permissions: `User.Read.All`, `UserAuthMethod-TAP.ReadWrite.All`, `Policy.Read.AuthenticationMethod`, `RoleManagement.Read.Directory`. Adding one means updating `checkRequiredDemoPermissions` and README.
