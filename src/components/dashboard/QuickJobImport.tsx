import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Briefcase, Code2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuickJobImportProps {
  className?: string;
}

const trackOptions = [
  {
    track: 'permanent',
    icon: Briefcase,
    label: 'Festanstellung',
    description: 'Unbefristet oder befristet',
    tags: ['Gehalt', 'Benefits', 'Probezeit'],
  },
  {
    track: 'freelance',
    icon: Code2,
    label: 'Freelancer',
    description: 'Projekt oder zeitlich begrenzt',
    tags: ['Tagessatz', 'Laufzeit', 'Remote'],
  },
  {
    track: 'temp_staffing',
    icon: ShieldCheck,
    label: 'ANÜ',
    description: 'AÜG-konforme Überlassung',
    tags: ['Verrechnungssatz', 'Equal Pay', 'Übernahme'],
  },
] as const;

export function QuickJobImport({ className }: QuickJobImportProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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
            <h3 className="font-semibold text-sm">Neue Stelle erstellen</h3>
            <p className="text-xs text-muted-foreground">Wählen Sie den Stellentyp</p>
          </div>
        </div>

        <div className={cn(
          "grid gap-2",
          isMobile ? "grid-cols-1" : "grid-cols-3"
        )}>
          {trackOptions.map(({ track, icon: Icon, label, description, tags }) => (
            <button
              key={track}
              onClick={() => navigate(`/dashboard/jobs/new?track=${track}`)}
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
                {!isMobile && (
                  <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                    {tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
