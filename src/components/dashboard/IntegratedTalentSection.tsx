import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { CandidateActionCard, CandidateActionCardProps } from '@/components/talent/CandidateActionCard';
import { CandidateCompareView } from '@/components/candidates/CandidateCompareView';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { toast } from 'sonner';
import { 
  Users,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Video,
  Flame,
  GitCompare,
  CheckCircle2,
  Check
} from 'lucide-react';
import { isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface Interview {
  id: string;
  scheduled_at: string | null;
  status: string | null;
  meeting_link: string | null;
  submission_id: string;
}

interface Job {
  id: string;
  title: string;
}

interface ExtendedCandidate extends CandidateActionCardProps {
  email?: string;
  phone?: string;
}

interface IntegratedTalentSectionProps {
  onActionComplete?: () => void;
}

export function IntegratedTalentSection({ onActionComplete }: IntegratedTalentSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [candidates, setCandidates] = useState<ExtendedCandidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [stageFilter, setStageFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'match' | 'waiting'>('waiting');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  
  const [rejectSubmission, setRejectSubmission] = useState<{
    id: string;
    candidate: { id: string; full_name: string; email: string };
    job: { id: string; title: string; company_name: string };
  } | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  
  const [interviewDialog, setInterviewDialog] = useState<{
    open: boolean;
    submissionId: string | null;
    candidateAnonymousId: string;
    jobTitle: string;
  }>({ open: false, submissionId: null, candidateAnonymousId: '', jobTitle: '' });

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

    const tableCandidates: ExtendedCandidate[] = [];

    (data || []).forEach((sub: any) => {
      const candidate = sub.candidates;
      const job = sub.jobs;
      const now = new Date();
      const submittedAt = new Date(sub.submitted_at);
      const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));

      const anonymousId = `PR-${candidate.id.slice(0, 6).toUpperCase()}`;

      tableCandidates.push({
        id: candidate.id,
        submissionId: sub.id,
        name: anonymousId,
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
        city: candidate.city
      });
    });

    setCandidates(tableCandidates);
  };

  const fetchInterviews = async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select('id, scheduled_at, status, meeting_link, submission_id')
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setInterviews(data);
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
    const activeCandidates = candidates.filter(c => c.status !== 'rejected' && c.status !== 'hired').length;
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

      const stageLabel = PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage;
      toast.success(`Kandidat in "${stageLabel}" verschoben`);
      
      setCandidates(prev => prev.map(c => 
        c.submissionId === submissionId 
          ? { ...c, stage: newStage, status: newStatus }
          : c
      ));
      
      onActionComplete?.();
    } catch (error) {
      toast.error('Fehler beim Verschieben');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (submissionId: string) => {
    const candidate = candidates.find(c => c.submissionId === submissionId);
    if (candidate) {
      setRejectSubmission({
        id: submissionId,
        candidate: {
          id: candidate.id,
          full_name: candidate.name,
          email: candidate.email || ''
        },
        job: {
          id: candidate.jobId,
          title: candidate.jobTitle,
          company_name: ''
        }
      });
      setRejectDialogOpen(true);
    }
  };

  const handleRejectSuccess = () => {
    if (rejectSubmission) {
      setCandidates(prev => prev.map(c => 
        c.submissionId === rejectSubmission.id 
          ? { ...c, status: 'rejected' }
          : c
      ));
      onActionComplete?.();
    }
  };

  const handleSelectCandidate = (candidate: ExtendedCandidate) => {
    navigate(`/dashboard/candidates/${candidate.submissionId}`);
  };

  const handleInterviewRequest = (submissionId: string) => {
    const candidate = candidates.find(c => c.submissionId === submissionId);
    if (candidate) {
      setInterviewDialog({
        open: true,
        submissionId,
        candidateAnonymousId: candidate.name,
        jobTitle: candidate.jobTitle
      });
    }
  };

  const handleInterviewSuccess = () => {
    setInterviewDialog({ open: false, submissionId: null, candidateAnonymousId: '', jobTitle: '' });
    fetchAllData();
    onActionComplete?.();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (candidates.filter(c => c.status !== 'rejected' && c.status !== 'hired').length === 0) {
    return (
      <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success/20 mb-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Alles erledigt!</h3>
          <p className="text-sm text-muted-foreground">
            Keine ausstehenden Kandidaten. Ihre Recruiter arbeiten für Sie.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-4">
          {/* Header with Quick Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Kandidaten</h2>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="font-medium text-foreground">{quickStats.activeCandidates}</span>
                </div>
                {quickStats.hotMatches > 0 && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                    <Flame className="h-3 w-3 mr-1" />
                    {quickStats.hotMatches} Hot
                  </Badge>
                )}
                {quickStats.interviewsToday > 0 && (
                  <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">
                    <Video className="h-3 w-3 mr-1" />
                    {quickStats.interviewsToday} heute
                  </Badge>
                )}
                {quickStats.overdueCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {quickStats.overdueCount} überfällig
                  </Badge>
                )}
              </div>
            </div>
            
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

          {/* Stage Tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4 border-b pb-3">
            <Button
              variant={stageFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStageFilter('all')}
            >
              Alle ({candidates.filter(c => c.status !== 'rejected' && c.status !== 'hired').length})
            </Button>
            {PIPELINE_STAGES.slice(0, 5).map(stage => {
              const count = stageCounts[stage.key] || 0;
              if (count === 0) return null;
              return (
                <Button
                  key={stage.key}
                  variant={stageFilter === stage.key ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setStageFilter(stage.key)}
                >
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
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
                <SelectItem value="waiting">Wartezeit</SelectItem>
                <SelectItem value="newest">Neueste</SelectItem>
                <SelectItem value="oldest">Älteste</SelectItem>
                <SelectItem value="match">Match Score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Candidate Grid */}
          <ScrollArea className="max-h-[600px]">
            {candidatesWithInterviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mb-2" />
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
                      isSelected={selectedIds.includes(candidate.submissionId)}
                      onSelect={() => handleSelectCandidate(candidate)}
                      onMove={handleMove}
                      onReject={handleReject}
                      onInterviewRequest={async (submissionId) => {
                        handleInterviewRequest(submissionId);
                      }}
                      isProcessing={processing}
                    />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Compare Dialog */}
      {compareOpen && selectedIds.length > 0 && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 z-50 overflow-auto rounded-lg border bg-background shadow-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background">
              <h2 className="text-lg font-semibold">Kandidatenvergleich</h2>
              <Button variant="ghost" size="sm" onClick={() => setCompareOpen(false)}>
                ×
              </Button>
            </div>
            <div className="p-4">
              <CandidateCompareView 
                submissionIds={selectedIds}
                onRemove={(submissionId) => setSelectedIds(prev => prev.filter(id => id !== submissionId))}
                onClose={() => {
                  setCompareOpen(false);
                  setSelectedIds([]);
                }}
                onInterviewRequest={(submissionId) => {
                  handleInterviewRequest(submissionId);
                  setCompareOpen(false);
                }}
                onReject={(submissionId) => {
                  handleReject(submissionId);
                  setCompareOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        submission={rejectSubmission}
        onSuccess={handleRejectSuccess}
      />

      {/* Interview Request Dialog */}
      {interviewDialog.submissionId && (
        <InterviewRequestWithOptInDialog
          open={interviewDialog.open}
          onOpenChange={(open) => setInterviewDialog(prev => ({ ...prev, open }))}
          submissionId={interviewDialog.submissionId}
          candidateAnonymousId={interviewDialog.candidateAnonymousId}
          jobTitle={interviewDialog.jobTitle}
          onSuccess={handleInterviewSuccess}
        />
      )}
    </TooltipProvider>
  );
}
