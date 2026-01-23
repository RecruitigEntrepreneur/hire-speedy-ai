import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { JobEditDialog } from '@/components/jobs/JobEditDialog';
import { CandidateQuickView } from '@/components/candidates/CandidateQuickView';
import { JobExecutiveSummary } from '@/components/jobs/JobExecutiveSummary';
import { 
  ArrowLeft,
  Briefcase, 
  MapPin, 
  Clock, 
  Users,
  DollarSign,
  Edit2,
  Loader2,
  Calendar,
  Star,
  X,
  Building2,
  Globe,
  Percent,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  BarChart3,
  UserCheck,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  status: string | null;
  created_at: string;
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

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  company: string | null;
  city: string | null;
  expected_salary: number | null;
  current_salary: number | null;
  availability_date: string | null;
  notice_period: string | null;
  experience_years: number | null;
  skills: string[] | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  cv_url: string | null;
  summary: string | null;
  seniority: string | null;
}

interface Submission {
  id: string;
  stage: string;
  status: string | null;
  match_score: number | null;
  submitted_at: string;
  recruiter_notes: string | null;
  candidate: Candidate;
  recruiter: {
    full_name: string | null;
    email: string;
  } | null;
}

interface Interview {
  id: string;
  scheduled_at: string;
  status: string;
  submission_id: string;
}

const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Neu eingegangen', color: 'bg-blue-500' },
  { key: 'screening', label: 'In Prüfung', color: 'bg-yellow-500' },
  { key: 'interview', label: 'Interview', color: 'bg-purple-500' },
  { key: 'second_interview', label: 'Zweitgespräch', color: 'bg-indigo-500' },
  { key: 'offer', label: 'Angebot', color: 'bg-orange-500' },
  { key: 'hired', label: 'Eingestellt', color: 'bg-green-500' },
  { key: 'rejected', label: 'Abgelehnt', color: 'bg-red-500' },
];

const REJECTION_REASONS = [
  'Qualifikation passt nicht',
  'Gehaltsvorstellung zu hoch',
  'Keine Kulturpassung',
  'Andere Kandidaten bevorzugt',
  'Position bereits besetzt',
  'Sonstiges',
];

