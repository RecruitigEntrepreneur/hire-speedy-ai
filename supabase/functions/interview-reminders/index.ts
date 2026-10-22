// Erinnerung am Vortag an Kandidat, Kundenteam und Headhunter (22.10.2026).
// Läuft einmal täglich per Cron (Migration 20261022150000) mit eigenem Schlüssel;
// prüft ihn über cron_token_valid. Logik in _shared/interview-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx, interviewFailure, sendDayBeforeReminders } from '../_shared/interview-service.ts';

const CRON_TOKEN_NAME = 'interview-reminders';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = serviceClient();
    const token = req.headers.get('x-cron-token');
    if (!token) return fail('not_allowed', 'Nur für den täglichen Lauf.');
    const { data: valid, error } = await db.rpc('cron_token_valid', { _name: CRON_TOKEN_NAME, _token: token });
    if (error || valid !== true) return fail('not_allowed', 'Schlüssel ungültig.');
    return json(await sendDayBeforeReminders(defaultCtx(db)));
  } catch (e) {
    return interviewFailure(e);
  }
});
