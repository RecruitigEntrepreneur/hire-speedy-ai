import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Star,
  Clock,
  GraduationCap,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Linkedin,
  Github,
  Globe,
  Loader2,
  Send,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
  recruiter?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface Interview {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  feedback: string | null;
  rating?: number | null;
}

interface CandidateQuickViewProps {
  submission: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageChange: (submissionId: string, newStage: string) => void;
  onScheduleInterview: (submission: Submission) => void;
  onReject: (submission: Submission) => void;
}

const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Eingegangen' },
  { key: 'screening', label: 'In Prüfung' },
  { key: 'interview', label: 'Interview' },
  { key: 'second_interview', label: 'Zweitgespräch' },
  { key: 'offer', label: 'Angebot' },
  { key: 'hired', label: 'Eingestellt' },
];

export function CandidateQuickView({
  submission,
  open,
  onOpenChange,
  onStageChange,
  onScheduleInterview,
  onReject,
}: CandidateQuickViewProps) {
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (submission && open) {
      fetchInterviews();
    }
  }, [submission, open]);

  const fetchInterviews = async () => {
    if (!submission) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('submission_id', submission.id)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      setInterviews(data || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!submission) return null;

  const { candidate } = submission;
  const initials = candidate.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formatSalary = (amount: number | null) => {
    if (!amount) return '-';
    return `€${amount.toLocaleString()}`;
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'submitted': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'screening': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'interview': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'second_interview': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      case 'offer': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'hired': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted';
    }
  };

  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.key === submission.stage);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-navy text-primary-foreground text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{candidate.full_name}</SheetTitle>
              <SheetDescription className="flex flex-col gap-1 mt-1">
                {candidate.job_title && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    {candidate.job_title}
                    {candidate.company && ` bei ${candidate.company}`}
                  </span>
                )}
                {candidate.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {candidate.city}
                  </span>
                )}
              </SheetDescription>
            </div>
          </div>

          {/* Match Score & Stage */}
          <div className="flex items-center gap-3 mt-4">
            {submission.match_score && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                <Star className="h-4 w-4 text-primary" />
                <span className="font-semibold text-primary">{submission.match_score}%</span>
                <span className="text-xs text-muted-foreground">Match</span>
              </div>
            )}
            <Badge className={getStageColor(submission.stage || 'submitted')}>
              {PIPELINE_STAGES.find(s => s.key === submission.stage)?.label || 'Neu'}
            </Badge>
          </div>

          {/* Stage Progress */}
          <div className="mt-4">
            <div className="flex justify-between mb-1.5">
              {PIPELINE_STAGES.map((stage, i) => (
                <div
                  key={stage.key}
                  className={`text-[10px] ${i <= currentStageIndex ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                >
                  {i === currentStageIndex ? stage.label : ''}
                </div>
              ))}
            </div>
            <Progress
              value={((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100}
              className="h-1.5"
            />
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="w-full justify-start px-6 pt-4 pb-0 bg-transparent border-b rounded-none">
            <TabsTrigger value="profile" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Profil
            </TabsTrigger>
            <TabsTrigger value="interviews" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Interviews ({interviews.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Notizen
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-380px)]">
            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-0 px-6 py-4 space-y-6">
              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Kontakt</h4>
                <div className="grid gap-2">
                  <a
                    href={`mailto:${candidate.email}`}
                    className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {candidate.email}
                  </a>
                  {candidate.phone && (
                    <a
                      href={`tel:${candidate.phone}`}
                      className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                    >
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {candidate.phone}
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  {candidate.linkedin_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {candidate.github_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={candidate.github_url} target="_blank" rel="noopener noreferrer">
                        <Github className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {candidate.portfolio_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {candidate.cv_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={candidate.cv_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-1.5" />
                        CV
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Key Facts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Erfahrung</p>
                  <p className="font-medium">
                    {candidate.experience_years ? `${candidate.experience_years} Jahre` : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Seniority</p>
                  <p className="font-medium capitalize">{candidate.seniority || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Aktuelles Gehalt</p>
                  <p className="font-medium">{formatSalary(candidate.current_salary)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Gehaltsvorstellung</p>
                  <p className="font-medium">{formatSalary(candidate.expected_salary)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Verfügbarkeit</p>
                  <p className="font-medium">
                    {candidate.availability_date
                      ? format(new Date(candidate.availability_date), 'dd.MM.yyyy', { locale: de })
                      : candidate.notice_period || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Eingereicht am</p>
                  <p className="font-medium">
                    {format(new Date(submission.submitted_at), 'dd.MM.yyyy', { locale: de })}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Skills */}
              {candidate.skills && candidate.skills.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {candidate.summary && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Zusammenfassung</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {candidate.summary}
                  </p>
                </div>
              )}

              {/* Recruiter Notes */}
              {submission.recruiter_notes && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Recruiter-Notizen</h4>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm">{submission.recruiter_notes}</p>
                      {submission.recruiter && (
                        <p className="text-xs text-muted-foreground mt-2">
                          — {submission.recruiter.full_name || submission.recruiter.email}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Interviews Tab */}
            <TabsContent value="interviews" className="mt-0 px-6 py-4 space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : interviews.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Noch keine Interviews geplant</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => onScheduleInterview(submission)}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Interview planen
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {interviews.map((interview) => (
                    <Card key={interview.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">
                              {format(new Date(interview.scheduled_at), "EEEE, d. MMMM yyyy 'um' HH:mm", { locale: de })}
                            </p>
                            <Badge
                              variant={interview.status === 'completed' ? 'default' : 'secondary'}
                              className="mt-1"
                            >
                              {interview.status === 'scheduled' ? 'Geplant' :
                               interview.status === 'completed' ? 'Abgeschlossen' :
                               interview.status === 'cancelled' ? 'Abgesagt' : interview.status}
                            </Badge>
                          </div>
                          {interview.rating && (
                            <div className="flex items-center gap-1 text-yellow-500">
                              <Star className="h-4 w-4 fill-current" />
                              <span className="font-semibold">{interview.rating}</span>
                            </div>
                          )}
                        </div>
                        {interview.feedback && (
                          <p className="text-sm text-muted-foreground mt-3">
                            {interview.feedback}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-0 px-6 py-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Interne Notizen zum Kandidaten werden hier angezeigt.
                </p>
                {submission.recruiter_notes && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm">{submission.recruiter_notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Actions Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <div className="flex items-center gap-2">
            <Select
              value={submission.stage || 'submitted'}
              onValueChange={(value) => onStageChange(submission.id, value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Stage ändern" />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage.key} value={stage.key}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              onClick={() => onScheduleInterview(submission)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Interview
            </Button>
            
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => onReject(submission)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
