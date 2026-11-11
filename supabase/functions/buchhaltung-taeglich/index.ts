// Täglicher Lauf der Buchhaltung (Umbau 11.11.2026), Cron 06:30 (Migration
// 20261111100000) mit eigenem Schlüssel:
//   * Antritt feststellen (3 Werktage ohne Widerspruch, 14 Tage ohne Meldung)
//   * Einbehalt freigeben (Garantie plus Meldefrist vorbei, kein offener Fall)
//   * Angebote zur Nachbesetzung ablaufen lassen
//   * Zahlungserinnerung 7 Tage nach Fälligkeit
//   * Headhunter-Aufgaben am ersten Arbeitstag und zur Halbzeit
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx, interviewFailure } from '../_shared/interview-service.ts';
import { placementCtx } from '../_shared/placement-service.ts';
import { runStartChecks } from '../_shared/nachbesetzung.ts';
import { runPaymentReminders } from '../_shared/mahnwesen.ts';
import { runRecruiterTasks } from '../_shared/abrechnung-service.ts';

const CRON_TOKEN_NAME = 'buchhaltung-taeglich';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = serviceClient();
    const token = req.headers.get('x-cron-token');
    if (!token) return fail('not_allowed', 'Nur für den täglichen Lauf.');
    const { data: valid, error } = await db.rpc('cron_token_valid', { _name: CRON_TOKEN_NAME, _token: token });
    if (error || valid !== true) return fail('not_allowed', 'Schlüssel ungültig.');
    const ctx = placementCtx(defaultCtx(db));
    const out: Record<string, unknown> = {};
    // Jeder Teil für sich: ein Fehler stoppt die anderen nicht
    for (const [name, run] of [
      ['start', () => runStartChecks(ctx)],
      ['reminders', () => runPaymentReminders(ctx)],
      ['recruiterTasks', () => runRecruiterTasks(ctx)],
    ] as const) {
      try { out[name] = await run(); } catch (e) { out[name] = { error: e instanceof Error ? e.message : String(e) }; console.error(`[buchhaltung-taeglich] ${name}`, e); }
    }
    return json(out);
  } catch (e) {
    return interviewFailure(e);
  }
});
