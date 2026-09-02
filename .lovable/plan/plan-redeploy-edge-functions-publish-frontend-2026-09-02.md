# Plan: Redeploy Edge Functions + Publish Frontend

## Steps
1. Deploy `verify-company` from `supabase/functions/verify-company/index.ts` (bundles shared modules `http.ts`, `intake-core.ts`, `admin-auth.ts`, `domain.ts`).
2. Deploy `docusign-send` from `supabase/functions/docusign-send/index.ts` (bundles `_shared/docusign.ts`).
3. Publish the frontend to `matchunt.ai`.

## Notes
- No code changes — only deploy and publish.
- The four known critical security findings (Security Definer View, Employer-Feedback-Insert-Bypass, Outreach-Leads-Full-Access, Storage-Job-Documents-No-Ownership) remain unresolved and non-blocking in this workspace.
