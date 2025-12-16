import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, Globe, MapPin, Users, Briefcase, RefreshCw, 
  Mail, Newspaper, Code, UserPlus, ExternalLink, Sparkles,
  Linkedin, TrendingUp, DollarSign, Award, Cloud
} from "lucide-react";
import { useCompanyWithLeads, useCrawlCompanyData } from "@/hooks/useOutreachCompanies";
import { useGenerateEmail } from "@/hooks/useOutreach";
import { useState } from "react";
import { toast } from "sonner";
import { CompanyIntelligenceCard } from "./CompanyIntelligenceCard";
import { InsightsPanel } from "./InsightsPanel";
import { ContactDetailDialog } from "./ContactDetailDialog";

interface CompanyDetailDialogProps {
  companyId: string | null;
  onClose: () => void;
}

export function CompanyDetailDialog({ companyId, onClose }: CompanyDetailDialogProps) {
  const { data, isLoading } = useCompanyWithLeads(companyId);
  const crawlMutation = useCrawlCompanyData();
  const generateEmail = useGenerateEmail();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  const company = data?.company;
  const leads = data?.leads || [];

  const handleCrawl = () => {
    if (!companyId) return;
    crawlMutation.mutate(companyId);
  };

  const handleGenerateEmail = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGeneratingFor(leadId);
    try {
      await generateEmail.mutateAsync({
        leadId,
        campaignId: 'default'
      });
      toast.success("E-Mail wurde generiert und ist im Outreach-Tab");
    } catch (error) {
      toast.error("Fehler beim Generieren");
    } finally {
      setGeneratingFor(null);
    }
  };

  const liveJobs = Array.isArray(company?.live_jobs) ? company.live_jobs : [];
  const recentNews = Array.isArray(company?.recent_news) ? company.recent_news : [];
  const technologies = Array.isArray(company?.technologies) ? company.technologies : [];
  // Cast to any for new fields not yet in generated types
  const companyAny = company as any;
  const keyExecutives = Array.isArray(companyAny?.key_executives) ? companyAny.key_executives : [];
  const awards = Array.isArray(companyAny?.awards) ? companyAny.awards : [];

  const getContactStatusColor = (status: string | null) => {
    switch (status) {
      case 'geantwortet': return 'text-green-600';
      case 'geöffnet': return 'text-yellow-600';
      case 'kontaktiert': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  };

  const getContactStatusLabel = (status: string | null) => {
    switch (status) {
      case 'geantwortet': return '🟢 Geantwortet';
      case 'geöffnet': return '🟡 Geöffnet';
      case 'kontaktiert': return '🔵 Kontaktiert';
      default: return '⚪ Nicht kontaktiert';
    }
  };

  return (
    <>
      <Dialog open={!!companyId} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-muted-foreground">Laden...</div>
            </div>
          ) : company ? (
            <>
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <DialogTitle className="text-xl">{company.name}</DialogTitle>
                        {company.intelligence_score !== null && company.intelligence_score !== undefined && company.intelligence_score > 0 && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Sparkles className="h-3 w-3" />
                            {company.intelligence_score}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        {company.industry && <span>{company.industry}</span>}
                        {company.city && (
                          <>
                            <span>·</span>
                            <MapPin className="h-3 w-3" />
                            <span>{company.city}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {company.linkedin_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4 text-[#0077B5]" />
                        </a>
                      </Button>
                    )}
                    {company.website && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={company.website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[calc(90vh-100px)]">
                <div className="p-6 pt-4 space-y-4">
                  {/* Extended Data Badges */}
                  {(companyAny.funding_stage || companyAny.remote_policy || companyAny.kununu_score || companyAny.linkedin_followers) && (
                    <div className="flex flex-wrap gap-2">
                      {companyAny.funding_stage && (
                        <Badge variant="outline" className="gap-1">
                          <DollarSign className="h-3 w-3" />
                          {companyAny.funding_stage}
                        </Badge>
                      )}
                      {companyAny.remote_policy && (
                        <Badge variant="outline" className="gap-1">
                          <Cloud className="h-3 w-3" />
                          {companyAny.remote_policy}
                        </Badge>
                      )}
                      {companyAny.kununu_score && (
                        <Badge variant="outline" className="gap-1">
                          ⭐ Kununu: {companyAny.kununu_score}
                        </Badge>
                      )}
                      {companyAny.linkedin_followers && (
                        <Badge variant="outline" className="gap-1">
                          <Linkedin className="h-3 w-3" />
                          {companyAny.linkedin_followers.toLocaleString()} Follower
                        </Badge>
                      )}
                      {companyAny.employee_growth && (
                        <Badge variant="outline" className="gap-1 text-green-600">
                          <TrendingUp className="h-3 w-3" />
                          {companyAny.employee_growth}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Economic Data Card */}
                      <CompanyIntelligenceCard company={company} />

                      {/* AI Insights Panel */}
                      {companyId && (
                        <InsightsPanel 
                          companyId={companyId}
                          liveJobs={liveJobs}
                          recentNews={recentNews}
                          technologies={technologies.map(t => typeof t === 'string' ? t : String(t))}
                          initialScore={company.intelligence_score ?? 0}
                        />
                      )}

                      {/* Key Executives */}
                      {keyExecutives.length > 0 && (
                        <Card className="p-4">
                          <h3 className="font-semibold flex items-center gap-2 mb-3">
                            <Users className="h-4 w-4" />
                            Key Executives
                          </h3>
                          <div className="space-y-2">
                            {keyExecutives.map((exec: any, i: number) => (
                              <div 
                                key={i} 
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => exec.linkedin && window.open(exec.linkedin, '_blank')}
                              >
                                <div>
                                  <div className="font-medium text-sm">{exec.name}</div>
                                  <div className="text-xs text-muted-foreground">{exec.role}</div>
                                </div>
                                {exec.linkedin && (
                                  <Linkedin className="h-4 w-4 text-[#0077B5]" />
                                )}
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Awards */}
                      {awards.length > 0 && (
                        <Card className="p-4">
                          <h3 className="font-semibold flex items-center gap-2 mb-3">
                            <Award className="h-4 w-4" />
                            Auszeichnungen
                          </h3>
                          <div className="space-y-1">
                            {awards.map((award: any, i: number) => (
                              <div key={i} className="text-sm flex items-center gap-2">
                                <span>🏆</span>
                                <span>{typeof award === 'string' ? award : award.name}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Jobs & News Card */}
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            Jobs & News
                          </h3>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleCrawl}
                            disabled={crawlMutation.isPending}
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${crawlMutation.isPending ? 'animate-spin' : ''}`} />
                            {crawlMutation.isPending ? 'Crawle...' : 'Aktualisieren'}
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {/* Jobs - Now Clickable */}
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <Briefcase className="h-4 w-4 text-primary" />
                              {liveJobs.length} offene Stellen
                              {company.hiring_activity === 'hot' && (
                                <Badge variant="default" className="bg-orange-500 text-xs">HOT</Badge>
                              )}
                            </div>
                            {liveJobs.length > 0 ? (
                              <div className="space-y-1 text-sm pl-6">
                                {liveJobs.slice(0, 5).map((job: any, i: number) => (
                                  <div 
                                    key={i}
                                    className={`flex items-center justify-between py-1 ${job.url ? 'cursor-pointer hover:text-primary transition-colors' : 'text-muted-foreground'}`}
                                    onClick={() => job.url && window.open(job.url, '_blank')}
                                  >
                                    <span>• {job.title} {job.location && `(${job.location})`}</span>
                                    {job.url && <ExternalLink className="h-3 w-3" />}
                                  </div>
                                ))}
                                {liveJobs.length > 5 && (
                                  <div className="text-xs text-muted-foreground">+{liveJobs.length - 5} weitere</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground pl-6">
                                Keine Jobs gefunden - klicken Sie auf Aktualisieren
                              </div>
                            )}
                          </div>

                          {/* News - Now Clickable */}
                          {recentNews.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                <Newspaper className="h-4 w-4 text-primary" />
                                Letzte News
                              </div>
                              <div className="space-y-2 pl-6">
                                {recentNews.slice(0, 3).map((news: any, i: number) => (
                                  <a
                                    key={i}
                                    href={news.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                          {news.title}
                                        </div>
                                        {news.source && (
                                          <div className="text-xs text-muted-foreground mt-0.5">
                                            {news.source} {news.date && `· ${news.date}`}
                                          </div>
                                        )}
                                      </div>
                                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tech Stack */}
                          {technologies.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                <Code className="h-4 w-4 text-primary" />
                                Tech-Stack
                              </div>
                              <div className="flex flex-wrap gap-1 pl-6">
                                {technologies.map((tech: any, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {typeof tech === 'string' ? tech : tech?.name || 'Unknown'}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>

                      {/* Contacts - Now Clickable */}
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Ansprechpartner ({leads.length})
                          </h3>
                          <Button variant="outline" size="sm">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Hinzufügen
                          </Button>
                        </div>

                        {leads.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            Keine Kontakte vorhanden
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {leads.map((lead: any) => (
                              <div 
                                key={lead.id} 
                                className="p-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => setSelectedContact({
                                  ...lead,
                                  company_name: company.name,
                                  company_id: companyId
                                })}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium flex items-center gap-2">
                                      {lead.first_name || lead.contact_name?.split(' ')[0]} {lead.last_name || lead.contact_name?.split(' ').slice(1).join(' ')}
                                      {lead.linkedin_url && (
                                        <Linkedin 
                                          className="h-3 w-3 text-[#0077B5] cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(lead.linkedin_url, '_blank');
                                          }}
                                        />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      {lead.contact_role && <span>{lead.contact_role}</span>}
                                      {lead.functional_area && (
                                        <Badge variant="outline" className="text-xs">
                                          {lead.functional_area}
                                        </Badge>
                                      )}
                                      {lead.decision_level && (
                                        <Badge variant="secondary" className="text-xs">
                                          {lead.decision_level}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className={`text-xs mt-1 ${getContactStatusColor(lead.contact_outreach_status)}`}>
                                      {getContactStatusLabel(lead.contact_outreach_status)}
                                    </div>
                                  </div>
                                  <Button 
                                    size="sm"
                                    onClick={(e) => handleGenerateEmail(lead.id, e)}
                                    disabled={generatingFor === lead.id}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    {generatingFor === lead.id ? 'Generiere...' : 'E-Mail'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <div className="text-muted-foreground">Unternehmen nicht gefunden</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact Detail Dialog */}
      <ContactDetailDialog
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </>
  );
}
