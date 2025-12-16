import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, Building2, Mail, Phone, Globe, MapPin, Briefcase,
  Linkedin, Target, Copy, Check, Sparkles, Play, ExternalLink,
  GraduationCap, Users, Calendar, TrendingUp, Zap, FileText,
  Code, Shield, CheckCircle2, XCircle, ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useLeadVariables, LeadData } from '@/hooks/useLeadVariables';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LeadProfileDialogProps {
  leadId: string | null;
  onClose: () => void;
  onGenerateEmail?: (leadId: string) => void;
  onStartSequence?: (leadId: string) => void;
}

function InfoItem({ 
  icon: Icon, 
  label, 
  value, 
  href, 
  isEmail,
  verified 
}: { 
  icon?: React.ComponentType<{ className?: string }>;
  label: string; 
  value?: string | number | null;
  href?: string;
  isEmail?: boolean;
  verified?: boolean;
}) {
  if (!value) return null;
  
  const content = href ? (
    <a 
      href={isEmail ? `mailto:${value}` : (href.startsWith('http') ? href : `https://${href}`)}
      target={!isEmail ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="text-primary hover:underline flex items-center gap-1"
    >
      <span className="truncate">{value}</span>
      {!isEmail && <ExternalLink className="h-3 w-3 shrink-0" />}
    </a>
  ) : (
    <span className="truncate">{value}</span>
  );

  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5 font-medium text-sm">
          {content}
          {verified !== undefined && (
            verified ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ 
  title, 
  icon: Icon, 
  children,
  badge
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  badge?: string | number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
        {badge !== undefined && (
          <Badge variant="secondary" className="ml-auto text-xs">{badge}</Badge>
        )}
      </div>
      {children}
    </Card>
  );
}

function VariableTag({ 
  variable, 
  value,
  onCopy 
}: { 
  variable: string; 
  value: string | null;
  onCopy: (text: string) => void;
}) {
  const isFilled = value !== null && value !== '';
  
  return (
    <button
      onClick={() => onCopy(`{{${variable}}}`)}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono transition-colors",
        isFilled 
          ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20" 
          : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
      )}
    >
      {`{{${variable}}}`}
    </button>
  );
}

