import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CandidateSubmitForm } from '@/components/recruiter/CandidateSubmitForm';
import { CompanyRevealBadge } from '@/components/recruiter/CompanyRevealBadge';
import { getDisplayCompanyName } from '@/lib/anonymousCompanyFormat';
import { JobFactsBar } from '@/components/recruiter/JobFactsBar';
import { JobOpenPoints } from '@/components/recruiter/JobOpenPoints';
import { AnonymousCompanyPitch } from '@/components/recruiter/AnonymousCompanyPitch';
import { RoleSummaryCard } from '@/components/recruiter/RoleSummaryCard';
import { SkillsDisplay } from '@/components/recruiter/SkillsDisplay';
import { FeeCalculatorCard } from '@/components/recruiter/FeeCalculatorCard';
import { SellingPointsCard } from '@/components/recruiter/SellingPointsCard';
import { JobStatsCard } from '@/components/recruiter/JobStatsCard';
import { AnonymousExposeDialog } from '@/components/recruiter/AnonymousExposeDialog';
import { PartnerFactsCard } from '@/components/recruiter/PartnerFactsCard';
import { JobCandidateProcessCards, JobSubmission } from '@/components/recruiter/JobCandidateProcessCards';
import {
  JobIntakeDetails, hatAufnahme, zeilenDerAufnahme, abschnitteDerAufnahme,
} from '@/components/recruiter/JobIntakeDetails';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  MapPin,
  Clock,
  ArrowLeft,
  Flame,
  Zap,
  Circle,
  Users,
  Loader2,
  Star,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FormattedContent {
  headline: string;
  highlights: string[];
  role_summary: string;
  ideal_candidate: string;
  selling_points: string[];
  urgency_note: string | null;
  anonymous_company_pitch?: string;
  quick_facts?: {
    team_size: string | null;
    growth_stage: string | null;
    culture_keywords: string[];
    interview_process: string | null;
  };
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string;
  requirements: string;
  location: string;
  remote_type: string;
  employment_type: string;
  experience_level: string;
  salary_min: number | null;
  salary_max: number | null;
  fee_percentage: number;
  recruiter_fee_percentage: number;
  skills: string[];
  must_haves: string[];
  nice_to_haves: string[];
  screening_questions: any;
  deadline: string | null;
  urgency: string;
  industry: string;
  created_at: string;
  formatted_content: FormattedContent | null;
  // Neue Felder für kontextreiche Anonymisierung
  company_size_band: string | null;
  funding_stage: string | null;
  hiring_urgency: string | null;
  tech_environment: string[] | null;
  // Spalten, die recruiter_jobs_view seit jeher liefert und die bis heute
  // nirgends gerendert wurden -- der Recruiter sah sie nie.
  benefits: string[] | null;
  // jsonb in der Datenbank: mal ["Deutsch C1"], mal [{code,minLevel}].
  // Die Normalisierung passiert in JobFactsBar.
  required_languages: any;
  required_certifications: any;
  onsite_required: boolean | null;
  onsite_days_required: number | null;
  remote_policy: string | null;
  job_summary: any;
  // Die generierten Supabase-Typen sind aelter als Migration 20260829120000
  // und kennen die Contracting-Spalten der View nicht. Zur Laufzeit liefert
  // `select('*')` sie mit, deshalb optional statt Cast.
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  // Dieselbe Lage fuer die Katalogspalten: sie stehen in der View, aber die
  // generierten Typen kennen sie noch nicht.
  vacancy_reason?: string | null;
  daily_routine?: string | null;
  decision_makers?: string[] | null;
  team_size?: number | null;
  company_headcount?: number | null;
  // Der Rest des Fragenkatalogs. Alle stehen seit 20260905090000 in
  // recruiter_jobs_view; `select('*')` liefert sie mit, die generierten
  // Typen kennen sie nicht. Gerendert von JobIntakeDetails.
  negative_impact_if_unfilled?: string | null;
  must_have_criteria?: string[] | null;
  trainable_skills?: string[] | null;
  nice_to_have_criteria?: string[] | null;
  task_focus?: string | null;
  task_breakdown?: unknown;
  success_profile?: string | null;
  failure_profile?: string | null;
  department_structure?: string | null;
  reports_to?: string | null;
  company_culture?: string | null;
  salary_months?: number | null;
  bonus_structure?: string | null;
  contract_limitation?: string | null;
  contract_duration_months?: number | null;
  utilization_days_per_week?: number | null;
  extension_possible?: boolean | null;
  career_path?: string | null;
  career_example?: string | null;
  unique_selling_points?: string[] | null;
  position_advantages?: string[] | null;
  core_hours?: string | null;
  core_hours_detail?: string | null;
  overtime_policy?: string | null;
  time_tracking_method?: string | null;
  works_council?: boolean | null;
  works_council_meeting_schedule?: string | null;
  contract_creation_days?: number | null;
  contract_sent_digitally?: boolean | null;
  contract_sensitive_topics?: string | null;
  industry_opportunities?: string | null;
  industry_challenges?: string | null;
}

