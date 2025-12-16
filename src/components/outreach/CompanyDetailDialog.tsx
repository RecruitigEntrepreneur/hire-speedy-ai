import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, Globe, MapPin, Users, Briefcase, RefreshCw, 
  Mail, Newspaper, Code, UserPlus, ExternalLink, Sparkles
} from "lucide-react";
import { useCompanyWithLeads, useCrawlCompanyData } from "@/hooks/useOutreachCompanies";
import { useGenerateEmail } from "@/hooks/useOutreach";
import { useState } from "react";
import { toast } from "sonner";
import { CompanyIntelligenceCard } from "./CompanyIntelligenceCard";
import { InsightsPanel } from "./InsightsPanel";

interface CompanyDetailDialogProps {
  companyId: string | null;
  onClose: () => void;
}

export function CompanyDetailDialog({ companyId, onClose }: CompanyDetailDialogProps) {
  const { data, isLoading } = useCompanyWithLeads(companyId);
  const crawlMutation = useCrawlCompanyData();
  const generateEmail = useGenerateEmail();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const company = data?.company;
  const leads = data?.leads || [];

  const handleCrawl = () => {
    if (!companyId) return;
    crawlMutation.mutate(companyId);
  };

  const handleGenerateEmail = async (leadId: string) => {
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
                {company.website && (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={company.website} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-100px)]">
              <div className="p-6 pt-4 space-y-4">
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
                        {/* Jobs */}
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium mb-2">
                            <Briefcase className="h-4 w-4 text-primary" />
                            {liveJobs.length} offene Stellen
                            {company.hiring_activity === 'hot' && (
                              <Badge variant="default" className="bg-orange-500 text-xs">HOT</Badge>
                            )}
                          </div>
                          {liveJobs.length > 0 ? (
                            <div className="space-y-1 text-sm text-muted-foreground pl-6">
                              {liveJobs.slice(0, 5).map((job: any, i: number) => (
                                <div key={i}>• {job.title} {job.location && `(${job.location})`}</div>
                              ))}
                              {liveJobs.length > 5 && (
                                <div className="text-xs">+{liveJobs.length - 5} weitere</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground pl-6">
                              Keine Jobs gefunden - klicken Sie auf Aktualisieren
                            </div>
                          )}
                        </div>

                        {/* News */}
                        {recentNews.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <Newspaper className="h-4 w-4 text-primary" />
                              Letzte News
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground pl-6">
                              {recentNews.slice(0, 3).map((news: any, i: number) => (
                                <div key={i} className="truncate">• {news.title}</div>
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

                    {/* Contacts */}
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
                            <div key={lead.id} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">
                                    {lead.first_name || lead.contact_name?.split(' ')[0]} {lead.last_name || lead.contact_name?.split(' ').slice(1).join(' ')}
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
                                  onClick={() => handleGenerateEmail(lead.id)}
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
  );
}
