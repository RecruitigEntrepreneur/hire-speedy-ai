// Daten für einen Kandidaten bei einer Stelle (09.11.2026). Übernimmt die Logik des
// bisherigen CandidateSubmitForm unverändert: Akte und Bereitschaft, Lebenslauf,
// Doppelt-Prüfung, Matching (Muss-Kriterien, Sperrgrund), Passungs-Check mit
// Klick-Bestätigung harter Warnungen, Speichern samt Protokoll und Kundenmail.

import { useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useCandidateDossier } from '@/hooks/useCandidateDossier';
import { isMissingColumnError, redactIdentity } from '@/lib/candidateDossier';
import { computeFitCheck, toOverridesPayload, type FitCandidate } from '@/lib/fitCheck';
import { fetchMatchV41, type MatchV41Item } from '@/lib/matchV41';
import { fitOf, isFitting, type Fit } from '@/lib/matchFit';
import { notifyClientAboutSubmission } from '@/lib/submissionNotify';
import { submissionErrorText } from '@/lib/candidateCv';

type Load = 'idle' | 'loading' | 'ready' | 'failed';

// Geht als Begründung in fit_overrides (Datenbank): bleibt deutsch.
const CONFIRMED = 'per Klick bestätigt';

export function useVorstellung(jobId: string | null, candidateId: string | null, job: Record<string, unknown> | null) {
  const { user } = useAuth();
  const akte = useCandidateDossier(candidateId ?? undefined);
  const [duplicate, setDuplicate] = useState(false);
  const [match, setMatch] = useState<MatchV41Item | null>(null);
  const [matchLoad, setMatchLoad] = useState<Load>('idle');
  const [absagen, setAbsagen] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const bereit = !akte.loading && akte.readiness.isReady;

  useEffect(() => {
    setDuplicate(false); setMatch(null); setMatchLoad('idle'); setAbsagen([]); setConfirmed(new Set());
    if (!jobId || !candidateId || !user) return;
    let alive = true;
    supabase.from('submissions').select('id').eq('job_id', jobId).eq('candidate_id', candidateId).limit(1)
      .then(({ data }) => { if (alive) setDuplicate((data?.length ?? 0) > 0); });
    // Eigene Absagen bei dieser Stelle: der Grund des Kunden hilft beim nächsten Vorschlag.
    supabase.from('submissions').select('rejection_reason').eq('job_id', jobId).eq('recruiter_id', user.id)
      .not('rejection_reason', 'is', null).limit(10)
      .then(({ data }) => {
        if (!alive) return;
        const gruende = ((data ?? []) as Array<{ rejection_reason: string | null }>).map((r) => (r.rejection_reason ?? '').trim()).filter(Boolean);
        setAbsagen([...new Set(gruende)].slice(0, 2));
      });
    return () => { alive = false; };
  }, [jobId, candidateId, user]);

  // Matching (Muss-Kriterien, Sperrgrund) erst, wenn die Akte bereit ist: Zusatz, nie Sperre.
  useEffect(() => {
    if (!jobId || !candidateId || !bereit) return;
    let alive = true;
    setMatchLoad('loading');
    fetchMatchV41(candidateId, { jobIds: [jobId] })
      .then((res) => {
        if (!alive) return;
        const item = res.results.find((x) => x.job_id === jobId) ?? null;
        setMatch(item);
        setMatchLoad(item ? 'ready' : 'failed');
      })
      .catch(() => { if (alive) setMatchLoad('failed'); });
    return () => { alive = false; };
  }, [jobId, candidateId, bereit]);

  const f = akte.form;
  const fitCandidate: FitCandidate = {
    expected_salary: f.expected_salary ?? null,
    salary_minimum: f.salary_minimum ?? null,
    remote_preference: f.remote_preference ?? null,
    city: f.city || null,
    relocation_willing: f.relocation_willing ?? null,
    languages: f.languages ?? [],
    work_permit: f.work_permit ?? null,
  };
  const overrides = useMemo(() => Object.fromEntries([...confirmed].map((k) => [k, CONFIRMED])), [confirmed]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fit = useMemo(() => computeFitCheck(fitCandidate, job ?? {}, [], overrides), [JSON.stringify(fitCandidate), job, overrides]);
  const musts = useMemo(() => (match?.requirements ?? []).filter((q) => q.class === 'must'), [match]);
  const matchFit: Fit | null = match ? fitOf(match.tier, match.override?.decision) : null;
  const excluded = !!matchFit && !isFitting(matchFit);
  const sperrgrund = !!match?.frame.some((x) => x.key === 'blocked' && x.status === 'exclude');

  const toggleConfirmed = (rule: string, on: boolean) => setConfirmed((prev) => {
    const n = new Set(prev);
    if (on) n.add(rule); else n.delete(rule);
    return n;
  });

  /** Fehlt etwas, das das Vorstellen wirklich sperrt? */
  const blocked = !akte.loading && (!akte.readiness.isReady || duplicate || excluded);
  const pruefungLaeuft = bereit && matchLoad === 'loading';

  const submit = async (): Promise<{ id: string | null; error: string | null }> => {
    if (!user || !jobId || !candidateId || blocked || !fit.canSubmit) return { id: null, error: i18n.t('recruiterVorstellen:notReady') };
    const row = {
      job_id: jobId,
      candidate_id: candidateId,
      recruiter_id: user.id,
      status: 'submitted',
      consent_confirmed: true,
      consent_confirmed_at: new Date().toISOString(),
      // KI-Prüfung der Muss-Kriterien als Protokoll (Quelle „ki“), nicht als Einschätzung des Headhunters.
      criteria_assessment: musts.map((m) => ({ criterion: m.text, rating: m.status, evidence: m.evidence ? redactIdentity(m.evidence, f.full_name, f.company) : null, source: 'ki' })),
      fit_overrides: toOverridesPayload(fit),
    };
    let { data, error } = await supabase.from('submissions').insert(row as never).select('id').single();
    if (error && isMissingColumnError(error)) {
      // Spalten noch nicht migriert: ohne Protokoll einreichen
      const { criteria_assessment: _c, fit_overrides: _o, ...rest } = row;
      ({ data, error } = await supabase.from('submissions').insert(rest as never).select('id').single());
    }
    if (error) return { id: null, error: submissionErrorText(error, error.message) };
    const id = (data as { id?: string } | null)?.id ?? null;
    if (id) void notifyClientAboutSubmission(id);
    return { id, error: null };
  };

  return {
    akte,
    duplicate,
    match,
    matchLoad,
    musts,
    excluded,
    sperrgrund,
    absagen,
    fit,
    confirmed,
    toggleConfirmed,
    blocked,
    pruefungLaeuft,
    submit,
  };
}

export type Vorstellung = ReturnType<typeof useVorstellung>;
