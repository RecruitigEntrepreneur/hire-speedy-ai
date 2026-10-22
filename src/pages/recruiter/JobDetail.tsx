import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CandidateSubmitForm } from '@/components/recruiter/CandidateSubmitForm';
import { AnonymousExposeDialog } from '@/components/recruiter/AnonymousExposeDialog';
import { JobCandidateProcessCards, type JobSubmission } from '@/components/recruiter/JobCandidateProcessCards';
import { RecruiterJobWorkspace, type WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { getRecruiterCriteria } from '@/lib/recruiterBriefing';
import { ActivateJobDialog, useActivationGate } from '@/components/recruiter/ActivateJobDialog';
import { EndSearchDialog, JobPausedBadge, SearchHeroAction, SearchHeroStatus, SearchMobileAction, SearchQuestionDialog, useMySearch } from '@/components/recruiter/search/SearchHero';
import { CandidateJobStrip } from '@/components/recruiter/search/CandidateJobStrip';
import { useCandidateForJob } from '@/hooks/useCandidateForJob';
import { useToast } from '@/hooks/use-toast';
import { endJobSearch, errorText, fmtDayShort } from '@/lib/jobSearch';

type RecruiterJob = WorkspaceJob & { company_revealed?: boolean; paused_at?: string | null; pause_until?: string | null };
type Submission = JobSubmission & { company_revealed: boolean; full_access_granted: boolean };

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<RecruiterJob | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showExpose, setShowExpose] = useState(false);
  // „Ich suche“ aus der Karte (search) oder aus „Vorstellung vorbereiten“ ohne Suche (submit)
  const [activateMode, setActivateMode] = useState<'search' | 'submit' | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  // Frage kam über „Vorstellung vorbereiten“: danach gleich weiter zum Einreichen
  const [submitAfterQuestion, setSubmitAfterQuestion] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const { toast } = useToast();
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const gate = useActivationGate();
  const search = useMySearch(id, revision);
  // Aus „Ansehen“ in der Stellenwahl eines Kandidaten (?fuer=<id>): Streifen + Kandidat vorausgewählt
  const [searchParams] = useSearchParams();
  const fuer = searchParams.get('fuer');
  const forCtx = useCandidateForJob(fuer, id, revision);
  const forCandidate = forCtx.usable ? forCtx.candidate : null;
  const jobPaused = !!job?.paused_at;
  // Einreichen nur mit laufender Suche, nicht während einer Pause und erst nach der Kundenfrage
  const openSubmit = useCallback(() => {
    if (jobPaused) {
      toast({ title: job?.pause_until ? `Pausiert bis ${fmtDayShort(job.pause_until)}` : 'Stelle pausiert', description: 'Der Kunde hat die Suche angehalten. Bis dahin kannst du nicht einreichen.' });
      return;
    }
    if (search.row?.status === 'paused') {
      toast({ title: 'Deine Suche ruht', description: 'Matchunt prüft deine Angabe „Stelle schon direkt“.' });
      return;
    }
    if (!search.searching && !(id && gate.isActivated(id))) { setActivateMode('submit'); return; }
    if (search.openQuestion) { setSubmitAfterQuestion(true); setShowQuestion(true); return; }
    setShowSubmit(true);
  }, [id, gate, search.row, search.searching, search.openQuestion, jobPaused, job?.pause_until, toast]);
  const endSearch = async () => {
    if (!id) return;
    setEnding(true);
    try {
      await endJobSearch(id);
      toast({ title: 'Suche beendet' });
      setShowEnd(false);
      gate.refetch();
      void search.reload();
    } catch (err) {
      toast({ title: 'Beenden hat nicht geklappt', description: errorText(err), variant: 'destructive' });
    } finally {
      setEnding(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setJob(null);
    setSubmissions([]);
    setShowSubmit(false);
    setShowExpose(false);
    const load = async () => {
      if (!id || !user?.id) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const [jobResult, submissionsResult] = await Promise.all([
          supabase.from('recruiter_jobs_view').select('*').eq('id', id).single(),
          supabase.from('submissions').select('id, candidate_id, status, stage, submitted_at, match_score, company_revealed, full_access_granted, candidates (full_name, email, job_title)').eq('job_id', id).eq('recruiter_id', user.id).order('submitted_at', { ascending: false }),
        ]);
        if (jobResult.error) throw jobResult.error;
        if (submissionsResult.error) throw submissionsResult.error;
        if (cancelled) return;
        // The view carries newer intake columns than the generated client type.
        // It remains the sole authority for masking and access to company data.
        setJob(jobResult.data as unknown as RecruiterJob);
        setSubmissions((submissionsResult.data ?? []) as Submission[]);
      } catch (cause) {
        console.error('Job briefing could not be loaded:', cause);
        if (!cancelled) setError('Das Mandat konnte nicht vollständig geladen werden. Bitte versuche es erneut.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id, user?.id, revision]);

  if (loading) return <DashboardLayout fluid><div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Mandatsbriefing wird geladen …</div></DashboardLayout>;
  if (error || !job) return <DashboardLayout fluid><div className="mx-auto max-w-lg space-y-5 py-16 text-center"><h1 className="text-xl font-semibold">Mandat nicht verfügbar</h1><p role="alert" className="text-sm text-muted-foreground">{error || 'Die Stelle ist nicht veröffentlicht oder für deinen Zugang nicht verfügbar.'}</p><div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={reload}><RotateCcw />Erneut laden</Button><Button variant="ghost" asChild><Link to="/recruiter/jobs"><ArrowLeft />Zurück zu Jobs</Link></Button></div></div></DashboardLayout>;

  const companyRevealed = job.company_revealed === true || submissions.some(submission => submission.company_revealed);
  const fullAccess = submissions.some(submission => submission.full_access_granted);
  const companyName = search.row?.company_name ?? (companyRevealed ? job.company_name ?? null : null);
  const startSearch = () => setActivateMode('search');
  return <DashboardLayout fluid>
    {/* Bereich für den Rundgang (Kopf, Reiter, Aktionen); „contents“ lässt das Layout unberührt. */}
    <div data-tour-scope="job" className="contents">
      {fuer && <CandidateJobStrip ctx={forCtx} candidateId={fuer} />}
      <RecruiterJobWorkspace key={job.id} job={job} companyRevealed={companyRevealed} fullAccess={fullAccess} submissionCount={submissions.length} onSubmit={openSubmit} onExpose={() => setShowExpose(true)} candidates={<JobCandidateProcessCards submissions={submissions} onOpenSubmitForm={openSubmit} />}
        headerBadge={jobPaused ? <JobPausedBadge until={job.pause_until} /> : null}
        heroAction={<SearchHeroAction search={search} jobPaused={jobPaused} pausedUntil={job.pause_until} onStart={forCandidate ? openSubmit : startSearch} onSubmit={openSubmit} candidateName={forCandidate?.firstName} />}
        heroStatus={<SearchHeroStatus search={search} jobPaused={jobPaused} pausedUntil={job.pause_until} companyName={companyName} capacity={{ used: gate.activeCount, limit: gate.maxSlots }} onAnswer={() => { setSubmitAfterQuestion(false); setShowQuestion(true); }} onEnd={() => setShowEnd(true)} />}
        kannPosten={search.searching && !jobPaused}
        mobileAction={<SearchMobileAction search={search} jobPaused={jobPaused} pausedUntil={job.pause_until} onStart={forCandidate ? openSubmit : startSearch} onSubmit={openSubmit} candidateName={forCandidate?.firstName} />} />
    </div>
    <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{forCandidate ? forCandidate.firstName : 'Kandidat'} bei „{job.title}“ vorstellen</DialogTitle>
          <DialogDescription>{forCandidate ? 'Kandidat aus deiner Stellenwahl, schon ausgewählt.' : 'Zur Auswahl stehen nur Kandidaten, die laut Matching zu dieser Stelle passen.'}</DialogDescription>
        </DialogHeader>
        <CandidateSubmitForm initialCandidateId={forCandidate?.id} jobId={job.id} jobTitle={job.title} job={job as unknown as Record<string, unknown>} mustHaves={getRecruiterCriteria(job).required} onSuccess={() => { setShowSubmit(false); reload(); }} />
      </DialogContent>
    </Dialog>
    <AnonymousExposeDialog open={showExpose} onOpenChange={setShowExpose} jobId={job.id} />
    <ActivateJobDialog job={activateMode ? (job as unknown as Record<string, unknown> & { id: string; title: string }) : null} gate={gate} forSubmission={activateMode === 'submit'}
      onClose={() => {
        setActivateMode(null);
        gate.refetch();
        // Gestartet und dann geschlossen („Später einreichen“): Firmenname und Stand neu laden
        void search.reload().then(row => { if (row && row.status !== 'ended' && !companyRevealed) reload(); });
      }}
      onActivated={(_jobId, wantsSubmit) => { const submitAfter = wantsSubmit || activateMode === 'submit'; reload(); if (submitAfter) setShowSubmit(true); }} />
    <SearchQuestionDialog open={showQuestion} onOpenChange={setShowQuestion} jobId={job.id} jobTitle={job.title} companyName={companyName}
      onDone={(answer) => { setShowQuestion(false); void search.reload(); if (submitAfterQuestion && answer !== 'direct_position') setShowSubmit(true); }} />
    <EndSearchDialog open={showEnd} onOpenChange={setShowEnd} submissions={search.row?.submissions ?? 0} busy={ending} onConfirm={() => void endSearch()} />
  </DashboardLayout>;
}
