// deno-lint-ignore-file no-explicit-any
/**
 * linkedin – LinkedIn des Headhunters verbinden und Stellen-Beiträge posten (21.10.2026).
 *
 * Aktionen (body.action), nur für angemeldete Headhunter:
 *   status                                        → verbunden?, Name, gültig bis, ist die App eingerichtet?
 *   start     { return_to }                       → Adresse der LinkedIn-Anmeldung
 *   trennen                                        → Verbindung löschen
 *   posten    { job_id, text, bild, vorlage, format, sichtbarkeit, gehalt } → Beitrag mit Bild
 *   loeschen  { post_id }                          → Beitrag auf LinkedIn und hier löschen
 *
 * Gepostet wird nur nach dem Klick „Freigeben“ im Beitragsfenster, nur zu
 * Stellen, die der Headhunter gerade sucht, und nur, wenn der Text den Kunden
 * nicht verrät (dieselbe Prüfung wie in der Vorschau, hier noch einmal).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fail, json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { generateToken } from '../_shared/tokens.ts';
import { decryptToken, getEncryptionKey } from '../_shared/encryption.ts';
import { authorizeUrl, linkedinConfig, LinkedinError, loeschen, posten, postUrl, sichererPfad } from '../_shared/linkedin-api.ts';
import { anonymFunde, GRUND_TEXT, regionAus } from '../_shared/linkedin-anonym.ts';

const MAX_BILD = 5 * 1024 * 1024;

async function angemeldet(req: Request) {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

async function verbindung(db: any, userId: string) {
  const { data } = await db.from('recruiter_linkedin').select('*').eq('recruiter_id', userId).maybeSingle();
  if (!data) return null;
  return { ...data, abgelaufen: Date.parse(data.expires_at) <= Date.now() + 60000 };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');
  try {
    const user = await angemeldet(req);
    if (!user) return fail('not_allowed', 'Bitte melde dich an.');
    const db = serviceClient();
    const { data: istRecruiter } = await db.rpc('has_role', { _user_id: user.id, _role: 'recruiter' });
    if (!istRecruiter) return fail('not_allowed', 'Nur für Headhunter.');
    const body = await req.json().catch(() => ({}));
    const cfg = linkedinConfig();

    switch (String(body?.action ?? '')) {
      case 'status': {
        const v = await verbindung(db, user.id);
        return json({ eingerichtet: !!cfg, verbunden: !!v && !v.abgelaufen, abgelaufen: !!v?.abgelaufen, name: v?.name ?? null, bild: v?.picture_url ?? null, gueltig_bis: v?.expires_at ?? null });
      }
      case 'start': {
        if (!cfg) return fail('not_deployed', 'Die LinkedIn-Verbindung ist bei Matchunt noch nicht eingerichtet.');
        const state = generateToken();
        await db.from('linkedin_oauth_states').delete().lt('created_at', new Date(Date.now() - 3600000).toISOString());
        await db.from('linkedin_oauth_states').insert({ state, user_id: user.id, return_to: sichererPfad(body.return_to) });
        return json({ url: authorizeUrl(cfg, state) });
      }
      case 'trennen': {
        await db.from('recruiter_linkedin').delete().eq('recruiter_id', user.id);
        return json({ ok: true });
      }
      case 'posten': {
        if (!cfg) return fail('not_deployed', 'Die LinkedIn-Verbindung ist bei Matchunt noch nicht eingerichtet.');
        const v = await verbindung(db, user.id);
        if (!v || v.abgelaufen) return fail('expired', 'Bitte bestätige LinkedIn kurz neu, dann geht der Beitrag sofort raus.');
        const jobId = String(body.job_id ?? '');
        const { data: akt } = await db.from('recruiter_job_activations').select('status').eq('recruiter_id', user.id).eq('job_id', jobId).eq('status', 'active').maybeSingle();
        if (!akt) return fail('not_allowed', 'Posten geht nur, solange du die Stelle suchst.');
        const { data: job } = await db.from('jobs').select('*').eq('id', jobId).maybeSingle();
        if (!job) return fail('not_found', 'Stelle nicht gefunden.');
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (text.length < 20 || text.length > 3000) return fail('invalid_request', 'Der Text muss zwischen 20 und 3.000 Zeichen lang sein.');
        const domains: (string | null)[] = [];
        if (job.intake_draft_id) {
          const { data: d } = await db.from('intake_drafts').select('company_domain, company_website').eq('id', job.intake_draft_id).maybeSingle();
          if (d) domains.push(d.company_domain, d.company_website);
        }
        const funde = anonymFunde(text, {
          firma: job.company_name, redList: job.reveal_envelope?.red_list, domains, region: regionAus(job.location, job.remote_type),
          mitarbeitende: Number(job.company_headcount) || null,
        });
        if (funde.length) return fail('conflict', `Der Text verrät den Kunden: ${funde.map((f) => `„${f.treffer.trim()}“ ${GRUND_TEXT[f.grund]}`).join(', ')}.`, { funde });
        const b64 = typeof body.bild === 'string' ? body.bild.replace(/^data:image\/png;base64,/, '') : '';
        const bild = b64 ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : null;
        if (!bild || bild.length > MAX_BILD || bild[0] !== 0x89 || bild[1] !== 0x50) return fail('invalid_request', 'Das Bild fehlt oder ist kein PNG.');
        const sichtbarkeit = body.sichtbarkeit === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC';
        const token = await decryptToken(v.access_token_enc, getEncryptionKey());
        const zeile = { job_id: jobId, recruiter_id: user.id, text, template: String(body.vorlage ?? ''), format: String(body.format ?? ''), visibility: sichtbarkeit, show_salary: body.gehalt !== false };
        try {
          const urn = await posten(cfg, token, { memberId: v.member_id, text, bild, bildText: `Vertrauliche Suche: ${job.title}`, sichtbarkeit });
          const { data: row } = await db.from('job_linkedin_posts').insert({ ...zeile, status: 'posted', post_urn: urn }).select('id, posted_at').single();
          return json({ ok: true, post_id: row?.id, urn, url: postUrl(urn), gepostet: row?.posted_at });
        } catch (e) {
          const status = e instanceof LinkedinError ? e.status : 0;
          await db.from('job_linkedin_posts').insert({ ...zeile, status: 'failed', error: e instanceof Error ? e.message.slice(0, 500) : 'unbekannt' });
          if (status === 401) {
            await db.from('recruiter_linkedin').update({ expires_at: new Date().toISOString() }).eq('recruiter_id', user.id);
            return fail('expired', 'Bitte bestätige LinkedIn kurz neu, dann geht der Beitrag sofort raus.');
          }
          console.error('linkedin posten', e instanceof Error ? e.message : e);
          return fail('upstream_error', 'LinkedIn hat den Beitrag nicht angenommen. Dein Beitrag ist gespeichert, versuch es gleich noch einmal.');
        }
      }
      case 'loeschen': {
        if (!cfg) return fail('not_deployed', 'Die LinkedIn-Verbindung ist bei Matchunt noch nicht eingerichtet.');
        const { data: p } = await db.from('job_linkedin_posts').select('*').eq('id', String(body.post_id ?? '')).eq('recruiter_id', user.id).maybeSingle();
        if (!p || p.status !== 'posted' || !p.post_urn) return fail('not_found', 'Beitrag nicht gefunden.');
        const v = await verbindung(db, user.id);
        if (!v || v.abgelaufen) return fail('expired', 'Bitte bestätige LinkedIn kurz neu.');
        await loeschen(cfg, await decryptToken(v.access_token_enc, getEncryptionKey()), p.post_urn);
        await db.from('job_linkedin_posts').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', p.id);
        return json({ ok: true });
      }
      default:
        return fail('invalid_request', 'Unbekannte Aktion.');
    }
  } catch (e) {
    console.error('linkedin', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Das hat gerade nicht geklappt.');
  }
});
