import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Target, 
  TrendingUp,
  Users,
  Flame,
  AlertCircle,
  CheckCircle2,
  Building2,
  Code,
  Star,
  TrendingDown,
  DollarSign,
  Award
} from 'lucide-react';
import { OutreachCompany, LiveJob, NewsItem } from '@/hooks/useOutreachCompanies';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CompanyOverviewTabProps {
  company: OutreachCompany;
  leads: any[];
  onStatusChange: (status: string) => void;
}

export function CompanyOverviewTab({ company, leads, onStatusChange }: CompanyOverviewTabProps) {
  const liveJobs = (Array.isArray(company?.live_jobs) ? company.live_jobs : []) as unknown as LiveJob[];
  const recentNews = (Array.isArray(company?.recent_news) ? company.recent_news : []) as unknown as NewsItem[];
  
  // Cast JSON fields for new intelligence data
  const technologies = (Array.isArray(company?.technologies) ? company.technologies : []) as string[];
  const keyExecutives = (Array.isArray(company?.key_executives) ? company.key_executives : []) as { name: string; role: string; linkedin?: string }[];
  const awards = (Array.isArray(company?.awards) ? company.awards : []) as string[];

  // Analyze why this company is interesting
  const insights: string[] = [];
  
  if (company.hiring_activity === 'hot') {
    insights.push(`🔥 Aktives Hiring mit ${company.live_jobs_count || 0} offenen Stellen`);
  } else if (company.hiring_activity === 'active') {
    insights.push(`✅ ${company.live_jobs_count || 0} offene Stellen aktiv`);
  }

  // Analyze job departments
  const departments = new Set(liveJobs.map(j => j.department).filter(Boolean));
  if (departments.size > 0) {
    insights.push(`📊 Hiring in: ${Array.from(departments).join(', ')}`);
  }

  if (leads.length > 0) {
    const entscheider = leads.filter(l => l.decision_level === 'entscheider').length;
    const unkontaktiert = leads.filter(l => l.contact_outreach_status === 'nicht_kontaktiert').length;
    
    if (entscheider > 0) {
      insights.push(`👔 ${entscheider} Entscheider identifiziert`);
    }
    if (unkontaktiert > 0) {
      insights.push(`📬 ${unkontaktiert} Kontakte noch nicht angeschrieben`);
    }
  }

  if (recentNews.length > 0) {
    insights.push(`📰 ${recentNews.length} aktuelle News verfügbar`);
  }

  // Find best entry point
  const entscheider = leads.filter(l => l.decision_level === 'entscheider');
  const influencer = leads.filter(l => l.decision_level === 'influencer');
  const unkontaktierteEntscheider = entscheider.filter(l => l.contact_outreach_status === 'nicht_kontaktiert');
  
  const bestEntryPoint = unkontaktierteEntscheider[0] || entscheider[0] || influencer[0] || leads[0];

  // Personalization suggestions
  const suggestions: { type: string; text: string; trigger: string }[] = [];
  
  if (company.live_jobs_count && company.live_jobs_count >= 5) {
    suggestions.push({
      type: 'HIRING',
      text: `"${company.live_jobs_count} offene Stellen" als Einstieg`,
      trigger: 'hiring_signal'
    });
  }
  
  if (recentNews.length > 0 && recentNews[0].title) {
    suggestions.push({
      type: 'NEWS',
      text: `"${recentNews[0].title.slice(0, 50)}..." referenzieren`,
      trigger: 'news_hook'
    });
  }
  
  if (company.city) {
    suggestions.push({
      type: 'LOCAL',
      text: `Standort "${company.city}" erwähnen`,
      trigger: 'location'
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Why Interesting Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Warum interessant?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length > 0 ? (
              insights.map((insight, i) => (
                <p key={i} className="text-sm">{insight}</p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Signale erkannt. Aktualisieren Sie die Unternehmensdaten.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Company Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Outreach Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select 
              value={company.outreach_status || 'unberührt'} 
              onValueChange={onStatusChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unberührt">⚪ Unberührt</SelectItem>
                <SelectItem value="in_kontakt">🔵 In Kontakt</SelectItem>
                <SelectItem value="qualifiziert">🟢 Qualifiziert</SelectItem>
                <SelectItem value="deal_gewonnen">✅ Deal Gewonnen</SelectItem>
                <SelectItem value="verloren">🔴 Verloren</SelectItem>
              </SelectContent>
            </Select>

            {company.warm_score !== undefined && company.warm_score > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <span className="text-sm font-medium">Warm Score</span>
                <Badge className="bg-orange-500/20 text-orange-400">
                  {company.warm_score}/100
                </Badge>
              </div>
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
            <CardContent className="space-y-2">
              {suggestions.map((suggestion, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {suggestion.type}
                  </Badge>
                  <span>{suggestion.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Strategy Recommendation */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Empfohlene Strategie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bestEntryPoint ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                  <div>
                    <p className="text-sm text-muted-foreground">Erstkontakt</p>
                    <p className="font-medium">{bestEntryPoint.contact_name || 'Unbekannt'}</p>
                    <p className="text-xs text-muted-foreground">
                      {bestEntryPoint.contact_title || bestEntryPoint.functional_area || 'Keine Rolle'}
                    </p>
                  </div>
                  <Badge>
                    {bestEntryPoint.decision_level === 'entscheider' ? '👔 Entscheider' : 
                     bestEntryPoint.decision_level === 'influencer' ? '💡 Influencer' : 
                     '📋 Gatekeeper'}
                  </Badge>
                </div>

                {leads.length > 1 && (
                  <div className="p-3 rounded-lg bg-background">
                    <p className="text-sm text-muted-foreground">Backup-Kontakte</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {leads.slice(1, 4).map((lead, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {lead.contact_name?.split(' ')[0] || 'Kontakt'} ({lead.contact_title?.split(' ')[0] || '?'})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Keine Kontakte vorhanden. Leads importieren!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Kontakt-Übersicht
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{leads.length}</p>
                <p className="text-xs text-muted-foreground">Gesamt</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">
                  {leads.filter(l => l.decision_level === 'entscheider').length}
                </p>
                <p className="text-xs text-muted-foreground">Entscheider</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">
                  {leads.filter(l => l.contact_outreach_status === 'geantwortet').length}
                </p>
                <p className="text-xs text-muted-foreground">Antworten</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Intelligence Card */}
        {(technologies.length > 0 || company.kununu_score || company.glassdoor_score || company.revenue_range || company.employee_growth || keyExecutives.length > 0 || awards.length > 0) && (
          <Card className="border-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Unternehmens-Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tech Stack */}
              {technologies.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Code className="h-3 w-3" />
                    Tech Stack
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {technologies.slice(0, 10).map((tech, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tech}</Badge>
                    ))}
                    {technologies.length > 10 && (
                      <Badge variant="outline" className="text-xs">+{technologies.length - 10}</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Employer Scores */}
              {(company.kununu_score || company.glassdoor_score) && (
                <div className="flex flex-wrap gap-4">
                  {company.kununu_score && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Kununu:</span>
                      <span className="font-medium">{company.kununu_score}/5</span>
                    </div>
                  )}
                  {company.glassdoor_score && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Glassdoor:</span>
                      <span className="font-medium">{company.glassdoor_score}/5</span>
                    </div>
                  )}
                </div>
              )}

              {/* Financial / Growth */}
              {(company.revenue_range || company.employee_growth) && (
                <div className="flex flex-wrap gap-4">
                  {company.revenue_range && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Umsatz:</span>
                      <span className="font-medium">{company.revenue_range}</span>
                    </div>
                  )}
                  {company.employee_growth && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Wachstum:</span>
                      <span className="font-medium">{company.employee_growth}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Key Executives */}
              {keyExecutives.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Users className="h-3 w-3" />
                    Key Executives
                  </div>
                  <div className="space-y-1">
                    {keyExecutives.slice(0, 3).map((exec, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{exec.name}</span>
                        <Badge variant="outline" className="text-xs">{exec.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Awards */}
              {awards.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Award className="h-3 w-3" />
                    Auszeichnungen
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {awards.slice(0, 3).map((award, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{award.slice(0, 40)}{award.length > 40 ? '...' : ''}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
