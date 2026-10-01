import { supabase } from '@/integrations/supabase/client';
import {
  DossierForm,
  isMissingColumnError,
  stripNewColumns,
  toCandidatePayload,
  toNotesPayload,
} from '@/lib/candidateDossier';
import { CvEducation, CvExtraction, CvStation } from '@/lib/cvImport';
import { docxToText, isDocx } from '@/lib/docxText';

export interface CvFileInfo {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

const sanitize = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);

async function invokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    if (ctx.status === 404) return 'Das Auslesen ist noch nicht veröffentlicht (Funktion extract-candidate-cv fehlt).';
    const detail = await ctx.clone().json().catch(() => null);
    if (typeof detail?.message === 'string') return detail.message;
  }
  // Keine Antwort vom Server: Funktion nicht veröffentlicht oder Netz weg.
  if ((error as { name?: string })?.name === 'FunctionsFetchError') return 'Das Auslesen ist gerade nicht erreichbar (Funktion extract-candidate-cv noch nicht veröffentlicht?).';
  return 'Der Lebenslauf konnte nicht ausgelesen werden. Bitte gleich noch einmal versuchen.';
}

function devMockEnabled(): boolean {
  try { return import.meta.env.DEV && localStorage.getItem('cvImportMock') === '1'; } catch { return false; }
}

/**
 * Datei hochladen (PDF/Word) oder Text nehmen und von extract-candidate-cv auslesen
 * lassen. Word wird im Browser gelesen, PDF serverseitig.
 */
