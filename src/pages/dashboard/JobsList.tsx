import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  submissions_count: number;
  interviews_count: number;
  active_recruiters: number;
  days_open: number;
}

export default function JobsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Meine Jobs</h1>
              <p className="text-muted-foreground">Verwalte deine Stellenanzeigen</p>
            </div>
            <Button variant="hero" asChild>
              <Link to="/dashboard/jobs/new">
                <Plus className="mr-2 h-4 w-4" />
                Neuen Job erstellen
              </Link>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Jobs durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="published">Aktiv</SelectItem>
                <SelectItem value="paused">Pausiert</SelectItem>
                <SelectItem value="closed">Geschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Jobs List */}
          {filteredJobs.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-16 text-center">
                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  {searchQuery || statusFilter !== 'all' ? 'Keine passenden Jobs' : 'Noch keine Jobs'}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Passe deine Filter an'
                    : 'Erstelle deinen ersten Job, um Kandidaten zu erhalten'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button variant="hero" className="mt-4" asChild>
                    <Link to="/dashboard/jobs/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Ersten Job erstellen
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredJobs.map((job) => (
                <Card 
                  key={job.id} 
                  className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left side - Job Info */}
                      <Link to={`/dashboard/jobs/${job.id}`} className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="h-12 w-12 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0">
                          <Briefcase className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold truncate">{job.title}</h3>
                            {getStatusBadge(job)}
                          </div>
                          <p className="text-muted-foreground">{job.company_name}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            {job.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {job.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {job.employment_type || 'Vollzeit'}
                            </span>
                          </div>
                        </div>
                      </Link>

                      {/* Middle - Stats */}
                      <div className="flex flex-wrap gap-4 lg:gap-6">
                        <div className="text-center min-w-[70px]">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{job.submissions_count}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Kandidaten</p>
                        </div>
                        <div className="text-center min-w-[70px]">
                          <div className="flex items-center justify-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{job.interviews_count}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Interviews</p>
                        </div>
                        <div className="text-center min-w-[70px]">
                          <div className="flex items-center justify-center gap-1">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{job.active_recruiters}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Recruiter</p>
                        </div>
                        <div className="text-center min-w-[70px]">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{job.days_open}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Tage offen</p>
                        </div>
                      </div>

                      {/* Right side - Actions */}
                      <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                          <p className="font-medium">{formatSalary(job.salary_min, job.salary_max)}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(job.created_at)}</p>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDuplicate(job)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplizieren
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePauseToggle(job)}>
                              {job.paused_at ? (
                                <>
                                  <Play className="mr-2 h-4 w-4" />
                                  Reaktivieren
                                </>
                              ) : (
                                <>
                                  <Pause className="mr-2 h-4 w-4" />
                                  Pausieren
                                </>
                              )}
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

                        <Link to={`/dashboard/jobs/${job.id}`}>
                          <Button variant="ghost" size="icon">
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
  );
}