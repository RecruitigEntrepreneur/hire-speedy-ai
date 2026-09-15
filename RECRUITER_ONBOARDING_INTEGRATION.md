# Recruiter onboarding — release handoff, 2026-09-15

## Latest follow-up: approved preview design (frontend only)

Publish the current `main` frontend. This follow-up ports the approved local
preview's layout to the real shared onboarding and the existing
Admin → Recruiters → Einladungen & Verträge component. Colors now use the central
Matchunt light/dark palette from `src/index.css`, rather than the preview palette.
The shared MatchuntWordmark/MatchuntLogo SVGs replace the prototype brand mark.
The onboarding header uses the same persisted theme switch as DashboardLayout;
inputs, cards, documents, messages and admin invitation controls follow that mode.

- `/recruiter/onboarding` and `/recruiter/invitation` retain the same real account,
  invitation/resume and DocuSign actions. Profile entry now has three validated
  sections and a final review; all contract fields and optional consents remain.
- Admin invitation management opens directly and displays actual case cards,
  search and counts over the loaded (up to 100) records. Known country, specialty
  and region can be prefilled through the existing API. Copying links and viewing
  the invitation email content are explicit controls; sending remains explicit.
- DocuSign status, Matchunt review/countersignature and separate activation remain
  backend controlled. No contract templates, database schema, Edge Functions,
  secrets or auth configuration are changed by this visual follow-up.

Deployment: frontend publish only. Do not rerun the historical migration/deploy
instructions below for this UI update. Do not deploy local `__preview` or `src/dev`
QA fixtures. DocuSign Demo/HMAC and the auth redirect allowlist remain separate
configuration follow-ups from the earlier deployment reports.

Validation: local browser checks using production components with an isolated
mock API passed profile progression, missing-field blocking/revealing, whitespace
entry, review/submit, admin link creation and email interaction, search, signup/
login and invitation entry, plus mobile overflow checks in both themes and theme persistence/input retention.
The contract UI was also checked with fully mocked API responses through document
listing, signature handoff, recruiter-signed, manual-review and completed states.
No real test account,
email recipient or signature was changed. This is not a live DocuSign E2E test.

The following sections describe historical backend releases, already reported as
deployed; they are retained for reference.


## Follow-up: unified website and invitation entry

This follow-up replaces the old `/recruiter/onboarding` UI with the same page used
by `/recruiter/invitation#<token>`. Both offer account creation and existing-account
login. Recruiter signup email confirmation returns to `/recruiter/onboarding`.
Confirmed accounts resume claimed cases without depending on the invitation token
or browser session. An explicit start uses a valid matching-email invitation first;
otherwise it creates one website case (individual or agency) per account. Website
cases do not invent an inviting admin or an admin approval. Existing test records
are neither reset nor completed.

DEPLOY THIS FOLLOW-UP IN ORDER:
1. Apply only `20260915190000_recruiter_website_entry.sql` on the existing schema.
   Do not rerun either copy of the original table-creation migration.
2. Redeploy `recruiter-onboarding` and `recruiter-onboarding-admin` with shared files.
   `recruiter-docusign-webhook` and DocuSign credentials require no change here.
3. Add `https://matchunt.ai/recruiter/onboarding` to auth redirect allowlist,
   preserving `/recruiter/invitation` and existing redirects.
4. Publish frontend AFTER the functions and migration are ready.

`access` is a read-only Edge action for the app navigation guard. Existing verified
recruiters retain access. For accounts with a new onboarding case, dashboard access
requires case approval, a completed DocuSign envelope AND the separate existing
admin activation (`user_roles.verified=true`). Suspended accounts remain blocked.
This controls app navigation; existing backend data authorization remains in place.
The new page never writes legacy verification/signature flags.

Validation: 13 mocked Deno workflow tests, Deno checks, app TypeScript, targeted
ESLint, production build and disposable PostgreSQL migration/guard fixture passed.
Local browser verified signup/login UI at the shared direct-entry route. No real
account was created and no signature was performed. Full live signup/email/signing
checks require this follow-up deployment; DocuSign remains Demo with HMAC pending.

The historical initial deployment notes below describe the preceding release.


## Scope and current status

Prepared on main commit `8a5edcc4cae9385ebf7b9f564b834b873d1bbf08` for the existing
`RecruitigEntrepreneur/hire-speedy-ai` Lovable project
`7a26b296-848c-4f57-af34-75297cbf024b`, Supabase `dngycrrhbnwdohbftpzq`.
This document describes deployable code, **not a completed production deployment**.
Local preview data/links under localhost are not production invitations.

## Required product behavior

Admin → Recruiters → Einladungen & Verträge creates a personal invitation with
known contact/company data and an immutable assigned contract template hash.
An explicit admin button sends the invitation through the existing Resend helper.
A confirmed account matching the invited email claims the invitation. Existing
accounts can sign in; new recruiters can register and verify their email.

After the recruiter confirms complete contract data, their explicit signature-start
button generates seven personal PDFs: framework and six annexes, version 2.1.
One immutable DocuSign envelope is created and its ID persisted before sending.
Recruiter signs first. A different named signer receives their own DocuSign email.
The contact cannot sign as another person. Matchunt is recipient 2, embedded only.
Only the fixed verified Matchunt admin can open the counter-signature, after
recruiter signature AND all admin review checks. Completion requires both
provider-confirmed signatures in order and within the configured deadline, plus
stored signed PDF and certificate. No browser return parameter is signing proof.

**No automatic change to legacy onboarding_completed / verified / activation.**
Activation remains a separate Matchunt action. Preserve the unfinished real test
account `marko.benko@freenet.de`; do not sign for it, complete or reset it.
The public existing `/recruiter/onboarding` flow is not replaced. This new flow is
for admin invitations at `/recruiter/invitation#<token>`.