export async function extractCv(params: { userId: string; file?: File | null; text?: string; notes?: string; candidateId?: string }): Promise<{ cv: CvExtraction; fileInfo: CvFileInfo | null }> {
  let pdfPath: string | undefined;
  let text = params.text?.trim() ?? '';
  let fileInfo: CvFileInfo | null = null;
  const file = params.file ?? null;
  if (file) {
    const path = `${params.userId}/${Date.now()}-${sanitize(file.name)}`;
    const { error: upErr } = await supabase.storage.from('cv-documents').upload(path, file, { contentType: file.type || undefined });
    if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`);
    const { data: { publicUrl } } = supabase.storage.from('cv-documents').getPublicUrl(path);
    fileInfo = { fileName: file.name, fileUrl: publicUrl, fileSize: file.size, mimeType: file.type || 'application/octet-stream' };
    if (isDocx(file)) text = await docxToText(file);
    else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) pdfPath = path;
    else text = await file.text();
  }
  if (devMockEnabled()) {
    const { cvImportMock } = await import('@/dev/cvImportMock');
    return { cv: cvImportMock(), fileInfo };
  }
  const { data, error } = await supabase.functions.invoke('extract-candidate-cv', {
    body: { pdfPath, text: pdfPath ? undefined : text, notes: params.notes ?? '', candidateId: params.candidateId },
  });
  if (error) throw new Error(await invokeError(error));
  return { cv: data as CvExtraction, fileInfo };
}

const monthDate = (ym: string | null) => (ym ? `${ym}-01` : null);

function stationRows(candidateId: string, stations: CvStation[], offset = 0) {
  return stations.map((s, i) => ({
    candidate_id: candidateId,
    company_name: s.company_name || null,
    job_title: s.job_title || null,
    location: s.location || null,
    start_date: monthDate(s.start),
    end_date: s.is_current ? null : monthDate(s.end),
    is_current: s.is_current,
    description: s.description || null,
    sort_order: offset + i,
  }));
}

function educationRows(candidateId: string, educations: CvEducation[]) {
  return educations.map((e, i) => ({
    candidate_id: candidateId, institution: e.institution, degree: e.degree || null, field_of_study: e.field_of_study || null,
    graduation_year: e.graduation_year, grade: e.grade || null, sort_order: i,
  }));
}

async function insertDocument(candidateId: string, userId: string, fileInfo: CvFileInfo): Promise<string | null> {
  await supabase.from('candidate_documents').update({ is_current: false } as never).eq('candidate_id', candidateId).eq('document_type', 'cv');
  const { data: existing } = await supabase.from('candidate_documents').select('version').eq('candidate_id', candidateId).eq('document_type', 'cv')
    .order('version', { ascending: false }).limit(1);
  const version = ((existing?.[0] as { version?: number } | undefined)?.version ?? 0) + 1;
  const { error } = await supabase.from('candidate_documents').insert({
    candidate_id: candidateId, document_type: 'cv', version, file_name: fileInfo.fileName, file_url: fileInfo.fileUrl,
    file_size: fileInfo.fileSize, mime_type: fileInfo.mimeType, is_current: true, uploaded_by: userId,
  } as never);
  return error ? 'Lebenslauf-Datei' : null;
}

async function writeNotes(candidateId: string, userId: string, form: DossierForm, notesId: string | null): Promise<string | null> {
  const { base, extra } = toNotesPayload(form);
  const payload = { ...base, ...extra };
  const write = (p: Record<string, unknown>) => notesId
    ? supabase.from('candidate_interview_notes').update({ ...p, updated_at: new Date().toISOString() } as never).eq('id', notesId)
    : supabase.from('candidate_interview_notes').insert({ ...p, candidate_id: candidateId, recruiter_id: userId, status: 'draft' } as never);
  let { error } = await write(payload);
  if (error && isMissingColumnError(error)) ({ error } = await write(stripNewColumns(payload)));
  return error ? 'Interviewangaben (Sperrliste, Motivation, Ziele)' : null;
}

async function logConsent(userId: string, candidateId: string) {
  await supabase.from('consents').insert({
    subject_id: userId, subject_type: 'recruiter', consent_type: 'candidate_data_processing', granted: true,
    granted_at: new Date().toISOString(), scope: candidateId, version: '1.0',
  } as never).then(() => undefined, () => undefined);
}

export interface CvSaveResult {
  candidateId: string;
  /** Teile, die nicht gespeichert werden konnten – werden angezeigt, nie verschluckt. */
  failed: string[];
}

/** Neuer Kandidat aus dem geprüften Lebenslauf. */
export async function saveNewCandidateFromCv(p: { userId: string; form: DossierForm; cv: CvExtraction; fileInfo: CvFileInfo | null; stations: CvStation[] }): Promise<CvSaveResult> {
  const { userId, form, cv, fileInfo, stations } = p;
  const candidate = {
    ...toCandidatePayload(form),
    email: form.email.trim(), // Pflichtfeld: leer statt Platzhalter-Adresse
    recruiter_id: userId,
    cv_raw_text: cv.raw_text,
    cv_ai_summary: cv.suggestions.summary || null,
    cv_ai_bullets: cv.suggestions.highlights.length ? cv.suggestions.highlights : null,
    cv_parsed_at: new Date().toISOString(),
    cv_parser_version: cv.version,
    import_source: 'cv_upload',
  };
  const { data, error } = await supabase.from('candidates').insert(candidate as never).select('id').single();
  if (error || !data) throw new Error(`Kandidat konnte nicht angelegt werden: ${error?.message ?? 'unbekannt'}`);
  const candidateId = (data as { id: string }).id;
  const failed: string[] = [];

  const results = await Promise.all([
    stations.length ? supabase.from('candidate_experiences').insert(stationRows(candidateId, stations) as never) : null,
    cv.educations.length ? supabase.from('candidate_educations').insert(educationRows(candidateId, cv.educations) as never) : null,
    form.languages.length ? supabase.from('candidate_languages').insert(form.languages.filter((l) => l.language.trim()).map((l) => ({ candidate_id: candidateId, language: l.language.trim(), proficiency: l.proficiency || null })) as never) : null,
    cv.skills.length ? supabase.from('candidate_skills').insert(cv.skills.filter((s) => form.skills.includes(s.name)).map((s) => ({ candidate_id: candidateId, skill_name: s.name, years_experience: s.years })) as never) : null,
  ]);
  ['Stationen', 'Ausbildung', 'Sprachen', 'Skill-Details'].forEach((label, i) => { if (results[i]?.error) failed.push(label); });
  const notesFail = await writeNotes(candidateId, userId, form, null);
  if (notesFail) failed.push(notesFail);
  if (fileInfo) {
    const docFail = await insertDocument(candidateId, userId, fileInfo);
    if (docFail) failed.push(docFail);
  }
  await logConsent(userId, candidateId);
  return { candidateId, failed };
}

/** Neuer Lebenslauf für einen bestehenden Kandidaten: nur Ergänzungen, nichts löschen. */
export async function saveCvIntoExisting(p: {
  userId: string; candidateId: string; before: DossierForm; merged: DossierForm; cv: CvExtraction; fileInfo: CvFileInfo | null;
  addStations: CvStation[]; notesId: string | null;
}): Promise<CvSaveResult> {
  const { userId, candidateId, before, merged, cv, fileInfo, addStations, notesId } = p;
  const failed: string[] = [];
  const next = toCandidatePayload(merged);
  const prev = toCandidatePayload(before);
  const changed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (JSON.stringify(v) !== JSON.stringify(prev[k])) changed[k] = v;
  changed.cv_raw_text = cv.raw_text;
  changed.cv_parsed_at = new Date().toISOString();
  changed.cv_parser_version = cv.version;
  const { error } = await supabase.from('candidates').update(changed as never).eq('id', candidateId);
  if (error) throw new Error(`Kandidat konnte nicht aktualisiert werden: ${error.message}`);

  if (JSON.stringify(toNotesPayload(merged)) !== JSON.stringify(toNotesPayload(before))) {
    const notesFail = await writeNotes(candidateId, userId, merged, notesId);
    if (notesFail) failed.push(notesFail);
  }
  const newLangs = merged.languages.filter((l) => !before.languages.some((b) => b.language.toLowerCase() === l.language.toLowerCase()));
  if (newLangs.length) {
    const { error: e } = await supabase.from('candidate_languages').insert(newLangs.map((l) => ({ candidate_id: candidateId, language: l.language, proficiency: l.proficiency || null })) as never);
    if (e) failed.push('Sprachen');
  }
  if (addStations.length) {
    const { error: e } = await supabase.from('candidate_experiences').insert(stationRows(candidateId, addStations, 100) as never);
    if (e) failed.push('Stationen');
  }
  if (fileInfo) {
    const docFail = await insertDocument(candidateId, userId, fileInfo);
    if (docFail) failed.push(docFail);
  }
  return { candidateId, failed };
}

/**
 * Gibt es diesen Kandidaten schon? Gleicher Name zählt zuerst; nur gleiche E-Mail wird
 * eigens benannt (Testadressen teilen sich oft mehrere Kandidaten).
 */
export async function findDuplicate(userId: string, form: DossierForm): Promise<{ id: string; full_name: string; reason: 'name' | 'email' } | null> {
  const name = form.full_name.trim();
  const email = form.email.trim().toLowerCase();
  if (!name && !email) return null;
  const { data } = await supabase.from('candidates').select('id, full_name, email').eq('recruiter_id', userId)
    .or([name ? `full_name.ilike.${name.replace(/[,()%]/g, ' ')}` : '', email ? `email.eq.${email}` : ''].filter(Boolean).join(','))
    .limit(10);
  const rows = (data ?? []) as { id: string; full_name: string; email: string | null }[];
  const byName = rows.find((r) => r.full_name.trim().toLowerCase() === name.toLowerCase());
  if (byName) return { id: byName.id, full_name: byName.full_name, reason: 'name' };
  const byEmail = rows.find((r) => (r.email ?? '').toLowerCase() === email);
  return byEmail ? { id: byEmail.id, full_name: byEmail.full_name, reason: 'email' } : null;
}
