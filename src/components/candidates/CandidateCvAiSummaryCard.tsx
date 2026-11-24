import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CandidateCvAiSummaryCardProps {
  summary: string | null;
  bullets: unknown | null;
}

export function CandidateCvAiSummaryCard({ summary, bullets }: CandidateCvAiSummaryCardProps) {
  const { t } = useTranslation('candidateDetail');
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
            {t('cvSummary.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('cvSummary.empty')}
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
        <CardTitle className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          {t('cvSummary.title')}
          <Badge variant="secondary" className="ml-auto rounded-full text-xs font-normal text-muted-foreground">
            {t('cvSummary.fromCv')}
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
                className="mt-1 h-auto px-0 text-xs font-medium text-klick hover:bg-transparent hover:text-klick hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? t('common.showLess') : `${t('common.showMore')} ›`}
              </Button>
            )}
          </div>
        )}

        {parsedBullets.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">{t('cvSummary.highlights')}</p>
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
                className="mt-1 h-auto px-0 text-xs font-medium text-klick hover:bg-transparent hover:text-klick hover:underline"
                onClick={() => setExpanded(true)}
              >
                {t('cvSummary.more', { count: parsedBullets.length - 3 })} ›
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
