/**
 * extract-candidate-dossier
 *
 * Füllt die Kandidatenakte aus eingeworfenen Interview-Quellen (eigene
 * Notizen, Transkripte, Mails) – als VORSCHLÄGE mit Zitat-Beleg. Schreibt
 * nichts in die Datenbank; der Headhunter bestätigt im Prüf-Screen.
 *
 * Sicherheit (Befund 29.09.2026 an process-interview-notes: kein
 * Besitzercheck, ungeschwärzte Notizen an die KI):
 *  1. Nutzer aus dem Token (getUser), Kandidat muss ihm gehören (oder Admin).
 *  2. Name, Arbeitgeber, E-Mail, Telefon, Links werden vor dem KI-Aufruf
 *     geschwärzt; assertNoLeak prüft den fertigen Prompt (fail closed).
 *  3. Jeder Wert braucht ein Zitat, das wörtlich im geschwärzten Text steht.
 *  4. Keine Bewertung der Person, keine Art.-9-/AGG-Merkmale.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiChat, AiError } from '../_shared/ai.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { assertNoLeak, redactFreeText, type RedactionReport } from '../_shared/pii-redaction.ts';
import { buildSystemPrompt, buildTool, joinSources, validateExtraction } from '../_shared/dossier-extraction.ts';

const MAX_SOURCES = 6;
const MAX_CHARS = 60000;

function nameParts(fullName: string | null | undefined): string[] {
  return String(fullName ?? '')
    .split(/[\s.\-]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return fail('not_allowed', 'Anmeldung fehlt.');

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon = createClient(url, anonKey);
    const { data: userData } = await anon.auth.getUser(token);
    const user = userData?.user;
    if (!user) return fail('not_allowed', 'Anmeldung ungültig.');

    const body = await req.json().catch(() => null) as { candidateId?: string; sources?: Array<{ label?: string; text?: string }> } | null;
    const candidateId = body?.candidateId;
    const sources = (body?.sources ?? [])
      .slice(0, MAX_SOURCES)
      .map((s) => ({ label: typeof s.label === 'string' ? s.label.slice(0, 80) : undefined, text: typeof s.text === 'string' ? s.text : '' }))
      .filter((s) => s.text.trim().length > 0);
    if (!candidateId || !sources.length) return fail('invalid_request', 'candidateId und mindestens eine Quelle sind nötig.');

    // Besitzercheck mit Service-Rolle, damit RLS-Lücken keine Rolle spielen
    const admin = createClient(url, serviceKey);
    const { data: candidate } = await admin
      .from('candidates')
      .select('id, recruiter_id, full_name, company, email, phone')
      .eq('id', candidateId)
      .maybeSingle();
    if (!candidate) return fail('not_found', 'Kandidat nicht gefunden.');
    if (candidate.recruiter_id !== user.id) {
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return fail('not_allowed', 'Dieser Kandidat gehört nicht zu deinem Konto.');
    }

    // Schwärzen
    const report: RedactionReport = {
      mode: 'dossier-extraction', nameTokens: 0, employersAliased: 0, citiesGeneralized: 0, emailsRemoved: 0,
      phonesRemoved: 0, urlsRemoved: 0, datesRemoved: 0, ibansRemoved: 0, freeTextFields: sources.length,
    };
    const names = nameParts(candidate.full_name);
    const companyTokens = candidate.company ? [String(candidate.company).trim()].filter((c) => c.length >= 2) : [];
    const entries = [
      ...(candidate.full_name ? [{ variants: [String(candidate.full_name)], replacement: '[Kandidat:in]' }] : []),
      ...names.filter((p) => p.length >= 3).map((p) => ({ variants: [p], replacement: '[Kandidat:in]' })),
      ...companyTokens.map((c) => ({ variants: [c], replacement: '[Arbeitgeber]' })),
    ];
    report.nameTokens = names.length;
    report.employersAliased = companyTokens.length;
    const redacted = sources.map((s) => ({ label: s.label, text: redactFreeText(s.text, entries, report) ?? '' }));
    const sourceText = joinSources(redacted, MAX_CHARS);

    const leaks = assertNoLeak(sourceText, { nameTokens: names.filter((p) => p.length >= 3), companyTokens, cityTokens: [] })
      .filter((l) => l !== 'city');
    if (leaks.length) {
      return fail('internal_error', 'Die Schwärzung war nicht vollständig, deshalb wurde nichts an die KI geschickt.', { leaks });
    }

    const result = await aiChat({
      system: buildSystemPrompt(),
      user: `Werte diese Interview-Quellen aus:\n\n${sourceText}`,
      temperature: 0.1,
      tool: buildTool(),
    });

    const validated = validateExtraction(result.toolArguments, sourceText);
    return json({
      success: true,
      fields: validated.fields,
      protected_mentions: validated.protectedMentions,
      dropped: validated.dropped.length,
      model: result.model,
      redaction: { names: report.nameTokens, employers: report.employersAliased, emails: report.emailsRemoved, phones: report.phonesRemoved, urls: report.urlsRemoved },
    });
  } catch (err) {
    if (err instanceof AiError) return fail('upstream_error', `KI-Auswertung fehlgeschlagen: ${err.message}`);
    console.error('extract-candidate-dossier', err);
    return fail('internal_error', 'Auswertung fehlgeschlagen.');
  }
});
