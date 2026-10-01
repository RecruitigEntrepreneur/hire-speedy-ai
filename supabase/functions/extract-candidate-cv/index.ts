/**
 * extract-candidate-cv – Lebenslauf auslesen für „Kandidat anlegen" und „CV aktualisieren".
 *
 * Body: { pdfPath?: string; text?: string; notes?: string; candidateId?: string }
 *  - pdfPath: Datei im Bucket cv-documents, muss im Ordner des Nutzers liegen
 *  - text:    eingefügter Text oder im Browser gelesenes Word-Dokument
 *  - notes:   optionale Gesprächsnotizen, gleiche Prüfung wie der Lebenslauf
 *  - candidateId: nur beim Aktualisieren; der Kandidat muss dem Nutzer gehören
 *
 * Ablauf: Text holen → Kontakt selbst lesen und schwärzen (Name, Kontakt,
 * Anschrift, Geburtsdatum, Familie, Herkunft raus) → KI liest mit Zitat aus →
 * jedes Zitat wird gegen den geschwärzten Text geprüft. Schreibt nichts in die
 * Datenbank; der Headhunter prüft auf der Prüfseite und speichert dort.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiChat, AiError } from '../_shared/ai.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { buildCvSystemPrompt, buildCvUserPrompt, CV_TOOL, prepareCvText, validateCv } from '../_shared/cv-extraction.ts';
import { pdfToText, PdfTextError } from '../_shared/pdf-text.ts';

const MAX_TEXT = 40000;

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

    const body = await req.json().catch(() => null) as { pdfPath?: string; text?: string; notes?: string; candidateId?: string } | null;
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const [{ data: isRecruiter }, { data: isAdmin }] = await Promise.all([
      db.rpc('has_role', { _user_id: user.id, _role: 'recruiter' }),
      db.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    ]);
    if (!isRecruiter && !isAdmin) return fail('not_allowed', 'Nur für Headhunter.');

    if (body?.candidateId) {
      const { data: cand } = await db.from('candidates').select('recruiter_id').eq('id', body.candidateId).maybeSingle();
      if (!cand) return fail('not_found', 'Kandidat nicht gefunden.');
      if (cand.recruiter_id !== user.id && !isAdmin) return fail('not_allowed', 'Dieser Kandidat gehört nicht zu deinem Konto.');
    }

    let raw = typeof body?.text === 'string' ? body.text : '';
    let pdfModel: string | null = null;
    if (!raw.trim() && body?.pdfPath) {
      const path = String(body.pdfPath);
      if (!path.startsWith(`${user.id}/`) && !isAdmin) return fail('not_allowed', 'Diese Datei gehört nicht zu deinem Konto.');
      const { data: file, error } = await db.storage.from('cv-documents').download(path);
      if (error || !file) return fail('not_found', 'Datei nicht gefunden.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length > 10 * 1024 * 1024) return fail('invalid_request', 'Die Datei ist größer als 10 MB.');
      if (String.fromCharCode(...bytes.subarray(0, 4)) !== '%PDF') return fail('invalid_request', 'Das ist keine PDF-Datei.');
      const r = await pdfToText(bytes);
      raw = r.text;
      pdfModel = r.model;
    }
    raw = raw.slice(0, MAX_TEXT);
    if (raw.trim().length < 40) return fail('invalid_request', 'Im Lebenslauf steht zu wenig Text zum Auslesen.');

    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 8000) : '';
    const prepared = prepareCvText(raw);
    const result = await aiChat({
      system: buildCvSystemPrompt(),
      user: buildCvUserPrompt(prepared.redacted, notes),
      tool: CV_TOOL,
      temperature: 0,
    });
    const now = new Date();
    const nowYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const cv = validateCv(result.toolArguments, prepared, notes, nowYm);

    return json({ ...cv, raw_text: raw, model: result.model, pdf_model: pdfModel });
  } catch (e) {
    if (e instanceof PdfTextError) return fail('upstream_error', e.message);
    if (e instanceof AiError) return fail('upstream_error', 'Die KI ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.', { detail: e.message });
    console.error('extract-candidate-cv', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Lebenslauf konnte nicht ausgelesen werden.');
  }
});
