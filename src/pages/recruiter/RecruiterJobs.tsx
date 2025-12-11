import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Briefcase, 
  MapPin, 
  Clock, 
  ArrowUpRight,
  Loader2,
  Filter,
  Shield,
  UserPlus,
  Users
} from 'lucide-react';
import { anonymizeCompanyName } from '@/lib/anonymization';
import { QuickActionsButton } from '@/components/layout/QuickActionsButton';

interface Job {
  id: string;
  title: string;
  company_name: string;
  location: string;
  remote_type: string;
  employment_type: string;
  experience_level: string;
  salary_min: number | null;
  salary_max: number | null;
  recruiter_fee_percentage: number;
  skills: string[];
  created_at: string;
  industry: string | null;
}

export default function RecruiterJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteFilter, setRemoteFilter] = useState<string>('all');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setJobs(data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.skills?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRemote = remoteFilter === 'all' || job.remote_type === remoteFilter;
    return matchesSearch && matchesRemote;
  });

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Not specified';
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`;
    if (min) return `From €${min.toLocaleString()}`;
    return `Up to €${max?.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Open Jobs</h1>
              <p className="text-muted-foreground">Find opportunities for your candidates</p>
            </div>
            <div className="flex items-center gap-2">
              <QuickActionsButton onCandidateImported={() => navigate('/recruiter/candidates')} />
              <Button asChild variant="default" className="gap-2">
                <Link to="/recruiter/candidates">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Meine Kandidaten</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Jobtitel oder Skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={remoteFilter} onValueChange={setRemoteFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Remote type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="onsite">On-site</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} available
          </p>

          {/* Jobs List */}
          {filteredJobs.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-16 text-center">
                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No jobs found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || remoteFilter !== 'all' 
                    ? 'Try adjusting your filters'
                    : 'Check back later for new opportunities'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredJobs.map((job) => (
                <Link key={job.id} to={`/recruiter/jobs/${job.id}`}>
                  <Card className="border-border/50 hover:border-emerald/30 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0">
                              <Briefcase className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-semibold">{job.title}</h3>
                                <Badge variant="outline" className="text-xs font-mono">
                                  Job #{job.id.slice(0, 8).toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground flex items-center gap-2">
                                <Shield className="h-4 w-4 text-amber-500" />
                                {anonymizeCompanyName(job.industry)}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
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
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 md:text-right">
                            <div>
                              <p className="text-lg font-bold text-emerald">
                                {job.recruiter_fee_percentage}% Fee
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatSalary(job.salary_min, job.salary_max)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Posted {formatDate(job.created_at)}
                              </p>
                            </div>
                            <ArrowUpRight className="h-5 w-5 text-muted-foreground hidden md:block" />
                          </div>
                        </div>
                        
                        {job.skills && job.skills.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {job.skills.slice(0, 5).map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {job.skills.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{job.skills.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </div>
  );
}
