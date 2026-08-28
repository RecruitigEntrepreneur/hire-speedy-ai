import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { JobEditDialog } from '@/components/jobs/JobEditDialog';

// Job-Cockpit: Zustandspille, Zug-Banner (Engpass-Diagnose), Funnel-Leiste,
// "Wartet auf Sie"-Liste — alles gespeist aus useBewerber({jobId}).
import { JobStatePill, JobZugBanner, JobFunnel, JobWaitList } from '@/components/client/JobCockpit';
import {
  JobStellendetails,
  JobTermineCard,
  JobKonditionen,
  JobTeam,
  JobVerlauf,
  JobVerwalten,
  type VerlaufEvent,
} from '@/components/client/JobDetailSections';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { computeJobState, diagnoseJob, myTurnTabs } from '@/lib/jobCockpit';
import { useBewerber } from '@/hooks/useBewerber';
import { useClientInterviewAgenda } from '@/hooks/useClientInterviewAgenda';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Circle,
  Clock,
  Loader2,
  Lock,
  Pencil,
  Sparkles,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import { useMyOrganization } from '@/hooks/useOrganization';
import { resolveIntakeSubmitTarget, notifyApproversOfIntake, notifyCreatorOfDecision } from '@/lib/intakeApproval';
import { JobIntakeStudio } from '@/components/dashboard/JobIntakeStudio';
import { isMissingColumnError } from '@/lib/intakeCapture';
import { cn } from '@/lib/utils';

interface JobSummary {
  key_facts: { icon: string; label: string; value: string }[];
  tasks_structured: { category: string; items: string[] }[];
  requirements_structured: {
    education: string[];
    experience: string[];
    tools: string[];
    soft_skills: string[];
    certifications: string[];
  };
  benefits_extracted: { icon: string; text: string }[];
  ai_insights: {
    role_type: string;
    ideal_profile: string;
    unique_selling_point: string;
    hiring_recommendation: string;
  };
  generated_at: string;
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  briefing_notes?: string | null;
  rejection_reason?: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  status: string | null;
  created_at: string;
  approved_at: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  requirements: string | null;
  fee_percentage: number | null;
  paused_at: string | null;
  skills: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  office_address: string | null;
  remote_policy: string | null;
  onsite_days_required: number | null;
  urgency: string | null;
  industry: string | null;
  job_summary: JobSummary | null;
  intake_completeness: number | null;
}

