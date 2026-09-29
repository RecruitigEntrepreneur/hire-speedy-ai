import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  DossierForm,
  Readiness,
  computeReadiness,
  fromRecords,
  isMissingColumnError,
  mergeNoteRows,
  stripNewColumns,
  toCandidatePayload,
  toNotesPayload,
} from '@/lib/candidateDossier';

type Rec = Record<string, unknown>;

interface DossierState {
  candidate: Rec | null;
  notes: Rec | null;
  /** Ältere, zusammengeführte Datensätze, die beim nächsten Speichern als ersetzt markiert werden. */
  olderNoteIds: string[];
  languages: Array<{ language: string | null; proficiency: string | null }>;
}

export interface DossierSaveResult {
  ok: boolean;
  /** Neue Interview-Felder konnten noch nicht gespeichert werden (Migration fehlt). */
  pendingColumns: boolean;
  error?: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function changedKeys(next: Rec, prev: Rec): Rec {
  const out: Rec = {};
  for (const key of Object.keys(next)) if (!same(next[key], prev[key])) out[key] = next[key];
  return out;
}

/** Akte und "Bereit zum Einreichen" eines Kandidaten, gleiche Regel wie im Profil. */
export async function fetchDossier(candidateId: string): Promise<{ form: DossierForm; readiness: Readiness }> {
  const [cand, notes, langs] = await Promise.all([
    supabase.from('candidates').select('*').eq('id', candidateId).maybeSingle(),
    supabase.from('candidate_interview_notes').select('*').eq('candidate_id', candidateId).order('updated_at', { ascending: false, nullsFirst: false }),
    supabase.from('candidate_languages').select('language, proficiency').eq('candidate_id', candidateId),
  ]);
  const form = fromRecords(
    cand.data as Rec | null,
    mergeNoteRows((notes.data as Rec[] | null) ?? []),
    (langs.data as Array<{ language: string | null; proficiency: string | null }> | null) ?? [],
  );
  return { form, readiness: computeReadiness(form) };
}

export async function fetchDossierReadiness(candidateId: string): Promise<Readiness> {
  return (await fetchDossier(candidateId)).readiness;
}

/**
 * Lädt und speichert die Kandidatenakte: candidates + der eine
 * Interview-Datensatz (neuester) + Sprachen. Bearbeiten-Panel und Interview
 * schreiben beide hierüber, damit jede Angabe nur an einer Stelle liegt.
 */
export function useCandidateDossier(candidateId: string | undefined) {
  const { user } = useAuth();
  const [state, setState] = useState<DossierState>({ candidate: null, notes: null, olderNoteIds: [], languages: [] });
  const [loading, setLoading] = useState(true);
  const [pendingColumns, setPendingColumns] = useState(false);
  // Speichervorgänge laufen nacheinander und sehen immer den zuletzt geladenen
  // Stand, sonst legt das Autospeichern im Interview zwei Datensätze an.
  const stateRef = useRef(state);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(async () => {
    if (!candidateId) return;
    const [cand, notes, langs] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', candidateId).maybeSingle(),
      supabase
        .from('candidate_interview_notes')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('updated_at', { ascending: false, nullsFirst: false }),
      supabase.from('candidate_languages').select('language, proficiency').eq('candidate_id', candidateId),
    ]);
    const noteRows = ((notes.data as Rec[] | null) ?? []).filter((r) => r.status !== 'superseded');
    const next: DossierState = {
      candidate: (cand.data as Rec | null) ?? null,
      notes: mergeNoteRows(noteRows),
      olderNoteIds: noteRows.slice(1).map((r) => String(r.id)),
      languages: (langs.data as DossierState['languages'] | null) ?? [],
    };
    stateRef.current = next;
    setState(next);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    load();
  }, [load]);

  const form = useMemo(() => fromRecords(state.candidate, state.notes, state.languages), [state]);
  const readiness = useMemo(() => computeReadiness(form), [form]);

  const saveNow = useCallback(
    async (next: DossierForm): Promise<DossierSaveResult> => {
      if (!candidateId || !user) return { ok: false, pendingColumns: false, error: 'Nicht angemeldet' };
      const state = stateRef.current;
      const prev = fromRecords(state.candidate, state.notes, state.languages);
      let pending = false;

      try {
        // 1. Kandidat: alles, was vom Datenbankstand abweicht. So wandern alte
        // Felder (salary_fix, Spezialisierungen) beim ersten Speichern mit.
        const candChanges = changedKeys(toCandidatePayload(next), state.candidate ?? {});
        if (Object.keys(candChanges).length) {
          const { error } = await supabase.from('candidates').update(candChanges as never).eq('id', candidateId);
          if (error) throw error;
        }

        // 2. Interview-Datensatz: genau einer je Kandidat, nur bei Änderungen
        const nextNotes = toNotesPayload(next);
        const prevNotes = toNotesPayload(prev);
        const consolidate = state.olderNoteIds.length > 0;
        const notesChanges = consolidate
          ? { ...nextNotes.base, ...nextNotes.extra }
          : { ...changedKeys(nextNotes.base, prevNotes.base), ...changedKeys(nextNotes.extra, prevNotes.extra) };
        if (Object.keys(notesChanges).length && (consolidate || !same(nextNotes, prevNotes))) {
          const notesId = state.notes?.id as string | undefined;
          const write = async (payload: Rec) => {
            if (notesId) {
              return supabase
                .from('candidate_interview_notes')
                .update({ ...payload, updated_at: new Date().toISOString() } as never)
                .eq('id', notesId);
            }
            return supabase.from('candidate_interview_notes').insert({
              ...nextNotes.base,
              ...payload,
              candidate_id: candidateId,
              recruiter_id: user.id,
              status: 'draft',
            } as never);
          };
          let { error } = await write(notesId ? notesChanges : { ...nextNotes.base, ...nextNotes.extra });
          if (error && isMissingColumnError(error)) {
            pending = true;
            ({ error } = await write(stripNewColumns(notesId ? notesChanges : nextNotes.base)));
          }
          if (error) throw error;
          if (consolidate) {
            const { error: supError } = await supabase
              .from('candidate_interview_notes')
              .update({ status: 'superseded' } as never)
              .in('id', state.olderNoteIds);
            if (supError) throw supError;
          }
        }

        // 3. Sprachen: komplett ersetzen, wenn geändert
        if (!same(next.languages, prev.languages)) {
          const { error: delError } = await supabase.from('candidate_languages').delete().eq('candidate_id', candidateId);
          if (delError) throw delError;
          const rows = next.languages
            .filter((l) => l.language.trim())
            .map((l) => ({ candidate_id: candidateId, language: l.language.trim(), proficiency: l.proficiency || null }));
          if (rows.length) {
            const { error: insError } = await supabase.from('candidate_languages').insert(rows as never);
            if (insError) throw insError;
          }
        }

        setPendingColumns(pending);
        await load();
        return { ok: true, pendingColumns: pending };
      } catch (err) {
        const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Speichern fehlgeschlagen';
        return { ok: false, pendingColumns: pending, error: message };
      }
    },
    [candidateId, user, load],
  );

  const save = useCallback(
    (next: DossierForm): Promise<DossierSaveResult> => {
      const run = queueRef.current.then(() => saveNow(next));
      queueRef.current = run.catch(() => undefined);
      return run;
    },
    [saveNow],
  );

  const markInterviewCompleted = useCallback(async () => {
    await queueRef.current;
    const notesId = stateRef.current.notes?.id as string | undefined;
    if (!notesId) return;
    await supabase.from('candidate_interview_notes').update({ status: 'completed' } as never).eq('id', notesId);
    await load();
  }, [load]);

  return {
    loading,
    form,
    readiness,
    candidateRow: state.candidate,
    hasNotes: !!state.notes,
    pendingColumns,
    save,
    reload: load,
    markInterviewCompleted,
  };
}
