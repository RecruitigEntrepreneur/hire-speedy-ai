// „Kandidat vorstellen“ (Entscheidung 13./14.10.2026, Variante 1).
//
// Vorher: Kandidat wählen, 7 Muss-Kriterien je „erfüllt/teilweise/nicht“ + Beleg,
// Pflichttext „Warum passt“, danach ein eigener Prüfschritt. Jetzt:
//   - Die Muss-Kriterien prüft die KI unsichtbar im Hintergrund (Match V4.1) und
//     das Ergebnis wird mitgespeichert. Angezeigt wird nur ein echter Stolperstein
//     (Gehalt über Budget, Muss-Kriterium fehlt), gesperrt wird nichts
//     (DSGVO Art. 22, EU AI Act).
//   - Keine Argumente für den Kunden mehr (Entscheidung 14.10.2026: der Kunde sieht sie
//     nirgends); der Kunde bekommt eine Mail mit Eckdaten (submission-notify).
//   - Harte Fakten-Warnungen (Schmerzgrenze über Budget, nur Remote bei Vor-Ort-
//     Stelle) bestätigt der Headhunter mit einem Klick statt mit einem Text.
//   - Ein Fenster, kein Prüfschritt: Häkchen setzen, vorstellen.
//   - Unpassende Kandidaten (Matching „ausgeschlossen“) werden nicht angeboten; kommt
//     doch einer an, ist Vorstellen gesperrt (Ausnahme: „Trotzdem vorschlagen“ im Profil).

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Lock, Shield, UserPlus, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { fetchDossier } from '@/hooks/useCandidateDossier';
import { DossierForm, NOTICE_OPTIONS, formatEuro, isMissingColumnError, optionLabel, redactIdentity } from '@/lib/candidateDossier';
import { FitCandidate, computeFitCheck, toOverridesPayload } from '@/lib/fitCheck';
import { fetchMatchV41, type MatchRequirementRow } from '@/lib/matchV41';
import { byFit, fitOf, isFitting, type Fit } from '@/lib/matchFit';
import { usePoolFit } from '@/hooks/usePoolFit';
import { notifyClientAboutSubmission } from '@/lib/submissionNotify';
import { SubmitCvCheck } from './SubmitCvCheck';
import { LebenslaufAnfragenFenster } from './termin/LebenslaufAnfragenFenster';
import { compareCvWithDossier, submissionErrorText, type CurrentCv } from '@/lib/candidateCv';

interface CandidateSubmitFormProps {
  jobId: string;
  jobTitle: string;
  /** Nicht mehr genutzt (die KI prüft die Muss-Kriterien); bleibt für die Aufrufer. */
  mustHaves?: string[];
  /** Aus dem Kandidatenprofil: Kandidat steht fest, keine Auswahl. */
  initialCandidateId?: string;
  /** Stelle aus recruiter_jobs_view für den Passungs-Check (Budget, Arbeitsmodell, Ort, Sprachen). */
  job?: Record<string, unknown> | null;
  onSuccess: () => void;
}

type Load = 'loading' | 'ready' | 'failed';

// Wird mit der Einreichung gespeichert (fit_overrides) und bleibt deshalb deutsch.
const CONFIRMED = 'per Klick bestätigt';