## Existing customer DocuSign configuration is reused

The shared customer `_shared/docusign.ts` is unchanged. Use its configured
DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
DOCUSIGN_PRIVATE_KEY, DOCUSIGN_OAUTH_BASE and DOCUSIGN_API_BASE.
Never replace working customer credentials or move them into frontend code.
Check the deployed environment: a locally missing .env value is not evidence
that a deployed secret is missing. Check whether the account is demo or production
and report that accurately; do not describe demo signatures as production signing.

The existing DOCUSIGN_COUNTERSIGNER_EMAIL and DOCUSIGN_COUNTERSIGNER_NAME
are resolved to a confirmed active admin account in Supabase. If the customer
signer has no matching admin account, report the actual mismatch; do not silently
choose the current admin. Optional intentional overrides:
RECRUITER_COUNTERSIGNER_USER_ID and RECRUITER_COUNTERSIGNER_NAME.
RECRUITER_DOCUSIGN_ENABLED=false disables this workflow; absent/true reuses
existing configuration. No additional enable secret is required by default.

If DOCUSIGN_HMAC_KEY exists, each recruiter envelope registers its own JSON SIM
Connect listener at SUPABASE_URL/functions/v1/recruiter-docusign-webhook with
HMAC and recipient/envelope events. This preserves the customer's Connect setup.
The account's real HMAC key must match the deployed secret. Without HMAC,
authenticated manual API synchronization is available, rate limited to 15 minutes;
report that immediate automatic status updates are not enabled. Prefer configuring
Connect for a smooth production experience. Validate actual webhook delivery.

Recruiter return refreshes stored app status for up to two minutes, never trusts
`event=signing_complete`. Admin return reopens the relevant case.

## Deployment sequence

1. Integrate this branch's single onboarding commit into current main, preserving
   unrelated newer edits. Do not overwrite main with an old full checkout.
2. Apply only `supabase/migrations/20260915170000_recruiter_onboarding_contracts.sql`
   through the project's normal migration mechanism; check migration history and
   existing schema first. Do not replay older migrations. It adds three private
   tables, an audit log/guards and private bucket `recruiter-contracts`.
3. Deploy `recruiter-onboarding`, `recruiter-onboarding-admin`, and
   `recruiter-docusign-webhook` with their shared modules and deno.json mappings.
   verify_jwt=false is intentional: confirmed user/admin auth is checked in the
   handlers, supporting the project's current JWT signing method. The webhook
   authenticates HMAC and confirms status through the provider API.
4. Check APP_URL/SITE_URL resolves to https://matchunt.ai and auth redirect allowlist
   includes https://matchunt.ai/recruiter/invitation. Keep existing redirects.
5. Inspect actual deployed DocuSign configuration and signer matching. Verify JWT
   grant/account access without sending a live contract to an uninvolved person.
6. Publish frontend on matchunt.ai using Lovable's normal publish flow.
7. Test an isolated synthetic/dedicated QA account, never the preserved real account.

## QA and acceptance

- Logged-out public invitation route loads; invalid/expired/revoked links fail clearly.
- Unauthenticated API calls and non-admin admin calls fail; wrong confirmed email
  cannot claim or read an invitation. Tables/bucket are not publicly readable.
- Admin creates a real production invitation; email goes only to an authorized QA
  inbox. Local preview invitation IDs are not production records.
- All supplied profile fields map into seven complete PDFs without placeholders,
  legal-review comments, invented consent or bank details. Unicode names preserved.
- Self-signing opens actual DocuSign. Other signer cannot be impersonated.
- Double clicks/retries do not create duplicate envelopes; lost POST recovery uses
  transaction ID. Changed document hashes block send.
- Recruiter-only signature leaves Matchunt review/countersignature pending.
- Counter-signature unavailable before review and to a different admin.
- Provider-confirmed completion stores signed document and certificate privately.
- Customer DocuSign flow still works; no customer listener/credential regression.
- Do not manufacture a successful end-to-end result. Report exact untested steps.

Local validation completed on this change: app TypeScript, three Edge Function
Deno checks, targeted ESLint, 24 contract/deadline Vitest tests, nine Deno runtime
integration tests and production build passed. Provider calls in runtime tests are
mocked; they do not establish that remote credentials or production deployment work.
The unchanged SQL migration was previously exercised in a disposable PostgreSQL 17
fixture. `supabase/tests/recruiter_onboarding_contracts.sql` creates stub schemas and
roles: **run only in a disposable empty database, never on live Supabase**.

Key commands:

```
npm ci
npx tsc -p tsconfig.app.json --noEmit
npx vitest run src/lib/recruiterContractGeneration.test.ts src/lib/recruiterContractPolicy.test.ts src/lib/recruiterDeadline.test.ts
node scripts/bundle-recruiter-contracts.mjs --check
npm run build
```

Deno tests: `supabase/tests/recruiter-envelope-send.test.ts` and
`supabase/tests/recruiter-integration-config.test.ts`, with --allow-env and the
recruiter-onboarding/deno.json import configuration. Font/PDF dependencies are pinned.

## Contract sources and boundaries

Canonical text: `contracts/recruiter/v2.1/`. Generated bundle and SHA-256:
`supabase/functions/_shared/recruiter-contract-templates.ts` via
`scripts/bundle-recruiter-contracts.mjs`. Unicode font bundle generated by
`scripts/bundle-recruiter-fonts.mjs`; OFL license included.

These are the user-authorized working texts revised from the supplied legal review,
not an assertion of external legal certification. Do not invent revised clauses
while deploying. Personal user terms are a separate source document and not one
of the seven signed framework-package PDFs. The current invitation kinds are
individual recruiter and new agency; inviting additional agency seats is separate.