// Triple-Blind Reveal Status für diesen Job
interface RecruiterAccessStatus {
  hasSubmission: boolean;
  companyRevealed: boolean;
  fullAccessGranted: boolean;
}

interface Submission {
  id: string;
  candidate_id: string;
  status: string;
  stage: string | null;
  submitted_at: string;
  match_score: number | null;
  company_revealed: boolean;
  full_access_granted: boolean;
  candidates: {
    full_name: string;
    email: string;
    job_title: string | null;
  };
}

interface CompanyProfile {
  headcount: number | null;
  annual_revenue: string | null;
  founded_year: number | null;
  unique_selling_point: string | null;
  company_awards: string[] | null;
  industry: string | null;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [showExposeDialog, setShowExposeDialog] = useState(false);
  /* Welcher Reiter offen ist. `null` heisst: der Recruiter hat noch nicht
     gewaehlt, dann entscheidet die Datenlage (siehe `ansicht` unten).
     Ein useEffect waere hier falsch: er wuerde die Wahl des Recruiters
     beim naechsten Nachladen des Jobs wieder ueberschreiben. */
  const [reiter, setReiter] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<RecruiterAccessStatus>({
    hasSubmission: false,
    companyRevealed: false,
    fullAccessGranted: false,
  });

  useEffect(() => {
    if (id) {
      fetchJobDetails();
    }
  }, [id]);

  // Automatische AI-Aufbereitung wenn formatted_content fehlt
  useEffect(() => {
    const autoFormatJob = async () => {
      if (job && !job.formatted_content && !isFormatting && !loading) {
        setIsFormatting(true);
        try {
          await supabase.functions.invoke('format-job-for-recruiters', {
            body: { jobId: job.id }
          });
          await fetchJobDetails();
        } catch (e) {
          console.error('Auto-format failed:', e);
        } finally {
          setIsFormatting(false);
        }
      }
    };
    
    autoFormatJob();
  }, [job?.id, job?.formatted_content, loading]);

  const fetchJobDetails = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('recruiter_jobs_view')
        .select('*')
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      // Cast formatted_content from JSON to our interface
      const typedJob = {
        ...jobData,
        formatted_content: jobData.formatted_content as unknown as FormattedContent | null
      };
      setJob(typedJob);

      // Kein company_profiles-Fetch mehr: recruiter_jobs_view liefert bewusst
      // keine client_id, und company_profiles ist fuer Recruiter ohnehin per
      // RLS gesperrt (der Aufruf lieferte immer 0 Zeilen).

