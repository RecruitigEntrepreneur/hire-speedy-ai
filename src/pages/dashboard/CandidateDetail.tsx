import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Calendar,
  FileText,
  Linkedin,
  X,
  Clock,
  MessageSquare,
  Send,
  Lock,
  User,
  Scale,
  Briefcase,
  MapPin,
  Banknote,
  GraduationCap,
  Building2,
  Globe,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { EducationCard, FitTextCard, InterviewInsightsCard, MussKriterienCard } from '@/components/candidates/client/ClientCandidateCards';
import { AskColleaguesDialog } from '@/components/candidates/client/AskColleaguesDialog';
import { FrageSheet, initialsOf } from '@/components/candidates/client/FrageSheet';
import { QuestionThreadList } from '@/components/candidates/client/QuestionThreadList';
import { useClientQuestions } from '@/components/candidates/client/useClientQuestions';
import { submitterName, useSubmitter } from '@/components/candidates/client/useSubmitter';
import { REJECTION_CATEGORIES } from '@/components/rejection/RejectionReasonSelector';
import { useCandidateInsights, verfuegbarAus, fuehrung } from '@/components/candidates/client/useCandidateInsights';
import { buildClientCandidatePdf, downloadPdf } from '@/lib/clientCandidatePdf';
import type { TeamMember } from '@/hooks/useTeamData';
import { CandidateExperienceTimeline } from '@/components/candidates/CandidateExperienceTimeline';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { InterviewRequestDialog } from '@/components/interview/request/InterviewRequestDialog';
import { FeedbackDialog } from '@/components/interview/window/FeedbackDialog';
import { OfferDialog } from '@/components/offers/OfferDialog';
import { RecommendationCard } from '@/components/offers/RecommendationCard';
import type { ContractOpen } from '@/components/contracts/ContractBox';
import { ContractTaskWindow } from '@/components/contracts/ContractTaskWindow';
import { ContractTimeline } from '@/components/contracts/ContractTimeline';
import { OfferTaskWindow } from '@/components/offers/OfferTaskWindow';
import { OfferStand } from '@/components/offers/OfferStand';
import { offerApi } from '@/lib/offerApi';
import { PendingRequestStatus } from '@/components/interview/PendingRequestStatus';
import { StatePill } from '@/components/candidates/BewerberStatusPill';
import { primaryActionFor } from '@/components/candidates/BewerberPreviewPanel';
import { useSubmissionState } from '@/hooks/useSubmissionState';
import { useCandidateFitAssessment } from '@/hooks/useCandidateFitAssessment';
import { useClientCandidateView } from '@/hooks/useClientCandidateView';
import { useMyOrganization } from '@/hooks/useOrganization';
import { useTeamData } from '@/hooks/useTeamData';
import { cn } from '@/lib/utils';
import { candidateAnonCode } from '@/lib/anonymization';
import { clientTasksApi, useClientTasks, type ClientTask } from '@/lib/clientTasksApi';
import { ClientTaskWindow, type TaskHandlers } from '@/components/client/tasks/ClientTaskWindow';
import { ProfileTaskCards } from '@/components/client/tasks/ClientTaskParts';

// ============================================================================
// Helpers
// ============================================================================

const isPlaceholder = (val: string) => {
  const placeholders = ['Nicht angegeben', 'Ausstehend', 'Unbekannt', 'Flexibel',
    'Noch nicht besprochen', 'CV-Analyse ausstehend', 'Wird im Interview besprochen',
    'Wird basierend auf CV ermittelt', 'Präferenz noch nicht erfasst', 'Fachkraft',
    'Vom Kandidaten noch nicht freigegeben', 'Standort nicht angegeben'];
  return placeholders.some(p => val.includes(p));
};

function buildWorkModelLabel(workModel: string, remoteDays: number | null, relocation: boolean | null): string {
  const parts = [workModel];
  if (remoteDays && remoteDays > 0) parts.push(`${remoteDays}T Remote`);
  if (relocation === true) parts.push('umzugsbereit');
  return parts.join(', ');
}


// ============================================================================
// Key Fact Chip
// ============================================================================

function KeyFactChip({ icon: Icon, label, value, faded }: {
  icon: React.ElementType; label: string; value: string; faded?: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", faded ? "text-muted-foreground/50" : "text-muted-foreground")} />
      <span className="text-muted-foreground text-sm">{label}:</span>
      <span className={cn("text-sm font-medium", faded ? "text-muted-foreground/50" : "text-foreground")}>
        {value || '–'}
      </span>
    </span>
  );
}


