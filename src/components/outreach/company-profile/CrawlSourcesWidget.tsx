import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Globe, 
  FileText, 
  Linkedin, 
  Building2, 
  Briefcase, 
  Newspaper,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";

interface CrawlSourceEntry {
  crawled_at?: string | null;
  status?: 'success' | 'no_results' | 'error' | 'pending' | null;
  fields?: string[];
  contacts_found?: number;
  executives_found?: number;
  jobs_found?: number;
  error?: string;
}

interface CrawlSourcesWidgetProps {
  crawlSources: Json | null | undefined;
  lastCrawledAt?: string | null;
  isCrawling?: boolean;
}

const SOURCE_CONFIG: Record<string, { 
  icon: typeof Globe; 
  label: string; 
  description: string;
}> = {
  website: { 
    icon: Globe, 
    label: 'Website', 
    description: 'Hauptseite des Unternehmens' 
  },
  impressum: { 
    icon: FileText, 
    label: 'Impressum', 
    description: 'Rechtliche Informationen & Geschäftsführer' 
  },
  team_page: { 
    icon: Users, 
    label: 'Team-Seite', 
    description: 'Führungskräfte & Team' 
  },
  linkedin_company: { 
    icon: Linkedin, 
    label: 'LinkedIn Company', 
    description: 'Unternehmensprofil' 
  },
  linkedin_people: { 
    icon: Linkedin, 
    label: 'LinkedIn Executives', 
    description: 'Entscheider-Profile' 
  },
  xing: { 
    icon: Building2, 
    label: 'Xing', 
    description: 'DACH-Unternehmensprofil' 
  },
  crunchbase: { 
    icon: Building2, 
    label: 'Crunchbase', 
    description: 'Funding & Investoren' 
  },
  career_page: { 
    icon: Briefcase, 
    label: 'Karriereseite', 
    description: 'Offene Stellen' 
  },
  news: { 
    icon: Newspaper, 
    label: 'News', 
    description: 'Aktuelle Nachrichten' 
  },
  kununu: { 
    icon: Building2, 
    label: 'Kununu', 
    description: 'Arbeitgeber-Bewertungen' 
  },
  glassdoor: { 
    icon: Building2, 
    label: 'Glassdoor', 
    description: 'Internationale Bewertungen' 
  },
};

function getStatusIcon(status?: string | null) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'no_results':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status?: string | null) {
  switch (status) {
    case 'success':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Erfolgreich</Badge>;
    case 'no_results':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Keine Daten</Badge>;
    case 'error':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Fehler</Badge>;
    case 'pending':
    default:
      return <Badge variant="outline" className="bg-muted text-muted-foreground">Ausstehend</Badge>;
  }
}

function formatSourceResult(source: CrawlSourceEntry): string {
  const parts: string[] = [];
  
  if (source.contacts_found) {
    parts.push(`${source.contacts_found} Kontakte`);
  }
  if (source.executives_found) {
    parts.push(`${source.executives_found} Executives`);
  }
  if (source.jobs_found) {
    parts.push(`${source.jobs_found} Jobs`);
  }
  if (source.fields && source.fields.length > 0) {
    parts.push(`${source.fields.length} Felder`);
  }
  
  return parts.length > 0 ? parts.join(', ') : '';
}

export function CrawlSourcesWidget({ crawlSources, lastCrawledAt, isCrawling }: CrawlSourcesWidgetProps) {
  // Parse crawl sources - handle both string and object formats
  let sources: Record<string, CrawlSourceEntry> = {};
  
  if (crawlSources) {
    if (typeof crawlSources === 'string') {
      try {
        sources = JSON.parse(crawlSources);
      } catch {
        sources = {};
      }
    } else if (typeof crawlSources === 'object' && !Array.isArray(crawlSources)) {
      sources = crawlSources as Record<string, CrawlSourceEntry>;
    }
  }

  const sourceKeys = Object.keys(SOURCE_CONFIG);
  const crawledSources = sourceKeys.filter(key => sources[key]?.status === 'success');
  const pendingSources = sourceKeys.filter(key => !sources[key] || sources[key]?.status === 'pending');
  
  // If no sources tracked yet, show empty state
  const hasSources = Object.keys(sources).length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Gecrawlte Quellen
          </CardTitle>
          {lastCrawledAt && !isCrawling && (
            <span className="text-xs text-muted-foreground">
              Zuletzt: {formatDistanceToNow(new Date(lastCrawledAt), { addSuffix: true, locale: de })}
            </span>
          )}
        </div>
        {hasSources && !isCrawling && (
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {crawledSources.length} erfolgreich
            </Badge>
            {pendingSources.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {pendingSources.length} ausstehend
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isCrawling ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Quellen werden gecrawlt...</p>
              <p className="text-xs text-muted-foreground">Dies kann 20-40 Sekunden dauern</p>
            </div>
          </div>
        ) : !hasSources ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Noch keine Quellen gecrawlt</p>
            <p className="text-xs mt-1">Quellen werden beim Aktualisieren erfasst</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sourceKeys.map(key => {
              const config = SOURCE_CONFIG[key];
              const source = sources[key];
              const Icon = config.icon;
              const result = source ? formatSourceResult(source) : '';
              
              return (
                <div 
                  key={key}
                  className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(source?.status)}
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{config.label}</span>
                      </div>
                      {result && (
                        <span className="text-xs text-muted-foreground">{result}</span>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(source?.status)}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