export function LeadProfileDialog({ 
  leadId, 
  onClose, 
  onGenerateEmail,
  onStartSequence 
}: LeadProfileDialogProps) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Fetch complete lead data
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead-profile', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      
      const { data, error } = await supabase
        .from('outreach_leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      if (error) throw error;
      return data as LeadData;
    },
    enabled: !!leadId,
  });

  const { variables, variableMap, filledCount, totalCount } = useLeadVariables(lead);

  const copyVariable = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(text);
    toast.success('Kopiert!');
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const copyAllVariables = () => {
    const filledVars = variables
      .filter(v => v.value)
      .map(v => `{{${v.key}}}`)
      .join(' ');
    navigator.clipboard.writeText(filledVars);
    toast.success('Alle Variablen kopiert!');
  };

  if (!leadId) return null;

  const fullName = lead?.contact_name || 
    [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || 'Unbekannt';

  const phone = lead?.mobile_phone || lead?.direct_phone || lead?.office_phone || lead?.contact_phone;
  const linkedin = lead?.personal_linkedin_url || lead?.contact_linkedin;
  const companyLinkedin = lead?.company_linkedin_url;
  const technologies = Array.isArray(lead?.company_technologies) ? lead.company_technologies : [];
  const hiringSignals = Array.isArray(lead?.hiring_signals) ? lead.hiring_signals : [];
  const challenges = Array.isArray(lead?.recruiting_challenges) ? lead.recruiting_challenges : [];
  const liveJobs = Array.isArray(lead?.live_jobs) ? lead.live_jobs : [];

  return (
    <Dialog open={!!leadId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <User className="h-5 w-5" />
                {isLoading ? 'Laden...' : fullName}
              </DialogTitle>
              {lead?.contact_role && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  {lead.contact_role}
                  {lead.company_name && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {lead.company_name}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {lead?.decision_level && (
                <Badge className={cn(
                  lead.decision_level === 'entscheider' 
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted"
                )}>
                  {lead.decision_level}
                </Badge>
              )}
              {lead?.contact_outreach_status && (
                <Badge variant="secondary">{lead.contact_outreach_status}</Badge>
              )}
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-4">
            {onGenerateEmail && (
              <Button size="sm" onClick={() => onGenerateEmail(leadId)}>
                <Sparkles className="h-4 w-4 mr-1" />
                E-Mail generieren
              </Button>
            )}
            {onStartSequence && (
              <Button size="sm" variant="outline" onClick={() => onStartSequence(leadId)}>
                <Play className="h-4 w-4 mr-1" />
                Sequenz starten
              </Button>
            )}
            {linkedin && (
              <Button size="sm" variant="outline" asChild>
                <a href={linkedin} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4 mr-1" />
                  LinkedIn
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="profile" className="flex-1">
          <div className="px-6 pt-2 border-b">
            <TabsList>
              <TabsTrigger value="profile">Profil</TabsTrigger>
              <TabsTrigger value="variables">
                Variablen
                <Badge variant="secondary" className="ml-1.5 text-xs">{filledCount}/{totalCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(90vh-220px)]">
            <TabsContent value="profile" className="p-6 mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Laden...
                </div>
              ) : lead ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Contact Info */}
                    <SectionCard title="Kontakt" icon={User}>
                      <div className="space-y-1">
                        <InfoItem icon={User} label="Name" value={fullName} />
                        <InfoItem icon={Briefcase} label="Position" value={lead.contact_role} />
                        <InfoItem label="Seniority" value={lead.seniority} />
                        <InfoItem label="Abteilung" value={lead.department} />
                        <InfoItem label="Funktionsbereich" value={lead.functional_area} />
                        {lead.education && (
                          <InfoItem icon={GraduationCap} label="Ausbildung" value={lead.education} />
                        )}
                      </div>
                    </SectionCard>

                    {/* Contact Data */}
                    <SectionCard title="Kontaktdaten" icon={Mail}>
                      <div className="space-y-1">
                        <InfoItem 
                          icon={Mail} 
                          label="E-Mail" 
                          value={lead.contact_email} 
                          href={lead.contact_email}
                          isEmail
                          verified={lead.email_validated || undefined}
                        />
                        {lead.email_quality && (
                          <div className="pl-6">
                            <Badge variant="outline" className="text-xs">{lead.email_quality}</Badge>
                          </div>
                        )}
                        {lead.mobile_phone && (
                          <InfoItem icon={Phone} label="Mobil" value={lead.mobile_phone} />
                        )}
                        {lead.direct_phone && (
                          <InfoItem icon={Phone} label="Durchwahl" value={lead.direct_phone} />
                        )}
                        {lead.office_phone && (
                          <InfoItem icon={Phone} label="Büro" value={lead.office_phone} />
                        )}
                        {linkedin && (
                          <InfoItem 
                            icon={Linkedin} 
                            label="LinkedIn" 
                            value="Profil öffnen" 
                            href={linkedin}
                          />
                        )}
                      </div>
                    </SectionCard>

                    {/* Recruiting Signals */}
                    {(lead.hiring_activity || hiringSignals.length > 0 || liveJobs.length > 0) && (
                      <SectionCard 
                        title="Recruiting-Signale" 
                        icon={Target}
                        badge={liveJobs.length > 0 ? `${liveJobs.length} Jobs` : undefined}
                      >
                        <div className="space-y-2">
                          {lead.hiring_activity && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Aktivität: {lead.hiring_activity}</span>
                            </div>
                          )}
                          {lead.hiring_volume && (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Volumen: {lead.hiring_volume}</span>
                            </div>
                          )}
                          {lead.current_ats && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">ATS: {lead.current_ats}</span>
                            </div>
                          )}
                          {hiringSignals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {hiringSignals.slice(0, 5).map((signal: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{signal}</Badge>
                              ))}
                            </div>
                          )}
                          {challenges.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-1">Herausforderungen:</p>
                              <div className="flex flex-wrap gap-1">
                                {challenges.map((ch: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{ch}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </SectionCard>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Company Info */}
                    <SectionCard title="Unternehmen" icon={Building2}>
                      <div className="space-y-1">
                        <InfoItem icon={Building2} label="Firma" value={lead.company_name} />
                        {lead.company_description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 py-1">
                            {lead.company_description}
                          </p>
                        )}
                        <InfoItem 
                          icon={Globe} 
                          label="Website" 
                          value={lead.company_website || lead.company_domain} 
                          href={lead.company_website || lead.company_domain}
                        />
                        {companyLinkedin && (
                          <InfoItem 
                            icon={Linkedin} 
                            label="LinkedIn" 
                            value="Firmenprofil" 
                            href={companyLinkedin}
                          />
                        )}
                        <Separator className="my-2" />
                        <div className="grid grid-cols-2 gap-2">
                          <InfoItem label="Branche" value={lead.industry} />
                          <InfoItem label="Größe" value={lead.company_size} />
                          <InfoItem icon={Users} label="Mitarbeiter" value={lead.company_headcount} />
                          <InfoItem icon={Calendar} label="Gegründet" value={lead.company_founded_year} />
                        </div>
                        <InfoItem 
                          icon={MapPin} 
                          label="Standort" 
                          value={[lead.company_city, lead.company_country].filter(Boolean).join(', ')}
                        />
                        {lead.revenue_range && (
                          <InfoItem label="Umsatz" value={lead.revenue_range} />
                        )}
                      </div>
                    </SectionCard>

                    {/* Tech Stack */}
                    {technologies.length > 0 && (
                      <SectionCard 
                        title="Tech-Stack" 
                        icon={Code}
                        badge={technologies.length}
                      >
                        <div className="flex flex-wrap gap-1">
                          {technologies.slice(0, 12).map((tech: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{tech}</Badge>
                          ))}
                          {technologies.length > 12 && (
                            <Badge variant="secondary" className="text-xs">
                              +{technologies.length - 12}
                            </Badge>
                          )}
                        </div>
                      </SectionCard>
                    )}

                    {/* Job Change Info */}
                    {lead.job_change_data && (lead.job_change_data as any).prev_company && (
                      <SectionCard title="Job-Wechsel" icon={ChevronRight}>
                        <div className="space-y-1">
                          <InfoItem 
                            label="Vorherige Firma" 
                            value={(lead.job_change_data as any).prev_company}
                          />
                          <InfoItem 
                            label="Vorherige Position" 
                            value={(lead.job_change_data as any).prev_title}
                          />
                          <InfoItem 
                            label="Wechsel-Datum" 
                            value={(lead.job_change_data as any).change_date}
                          />
                        </div>
                      </SectionCard>
                    )}

                    {/* Meta Info */}
                    <SectionCard title="Meta" icon={Shield}>
                      <div className="grid grid-cols-2 gap-2">
                        <InfoItem label="Score" value={lead.score} />
                        <InfoItem label="Segment" value={lead.segment} />
                        <InfoItem label="Quelle" value={lead.lead_source} />
                        <InfoItem label="Sprache" value={lead.language} />
                        <InfoItem label="Region" value={lead.region} />
                        <InfoItem label="Liste" value={lead.list_name} />
                      </div>
                      {lead.notes && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground">Notizen</p>
                          <p className="text-sm">{lead.notes}</p>
                        </div>
                      )}
                    </SectionCard>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="variables" className="p-6 mt-0">
              <div className="space-y-6">
                {/* Header with copy all */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Verfügbare Variablen für AI-Personalisierung</h3>
                    <p className="text-sm text-muted-foreground">
                      {filledCount} von {totalCount} Variablen befüllt
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyAllVariables}>
                    <Copy className="h-4 w-4 mr-1" />
                    Alle kopieren
                  </Button>
                </div>

                {/* Variables by category */}
                {['contact', 'company', 'signals', 'meta'].map(category => {
                  const categoryVars = variables.filter(v => v.category === category);
                  const categoryLabels: Record<string, string> = {
                    contact: 'Kontakt',
                    company: 'Unternehmen',
                    signals: 'Recruiting-Signale',
                    meta: 'Meta-Daten'
                  };
                  
                  return (
                    <Card key={category} className="p-4">
                      <h4 className="font-medium text-sm mb-3">{categoryLabels[category]}</h4>
                      <div className="space-y-2">
                        {categoryVars.map(v => (
                          <div 
                            key={v.key}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg text-sm",
                              v.value ? "bg-primary/5" : "bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <VariableTag 
                                variable={v.key} 
                                value={v.value}
                                onCopy={copyVariable}
                              />
                              <span className="text-muted-foreground truncate">{v.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {v.value ? (
                                <span className="text-sm font-medium truncate max-w-[200px]">
                                  {v.value}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">nicht verfügbar</span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyVariable(`{{${v.key}}}`)}
                              >
                                {copiedVar === `{{${v.key}}}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