// ============================================================================
// Main Component
// ============================================================================

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: candidateView, loading, error, refetch } = useClientCandidateView(id);
  // Aufgaben dieser Bewerbung (23.10.2026): Karten im Kopf wie im Headhunter-Profil
  const clientTasks = useClientTasks(id);
  const queryClient = useQueryClient();
  // Offene Aufgabe im Fenster; als Objekt gehalten, damit „Erledigt“ stehen bleibt, wenn sie aus der Liste fällt
  const [activeTask, setActiveTask] = useState<ClientTask | null>(null);
  // Aufgabe an ein anderes Fenster übergeben: erledigt, sobald sie aus der Liste verschwindet
  const [delegatedTask, setDelegatedTask] = useState<ClientTask | null>(null);
  const [requestReplaces, setRequestReplaces] = useState<string | null>(null);

  // Ein Zustand für die ganze Seite — gleiche Pillen-/Zuständigkeits-Logik wie die Inbox
  const { data: subState } = useSubmissionState(
    id,
    candidateView?.stage ?? null,
    candidateView?.status ?? null,
    null
  );

  // Einschätzung zur Stelle (Text, ohne Zahl) und Angaben aus dem Gespräch mit dem Headhunter.
  // Keine Prozentzahl beim Kunden (EU AI Act, Entscheidung 09.10.2026).
  const fit = useCandidateFitAssessment(id);
  const { data: insights } = useCandidateInsights(id);
  // Wer den Kandidaten eingereicht hat, und die Fragen des Kunden an ihn.
  const { data: submitter } = useSubmitter(id, candidateView?.jobId);
  const hhName = submitterName(submitter);
  const questions = useClientQuestions(candidateView?.jobId, candidateView?.candidateId);
  const [showFrage, setShowFrage] = useState(false);
  // Großer Kopf scrollt mit; ist er weg, bleibt oben eine schmale Leiste mit Status und Knöpfen.
  const headRef = useRef<HTMLDivElement | null>(null);
  const [headVisible, setHeadVisible] = useState(true);
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHeadVisible(e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  });
  const [showAsk, setShowAsk] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Team-Kontext: Viewer sind read-only; Mitgliederliste für @-Mentions
  const { organization: myOrg, myRole: myOrgRole } = useMyOrganization();
  const isViewer = myOrgRole === 'viewer';
  const teamQuery = useTeamData(myOrg?.id);
  const teamMembers = (teamQuery.data?.members ?? []).filter((m) => m.status === 'active');
  const memberName = (uid: string) => teamMembers.find((m) => m.user_id === uid)?.full_name ?? null;
  // „von Ihnen“, „von Anna Weber“ oder „aus Ihrem Team“ (ältere Anfragen ohne Person: null)
  const vonWem = (uid: string | null) => (!uid ? null : uid === user?.id ? 'von Ihnen' : memberName(uid) ? `von ${memberName(uid)}` : 'aus Ihrem Team');

  // DSGVO: Zugriff auf das Kandidatenprofil serverseitig protokollieren
  // (einmal pro Submission und Seitenaufruf, nicht pro Re-Render)
  const loggedAccessRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !user || loggedAccessRef.current === id) return;
    loggedAccessRef.current = id;
    supabase
      .rpc('log_candidate_access', { _submission_id: id })
      .then(({ error: rpcError }) => {
        if (rpcError) console.warn('Zugriffs-Log nicht möglich:', rpcError.message);
      });
  }, [id, user]);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // @-Mention-Vorschläge: greift auf das letzte "@..."-Fragment im Text
  const mentionMatch = newComment.match(/@([\wäöüÄÖÜß-]*)$/);
  const mentionSuggestions = mentionMatch
    ? teamMembers
        .filter(
          (m) =>
            m.user_id !== user?.id &&
            m.full_name &&
            m.full_name.toLowerCase().startsWith(mentionMatch[1].toLowerCase())
        )
        .slice(0, 5)
    : [];

  const applyMention = (fullName: string) => {
    setNewComment((prev) => prev.replace(/@([\wäöüÄÖÜß-]*)$/, `@${fullName} `));
  };

  // Erwähnte Namen im Kommentar farblich hervorheben
  const renderCommentContent = (text: string) => {
    const names = teamMembers.map((m) => m.full_name).filter(Boolean) as string[];
    if (!names.length) return text;
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const parts = text.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'));
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="font-medium text-primary">{part}</span>
      ) : (
        part
      )
    );
  };

  // Dialogs
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  // Feedback nach dem Gespräch: Fenster in der Mitte, für das letzte Gespräch ohne Feedback
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  // Angebot machen (Paket 2): Fenster in der Mitte
  const [showOffer, setShowOffer] = useState(false);
  // Arbeitsvertrag (Paket 3): Fenster öffnet die Vertrags-Box selbst
  // Ein Fenster für alles rund um den Vertrag (24.10.2026): Absicht, Rücksprung von DocuSign, Aufgabe
  const [contractWin, setContractWin] = useState<null | { intent: ContractOpen; returnEvent: string | null; task: ClientTask | null }>(null);
  const setContractOpen = (intent: ContractOpen) => setContractWin({ intent, returnEvent: null, task: null });
  // Angebot: ebenfalls ein Fenster (Gegenwunsch, Frist, Stand)
  const [offerWin, setOfferWin] = useState(false);
  // Gleicher Schlüssel wie Empfehlungskarte und Angebots-Box: ein Abruf für alle
  const { data: offerCtx } = useQuery({
    queryKey: ['offer-context', id],
    queryFn: () => offerApi.context(id!),
    enabled: !!id,
    retry: false,
    staleTime: 15_000,
  });
  const hasRecommendation = !!offerCtx?.recommendation;

  // Job Requirements Query
  const { data: jobReqs } = useQuery({
    queryKey: ['job-requirements-fit', candidateView?.jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('skills, must_haves, nice_to_haves, salary_min, salary_max, experience_level, location, remote_policy, onsite_required')
        .eq('id', candidateView!.jobId)
        .single();
      if (error) throw error;
      return data as {
        skills: string[] | null;
        must_haves: string[] | null;
        nice_to_haves: string[] | null;
        salary_min: number | null;
        salary_max: number | null;
        experience_level: string | null;
        location: string | null;
        remote_policy: string | null;
        onsite_required: boolean | null;
      };
    },
    enabled: !!candidateView?.jobId,
  });

  // AI Summary for recommendation
  const { data: aiSummary } = useQuery({
    queryKey: ['client-summary-recommendation', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_client_summary')
        .select('recommendation, key_selling_points, change_motivation_status')
        .eq('submission_id', id!)
        .maybeSingle();
      return data as {
        recommendation: string;
        key_selling_points: string[];
        change_motivation_status: string;
      } | null;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (id && user) fetchComments();
  }, [id, user]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_comments')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: false });
      if (!error && data) setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  // Notiz speichern; erwähnte Team-Mitglieder erhalten eine Benachrichtigung.
  const addComment = async (content: string, mentionedIds: string[], title = 'Sie wurden in einem Kommentar erwähnt') => {
    if (!user) return;
    let { error } = await supabase
      .from('candidate_comments')
      .insert({ submission_id: id, user_id: user.id, content, mentioned_user_ids: mentionedIds });
    if (error && /mentioned_user_ids/.test(error.message)) {
      // Fallback für noch nicht migrierte DB
      ({ error } = await supabase
        .from('candidate_comments')
        .insert({ submission_id: id, user_id: user.id, content }));
    }
    if (error) throw error;
    if (mentionedIds.length) {
      // Geprüft in der Datenbank (Migration 20261009140000): direkt anlegen durften Kunden Benachrichtigungen nie.
      const { error: notifyError } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>)(
        'notify_candidate_mention', { p_submission_id: id, p_user_ids: mentionedIds, p_title: title },
      );
      if (notifyError) console.warn('Erwähnung nicht benachrichtigt:', notifyError.message);
    }
  };

  // „Kollegen fragen“: Zugriff auf die Stelle geben, wo er fehlt, dann Notiz mit Erwähnung.
  const askColleagues = async ({ content, mentionedIds, grant }: { content: string; mentionedIds: string[]; grant: TeamMember[] }) => {
    if (!user || !candidateView) return false;
    try {
      if (grant.length) {
        const { error } = await supabase.from('job_collaborators').insert(
          grant.map((m) => ({ job_id: candidateView.jobId, user_id: m.user_id, role: m.role === 'viewer' ? 'viewer' : 'hiring_manager', added_by: user.id })) as never,
        );
        if (error) throw error;
      }
      await addComment(content, mentionedIds, 'Ihre Meinung zu einem Kandidaten ist gefragt');
      fetchComments();
      toast({ title: 'Anfrage gesendet', description: 'Die Antworten erscheinen unter den Team-Notizen.' });
      return true;
    } catch {
      toast({ title: 'Die Anfrage konnte nicht gesendet werden', variant: 'destructive' });
      return false;
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    setCommentLoading(true);
    try {
      // @-Mentions auflösen: erwähnte Team-Mitglieder erhalten eine Benachrichtigung
      const mentionedIds = teamMembers
        .filter((m) => m.user_id !== user.id && m.full_name && newComment.includes(`@${m.full_name}`))
        .map((m) => m.user_id);
      await addComment(newComment, mentionedIds);
      setNewComment('');
      fetchComments();
      toast({ title: 'Notiz gespeichert' });
    } catch {
      toast({ title: 'Die Notiz konnte nicht gespeichert werden', variant: 'destructive' });
    } finally {
      setCommentLoading(false);
    }
  };

  // ---------------------------------------------------------------- Kunden-Aufgaben (23.10.2026)
  const taskCardsShown = !isViewer && !!clientTasks.data && (clientTasks.data.tasks.length > 0 || clientTasks.data.waiting.length > 0);
  const openTask = (task: ClientTask) => {
    // Feedback hat sein eigenes Fenster mit den vier Wegen
    if (task.kind === 'feedback' && task.ref.interviewId) { setDelegatedTask(task); setFeedbackFor(task.ref.interviewId); return; }
    // Vertrag: eine Aufgabe, ein Fenster (kein Zwischenfenster)
    if (['send_contract', 'docusign_sign', 'contract_signed_check'].includes(task.kind)) { setDelegatedTask(task); setContractWin({ intent: null, returnEvent: null, task }); return; }
    if (['counter', 'offer_overdue'].includes(task.kind)) { setDelegatedTask(task); setOfferWin(true); return; }
    setActiveTask(task);
  };
  // „Läuft bei anderen“: Karten rund um den Vertrag öffnen dasselbe Fenster im Modus „läuft“
  const openWaiting = (key: string) => {
    if (/^(sign-company|docusign-cand|contract-self|contract-undo):/.test(key)) setContractWin({ intent: null, returnEvent: null, task: null });
  };
  const handoff = (fn: () => void) => () => { if (activeTask) setDelegatedTask(activeTask); setActiveTask(null); fn(); };
  const taskHandlers: TaskHandlers = {
    requestInterview: (replaces) => handoff(() => { setRequestReplaces(replaces ?? null); setShowInterviewDialog(true); })(),
    reject: handoff(() => setShowRejectDialog(true)),
    askRecruiter: handoff(() => setShowFrage(true)),
    offer: handoff(() => setShowOffer(true)),
    contract: (open) => handoff(() => setContractWin({ intent: open, returnEvent: null, task: activeTask }))(),
  };
  // ?aufgabe=… aus Kachel, Liste oder Aufgaben-Seite: Fenster direkt öffnen
  const aufgabeParam = new URLSearchParams(location.search).get('aufgabe');
  useEffect(() => {
    if (!aufgabeParam || !clientTasks.data) return;
    const task = clientTasks.data.tasks.find((x) => x.key === aufgabeParam);
    if (task) openTask(task);
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aufgabeParam, clientTasks.data]);
  // Stand geändert (Fenster gespeichert) → Aufgaben neu laden
  useEffect(() => { void clientTasks.refetch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [subState]);
  useEffect(() => {
    if (!delegatedTask || !clientTasks.data) return;
    if (clientTasks.data.tasks.some((x) => x.key === delegatedTask.key)) return;
    const done = delegatedTask;
    setDelegatedTask(null);
    void clientTasksApi.logDone(done, `${done.title} erledigt`).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
    sonnerToast.success(`Erledigt: ${done.title}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientTasks.data, delegatedTask]);

  // Loading
  // Gespräch für das Feedback: das jüngste vergangene ohne Feedback
  const feedbackInterviewId = (subState?.interviews ?? []).find((x) =>
    !x.feedback && x.scheduledAt && Date.parse(x.scheduledAt) <= Date.now() && ['scheduled', 'completed', 'no_show'].includes(x.status ?? ''))?.id ?? null;

  // Aus Liste, Agenda oder Feedback: Fenster direkt im Profil öffnen (state.open)
  const openRequest = (location.state as { open?: string } | null)?.open ?? null;
  useEffect(() => {
    if (!openRequest || !subState) return;
    if (openRequest === 'feedback') setFeedbackFor(feedbackInterviewId);
    if (openRequest === 'offer') setShowOffer(true);
    if (openRequest === 'reject') setShowRejectDialog(true);
    if (openRequest === 'frage') setShowFrage(true);
    if (openRequest === 'contract') setContractOpen('contract');
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest, subState]);
  // Erinnerungs-Mail an Tag 7: ?vertrag=melden | verschickt | abgesprungen; Rücksprung von DocuSign: ?vertrag=zurueck
  const vertragParam = new URLSearchParams(location.search).get('vertrag');
  useEffect(() => {
    if (!vertragParam || !subState) return;
    if (['melden', 'verschickt', 'abgesprungen'].includes(vertragParam)) setContractOpen(vertragParam as ContractOpen);
    if (vertragParam === 'offen') setContractOpen(null);
    if (vertragParam === 'zurueck') setContractWin({ intent: null, returnEvent: new URLSearchParams(location.search).get('event') ?? 'signing_complete', task: null });
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertragParam, subState]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error
  if (error || !candidateView) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Kandidat nicht gefunden</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/candidates">Zurück zur Übersicht</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const {
    displayName, identityUnlocked, currentRole, experience, seniority,
    salaryRange, availability, region, workModel, topSkills,
    status, stage, jobTitle, jobId,
    email, phone, cvUrl, linkedinUrl,
    candidateId, submissionId, matchScore, fitLabel, dealProbability, motivationStatus,
    certifications, languageSkills, industryExperience, targetRoles,
    careerGoals, relocationWilling, remoteDaysPreferred,
    keySellingPoints,
  } = candidateView;

  const enrichedWorkModel = buildWorkModelLabel(workModel, remoteDaysPreferred, relocationWilling);
  const anonCode = candidateAnonCode(candidateId);
  const fmtSeniority = (s: string) => (s && /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const state = subState?.state ?? { key: 'wait_today', tone: 'neutral' as const, turn: 'me' as const };
  // Eingestellt, abgelehnt, zurückgezogen oder abgeschlossen: keine Primäraktion
  // („Interview anfragen“) mehr — Status UND Stage zählen, dazu der Archiv-Zustand.
  const TERMINAL_STATES = ['hired', 'placed', 'rejected', 'client_rejected', 'withdrawn'];
  const isTerminal =
    TERMINAL_STATES.includes(status) || TERMINAL_STATES.includes(stage) || state.key === 'archiv';
  const primary = primaryActionFor(state.key);
  const PrimaryIcon = primary.icon;
  // Nur „wartet auf Kandidat" nutzt den Pending-Baustein; beim Gegenvorschlag
  // ist der Kunde am Zug und bekommt die Primäraktion „Vorschlag prüfen".
  const isPendingCandidate = state.key === 'wartet_kandidat';
  const iv = insights?.interview ?? null;
  const gehalt = iv?.salary_wish ?? salaryRange;
  const tsd = (n: number) => Math.round(n / 1000);
  const budget = jobReqs?.salary_min || jobReqs?.salary_max
    ? jobReqs.salary_min && jobReqs.salary_max ? `${tsd(jobReqs.salary_min)}–${tsd(jobReqs.salary_max)} T€` : `${tsd((jobReqs.salary_min || jobReqs.salary_max)!)} T€`
    : null;
  const verfuegbar = verfuegbarAus(iv) ?? availability;

  // Lebenslauf (PDF) aus genau den Daten, die der Kunde hier sieht.
  const downloadCv = async () => {
    setPdfBusy(true);
    try {
      // Über die reveal-gated Ansicht wie die Seite selbst (Firmen und Freitext anonym bis zur Freigabe).
      const { data: exps } = await supabase.from('client_candidate_experiences_view').select('job_title, company_name, start_date, end_date, is_current, description').eq('submission_id', submissionId).order('sort_order');
      const jahr = (d: string | null) => (d ? new Date(d).getFullYear() : '?');
      const bytes = await buildClientCandidatePdf({
        code: identityUnlocked ? displayName : anonCode,
        role: currentRole,
        jobTitle,
        anonym: !identityUnlocked,
        facts: [
          { label: 'Seniorität', value: fmtSeniority(seniority) },
          { label: 'Erfahrung', value: experience },
          { label: 'Gehaltswunsch', value: gehalt },
          { label: 'Verfügbar', value: verfuegbar },
          { label: 'Region', value: region },
          { label: 'Arbeitsmodell', value: enrichedWorkModel },
        ].filter((r) => r.value && !isPlaceholder(r.value)),
        gespraech: iv ? [
          iv.change_motivation && { label: 'Warum wechseln', value: iv.change_motivation },
          iv.why_now && { label: 'Warum jetzt', value: iv.why_now },
          (iv.offer_requirements ?? []).length > 0 && { label: 'Wichtig ist', value: (iv.offer_requirements ?? []).join(', ') },
          fuehrung(iv) && { label: 'Führung', value: fuehrung(iv)! },
        ].filter(Boolean) as { label: string; value: string }[] : [],
        werdegang: (exps ?? []).map((e) => ({
          title: e.job_title ?? 'Position',
          company: identityUnlocked ? e.company_name ?? 'Unternehmen' : 'Unternehmen',
          period: `${jahr(e.start_date)} – ${e.is_current ? 'heute' : jahr(e.end_date)}`,
          description: e.description,
        })),
        ausbildung: (insights?.education ?? []).map((e) => [e.degree, e.field_of_study, e.institution, e.graduation_year].filter(Boolean).join(' · ')),
        skills: topSkills,
        sprachen: (languageSkills ?? []).map((l: unknown) => (typeof l === 'string' ? l : [(l as { language?: string }).language, (l as { level?: string }).level].filter(Boolean).join(' '))).filter(Boolean),
      });
      downloadPdf(bytes, `Kandidatenprofil ${identityUnlocked ? displayName : anonCode}.pdf`);
    } catch (e) {
      console.error('PDF fehlgeschlagen', e);
      toast({ title: 'Der Lebenslauf konnte nicht erstellt werden', variant: 'destructive' });
    } finally {
      setPdfBusy(false);
    }
  };
  const showAgendaLink = ['geplant', 'feedback', 'feedback_nodate', 'interview_phase', 'opted_in'].includes(state.key);
  const nextRoundNo = Number((state.params as { round?: number } | undefined)?.round ?? 2);
  // Angebot über den Headhunter: Schritte stehen in der Angebots-Box, nicht im Hauptknopf
  const offerFlow = ['with_recruiter', 'considering', 'accept_reported', 'countered', 'accepted', 'declined', 'withdrawn'].includes(subState?.offers?.[0]?.status ?? '');
  // Nach der Unterschrift gibt es keine Absage mehr (Paket 3)
  const signedContract = state.key === 'vertrag_unterschrieben';

  const tagMonat = (iso: string) => format(new Date(iso), 'dd.MM.', { locale: de });
  const tageSeit = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  const lastRejection = subState?.rejections?.[0] ?? null;
  const grundLabel = (c: string | null) => REJECTION_CATEGORIES.find((r) => r.value === c)?.label ?? null;

  const ctxFor = (): string => {
    const k = state.key;
    // Angefragt: wann und von wem, und wer jetzt dran ist
    const lastIv = subState?.latestInterview;
    if (k === 'wartet_kandidat' && lastIv) {
      const von = vonWem(lastIv.requestedBy);
      const wer = von === 'von Ihnen' ? 'Sie haben' : von && von !== 'aus Ihrem Team' ? `${von.slice(4)} hat` : 'Ihr Team hat';
      const tage = tageSeit(lastIv.createdAt);
      return `${wer} am ${tagMonat(lastIv.createdAt)} ein Interview angefragt. Der Kandidat hat noch nicht zugesagt (${tage === 0 ? 'seit heute' : tage === 1 ? 'seit gestern' : `seit ${tage} Tagen`}). ${hhName} hält den Kontakt und meldet sich, sobald er zusagt.`;
    }
    // Abgelehnt: wann, von wem, welcher Grund
    if (k === 'archiv' && subState?.archiveKind === 'abgelehnt' && lastRejection) {
      const von = vonWem(lastRejection.rejectedBy);
      const wer = von === 'von Ihnen' ? 'Sie haben' : von && von !== 'aus Ihrem Team' ? `${von.slice(4)} hat` : 'Ihr Team hat';
      const grund = grundLabel(lastRejection.reasonCategory);
      return `${wer} am ${tagMonat(lastRejection.createdAt)} abgelehnt.${grund ? ` Grund: ${grund}.` : ''} ${hhName} ist informiert.`;
    }
    // Angebot über den Headhunter (Einzelheiten in der Angebots-Box)
    if (k === 'offer_with_hh') return `Ihr Angebot liegt bei ${hhName}. ${hhName.split(' ')[0]} bespricht es mit dem Kandidaten, danach kommt es schriftlich per Mail, und der Kandidat antwortet selbst.`;
    if (k === 'offer_accept_reported') return `${hhName} hat die Zusage gemeldet. Der Kandidat bestätigt sie gerade per Mail, danach schicken Sie den Arbeitsvertrag.`;
    if (k === 'offer_considering') return `Der Kandidat überlegt noch. ${hhName} hält Kontakt.`;
    if (k === 'offer_overdue') return `Die Antwortfrist ist abgelaufen. Verlängern Sie die Frist oder fragen Sie ${hhName}.`;
    if (k === 'offer_negotiating') return `Der Kandidat hat einen Gegenwunsch. Sie entscheiden: anpassen, beim Angebot bleiben oder absagen.`;
    if (k === 'offer_accepted') return 'Zusage! Jetzt fehlt nur noch der unterschriebene Arbeitsvertrag.';
    // Arbeitsvertrag (Paket 3); Einzelheiten in der Vertrags-Box
    if (k === 'vertrag_unterwegs') return `Der Arbeitsvertrag ist unterwegs. ${hhName} hakt beim Kandidaten nach.`;
    if (k === 'vertrag_bestaetigen') return `${hhName} meldet die Unterschrift. Bitte bestätigen Sie unten.`;
    if (k === 'vertrag_unterschrieben') return 'Der Arbeitsvertrag ist unterschrieben.';
    if (k === 'vertrag_abgelehnt') return 'Der Vertrag wurde in DocuSign abgelehnt. Passen Sie ihn an oder schicken Sie ihn selbst.';
    if (k === 'offer_rejected') return `Der Kandidat hat abgesagt. ${hhName} ist informiert.`;
    if (k === 'offer_withdrawn') return 'Sie haben das Angebot zurückgezogen.';
    // Nach dem Feedback: der gewählte Weg, mit dem Namen des Headhunters
    if (k === 'naechste_runde') return `Ihr Feedback: weiter. Planen Sie Interview ${nextRoundNo}, gern vor Ort mit dem Team. ${hhName} weiß Bescheid.`;
    if (k === 'angebot_vorbereiten') return hasRecommendation
      ? `${hhName} hat Ihnen eine Empfehlung geschickt (unten). Damit trifft Ihr Angebot beim ersten Mal.`
      : `Sie möchten ein Angebot machen. ${hhName} spricht mit dem Kandidaten und schickt Ihnen eine Empfehlung, was es für eine Zusage braucht.`;
    if (k === 'unsicher') return `Sie sind noch unsicher. ${hhName} meldet sich mit den offenen Punkten; danach entscheiden Sie über Interview ${nextRoundNo}.`;
    if (k === 'wait_today' || k === 'wait_yesterday' || k === 'wait_days') return t('bewerber.detail.ctx.wait_new');
    if (k === 'wait_warn' || k === 'wait_crit') return t('bewerber.detail.ctx.wait_old', { days: (state.params as any)?.days ?? '' });
    if (k === 'archiv') return t('bewerber.detail.ctx.archiv');
    return t(`bewerber.detail.ctx.${k}`, state.params);
  };

  const runPrimary = () => {
    if (isViewer) return;
    if (primary.run === 'wizard') {
      setShowInterviewDialog(true);
      return;
    }
    if (primary.run === 'feedback') { setFeedbackFor(feedbackInterviewId); return; }
    if (primary.run === 'offer') { setShowOffer(true); return; }
    if (primary.run === 'contract') { setContractOpen('contract'); return; }
    if (primary.run === 'frage') { setShowFrage(true); return; }
    navigate(primary.run);
  };

  // Verlauf: Einreichung, Interviews und Angebote chronologisch — das Gedächtnis der Bewerbung
  const verlauf: { when: string; label: string }[] = [];
  if (subState?.submittedAt) verlauf.push({ when: subState.submittedAt, label: submitter?.name ? `Eingereicht von ${submitter.name}` : t('bewerber.detail.verlauf_submitted') });
  for (const iv of subState?.interviews ?? []) {
    const von = vonWem(iv.requestedBy);
    verlauf.push({ when: iv.createdAt, label: von ? `Interview angefragt ${von}` : t('bewerber.detail.verlauf_iv_requested') });
    if (iv.scheduledAt) {
      const past = new Date(iv.scheduledAt).getTime() < Date.now();
      verlauf.push({
        when: iv.scheduledAt,
        label:
          past && (iv.status === 'scheduled' || iv.status === 'completed')
            ? t('bewerber.detail.verlauf_iv_completed')
            : t('bewerber.detail.verlauf_iv_scheduled', {
                time: format(new Date(iv.scheduledAt), 'HH:mm', { locale: de }),
              }),
      });
    }
    if (iv.cancelledAt) verlauf.push({ when: iv.cancelledAt, label: t('bewerber.detail.verlauf_iv_cancelled') });
    if (iv.status === 'declined') verlauf.push({ when: iv.createdAt, label: t('bewerber.detail.verlauf_iv_declined') });
  }
  for (const o of subState?.offers ?? []) {
    if (o.createdAt) verlauf.push({ when: o.createdAt, label: t('bewerber.detail.verlauf_offer_created') });
    if (o.sentAt) verlauf.push({ when: o.sentAt, label: t('bewerber.detail.verlauf_offer_sent') });
  }
  for (const r of subState?.rejections ?? []) {
    const von = vonWem(r.rejectedBy);
    const grund = REJECTION_CATEGORIES.find((c) => c.value === r.reasonCategory)?.label;
    verlauf.push({ when: r.createdAt, label: `Abgelehnt${von ? ` ${von}` : ''}${grund ? ` · ${grund}` : ''}` });
  }
  for (const m of questions.data?.messages ?? []) {
    verlauf.push({ when: m.createdAt, label: m.mine ? 'Frage an den Headhunter gestellt' : `Frage beantwortet von ${hhName}` });
  }
  if (subState?.latestInterview?.status === 'pending_response') {
    verlauf.push({ when: new Date().toISOString(), label: t('bewerber.detail.verlauf_iv_pending') });
  }
  verlauf.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());

  return (
    <DashboardLayout>
      {/* Back navigation */}
      <Link
        to="/dashboard/candidates"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t('bewerber.detail.back')}
      </Link>

      <div className="space-y-4 max-w-5xl">
        {/* ================================================================ */}
        {/* ZONE 1 — WER & WIE GUT (bleibt beim Scrollen sichtbar)           */}
        {/* ================================================================ */}
        {/* Schmale Leiste beim Scrollen: nimmt keinen Platz ein, solange der Kopf sichtbar ist */}
        <div
          className={cn(
            'sticky top-16 z-30 -mb-[52px] h-[52px] transition-opacity',
            headVisible ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
          aria-hidden={headVisible}
        >
          <div className="flex h-full items-center gap-3 rounded-xl border bg-card/95 px-4 shadow-md backdrop-blur">
            <span className="font-semibold shrink-0">{identityUnlocked ? displayName : anonCode}</span>
            <StatePill state={state} archiveKind={subState?.archiveKind} className="shrink-0" />
            <span className="hidden lg:inline min-w-0 text-sm text-muted-foreground truncate">für: {jobTitle}</span>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {!isViewer && !isTerminal && !isPendingCandidate && !offerFlow && (
                <Button size="sm" onClick={runPrimary} className="gap-1.5 h-8">
                  <PrimaryIcon className="h-3.5 w-3.5" />
                  {t(primary.labelKey, state.params)}
                </Button>
              )}
              {!isViewer && !isTerminal && (
                <>
                  {!signedContract && (
                    <Button variant="outline" size="sm" className="h-8 text-muted-foreground" onClick={() => setShowRejectDialog(true)}>
                      {t('bewerber.actions.reject')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setShowFrage(true)}>
                    Frage an {hhName}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div ref={headRef}>
          <div className="rounded-xl border bg-card shadow-md p-5">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                  <AvatarFallback className={cn(
                    'text-lg font-semibold',
                    identityUnlocked
                      ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {identityUnlocked
                      ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                      : <User className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
                {!identityUnlocked && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 bg-muted rounded-full border-2 border-background flex items-center justify-center">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold truncate">
                    {identityUnlocked ? displayName : anonCode}
                  </h1>
                  {!identityUnlocked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <StatePill state={state} archiveKind={subState?.archiveKind} />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{currentRole}</span>
                  <span className="text-border">·</span>
                  <span>für: {jobTitle}</span>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {identityUnlocked
                    ? t('bewerber.detail.unlocked_hint', { code: anonCode })
                    : t('bewerber.detail.locked_hint', { code: anonCode })}
                </p>
              </div>

              {/* Kontaktleiste — nur nach Freigabe; vorher erklärt die Hinweiszeile den Zustand */}
              {identityUnlocked && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {phone && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.location.href = `tel:${phone}`}>
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{phone}</TooltipContent>
                    </Tooltip>
                  )}
                  {email && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.location.href = `mailto:${email}`}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{email}</TooltipContent>
                    </Tooltip>
                  )}
                  {linkedinUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(linkedinUrl, '_blank')}>
                          <Linkedin className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>LinkedIn</TooltipContent>
                    </Tooltip>
                  )}
                  {cvUrl ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(cvUrl, '_blank')}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('bewerber.detail.cv_open')}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 opacity-40 cursor-not-allowed" disabled>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('bewerber.detail.cv_missing')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>

            {/* Fakten */}
            <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <KeyFactChip icon={GraduationCap} label="Seniorität" value={fmtSeniority(seniority)} faded={isPlaceholder(seniority)} />
              <KeyFactChip icon={Briefcase} label="Erfahrung" value={experience} faded={isPlaceholder(experience)} />
              <KeyFactChip icon={Banknote} label="Gehaltswunsch" value={gehalt} faded={isPlaceholder(gehalt)} />
              {budget && <KeyFactChip icon={Banknote} label="Ihre Stelle" value={budget} />}
              <KeyFactChip icon={Clock} label="Verfügbar" value={verfuegbar} faded={isPlaceholder(verfuegbar)} />
              <KeyFactChip icon={MapPin} label="Region" value={region} faded={isPlaceholder(region)} />
              <KeyFactChip icon={Globe} label="Arbeitsmodell" value={enrichedWorkModel} faded={isPlaceholder(workModel)} />
            </div>

            {/* Skills */}
            <div className="flex flex-wrap items-center gap-1 mt-3">
              {topSkills.slice(0, 8).map((skill: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                  {skill}
                </Badge>
              ))}
              {topSkills.length > 8 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">+{topSkills.length - 8} weitere</span>
              )}
            </div>

            {/* Wer den Kandidaten eingereicht hat */}
            {submitter && (
              <div className="mt-3 pt-3 border-t flex items-center gap-2.5">
                <Avatar className="h-7 w-7">
                  {submitter.photo && <AvatarImage src={submitter.photo} alt="" />}
                  <AvatarFallback className="bg-primary/10 text-[11px] text-primary">{initialsOf(hhName)}</AvatarFallback>
                </Avatar>
                <p className="text-sm text-muted-foreground flex-1 min-w-0">
                  Eingereicht von <span className="font-medium text-foreground">{hhName}</span>
                  {submitter.company ? ` · ${submitter.company}` : ' · Headhunter'}
                  {submitter.tierLabel ? ` · ${submitter.tierLabel}` : ''}
                  {subState?.submittedAt ? ` · am ${format(new Date(subState.submittedAt), 'dd.MM.yyyy', { locale: de })}` : ''}
                  {submitter.candidates && submitter.candidates > 1 ? ` · hat ${submitter.candidates} Kandidaten für diese Stelle` : ''}
                </p>
                {!isViewer && !isTerminal && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowFrage(true)}>
                    Frage stellen
                  </Button>
                )}
              </div>
            )}

            {/* Ihre Aufgaben · läuft bei anderen (wie „AUFGABEN“ im Headhunter-Profil) */}
            {!isViewer && clientTasks.data && (clientTasks.data.tasks.length > 0 || clientTasks.data.waiting.length > 0) && (
              <div className="mt-3 border-t pt-3">
                <ProfileTaskCards tasks={clientTasks.data.tasks} waiting={clientTasks.data.waiting} onOpen={openTask} onOpenWaiting={(w) => openWaiting(w.key)} />
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* ZONE 2 — WAS JETZT                                               */}
        {/* ================================================================ */}
        {/* Mit Aufgaben-Karten im Kopf (23.10.2026) wird die Box zur schlichten Werkzeugzeile:
            Satz und Entscheidungs-Knöpfe stehen dann in der Karte bzw. im Aufgaben-Fenster. */}
        <div className={cn(
          'rounded-xl border p-4',
          taskCardsShown ? 'bg-transparent' :
          state.tone === 'warn' ? 'bg-warning/10 border-warning/20' :
          state.tone === 'crit' ? 'bg-destructive/10 border-destructive/20' :
          'bg-muted/30'
        )}>
          <div className="flex flex-wrap items-center gap-3">
            {!taskCardsShown && <p className="text-sm flex-1 min-w-[240px]">{ctxFor()}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {isViewer && (
                <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> {t('bewerber.detail.readonly')}
                </Badge>
              )}
              {!isViewer && !isTerminal && (
                <>
                  {taskCardsShown ? null : isPendingCandidate ? (
                    <PendingRequestStatus submissionId={submissionId} jobTitle={jobTitle} />
                  ) : !offerFlow && (
                    <Button size="sm" onClick={runPrimary} className="gap-1.5">
                      <PrimaryIcon className="h-3.5 w-3.5" />
                      {t(primary.labelKey, state.params)}
                    </Button>
                  )}
                  {!taskCardsShown && state.key === 'naechste_runde' && (
                    <Button variant="outline" size="sm" onClick={() => setShowOffer(true)}>Direkt Angebot machen</Button>
                  )}
                  {!taskCardsShown && (state.key === 'unsicher' || state.key === 'angebot_vorbereiten') && (
                    <Button variant="outline" size="sm" onClick={() => setShowInterviewDialog(true)}>Interview {nextRoundNo} planen</Button>
                  )}
                  {!signedContract && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => setShowRejectDialog(true)}
                    >
                      <X className="h-3.5 w-3.5" />
                      {t('bewerber.actions.reject')}
                    </Button>
                  )}
                  {showAgendaLink && !taskCardsShown && (
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                      <Link to="/dashboard/interviews">{t('bewerber.detail.agenda')}</Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground gap-1.5"
                    onClick={() => setShowFrage(true)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Frage an {hhName}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={() => void downloadCv()} disabled={pdfBusy}>
                {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Lebenslauf (PDF)
              </Button>
              {!isViewer && user && (
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={() => setShowAsk(true)}>
                  <Users className="h-3.5 w-3.5" />
                  Kollegen fragen
                </Button>
              )}
            </div>
          </div>
          {offerFlow && !isViewer && (subState?.offers?.[0]?.status === 'accepted'
            ? <ContractTimeline submissionId={submissionId} onOpen={() => setContractOpen(null)} />
            : <OfferStand submissionId={submissionId} onOpen={() => setOfferWin(true)} />
          )}
        </div>

        {!isViewer && !isTerminal && <RecommendationCard submissionId={submissionId} onOffer={() => setShowOffer(true)} />}

        {/* ================================================================ */}
        {/* ZONE 3+4 — PASSUNG (links) · WERDEGANG & PROFIL (rechts)         */}
        {/* Nebeneinander, damit der Werdegang ohne Scrollen sichtbar ist    */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Links: Gespräch mit dem Headhunter, darunter die Einschätzung (Text, immer offen) */}
          <div className="space-y-4">
            {candidateView.recruiterNotes?.trim() && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Empfehlung von {hhName}</h3>
                  <p className="text-sm leading-6">„{candidateView.recruiterNotes.trim()}“</p>
                </CardContent>
              </Card>
            )}
            <InterviewInsightsCard interview={iv} recruiterNotes={null} recruiterName={submitter?.name ?? null} />
            <FitTextCard fit={fit} />
            <MussKriterienCard assessment={fit.assessment} />
          </div>

          <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {t('bewerber.detail.career')}
                {!identityUnlocked && (
                  <span className="text-[10px] font-normal text-muted-foreground flex items-center gap-1 ml-auto">
                    <Lock className="h-3 w-3" />
                    {t('bewerber.detail.companies_after_optin')}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CandidateExperienceTimeline
                candidateId={candidateId}
                submissionId={submissionId}
                anonymized={!identityUnlocked}
                empty={{
                  title: 'Noch keine Stationen hinterlegt',
                  text: 'Der Headhunter hat den Werdegang noch nicht eingetragen. Fragen Sie gern nach.',
                  action: (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFrage(true)}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      Werdegang bei {hhName} anfragen
                    </Button>
                  ),
                }}
              />
            </CardContent>
          </Card>

          <EducationCard education={insights?.education ?? []} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('bewerber.detail.profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {industryExperience.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.branchen')}</p>
                  <div className="flex flex-wrap gap-1">
                    {industryExperience.map((ie, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal">{ie}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {targetRoles.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.zielrollen')}</p>
                  <div className="flex flex-wrap gap-1">
                    {targetRoles.map((tr, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal">{tr}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {languageSkills.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.sprachen')}</p>
                  <div className="flex flex-wrap gap-1">
                    {languageSkills.map((ls, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal">
                        {ls.level ? `${ls.language} (${ls.level})` : ls.language}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {certifications.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.zertifikate')}</p>
                  <div className="flex flex-wrap gap-1">
                    {certifications.map((cert, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal text-amber-600 border-amber-400/50">{cert}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {careerGoals && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.karriereziele')}</p>
                  <p className="text-xs text-muted-foreground">{careerGoals}</p>
                </div>
              )}
              {identityUnlocked ? (
                cvUrl ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(cvUrl, '_blank')}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    {t('bewerber.detail.cv_open')}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {t('bewerber.detail.cv_missing')}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  {t('bewerber.detail.cv_locked')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Fragen an den Headhunter */}
          {submitter && (
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Fragen an {hhName}</h3>
                {(questions.data?.messages.length ?? 0) > 0 ? (
                  <QuestionThreadList messages={questions.data!.messages} name={hhName} />
                ) : (
                  <p className="text-sm text-muted-foreground">Noch keine Fragen. {hhName} hat den Kandidaten eingereicht und kennt ihn aus dem Gespräch.</p>
                )}
                {!isViewer && !isTerminal && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowFrage(true)}>
                    Frage stellen
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* ZONE 5 — VERLAUF                                                 */}
        {/* ================================================================ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('bewerber.detail.verlauf')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verlauf.length === 0 ? (
              <p className="text-xs text-muted-foreground">–</p>
            ) : (
              <div className="space-y-2.5">
                {verlauf.map((e, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                    <div>
                      <span className="text-[11px] text-muted-foreground/70">
                        {format(new Date(e.when), 'dd.MM.yyyy', { locale: de })}
                      </span>
                      <p className="text-sm leading-tight">{e.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ================================================================ */}
        {/* NOTIZEN                                                          */}
        {/* ================================================================ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {t('bewerber.notes.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Textarea
                placeholder={teamMembers.length > 1 ? 'Notiz hinzufügen … (@ erwähnt Teammitglieder)' : 'Notiz hinzufügen …'}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              {mentionSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
                  {mentionSuggestions.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => applyMention(m.full_name!)}
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground">{m.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || commentLoading}
              size="sm"
              className="w-full"
            >
              {commentLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
            <p className="text-[10px] text-muted-foreground/60">{t('bewerber.notes.visibility')}</p>

            {comments.length > 0 && (
              <ScrollArea className="max-h-48">
                <div className="space-y-2 pt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-sm">{renderCommentContent(comment.content)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {memberName(comment.user_id) ? `${memberName(comment.user_id)} · ` : ''}
                        {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Footer-Hinweis nur solange die Identität gesperrt ist; EU-AI-Act-Hinweis steht in der Fit-Analyse */}
        {!identityUnlocked && (
          <p className="text-xs text-muted-foreground/60 text-center py-3">
            Anonymisiertes Profil — nach der Interview-Zusage werden Name, Kontakt und Lebenslauf freigeschaltet.
          </p>
        )}
      </div>

      {/* Dialogs */}
      {user && (
        <AskColleaguesDialog
          open={showAsk}
          onOpenChange={setShowAsk}
          members={teamMembers as TeamMember[]}
          currentUserId={user.id}
          organizationId={myOrg?.id ?? null}
          jobId={jobId}
          jobTitle={jobTitle}
          onSend={askColleagues}
        />
      )}
      <FrageSheet
        open={showFrage}
        onOpenChange={setShowFrage}
        submitter={submitter}
        submissionId={submissionId}
        jobId={jobId}
        candidateId={candidateId}
        jobTitle={jobTitle}
        code={anonCode}
        role={currentRole}
        identityUnlocked={identityUnlocked}
        noticeFallback={availability}
      />
      <RejectionDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        submission={{
          id: submissionId,
          candidate: { id: candidateId, full_name: displayName, email: email || '' },
          job: { id: jobId, title: jobTitle, company_name: '' }
        }}
        onSuccess={() => { setShowRejectDialog(false); refetch(); }}
      />

      <InterviewRequestDialog
        open={showInterviewDialog}
        onOpenChange={setShowInterviewDialog}
        submissionId={submissionId}
        replacesInterviewId={requestReplaces}
        onSent={() => { setShowInterviewDialog(false); setRequestReplaces(null); refetch(); }}
      />

      {/* Angebot: ein Fenster (24.10.2026) */}
      <OfferTaskWindow submissionId={submissionId} open={offerWin} onOpenChange={setOfferWin}
        onAdjust={() => setShowOffer(true)} onReject={() => setShowRejectDialog(true)} onContract={() => setContractOpen(null)} />

      {/* Arbeitsvertrag: ein Fenster für alles (24.10.2026) */}
      <ContractTaskWindow submissionId={submissionId} open={!!contractWin} onOpenChange={(o) => { if (!o) setContractWin(null); }}
        intent={contractWin?.intent ?? null} returnEvent={contractWin?.returnEvent ?? null} task={contractWin?.task ?? null} />

      {/* Aufgaben-Fenster (23.10.2026) */}
      <ClientTaskWindow task={activeTask} open={!!activeTask} onOpenChange={(o) => { if (!o) setActiveTask(null); }} handlers={taskHandlers} recruiterName={hhName} />

      <OfferDialog submissionId={submissionId} open={showOffer} onOpenChange={setShowOffer} onSent={() => refetch()} />

      <FeedbackDialog
        interviewId={feedbackFor}
        open={!!feedbackFor}
        onOpenChange={(o) => !o && setFeedbackFor(null)}
        candidateName={identityUnlocked ? displayName : anonCode}
        onSaved={() => refetch()}
        context={clientTasks.data?.tasks.find((x) => x.kind === 'feedback' && x.ref.interviewId === feedbackFor)?.context ?? null}
        onNext={(way) => {
          if (way === 'next_round') setShowInterviewDialog(true);
          if (way === 'offer') setShowOffer(true);
          if (way === 'reject') setShowRejectDialog(true);
        }}
      />
    </DashboardLayout>
  );
}
