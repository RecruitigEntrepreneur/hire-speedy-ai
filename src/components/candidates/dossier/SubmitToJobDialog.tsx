import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Lock, MapPin, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CandidateSubmitForm } from '@/components/recruiter/CandidateSubmitForm';
import { ActivateJobDialog, useActivationGate } from '@/components/recruiter/ActivateJobDialog';
import { getRecruiterCriteria } from '@/lib/recruiterBriefing';

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
 * Einreichformular mit vorausgewähltem Kandidaten. Wählbar sind nur aktivierte
 * Stellen ("Ich suche"); die übrigen lassen sich hier direkt aktivieren.
 */
export function SubmitToJobDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const gate = useActivationGate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [submittedJobIds, setSubmittedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [job, setJob] = useState<JobRow | null>(null);
  const [activateFor, setActivateFor] = useState<JobRow | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setJob(null);
    setQuery('');
    setLoading(true);
    gate.refetch();
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => [j.title, j.location, j.industry].some((v) => typeof v === 'string' && v.toLowerCase().includes(q)));
  }, [jobs, query]);

  const active = filtered.filter((j) => gate.isActivated(j.id));
  const others = filtered.filter((j) => !gate.isActivated(j.id));
  const firstName = candidateName.split(' ')[0] || candidateName;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {!job ? (
            <>
              <DialogHeader>
                <DialogTitle>{firstName} auf eine Stelle einreichen</DialogTitle>
                <DialogDescription>Einreichen geht nur auf Stellen, die du aktiviert hast.</DialogDescription>
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
                      Meine aktiven Stellen · {gate.activeCount} von {gate.maxSlots} Plätzen belegt
                    </p>
                    {active.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        {query ? 'Keine aktive Stelle passt zur Suche.' : 'Du hast noch keine Stelle aktiviert.'}
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
                                <Button size="sm" onClick={() => setJob(j)}>Wählen</Button>
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
                      {!gate.canActivate && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Alle Plätze belegt. Eine weitere Stelle kannst du aktivieren, sobald ein Platz frei wird.
                        </p>
                      )}
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {others.map((j) => (
                          <JobLine
                            key={j.id}
                            job={j}
                            action={
                              gate.canActivate ? (
                                <Button size="sm" variant="outline" onClick={() => setActivateFor(j)}>Aktivieren</Button>
                              ) : (
                                <span className="shrink-0 text-xs text-muted-foreground">Keine Plätze frei</span>
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
          if (activated) setJob(activated);
        }}
      />
    </>
  );
}
