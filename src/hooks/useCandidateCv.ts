import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isMissingColumnError } from '@/lib/candidateDossier';
import { CurrentCv, cvFileProblem, cvStoragePath, isCvFileName, parseSnapshot } from '@/lib/candidateCv';
import { insertCvDocument, sanitizeFileName } from '@/hooks/useCvImport';
import i18n from '@/i18n';

// Meldungen beim Aufruf übersetzt (Namespace candidateLogic).
const tl = (key: string, options?: Record<string, unknown>): string => i18n.t(`candidateLogic:${key}`, options) as string;

type DocRow = Record<string, unknown>;

function toCurrentCv(row: DocRow): CurrentCv {
  return {
    id: String(row.id),
    file_name: String(row.file_name ?? ''),
    file_url: String(row.file_url ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
    confirmed_current_at: (row.confirmed_current_at as string | null | undefined) ?? null,
    extracted: parseSnapshot(row.extracted),
  };
}

/** Aktueller Lebenslauf (PDF oder Word) eines Kandidaten, gleiche Regel wie die Datenbank. */
export async function fetchCurrentCv(candidateId: string): Promise<CurrentCv | null> {
  const { data } = await supabase
    .from('candidate_documents')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('document_type', 'cv')
    .eq('is_current', true)
    .order('created_at', { ascending: false })
    .limit(5);
  const row = ((data ?? []) as DocRow[]).find((r) => isCvFileName(r.file_name as string));
  return row ? toCurrentCv(row) : null;
}

/** Welche dieser Kandidaten haben einen Lebenslauf? Für die Markierung in Listen. */
export async function fetchCandidateIdsWithCv(candidateIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < candidateIds.length; i += 200) {
    const { data } = await supabase
      .from('candidate_documents')
      .select('candidate_id, file_name')
      .in('candidate_id', candidateIds.slice(i, i + 200))
      .eq('document_type', 'cv')
      .eq('is_current', true);
    for (const r of (data ?? []) as { candidate_id: string; file_name: string }[]) if (isCvFileName(r.file_name)) out.add(r.candidate_id);
  }
  return out;
}

/** Lebenslauf-Datei ablegen, ohne Auslesen (z. B. beim neuen Kandidaten im Einreichen-Fenster). */
export async function uploadCvFile(p: { userId: string; candidateId: string; file: File }): Promise<void> {
  const problem = cvFileProblem(p.file);
  if (problem) throw new Error(problem);
  const path = `${p.userId}/${Date.now()}-${sanitizeFileName(p.file.name)}`;
  const { error: upErr } = await supabase.storage.from('cv-documents').upload(path, p.file, { contentType: p.file.type || undefined });
  if (upErr) throw new Error(tl('cv.uploadFailed', { msg: upErr.message }));
  const { data: { publicUrl } } = supabase.storage.from('cv-documents').getPublicUrl(path);
  const failed = await insertCvDocument(p.candidateId, p.userId, {
    fileName: p.file.name, fileUrl: publicUrl, fileSize: p.file.size, mimeType: p.file.type || 'application/octet-stream',
  }, null);
  if (failed) throw new Error(tl('cv.saveFailed'));
}

/** Headhunter bestätigt: Lebenslauf ist noch aktuell. False, wenn die Spalte noch fehlt. */
export async function confirmCvCurrent(documentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('candidate_documents')
    .update({ confirmed_current_at: new Date().toISOString() } as never)
    .eq('id', documentId);
  if (error && !isMissingColumnError(error)) throw new Error(tl('cv.confirmFailed'));
  return !error;
}

/** Signierter Link zum Ansehen (eigener Kandidat, 10 Minuten). */
export async function cvViewUrl(cv: CurrentCv): Promise<string | null> {
  const path = cvStoragePath(cv.file_url);
  if (!path) return null;
  const { data } = await supabase.storage.from('cv-documents').createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export function useCandidateCv(candidateId: string | null | undefined) {
  const [cv, setCv] = useState<CurrentCv | null>(null);
  const [loading, setLoading] = useState(!!candidateId);

  const reload = useCallback(async () => {
    if (!candidateId) { setCv(null); setLoading(false); return null; }
    setLoading(true);
    const next = await fetchCurrentCv(candidateId);
    setCv(next);
    setLoading(false);
    return next;
  }, [candidateId]);

  useEffect(() => { void reload(); }, [reload]);

  return { cv, loading, reload };
}
