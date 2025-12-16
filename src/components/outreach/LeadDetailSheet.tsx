import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Building2, Mail, User, Globe, MapPin, Briefcase, 
  Zap, Send, Play, Save, Trash2, ExternalLink 
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
      case 'new': return 'bg-blue-500/10 text-blue-500';
      case 'contacted': return 'bg-yellow-500/10 text-yellow-500';
      case 'replied': return 'bg-green-500/10 text-green-500';
      case 'qualified': return 'bg-purple-500/10 text-purple-500';
      case 'unqualified': return 'bg-gray-500/10 text-gray-500';
      default: return 'bg-gray-500/10 text-gray-500';
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isEditing ? 'Lead bearbeiten' : lead.company_name}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Status & Priority */}
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
              <Badge variant={getPriorityColor(lead.priority) as any}>
                {lead.priority} priority
              </Badge>
              <Badge variant="outline">Score: {lead.score}</Badge>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <Label>Schnellaktionen</Label>
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
                  disabled={!selectedCampaign}
                  onClick={() => selectedCampaign && onGenerateEmail(lead.id, selectedCampaign)}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  E-Mail generieren
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedCampaign}
                  onClick={() => selectedCampaign && onStartSequence(lead.id, selectedCampaign)}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Sequenz starten
                </Button>
              </div>
            </div>

            <Separator />

            {/* Lead Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Details</Label>
                {!isEditing && (
                  <Button variant="ghost" size="sm" onClick={handleEdit}>
                    Bearbeiten
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Firmenname</Label>
                    <Input
                      value={formData.company_name || ''}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kontaktperson</Label>
                    <Input
                      value={formData.contact_name || ''}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-Mail</Label>
                    <Input
                      type="email"
                      value={formData.contact_email || ''}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Position</Label>
                    <Input
                      value={formData.contact_role || ''}
                      onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(v) => setFormData({ ...formData, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Neu</SelectItem>
                          <SelectItem value="contacted">Kontaktiert</SelectItem>
                          <SelectItem value="replied">Geantwortet</SelectItem>
                          <SelectItem value="qualified">Qualifiziert</SelectItem>
                          <SelectItem value="unqualified">Unqualifiziert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Priorität</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(v) => setFormData({ ...formData, priority: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">Hoch</SelectItem>
                          <SelectItem value="medium">Mittel</SelectItem>
                          <SelectItem value="low">Niedrig</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                      <Save className="h-4 w-4 mr-1" />
                      {isSaving ? 'Speichern...' : 'Speichern'}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{lead.contact_name}</p>
                      <p className="text-muted-foreground">{lead.contact_role || 'Keine Position'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${lead.contact_email}`} className="text-primary hover:underline">
                      {lead.contact_email}
                    </a>
                  </div>

                  {lead.company_website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={lead.company_website.startsWith('http') ? lead.company_website : `https://${lead.company_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {lead.company_website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.industry || 'Keine Branche'} • {lead.company_size || 'Keine Größe'}</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{[lead.city, lead.country].filter(Boolean).join(', ') || 'Kein Standort'}</span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Timestamps */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Erstellt: {new Date(lead.created_at).toLocaleDateString('de-DE')}</p>
              {lead.last_contacted_at && (
                <p>Letzter Kontakt: {new Date(lead.last_contacted_at).toLocaleDateString('de-DE')}</p>
              )}
              {lead.last_replied_at && (
                <p>Letzte Antwort: {new Date(lead.last_replied_at).toLocaleDateString('de-DE')}</p>
              )}
            </div>

            <Separator />

            {/* Delete Action */}
            <Button variant="destructive" className="w-full" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Lead löschen
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
