import { useState, useEffect } from 'react';
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
  Calendar
} from 'lucide-react';

interface CompareCandidate {
  id: string;
  submissionId: string;
  fullName: string;
  jobTitle: string;
  city: string;
  experienceYears: number;
  skills: string[];
  matchScore: number;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriod?: string;
  availabilityDate?: string;
}

interface CandidateCompareViewProps {
  submissionIds: string[];
  onRemove: (submissionId: string) => void;
  onClose: () => void;
}

export function CandidateCompareView({ submissionIds, onRemove, onClose }: CandidateCompareViewProps) {
  const [candidates, setCandidates] = useState<CompareCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (submissionIds.length > 0) {
      fetchCandidates();
    }
  }, [submissionIds]);

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          match_score,
          candidates!inner (
            id,
            full_name,
            job_title,
            city,
            experience_years,
            skills,
            current_salary,
            expected_salary,
            notice_period,
            availability_date
          )
        `)
        .in('id', submissionIds);

      if (error) throw error;

      const formatted: CompareCandidate[] = (data || []).map((sub: any) => ({
        id: sub.candidates.id,
        submissionId: sub.id,
        fullName: sub.candidates.full_name,
        jobTitle: sub.candidates.job_title || 'Nicht angegeben',
        city: sub.candidates.city || '',
        experienceYears: sub.candidates.experience_years || 0,
        skills: sub.candidates.skills || [],
        matchScore: sub.match_score || 0,
        currentSalary: sub.candidates.current_salary,
        expectedSalary: sub.candidates.expected_salary,
        noticePeriod: sub.candidates.notice_period,
        availabilityDate: sub.candidates.availability_date,
      }));

      setCandidates(formatted);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => 
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  // Collect all unique skills
  const allSkills = [...new Set(candidates.flatMap(c => c.skills))].slice(0, 10);

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Kandidatenvergleich ({candidates.length}/3)</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Wählen Sie bis zu 3 Kandidaten zum Vergleichen aus
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 text-sm font-medium text-muted-foreground w-32">Kriterium</th>
                  {candidates.map(candidate => (
                    <th key={candidate.submissionId} className="text-left p-2 min-w-[200px]">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(candidate.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{candidate.fullName}</p>
                            <p className="text-xs text-muted-foreground">{candidate.jobTitle}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
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
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">Match Score</td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2">
                      <div className="flex items-center gap-2">
                        <Progress value={c.matchScore} className="h-2 w-20" />
                        <span className={`text-sm font-medium ${getScoreColor(c.matchScore)}`}>
                          {c.matchScore}%
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Location */}
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Standort
                    </div>
                  </td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2 text-sm">
                      {c.city || '-'}
                    </td>
                  ))}
                </tr>

                {/* Experience */}
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      Erfahrung
                    </div>
                  </td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2 text-sm">
                      {c.experienceYears} Jahre
                    </td>
                  ))}
                </tr>

                {/* Expected Salary */}
                <tr>
                  <td className="p-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Euro className="h-3 w-3" />
                      Gehaltswunsch
                    </div>
                  </td>
                  {candidates.map(c => (
                    <td key={c.submissionId} className="p-2 text-sm">
                      {c.expectedSalary 
                        ? `€${(c.expectedSalary / 1000).toFixed(0)}k` 
                        : '-'}
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
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