      // Fetch my submissions for this job
      if (user) {
        const { data: mySubsData } = await supabase
          .from('submissions')
          .select(`
            id,
            candidate_id,
            status,
            stage,
            submitted_at,
            match_score,
            company_revealed,
            full_access_granted,
            candidates (
              full_name,
              email,
              job_title
            )
          `)
          .eq('job_id', id)
          .eq('recruiter_id', user.id);

        const submissions = mySubsData as Submission[] || [];
        setMySubmissions(submissions);

        // Bestimme den höchsten Zugriffsstatus basierend auf allen Submissions
        const hasAnySubmission = submissions.length > 0;
        const hasRevealedSubmission = submissions.some(s => s.company_revealed);
        const hasFullAccessSubmission = submissions.some(s => s.full_access_granted);

        setAccessStatus({
          hasSubmission: hasAnySubmission,
          companyRevealed: hasRevealedSubmission,
          fullAccessGranted: hasFullAccessSubmission,
        });

        // Count total submissions
        const { count } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', id);

        setTotalSubmissions(count || 0);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Not specified';
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`;
    if (min) return `From €${min.toLocaleString()}`;
    return `Up to €${max?.toLocaleString()}`;
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'hot':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <Flame className="h-3 w-3 mr-1" /> Hot
          </Badge>
        );
      case 'urgent':
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Zap className="h-3 w-3 mr-1" /> Urgent
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Circle className="h-3 w-3 mr-1" /> Standard
          </Badge>
        );
    }
  };

  const calculatePotentialEarning = () => {
    if (!job) return null;
    const avgSalary = job.salary_min && job.salary_max 
      ? (job.salary_min + job.salary_max) / 2 
      : job.salary_min || job.salary_max;
    if (!avgSalary) return null;
    return Math.round(avgSalary * (job.recruiter_fee_percentage / 100));
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
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Job not found</h2>
          <Link to="/recruiter/jobs">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Jobs
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const potentialEarning = calculatePotentialEarning();
  const formattedContent = job.formatted_content;

  /* Der Startreiter folgt der Datenlage: liegt eine Aufnahme vor, ist sie das
     Erste, was der Recruiter sieht -- sie ist die einzige bestaetigte Quelle
     auf dieser Seite. Auf Altbestand ohne Aufnahme waere ein leerer Reiter
     als Startseite eine Zumutung, dort oeffnet der Ueberblick. */
  const aufnahmeVorhanden = hatAufnahme(job);
  const reiterZeilen = zeilenDerAufnahme(job);
  const ansicht = reiter ?? (abschnitteDerAufnahme(job) > 1 ? 'aufnahme' : 'ueberblick');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link to="/recruiter/jobs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück zu Jobs
          </Button>
        </Link>

        {/* Hero Section — clean */}
        <div className="rounded-xl border bg-card p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2">
              {/* AI Headline or Job Title */}
              {/* Der Titel ist der echte Titel aus der Datenbank, nicht die
                  KI-Headline. Gemessen an einem echten Job stand oben
                  "Senior Backend Developer -- Tech-Hub Muenchen", waehrend die
                  Stelle "Senior Softwareentwickler Backend" heisst und
                  experience_level = 'mid' ist. Der Recruiter sourct sonst
                  Senior-Profile fuer ein Mid-Budget, und "Tech-Hub Muenchen"
                  gibt es nicht. */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-bold">{job.title}</h1>
                {(job.urgency === 'hot' || job.urgency === 'urgent') && getUrgencyBadge(job.urgency)}
              </div>

              {/* Triple-Blind: Show company based on reveal status */}
              <div className="flex items-center gap-2 text-base text-muted-foreground">
                <CompanyRevealBadge
                  companyRevealed={accessStatus.companyRevealed}
                  fullAccess={accessStatus.fullAccessGranted}
                  showLabel={true}
                  size="sm"
                />
                <span>
                  {getDisplayCompanyName(
                    job.company_name,
                    job.industry,
                    accessStatus.companyRevealed,
                    {
                      industry: job.industry,
                      companySize: job.company_size_band,
                      fundingStage: job.funding_stage,
                      techStack: job.tech_environment,
                      location: job.location,
                      urgency: job.hiring_urgency,
                      remoteType: job.remote_type,
                    }
                  )}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {job.employment_type}
                </span>
                <Badge variant="secondary" className="capitalize">
                  {job.remote_type}
                </Badge>
                {job.industry && (
                  <Badge variant="outline">{job.industry}</Badge>
                )}
              </div>

            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Dialog open={showSubmitForm} onOpenChange={setShowSubmitForm}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="emerald">
                    <Users className="h-4 w-4 mr-2" />
                    Kandidat einreichen
                  </Button>
                </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Kandidat für {job.title} einreichen</DialogTitle>
                    </DialogHeader>
                    <CandidateSubmitForm 
                      jobId={job.id} 
                      jobTitle={job.title}
                      mustHaves={job.must_haves}
                      onSuccess={() => {
                        setShowSubmitForm(false);
                        fetchJobDetails();
                      }}
                    />
                  </DialogContent>
                </Dialog>
            </div>
          </div>
        </div>

        {/* Candidate Process Cards */}
        {mySubmissions.length > 0 && (
          <JobCandidateProcessCards
            submissions={mySubmissions as JobSubmission[]}
            onOpenSubmitForm={() => setShowSubmitForm(true)}
          />
        )}

        {/* Eckdaten in einer Zeile -- nur belegte Spalten, keine erfundenen
            quick_facts mehr. Siehe Kommentar in JobFactsBar. */}
        <JobFactsBar
          facts={{
            salaryMin: job.salary_min,
            salaryMax: job.salary_max,
            dayRateMin: job.day_rate_min,
            dayRateMax: job.day_rate_max,
            onsiteRequired: job.onsite_required,
            onsiteDaysRequired: job.onsite_days_required,
            remotePolicy: job.remote_policy,
            remoteType: job.remote_type,
            requiredLanguages: job.required_languages,
            requiredCertifications: job.required_certifications,
            experienceLevel: job.experience_level,
            companySizeBand: job.company_size_band,
            deadline: job.deadline,
          }}
        />

        {/* Die Stelle traegt zwei verschiedene Dokumente: was der Kunde im
            Briefing gesagt hat, und was ein Modell aus der Anzeige geschrieben
            hat. Untereinander gehaengt las sich das Zweite wie das Erste --
            und die Aufnahme stand bei 80 % der Seitenhoehe. Als Reiter werden
            daraus zwei gleichrangige Ansichten, zwischen denen der Recruiter
            waehlt. Die Seitenleiste bleibt stehen: Honorar, offene Punkte und
            Screening sind Entscheidungshilfen, kein Lesestoff. */}
        <Tabs value={ansicht} onValueChange={setReiter} className="space-y-6">
          <TabsList>
            <TabsTrigger value="aufnahme" className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Aus der Aufnahme
              {reiterZeilen > 0 && (
                <span className="ml-0.5 text-xs tabular-nums opacity-60">{reiterZeilen}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="ueberblick" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Überblick
            </TabsTrigger>
          </TabsList>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - 60% */}
          <div className="lg:col-span-2 space-y-6">

            <TabsContent value="aufnahme" className="mt-0 space-y-6">
              {aufnahmeVorhanden ? (
                <JobIntakeDetails job={job} isRevealed={accessStatus.companyRevealed} />
              ) : (
                /* Kein Platzhaltertext, sondern der Grund: diese Stellen sind
                   angelegt worden, bevor die Antworten des Fragenkatalogs in
                   die Stelle geschrieben wurden. Sonst haelt der Recruiter
                   eine alte Stelle fuer eine schlecht gebriefte. */
                <Card>
                  <CardContent className="py-8 text-center">
                    <ClipboardCheck className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium">Zu dieser Stelle liegt keine Aufnahme vor</p>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                      Sie wurde angelegt, bevor die Antworten aus dem Briefing-Gespräch
                      in die Stelle geschrieben wurden. Was der Überblick zeigt, stammt
                      aus der Stellenanzeige.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ueberblick" className="mt-0 space-y-6">
            {/* Was ab hier folgt, hat ein Modell aus der Anzeige geschrieben --
                nicht der Kunde gesagt. Ohne diese Zeile liest der Recruiter
                Erfundenes und Belegtes in derselben Schrift. */}
            {formattedContent && (
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Aus der Anzeige erzeugt — nicht vom Kunden bestätigt
              </p>
            )}

            {formattedContent?.highlights && formattedContent.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formattedContent.highlights.map((highlight, i) => (
                  <Badge key={i} variant="outline" className="bg-muted/50">
                    <Star className="h-3 w-3 mr-1 text-amber-500" />
                    {highlight}
                  </Badge>
                ))}
              </div>
            )}

            {/* Anonymous Company Pitch */}
            <AnonymousCompanyPitch
              pitch={formattedContent?.anonymous_company_pitch || null}
              industry={job.industry}
              companySize={job.company_size_band}
              fundingStage={job.funding_stage}
              isRevealed={accessStatus.companyRevealed}
              companyName={job.company_name}
            />

            {/* Partner Facts - Company selling points */}
            {companyProfile && (
              <PartnerFactsCard facts={companyProfile} />
            )}
            <RoleSummaryCard
              roleSummary={formattedContent?.role_summary || null}
              idealCandidate={formattedContent?.ideal_candidate || null}
              mustHaves={job.must_haves}
              niceToHaves={job.nice_to_haves}
              isAIGenerated={!!formattedContent?.role_summary}
            />

            {/* Description (fallback if no AI content) */}
            {!formattedContent?.role_summary && job.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Stellenbeschreibung</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                    {job.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Requirements - only show if no AI content */}
            {!formattedContent?.role_summary && job.requirements && (
              <Card>
                <CardHeader>
                  <CardTitle>Anforderungen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                    {job.requirements}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Skills Display */}
            <SkillsDisplay 
              skills={job.skills} 
              techEnvironment={job.tech_environment}
            />

            </TabsContent>

          </div>

          {/* Sidebar - 40% */}
          <div className="space-y-4">
            {/* Fee Calculator - NEW Component */}
            <FeeCalculatorCard
              feePercentage={job.recruiter_fee_percentage}
              salaryMin={job.salary_min}
              salaryMax={job.salary_max}
            />

            {/* Selling Points - NEW Component */}
            <SellingPointsCard
              sellingPoints={formattedContent?.selling_points || null}
              highlights={formattedContent?.highlights}
              onGenerateExpose={() => setShowExposeDialog(true)}
            />

            {/* Job Stats - NEW Component */}
            <JobStatsCard
              location={job.location}
              remoteType={job.remote_type}
              employmentType={job.employment_type}
              experienceLevel={job.experience_level}
              totalSubmissions={mySubmissions.length}
              salaryMin={job.salary_min}
              salaryMax={job.salary_max}
            />

            <JobOpenPoints
              punkte={[
                /* Diese vier standen fest auf `false`, weil es zu ihnen keine
                   Spalte gab -- der Fragenkatalog erhob sie, aber
                   draftToJobRow schrieb sie nicht. Seit die Katalogantworten
                   in jobs ankommen, gibt es die Werte. Ein hartes `false`
                   wuerde jetzt das Gegenteil behaupten: "nicht erhoben" ueber
                   etwas, das der Kunde beantwortet hat. */
                { frage: 'Warum ist die Stelle offen?',
                  vorhanden: !!job.vacancy_reason },
                /* daily_routine steht in der View hinter dem Reveal-Gate --
                   vor dem Reveal liest die Seite NULL, obwohl der Wert da ist. */
                { frage: 'Woran arbeitet die Person in den ersten 90 Tagen?',
                  vorhanden: !!job.daily_routine,
                  gesperrt: !job.daily_routine && !accessStatus.companyRevealed },
                { frage: 'Wie viele Gespräche bis zur Zusage, wer entscheidet?',
                  vorhanden: !!job.decision_makers?.length },
                /* `> 0`, nicht `!= null`: auf Altbestand steht dort -1 fuer
                   "nicht ermittelt". Als "erhoben" gemeldet, sucht der
                   Recruiter die Zahl auf der Seite und findet keine. */
                { frage: 'Wie groß ist das Team?',
                  vorhanden: (job.team_size ?? 0) > 0 },
                { frage: 'Gehaltsband', vorhanden: job.salary_min != null || job.salary_max != null },
                { frage: 'Sprachanforderung', vorhanden: !!job.required_languages?.length },
                { frage: 'Benefits', vorhanden: !!job.benefits?.length },
              ]}
            />

            {/* Screening Questions */}
            {job.screening_questions && Object.keys(job.screening_questions).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Screening-Fragen</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {Object.entries(job.screening_questions).map(([key, value]) => (
                      <li key={key} className="text-muted-foreground">
                        • {String(value)}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Urgency Note */}
            {formattedContent?.urgency_note && (
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="pt-4">
                  <p className="text-sm text-destructive font-medium flex items-center gap-2">
                    <Flame className="h-4 w-4" />
                    {formattedContent.urgency_note}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        </Tabs>
      </div>

      {/* Anonymous Expose Dialog */}
      <AnonymousExposeDialog
        open={showExposeDialog}
        onOpenChange={setShowExposeDialog}
        jobId={job.id}
      />

    </DashboardLayout>
  );
}
