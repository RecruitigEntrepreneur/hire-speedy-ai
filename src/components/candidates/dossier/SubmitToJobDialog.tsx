import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, MapPin, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CandidateSubmitForm } from '@/components/recruiter/CandidateSubmitForm';
import { ActivateJobDialog, useActivationGate } from '@/components/recruiter/ActivateJobDialog';
import { getRecruiterCriteria } from '@/lib/recruiterBriefing';
import { mySearches, type MySearch } from '@/lib/jobSearch';
import { ClientQuestionFlow } from '@/components/recruiter/search/ClientQuestionFlow';

type JobRow = Record<string, unknown> & { id: string; title: string };

const REMOTE_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Vor Ort' };

function JobLine({ job, action }: { job: JobRow; action: React.ReactNode }) {
  const remote = typeof job.remote_type === 'string' ? REMOTE_LABELS[job.remote_type] ?? null : null;
  const budget = typeof job.salary_max === 'number' ? `${typeof job.salary_min === 'number' ? `${Math.round(job.salary_min / 1000)}–` : 'bis '}${Math.round(job.salary_max / 1000)}k` : null;
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{job.title}</span>
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
  const gate = useActivationGate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [submittedJobIds, setSubmittedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [job, setJob] = useState<JobRow | null>(null);
  const [activateFor, setActivateFor] = useState<JobRow | null>(null);
  const [questionFor, setQuestionFor] = useState<JobRow | null>(null);
  const [searches, setSearches] = useState<Map<string, MySearch>>(new Map());

  const preselected = useRef(false);

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

  // Vor der ersten Einreichung muss „Ist das schon dein Kunde?“ beantwortet sein.
  const choose = (j: JobRow) => {
    if (!searches.get(j.id)?.client_declaration) setQuestionFor(j);
    else setJob(j);
  };
  const active = filtered.filter((j) => gate.isActivated(j.id));
  const others = filtered.filter((j) => !gate.isActivated(j.id));
  const firstName = candidateName.split(' ')[0] || candidateName;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
                <DialogDescription>Bei Stellen, für die du noch nicht suchst, startet die Suche beim Einreichen mit.</DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Stelle suchen, z. B. Support" className="pl-8" autoFocus />
              </div>
              {loading || gate.loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Stellen werden geladen …
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Meine Suchen · {gate.activeCount} von {gate.maxSlots} offenen Suchen ohne Einreichung
                    </p>
                    {active.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        {query ? 'Keine deiner Suchen passt.' : 'Du suchst noch für keine Stelle.'}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {active.map((j) => (
                          <JobLine
                            key={j.id}
                            job={j}
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
                            action={
                              typeof j.paused_at === 'string' && j.paused_at ? (
                                <span className="shrink-0 text-xs text-muted-foreground">pausiert</span>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => setActivateFor(j)}>Suche starten</Button>
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
                <DialogTitle>Vorstellung vorbereiten</DialogTitle>
                <DialogDescription>{job.title} · Angaben prüfen und anschließend einreichen.</DialogDescription>
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
      <ActivateJobDialog
        job={activateFor}
        gate={gate}
        onClose={() => setActivateFor(null)}
        onActivated={(jobId) => {
          const activated = jobs.find((j) => j.id === jobId);
          // Die Kundenfrage kam schon im „Ich suche“-Dialog.
          if (activated) {
            setSearches((m) => new Map(m).set(jobId, { ...(m.get(jobId) as MySearch), client_declaration: m.get(jobId)?.client_declaration ?? 'no:none' }));
            setJob(activated);
          }
        }}
        forSubmission
      />
    </>
  );
}
