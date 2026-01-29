import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { JobHealthIndicator } from '@/components/jobs/JobHealthIndicator';
import { BriefingNotesDialog } from '@/components/jobs/BriefingNotesDialog';
import { JobBoostDialog } from '@/components/jobs/JobBoostDialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Search, 
  Briefcase, 
  MapPin, 
  Clock, 
  Users,
  ArrowUpRight,
  Loader2,
  Filter,
  MoreVertical,
  Copy,
  Pause,
  Play,
  XCircle,
  Calendar,
  UserCheck,
  FileText,
  Zap,
} from 'lucide-react';

interface JobWithStats {
  id: string;
  title: string;
  company_name: string;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  status: string | null;
  created_at: string;
  salary_min: number | null;
  salary_max: number | null;
  paused_at: string | null;
  briefing_notes: string | null;
  submissions_count: number;
  interviews_count: number;
  active_recruiters: number;
  days_open: number;
}

interface BoostDialogState {
  open: boolean;
  jobId: string;
  jobTitle: string;
}

interface BriefingDialogState {
  open: boolean;
  jobId: string;
  jobTitle: string;
  notes: string;
}

export default function JobsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [boostDialog, setBoostDialog] = useState<BoostDialogState>({ open: false, jobId: '', jobTitle: '' });
  const [briefingDialog, setBriefingDialog] = useState<BriefingDialogState>({ open: false, jobId: '', jobTitle: '', notes: '' });

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user]);

  const fetchJobs = async () => {
    try {
      // Fetch jobs with aggregated stats
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Fetch stats for each job
      const jobsWithStats = await Promise.all(
        (jobsData || []).map(async (job) => {
          // Get submission count
          const { count: submissionsCount } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id);

          // Get interviews count
          const { count: interviewsCount } = await supabase
            .from('interviews')
            .select('*, submissions!inner(job_id)', { count: 'exact', head: true })
            .eq('submissions.job_id', job.id);

          // Get unique active recruiters
          const { data: recruitersData } = await supabase
            .from('submissions')
            .select('recruiter_id')
            .eq('job_id', job.id);
          
          const uniqueRecruiters = new Set(recruitersData?.map(r => r.recruiter_id) || []);

          // Calculate days open
          const daysOpen = Math.floor(
            (Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            ...job,
            submissions_count: submissionsCount || 0,
            interviews_count: interviewsCount || 0,
            active_recruiters: uniqueRecruiters.size,
            days_open: daysOpen,
          };
        })
      );

      setJobs(jobsWithStats);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (job: JobWithStats) => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          client_id: user?.id,
          title: `${job.title} (Kopie)`,
          company_name: job.company_name,
          location: job.location,
          remote_type: job.remote_type,
          employment_type: job.employment_type,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Job dupliziert' });
      fetchJobs();
    } catch (error) {
      console.error('Error duplicating job:', error);
      toast({ title: 'Fehler beim Duplizieren', variant: 'destructive' });
    }
  };

  const handlePauseToggle = async (job: JobWithStats) => {
    try {
      const isPaused = !!job.paused_at;
      const { error } = await supabase
        .from('jobs')
        .update({ 
          paused_at: isPaused ? null : new Date().toISOString(),
          status: isPaused ? 'published' : job.status,
        })
        .eq('id', job.id);

      if (error) throw error;
      
      toast({ title: isPaused ? 'Job reaktiviert' : 'Job pausiert' });
      fetchJobs();
    } catch (error) {
      console.error('Error toggling pause:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleClose = async (job: JobWithStats) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'closed' })
        .eq('id', job.id);

      if (error) throw error;
      
      toast({ title: 'Job geschlossen' });
      fetchJobs();
    } catch (error) {
      console.error('Error closing job:', error);
      toast({ title: 'Fehler beim Schließen', variant: 'destructive' });
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'paused' ? !!job.paused_at : job.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Nicht angegeben';
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`;
    if (min) return `Ab €${min.toLocaleString()}`;
    return `Bis €${max?.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadge = (job: JobWithStats) => {
    if (job.paused_at) {
      return <Badge variant="secondary">Pausiert</Badge>;
    }
    switch (job.status) {
      case 'published':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Aktiv</Badge>;
      case 'closed':
        return <Badge variant="destructive">Geschlossen</Badge>;
      case 'draft':
      default:
        return <Badge variant="outline">Entwurf</Badge>;
    }
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

  return (
    <DashboardLayout>
        <div className="space-y-4">
          {/* Compact Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Meine Jobs</h1>
              <p className="text-sm text-muted-foreground">{filteredJobs.length} Stellenanzeigen</p>
            </div>
            <Button variant="hero" size="sm" asChild>
              <Link to="/dashboard/jobs/new">
                <Plus className="mr-2 h-4 w-4" />
                Neuer Job
              </Link>
            </Button>
          </div>

          {/* Compact Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Jobs durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="published">Aktiv</SelectItem>
                <SelectItem value="paused">Pausiert</SelectItem>
                <SelectItem value="closed">Geschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Empty State */}
          {filteredJobs.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex items-center justify-center py-8 gap-4">
                <Briefcase className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <h3 className="font-medium text-sm">
                    {searchQuery || statusFilter !== 'all' ? 'Keine passenden Jobs' : 'Noch keine Jobs'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'Passe deine Filter an'
                      : 'Erstelle deinen ersten Job'}
                  </p>
                </div>
                {!searchQuery && statusFilter === 'all' && (
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/dashboard/jobs/new">Job erstellen</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <TooltipProvider>
              <div className="grid gap-3">
                {filteredJobs.map((job) => (
                  <Card 
                    key={job.id} 
                    className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all group"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <Link to={`/dashboard/jobs/${job.id}`} className="shrink-0">
                          <div className="h-12 w-12 rounded-xl bg-gradient-navy flex items-center justify-center shadow-navy">
                            <Briefcase className="h-6 w-6 text-primary-foreground" />
                          </div>
                        </Link>
                        
                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <Link to={`/dashboard/jobs/${job.id}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-base hover:text-primary transition-colors">{job.title}</h3>
                              {getStatusBadge(job)}
                              <JobHealthIndicator 
                                candidatesCount={job.submissions_count}
                                interviewsCount={job.interviews_count}
                                activeRecruiters={job.active_recruiters}
                                daysOpen={job.days_open}
                                status={job.status}
                              />
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span>{job.company_name}</span>
                              {job.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {job.location}
                                </span>
                              )}
                            </div>
                          </Link>

                          {/* Pipeline Dots & Stats */}
                          <div className="flex items-center gap-4 mt-3">
                            {/* Pipeline Dots */}
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <div 
                                  key={i}
                                  className={`h-2 w-2 rounded-full ${
                                    i < Math.min(job.submissions_count, 5) 
                                      ? 'bg-primary' 
                                      : 'bg-muted'
                                  }`}
                                />
                              ))}
                              <span className="text-xs text-muted-foreground ml-1">
                                {job.submissions_count} Kandidaten
                              </span>
                            </div>
                            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {job.interviews_count} Interviews
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {job.days_open}d offen
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Salary & Quick Actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {/* Salary */}
                          <div className="text-right hidden sm:block">
                            <p className="font-semibold text-sm">{formatSalary(job.salary_min, job.salary_max)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(job.created_at)}</p>
                          </div>

                          {/* Quick Actions - Always Visible */}
                          <div className="flex items-center gap-1.5">
                            {/* Boost Button */}
                            {job.status === 'published' && !job.paused_at && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 px-2.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setBoostDialog({ open: true, jobId: job.id, jobTitle: job.title });
                                }}
                              >
                                <Zap className="h-3.5 w-3.5 mr-1" />
                                <span className="hidden lg:inline">Boost</span>
                              </Button>
                            )}
                            
                            {/* Pause/Play Button */}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePauseToggle(job);
                              }}
                            >
                              {job.paused_at ? (
                                <Play className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Pause className="h-4 w-4" />
                              )}
                            </Button>
                            
                            {/* Briefing Button */}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className={`h-8 w-8 ${job.briefing_notes ? 'text-primary' : ''}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setBriefingDialog({ 
                                  open: true, 
                                  jobId: job.id, 
                                  jobTitle: job.title,
                                  notes: job.briefing_notes || ''
                                });
                              }}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>

                            {/* More Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/dashboard/pipeline?job=${job.id}`}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Pipeline öffnen
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(job)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplizieren
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleClose(job)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Schließen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Navigate Arrow */}
                            <Link to={`/dashboard/jobs/${job.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TooltipProvider>
          )}

          {/* Dialogs */}
          <JobBoostDialog 
            open={boostDialog.open}
            onOpenChange={(open) => setBoostDialog(prev => ({ ...prev, open }))}
            jobId={boostDialog.jobId}
            jobTitle={boostDialog.jobTitle}
          />
          <BriefingNotesDialog
            open={briefingDialog.open}
            onOpenChange={(open) => setBriefingDialog(prev => ({ ...prev, open }))}
            jobId={briefingDialog.jobId}
            jobTitle={briefingDialog.jobTitle}
            initialNotes={briefingDialog.notes}
            onSaved={fetchJobs}
          />
        </div>
      </DashboardLayout>
  );
}