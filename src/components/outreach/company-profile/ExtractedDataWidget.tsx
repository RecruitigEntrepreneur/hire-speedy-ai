import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Building2, 
  MapPin, 
  Users, 
  Calendar,
  Globe,
  Briefcase,
  TrendingUp,
  Star,
  Award,
  Server,
  Newspaper
} from 'lucide-react';
import { OutreachCompany, LiveJob, NewsItem } from '@/hooks/useOutreachCompanies';
import { Json } from '@/integrations/supabase/types';

interface ExtractedDataWidgetProps {
  company: OutreachCompany;
}

interface SourceTrackingEntry {
  crawled_at: string | null;
  status: 'success' | 'no_results' | 'error' | 'pending';
  fields?: string[];
  contacts_found?: number;
  executives_found?: number;
  jobs_found?: number;
  items_found?: number;
}

function parseCrawlSources(crawlSources: Json | null | undefined): Record<string, SourceTrackingEntry> {
  if (!crawlSources || typeof crawlSources !== 'object' || Array.isArray(crawlSources)) {
    return {};
  }
  return crawlSources as unknown as Record<string, SourceTrackingEntry>;
}

function getFieldSource(sources: Record<string, SourceTrackingEntry>, field: string): string | null {
  for (const [sourceName, data] of Object.entries(sources)) {
    if (data.fields?.includes(field)) {
      return SOURCE_LABELS[sourceName] || sourceName;
    }
  }
  return null;
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  impressum: 'Impressum',
  team_page: 'Team',
  linkedin_people: 'LinkedIn',
  xing: 'Xing',
  crunchbase: 'Crunchbase',
  career_page: 'Karriere',
  news: 'News',
  kununu: 'Kununu',
  glassdoor: 'Glassdoor',
};

function DataRow({ 
  icon: Icon, 
  label, 
  value, 
  source 
}: { 
  icon: React.ElementType;
  label: string; 
  value: string | number | null | undefined; 
  source?: string | null;
}) {
  if (!value) return null;
  
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        {source && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {source}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function ExtractedDataWidget({ company }: ExtractedDataWidgetProps) {
  const sources = parseCrawlSources(company.crawl_sources);
  const technologies = (Array.isArray(company.technologies) ? company.technologies : []) as string[];
  const liveJobs = (Array.isArray(company.live_jobs) ? company.live_jobs : []) as unknown as LiveJob[];
  const recentNews = (Array.isArray(company.recent_news) ? company.recent_news : []) as unknown as NewsItem[];
  
  const hasAnyData = company.industry || company.city || company.headcount || 
    technologies.length > 0 || liveJobs.length > 0 || recentNews.length > 0 ||
    company.kununu_score || company.funding_stage;

  if (!hasAnyData) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          Extrahierte Daten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Basics */}
        {(company.industry || company.city || company.headcount || company.founded_year) && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Firmendaten
            </h4>
            <div className="bg-background rounded-lg p-3 space-y-1">
              <DataRow 
                icon={Building2}
                label="Branche" 
                value={company.industry} 
                source={getFieldSource(sources, 'industry')} 
              />
              <DataRow 
                icon={MapPin}
                label="Standort" 
                value={company.city} 
                source={getFieldSource(sources, 'city')} 
              />
              <DataRow 
                icon={Users}
                label="Mitarbeiter" 
                value={company.headcount} 
                source={getFieldSource(sources, 'headcount')} 
              />
              <DataRow 
                icon={Calendar}
                label="Gegründet" 
                value={company.founded_year || company.founding_year} 
                source={getFieldSource(sources, 'founded_year')} 
              />
            </div>
          </div>
        )}

        {/* Tech Stack */}
        {technologies.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Technologien
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {technologies.slice(0, 12).map((tech, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {tech}
                </Badge>
              ))}
              {technologies.length > 12 && (
                <Badge variant="outline" className="text-xs">
                  +{technologies.length - 12} weitere
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Quelle: {getFieldSource(sources, 'technologies') || 'Website'}
            </p>
          </div>
        )}

        {/* Jobs */}
        {liveJobs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Briefcase className="h-3 w-3" />
              Offene Stellen ({liveJobs.length})
            </h4>
            <div className="bg-background rounded-lg p-3 space-y-2">
              {liveJobs.slice(0, 5).map((job, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-2">{job.title}</span>
                  {job.location && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {job.location}
                    </Badge>
                  )}
                </div>
              ))}
              {liveJobs.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{liveJobs.length - 5} weitere Stellen
                </p>
              )}
            </div>
          </div>
        )}

        {/* Funding & Growth */}
        {(company.funding_stage || company.funding_total || company.employee_growth) && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Wachstum & Finanzierung
            </h4>
            <div className="bg-background rounded-lg p-3 space-y-1">
              <DataRow 
                icon={TrendingUp}
                label="Funding Stage" 
                value={company.funding_stage} 
                source="Crunchbase" 
              />
              <DataRow 
                icon={TrendingUp}
                label="Funding Total" 
                value={company.funding_total} 
                source="Crunchbase" 
              />
              {company.employee_growth && (
                <DataRow 
                  icon={Users}
                  label="Wachstum" 
                  value={company.employee_growth} 
                  source="LinkedIn" 
                />
              )}
            </div>
          </div>
        )}

        {/* Employer Scores */}
        {(company.kununu_score || company.glassdoor_score) && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Arbeitgeber-Bewertungen
            </h4>
            <div className="bg-background rounded-lg p-3 space-y-1">
              {company.kununu_score && (
                <DataRow 
                  icon={Star}
                  label="Kununu" 
                  value={`${company.kununu_score}/5 (${company.kununu_reviews || 0} Bewertungen)`} 
                  source="Kununu" 
                />
              )}
              {company.glassdoor_score && (
                <DataRow 
                  icon={Star}
                  label="Glassdoor" 
                  value={`${company.glassdoor_score}/5 (${company.glassdoor_reviews || 0} Bewertungen)`} 
                  source="Glassdoor" 
                />
              )}
            </div>
          </div>
        )}

        {/* News */}
        {recentNews.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Newspaper className="h-3 w-3" />
              Aktuelle News ({recentNews.length})
            </h4>
            <div className="bg-background rounded-lg p-3 space-y-2">
              {recentNews.slice(0, 3).map((news, i) => (
                <div key={i} className="text-sm">
                  <a 
                    href={news.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline line-clamp-1"
                  >
                    {news.title}
                  </a>
                  {news.source && (
                    <span className="text-[10px] text-muted-foreground ml-2">
                      {news.source}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Awards */}
        {company.awards && Array.isArray(company.awards) && company.awards.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Award className="h-3 w-3" />
              Auszeichnungen
            </h4>
            <div className="flex flex-wrap gap-1">
              {(company.awards as string[]).slice(0, 5).map((award, i) => (
                <Badge key={i} className="text-xs bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                  🏆 {award.length > 40 ? award.slice(0, 40) + '...' : award}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
