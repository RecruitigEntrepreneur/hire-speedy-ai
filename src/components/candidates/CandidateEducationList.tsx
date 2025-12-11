import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Award } from 'lucide-react';

interface CandidateEducationListProps {
  candidateId: string;
}

interface Education {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  graduation_year: number | null;
  grade: string | null;
  sort_order: number;
}

export function CandidateEducationList({ candidateId }: CandidateEducationListProps) {
  const { data: educations, isLoading } = useQuery({
    queryKey: ['candidate-educations', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_educations')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Education[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!educations || educations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Keine Ausbildung hinterlegt</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {educations.map((edu) => (
        <Card key={edu.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">{edu.institution}</h4>
                  {edu.degree && (
                    <p className="text-sm text-muted-foreground">
                      {edu.degree}
                      {edu.field_of_study && ` – ${edu.field_of_study}`}
                    </p>
                  )}
                  {edu.grade && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Award className="h-3 w-3" />
                      <span>Note: {edu.grade}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {edu.graduation_year && (
                <Badge variant="secondary">{edu.graduation_year}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