export default function ClientJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showCandidateView, setShowCandidateView] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const generateSummary = async () => {
    if (!job) return;
    setIsGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-job-summary', {
        body: { jobId: job.id }
      });
      if (error) throw error;
      if (data?.summary) {
        setJob(prev => prev ? { ...prev, job_summary: data.summary } : null);
        toast({ title: 'Summary generiert', description: 'Die Executive Summary wurde erstellt.' });
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({ title: 'Fehler', description: 'Summary konnte nicht generiert werden.', variant: 'destructive' });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  useEffect(() => {
    if (id && user) {
      fetchJobData();
    }
  }, [id, user]);

  const fetchJobData = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('client_id', user?.id)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!jobData) {
        toast({ title: 'Job nicht gefunden', variant: 'destructive' });
        return;
      }

      // Transform jobData to match our Job interface
      setJob({
        ...jobData,
        job_summary: jobData.job_summary as unknown as JobSummary | null,
        intake_completeness: jobData.intake_completeness ?? null
      } as Job);

      // Fetch submissions with candidate and recruiter info
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          id,
          stage,
          status,
          match_score,
          submitted_at,
          recruiter_notes,
          candidate:candidates!inner(
            id,
            full_name,
            email,
            phone,
            job_title,
            company,
            city,
            expected_salary,
            current_salary,
            availability_date,
            notice_period,
            experience_years,
            skills,
            linkedin_url,
            github_url,
            portfolio_url,
            cv_url,
            summary,
            seniority
          ),
          recruiter:profiles!submissions_recruiter_id_fkey(
            full_name,
            email
          )
        `)
        .eq('job_id', id);

      if (submissionsError) throw submissionsError;
      
      const transformedSubmissions = (submissionsData || []).map((s: any) => ({
        ...s,
        candidate: s.candidate,
        recruiter: s.recruiter,
      }));
      
      setSubmissions(transformedSubmissions);

      // Fetch interviews
      const submissionIds = transformedSubmissions.map(s => s.id);
      if (submissionIds.length > 0) {
        const { data: interviewsData } = await supabase
          .from('interviews')
          .select('id, scheduled_at, status, submission_id')
          .in('submission_id', submissionIds)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true });

        setInterviews(interviewsData || []);
      }
    } catch (error) {
      console.error('Error fetching job data:', error);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (submissionId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ stage: newStage })
        .eq('id', submissionId);

      if (error) throw error;
      
      setSubmissions(submissions.map(s => 
        s.id === submissionId ? { ...s, stage: newStage } : s
      ));
      toast({ title: 'Status aktualisiert' });
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({ title: 'Fehler beim Aktualisieren', variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          stage: 'rejected',
          status: 'rejected',
          rejection_reason: rejectionReason 
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;
      
      setSubmissions(submissions.map(s => 
        s.id === selectedSubmission.id ? { ...s, stage: 'rejected', status: 'rejected' } : s
      ));
      setShowRejectDialog(false);
      setSelectedSubmission(null);
      setRejectionReason('');
      toast({ title: 'Kandidat abgelehnt' });
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedSubmission || !interviewDate) return;
    try {
      const { error: interviewError } = await supabase
        .from('interviews')
        .insert({
          submission_id: selectedSubmission.id,
          scheduled_at: interviewDate,
          notes: interviewNotes,
          status: 'scheduled',
        });

      if (interviewError) throw interviewError;

      const { error: updateError } = await supabase
        .from('submissions')
        .update({ stage: 'interview' })
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;
      
      setSubmissions(submissions.map(s => 
        s.id === selectedSubmission.id ? { ...s, stage: 'interview' } : s
      ));
      setShowInterviewDialog(false);
      setSelectedSubmission(null);
      setInterviewDate('');
      setInterviewNotes('');
      fetchJobData(); // Refresh interviews
      toast({ title: 'Interview geplant' });
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast({ title: 'Fehler beim Planen', variant: 'destructive' });
    }
  };

  const openScheduleInterview = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowInterviewDialog(true);
  };

  const openRejectDialog = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowRejectDialog(true);
  };

  const getSubmissionsByStage = (stage: string) => {
    return submissions.filter(s => (s.stage || 'submitted') === stage);
  };

  const formatSalary = (amount: number | null) => {
    if (!amount) return '-';
    return `€${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd.MM.yyyy', { locale: de });
  };

  // Stats
  const totalSubmissions = submissions.length;
  const inProcess = submissions.filter(s => !['rejected', 'hired'].includes(s.stage || '')).length;
  const interviewed = submissions.filter(s => ['interview', 'second_interview', 'offer', 'hired'].includes(s.stage || '')).length;
  const hired = submissions.filter(s => s.stage === 'hired').length;

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
          <h2 className="text-xl font-semibold">Job nicht gefunden</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard/jobs">Zurück zur Übersicht</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <Link 
          to="/dashboard/jobs" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Job-Übersicht
        </Link>

        {/* Job Header Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Building2 className="h-4 w-4" />
                    {job.company_name}
                    {job.location && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={
                  job.status === 'published' ? 'default' :
                  job.status === 'closed' ? 'destructive' :
                  job.paused_at ? 'secondary' : 'outline'
                }>
                  {job.paused_at ? 'Pausiert' : 
                   job.status === 'published' ? 'Aktiv' :
                   job.status === 'closed' ? 'Geschlossen' : 'Entwurf'}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{totalSubmissions}</p>
                <p className="text-xs text-muted-foreground">Kandidaten</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{inProcess}</p>
                <p className="text-xs text-muted-foreground">In Bearbeitung</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{interviewed}</p>
                <p className="text-xs text-muted-foreground">Interviewt</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{hired}</p>
                <p className="text-xs text-muted-foreground">Eingestellt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Übersicht</span>
            </TabsTrigger>
            <TabsTrigger value="candidates" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Kandidaten</span>
              <Badge variant="secondary" className="ml-1 text-xs">{totalSubmissions}</Badge>
            </TabsTrigger>
            <TabsTrigger value="interviews" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Interviews</span>
              <Badge variant="secondary" className="ml-1 text-xs">{interviews.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Statistiken</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <JobExecutiveSummary
              summary={job.job_summary}
              intakeCompleteness={job.intake_completeness || 0}
              isGenerating={isGeneratingSummary}
              onRefreshSummary={generateSummary}
              onEditIntake={() => setShowEditDialog(true)}
            />
            
            {/* Fallback: Raw description if no summary */}
            {!job.job_summary && !isGeneratingSummary && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Stellenbeschreibung</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {job.description || 'Keine Beschreibung vorhanden.'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Candidates Tab - Kanban Pipeline */}
          <TabsContent value="candidates" className="mt-6">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {PIPELINE_STAGES.map((stage) => {
                const stageSubmissions = getSubmissionsByStage(stage.key);
                return (
                  <div key={stage.key} className="flex-shrink-0 w-80">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                        <h3 className="font-medium text-sm">{stage.label}</h3>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {stageSubmissions.length}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 min-h-[200px]">
                        {stageSubmissions.map((submission) => {
                          const initials = submission.candidate.full_name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2);
                            
                          return (
                            <Card 
                              key={submission.id}
                              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
                              onClick={() => {
                                setSelectedSubmission(submission);
                                setShowCandidateView(true);
                              }}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-gradient-navy text-primary-foreground text-xs">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {submission.candidate.full_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {submission.candidate.job_title || 'Keine Position'}
                                    </p>
                                    
                                    {/* Skills Preview */}
                                    {submission.candidate.skills && submission.candidate.skills.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {submission.candidate.skills.slice(0, 3).map((skill, i) => (
                                          <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                            {skill}
                                          </Badge>
                                        ))}
                                        {submission.candidate.skills.length > 3 && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                            +{submission.candidate.skills.length - 3}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2 mt-2">
                                      {submission.match_score && (
                                        <Badge variant="outline" className="text-xs">
                                          <Star className="h-3 w-3 mr-1 text-yellow-500" />
                                          {submission.match_score}%
                                        </Badge>
                                      )}
                                      {submission.candidate.experience_years && (
                                        <span className="text-xs text-muted-foreground">
                                          {submission.candidate.experience_years}J Erfahrung
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Quick Actions */}
                                {stage.key !== 'hired' && stage.key !== 'rejected' && (
                                  <div className="flex gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs h-7 flex-1"
                                      onClick={() => openScheduleInterview(submission)}
                                    >
                                      <Calendar className="h-3 w-3 mr-1" />
                                      Interview
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => openRejectDialog(submission)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                        
                        {stageSubmissions.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            Keine Kandidaten
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Interviews Tab */}
          <TabsContent value="interviews" className="mt-6">
            {interviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Keine Interviews geplant</h3>
                  <p className="text-muted-foreground text-sm">
                    Plane Interviews mit Kandidaten in der Pipeline
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {interviews.map((interview) => {
                  const submission = submissions.find(s => s.id === interview.submission_id);
                  if (!submission) return null;
                  
                  return (
                    <Card key={interview.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{submission.candidate.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(interview.scheduled_at), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                            </p>
                          </div>
                          <Badge variant={
                            interview.status === 'completed' ? 'default' :
                            interview.status === 'cancelled' ? 'destructive' : 'secondary'
                          }>
                            {interview.status === 'scheduled' ? 'Geplant' :
                             interview.status === 'completed' ? 'Abgeschlossen' :
                             interview.status === 'cancelled' ? 'Abgesagt' : interview.status}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setShowCandidateView(true);
                            }}
                          >
                            Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conversion Funnel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {PIPELINE_STAGES.filter(s => s.key !== 'rejected').map((stage, index) => {
                    const count = getSubmissionsByStage(stage.key).length;
                    const percentage = totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0;
                    return (
                      <div key={stage.key} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                            {stage.label}
                          </span>
                          <span className="font-medium">{count} ({percentage}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Key Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Kennzahlen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Durchschnittlicher Match-Score</span>
                    <span className="font-bold text-lg">
                      {submissions.length > 0 
                        ? Math.round(submissions.reduce((acc, s) => acc + (s.match_score || 0), 0) / submissions.filter(s => s.match_score).length || 0)
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Interview-Rate</span>
                    <span className="font-bold text-lg">
                      {totalSubmissions > 0 ? Math.round((interviewed / totalSubmissions) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Ablehnungsrate</span>
                    <span className="font-bold text-lg">
                      {totalSubmissions > 0 
                        ? Math.round((submissions.filter(s => s.stage === 'rejected').length / totalSubmissions) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                    <span className="text-muted-foreground">Einstellungsrate</span>
                    <span className="font-bold text-lg text-green-600">
                      {totalSubmissions > 0 ? Math.round((hired / totalSubmissions) * 100) : 0}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <JobEditDialog 
        job={job}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={fetchJobData}
      />

      {/* Candidate Quick View */}
      <CandidateQuickView
        submission={selectedSubmission}
        open={showCandidateView}
        onOpenChange={setShowCandidateView}
        onStageChange={handleStageChange}
        onScheduleInterview={openScheduleInterview}
        onReject={openRejectDialog}
      />

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kandidat ablehnen</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.candidate.full_name} wird für diese Position abgelehnt.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Grund der Absage</label>
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger>
                <SelectValue placeholder="Grund auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason}>
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interview Dialog */}
      <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Interview planen</DialogTitle>
            <DialogDescription>
              Interview mit {selectedSubmission?.candidate.full_name} planen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Datum & Uhrzeit</label>
              <Input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notizen (optional)</label>
              <Textarea
                value={interviewNotes}
                onChange={(e) => setInterviewNotes(e.target.value)}
                placeholder="z.B. Themen, Interviewer, Meeting-Link..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterviewDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleScheduleInterview} disabled={!interviewDate}>
              Interview planen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
