// Arbeitsvertrag ohne Meldung (Paket 3, 22.10.2026): Tag 7 Kunde, Tag 10 Headhunter,
// Tag 21 Matchunt; abgelaufene 24-h-Fenster werden verbindlich, verlorene
// DocuSign-Ereignisse nachgeholt. Läuft täglich per Cron (Migration 20261023090000)
// mit eigenem Schlüssel. Logik in _shared/contract-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx, interviewFailure } from '../_shared/interview-service.ts';
import { contractCtx, runFollowups } from '../_shared/contract-service.ts';

const CRON_TOKEN_NAME = 'contract-followups';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = serviceClient();
    const token = req.headers.get('x-cron-token');
    if (!token) return fail('not_allowed', 'Nur für den täglichen Lauf.');
    const { data: valid, error } = await db.rpc('cron_token_valid', { _name: CRON_TOKEN_NAME, _token: token });
    if (error || valid !== true) return fail('not_allowed', 'Schlüssel ungültig.');
    return json(await runFollowups(contractCtx(defaultCtx(db))));
  } catch (e) {
    return interviewFailure(e);
  }
});
