import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Building2, 
  MapPin, 
  Globe, 
  Linkedin, 
  Users, 
  Briefcase, 
  Newspaper,
  ExternalLink,
  RefreshCw,
  Mail,
  Sparkles,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useCompanyWithLeads, useCrawlCompanyData, LiveJob, NewsItem } from '@/hooks/useOutreachCompanies';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface CompanyDetailSheetProps {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateEmail?: (leadId: string) => void;
}

export function CompanyDetailSheet({ 
  companyId, 
  open, 
  onOpenChange,
  onGenerateEmail 
}: CompanyDetailSheetProps) {
  const { data, isLoading } = useCompanyWithLeads(companyId);
  const crawlMutation = useCrawlCompanyData();

  const company = data?.company;
  const leads = data?.leads || [];

  const getHiringBadge = () => {
    switch (company?.hiring_activity) {
      case 'hot':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔥 Hot - {company.live_jobs_count} Stellen</Badge>;
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Aktiv - {company.live_jobs_count} Stellen</Badge>;
      case 'low':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">⚡ {company.live_jobs_count} Stellen</Badge>;
      case 'none':
        return <Badge className="bg-muted text-muted-foreground">Keine offenen Stellen</Badge>;
      default:
        return <Badge variant="outline">Nicht geprüft</Badge>;
    }
  };

  const liveJobs = (Array.isArray(company?.live_jobs) ? company.live_jobs : []) as unknown as LiveJob[];
  const recentNews = (Array.isArray(company?.recent_news) ? company.recent_news : []) as unknown as NewsItem[];

  // Generate personalization suggestions
  const suggestions: string[] = [];
  if (company?.live_jobs_count && company.live_jobs_count >= 5) {
    suggestions.push(`🔥 "${company.live_jobs_count} offene Stellen" als Trigger (HIRING)`);
  }
  if (recentNews.length > 0) {
    suggestions.push(`📰 "${recentNews[0].title?.slice(0, 40)}..." als Opener (NEWS)`);
  }
  if (company?.city) {
    suggestions.push(`🏙️ Standort "${company.city}" erwähnen (LOCAL)`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">{company?.name || 'Unternehmen'}</SheetTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{company?.domain}</span>
                  {company?.city && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {company.city}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => company?.id && crawlMutation.mutate(company.id)}
              disabled={crawlMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${crawlMutation.isPending ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : company ? (
            <div className="space-y-6 pb-6">
              {/* Status Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {getHiringBadge()}
                {company.industry && (
                  <Badge variant="outline">{company.industry}</Badge>
                )}
                {company.headcount && (
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {company.headcount} MA
                  </Badge>
                )}
              </div>

              {/* Links */}
              <div className="flex items-center gap-2">
                {company.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      Website
                    </a>
                  </Button>
                )}
                {company.linkedin_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="h-4 w-4 mr-2" />
                      LinkedIn
                    </a>
                  </Button>
                )}
                {company.career_page_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.career_page_url} target="_blank" rel="noopener noreferrer">
                      <Briefcase className="h-4 w-4 mr-2" />
                      Karriereseite
                    </a>
                  </Button>
                )}
              </div>

              <Separator />

              {/* Hiring Activity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-400" />
                    Offene Stellen ({company.live_jobs_count || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {liveJobs.length > 0 ? (
                    <>
                      {liveJobs.slice(0, 6).map((job, i) => (
                        <div 
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium text-sm">{job.title}</p>
                            {(job.location || job.department) && (
                              <p className="text-xs text-muted-foreground">
                                {[job.location, job.department].filter(Boolean).join(' • ')}
                              </p>
                            )}
                          </div>
                          {job.url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <a href={job.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                      {liveJobs.length > 6 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{liveJobs.length - 6} weitere Stellen
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine Jobs gefunden. Klicken Sie auf "Aktualisieren" um zu crawlen.
                    </p>
                  )}
                  {company.career_crawled_at && (
                    <p className="text-xs text-muted-foreground pt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Zuletzt gecrawlt: {formatDistanceToNow(new Date(company.career_crawled_at), { 
                        addSuffix: true, 
                        locale: de 
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Recent News */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Newspaper className="h-4 w-4 text-purple-400" />
                    Aktuelle News ({recentNews.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentNews.length > 0 ? (
                    recentNews.map((news, i) => (
                      <a
                        key={i}
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <p className="font-medium text-sm line-clamp-2">{news.title}</p>
                        {news.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {news.summary}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {news.source}
                        </p>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine News gefunden.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Personalization Suggestions */}
              {suggestions.length > 0 && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Personalisierungs-Vorschläge
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {suggestions.map((suggestion, i) => (
                      <p key={i} className="text-sm">{suggestion}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Contacts at this company */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-400" />
                    Kontakte ({leads.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {leads.length > 0 ? (
                    leads.map((lead: any) => (
                      <div 
                        key={lead.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium text-sm">{lead.contact_name || 'Unbekannt'}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.contact_title || lead.contact_email}
                          </p>
                          <Badge 
                            variant="outline" 
                            className="mt-1 text-xs"
                          >
                            {lead.status || 'new'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {lead.contact_email && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <a href={`mailto:${lead.contact_email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {onGenerateEmail && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => onGenerateEmail(lead.id)}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              E-Mail
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine Kontakte für dieses Unternehmen.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Priority Score */}
              {company.priority_score !== undefined && company.priority_score > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Priority Score: <span className="font-medium text-foreground">{company.priority_score}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">Unternehmen nicht gefunden</p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
