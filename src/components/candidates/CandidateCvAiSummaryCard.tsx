import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateCvAiSummaryCardProps {
  summary: string | null;
  bullets: unknown | null;
}

export function CandidateCvAiSummaryCard({ summary, bullets }: CandidateCvAiSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Parse bullets safely
  const parsedBullets: string[] = Array.isArray(bullets) 
    ? bullets.filter((b): b is string => typeof b === 'string')
    : [];

  if (!summary && parsedBullets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            AI-Zusammenfassung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Kein CV geparst – laden Sie einen Lebenslauf hoch für automatische Analyse.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxLength = 200;
  const needsTruncation = summary && summary.length > maxLength;
  const displaySummary = expanded || !needsTruncation 
    ? summary 
    : `${summary?.slice(0, maxLength)}...`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI-Zusammenfassung
          <Badge variant="secondary" className="text-xs ml-auto">
            aus CV
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary && (
          <div>
            <p className={cn(
              "text-sm text-muted-foreground leading-relaxed",
              !expanded && needsTruncation && "line-clamp-3"
            )}>
              {displaySummary}
            </p>
            {needsTruncation && (
              <Button
                variant="ghost"
                size="sm"
                className="px-0 h-auto text-xs mt-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Weniger anzeigen
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Mehr anzeigen
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {parsedBullets.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Highlights</p>
            <ul className="space-y-1">
              {parsedBullets.slice(0, expanded ? undefined : 3).map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1.5 text-xs">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            {parsedBullets.length > 3 && !expanded && (
              <Button
                variant="ghost"
                size="sm"
                className="px-0 h-auto text-xs mt-1"
                onClick={() => setExpanded(true)}
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                +{parsedBullets.length - 3} weitere
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
