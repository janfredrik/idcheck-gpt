# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **End user (in the flow):** an employee in the demo tenant who is locked out of their Microsoft Entra account (lost phone, no working MFA method). They are on a phone or laptop, likely stressed, and want to get back in without calling IT. Their job: prove who they are, get a one-time Temporary Access Pass (TAP), and use it to set up a new passkey in Microsoft Authenticator.
- **Primary audience for the demo:** internal stakeholders who decide whether idcheck gets further investment, and technical reviewers (security architects) who scrutinize the mechanism and its controls. The demo has to convince both: stakeholders by how quickly and smoothly the user gets back in, reviewers by how strictly and transparently the system fails closed.
- **Operators:** the app owner, who uses `/admin` to create admin-consent links, and the demo tenant's IT contact, who receives alert emails for every attempt.

## Product Purpose

Self-service account recovery for Microsoft Entra ID. The user enters their mobile number, approves a (currently **simulated**) Vipps prompt, gets matched to exactly one eligible Entra account, and receives a **real, sign-in-capable, single-use TAP** via Microsoft Graph. A step-by-step guide then walks them through adding a passkey in Microsoft Authenticator.

Success means the user goes from locked out to a working new sign-in method in a few minutes, **without involving IT**. That speed and independence is the core promise; the security controls exist to make that promise safe, not to be the headline.

## Positioning

A real TAP issued against a real tenant, gated by verified identity (Vipps, later BankID) plus strict, fail-closed eligibility: an exact mobile match to exactly one account, group membership, the TAP policy, no directory roles, and no existing live TAP. It replaces the helpdesk call for recovery instead of adding another portal around it.

## Operating Context

- Accessed behind Basic Auth (production) or a private network; never open on the public internet.
- The end-user flow is a single page with phases: landing → mobile number → waiting for Vipps (simulated approve/reject) → account found → TAP shown once with countdown → Authenticator passkey guide (QR codes for App Store / Google Play).
- IT is notified by email for every attempt; the user receives a security email (and optionally an SMS) when a TAP is created. No notification contains the TAP.
- Deployed via Docker Compose on Unraid; the image is published to GHCR.

## Capabilities and Constraints

- Single, fixed demo tenant. Access is granted by (transitive) membership in `DEMO_ALLOWED_GROUP_ID`.
- The Vipps approval is simulated and is **not** identity verification; the UI must make this visible ("Simulert Vipps · ekte TAP i demotenant") and state, before issuing, that the action creates a real sign-in code.
- BankID is shown as disabled ("Kommer senere"). Real Vipps, BankID/Signicat, production tenants and an admin panel are out of scope for now.
- Every rejection shows the same generic message ("Vi kunne ikke bekrefte identiteten din automatisk, kontakt IT-avdelingen.") plus a reference. Never reveal why an account was rejected.
- The TAP is shown only in the original response, never again after a reload or back navigation, and is cleared from the browser when it expires. The account is shown masked.
- The TAP lifetime is 60 minutes and single-use by default, limited by the tenant's TAP policy.
- No third-party analytics, embeds or external media on identity/TAP pages; a strict CSP applies.
- Terminology: "TAP" / "engangskode" / "midlertidig tilgangskode", "passkey", "Microsoft Authenticator", "Jobb- eller skolekonto".

## Brand Commitments

- Its own product identity: **idcheck**. Not tied to an employer brand, and not white-label for now.
- All user-facing copy is in **Norwegian (bokmål)**.
- Third-party marks (Vipps, BankID, Microsoft Authenticator, App Store, Google Play) are used only to refer to those services, never as idcheck's identity.

## Evidence on Hand

- Assets in `public/`: `recovery-verification-illustration.png`, `recovery-security-illustration.png`, `microsoft-authenticator-icon.png`, `dark-knight.png`.
- No customers, pilot results, testimonials or metrics exist yet. The demo has not yet been verified end to end against a real tenant (see the status in `PLAN.md`). Do not fabricate any of these.

## Product Principles

1. **Back in, without IT.** Every step should shorten the path from locked out to a new passkey; the guide continues all the way into Authenticator.
2. **Fail closed, say little.** Uncertainty means rejection, and rejections are identical for the user. Specific reasons go only to the audit log.
3. **Honest about simulation.** What is simulated and what is real (the TAP) must always be visible; demo mode never pretends to be production.
4. **A secret is shown once.** The TAP is treated as a live credential: shown once, never repeated, never stored.
5. **Built to be reviewed.** The behavior should hold up to scrutiny from a security architect: predictable states, clear references, no hidden shortcuts.

## Accessibility & Inclusion

- Mobile first: many users arrive on their phone, often the same phone they'll use for Authenticator.
- Keyboard navigation and respect for `prefers-reduced-motion` (the animated background must never hide the form) are explicit requirements in `PLAN.md`.
- Under stress the user needs short, plain Norwegian with one action per step.
