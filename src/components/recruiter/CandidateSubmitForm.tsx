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
import { FIT_LABEL, byFit, fitOf, isFitting, type Fit } from '@/lib/matchFit';
import { usePoolFit } from '@/hooks/usePoolFit';
import { notifyClientAboutSubmission } from '@/lib/submissionNotify';

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

const CONFIRMED = 'per Klick bestätigt';

export function CandidateSubmitForm({ jobId, jobTitle, initialCandidateId, job = null, onSuccess }: CandidateSubmitFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [options, setOptions] = useState<Array<{ id: string; full_name: string; job_title: string | null }>>([]);
  const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId ?? null);
  const [newOpen, setNewOpen] = useState(false);
  const [dossier, setDossier] = useState<DossierForm | null>(null);
  const [readiness, setReadiness] = useState<{ isReady: boolean; done: number; total: number; missing: string[] } | null>(null);
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
    setDossier(null); setReadiness(null); setDuplicate(false); setMusts([]); setMustLoad('loading'); setMatchFit(null);
    setConfirmed(new Set()); setConsent(false);

    supabase.from('submissions').select('id').eq('job_id', jobId).eq('candidate_id', candidateId).limit(1)
      .then(({ data }) => { if (alive) setDuplicate((data?.length ?? 0) > 0); });

    fetchDossier(candidateId).then(({ form, readiness: r }) => {
      if (!alive) return;
      setDossier(form);
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
  }, [candidateId, jobId]);

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
    ...(salary?.status === 'hint' && salary.message.startsWith('Wunschgehalt über') ? [`Wunschgehalt über dem Budget (${salary.detail}).`] : []),
    ...(notMet.length ? [`Nicht belegt: ${notMet.join(' · ')}`] : []),
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
      toast({ title: 'Vorstellen hat nicht geklappt', description: error.message, variant: 'destructive' });
      return;
    }
    const id = (data as { id?: string } | null)?.id;
    if (id) void notifyClientAboutSubmission(id);
    toast({ title: 'Vorgestellt', description: `${dossier.full_name} für „${jobTitle}“. Der Kunde sieht das Profil jetzt anonym und bekommt eine Mail.` });
    setBusy(false);
    onSuccess();
  };

  const notice = dossier?.notice_period ? optionLabel(NOTICE_OPTIONS, dossier.notice_period) ?? null : null;
  const initials = (dossier?.full_name ?? '').split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-4">
      {!initialCandidateId && (
        <div className="space-y-2">
          <Label>Kandidat</Label>
          {fittingOptions.length > 0 ? (
            <Select value={candidateId ?? ''} onValueChange={setCandidateId}>
              <SelectTrigger><SelectValue placeholder="Passenden Kandidaten wählen …" /></SelectTrigger>
              <SelectContent>
                {fittingOptions.map((c) => {
                  const f = pool.fit.get(c.id);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.job_title ? ` · ${c.job_title}` : ''}{isFitting(f) ? ` · ${FIT_LABEL[f]}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
              {pool.checking ? <><Loader2 className="h-4 w-4 animate-spin" /> Passende Kandidaten werden gesucht …</> : 'Noch kein passender Kandidat in deinem Pool.'}
            </p>
          )}
          {fittingOptions.length > 0 && pool.checking && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Weitere Kandidaten werden geprüft …</p>
          )}
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setNewOpen(true)}>
            <UserPlus className="h-4 w-4" /> Neuen Kandidaten anlegen (danach Interview, dann vorstellen)
          </Button>
          <CvUploadDialog open={newOpen} onOpenChange={setNewOpen} />
        </div>
      )}

      {candidateId && !dossier && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Akte wird geladen …</div>
      )}

      {dossier && (
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials || '?'}</span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{dossier.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[dossier.job_title, dossier.experience_years ? `${dossier.experience_years} J.` : null, dossier.city || null,
                dossier.expected_salary ? formatEuro(dossier.expected_salary) : null, notice].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {duplicate && (
        <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>Dieser Kandidat ist für diese Stelle schon vorgestellt.</AlertDescription></Alert>
      )}

      {readiness && !readiness.isReady && (
        <Alert className="border-warning/40 bg-warning/10">
          <Lock className="h-4 w-4 text-warning" />
          <AlertDescription className="space-y-1.5">
            <p className="font-medium text-warning">Noch nicht bereit ({readiness.done} von {readiness.total})</p>
            <p className="text-sm text-foreground">
              {readiness.missing.length === 1 && readiness.missing[0] === 'Interview abgeschlossen'
                ? 'Das Interview ist noch nicht abgeschlossen. Der Kunde entscheidet vor allem nach deinem Gespräch.'
                : `Es fehlt noch: ${readiness.missing.join(', ')}. Du trägst es im Kandidatenprofil ein.`}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {ready && excluded && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">{dossier?.full_name.split(' ')[0] ?? 'Der Kandidat'} passt laut Matching nicht zu dieser Stelle{matchFit?.reason ? `: ${matchFit.reason}` : ''}.</p>
            <p className="mt-0.5 text-sm">Vorstellen ist deshalb gesperrt. Wenn du es besser weißt: im Profil unter „Passende Stellen“ → „ausgeschlossen“ → „Trotzdem vorschlagen“.</p>
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
                  <span>{w.message} Trotzdem vorstellen.</span>
                </label>
              ))}
            </div>
          )}

          {mustLoad === 'failed' && (
            <p className="text-xs text-muted-foreground">Die Passung konnte gerade nicht geprüft werden.</p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <span className="flex items-start gap-1.5"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Ich habe die ausdrückliche Einwilligung des Kandidaten zur Weitergabe seiner Daten (DSGVO Art. 6).</span>
          </label>

          <div className="flex justify-end">
            <Button type="button" onClick={() => void submit()} disabled={!canSubmit} className="gap-1.5">
              {busy || checkingFit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {checkingFit ? 'Passung wird geprüft …' : 'Jetzt vorstellen'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
