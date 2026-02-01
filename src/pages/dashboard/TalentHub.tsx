import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { CandidateCompareView } from '@/components/candidates/CandidateCompareView';
import { CandidateActionCard, CandidateActionCardProps } from '@/components/talent/CandidateActionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
// Interview dialog is handled by CandidateActionCard which uses ProfessionalInterviewWizard

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';

import { 
  Loader2,
  ArrowLeft,
  GitCompare,
  Search,
  Filter,
  ArrowUpDown,
  Users,
  AlertTriangle,
  Video,
  Check,
  Flame,
  CircleCheck,
  HelpCircle,
  EyeOff
} from 'lucide-react';
import { isPast, isToday, formatDistanceToNow } from 'date-fns';
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

// Extended candidate type for grid
interface ExtendedTableCandidate extends CandidateActionCardProps {
  email?: string;
  phone?: string;
  cvAiSummary?: string;
  noticePeriod?: string;
  availabilityDate?: string;
  currentSalary?: number;
  expectedSalary?: number;
}

export default function TalentHub() {
  const navigate = useNavigate();
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
  
  const [rejectSubmissionId, setRejectSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  
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
        match_policy,
        candidates!inner (
          id,
          full_name,
          job_title,
          email,
          phone,
          company,
          skills,
          experience_years,
          cv_ai_summary,
          notice_period,
          availability_date,
          current_salary,
          expected_salary,
          city
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

      // Generate anonymous ID from candidate id (first 6 chars)
      const anonymousId = `PR-${candidate.id.slice(0, 6).toUpperCase()}`;

      tableCandidates.push({
        id: candidate.id,
        submissionId: sub.id,
        name: anonymousId, // Use anonymous ID instead of full name
        currentRole: candidate.job_title || 'Nicht angegeben',
        jobId: job.id,
        jobTitle: job.title,
        stage: sub.stage || sub.status,
        status: sub.status,
        matchScore: sub.match_score,
        matchPolicy: sub.match_policy || null,
        submittedAt: sub.submitted_at,
        email: candidate.email,
        phone: candidate.phone,
        hoursInStage,
        company: candidate.company,
        skills: candidate.skills,
        experienceYears: candidate.experience_years,
        cvAiSummary: candidate.cv_ai_summary,
        noticePeriod: candidate.notice_period,
        availabilityDate: candidate.availability_date,
        currentSalary: candidate.current_salary,
        expectedSalary: candidate.expected_salary,
        city: candidate.city
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
    const hotMatches = candidates.filter(c => 
      c.status !== 'rejected' && c.matchPolicy === 'hot'
    ).length;
    
    return { activeCandidates, interviewsToday, overdueCount, hotMatches };
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
  };

  const handleSelectCandidate = (candidate: ExtendedTableCandidate) => {
    // Navigate to the central candidate detail page (Triple-Blind compliant)
    navigate(`/dashboard/candidates/${candidate.submissionId}`);
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
      const candidate = candidates.find(c => c.submissionId === submissionId);
      const currentStage = candidate?.stage || 'submitted';
      const nextStage = currentStage === 'submitted' ? 'interview_1' : 'interview_2';

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

      const { error: stageError } = await supabase
        .from('submissions')
        .update({ stage: nextStage, status: 'interview' })
        .eq('id', submissionId);

      if (stageError) throw stageError;

      setCandidates(prev => prev.map(c => 
        c.submissionId === submissionId 
          ? { ...c, stage: nextStage, status: 'interview' }
          : c
      ));

      const stageLabel = PIPELINE_STAGES.find(s => s.key === nextStage)?.label || nextStage;
      toast.success(`Interview geplant - Kandidat in "${stageLabel}" verschoben`);
      
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

  const totalActiveCandidates = candidates.filter(c => c.status !== 'rejected').length;

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
              {quickStats.hotMatches > 0 && (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <Flame className="h-3 w-3 mr-1" />
                  {quickStats.hotMatches} Hot
                </Badge>
              )}
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
              
              {/* Compare Button */}
              {selectedIds.length > 0 && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setCompareOpen(true)}
                  className="gap-1.5"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Vergleichen ({selectedIds.length})
                </Button>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-3 px-6 py-2 border-b bg-muted/30">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach ID, Rolle..."
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

          {/* Full Width Candidate Grid */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {candidatesWithInterviews.map(candidate => (
                    <div key={candidate.submissionId} className="relative group">
                      {/* Multi-select checkbox */}
                      <div 
                        className={cn(
                          "absolute top-2 left-2 z-10 transition-opacity",
                          selectedIds.length > 0 || "opacity-0 group-hover:opacity-100"
                        )}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedIds.includes(candidate.submissionId)) {
                              setSelectedIds(prev => prev.filter(id => id !== candidate.submissionId));
                            } else if (selectedIds.length < 3) {
                              setSelectedIds(prev => [...prev, candidate.submissionId]);
                            } else {
                              toast.error('Maximal 3 Kandidaten zum Vergleichen');
                            }
                          }}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                            selectedIds.includes(candidate.submissionId)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-background border-muted-foreground/30 hover:border-primary"
                          )}
                        >
                          {selectedIds.includes(candidate.submissionId) && (
                            <Check className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <CandidateActionCard
                        candidate={candidate}
                        onSelect={() => handleSelectCandidate(candidate)}
                        onMove={handleMove}
                        onReject={handleReject}
                        onInterviewRequest={handleInterviewRequest}
                        onFeedback={handleFeedback}
                        isProcessing={processing}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Dialogs */}
        <RejectionDialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          submission={rejectSubmissionId ? {
            id: rejectSubmissionId,
            candidate: { 
              id: candidates.find(c => c.submissionId === rejectSubmissionId)?.id || '',
              full_name: candidates.find(c => c.submissionId === rejectSubmissionId)?.name || '',
              email: candidates.find(c => c.submissionId === rejectSubmissionId)?.email || ''
            },
            job: {
              id: candidates.find(c => c.submissionId === rejectSubmissionId)?.jobId || '',
              title: candidates.find(c => c.submissionId === rejectSubmissionId)?.jobTitle || '',
              company_name: ''
            }
          } : null}
          onSuccess={handleRejectSuccess}
        />

        {compareOpen && (
          <CandidateCompareView
            submissionIds={selectedIds}
            onRemove={(id) => setSelectedIds(prev => prev.filter(i => i !== id))}
            onClose={() => setCompareOpen(false)}
            onReject={handleReject}
          />
        )}
      </TooltipProvider>
    </DashboardLayout>
  );
}
