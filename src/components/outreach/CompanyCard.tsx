import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Building2, 
  MapPin, 
  Users, 
  Briefcase, 
  Newspaper, 
  ExternalLink,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { CompanyWithLeads } from '@/hooks/useOutreachCompanies';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface CompanyCardProps {
  company: CompanyWithLeads;
  onSelect: () => void;
  onCrawl: () => void;
  isCrawling?: boolean;
}

export function CompanyCard({ company, onSelect, onCrawl, isCrawling }: CompanyCardProps) {
  const getHiringBadge = () => {
    switch (company.hiring_activity) {
      case 'hot':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔥 Hot</Badge>;
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Aktiv</Badge>;
      case 'low':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">⚡ Wenig</Badge>;
      case 'none':
        return <Badge className="bg-muted text-muted-foreground">Keine Jobs</Badge>;
      default:
        return <Badge variant="outline">Nicht geprüft</Badge>;
    }
  };

  const topJobs = (Array.isArray(company.live_jobs) ? company.live_jobs : []).slice(0, 3) as { title: string }[];
  const topNews = (Array.isArray(company.recent_news) ? company.recent_news : []).slice(0, 2) as { title?: string }[];

  return (
    <Card 
      className="hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Company Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-semibold truncate">{company.name}</h3>
              {getHiringBadge()}
            </div>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
              <span className="truncate">{company.domain}</span>
              {company.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {company.city}
                </span>
              )}
              {company.industry && (
                <Badge variant="outline" className="text-xs">
                  {company.industry}
                </Badge>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-blue-400" />
                <span className="font-medium">{company.live_jobs_count || 0}</span>
                <span className="text-muted-foreground">Jobs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Newspaper className="h-4 w-4 text-purple-400" />
                <span className="font-medium">{topNews.length}</span>
                <span className="text-muted-foreground">News</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-green-400" />
                <span className="font-medium">{company.leads_count}</span>
                <span className="text-muted-foreground">Kontakte</span>
              </div>
            </div>

            {/* Top Jobs Preview */}
            {topJobs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {topJobs.map((job, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {job.title}
                  </Badge>
                ))}
                {(company.live_jobs_count || 0) > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{(company.live_jobs_count || 0) - 3} mehr
                  </Badge>
                )}
              </div>
            )}

            {/* Latest News Preview */}
            {topNews.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                📰 {topNews[0].title?.slice(0, 60)}...
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onCrawl();
              }}
              disabled={isCrawling}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isCrawling ? 'animate-spin' : ''}`} />
            </Button>

            {company.career_page_url && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(company.career_page_url, '_blank');
                }}
                className="h-8 w-8"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}

            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Last Crawled */}
        {company.career_crawled_at && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            Zuletzt gecrawlt: {formatDistanceToNow(new Date(company.career_crawled_at), { 
              addSuffix: true, 
              locale: de 
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
