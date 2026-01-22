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
import { RecruiterQuickFacts } from '@/components/recruiter/RecruiterQuickFacts';
import { AnonymousCompanyPitch } from '@/components/recruiter/AnonymousCompanyPitch';
import { RoleSummaryCard } from '@/components/recruiter/RoleSummaryCard';
import { SkillsDisplay } from '@/components/recruiter/SkillsDisplay';
import { FeeCalculatorCard } from '@/components/recruiter/FeeCalculatorCard';
import { SellingPointsCard } from '@/components/recruiter/SellingPointsCard';
import { JobStatsCard } from '@/components/recruiter/JobStatsCard';
import { PartnerFactsCard } from '@/components/recruiter/PartnerFactsCard';
import {
  MapPin,
  Clock,
  ArrowLeft,
  Flame,
  Zap,
  Circle,
  Users,
  Building2,
  Loader2,
  Star,
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
  submitted_at: string;
  company_revealed: boolean;
  full_access_granted: boolean;
  candidates: {
    full_name: string;
    email: string;
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
        .from('jobs')
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

      // Fetch company profile for Partner Facts
      if (jobData.client_id) {
        const { data: profileData } = await supabase
          .from('company_profiles')
          .select('headcount, annual_revenue, founded_year, unique_selling_point, company_awards, industry')
          .eq('user_id', jobData.client_id)
          .maybeSingle();

        if (profileData) {
          setCompanyProfile(profileData);
        }
      }

      // Fetch my submissions for this job
      if (user) {
        const { data: mySubsData } = await supabase
          .from('submissions')
          .select(`
            id,
            candidate_id,
            status,
            submitted_at,
            company_revealed,
            full_access_granted,
            candidates (
              full_name,
              email
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link to="/recruiter/jobs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück zu Jobs
          </Button>
        </Link>

        {/* Hero Section with AI-formatted headline */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-background to-emerald/10 border">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
          <div className="relative p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Building2 className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="space-y-2">
                  {/* AI Headline or Job Title */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {formattedContent?.headline ? (
                      <h1 className="text-2xl lg:text-3xl font-bold">
                        {formattedContent.headline}
                      </h1>
                    ) : (
                      <h1 className="text-2xl lg:text-3xl font-bold">{job.title}</h1>
                    )}
                    {getUrgencyBadge(job.urgency || 'standard')}
                  </div>
                  
                  {/* Triple-Blind: Show company based on reveal status */}
                  <div className="flex items-center gap-2 text-lg text-muted-foreground">
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

                  {/* AI Highlights */}
                  {formattedContent?.highlights && formattedContent.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {formattedContent.highlights.map((highlight, i) => (
                        <Badge key={i} variant="outline" className="bg-background/50 backdrop-blur-sm">
                          <Star className="h-3 w-3 mr-1 text-warning" />
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
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
        </div>

        {/* Quick Facts Bar */}
        <RecruiterQuickFacts
          quickFacts={formattedContent?.quick_facts}
          companySize={job.company_size_band}
          fundingStage={job.funding_stage}
          techEnvironment={job.tech_environment}
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - 60% */}
          <div className="lg:col-span-2 space-y-6">
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

            {/* My Submissions */}
            {mySubmissions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Meine Einreichungen ({mySubmissions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mySubmissions.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{sub.candidates?.full_name}</p>
                          <p className="text-sm text-muted-foreground">{sub.candidates?.email}</p>
                        </div>
                        <Badge className={`status-${sub.status}`}>
                          {sub.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
            />

            {/* Job Stats - NEW Component */}
            <JobStatsCard
              location={job.location}
              remoteType={job.remote_type}
              employmentType={job.employment_type}
              experienceLevel={job.experience_level}
              totalSubmissions={totalSubmissions}
              salaryMin={job.salary_min}
              salaryMax={job.salary_max}
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
      </div>

    </DashboardLayout>
  );
}
