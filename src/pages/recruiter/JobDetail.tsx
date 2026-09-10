import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

type RecruiterJob = WorkspaceJob & { company_revealed?: boolean };
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
  const reload = useCallback(() => setRevision(value => value + 1), []);

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
  return <DashboardLayout fluid>
    <RecruiterJobWorkspace key={job.id} job={job} companyRevealed={companyRevealed} fullAccess={fullAccess} submissionCount={submissions.length} onSubmit={() => setShowSubmit(true)} onExpose={() => setShowExpose(true)} candidates={<JobCandidateProcessCards submissions={submissions} onOpenSubmitForm={() => setShowSubmit(true)} />} />
    <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Vorstellung vorbereiten</DialogTitle><DialogDescription>{job.title} · Kandidat wählen, Angaben prüfen und anschließend einreichen.</DialogDescription></DialogHeader>
        <CandidateSubmitForm jobId={job.id} jobTitle={job.title} mustHaves={getRecruiterCriteria(job).required} onSuccess={() => { setShowSubmit(false); reload(); }} />
      </DialogContent>
    </Dialog>
    <AnonymousExposeDialog open={showExpose} onOpenChange={setShowExpose} jobId={job.id} />
  </DashboardLayout>;
}
