import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Loader2, MapPin, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CandidateSubmitForm } from '@/components/recruiter/CandidateSubmitForm';
import { useActivationGate } from '@/components/recruiter/ActivateJobDialog';
import { getRecruiterCriteria } from '@/lib/recruiterBriefing';
import { mySearches, type MySearch } from '@/lib/jobSearch';
import { earningFor } from '@/lib/submissionNotify';
import { ClientQuestionFlow } from '@/components/recruiter/search/ClientQuestionFlow';
import { useMatchV41 } from '@/hooks/useMatchV41';
import { FIT_LABEL, fitLine, fitOf, isFitting, type Fit } from '@/lib/matchFit';
import { useVerdecke } from '@/lib/honorarVerdeckt';

type JobRow = Record<string, unknown> & { id: string; title: string };

const REMOTE_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Vor Ort' };

function JobLine({ job, action, note, badge, detail }: { job: JobRow; action: ReactNode; note?: string | null; badge?: ReactNode; detail?: string | null }) {
  const remote = typeof job.remote_type === 'string' ? REMOTE_LABELS[job.remote_type] ?? null : null;
  const budget = typeof job.salary_max === 'number' ? `${typeof job.salary_min === 'number' ? `${Math.round(job.salary_min / 1000)}–` : 'bis '}${Math.round(job.salary_max / 1000)}k` : null;
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {job.title}
          {badge && <> {badge}</>}
          {note && <span className="font-normal text-muted-foreground"> · {note}</span>}
        </span>
        {detail && <span className="block truncate text-xs text-foreground/80">{detail}</span>}
        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {typeof job.location === 'string' && job.location && (
            <>
              <MapPin className="h-3 w-3" /> {job.location}
            </>
          )}
          {remote && <span>· {remote}</span>}
          {budget && <span>· {budget}</span>}
        </span>
      </span>
      {action}
    </li>
  );
}

/**
 * Einreichen aus dem Kandidatenprofil: erst Stelle wählen, dann das bestehende
 * Einreichformular mit vorausgewähltem Kandidaten. Bei Stellen ohne Suche startet
 * die Suche beim Einreichen mit; vor der ersten Einreichung kommt die Kundenfrage.
 */
