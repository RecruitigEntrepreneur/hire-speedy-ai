import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Building2, 
  Code, 
  Users, 
  Briefcase, 
  Star, 
  Newspaper,
  TrendingUp,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Award,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserPlus,
  Linkedin,
  Loader2,
  ExternalLink,
  Flame
} from 'lucide-react';
import { OutreachCompany, LiveJob, NewsItem } from '@/hooks/useOutreachCompanies';
import { Json } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// Types
interface KeyExecutive {
  name: string;
  role: string;
  linkedin?: string;
}

interface SourceTrackingEntry {
  crawled_at?: string | null;
  status?: 'success' | 'no_results' | 'error' | 'pending' | null;
  fields?: string[];
  contacts_found?: number;
  executives_found?: number;
  jobs_found?: number;
  items_found?: number;
  error?: string;
}

interface ExtractedDataWidgetV2Props {
  company: OutreachCompany;
  leads: any[];
  onCrawl: () => void;
  isCrawling: boolean;
}

// Source color configuration
const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  website: { label: 'Website', className: 'border-blue-300 text-blue-600 bg-blue-50' },
  impressum: { label: 'Impressum', className: 'border-purple-300 text-purple-600 bg-purple-50' },
  team_page: { label: 'Team', className: 'border-indigo-300 text-indigo-600 bg-indigo-50' },
  linkedin: { label: 'LinkedIn', className: 'border-sky-300 text-sky-600 bg-sky-50' },
  linkedin_company: { label: 'LinkedIn', className: 'border-sky-300 text-sky-600 bg-sky-50' },
  linkedin_people: { label: 'LinkedIn', className: 'border-sky-300 text-sky-600 bg-sky-50' },
  xing: { label: 'Xing', className: 'border-teal-300 text-teal-600 bg-teal-50' },
  crunchbase: { label: 'Crunchbase', className: 'border-orange-300 text-orange-600 bg-orange-50' },
  kununu: { label: 'Kununu', className: 'border-green-300 text-green-600 bg-green-50' },
  glassdoor: { label: 'Glassdoor', className: 'border-emerald-300 text-emerald-600 bg-emerald-50' },
  career_page: { label: 'Karriere', className: 'border-pink-300 text-pink-600 bg-pink-50' },
  news: { label: 'News', className: 'border-yellow-300 text-yellow-700 bg-yellow-50' },
};

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  impressum: 'Impressum',
  team_page: 'Team',
  linkedin_people: 'LinkedIn',
  linkedin_company: 'LinkedIn',
  xing: 'Xing',
  crunchbase: 'Crunchbase',
  career_page: 'Karriere',
  news: 'News',
  kununu: 'Kununu',
  glassdoor: 'Glassdoor',
};

// Helper functions
function parseCrawlSources(crawlSources: Json | null | undefined): Record<string, SourceTrackingEntry> {
  if (!crawlSources) return {};
  if (typeof crawlSources === 'string') {
    try {
      return JSON.parse(crawlSources);
    } catch {
      return {};
    }
  }
  if (typeof crawlSources === 'object' && !Array.isArray(crawlSources)) {
    return crawlSources as Record<string, SourceTrackingEntry>;
  }
  return {};
}

function getFieldSource(sources: Record<string, SourceTrackingEntry>, field: string): string | null {
  for (const [sourceName, data] of Object.entries(sources)) {
    if (data.fields?.includes(field)) {
      return sourceName;
    }
  }
  return null;
}

function isEntscheider(role: string): boolean {
  const r = (role || '').toLowerCase();
  return r.includes('ceo') || r.includes('geschäftsführer') || r.includes('cto') || 
         r.includes('cfo') || r.includes('chief') || r.includes('founder') || 
         r.includes('gründer') || r.includes('chro') || r.includes('coo') ||
         r.includes('managing director') || r.includes('vorstand');
}

function isInfluencer(role: string): boolean {
  const r = (role || '').toLowerCase();
  return r.includes('head') || r.includes('director') || r.includes('vp') || 
         r.includes('lead') || r.includes('vice president') || r.includes('leiter');
}

// Components
function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const config = SOURCE_CONFIG[source] || { label: source, className: 'border-muted text-muted-foreground' };
  
  return (
    <Badge 
      variant="outline" 
      className={cn("text-[10px] px-1.5 py-0 h-4 font-normal", config.className)}
    >
      {config.label}
    </Badge>
  );
}

function DataRowWithSource({ 
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
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        <SourceBadge source={source} />
      </div>
    </div>
  );
}

