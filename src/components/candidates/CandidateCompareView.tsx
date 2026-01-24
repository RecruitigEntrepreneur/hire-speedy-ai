import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  X, 
  MapPin, 
  Briefcase, 
  Clock, 
  Euro, 
  CheckCircle,
  XCircle,
  Calendar,
  CalendarPlus,
  ThumbsDown,
  Eye,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateAnonymousId, anonymizeRegionBroad, anonymizeExperience, anonymizeSalary } from '@/lib/anonymization';
import { toast } from 'sonner';

interface CompareCandidate {
  id: string;
  submissionId: string;
  anonymousId: string;
  city: string;
  experienceYears: number;
  skills: string[];
  matchScore: number;
  expectedSalary?: number;
  noticePeriod?: string;
  availabilityDate?: string;
  stage?: string;
}

interface CandidateCompareViewProps {
  submissionIds: string[];
  onRemove: (submissionId: string) => void;
  onClose: () => void;
  onInterviewRequest?: (submissionId: string) => void;
  onReject?: (submissionId: string) => void;
}

export function CandidateCompareView({ 
  submissionIds, 
  onRemove, 
  onClose,
  onInterviewRequest,
  onReject
}: CandidateCompareViewProps) {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CompareCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (submissionIds.length > 0) {
      fetchCandidates();
    } else {
      setCandidates([]);
      setLoading(false);
    }
  }, [submissionIds]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          match_score,
          stage,
          jobs!inner (
            title
          ),
          candidates!inner (
            id,
            city,
            experience_years,
            skills,
            expected_salary,
            notice_period,
            availability_date
          )
        `)
        .in('id', submissionIds);

      if (error) throw error;

      const formatted: CompareCandidate[] = (data || []).map((sub: any) => {
        // Generate Triple-Blind anonymous ID from job title prefix + submission ID
        const jobPrefix = sub.jobs?.title?.slice(0, 2).toUpperCase() || 'XX';
        const anonymousId = `${jobPrefix}-${sub.id.slice(0, 6).toUpperCase()}`;
        
        return {
          id: sub.candidates.id,
          submissionId: sub.id,
          anonymousId,
          city: sub.candidates.city || '',
          experienceYears: sub.candidates.experience_years || 0,
          skills: sub.candidates.skills || [],
          matchScore: sub.match_score || 0,
          expectedSalary: sub.candidates.expected_salary,
          noticePeriod: sub.candidates.notice_period,
          availabilityDate: sub.candidates.availability_date,
          stage: sub.stage,
        };
      });

      setCandidates(formatted);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-success/10 border-success/30';
    if (score >= 60) return 'bg-primary/10 border-primary/30';
    if (score >= 40) return 'bg-warning/10 border-warning/30';
    return 'bg-destructive/10 border-destructive/30';
  };

  const handleViewProfile = (submissionId: string) => {
    navigate(`/dashboard/candidates/${submissionId}`);
    onClose();
  };

  // Collect all unique skills from all candidates
  const allSkills = [...new Set(candidates.flatMap(c => c.skills))].slice(0, 12);

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Kandidatenvergleich
          <Badge variant="outline">{candidates.length}/3</Badge>
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p>Wählen Sie bis zu 3 Kandidaten zum Vergleichen aus</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 text-sm font-medium text-muted-foreground w-32">Kriterium</th>
                  {candidates.map(candidate => (
                    <th key={candidate.submissionId} className="text-left p-2 min-w-[220px]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border">
                            <AvatarFallback className="bg-primary/10 text-primary font-mono text-xs">
                              {candidate.anonymousId.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-mono font-medium text-sm">{candidate.anonymousId}</p>
                            <p className="text-xs text-muted-foreground">
                              {candidate.stage === 'submitted' && 'Eingegangen'}
                              {candidate.stage === 'interview_1' && 'Interview 1'}
                              {candidate.stage === 'interview_2' && 'Interview 2'}
                              {candidate.stage === 'offer' && 'Angebot'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 shrink-0"
                          onClick={() => onRemove(candidate.submissionId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Match Score */}
                <tr className="bg-muted/30">
                  <td className="p-2 text-sm font-medium">Match Score</td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold text-sm",
                          getScoreBgColor(c.matchScore),
                          getScoreColor(c.matchScore)
                        )}>
                          {c.matchScore}
                        </div>
                        <Progress value={c.matchScore} className="h-2 flex-1 max-w-20" />
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Location - Anonymized */}
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Region
                    </div>
                  </td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2 text-sm">
                      {anonymizeRegionBroad(c.city)}
                    </td>
                  ))}
                </tr>

                {/* Experience - Anonymized as range */}
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      Erfahrung
                    </div>
                  </td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2 text-sm">
                      {anonymizeExperience(c.experienceYears)}
                    </td>
                  ))}
                </tr>

                {/* Expected Salary - Anonymized */}
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Euro className="h-3 w-3" />
                      Gehaltswunsch
                    </div>
                  </td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2 text-sm">
                      {anonymizeSalary(c.expectedSalary || null)}
                    </td>
                  ))}
                </tr>

                {/* Availability */}
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Verfügbarkeit
                    </div>
                  </td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2 text-sm">
                      {c.noticePeriod || c.availabilityDate || '-'}
                    </td>
                  ))}
                </tr>

                {/* Skills comparison header */}
                <tr className="bg-muted/30">
                  <td colSpan={candidates.length + 1} className="p-2 text-sm font-medium">
                    Skills
                  </td>
                </tr>

                {/* Skills comparison */}
                {allSkills.map(skill => (
                  <tr key={skill}>
                    <td className="p-2 text-sm text-muted-foreground truncate max-w-[120px]" title={skill}>
                      {skill}
                    </td>
                    {candidates.map(c => (
                      <td key={c.submissionId} className="p-2">
                        {c.skills.includes(skill) ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/30" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Quick Actions Row */}
                <tr className="bg-muted/50">
                  <td className="p-2 text-sm font-medium">Aktionen</td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleViewProfile(c.submissionId)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Profil
                        </Button>
                        {onInterviewRequest && c.stage === 'submitted' && (
                          <Button 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              onInterviewRequest(c.submissionId);
                              toast.success('Interview-Anfrage gesendet');
                            }}
                          >
                            <CalendarPlus className="h-3 w-3 mr-1" />
                            Interview
                          </Button>
                        )}
                        {onReject && c.stage === 'submitted' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => onReject(c.submissionId)}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