export function CandidateSubmitForm({ jobId, jobTitle, initialCandidateId, job = null, onSuccess }: CandidateSubmitFormProps) {
  // recruiterJobs: Texte des Passungs-Checks (lib/fitCheck) in der Sprache der Oberfläche.
  const { t } = useTranslation(['recruiterSubmissions', 'recruiterJobs']);
  const { user } = useAuth();
  const { toast } = useToast();
  const [options, setOptions] = useState<Array<{ id: string; full_name: string; job_title: string | null }>>([]);
  const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId ?? null);
  const [newOpen, setNewOpen] = useState(false);
  const [dossier, setDossier] = useState<DossierForm | null>(null);
  const [readiness, setReadiness] = useState<{ isReady: boolean; done: number; total: number; missing: string[] } | null>(null);
  // Lebenslauf (Pflicht seit 12.10.2026): fehlt er, ist Vorstellen gesperrt, hochladen geht direkt hier.
  const [cv, setCv] = useState<CurrentCv | null>(null);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [anfragenOpen, setAnfragenOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [duplicate, setDuplicate] = useState(false);
  const [musts, setMusts] = useState<MatchRequirementRow[]>([]);
  const [mustLoad, setMustLoad] = useState<Load>('loading');
  const [matchFit, setMatchFit] = useState<{ fit: Fit; reason: string | null } | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auswahl nur, wenn das Fenster von der Stellenseite kommt.
  useEffect(() => {
    if (initialCandidateId || !user) return;
    supabase.from('candidates').select('id, full_name, job_title').eq('recruiter_id', user.id).order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => setOptions((data ?? []) as Array<{ id: string; full_name: string; job_title: string | null }>));
  }, [user, initialCandidateId]);
  // Auswahl nur mit passenden Kandidaten (Matching je Stelle, fehlende im Hintergrund geprüft).
  const pool = usePoolFit(initialCandidateId ? null : jobId, options.map((o) => o.id));
  const fittingOptions = options
    .filter((o) => isFitting(pool.fit.get(o.id)))
    .sort((a, b) => byFit(pool.fit.get(a.id)!, pool.fit.get(b.id)!));

  useEffect(() => {
    if (!candidateId) return;
    let alive = true;
    setDossier(null); setReadiness(null); setCv(null); setDuplicate(false); setMusts([]); setMustLoad('loading'); setMatchFit(null);
    setConfirmed(new Set()); setConsent(false);

    supabase.from('submissions').select('id').eq('job_id', jobId).eq('candidate_id', candidateId).limit(1)
      .then(({ data }) => { if (alive) setDuplicate((data?.length ?? 0) > 0); });

    fetchDossier(candidateId).then(({ form, readiness: r, cv: aktuell }) => {
      if (!alive) return;
      setDossier(form);
      setCv(aktuell);
      setReadiness({ isReady: r.isReady, done: r.done, total: r.total, missing: r.missing.map((m) => m.label) });
      if (!r.isReady) return;
      // KI-Prüfung im Hintergrund: Zusatz, nie Sperre.
      fetchMatchV41(candidateId, { jobIds: [jobId] })
        .then((res) => {
          if (!alive) return;
          const item = res.results.find((x) => x.job_id === jobId);
          setMusts(item ? item.requirements.filter((q) => q.class === 'must') : []);
          setMatchFit(item ? { fit: fitOf(item.tier, item.override?.decision), reason: item.exclusion?.text ?? null } : null);
          setMustLoad(item ? 'ready' : 'failed');
        })
        .catch(() => { if (alive) setMustLoad('failed'); });
    });
    return () => { alive = false; };
  }, [candidateId, jobId, reload]);

  const fitCandidate: FitCandidate = {
    expected_salary: dossier?.expected_salary ?? null,
    salary_minimum: dossier?.salary_minimum ?? null,
    remote_preference: dossier?.remote_preference ?? null,
    city: dossier?.city || null,
    relocation_willing: dossier?.relocation_willing ?? null,
    languages: dossier?.languages ?? [],
    work_permit: dossier?.work_permit ?? null,
  };
  const overrides = useMemo(() => Object.fromEntries([...confirmed].map((k) => [k, CONFIRMED])), [confirmed]);
  const fit = useMemo(() => computeFitCheck(fitCandidate, job ?? {}, [], overrides), [JSON.stringify(fitCandidate), job, overrides]);
  // Nur echte Stolpersteine zeigen (Entscheidung 14.10.2026): „nicht eingetragen“ und
  // „steht nirgends“ sind kein Problem für den Headhunter, nur Rauschen.
  const salary = fit.items.find((i) => i.key === 'gehalt');
  const notMet = musts.filter((m) => m.status === 'not_met').map((m) => m.text);
  const problems = [
    ...(salary?.status === 'hint' && [t('recruiterJobs:fitCheck.salary.wishOverBudget'), t('recruiterJobs:fitCheck.salary.wishOverBudgetUnknown')].includes(salary.message) ? [t('submit.salaryOver', { detail: salary.detail })] : []),
    ...(notMet.length ? [t('submit.notMet', { list: notMet.join(' · ') })] : []),
  ];
  const excluded = !!matchFit && !isFitting(matchFit.fit);

  const ready = !!readiness?.isReady && !duplicate;
  const checkingFit = ready && mustLoad === 'loading';
  const canSubmit = ready && consent && fit.canSubmit && !excluded && !checkingFit && !busy;

  const submit = async () => {
    if (!user || !candidateId || !dossier || !canSubmit) return;
    setBusy(true);
    const row = {
      job_id: jobId,
      candidate_id: candidateId,
      recruiter_id: user.id,
      status: 'submitted',
      consent_confirmed: true,
      consent_confirmed_at: new Date().toISOString(),
      // KI-Prüfung der Muss-Kriterien als Protokoll (Quelle „ki“), nicht als Einschätzung des Headhunters.
      criteria_assessment: musts.map((m) => ({ criterion: m.text, rating: m.status, evidence: m.evidence ? redactIdentity(m.evidence, dossier.full_name, dossier.company) : null, source: 'ki' })),
      fit_overrides: toOverridesPayload(fit),
    };
    let { data, error } = await supabase.from('submissions').insert(row as never).select('id').single();
    if (error && isMissingColumnError(error)) {
      // Spalten noch nicht migriert: ohne Protokoll einreichen
      const { criteria_assessment: _c, fit_overrides: _o, ...rest } = row;
      ({ data, error } = await supabase.from('submissions').insert(rest as never).select('id').single());
    }
    if (error) {
      setBusy(false);
      toast({ title: t('submit.failTitle'), description: submissionErrorText(error, error.message), variant: 'destructive' });
      return;
    }
    const id = (data as { id?: string } | null)?.id;
    if (id) void notifyClientAboutSubmission(id);
    toast({ title: t('submit.doneTitle'), description: t('submit.doneText', { name: dossier.full_name, job: jobTitle }) });
    setBusy(false);
    onSuccess();
  };

  const notice = dossier?.notice_period ? optionLabel(NOTICE_OPTIONS, dossier.notice_period) ?? null : null;
  const firstName = dossier ? dossier.full_name.split(' ')[0] || dossier.full_name : null;
  const initials = (dossier?.full_name ?? '').split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-4">
      {!initialCandidateId && (
        <div className="space-y-2">
          <Label>{t('submit.candidate')}</Label>
          {fittingOptions.length > 0 ? (
            <Select value={candidateId ?? ''} onValueChange={setCandidateId}>
              <SelectTrigger><SelectValue placeholder={t('submit.choose')} /></SelectTrigger>
              <SelectContent>
                {fittingOptions.map((c) => {
                  const f = pool.fit.get(c.id);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.job_title ? ` · ${c.job_title}` : ''}{isFitting(f) ? ` · ${t(`submit.fit.${f}`)}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
              {pool.checking ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('submit.searching')}</> : t('submit.noneFitting')}
            </p>
          )}
          {fittingOptions.length > 0 && pool.checking && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {t('submit.checkingMore')}</p>
          )}
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setNewOpen(true)}>
            <UserPlus className="h-4 w-4" /> {t('submit.createNew')}
          </Button>
          <CvUploadDialog open={newOpen} onOpenChange={setNewOpen} />
        </div>
      )}

      {candidateId && !dossier && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t('submit.loadingDossier')}</div>
      )}

      {dossier && (
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials || '?'}</span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{dossier.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[dossier.job_title, dossier.experience_years ? t('submit.years', { count: dossier.experience_years }) : null, dossier.city || null,
                dossier.expected_salary ? formatEuro(dossier.expected_salary) : null, notice].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {duplicate && (
        <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{t('submit.duplicate')}</AlertDescription></Alert>
      )}

      {dossier && candidateId && (readiness?.isReady || cv || (readiness?.missing.length === 1 && readiness.missing[0] === 'Lebenslauf')) && (
        <SubmitCvCheck cv={cv} loading={false} mismatches={cv ? compareCvWithDossier(cv.extracted, dossier, [], new Date(cv.created_at)) : []} onUpload={() => setCvUploadOpen(true)}
          anfrage={{ label: t('submit.askCv', { name: dossier.full_name.split(' ')[0] || dossier.full_name }), onClick: () => setAnfragenOpen(true) }} />
      )}
      {candidateId && (
        <CvUploadDialog open={cvUploadOpen} onOpenChange={setCvUploadOpen} existingCandidateId={candidateId} onCandidateCreated={() => setReload((n) => n + 1)} />
      )}
      {candidateId && dossier && (
        <LebenslaufAnfragenFenster open={anfragenOpen} onOpenChange={setAnfragenOpen}
          candidate={{ id: candidateId, vorname: dossier.full_name.split(' ')[0] || dossier.full_name, email: dossier.email || null }} />
      )}

      {readiness && !readiness.isReady && !(readiness.missing.length === 1 && readiness.missing[0] === 'Lebenslauf') && (
        <Alert className="border-warning/40 bg-warning/10">
          <Lock className="h-4 w-4 text-warning" />
          <AlertDescription className="space-y-1.5">
            <p className="font-medium text-warning">{t('submit.notReady', { done: readiness.done, total: readiness.total })}</p>
            <p className="text-sm text-foreground">
              {readiness.missing.length === 1 && readiness.missing[0] === 'Interview abgeschlossen'
                ? t('submit.interviewOpen')
                : t('submit.missing', { list: readiness.missing.join(', ') })}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {ready && excluded && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">{firstName
              ? (matchFit?.reason ? t('submit.excludedNamedReason', { name: firstName, reason: matchFit.reason }) : t('submit.excludedNamed', { name: firstName }))
              : (matchFit?.reason ? t('submit.excludedAnonReason', { reason: matchFit.reason }) : t('submit.excludedAnon'))}</p>
            <p className="mt-0.5 text-sm">{t('submit.excludedHint')}</p>
          </AlertDescription>
        </Alert>
      )}

      {ready && !excluded && (
        <>
          {/* Stolpersteine: nur wenn es wirklich eins gibt */}
          {(problems.length > 0 || fit.warnings.length > 0) && (
            <div className="space-y-1.5">
              {problems.map((p) => <p key={p} className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">{p}</p>)}
              {fit.warnings.map((w) => (
                <label key={w.rule} className="flex cursor-pointer items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <Checkbox className="mt-0.5" checked={confirmed.has(w.rule)} onCheckedChange={(v) => setConfirmed((prev) => { const n = new Set(prev); if (v === true) n.add(w.rule); else n.delete(w.rule); return n; })} />
                  <span>{t('submit.anyway', { message: w.message })}</span>
                </label>
              ))}
            </div>
          )}

          {mustLoad === 'failed' && (
            <p className="text-xs text-muted-foreground">{t('submit.fitFailed')}</p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <span className="flex items-start gap-1.5"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t('submit.consent')}</span>
          </label>

          <div className="flex justify-end">
            <Button type="button" onClick={() => void submit()} disabled={!canSubmit} className="gap-1.5">
              {busy || checkingFit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {checkingFit ? t('submit.checkingFit') : t('submit.submitNow')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
