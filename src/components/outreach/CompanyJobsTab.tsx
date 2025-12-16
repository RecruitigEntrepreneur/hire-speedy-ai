import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  ExternalLink, 
  Newspaper,
  TrendingUp,
  Calendar,
  MapPin,
  Users,
  RefreshCw
} from 'lucide-react';
import { OutreachCompany, LiveJob, NewsItem } from '@/hooks/useOutreachCompanies';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface CompanyJobsTabProps {
  company: OutreachCompany;
}

export function CompanyJobsTab({ company }: CompanyJobsTabProps) {
  const liveJobs = (Array.isArray(company?.live_jobs) ? company.live_jobs : []) as unknown as LiveJob[];
  const recentNews = (Array.isArray(company?.recent_news) ? company.recent_news : []) as unknown as NewsItem[];

  // Group jobs by department
  const jobsByDepartment = liveJobs.reduce((acc, job) => {
    const dept = job.department || 'Sonstige';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(job);
    return acc;
  }, {} as Record<string, LiveJob[]>);

  const departments = Object.keys(jobsByDepartment);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Jobs Section */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-500" />
                Offene Stellen ({company.live_jobs_count || 0})
              </CardTitle>
              {company.career_page_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={company.career_page_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Karriereseite
                  </a>
                </Button>
              )}
            </div>
            {company.career_crawled_at && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Zuletzt geprüft: {formatDistanceToNow(new Date(company.career_crawled_at), { addSuffix: true, locale: de })}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {departments.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine Jobs gefunden</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Klicken Sie auf "Aktualisieren" um die Karriereseite zu crawlen.
                </p>
              </div>
            ) : (
              departments.map(dept => (
                <div key={dept}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{dept}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {jobsByDepartment[dept].length} Stellen
                    </span>
                  </div>
                  <div className="space-y-2">
                    {jobsByDepartment[dept].map((job, i) => (
                      <div 
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{job.title}</p>
                          {job.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.location}
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
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Hiring Signals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Hiring Signale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.hiring_activity === 'hot' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <Badge className="bg-red-500">🔥 HOT</Badge>
                <span className="text-sm">Massives Hiring aktiv ({company.live_jobs_count}+ Stellen)</span>
              </div>
            )}
            {company.hiring_activity === 'active' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Badge className="bg-green-500">✅ Aktiv</Badge>
                <span className="text-sm">Regelmäßiges Hiring ({company.live_jobs_count} Stellen)</span>
              </div>
            )}

            {/* Department Analysis */}
            {departments.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Hiring nach Bereich:</p>
                <div className="flex flex-wrap gap-2">
                  {departments.map(dept => (
                    <Badge key={dept} variant="secondary">
                      {dept}: {jobsByDepartment[dept].length}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Company size indicator */}
            {company.headcount && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{company.headcount} Mitarbeiter</span>
                {company.live_jobs_count && company.headcount && (
                  <Badge variant="outline" className="ml-auto">
                    {Math.round((company.live_jobs_count / company.headcount) * 100)}% Wachstum
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* News & Updates Section */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-purple-500" />
              Aktuelle News ({recentNews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNews.length === 0 ? (
              <div className="text-center py-8">
                <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine News gefunden</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Aktualisieren Sie die Unternehmensdaten um News zu crawlen.
                </p>
              </div>
            ) : (
              recentNews.map((news, i) => (
                <a
                  key={i}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                      {news.title}
                    </p>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </div>
                  {news.summary && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {news.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {news.source && (
                      <Badge variant="outline" className="text-xs">
                        {news.source}
                      </Badge>
                    )}
                    {news.date && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(news.date), 'dd.MM.yyyy', { locale: de })}
                      </span>
                    )}
                  </div>
                </a>
              ))
            )}
          </CardContent>
        </Card>

        {/* Use Cases for Outreach */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Outreach-Trigger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.hiring_activity === 'hot' && (
              <div className="p-3 rounded-lg bg-background">
                <p className="text-sm font-medium">🔥 Hiring-Welle nutzen</p>
                <p className="text-xs text-muted-foreground mt-1">
                  "{company.live_jobs_count} offene Stellen" als Aufhänger für Recruiting-Services.
                </p>
              </div>
            )}
            
            {recentNews.length > 0 && (
              <div className="p-3 rounded-lg bg-background">
                <p className="text-sm font-medium">📰 News-Hook</p>
                <p className="text-xs text-muted-foreground mt-1">
                  "{recentNews[0].title?.slice(0, 60)}..." als personalisierter Einstieg.
                </p>
              </div>
            )}

            {departments.includes('Tech') && (
              <div className="p-3 rounded-lg bg-background">
                <p className="text-sm font-medium">💻 Tech-Hiring</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {jobsByDepartment['Tech']?.length || 0} Tech-Positionen offen - IT-Recruiting anbieten.
                </p>
              </div>
            )}

            {departments.includes('Finance') && (
              <div className="p-3 rounded-lg bg-background">
                <p className="text-sm font-medium">💰 Finance-Hiring</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {jobsByDepartment['Finance']?.length || 0} Finance-Positionen offen - Finance-Recruiting anbieten.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
