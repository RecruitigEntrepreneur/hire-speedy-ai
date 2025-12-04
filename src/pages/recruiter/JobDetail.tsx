import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CandidateSubmitForm } from '@/components/recruiter/CandidateSubmitForm';
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  ArrowLeft,
  Flame,
  Zap,
  Circle,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Building2,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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
}

interface Submission {
  id: string;
  candidate_id: string;
  status: string;
  submitted_at: string;
  candidates: {
    full_name: string;
    email: string;
  };
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJobDetails();
    }
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch my submissions for this job
      if (user) {
        const { data: mySubsData } = await supabase
          .from('submissions')
          .select(`
            id,
            candidate_id,
            status,
            submitted_at,
            candidates (
              full_name,
              email
            )
          `)
          .eq('job_id', id)
          .eq('recruiter_id', user.id);

        setMySubmissions(mySubsData as any || []);

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

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
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
      </div>
    );
  }

  const potentialEarning = calculatePotentialEarning();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Back Button */}
          <Link to="/recruiter/jobs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Jobs
            </Button>
          </Link>

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0">
                <Building2 className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold">{job.title}</h1>
                  {getUrgencyBadge(job.urgency || 'standard')}
                </div>
                <p className="text-lg text-muted-foreground">{job.company_name}</p>
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
                  {job.industry && (
                    <Badge variant="outline">{job.industry}</Badge>
                  )}
                </div>
              </div>
            </div>

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

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>Beschreibung</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{job.description || 'Keine Beschreibung vorhanden.'}</p>
                </CardContent>
              </Card>

              {/* Requirements */}
              {job.requirements && (
                <Card>
                  <CardHeader>
                    <CardTitle>Anforderungen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{job.requirements}</p>
                  </CardContent>
                </Card>
              )}

              {/* Must Haves & Nice to Haves */}
              <div className="grid md:grid-cols-2 gap-4">
                {job.must_haves && job.must_haves.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CheckCircle2 className="h-5 w-5 text-emerald" />
                        Must-Haves
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {job.must_haves.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-emerald mt-0.5 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {job.nice_to_haves && job.nice_to_haves.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Circle className="h-5 w-5 text-muted-foreground" />
                        Nice-to-Haves
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {job.nice_to_haves.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Skills */}
              {job.skills && job.skills.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Gesuchte Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {job.skills.map((skill) => (
                        <Badge key={skill} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* My Submissions */}
              {mySubmissions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Meine Einreichungen ({mySubmissions.length})</CardTitle>
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

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Fee Card */}
              <Card className="border-emerald/30 bg-emerald/5">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Deine Fee</p>
                    <p className="text-3xl font-bold text-emerald">
                      {job.recruiter_fee_percentage}%
                    </p>
                    {potentialEarning && (
                      <p className="text-sm text-muted-foreground mt-1">
                        ca. €{potentialEarning.toLocaleString()} bei Placement
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Job Details */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Gehalt</span>
                    <span className="font-medium">{formatSalary(job.salary_min, job.salary_max)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Erfahrung</span>
                    <span className="font-medium capitalize">{job.experience_level || '-'}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Einreichungen</span>
                    <span className="font-medium">
                      {totalSubmissions} gesamt ({mySubmissions.length} von dir)
                    </span>
                  </div>
                  {job.deadline && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Deadline</span>
                        <span className="font-medium flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(job.deadline).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

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
            </div>
          </div>
        </div>
      </DashboardLayout>
    </div>
  );
}