import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
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
  ArrowUpRight,
  Loader2,
  Lock,
  CheckCircle,
  Users,
  Building2
} from 'lucide-react';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { getCompanyLogoUrl, formatHeadcount } from '@/lib/companyLogo';

interface CompanyProfile {
  logo_url: string | null;
  website: string | null;
  headcount: number | null;
  industry: string | null;
}

interface Job {
  id: string;
  client_id: string;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteFilter, setRemoteFilter] = useState<string>('all');
  const [revealedJobIds, setRevealedJobIds] = useState<Set<string>>(new Set());
  const [companyProfiles, setCompanyProfiles] = useState<Record<string, CompanyProfile>>({});

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (user) {
      fetchRevealedJobs();
    }
  }, [user]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setJobs(data);
        
        // Fetch company profiles for all client_ids
        const clientIds = [...new Set(data.map(j => j.client_id).filter(Boolean))];
        if (clientIds.length > 0) {
          const { data: profiles } = await supabase
            .from('company_profiles')
            .select('user_id, logo_url, website, headcount, industry')
            .in('user_id', clientIds);
          
          if (profiles) {
            const profileMap: Record<string, CompanyProfile> = {};
            profiles.forEach(p => {
              profileMap[p.user_id] = {
                logo_url: p.logo_url,
                website: p.website,
                headcount: p.headcount,
                industry: p.industry,
              };
            });
            setCompanyProfiles(profileMap);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevealedJobs = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('job_id')
        .eq('recruiter_id', user.id)
        .eq('company_revealed', true);

      if (!error && data) {
        setRevealedJobIds(new Set(data.map(s => s.job_id)));
      }
    } catch (error) {
      console.error('Error fetching revealed jobs:', error);
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
          <div className="grid gap-4">
            {filteredJobs.map((job, index) => {
              const potentialEarning = calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage);
              const profile = companyProfiles[job.client_id];
              
              return (
                <Link key={job.id} to={`/recruiter/jobs/${job.id}`}>
                  <Card 
                    className="border-border/40 bg-card/80 backdrop-blur-sm hover:border-emerald/40 hover:shadow-lg hover:shadow-emerald/5 hover:scale-[1.01] transition-all duration-300 cursor-pointer group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardContent className="p-5">
                      <div className="space-y-3">
                        {/* Row 1: Icon/Logo + Title + Badges */}
                        <div className="flex items-start gap-4">
                          {revealedJobIds.has(job.id) ? (
                            // Revealed: Show company logo
                            <div className="h-12 w-12 rounded-xl overflow-hidden bg-background border border-border/50 flex items-center justify-center flex-shrink-0">
                              <img 
                                src={getCompanyLogoUrl(
                                  profile?.logo_url,
                                  profile?.website,
                                  job.company_name
                                )}
                                alt={job.company_name}
                                className="h-10 w-10 object-contain"
                                onError={(e) => {
                                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company_name)}&background=1e3a5f&color=fff&size=96&bold=true`;
                                }}
                              />
                            </div>
                          ) : (
                            // Anonymous: Show briefcase icon
                            <div className="h-12 w-12 rounded-xl bg-gradient-navy flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow flex-shrink-0">
                              <Briefcase className="h-6 w-6 text-primary-foreground" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-base">{job.title}</h3>
                              <Badge variant="secondary" className="capitalize text-xs">
                                {job.remote_type}
                              </Badge>
                              {revealedJobIds.has(job.id) && (
                                <Badge variant="outline" className="text-xs border-emerald/30 text-emerald">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Enthüllt
                                </Badge>
                              )}
                              {job.hiring_urgency === 'urgent' && (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 animate-pulse text-xs">
                                  🔥 Dringend
                                </Badge>
                              )}
                            </div>
                            
                            {revealedJobIds.has(job.id) ? (
                              // Revealed: Show full company details
                              <div className="mt-1">
                                <p className="text-sm font-medium text-foreground">{job.company_name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                  {formatHeadcount(profile?.headcount) && (
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {formatHeadcount(profile?.headcount)}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {job.location}
                                  </span>
                                  {job.industry && (
                                    <span>{job.industry}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // Anonymous: Show anonymized company info
                              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                {formatAnonymousCompany({
                                  industry: job.industry,
                                  companySize: job.company_size_band,
                                  fundingStage: job.funding_stage,
                                  techStack: job.tech_environment,
                                  location: job.location,
                                  urgency: job.hiring_urgency,
                                  remoteType: job.remote_type,
                                })}
                              </p>
                            )}
                          </div>
                          
                          <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        
                        {/* Row 2: Skills + Earning */}
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            {job.skills?.slice(0, 4).map((skill) => (
                              <Badge 
                                key={skill} 
                                variant="outline" 
                                className="text-xs hover:bg-primary/10 transition-colors"
                              >
                                {skill}
                              </Badge>
                            ))}
                            {job.skills && job.skills.length > 4 && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                +{job.skills.length - 4}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-right shrink-0">
                            {potentialEarning ? (
                              <p className="font-bold text-lg text-emerald">
                                €{potentialEarning.toLocaleString('de-DE')}
                              </p>
                            ) : (
                              <p className="font-medium text-muted-foreground">k.A.</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatSalary(job.salary_min, job.salary_max)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
