import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  Lock,
  Users
} from 'lucide-react';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';

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
  // Neue Felder für kontextreiche Anonymisierung
  company_size_band: string | null;
  funding_stage: string | null;
  hiring_urgency: string | null;
  tech_environment: string[] | null;
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

  const calculatePotentialEarning = (
    salaryMin: number | null, 
    salaryMax: number | null, 
    feePercentage: number | null
  ): number | null => {
    if (!feePercentage || (!salaryMin && !salaryMax)) return null;
    const avgSalary = salaryMin && salaryMax 
      ? (salaryMin + salaryMax) / 2 
      : salaryMin || salaryMax;
    if (!avgSalary) return null;
    return Math.round(avgSalary * (feePercentage / 100));
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
            <h1 className="text-2xl font-bold tracking-tight">Open Jobs</h1>
            <p className="text-sm text-muted-foreground">{filteredJobs.length} Opportunities</p>
          </div>
          <Button asChild size="sm" className="gap-2">
            <Link to="/recruiter/candidates">
              <Users className="h-4 w-4" />
              Meine Kandidaten
            </Link>
          </Button>
        </div>

        {/* Compact Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Jobtitel oder Skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={remoteFilter} onValueChange={setRemoteFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Remote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">Vor Ort</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Compact Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 font-semibold">Keine Jobs gefunden</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || remoteFilter !== 'all' 
                  ? 'Passe deine Filter an'
                  : 'Bald verfügbar'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {filteredJobs.map((job) => (
              <Link key={job.id} to={`/recruiter/jobs/${job.id}`}>
                <Card className="border-border/50 hover:border-emerald/40 hover:bg-accent/30 transition-all cursor-pointer group">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className="h-10 w-10 rounded-lg bg-gradient-navy flex items-center justify-center flex-shrink-0">
                        <Briefcase className="h-5 w-5 text-primary-foreground" />
                      </div>
                      
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{job.title}</h3>
                          <Badge variant="secondary" className="capitalize text-xs shrink-0">
                            {job.remote_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            {formatAnonymousCompany({
                              industry: job.industry,
                              companySize: job.company_size_band,
                              fundingStage: job.funding_stage,
                              techStack: job.tech_environment,
                              location: job.location,
                              urgency: job.hiring_urgency,
                              remoteType: job.remote_type,
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Skills - Compact */}
                      <div className="hidden md:flex items-center gap-1.5 max-w-[250px]">
                        {job.skills?.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs py-0">
                            {skill}
                          </Badge>
                        ))}
                        {job.skills && job.skills.length > 3 && (
                          <Badge variant="outline" className="text-xs py-0 text-muted-foreground">
                            +{job.skills.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Fee & Potential Earnings */}
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald">{job.recruiter_fee_percentage}%</p>
                        {calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage) && (
                          <p className="text-xs font-semibold text-emerald">
                            ~€{calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage)?.toLocaleString()}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatSalary(job.salary_min, job.salary_max)}
                        </p>
                      </div>

                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
