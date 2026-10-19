/**
 * interview-understand
 *
 * „In eigenen Worten“ bei gefällt, stört und Karriereziel im Interview: Findet das Wörterbuch im
 * Browser nichts, ordnet die KI den Satz VORHANDENEN Knöpfen zu. Sie schreibt keinen
 * Text, bewertet niemanden und schlägt nur vor; der Headhunter bestätigt per Klick.
 * Schreibt nichts in die Datenbank.
 *
 * Sicherheit wie extract-candidate-dossier:
 *  1. Nutzer aus dem Token, Kandidat muss ihm gehören (oder Admin).
 *  2. Name, Arbeitgeber, E-Mail, Telefon, Links werden vor dem KI-Aufruf geschwärzt;
 *     assertNoLeak prüft den Prompt (fail closed).
 *  3. Jeder Treffer braucht einen Knopf aus der mitgeschickten Liste und ein Zitat,
 *     das wörtlich im geschwärzten Text steht.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiChat, AiError } from '../_shared/ai.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { assertNoLeak, redactFreeText, type RedactionReport } from '../_shared/pii-redaction.ts';

const MAX_TEXT = 500;
const MAX_LABELS = 80;

function nameParts(fullName: string | null | undefined): string[] {
  return String(fullName ?? '')
    .split(/[\s.\-]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
}

const SYSTEM = [
  'Du ordnest Aussagen aus einem Bewerbergespräch vorhandenen Antwort-Knöpfen zu.',
  'Regeln:',
  '- Nur Knöpfe aus der Liste, exakt so geschrieben.',
  '- Nur wenn die Aussage eindeutig dazu passt. Lieber kein Treffer als ein falscher.',
  '- quote: kurzer wörtlicher Ausschnitt (2 bis 5 Wörter) aus dem Text, der den Knopf belegt.',
  '- Höchstens 3 Treffer. Keine Bewertung der Person, keine Vermutungen.',
].join('\n');

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return fail('not_allowed', 'Anmeldung fehlt.');

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: userData } = await anon.auth.getUser(token);
    const user = userData?.user;
    if (!user) return fail('not_allowed', 'Anmeldung ungültig.');

    const body = await req.json().catch(() => null) as { candidateId?: string; side?: string; text?: string; labels?: unknown } | null;
    const candidateId = body?.candidateId;
    const side = body?.side === 'pos' ? 'gefällt' : body?.side === 'neg' ? 'stört' : body?.side === 'goal' ? 'ziel' : null;
    const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    const labels = Array.isArray(body?.labels)
      ? [...new Set((body!.labels as unknown[]).filter((l): l is string => typeof l === 'string' && l.length >= 2 && l.length <= 80))].slice(0, MAX_LABELS)
      : [];
    if (!candidateId || !side || text.length < 3 || !labels.length) return fail('invalid_request', 'candidateId, side, text und labels sind nötig.');

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: candidate } = await admin
      .from('candidates')
      .select('id, recruiter_id, full_name, company')
      .eq('id', candidateId)
      .maybeSingle();
    if (!candidate) return fail('not_found', 'Kandidat nicht gefunden.');
    if (candidate.recruiter_id !== user.id) {
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return fail('not_allowed', 'Dieser Kandidat gehört nicht zu deinem Konto.');
    }

    const report: RedactionReport = {
      mode: 'interview-understand', nameTokens: 0, employersAliased: 0, citiesGeneralized: 0, emailsRemoved: 0,
      phonesRemoved: 0, urlsRemoved: 0, datesRemoved: 0, ibansRemoved: 0, freeTextFields: 1,
    };
    const names = nameParts(candidate.full_name);
    const companyTokens = candidate.company ? [String(candidate.company).trim()].filter((c) => c.length >= 2) : [];
    const entries = [
      ...(candidate.full_name ? [{ variants: [String(candidate.full_name)], replacement: '[Kandidat:in]' }] : []),
      ...names.map((p) => ({ variants: [p], replacement: '[Kandidat:in]' })),
      ...companyTokens.map((c) => ({ variants: [c], replacement: '[Arbeitgeber]' })),
    ];
    const redacted = redactFreeText(text, entries, report) ?? '';
    const leaks = assertNoLeak(redacted, { nameTokens: names, companyTokens, cityTokens: [] }).filter((l) => l !== 'city');
    if (leaks.length) return fail('internal_error', 'Die Schwärzung war nicht vollständig, deshalb wurde nichts an die KI geschickt.', { leaks });

    const result = await aiChat({
      system: SYSTEM,
      user: `Frage im Gespräch: „${side === 'gefällt' ? 'Was gefällt Ihnen heute besonders gut?' : side === 'stört' ? 'Was stört Sie?' : 'Was wollen Sie in Ihrer Karriere ultimativ erreichen?'}“\n\nKnöpfe:\n${labels.map((l) => `- ${l}`).join('\n')}\n\nAussage:\n${redacted}`,
      temperature: 0,
      tool: {
        name: 'zuordnen',
        description: 'Passende Knöpfe mit wörtlichem Beleg',
        parameters: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              maxItems: 3,
              items: {
                type: 'object',
                properties: { label: { type: 'string', enum: labels }, quote: { type: 'string' } },
                required: ['label', 'quote'],
              },
            },
          },
          required: ['matches'],
        },
      },
    });

    const raw = Array.isArray(result.toolArguments?.matches) ? result.toolArguments!.matches as Array<{ label?: unknown; quote?: unknown }> : [];
    const lower = redacted.toLowerCase();
    const matches: Array<{ label: string; quote: string }> = [];
    for (const m of raw) {
      const label = typeof m.label === 'string' ? m.label : '';
      const quote = typeof m.quote === 'string' ? m.quote.trim().replace(/^[„"']|[“"']$/g, '') : '';
      if (!labels.includes(label) || quote.length < 3 || !lower.includes(quote.toLowerCase())) continue;
      if (/\[(Kandidat:in|Arbeitgeber|E-Mail|Telefon|Link|Profil)\]/.test(quote)) continue;
      if (matches.some((x) => x.label === label)) continue;
      matches.push({ label, quote });
    }
    return json({ success: true, matches: matches.slice(0, 3), model: result.model });
  } catch (err) {
    if (err instanceof AiError) return fail('upstream_error', `KI-Zuordnung fehlgeschlagen: ${err.message}`);
    console.error('interview-understand', err);
    return fail('internal_error', 'Zuordnung fehlgeschlagen.');
  }
});
