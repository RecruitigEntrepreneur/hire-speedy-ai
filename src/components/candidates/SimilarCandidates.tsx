import { useSimilarCandidates } from "@/hooks/useSimilarCandidates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface SimilarCandidatesProps {
  candidateId: string;
  limit?: number;
  className?: string;
}

export function SimilarCandidates({ candidateId, limit = 5, className }: SimilarCandidatesProps) {
  const { data: similar, isLoading, error } = useSimilarCandidates(candidateId, limit);

  if (error) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Ähnliche Kandidaten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">AI-Analyse läuft...</p>
          <Progress value={75} className="h-1.5" />
        </CardContent>
      </Card>
    );
  }

  if (!similar || similar.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Ähnliche Kandidaten
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-1">
            Keine ähnlichen Kandidaten gefunden
          </p>
          <p className="text-xs text-muted-foreground">
            Mehr Skills hinzufügen für bessere Matches
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Ähnliche Kandidaten
          <Badge variant="secondary" className="ml-auto text-xs">
            AI-powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {similar.map((candidate) => (
          <Link
            key={candidate.id}
            to={`/dashboard/candidates/${candidate.id}`}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm shrink-0">
              {getInitials(candidate.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {candidate.full_name}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-xs shrink-0 ${getSimilarityColor(candidate.similarity)}`}
                >
                  {Math.round(candidate.similarity * 100)}% Match
                </Badge>
              </div>
              {candidate.job_title && (
                <p className="text-xs text-muted-foreground truncate">
                  {candidate.job_title}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {candidate.city && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {candidate.city}
                  </span>
                )}
                {candidate.skills && candidate.skills.length > 0 && (
                  <div className="flex gap-1 overflow-hidden">
                    {candidate.skills.slice(0, 2).map((skill, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="text-xs px-1.5 py-0"
                      >
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{candidate.skills.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.85) return 'border-green-500 text-green-700 bg-green-50';
  if (similarity >= 0.7) return 'border-blue-500 text-blue-700 bg-blue-50';
  if (similarity >= 0.5) return 'border-yellow-500 text-yellow-700 bg-yellow-50';
  return 'border-muted text-muted-foreground';
}

export default SimilarCandidates;
