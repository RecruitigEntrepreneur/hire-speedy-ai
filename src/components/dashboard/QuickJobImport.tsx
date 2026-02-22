import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Type, Link2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuickJobImportProps {
  className?: string;
}

export function QuickJobImport({ className }: QuickJobImportProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const importOptions = [
    {
      mode: 'pdf',
      icon: FileText,
      label: 'PDF',
      description: 'SAP, Personio, Workday...',
    },
    {
      mode: 'text',
      icon: Type,
      label: 'Text',
      description: 'Copy & Paste',
    },
    {
      mode: 'url',
      icon: Link2,
      label: 'URL',
      description: 'LinkedIn, Stepstone...',
    },
  ] as const;

  return (
    <Card className={cn(
      "bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden",
      className
    )}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Neue Stelle in 60 Sekunden</h3>
            <p className="text-xs text-muted-foreground">KI übernimmt den Rest</p>
          </div>
        </div>

        <div className={cn(
          "grid gap-2",
          isMobile ? "grid-cols-1" : "grid-cols-3"
        )}>
          {importOptions.map(({ mode, icon: Icon, label, description }) => (
            <button
              key={mode}
              onClick={() => navigate(`/dashboard/jobs/new?mode=${mode}`)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border border-border/50",
                "bg-background/60 backdrop-blur-sm",
                "cursor-pointer transition-all",
                "hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
                "active:scale-[0.98]",
                isMobile ? "flex-row" : "flex-col text-center"
              )}
            >
              <Icon className={cn(
                "text-muted-foreground",
                isMobile ? "h-5 w-5" : "h-6 w-6"
              )} />
              <div className={isMobile ? "text-left" : ""}>
                <span className="text-sm font-medium block">{label}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
