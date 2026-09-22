import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { remindExpiring } from '../_shared/recruiter-evidence-service.ts';
import { must, workflowFailure } from '../_shared/recruiter-onboarding-service.ts';

// Täglich per Cron (Migration 20260922120000): erinnert Headhunter 30 Tage vor Ablauf
// eines Nachweises. Nur mit dem Service-Schlüssel aufrufbar, wie die anderen Cron-Läufe.
serve(async req => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    must(key && req.headers.get('Authorization') === `Bearer ${key}`, 'Keine Berechtigung.', 'not_allowed');
    return json(await remindExpiring(serviceClient()));
  } catch (e) { return workflowFailure(e); }
});