interface DataSectionProps {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number | string;
  status?: 'success' | 'no_results' | 'error' | 'pending' | null;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function DataSection({ id, label, icon: Icon, count, status, children, defaultOpen = true }: DataSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {count !== undefined && (
            <Badge variant="outline" className="text-xs">{count}</Badge>
          )}
          {status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
          {status === 'no_results' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="pt-2 border-t mt-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Main Component
export function ExtractedDataWidgetV2({ company, leads, onCrawl, isCrawling }: ExtractedDataWidgetV2Props) {
  const queryClient = useQueryClient();
  const [creatingContact, setCreatingContact] = useState<string | null>(null);
  const [creatingAll, setCreatingAll] = useState(false);

  // Parse data
  const sources = parseCrawlSources(company.crawl_sources);
  const technologies = (Array.isArray(company.technologies) ? company.technologies : []) as string[];
  const developmentTools = (Array.isArray(company.development_tools) ? company.development_tools : []) as string[];
  const liveJobs = (Array.isArray(company.live_jobs) ? company.live_jobs : []) as unknown as LiveJob[];
  const recentNews = (Array.isArray(company.recent_news) ? company.recent_news : []) as unknown as NewsItem[];
  const keyExecutives = (Array.isArray(company.key_executives) ? company.key_executives : []) as unknown as KeyExecutive[];
  const awards = (Array.isArray(company.awards) ? company.awards : []) as string[];
  const companyCulture = (typeof company.company_culture === 'object' && company.company_culture) 
    ? company.company_culture as Record<string, any> 
    : {};

  // Group executives
  const entscheider = keyExecutives.filter(e => isEntscheider(e.role));
  const influencer = keyExecutives.filter(e => isInfluencer(e.role) && !isEntscheider(e.role));
  const gatekeeper = keyExecutives.filter(e => !isEntscheider(e.role) && !isInfluencer(e.role));

  // Calculate stats
  const sourceKeys = Object.keys(SOURCE_CONFIG);
  const successCount = sourceKeys.filter(key => sources[key]?.status === 'success').length;
  const totalSources = sourceKeys.filter(key => sources[key]).length;

  // Last crawl time
  const lastCrawledAt = company.career_crawled_at || company.last_enriched_at;

  // Check if we have any data
  const hasData = company.industry || company.city || company.headcount || 
    technologies.length > 0 || keyExecutives.length > 0 || liveJobs.length > 0 ||
    company.kununu_score || company.funding_stage || recentNews.length > 0;

  // Create contact from executive
  const createContactFromExecutive = async (exec: KeyExecutive) => {
    setCreatingContact(exec.name);
    try {
      const role = (exec.role || '').toLowerCase();
      let decisionLevel = 'gatekeeper';
      if (isEntscheider(exec.role)) decisionLevel = 'entscheider';
      else if (isInfluencer(exec.role)) decisionLevel = 'influencer';

      let functionalArea = 'Other';
      if (role.includes('hr') || role.includes('people') || role.includes('talent')) functionalArea = 'HR';
      else if (role.includes('tech') || role.includes('cto') || role.includes('engineer') || role.includes('it')) functionalArea = 'Tech';
      else if (role.includes('marketing') || role.includes('cmo')) functionalArea = 'Marketing';
      else if (role.includes('sales') || role.includes('revenue')) functionalArea = 'Sales';
      else if (role.includes('finance') || role.includes('cfo')) functionalArea = 'Finance';
      else if (role.includes('ceo') || role.includes('founder') || role.includes('managing') || role.includes('geschäftsführ')) functionalArea = 'Leadership';

      const nameParts = exec.name.split(' ');
      const firstName = nameParts[0]?.toLowerCase() || 'kontakt';
      const lastName = nameParts[nameParts.length - 1]?.toLowerCase() || 'person';
      const placeholderEmail = `${firstName}.${lastName}@${company.domain}`;

      const { error } = await supabase
        .from('outreach_leads')
        .insert({
          company_id: company.id,
          company_name: company.name,
          contact_name: exec.name,
          contact_email: placeholderEmail,
          contact_role: exec.role,
          personal_linkedin_url: exec.linkedin || null,
          lead_source: 'linkedin_crawl',
          segment: 'enterprise',
          decision_level: decisionLevel,
          functional_area: functionalArea,
          status: 'neu',
          contact_outreach_status: 'nicht_kontaktiert',
        });

      if (error) throw error;
      
      toast.success(`Kontakt "${exec.name}" angelegt`);
      queryClient.invalidateQueries({ queryKey: ['outreach-company', company.id] });
      queryClient.invalidateQueries({ queryKey: ['company-leads', company.id] });
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        toast.error(`Kontakt "${exec.name}" existiert bereits`);
      } else {
        toast.error(`Fehler: ${err.message}`);
      }
    } finally {
      setCreatingContact(null);
    }
  };

  const createAllContacts = async () => {
    setCreatingAll(true);
    let created = 0;
    
    for (const exec of keyExecutives) {
      try {
        await createContactFromExecutive(exec);
        created++;
      } catch {
        // Continue with next
      }
    }
    
    setCreatingAll(false);
    if (created > 0) {
      toast.success(`${created} Kontakte angelegt`);
    }
  };

  // Get source status for section
  const getSectionStatus = (sourceKey: string): 'success' | 'no_results' | 'error' | 'pending' | null => {
    return sources[sourceKey]?.status || null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Extrahierte Daten
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onCrawl}
            disabled={isCrawling}
          >
            {isCrawling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {isCrawling ? 'Lädt...' : 'Aktualisieren'}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {lastCrawledAt && !isCrawling && (
            <span className="text-xs text-muted-foreground">
              Zuletzt: {formatDistanceToNow(new Date(lastCrawledAt), { addSuffix: true, locale: de })}
            </span>
          )}
          {totalSources > 0 && (
            <Badge variant="secondary" className="text-xs">
              {successCount}/{totalSources} Quellen erfolgreich
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {isCrawling ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Quellen werden gecrawlt...</p>
              <p className="text-xs text-muted-foreground">Dies kann 20-40 Sekunden dauern</p>
            </div>
          </div>
        ) : !hasData ? (
          <div className="text-center py-6 space-y-3">
            <Globe className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Keine Daten vorhanden</p>
              <p className="text-xs text-muted-foreground">
                Klicken Sie auf "Aktualisieren" um Unternehmensdaten zu crawlen
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* FIRMENDATEN */}
            {(company.industry || company.city || company.headcount || company.founded_year || company.founding_year) && (
              <DataSection 
                id="company" 
                label="Firmendaten" 
                icon={Building2}
                count={[company.industry, company.city, company.headcount, company.founded_year || company.founding_year].filter(Boolean).length}
                status={getSectionStatus('website') || getSectionStatus('impressum')}
              >
                <div className="space-y-1">
                  <DataRowWithSource 
                    icon={Building2}
                    label="Branche" 
                    value={company.industry} 
                    source={getFieldSource(sources, 'industry')} 
                  />
                  <DataRowWithSource 
                    icon={MapPin}
                    label="Standort" 
                    value={company.city ? `${company.city}${company.country ? `, ${company.country}` : ''}` : null} 
                    source={getFieldSource(sources, 'city')} 
                  />
                  <DataRowWithSource 
                    icon={Users}
                    label="Mitarbeiter" 
                    value={company.headcount?.toLocaleString()} 
                    source={getFieldSource(sources, 'headcount')} 
                  />
                  <DataRowWithSource 
                    icon={Calendar}
                    label="Gegründet" 
                    value={company.founded_year || company.founding_year} 
                    source={getFieldSource(sources, 'founded_year')} 
                  />
                  {company.revenue_range && (
                    <DataRowWithSource 
                      icon={DollarSign}
                      label="Umsatz" 
                      value={company.revenue_range} 
                      source={getFieldSource(sources, 'revenue_range') || 'crunchbase'} 
                    />
                  )}
                  {company.employee_growth && (
                    <DataRowWithSource 
                      icon={TrendingUp}
                      label="Wachstum" 
                      value={company.employee_growth} 
                      source={getFieldSource(sources, 'employee_growth') || 'linkedin'} 
                    />
                  )}
                </div>
              </DataSection>
            )}

            {/* TECH STACK */}
            {(technologies.length > 0 || developmentTools.length > 0 || company.cloud_provider) && (
              <DataSection 
                id="tech" 
                label="Tech Stack" 
                icon={Code}
                count={technologies.length + developmentTools.length}
                status={getSectionStatus('website')}
              >
                <div className="space-y-3">
                  {technologies.length > 0 && (
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {technologies.slice(0, 12).map((tech, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{tech}</Badge>
                        ))}
                        {technologies.length > 12 && (
                          <Badge variant="outline" className="text-xs">+{technologies.length - 12} weitere</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Quelle: <SourceBadge source={getFieldSource(sources, 'technologies') || 'website'} />
                      </p>
                    </div>
                  )}
                  {developmentTools.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Dev Tools:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {developmentTools.slice(0, 8).map((tool, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tool}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {company.cloud_provider && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Cloud:</span>
                      <Badge variant="outline">{company.cloud_provider}</Badge>
                    </div>
                  )}
                </div>
              </DataSection>
            )}

            {/* EXECUTIVES & KONTAKTE */}
            {keyExecutives.length > 0 && (
              <DataSection 
                id="contacts" 
                label="Executives & Kontakte" 
                icon={Users}
                count={keyExecutives.length}
                status={getSectionStatus('linkedin_people') || getSectionStatus('team_page')}
              >
                <div className="space-y-4">
                  {/* Header with bulk action */}
                  <div className="flex items-center justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={createAllContacts}
                      disabled={creatingAll}
                    >
                      {creatingAll ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-1" />
                      )}
                      Alle als Kontakte
                    </Button>
                  </div>

                  {/* Entscheider */}
                  {entscheider.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        👔 ENTSCHEIDER ({entscheider.length})
                      </p>
                      <div className="space-y-2">
                        {entscheider.map((exec, i) => (
                          <ExecutiveRow 
                            key={i} 
                            exec={exec} 
                            isCreating={creatingContact === exec.name}
                            onAdd={() => createContactFromExecutive(exec)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Influencer */}
                  {influencer.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        💡 INFLUENCER ({influencer.length})
                      </p>
                      <div className="space-y-2">
                        {influencer.slice(0, 5).map((exec, i) => (
                          <ExecutiveRow 
                            key={i} 
                            exec={exec} 
                            isCreating={creatingContact === exec.name}
                            onAdd={() => createContactFromExecutive(exec)}
                          />
                        ))}
                        {influencer.length > 5 && (
                          <p className="text-xs text-muted-foreground">+{influencer.length - 5} weitere</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gatekeeper */}
                  {gatekeeper.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        📋 WEITERE ({gatekeeper.length})
                      </p>
                      <div className="space-y-2">
                        {gatekeeper.slice(0, 3).map((exec, i) => (
                          <ExecutiveRow 
                            key={i} 
                            exec={exec} 
                            isCreating={creatingContact === exec.name}
                            onAdd={() => createContactFromExecutive(exec)}
                          />
                        ))}
                        {gatekeeper.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{gatekeeper.length - 3} weitere</p>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Quelle: <SourceBadge source="linkedin_people" />
                  </p>
                </div>
              </DataSection>
            )}

            {/* OFFENE STELLEN */}
            {liveJobs.length > 0 && (
              <DataSection 
                id="jobs" 
                label="Offene Stellen" 
                icon={Briefcase}
                count={liveJobs.length}
                status={getSectionStatus('career_page')}
              >
                <div className="space-y-3">
                  {/* Hiring Activity Badge */}
                  <div className="flex items-center gap-2">
                    {company.hiring_activity === 'hot' && (
                      <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
                        <Flame className="h-3 w-3 mr-1" /> Aktives Hiring
                      </Badge>
                    )}
                    {company.hiring_activity === 'active' && (
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Aktiv
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{liveJobs.length} Stellen</Badge>
                  </div>
                  
                  {/* Job Cards */}
                  <div className="space-y-2">
                    {liveJobs.slice(0, 5).map((job, i) => (
                      <div 
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {job.location && (
                              <span className="text-xs text-muted-foreground">{job.location}</span>
                            )}
                            {job.remote_policy && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{job.remote_policy}</Badge>
                            )}
                          </div>
                        </div>
                        {job.url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                            <a href={job.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                    {liveJobs.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{liveJobs.length - 5} weitere Stellen
                      </p>
                    )}
                  </div>

                  {company.career_page_url && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Karriereseite</span>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                        <a href={company.career_page_url} target="_blank" rel="noopener noreferrer">
                          Öffnen <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </DataSection>
            )}

            {/* ARBEITGEBER-BEWERTUNGEN */}
            {(company.kununu_score || company.glassdoor_score) && (
              <DataSection 
                id="reviews" 
                label="Arbeitgeber-Bewertungen" 
                icon={Star}
                count={[company.kununu_score, company.glassdoor_score].filter(Boolean).length}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4">
                    {company.kununu_score && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">{company.kununu_score}/5</span>
                        <span className="text-xs text-muted-foreground">
                          ({company.kununu_reviews || 0} Bewertungen)
                        </span>
                        <SourceBadge source="kununu" />
                      </div>
                    )}
                    {company.glassdoor_score && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">{company.glassdoor_score}/5</span>
                        <span className="text-xs text-muted-foreground">
                          ({company.glassdoor_reviews || 0} Bewertungen)
                        </span>
                        <SourceBadge source="glassdoor" />
                      </div>
                    )}
                  </div>
                  
                  {/* Culture Tags */}
                  {companyCulture.tags && Array.isArray(companyCulture.tags) && companyCulture.tags.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Culture Tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {(companyCulture.tags as string[]).slice(0, 5).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </DataSection>
            )}

            {/* NEWS & UPDATES */}
            {recentNews.length > 0 && (
              <DataSection 
                id="news" 
                label="News & Updates" 
                icon={Newspaper}
                count={recentNews.length}
                status={getSectionStatus('news')}
              >
                <div className="space-y-2">
                  {recentNews.slice(0, 3).map((news, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                      <Newspaper className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a 
                          href={news.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline line-clamp-2"
                        >
                          {news.title}
                        </a>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {news.source}
                          {news.date && ` · ${formatDistanceToNow(new Date(news.date), { addSuffix: true, locale: de })}`}
                        </p>
                      </div>
                      {news.url && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                          <a href={news.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                  {recentNews.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{recentNews.length - 3} weitere Artikel
                    </p>
                  )}
                </div>
              </DataSection>
            )}

            {/* FINANZIERUNG & WACHSTUM */}
            {(company.funding_stage || company.funding_total || awards.length > 0) && (
              <DataSection 
                id="funding" 
                label="Finanzierung & Wachstum" 
                icon={TrendingUp}
                status={getSectionStatus('crunchbase')}
              >
                <div className="space-y-3">
                  {(company.funding_stage || company.funding_total) && (
                    <div className="space-y-1">
                      <DataRowWithSource 
                        icon={TrendingUp}
                        label="Funding Stage" 
                        value={company.funding_stage} 
                        source="crunchbase" 
                      />
                      <DataRowWithSource 
                        icon={DollarSign}
                        label="Funding Total" 
                        value={company.funding_total} 
                        source="crunchbase" 
                      />
                      {company.funding_date && (
                        <DataRowWithSource 
                          icon={Calendar}
                          label="Letzte Runde" 
                          value={company.funding_date} 
                          source="crunchbase" 
                        />
                      )}
                    </div>
                  )}
                  
                  {/* Awards */}
                  {awards.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Award className="h-3.5 w-3.5" />
                        Auszeichnungen
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {awards.slice(0, 5).map((award, i) => (
                          <Badge key={i} className="text-xs bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                            🏆 {award.length > 30 ? award.slice(0, 30) + '...' : award}
                          </Badge>
                        ))}
                        {awards.length > 5 && (
                          <Badge variant="outline" className="text-xs">+{awards.length - 5}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </DataSection>
            )}

            {/* QUELLEN-STATUS (collapsed by default) */}
            {totalSources > 0 && (
              <DataSection 
                id="sources" 
                label="Quellen-Status" 
                icon={Globe}
                count={`${successCount}/${totalSources}`}
                defaultOpen={false}
              >
                <div className="space-y-2">
                  {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
                    const source = sources[key];
                    if (!source) return null;
                    
                    return (
                      <div 
                        key={key}
                        className="flex items-center justify-between py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          {source.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                          {source.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                          {source.status === 'no_results' && <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />}
                          {source.status === 'pending' && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="text-sm">{config.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {source.executives_found && (
                            <span className="text-xs text-muted-foreground">{source.executives_found} Exec</span>
                          )}
                          {source.jobs_found && (
                            <span className="text-xs text-muted-foreground">{source.jobs_found} Jobs</span>
                          )}
                          {source.fields && source.fields.length > 0 && (
                            <span className="text-xs text-muted-foreground">{source.fields.length} Felder</span>
                          )}
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px]",
                              source.status === 'success' && "bg-green-50 text-green-700 border-green-200",
                              source.status === 'error' && "bg-red-50 text-red-700 border-red-200",
                              source.status === 'no_results' && "bg-yellow-50 text-yellow-700 border-yellow-200",
                              source.status === 'pending' && "bg-muted"
                            )}
                          >
                            {source.status === 'success' ? 'OK' : 
                             source.status === 'error' ? 'Fehler' : 
                             source.status === 'no_results' ? 'Keine Daten' : 'Ausstehend'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DataSection>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Executive Row Component
function ExecutiveRow({ 
  exec, 
  isCreating, 
  onAdd 
}: { 
  exec: KeyExecutive; 
  isCreating: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
          {exec.name?.charAt(0) || '?'}
        </div>
        <div>
          <p className="text-sm font-medium">{exec.name}</p>
          <p className="text-xs text-muted-foreground">{exec.role}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {exec.linkedin && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            asChild
          >
            <a href={exec.linkedin} target="_blank" rel="noopener noreferrer">
              <Linkedin className="h-4 w-4 text-[#0077B5]" />
            </a>
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7"
          onClick={onAdd}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
