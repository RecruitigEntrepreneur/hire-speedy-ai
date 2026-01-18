import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { CandidateCompareView } from '@/components/candidates/CandidateCompareView';
import { CandidateActionCard, CandidateActionCardProps } from '@/components/talent/CandidateActionCard';
import { CandidateMatchCard } from '@/components/talent/CandidateMatchCard';
import { CandidateFullProfileDialog } from '@/components/talent/CandidateFullProfileDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { useTalentHubActions } from '@/hooks/useTalentHubActions';
import { InterviewSchedulingDialog } from '@/components/talent/InterviewSchedulingDialog';

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';

import { 
  Loader2,
  ArrowLeft,
  GitCompare,
  X,
  Search,
  Filter,
  ArrowUpDown,
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Phone,
  ExternalLink,
  MapPin,
  Briefcase,
  Brain,
  Target,
  Euro,
  Video,
  Check,
  Maximize2
} from 'lucide-react';
import { isPast, isToday, formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Interview {
  id: string;
  scheduled_at: string | null;
  status: string | null;
  meeting_link: string | null;
  submission_id: string;
  candidateName: string;
  jobTitle: string;
}

interface Job {
  id: string;
  title: string;
}

interface Experience {
  id: string;
  company_name: string;
  job_title: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
}

interface Education {
  id: string;
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  graduation_year?: number | null;
}

interface InterviewNotes {
  change_motivation?: string | null;
  salary_current?: string | null;
  salary_desired?: string | null;
}

// Extended candidate type for grid and detail panel
interface ExtendedTableCandidate extends CandidateActionCardProps {
  email?: string;
  phone?: string;
  cvAiBullets?: string[];
  cvAiSummary?: string;
  noticePeriod?: string;
  availabilityDate?: string;
  exposeHighlights?: string[];
  currentSalary?: number;
  expectedSalary?: number;
  experiences?: Experience[];
  educations?: Education[];
  interviewNotes?: InterviewNotes;
  jobSkills?: string[];
  changeMotivation?: string;
}

export default function TalentHub() {
  const { user } = useAuth();
  
  const [candidates, setCandidates] = useState<ExtendedTableCandidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [stageFilter, setStageFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'match' | 'waiting'>('newest');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ExtendedTableCandidate | null>(null);
  
  const [rejectSubmissionId, setRejectSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [detailInterviewDialogOpen, setDetailInterviewDialogOpen] = useState(false);
  
  usePageViewTracking('talent_hub');

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchJobs(),
        fetchCandidates(),
        fetchInterviews()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setJobs(data);
    }
  };

  const fetchCandidates = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        id,
        status,
        stage,
        submitted_at,
        match_score,
        candidates!inner (
          id,
          full_name,
          job_title,
          email,
          phone,
          company,
          skills,
          experience_years,
          cv_ai_bullets,
          cv_ai_summary,
          notice_period,
          availability_date,
          expose_highlights,
          current_salary,
          expected_salary,
          city,
          candidate_experiences (
            id,
            company_name,
            job_title,
            start_date,
            end_date,
            is_current
          ),
          candidate_educations (
            id,
            institution,
            degree,
            field_of_study,
            graduation_year
          ),
          candidate_interview_notes (
            change_motivation
          )
        ),
        jobs!inner (
          id,
          title,
          skills
        )
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
      return;
    }

    const tableCandidates: ExtendedTableCandidate[] = [];

    (data || []).forEach((sub: any) => {
      const candidate = sub.candidates;
      const job = sub.jobs;
      const now = new Date();
      const submittedAt = new Date(sub.submitted_at);
      const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));

      // Sort experiences by start_date descending
      const experiences = (candidate.candidate_experiences || []).sort((a: any, b: any) => {
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });

      // Sort educations by graduation_year descending
      const educations = (candidate.candidate_educations || []).sort((a: any, b: any) => {
        if (!a.graduation_year) return 1;
        if (!b.graduation_year) return -1;
        return b.graduation_year - a.graduation_year;
      });

      // Get first interview notes (there may be multiple)
      const interviewNotes = candidate.candidate_interview_notes?.[0] || null;

      tableCandidates.push({
        id: candidate.id,
        submissionId: sub.id,
        name: candidate.full_name,
        currentRole: candidate.job_title || 'Nicht angegeben',
        jobId: job.id,
        jobTitle: job.title,
        stage: sub.stage || sub.status,
        status: sub.status,
        matchScore: sub.match_score,
        submittedAt: sub.submitted_at,
        email: candidate.email,
        phone: candidate.phone,
        hoursInStage,
        company: candidate.company,
        skills: candidate.skills,
        experienceYears: candidate.experience_years,
        cvAiBullets: candidate.cv_ai_bullets,
        cvAiSummary: candidate.cv_ai_summary,
        noticePeriod: candidate.notice_period,
        availabilityDate: candidate.availability_date,
        exposeHighlights: candidate.expose_highlights,
        currentSalary: candidate.current_salary,
        expectedSalary: candidate.expected_salary,
        city: candidate.city,
        experiences,
        educations,
        changeMotivation: interviewNotes?.change_motivation || undefined,
        interviewNotes: interviewNotes ? {
          change_motivation: interviewNotes.change_motivation
        } : undefined,
        jobSkills: job.required_skills || []
      });
    });

    setCandidates(tableCandidates);
  };

  const fetchInterviews = async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        id,
        scheduled_at,
        status,
        meeting_link,
        submission_id,
        submission:submissions(
          id,
          candidate:candidates(full_name),
          job:jobs(title)
        )
      `)
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      const formattedInterviews: Interview[] = data.map((i: any) => ({
        id: i.id,
        scheduled_at: i.scheduled_at,
        status: i.status,
        meeting_link: i.meeting_link,
        submission_id: i.submission_id,
        candidateName: i.submission?.candidate?.full_name || 'Unbekannt',
        jobTitle: i.submission?.job?.title || 'Unbekannt'
      }));
      setInterviews(formattedInterviews);
    }
  };

  // Calculate stage counts
  const stageCounts = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.key] = candidates.filter(c => c.stage === stage.key && c.status !== 'rejected').length;
      return acc;
    }, {} as Record<string, number>);
  }, [candidates]);

  // Quick stats
  const quickStats = useMemo(() => {
    const activeCandidates = candidates.filter(c => c.status !== 'rejected').length;
    const interviewsToday = interviews.filter(i => 
      i.scheduled_at && isToday(new Date(i.scheduled_at)) && i.status !== 'completed'
    ).length;
    const overdueCount = candidates.filter(c => 
      c.stage === 'submitted' && c.status !== 'rejected' && c.hoursInStage >= 48
    ).length;
    
    return { activeCandidates, interviewsToday, overdueCount };
  }, [candidates, interviews]);

  // Filtered and sorted candidates
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(c => {
        if (c.status === 'rejected' || c.status === 'hired') return false;
        if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
        if (jobFilter !== 'all' && c.jobId !== jobFilter) return false;
        if (search) {
          const searchLower = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(searchLower) ||
            c.currentRole.toLowerCase().includes(searchLower) ||
            c.jobTitle.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          case 'match':
            return (b.matchScore || 0) - (a.matchScore || 0);
          case 'waiting':
            return b.hoursInStage - a.hoursInStage;
          case 'newest':
          default:
            return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
      });
  }, [candidates, stageFilter, jobFilter, search, sortBy]);

  // Attach interview data to candidates
  const candidatesWithInterviews = useMemo(() => {
    return filteredCandidates.map(c => {
      const interview = interviews.find(i => i.submission_id === c.submissionId);
      const feedbackPending = interview && 
        interview.scheduled_at && 
        isPast(new Date(interview.scheduled_at)) && 
        interview.status !== 'completed';
      
      return {
        ...c,
        interview: interview ? {
          id: interview.id,
          scheduled_at: interview.scheduled_at,
          status: interview.status,
          meeting_link: interview.meeting_link
        } : null,
        feedbackPending
      };
    });
  }, [filteredCandidates, interviews]);

  const handleMove = async (submissionId: string, newStage: string) => {
    setProcessing(true);
    try {
      const newStatus = newStage === 'interview_1' || newStage === 'interview_2' ? 'interview' : newStage;
      
      const { error } = await supabase
        .from('submissions')
        .update({ stage: newStage, status: newStatus })
        .eq('id', submissionId);

      if (error) throw error;

      if (newStage === 'interview_1' || newStage === 'interview_2') {
        await supabase.from('interviews').insert({
          submission_id: submissionId,
          status: 'pending',
          notes: newStage === 'interview_2' ? 'Zweites Interview' : 'Erstes Interview'
        });
      }

      const stageLabel = PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage;
      toast.success(`Kandidat in "${stageLabel}" verschoben`);
      
      setCandidates(prev => prev.map(c => 
        c.submissionId === submissionId 
          ? { ...c, stage: newStage, status: newStatus }
          : c
      ));
      
      if (selectedCandidate?.submissionId === submissionId) {
        setSelectedCandidate(prev => prev ? { ...prev, stage: newStage, status: newStatus } : null);
      }
      
      fetchInterviews();
    } catch (error) {
      toast.error('Fehler beim Verschieben');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (submissionId: string) => {
    setRejectSubmissionId(submissionId);
    setRejectDialogOpen(true);
  };

  const handleRejectSuccess = () => {
    setCandidates(prev => prev.map(c => 
      c.submissionId === rejectSubmissionId 
        ? { ...c, status: 'rejected' }
        : c
    ));
    if (selectedCandidate?.submissionId === rejectSubmissionId) {
      setSelectedCandidate(null);
    }
  };

  const handleSelectCandidate = (candidate: ExtendedTableCandidate) => {
    setSelectedCandidate(candidate);
  };

  const handleInterviewRequest = async (submissionId: string, details: {
    scheduledAt: Date;
    durationMinutes: number;
    meetingType: 'video' | 'phone' | 'onsite' | 'teams' | 'meet';
    meetingLink?: string;
    notes?: string;
    interviewTypeId?: string;
    participants?: { userId: string; role: 'lead' | 'panel' | 'observer' }[];
  }) => {
    setProcessing(true);
    try {
      // 1. Find current candidate and determine next stage
      const candidate = candidates.find(c => c.submissionId === submissionId);
      const currentStage = candidate?.stage || 'submitted';
      const nextStage = currentStage === 'submitted' ? 'interview_1' : 'interview_2';

      // 2. Create interview
      const { error: interviewError } = await supabase.from('interviews').insert({
        submission_id: submissionId,
        scheduled_at: details.scheduledAt.toISOString(),
        duration_minutes: details.durationMinutes,
        meeting_type: details.meetingType,
        meeting_link: details.meetingLink || null,
        notes: details.notes || null,
        status: 'pending'
      });

      if (interviewError) throw interviewError;

      // 3. Update submission stage
      const { error: stageError } = await supabase
        .from('submissions')
        .update({ stage: nextStage, status: 'interview' })
        .eq('id', submissionId);

      if (stageError) throw stageError;

      // 4. Create notification (handled by automation-hub trigger)
      // The automation-hub edge function will create proper notifications

      // 5. Update local state
      setCandidates(prev => prev.map(c => 
        c.submissionId === submissionId 
          ? { ...c, stage: nextStage, status: 'interview' }
          : c
      ));

      // 6. Update selectedCandidate if it's the same one
      if (selectedCandidate?.submissionId === submissionId) {
        setSelectedCandidate(prev => prev ? { ...prev, stage: nextStage, status: 'interview' } : null);
      }

      const stageLabel = PIPELINE_STAGES.find(s => s.key === nextStage)?.label || nextStage;
      toast.success(`Interview geplant - Kandidat in "${stageLabel}" verschoben`);
      
      // 7. Refresh interviews
      fetchInterviews();
    } catch (error) {
      console.error('Error creating interview:', error);
      toast.error('Fehler beim Erstellen des Interviews');
    } finally {
      setProcessing(false);
    }
  };

  const handleFeedback = async (submissionId: string, rating: 'positive' | 'neutral' | 'negative', note?: string) => {
    try {
      const interview = interviews.find(i => i.submission_id === submissionId);
      if (interview) {
        await supabase.from('interviews').update({
          status: 'completed',
          notes: note || `Bewertung: ${rating}`
        }).eq('id', interview.id);
      }

      if (rating === 'positive') {
        const candidate = candidates.find(c => c.submissionId === submissionId);
        if (candidate) {
          const nextStage = candidate.stage === 'interview_1' ? 'interview_2' : 'offer';
          await handleMove(submissionId, nextStage);
        }
      } else if (rating === 'negative') {
        handleReject(submissionId);
      }

      toast.success('Feedback gespeichert');
      fetchInterviews();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleRemoveFromCompare = (submissionId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== submissionId));
  };

  const totalActiveCandidates = candidates.filter(c => c.status !== 'rejected').length;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatSalary = (salary?: number) => {
    if (!salary) return null;
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(salary);
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const getStageLabel = (stage: string) => {
    return PIPELINE_STAGES.find(s => s.key === stage)?.label || stage;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="h-full flex flex-col -m-6">
          {/* Compact Header with Stats */}
          <div className="flex items-center justify-between gap-4 px-6 py-3 border-b bg-background">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Talent Hub</h1>
              </div>
            </div>
            
            {/* Quick Stats Inline */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="font-medium text-foreground">{quickStats.activeCandidates}</span>
                <span>Kandidaten</span>
              </div>
              {quickStats.interviewsToday > 0 && (
                <Badge className="bg-blue-500 hover:bg-blue-600">
                  <Video className="h-3 w-3 mr-1" />
                  {quickStats.interviewsToday} Interview{quickStats.interviewsToday !== 1 ? 's' : ''} heute
                </Badge>
              )}
              {quickStats.overdueCount > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {quickStats.overdueCount} überfällig
                </Badge>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-3 px-6 py-2 border-b bg-muted/30">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="h-9 w-40">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Alle Jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Jobs</SelectItem>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-9 w-36">
                <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Neueste</SelectItem>
                <SelectItem value="oldest">Älteste</SelectItem>
                <SelectItem value="match">Match Score</SelectItem>
                <SelectItem value="waiting">Wartezeit</SelectItem>
              </SelectContent>
            </Select>

            {/* Pipeline Stage Tabs */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setStageFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  stageFilter === 'all' 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Alle
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                  {totalActiveCandidates}
                </Badge>
              </button>
              {PIPELINE_STAGES.map((stage) => {
                const count = stageCounts[stage.key] || 0;
                return (
                  <button
                    key={stage.key}
                    onClick={() => setStageFilter(stage.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                      stageFilter === stage.key 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {stage.label}
                    {count > 0 && (
                      <Badge 
                        variant={stageFilter === stage.key ? "secondary" : "outline"} 
                        className={cn(
                          "ml-1.5 text-[10px] h-4 px-1",
                          stage.key === 'submitted' && count > 0 && stageFilter !== stage.key && "bg-amber-100 text-amber-700 border-amber-300"
                        )}
                      >
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Split Layout */}
          <div className="flex-1 flex min-h-0">
            {/* Left: Candidate List (60%) */}
            <div className="w-3/5 border-r flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {candidatesWithInterviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">
                        {search || stageFilter !== 'all' || jobFilter !== 'all'
                          ? 'Keine Kandidaten gefunden'
                          : 'Noch keine Kandidaten vorhanden'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {candidatesWithInterviews.map(candidate => (
                        <CandidateActionCard
                          key={candidate.submissionId}
                          candidate={candidate}
                          isSelected={selectedCandidate?.submissionId === candidate.submissionId}
                          onSelect={() => handleSelectCandidate(candidate)}
                          onMove={handleMove}
                          onReject={handleReject}
                          onInterviewRequest={handleInterviewRequest}
                          onFeedback={handleFeedback}
                          isProcessing={processing}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right: Detail Panel (40%) */}
            <div className="w-2/5 flex flex-col min-h-0 bg-muted/10">
              {selectedCandidate ? (
                <>
                  {/* Detail Header */}
                  <div className="p-4 border-b bg-background">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-14 w-14 border-2 border-background shadow">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                          {getInitials(selectedCandidate.name)}
                        </AvatarFallback>
                      </Avatar>
                        <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-lg truncate">{selectedCandidate.name}</h2>
                        <p className="text-sm text-muted-foreground truncate">
                          {selectedCandidate.currentRole}
                          {selectedCandidate.company && ` @ ${selectedCandidate.company}`}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {selectedCandidate.city && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {selectedCandidate.city}
                            </span>
                          )}
                          {selectedCandidate.experienceYears && (
                            <span className="flex items-center gap-0.5">
                              <Briefcase className="h-3 w-3" />
                              {selectedCandidate.experienceYears} Jahre
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(selectedCandidate.submittedAt), { locale: de, addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      {selectedCandidate.matchScore && (
                        <div className={cn(
                          "flex flex-col items-center justify-center w-14 h-14 rounded-full border-[3px] font-bold shrink-0",
                          selectedCandidate.matchScore >= 80 && "text-green-600 bg-green-50 border-green-300",
                          selectedCandidate.matchScore >= 60 && selectedCandidate.matchScore < 80 && "text-amber-600 bg-amber-50 border-amber-300",
                          selectedCandidate.matchScore < 60 && "text-muted-foreground bg-muted border-muted"
                        )}>
                          <span className="text-lg leading-none">{selectedCandidate.matchScore}</span>
                          <span className="text-[9px] font-normal opacity-70">Match</span>
                        </div>
                      )}
                    </div>

                    {/* Stage Pipeline */}
                    <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
                      {PIPELINE_STAGES.map((stage, index) => {
                        const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.key === selectedCandidate.stage);
                        const isActive = selectedCandidate.stage === stage.key;
                        const isPast = currentStageIndex > index;
                        
                        return (
                          <div key={stage.key} className="flex items-center shrink-0">
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap",
                              isActive && "bg-primary text-primary-foreground font-medium",
                              isPast && "bg-muted text-muted-foreground",
                              !isActive && !isPast && "text-muted-foreground/50"
                            )}>
                              {isPast && <Check className="h-2.5 w-2.5" />}
                              {stage.label}
                            </div>
                            {index < PIPELINE_STAGES.length - 1 && (
                              <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground/30" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Position/Stelle unter der Pipeline */}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-primary/70" />
                      <span>Vorgeschlagen für:</span>
                      <Badge variant="secondary" className="font-medium">
                        {selectedCandidate.jobTitle}
                      </Badge>
                    </div>

                    {/* Quick Actions - Plattformkontrolliert */}
                    <div className="flex items-center gap-2 mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs ml-auto"
                        onClick={() => setFullProfileOpen(true)}
                      >
                        <Maximize2 className="h-3.5 w-3.5 mr-1" />
                        Vollprofil
                      </Button>
                    </div>
                  </div>

                  {/* Scrollable Profile Content */}
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      <CandidateMatchCard
                        matchScore={selectedCandidate.matchScore}
                        matchReasons={selectedCandidate.exposeHighlights || []}
                        experiences={selectedCandidate.experiences}
                        educations={selectedCandidate.educations}
                        skills={selectedCandidate.skills || []}
                        jobSkills={selectedCandidate.jobSkills}
                        city={selectedCandidate.city}
                        currentSalary={selectedCandidate.currentSalary}
                        expectedSalary={selectedCandidate.expectedSalary}
                        noticePeriod={selectedCandidate.noticePeriod}
                        availabilityDate={selectedCandidate.availabilityDate}
                        changeMotivation={selectedCandidate.changeMotivation || selectedCandidate.interviewNotes?.change_motivation}
                        cvAiSummary={selectedCandidate.cvAiSummary}
                        experienceYears={selectedCandidate.experienceYears}
                      />
                    </div>
                  </ScrollArea>

                  {/* Sticky Action Bar - 2 Buttons: Nächster Schritt + Absage */}
                  {selectedCandidate.stage !== 'hired' && (
                    <div className="p-3 border-t bg-background">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Dynamic Next Step Button */}
                        {(selectedCandidate.stage === 'submitted' || selectedCandidate.stage === 'interview_1') ? (
                          <>
                            <Button 
                              size="sm" 
                              className="h-10 text-sm"
                              onClick={() => setDetailInterviewDialogOpen(true)}
                              disabled={processing}
                            >
                              <Calendar className="h-4 w-4 mr-1.5" />
                              {selectedCandidate.stage === 'submitted' ? 'Interview 1' : 'Interview 2'}
                            </Button>
                            <InterviewSchedulingDialog
                              open={detailInterviewDialogOpen}
                              onOpenChange={setDetailInterviewDialogOpen}
                              candidate={{
                                id: selectedCandidate.id,
                                name: selectedCandidate.name,
                                jobTitle: selectedCandidate.jobTitle
                              }}
                              onSubmit={(details) => handleInterviewRequest(selectedCandidate.submissionId, details)}
                            />
                          </>
                        ) : (
                          <Button 
                            size="sm" 
                            className="h-10 text-sm bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              const next = getNextStage(selectedCandidate.stage);
                              if (next) handleMove(selectedCandidate.submissionId, next);
                            }}
                            disabled={processing || !getNextStage(selectedCandidate.stage)}
                          >
                            <ChevronRight className="h-4 w-4 mr-1.5" />
                            {selectedCandidate.stage === 'interview_2' ? 'Angebot' : 'Einstellen'}
                          </Button>
                        )}
                        
                        {/* Reject Button */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-10 text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleReject(selectedCandidate.submissionId)}
                          disabled={processing}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1.5" />
                          Absage
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <Users className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">
                    Wählen Sie einen Kandidaten aus der Liste
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <RejectionDialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          submission={(() => {
            if (!rejectSubmissionId) return null;
            const candidate = candidates.find(c => c.submissionId === rejectSubmissionId);
            if (!candidate) return null;
            const job = jobs.find(j => j.id === candidate.jobId);
            return {
              id: rejectSubmissionId,
              candidate: {
                id: candidate.id,
                full_name: candidate.name,
                email: candidate.email || ''
              },
              job: {
                id: candidate.jobId,
                title: candidate.jobTitle,
                company_name: job?.title || ''
              }
            };
          })()}
          onSuccess={handleRejectSuccess}
        />

        {/* Compare View Modal */}
        {compareOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="fixed inset-4 z-50 overflow-auto rounded-lg border bg-background shadow-lg">
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background">
                <h2 className="text-lg font-semibold">Kandidatenvergleich</h2>
                <Button variant="ghost" size="sm" onClick={() => setCompareOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4">
                <CandidateCompareView 
                  submissionIds={selectedIds}
                  onRemove={handleRemoveFromCompare}
                  onClose={() => setCompareOpen(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Full Profile Dialog */}
        <CandidateFullProfileDialog
          open={fullProfileOpen}
          onOpenChange={setFullProfileOpen}
          candidate={selectedCandidate ? {
            ...selectedCandidate,
            matchScore: selectedCandidate.matchScore,
            submittedAt: selectedCandidate.submittedAt
          } : null}
          onMove={handleMove}
          onReject={handleReject}
          onInterviewRequest={handleInterviewRequest}
          isProcessing={processing}
        />
      </TooltipProvider>
    </DashboardLayout>
  );
}
