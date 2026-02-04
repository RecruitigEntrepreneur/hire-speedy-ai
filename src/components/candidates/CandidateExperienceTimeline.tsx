import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CandidateExperienceTimelineProps {
  candidateId: string;
  onReparse?: () => void;
  isReparsing?: boolean;
}

interface Experience {
  id: string;
  company_name: string;
  job_title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  sort_order: number;
}

export function CandidateExperienceTimeline({ candidateId, onReparse, isReparsing }: CandidateExperienceTimelineProps) {
  const { data: experiences, isLoading } = useQuery({
    queryKey: ['candidate-experiences', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_experiences')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Experience[];
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '?';
    try {
      return format(new Date(dateStr), 'MMM yyyy', { locale: de });
    } catch (e) {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!experiences || experiences.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground space-y-3">
        <Building2 className="h-10 w-10 mx-auto opacity-40" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Keine Berufserfahrung hinterlegt</p>
          <p className="text-xs">
            Die Karriere-Stationen wurden nicht aus dem CV extrahiert
          </p>
        </div>
        {onReparse && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onReparse}
            disabled={isReparsing}
            className="mt-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isReparsing && "animate-spin")} />
            {isReparsing ? 'Parsing...' : 'CV erneut parsen'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      {/* Timeline line */}
      <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-border" />
      
      {experiences.map((exp, index) => (
        <div key={exp.id} className="relative pl-10">
          {/* Timeline dot */}
          <div className={`absolute left-2.5 top-5 w-3 h-3 rounded-full border-2 ${
            exp.is_current 
              ? 'bg-primary border-primary' 
              : 'bg-background border-muted-foreground'
          }`} />
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <h4 className="font-semibold">{exp.job_title}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{exp.company_name}</span>
                  </div>
                  {exp.location && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{exp.location}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(exp.start_date)} – {exp.is_current ? 'Heute' : formatDate(exp.end_date)}
                    </span>
                  </div>
                  {exp.is_current && (
                    <Badge variant="default" className="text-xs">Aktuell</Badge>
                  )}
                </div>
              </div>
              
              {exp.description && (
                <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">
                  {exp.description}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
