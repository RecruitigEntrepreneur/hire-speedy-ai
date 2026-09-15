# Recruiter onboarding — release handoff, 2026-09-15

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