export function SubmitToJobDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onSubmitted,
  initialJobId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onSubmitted: () => void;
  /** Aus „Passende Stellen": diese Stelle gleich öffnen, wenn sie aktiviert ist. */
  initialJobId?: string | null;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const gate = useActivationGate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [submittedJobIds, setSubmittedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const verdecke = useVerdecke();
  const [job, setJob] = useState<JobRow | null>(null);
  const [questionFor, setQuestionFor] = useState<JobRow | null>(null);
  const [searches, setSearches] = useState<Map<string, MySearch>>(new Map());

  const preselected = useRef(false);
  // Nur Stellen, zu denen der Kandidat laut Matching passt – dieselben wie unter
  // „Passende Stellen“ im Profil (14.10.2026). Fällt das Matching aus, alle zeigen.
  const match = useMatchV41(open ? candidateId : undefined);
  const fitByJob = useMemo(
    () => new Map<string, Fit>(match.rows.map((r) => [r.job_id, fitOf(r.tier, r.override?.decision)])),
    [match.rows],
  );
  const matchDown = match.unavailable || !!match.error;
  const rowByJob = useMemo(() => new Map(match.rows.map((r) => [r.job_id, r])), [match.rows]);
  const shows = (j: JobRow) => matchDown || submittedJobIds.has(j.id) || isFitting(fitByJob.get(j.id));

  useEffect(() => {
    if (!open || !user) return;
    preselected.current = false;
    setJob(null);
    setQuestionFor(null);
    setQuery('');
    setLoading(true);
    gate.refetch();
    mySearches().then((rows) => setSearches(new Map((rows ?? []).map((r) => [r.job_id, r])))).catch(() => undefined);
    Promise.all([
      supabase.from('recruiter_jobs_view').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      supabase.from('submissions').select('job_id').eq('candidate_id', candidateId).eq('recruiter_id', user.id),
    ]).then(([jobsResult, subsResult]) => {
      setJobs(((jobsResult.data ?? []) as unknown as JobRow[]).filter((j) => j.id && j.title));
      setSubmittedJobIds(new Set(((subsResult.data ?? []) as Array<{ job_id: string | null }>).map((s) => s.job_id ?? '').filter(Boolean)));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, candidateId]);

  useEffect(() => {
    if (!open || !initialJobId || preselected.current || loading || gate.loading || jobs.length === 0) return;
    preselected.current = true;
    const found = jobs.find((j) => j.id === initialJobId);
    if (found && gate.isActivated(found.id) && !submittedJobIds.has(found.id)) setJob(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialJobId, loading, gate.loading, jobs, submittedJobIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => [j.title, j.location, j.industry].some((v) => typeof v === 'string' && v.toLowerCase().includes(q)));
  }, [jobs, query]);

  // Vor der ersten Einreichung muss „Kennst du X schon?“ beantwortet sein.
  const choose = (j: JobRow) => {
    if (!searches.get(j.id)?.client_declaration) setQuestionFor(j);
    else setJob(j);
  };
  const active = filtered.filter((j) => gate.isActivated(j.id) && shows(j));
  const others = filtered.filter((j) => !gate.isActivated(j.id) && shows(j));
  const fitBadge = (j: JobRow) => {
    const f = fitByJob.get(j.id);
    return isFitting(f) ? <Badge variant="outline" className="align-middle text-[10px] font-normal">{FIT_LABEL[f]}</Badge> : null;
  };
  const fitDetail = (j: JobRow) => {
    const r = rowByJob.get(j.id);
    return r ? fitLine(r) || null : null;
  };
  // Neue Stelle: erst ansehen (Stellenseite mit diesem Kandidaten), dann suchen (15.10.2026)
  const view = (j: JobRow) => {
    onOpenChange(false);
    navigate(`/recruiter/jobs/${j.id}?fuer=${candidateId}`);
  };
  const firstName = candidateName.split(' ')[0] || candidateName;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl grid-cols-[minmax(0,1fr)] overflow-y-auto">
          {questionFor && !job ? (
            <>
              <DialogHeader>
                <DialogTitle>{questionFor.title}</DialogTitle>
                <DialogDescription>Bitte vor der ersten Einreichung beantworten.</DialogDescription>
              </DialogHeader>
              <ClientQuestionFlow
                jobId={questionFor.id}
                jobTitle={questionFor.title}
                companyName={typeof questionFor.company_name === 'string' ? questionFor.company_name : searches.get(questionFor.id)?.company_name ?? null}
                onDone={(answer) => {
                  const next = questionFor;
                  setQuestionFor(null);
                  setSearches((m) => new Map(m).set(next.id, { ...(m.get(next.id) as MySearch), client_declaration: answer === 'no' ? 'no:none' : 'client:pending' }));
                  if (answer === 'direct_position') return; // Suche ruht während der Prüfung
                  setJob(next);
                }}
              />
            </>
          ) : !job ? (
            <>
              <DialogHeader>
                <DialogTitle>{firstName} auf eine Stelle einreichen</DialogTitle>
                <DialogDescription>Nur Stellen, zu denen {firstName} laut Matching passt. Neue Stellen erst ansehen, dann suchen.</DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Stelle suchen, z. B. Support" className="pl-8" autoFocus />
              </div>
              {loading || gate.loading || (match.loading && !matchDown) ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Passende Stellen werden geladen …
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Meine Suchen · {gate.activeCount} von {gate.maxSlots} Plätzen belegt
                    </p>
                    {active.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        {query ? 'Keine deiner Suchen passt.' : filtered.some((j) => gate.isActivated(j.id)) ? `Keine deiner Suchen passt zu ${firstName}.` : 'Du suchst noch für keine Stelle.'}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {active.map((j) => (
                          <JobLine
                            key={j.id}
                            job={j}
                            badge={fitBadge(j)}
                            detail={submittedJobIds.has(j.id) ? null : fitDetail(j)}
                            note={(searches.get(j.id)?.submissions ?? 0) > 0 ? `${searches.get(j.id)?.submissions} eingereicht` : null}
                            action={
                              submittedJobIds.has(j.id) ? (
                                <Badge variant="secondary" className="shrink-0 text-xs">Schon eingereicht</Badge>
                              ) : (
                                <Button size="sm" onClick={() => choose(j)}>Wählen</Button>
                              )
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                  {others.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground">Weitere offene Stellen</p>
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {others.map((j) => (
                          <JobLine
                            key={j.id}
                            job={j}
                            badge={fitBadge(j)}
                            detail={fitDetail(j)}
                            action={
                              typeof j.paused_at === 'string' && j.paused_at ? (
                                <span className="shrink-0 text-xs text-muted-foreground">pausiert</span>
                              ) : (
                                <Button size="sm" variant="outline" className="shrink-0 gap-0.5" onClick={() => view(j)}>Ansehen<ChevronRight className="h-3.5 w-3.5" /></Button>
                              )
                            }
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{firstName} bei „{job.title}“ vorstellen</DialogTitle>
                <DialogDescription>
                  {[typeof job.industry === 'string' ? job.industry : null, typeof job.location === 'string' ? job.location : null,
                    earningFor(job) ? verdecke(`≈ ${earningFor(job)!.toLocaleString('de-DE')} € für dich`) : null].filter(Boolean).join(' · ')}
                </DialogDescription>
              </DialogHeader>
              <Button variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setJob(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Andere Stelle wählen
              </Button>
              <CandidateSubmitForm
                jobId={job.id}
                jobTitle={job.title}
                job={job}
                mustHaves={getRecruiterCriteria(job as never).required}
                initialCandidateId={candidateId}
                onSuccess={() => {
                  onOpenChange(false);
                  onSubmitted();
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