export default function ClientJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    organization: myOrg,
    myRole: myOrgRole,
    isAdmin: isOrgAdmin,
    isLoading: orgLoading,
  } = useMyOrganization();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  // Bewerber-Daten kommen aus demselben Hook wie die Inbox — identische
  // Tab-Eimer (tabOf), identische Zustände (computeState), identische Codes.
  const {
    allItems: bewerberItems,
    tabCounts,
    isLoading: bewerberLoading,
    error: bewerberError,
    refetch: refetchBewerber,
  } = useBewerber({ tab: null, jobId: id ?? null, search: '', sort: 'newest' });

  // Interview-Agenda (zeit-basiert, reveal-sicher) — hier job-gefiltert.
  const { data: agendaData } = useClientInterviewAgenda();

  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [decidingIntake, setDecidingIntake] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnNoteDraft, setReturnNoteDraft] = useState('');

  useEffect(() => {
    if (id && user) {
      fetchJobData();
    }
  }, [id, user]);

  const fetchJobData = async () => {
    try {
      // Kein client_id-Filter: RLS (can_access_job) erlaubt auch eingeladenen
      // Team-Mitgliedern (Admin/HR bzw. HM/Viewer als Job-Collaborator) den Zugriff —
      // ein harter Filter auf den Ersteller sperrte das gesamte Team aus.
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!jobData) {
        toast({ title: t('jobdetail.not_found'), variant: 'destructive' });
        return;
      }

      setJob({
        ...jobData,
        job_summary: jobData.job_summary as unknown as JobSummary | null,
        intake_completeness: jobData.intake_completeness ?? null
      } as Job);

      // Bewerber-Daten laufen komplett über useBewerber (reveal-gated View,
      // team-scoped) — die Seite hält keine eigene Submissions-Kopie mehr.
    } catch (error) {
      console.error('Error fetching job data:', error);
      toast({ title: t('jobdetail.error_load'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Kandidaten-Entscheidungen (Interview, Ablehnung, Stage-Wechsel) passieren
  // bewusst NICHT auf dieser Seite: die früheren Inline-Dialoge schrieben am
  // Opt-In-Gate vorbei (Triple-Blind-Bypass). Alle Aktionen laufen über die
  // Bewerber-Inbox bzw. die Kandidaten-Detailseite mit den sicheren Flows.

  const handlePauseToggle = async () => {
    if (!job) return;
    try {
      const isPaused = !!job.paused_at;
      // Nur paused_at toggeln — vorher zwang "Reaktivieren" JEDEN Status auf
      // 'published' (Freigabe-Bypass: Entwurf → pausieren → reaktivieren = live).
      // .select() verifiziert das Update: RLS-blockierte Schreibversuche treffen
      // 0 Zeilen OHNE Fehler — die dürfen keinen Erfolgs-Toast zeigen.
      const { data: rows, error } = await supabase
        .from('jobs')
        .update({ paused_at: isPaused ? null : new Date().toISOString() })
        .eq('id', job.id)
        .select('id');

      if (error) throw error;
      if (!rows || rows.length === 0) throw new Error('update blocked (0 rows)');

      toast({ title: isPaused ? t('jobdetail.toast.resumed') : t('jobdetail.toast.paused') });
      fetchJobData();
    } catch (error) {
      console.error('Error toggling pause:', error);
      toast({ title: t('jobdetail.error_save'), variant: 'destructive' });
    }
  };

  // Schließen-Flow: "besetzt" (egal wo) → status filled, sonst closed.
  // closed_reason/closed_at sind additiv (Migration 20260716120000); bei noch
  // nicht deployter Spalte fällt das Update auf den reinen Status zurück.
  const handleCloseJob = async (reason: string) => {
    if (!job) return;
    const newStatus =
      reason === 'filled_via_matchunt' || reason === 'filled_elsewhere' ? 'filled' : 'closed';
    let { data: rows, error } = await supabase
      .from('jobs')
      .update({
        status: newStatus,
        closed_reason: reason,
        closed_at: new Date().toISOString(),
      } as never)
      .eq('id', job.id)
      .select('id');
    if (error && isMissingColumnError(error)) {
      ({ data: rows, error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', job.id)
        .select('id'));
    }
    if (error || !rows || rows.length === 0) {
      console.error('Error closing job:', error ?? 'update blocked (0 rows)');
      toast({ title: t('jobdetail.error_save'), variant: 'destructive' });
      return;
    }
    toast({ title: t('jobdetail.toast_closed') });
    fetchJobData();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">{t('jobdetail.not_found')}</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard/jobs">{t('jobdetail.back')}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ---- Lebenszyklus-Phase: Entwurf/Freigabe/Zurückgegeben bekommen ein
  // eigenes, ehrliches Layout statt des Aktiv-Cockpits. ---------------------
  const reviewRejectionReason =
    job.status === 'draft'
      ? job.rejection_reason ||
        (job.briefing_notes?.startsWith('[ABGELEHNT]')
          ? job.briefing_notes.split('\n')[0].replace('[ABGELEHNT]', '').trim()
          : null)
      : null;

  // Interne Rückgabe-Notiz (Team-Freigabe) — getrennt von der Matchunt-Ablehnung
  const clientReturnNote: string | null =
    job.status === 'draft'
      ? (((job as unknown as Record<string, unknown>).client_approval_note as string | null) ?? null)
      : null;

  const phase =
    job.status === 'draft' ? (reviewRejectionReason || clientReturnNote ? 'returned' : 'draft')
    : job.status === 'pending_approval' ? 'review'
    : job.status === 'pending_client_approval' ? 'client_approval'
    : 'live';

  if (phase !== 'live') {
    const raw = job as unknown as Record<string, any>;
    const reife: number = raw.intake_completeness ?? 0;
    const isFreelanceJob = job.employment_type === 'freelance';
    const missing: string[] = [];
    if (!isFreelanceJob && !job.salary_min && !job.salary_max) missing.push('Gehaltsband');
    if (!job.location && job.remote_type !== 'remote') missing.push('Standort');
    const canSubmit = missing.length === 0 && reife >= 30;

    const submitForReview = async () => {
      setSubmittingReview(true);
      // Hiring Manager + aktivierte interne Freigabe → erst zu Admin/HR
      const target = await resolveIntakeSubmitTarget(user!.id);
      let { error } = await supabase
        .from('jobs')
        .update({ status: target.status, rejection_reason: null, rejected_at: null, client_approval_note: null } as any)
        .eq('id', job.id);
      if (error && isMissingColumnError(error)) {
        ({ error } = await supabase.from('jobs').update({ status: 'pending_approval' }).eq('id', job.id));
      }
      setSubmittingReview(false);
      if (error) {
        toast({ title: 'Einreichen fehlgeschlagen', variant: 'destructive' });
        return;
      }
      if (target.status === 'pending_client_approval' && target.organizationId) {
        await notifyApproversOfIntake(target.organizationId, job.id, job.title, user?.id);
        toast({ title: 'Zur internen Freigabe eingereicht — Admin/HR Ihres Teams wurden benachrichtigt.' });
      } else {
        toast({ title: 'Zur Prüfung eingereicht — wir benachrichtigen Sie, sobald die Stelle live ist.' });
      }
      fetchJobData();
    };

    const withdraw = async () => {
      const { error } = await supabase.from('jobs').update({ status: 'draft' }).eq('id', job.id);
      if (!error) {
        toast({ title: 'Zurückgezogen — die Stelle ist wieder ein Entwurf.' });
        fetchJobData();
      }
    };

    // Interne Freigabe: Admin/HR geben frei (→ Matchunt) oder geben mit Kommentar zurück
    const canApproveIntake = ['owner', 'admin', 'hr'].includes(myOrgRole ?? '');
    const jobCreatorId = (job as unknown as { client_id: string }).client_id;

    const approveIntake = async () => {
      setDecidingIntake(true);
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'pending_approval',
          client_approved_by: user?.id ?? null,
          client_approved_at: new Date().toISOString(),
          client_approval_note: null,
        })
        .eq('id', job.id);
      setDecidingIntake(false);
      if (error) {
        toast({ title: 'Freigabe fehlgeschlagen', variant: 'destructive' });
        return;
      }
      if (jobCreatorId && jobCreatorId !== user?.id) {
        await notifyCreatorOfDecision(jobCreatorId, job.id, job.title, 'approved');
      }
      toast({ title: 'Freigegeben — die Stelle geht jetzt an Matchunt zur Prüfung.' });
      fetchJobData();
    };

    const returnIntake = async () => {
      if (!returnNoteDraft.trim()) return;
      setDecidingIntake(true);
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'draft', client_approval_note: returnNoteDraft.trim() })
        .eq('id', job.id);
      setDecidingIntake(false);
      if (error) {
        toast({ title: 'Zurückgeben fehlgeschlagen', variant: 'destructive' });
        return;
      }
      if (jobCreatorId && jobCreatorId !== user?.id) {
        await notifyCreatorOfDecision(jobCreatorId, job.id, job.title, 'returned', returnNoteDraft.trim());
      }
      setShowReturnDialog(false);
      setReturnNoteDraft('');
      toast({ title: 'Zurückgegeben — der Fachbereich wurde benachrichtigt.' });
      fetchJobData();
    };

    // "Besetzt" ist Funnel, kein Lebenszyklus-Schritt — gehört nicht in den Stepper.
    const steps = phase === 'client_approval'
      ? ['Entwurf', 'Interne Freigabe', 'Prüfung Matchunt', 'Aktiv']
      : ['Entwurf', 'In Freigabe', 'Aktiv'];
    const stepIdx = phase === 'review' || phase === 'client_approval' ? 1 : 0;
    const flex: Record<string, string> = raw.intake_payload?.flexibility ?? {};
    const descriptor: string | null = raw.reveal_envelope?.descriptor ?? null;
    const flexLabel = (s: string) => (flex[s] === 'negotiable' ? 'verhandelbar' : flex[s] === 'flexible' ? 'flexibel' : 'fix');

    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl space-y-4">
          <Link to="/dashboard/jobs" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Übersicht
          </Link>

          {phase === 'returned' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {reviewRejectionReason ? 'Aus der Prüfung zurückgegeben' : 'Vom Team zurückgegeben'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Grund: {reviewRejectionReason || clientReturnNote}
                </p>
              </div>
            </div>
          )}

          {/* Phasen-Hero */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold capitalize md:text-2xl">{job.title}</h1>
              {phase === 'review' ? (
                <Badge variant="outline" className="gap-1 border-amber-500/40 text-xs text-amber-600">
                  <Clock className="h-3 w-3" /> In Freigabe
                </Badge>
              ) : phase === 'client_approval' ? (
                <Badge variant="outline" className="gap-1 border-amber-500/40 text-xs text-amber-600">
                  <Clock className="h-3 w-3" /> Interne Freigabe
                </Badge>
              ) : (
                <>
                  <Badge variant="secondary" className="text-xs">Entwurf</Badge>
                  <Badge variant="outline" className="border-primary/40 text-xs text-primary">Reife {reife} %</Badge>
                </>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {phase === 'review'
                ? `Eingereicht am ${new Date((raw.updated_at as string) || job.created_at).toLocaleDateString('de-DE')} — Prüfung i. d. R. unter 24 Std. Wir benachrichtigen Sie.`
                : phase === 'client_approval'
                ? `Eingereicht am ${new Date((raw.updated_at as string) || job.created_at).toLocaleDateString('de-DE')} — wartet auf interne Freigabe durch Admin/HR Ihres Teams.`
                : `zuletzt bearbeitet vor ${Math.max(0, Math.floor((Date.now() - new Date((raw.updated_at as string) || job.created_at).getTime()) / 86_400_000))} Tagen${job.location ? ` · ${job.location}` : ''}${job.remote_type ? ` · ${job.remote_type === 'remote' ? 'Remote' : job.remote_type === 'onsite' ? 'Vor Ort' : 'Hybrid'}` : ''}`}
            </p>

            {/* Status-Stepper (Kandidaten/Interviews sind Funnel, keine Status) */}
            <div className="mt-4 flex items-center gap-2 text-xs">
              {steps.map((s, i) => (
                <span key={s} className="flex flex-1 items-center gap-2 last:flex-none">
                  <span className={cn('flex items-center gap-1.5 whitespace-nowrap', i === stepIdx ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', i === stepIdx ? 'bg-primary text-primary-foreground' : i < stepIdx ? 'bg-primary/20 text-primary' : 'bg-muted')}>
                      {i + 1}
                    </span>
                    {s}
                  </span>
                  {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
                </span>
              ))}
            </div>

            {/* Aktionen je Phase */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              {phase === 'review' ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={withdraw}>
                  <XCircle className="h-4 w-4" /> Aus Prüfung zurückziehen
                </Button>
              ) : phase === 'client_approval' ? (
                canApproveIntake ? (
                  <>
                    <Button variant="hero" size="sm" className="gap-1.5" onClick={approveIntake} disabled={decidingIntake}>
                      {decidingIntake ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Freigeben & an Matchunt senden
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowReturnDialog(true)} disabled={decidingIntake}>
                      <XCircle className="h-4 w-4" /> Mit Kommentar zurückgeben
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">
                      Admin/HR Ihres Teams wurden benachrichtigt und geben die Aufnahme frei.
                    </span>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={withdraw}>
                      <XCircle className="h-4 w-4" /> Zurückziehen
                    </Button>
                  </>
                )
              ) : (
                <>
                  <Button variant="hero" size="sm" className="gap-1.5" onClick={() => setStudioOpen(true)}>
                    <Sparkles className="h-4 w-4" /> Weiter im Studio
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={submitForReview} disabled={!canSubmit || submittingReview}>
                    {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Zur Prüfung einreichen
                  </Button>
                  {!canSubmit && (
                    <span className="text-xs text-muted-foreground">
                      {missing.length > 0 ? `es fehlen ${missing.join(' & ')}` : 'Briefing-Reife unter 30 %'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Briefing-Reife — die eine Score-Wahrheit */}
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                Briefing-Reife
                <span className="font-bold text-primary">{reife}/100</span>
              </p>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${reife}%` }} />
              </div>
              {missing.map((m) => (
                <p key={m} className="mb-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {m} fehlt
                </p>
              ))}
              {(job.must_haves?.length ?? 0) === 0 && (
                <p className="mb-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Circle className="mt-0.5 h-3 w-3 shrink-0" /> Muss-Kriterien definieren
                </p>
              )}
              {phase !== 'review' && phase !== 'client_approval' && (
                <Button variant="ghost" size="sm" className="mt-1 h-7 gap-1 px-2 text-xs text-primary" onClick={() => setStudioOpen(true)}>
                  Im Studio vervollständigen <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Das sehen die Recruiter (Triple-Blind-Vorschau) */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Lock className="h-4 w-4 text-muted-foreground" /> Das sehen die Recruiter
              </p>
              <p className="mb-2 text-sm italic text-muted-foreground">
                „{descriptor || [job.industry, job.location && `Region ${job.location}`].filter(Boolean).join(', ') || 'Anonymer Firmen-Descriptor noch offen'}“
              </p>
              {(job.must_haves?.length ?? 0) > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {(job.must_haves || []).slice(0, 6).map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {s} · {flexLabel(s)}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Firmen-Reveal: {raw.reveal_trigger === 'opt_in' ? 'beim Kandidaten-Opt-In' : raw.reveal_trigger === 'offer' ? 'erst beim Angebot' : 'nach dem 1. Interview'}
              </p>
            </div>
          </div>

          <JobIntakeStudio
            open={studioOpen}
            type={isFreelanceJob ? 'freelance' : 'full-time'}
            initialDraft={{ id: job.id, row: raw }}
            onOpenChange={(o) => {
              setStudioOpen(o);
              if (!o) fetchJobData();
            }}
          />

          {/* Interne Rückgabe mit Kommentar (Team-Freigabe) */}
          <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>An den Fachbereich zurückgeben</DialogTitle>
                <DialogDescription>
                  Die Aufnahme geht als Entwurf zurück. Ihr Kommentar wird dem Ersteller angezeigt.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={returnNoteDraft}
                onChange={(e) => setReturnNoteDraft(e.target.value)}
                placeholder="Was soll angepasst werden? (Pflichtfeld)"
                rows={4}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
                  Abbrechen
                </Button>
                <Button onClick={returnIntake} disabled={!returnNoteDraft.trim() || decidingIntake}>
                  {decidingIntake && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Zurückgeben
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // ---- Live-Cockpit: Zustand, Diagnose und Funnel aus useBewerber ----------
  const jobState = computeJobState(job.status, job.paused_at);
  const isTerminal = job.status === 'closed' || job.status === 'filled';
  // Ehrliche Laufzeit: ab Freigabe (approved_at), nicht ab Entwurfs-Anlage.
  const liveSince = job.approved_at || job.created_at;
  const liveDays = Math.max(0, Math.floor((Date.now() - new Date(liveSince).getTime()) / 86_400_000));
  const diagnose = diagnoseJob(bewerberItems, { pausedAt: job.paused_at, liveSince, status: job.status });
  const turnTabs = myTurnTabs(bewerberItems);
  const hiredCount = bewerberItems.filter((i) => i.archiveKind === 'eingestellt').length;

  // Interview-Agenda auf diese Stelle gefiltert (inkl. fälliger Feedbacks)
  const jobAgenda = {
    feedbackDue: (agendaData?.feedbackDue || []).filter((iv) => iv.jobId === job.id),
    upcoming: (agendaData?.agendaDays || []).flatMap((d) => d.items).filter((iv) => iv.jobId === job.id),
    counterProposals: (agendaData?.counterProposals || []).filter((iv) => iv.jobId === job.id),
    awaitingCandidate: (agendaData?.awaitingCandidate || []).filter((iv) => iv.jobId === job.id),
  };

  const rawJob = job as unknown as Record<string, unknown>;
  const revealEnvelope = rawJob.reveal_envelope as { descriptor?: string | null } | null;
  const descriptor = revealEnvelope?.descriptor ?? null;
  const revealTrigger = (rawJob.reveal_trigger as string | null) ?? null;
  // Fee nur für den Hauptaccount: Solo-Kunden (ohne Org) sowie Owner/Admin/Finance.
  // Erst nach geladener Org-Info entscheiden — sonst blitzt das Honorar für
  // HM/Viewer im Ladefenster auf. (Serverseitige Spaltenabsicherung: eigener Task.)
  const canSeeFee =
    !orgLoading && (!myOrg || ['owner', 'admin', 'finance'].includes(myOrgRole ?? ''));
  // Viewer sind lesend unterwegs: keine Verwaltungs-Aktionen anbieten.
  const isViewer = myOrgRole === 'viewer';
  // Auch der Banner bietet Viewern keine Job-Verwaltung an (Briefing/Reaktivieren).
  const shownDiagnose =
    isViewer && (diagnose.action.type === 'edit' || diagnose.action.type === 'resume')
      ? { ...diagnose, action: { labelKey: '', type: 'none' as const } }
      : diagnose;

  // Schlanker Verlauf aus vorhandenen Daten (echte Event-Tabelle: späteres Thema)
  const fmtVerlaufDatum = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const verlaufEvents: VerlaufEvent[] = [];
  if (job.approved_at) {
    verlaufEvents.push({ when: job.approved_at, text: t('jobdetail.verlauf.published') });
  }
  for (const item of bewerberItems) {
    verlaufEvents.push({
      when: item.submittedAt,
      text: t('jobdetail.verlauf.vorschlag', { name: item.anonymizedName }),
    });
  }
  for (const iv of (agendaData?.all || []).filter((x) => x.jobId === job.id)) {
    if (iv.scheduledAt) {
      verlaufEvents.push({
        when: iv.createdAt,
        text: t('jobdetail.verlauf.interview', {
          name: iv.candidateName,
          date: fmtVerlaufDatum(iv.scheduledAt),
        }),
      });
    }
  }
  if (job.paused_at) {
    verlaufEvents.push({ when: job.paused_at, text: t('jobdetail.verlauf.pausiert') });
  }
  if (typeof rawJob.closed_at === 'string') {
    verlaufEvents.push({ when: rawJob.closed_at, text: t('jobdetail.verlauf.geschlossen') });
  }
  verlaufEvents.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  const verlaufShown = verlaufEvents.slice(0, 8);

  const fmtK = (n: number) => `${Math.round(n / 1000)}k`;
  const salaryLabel =
    job.salary_min && job.salary_max
      ? `€${fmtK(job.salary_min)} – €${fmtK(job.salary_max)}`
      : job.salary_min || job.salary_max
        ? `€${fmtK((job.salary_min || job.salary_max)!)}`
        : null;
  const metaLine = [
    job.company_name,
    [job.location, job.remote_type ? t(`jobdetail.remote.${job.remote_type}`, { defaultValue: job.remote_type }) : null]
      .filter(Boolean)
      .join(', '),
    job.employment_type
      ? t(`jobdetail.employment.${job.employment_type}`, { defaultValue: job.employment_type })
      : null,
    salaryLabel,
    // Geschlossene/besetzte Stellen behaupten keine Live-Laufzeit mehr.
    isTerminal
      ? null
      : job.paused_at
        ? t('jobdetail.meta.paused_since', {
            date: new Date(job.paused_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          })
        : liveDays === 0
          ? t('jobdetail.meta.live_today')
          : liveDays === 1
            ? t('jobdetail.meta.live_since_one')
            : t('jobdetail.meta.live_since', { days: liveDays }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-4">
        <Link
          to="/dashboard/jobs"
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('jobdetail.back')}
        </Link>

        {/* Kopf: Titel + Zustandspille + Meta + Verwalten-Aktionen */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold md:text-2xl">{job.title}</h1>
                <JobStatePill state={jobState} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{metaLine}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {!isViewer && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEditDialog(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t('jobdetail.actions.edit')}
                </Button>
              )}
              {isOrgAdmin && myOrg && (
                <InviteMemberDialog
                  organizationId={myOrg.id}
                  defaultRole="hiring_manager"
                  defaultJobIds={[job.id]}
                  trigger={
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <UserPlus className="h-3.5 w-3.5" />
                      {t('jobdetail.actions.invite')}
                    </Button>
                  }
                />
              )}
            </div>
          </div>

          {bewerberLoading ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : bewerberError ? (
            // Ehrlicher Fehler statt "noch kein Vorschlag"-Behauptung mit Null-Funnel
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3">
              <p className="text-sm font-medium text-destructive">{t('jobdetail.bewerber_error')}</p>
              <Button size="sm" variant="outline" onClick={() => refetchBewerber()}>
                {t('bewerber.error.retry')}
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-4">
                <JobZugBanner
                  diagnose={shownDiagnose}
                  jobId={job.id}
                  onEdit={() => setShowEditDialog(true)}
                  onResume={handlePauseToggle}
                />
              </div>
              <div className="mt-3">
                <JobFunnel jobId={job.id} tabCounts={tabCounts} turnTabs={turnTabs} hiredCount={hiredCount} />
              </div>
            </>
          )}
        </div>

        {/* Wartet auf Sie — reine Navigation, Entscheidungen fallen in Inbox/Detail */}
        {!bewerberLoading && !bewerberError && <JobWaitList items={bewerberItems} jobId={job.id} />}

        {/* Termine & fällige Feedbacks dieser Stelle */}
        <JobTermineCard agenda={jobAgenda} />

        {/* Progressive Disclosure: alles Seltene hinter Akkordeons */}
        <Accordion type="multiple" className="space-y-2">
          <AccordionItem value="stelle" className="rounded-xl border bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              {t('jobdetail.sections.stelle')}
            </AccordionTrigger>
            <AccordionContent>
              <JobStellendetails
                job={job}
                onEdit={() => setShowEditDialog(true)}
                isViewer={isViewer}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="konditionen" className="rounded-xl border bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              {t('jobdetail.sections.konditionen')}
            </AccordionTrigger>
            <AccordionContent>
              <JobKonditionen
                salaryLabel={salaryLabel}
                feePercentage={job.fee_percentage}
                canSeeFee={canSeeFee}
                revealTrigger={revealTrigger}
                descriptor={descriptor}
              />
            </AccordionContent>
          </AccordionItem>

          {myOrg && (
            <AccordionItem value="team" className="rounded-xl border bg-card px-4">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                {t('jobdetail.sections.team')}
              </AccordionTrigger>
              <AccordionContent>
                <JobTeam organizationId={myOrg.id} jobId={job.id} isOrgAdmin={isOrgAdmin} />
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="verlauf" className="rounded-xl border bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              {t('jobdetail.sections.verlauf')}
            </AccordionTrigger>
            <AccordionContent>
              <JobVerlauf events={verlaufShown} />
            </AccordionContent>
          </AccordionItem>

          {!isViewer && (
            <AccordionItem value="verwalten" className="rounded-xl border bg-card px-4">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                {t('jobdetail.sections.verwalten')}
              </AccordionTrigger>
              <AccordionContent>
                <JobVerwalten
                  isPaused={!!job.paused_at}
                  isTerminal={isTerminal}
                  onEdit={() => setShowEditDialog(true)}
                  onPauseToggle={handlePauseToggle}
                  onCloseJob={handleCloseJob}
                />
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>

      {/* Edit Dialog */}
      <JobEditDialog
        job={job}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={fetchJobData}
      />
    </DashboardLayout>
  );
}
