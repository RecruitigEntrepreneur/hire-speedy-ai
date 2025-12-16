import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Building2, Mail, User, Globe, MapPin, Briefcase, 
  Zap, Send, Play, Save, Trash2, ExternalLink, Phone,
  Linkedin, ChevronDown, ChevronRight, Target, ArrowRightLeft,
  Tag, Calendar, ShieldAlert, CheckCircle2, XCircle
} from 'lucide-react';
import { OutreachLead, OutreachCampaign } from '@/hooks/useOutreach';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface LeadDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: OutreachLead | null;
  campaigns: OutreachCampaign[];
  onGenerateEmail: (leadId: string, campaignId: string) => void;
  onStartSequence: (leadId: string, campaignId: string) => void;
}

function SectionHeader({ 
  icon: Icon, 
  title, 
  isOpen, 
  onToggle,
  badge
}: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string | number;
}) {
  return (
    <CollapsibleTrigger 
      onClick={onToggle}
      className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
        {badge !== undefined && (
          <Badge variant="secondary" className="text-xs">{badge}</Badge>
        )}
      </div>
      {isOpen ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </CollapsibleTrigger>
  );
}

function InfoRow({ label, value, icon: Icon, href, isEmail }: { 
  label: string; 
  value?: string | number | null;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  isEmail?: boolean;
}) {
  if (!value) return null;
  
  const content = href ? (
    <a 
      href={isEmail ? `mailto:${value}` : (href.startsWith('http') ? href : `https://${href}`)}
      target={!isEmail ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="text-primary hover:underline flex items-center gap-1"
    >
      {value}
      {!isEmail && <ExternalLink className="h-3 w-3" />}
    </a>
  ) : (
    <span>{value}</span>
  );

  return (
    <div className="flex items-start gap-2 text-sm py-1">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="font-medium truncate">{content}</div>
      </div>
    </div>
  );
}

export function LeadDetailSheet({ 
  open, 
  onOpenChange, 
  lead, 
  campaigns,
  onGenerateEmail,
  onStartSequence 
}: LeadDetailSheetProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [formData, setFormData] = useState<Partial<OutreachLead>>({});
  
  // Section states
  const [openSections, setOpenSections] = useState({
    contact: true,
    company: true,
    location: false,
    hiring: true,
    changes: false,
    meta: false,
  });

  // Cleanup scroll-lock when sheet closes
  useEffect(() => {
    if (!open) {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
    }
  }, [open]);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEdit = () => {
    if (lead) {
      setFormData({ ...lead });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('outreach_leads')
        .update({
          company_name: formData.company_name,
          contact_name: formData.contact_name,
          contact_email: formData.contact_email,
          contact_role: formData.contact_role,
          company_website: formData.company_website,
          industry: formData.industry,
          company_size: formData.company_size,
          country: formData.country,
          city: formData.city,
          segment: formData.segment,
          priority: formData.priority,
          status: formData.status,
          notes: formData.notes,
        })
        .eq('id', lead.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      toast.success('Lead aktualisiert');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead || !confirm('Lead wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('outreach_leads')
        .delete()
        .eq('id', lead.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
      toast.success('Lead gelöscht');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (!lead) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'contacted': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'replied': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'qualified': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'converted': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'unqualified': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const hiringSignals = lead.hiring_signals || [];
  const hasJobChange = lead.job_change_data?.prev_company || lead.job_change_data?.new_company;
  const hasLocationMove = lead.location_move_data?.from_country || lead.location_move_data?.to_country;

  // Build full address
  const companyAddress = [
    lead.company_address_line,
    [lead.company_zip, lead.company_city].filter(Boolean).join(' '),
    lead.company_state,
    lead.company_country
  ].filter(Boolean).join(', ');

  const hqAddress = [
    lead.hq_address_line,
    [lead.hq_zip, lead.hq_city].filter(Boolean).join(' '),
    lead.hq_state,
    lead.hq_country
  ].filter(Boolean).join(', ');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                {lead.company_name}
              </SheetTitle>
              {lead.company_alias && (
                <p className="text-sm text-muted-foreground">({lead.company_alias})</p>
              )}
            </div>
            {lead.is_suppressed && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Suppressed
              </Badge>
            )}
          </div>
          
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
            <Badge variant={getPriorityColor(lead.priority) as any}>
              {lead.priority} priority
            </Badge>
            <Badge variant="outline">Score: {lead.score}</Badge>
            {lead.list_name && (
              <Badge variant="secondary">{lead.list_name}</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          {/* Quick Actions */}
          <div className="space-y-3 p-3 rounded-lg border bg-card">
            <Label className="text-xs font-medium text-muted-foreground uppercase">Schnellaktionen</Label>
            <div className="flex gap-2">
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Kampagne wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.filter(c => c.is_active).map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedCampaign || lead.is_suppressed}
                onClick={() => selectedCampaign && onGenerateEmail(lead.id, selectedCampaign)}
              >
                <Zap className="h-4 w-4 mr-1" />
                E-Mail generieren
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedCampaign || lead.is_suppressed}
                onClick={() => selectedCampaign && onStartSequence(lead.id, selectedCampaign)}
              >
                <Play className="h-4 w-4 mr-1" />
                Sequenz starten
              </Button>
            </div>
          </div>

          {/* CONTACT Section */}
          <Collapsible open={openSections.contact}>
            <SectionHeader 
              icon={User} 
              title="Kontakt" 
              isOpen={openSections.contact}
              onToggle={() => toggleSection('contact')}
            />
            <CollapsibleContent className="px-3 pt-2 space-y-1">
              <div className="grid grid-cols-1 gap-1">
                <InfoRow 
                  label="Name" 
                  value={lead.contact_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ')}
                  icon={User}
                />
                <InfoRow label="Position" value={lead.contact_role} icon={Briefcase} />
                <InfoRow label="Seniority" value={lead.seniority} />
                <InfoRow label="Abteilung" value={lead.department} />
                
                <Separator className="my-2" />
                
                <InfoRow 
                  label="E-Mail" 
                  value={lead.contact_email}
                  icon={Mail}
                  href={lead.contact_email}
                  isEmail
                />
                <div className="flex items-center gap-2 text-xs">
                  {lead.email_validated ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> Verifiziert
                    </span>
                  ) : lead.email_verification_status ? (
                    <span className="text-muted-foreground">{lead.email_verification_status}</span>
                  ) : null}
                  {lead.email_quality && (
                    <Badge variant="outline" className="text-xs">{lead.email_quality}</Badge>
                  )}
                </div>
                
                <InfoRow label="Mobil" value={lead.mobile_phone} icon={Phone} />
                <InfoRow label="Durchwahl" value={lead.direct_phone} icon={Phone} />
                <InfoRow label="Büro" value={lead.office_phone} icon={Phone} />
                
                {lead.personal_linkedin_url && (
                  <InfoRow 
                    label="LinkedIn" 
                    value="Profil öffnen"
                    icon={Linkedin}
                    href={lead.personal_linkedin_url}
                  />
                )}
                
                {lead.education && (
                  <InfoRow label="Ausbildung" value={lead.education} />
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* COMPANY Section */}
          <Collapsible open={openSections.company}>
            <SectionHeader 
              icon={Building2} 
              title="Unternehmen" 
              isOpen={openSections.company}
              onToggle={() => toggleSection('company')}
            />
            <CollapsibleContent className="px-3 pt-2 space-y-1">
              <InfoRow label="Firma" value={lead.company_name} icon={Building2} />
              {lead.company_type && <InfoRow label="Typ" value={lead.company_type} />}
              {lead.company_description && (
                <div className="text-sm py-1">
                  <p className="text-xs text-muted-foreground">Beschreibung</p>
                  <p className="text-muted-foreground line-clamp-3">{lead.company_description}</p>
                </div>
              )}
              
              <Separator className="my-2" />
              
              <InfoRow 
                label="Website" 
                value={lead.company_website || lead.company_domain}
                icon={Globe}
                href={lead.company_website || lead.company_domain}
              />
              {lead.company_linkedin_url && (
                <InfoRow 
                  label="LinkedIn" 
                  value="Firmenprofil"
                  icon={Linkedin}
                  href={lead.company_linkedin_url}
                />
              )}
              
              <Separator className="my-2" />
              
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Mitarbeiter" value={lead.company_headcount || lead.company_size} />
                <InfoRow label="Gegründet" value={lead.company_founded_year} />
              </div>
              <InfoRow label="Branche" value={lead.industry || (lead.company_industries?.join(', '))} />
              {lead.company_technologies && lead.company_technologies.length > 0 && (
                <div className="py-1">
                  <p className="text-xs text-muted-foreground mb-1">Technologien</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.company_technologies.slice(0, 8).map((tech, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{tech}</Badge>
                    ))}
                    {lead.company_technologies.length > 8 && (
                      <Badge variant="secondary" className="text-xs">
                        +{lead.company_technologies.length - 8}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {lead.company_financials && (
                <InfoRow label="Finanzdaten" value={lead.company_financials} />
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* LOCATION Section */}
          <Collapsible open={openSections.location}>
            <SectionHeader 
              icon={MapPin} 
              title="Standort" 
              isOpen={openSections.location}
              onToggle={() => toggleSection('location')}
            />
            <CollapsibleContent className="px-3 pt-2 space-y-1">
              {companyAddress && (
                <InfoRow label="Firmenadresse" value={companyAddress} icon={MapPin} />
              )}
              {hqAddress && hqAddress !== companyAddress && (
                <InfoRow label="Hauptsitz" value={hqAddress} icon={Building2} />
              )}
              {!companyAddress && !hqAddress && (
                <InfoRow 
                  label="Standort" 
                  value={[lead.city, lead.country].filter(Boolean).join(', ') || 'Nicht angegeben'}
                  icon={MapPin}
                />
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* HIRING SIGNALS Section */}
          {hiringSignals.length > 0 && (
            <Collapsible open={openSections.hiring}>
              <SectionHeader 
                icon={Target} 
                title="Hiring-Signale" 
                isOpen={openSections.hiring}
                onToggle={() => toggleSection('hiring')}
                badge={hiringSignals.length}
              />
              <CollapsibleContent className="px-3 pt-2">
                <div className="space-y-2">
                  {hiringSignals.map((signal, index) => (
                    <div key={index} className="p-2 rounded-md bg-muted/30 border text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{signal.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            {signal.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />{signal.location}
                              </span>
                            )}
                            {signal.date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />{signal.date}
                              </span>
                            )}
                          </div>
                        </div>
                        {signal.url && (
                          <a 
                            href={signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* CHANGE SIGNALS Section */}
          {(hasJobChange || hasLocationMove) && (
            <Collapsible open={openSections.changes}>
              <SectionHeader 
                icon={ArrowRightLeft} 
                title="Wechsel-Signale" 
                isOpen={openSections.changes}
                onToggle={() => toggleSection('changes')}
              />
              <CollapsibleContent className="px-3 pt-2 space-y-3">
                {hasJobChange && lead.job_change_data && (
                  <div className="p-2 rounded-md bg-muted/30 border text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Jobwechsel</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-muted-foreground line-through text-xs">
                          {lead.job_change_data.prev_title} @ {lead.job_change_data.prev_company}
                        </p>
                        <p className="font-medium">
                          {lead.job_change_data.new_title} @ {lead.job_change_data.new_company}
                        </p>
                      </div>
                    </div>
                    {lead.job_change_data.date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Wechsel: {lead.job_change_data.date}
                      </p>
                    )}
                  </div>
                )}
                
                {hasLocationMove && lead.location_move_data && (
                  <div className="p-2 rounded-md bg-muted/30 border text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Umzug</p>
                    <div className="flex items-center gap-2">
                      <span>{lead.location_move_data.from_state || lead.location_move_data.from_country}</span>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {lead.location_move_data.to_state || lead.location_move_data.to_country}
                      </span>
                    </div>
                    {lead.location_move_data.move_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Datum: {lead.location_move_data.move_date}
                      </p>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* META Section */}
          <Collapsible open={openSections.meta}>
            <SectionHeader 
              icon={Tag} 
              title="Meta & System" 
              isOpen={openSections.meta}
              onToggle={() => toggleSection('meta')}
            />
            <CollapsibleContent className="px-3 pt-2 space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Quelle" value={lead.lead_source} />
                <InfoRow label="Segment" value={lead.segment} />
                <InfoRow label="Sprache" value={lead.language} />
                <InfoRow label="Profil-ID" value={lead.profile_id} />
              </div>
              
              {lead.tags && lead.tags.length > 0 && (
                <div className="py-1">
                  <p className="text-xs text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {lead.notes && (
                <div className="py-1">
                  <p className="text-xs text-muted-foreground mb-1">Notizen</p>
                  <p className="text-sm text-muted-foreground">{lead.notes}</p>
                </div>
              )}
              
              <Separator className="my-2" />
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Erstellt: {new Date(lead.created_at).toLocaleDateString('de-DE', { 
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}</p>
                {lead.last_contacted_at && (
                  <p>Letzter Kontakt: {new Date(lead.last_contacted_at).toLocaleDateString('de-DE')}</p>
                )}
                {lead.last_replied_at && (
                  <p>Letzte Antwort: {new Date(lead.last_replied_at).toLocaleDateString('de-DE')}</p>
                )}
                {lead.is_suppressed && (
                  <p className="text-destructive">
                    Suppressed: {lead.suppression_reason || 'Grund unbekannt'}
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Edit / Delete Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleEdit}>
              <Save className="h-4 w-4 mr-2" />
              Bearbeiten
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}