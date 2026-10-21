import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { isServiceRole, requireAdmin } from '../_shared/admin-auth.ts';
import { sendAwards, sendWeekly } from '../_shared/liga-mail.ts';

const CRON_TOKEN_NAME = 'liga-weekly';
// Testmails nur an diese Adresse (Absprache mit Marko).
const TEST_TO = 'marko.benko@bluewater-bridge.de';

/**
 * Matchunt Liga, Mails. Montags per Cron (Migration 20261021090000, Schlüssel
 * „liga-weekly“): Wochenstand an alle Teilnehmer, die ihn nicht abbestellt haben.
 * Admin: { mode: 'weekly' | 'awards', season_id?, dry_run?, test? } für Vorschau,
 * Testmail an Marko und die Glückwunsch-Mails nach dem Saisonabschluss.
 */
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({})) as { mode?: string; season_id?: string; dry_run?: boolean; test?: boolean };
    const token = req.headers.get('x-cron-token');
    if (token && token.length >= 32) {
      const { data, error } = await db.rpc('cron_token_valid', { _name: CRON_TOKEN_NAME, _token: token });
      if (error || data !== true) return fail('not_allowed', 'Keine Berechtigung.');
      return json({ ok: true, ...(await sendWeekly(db, { dryRun: false })) });
    }
    if (isServiceRole(req)) return json({ ok: true, ...(await sendWeekly(db, { dryRun: !!body.dry_run })) });

    const admin = await requireAdmin(req, db);
    if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
    // Echter Versand an alle nur für die Glückwunsch-Mails; den Wochenstand verschickt nur der Cron.
    const dryRun = body.test ? false : body.mode === 'awards' ? body.dry_run !== false : true;
    const onlyTo = body.test ? TEST_TO : null;
    if (body.mode === 'awards') {
      if (!body.season_id || !/^[0-9a-f-]{36}$/i.test(body.season_id)) return fail('invalid_request', 'Saison fehlt.');
      return json({ ok: true, ...(await sendAwards(db, body.season_id, { dryRun, onlyTo })) });
    }
    return json({ ok: true, ...(await sendWeekly(db, { dryRun, onlyTo })) });
  } catch (e) {
    console.error('[liga-weekly]', e);
    return fail('internal_error', e instanceof Error ? e.message : 'Liga-Mail fehlgeschlagen.');
  }
});
