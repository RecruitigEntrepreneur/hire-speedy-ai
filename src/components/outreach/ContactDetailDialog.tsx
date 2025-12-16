import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, Mail, Phone, Linkedin, Building2, Briefcase, 
  Edit, Save, X, ExternalLink
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ContactDetailDialogProps {
  contact: {
    id: string;
    first_name?: string;
    last_name?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_role?: string;
    linkedin_url?: string;
    decision_level?: string;
    functional_area?: string;
    contact_outreach_status?: string;
    company_name?: string;
    company_id?: string;
  } | null;
  onClose: () => void;
}

export function ContactDetailDialog({ contact, onClose }: ContactDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    first_name: contact?.first_name || contact?.contact_name?.split(' ')[0] || '',
    last_name: contact?.last_name || contact?.contact_name?.split(' ').slice(1).join(' ') || '',
    contact_email: contact?.contact_email || '',
    contact_phone: contact?.contact_phone || '',
    contact_role: contact?.contact_role || '',
    linkedin_url: contact?.linkedin_url || '',
    decision_level: contact?.decision_level || '',
    functional_area: contact?.functional_area || '',
  });

  const handleSave = async () => {
    if (!contact?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('outreach_leads')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          contact_role: formData.contact_role,
          linkedin_url: formData.linkedin_url,
          decision_level: formData.decision_level,
          functional_area: formData.functional_area,
        })
        .eq('id', contact.id);

      if (error) throw error;

      toast.success("Kontakt aktualisiert");
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      queryClient.invalidateQueries({ queryKey: ['company-with-leads'] });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const fullName = contact?.first_name && contact?.last_name
    ? `${contact.first_name} ${contact.last_name}`
    : contact?.contact_name || 'Unbekannt';

  const getDecisionLevelColor = (level: string | undefined) => {
    switch (level) {
      case 'Entscheider': return 'bg-green-100 text-green-800';
      case 'Influencer': return 'bg-blue-100 text-blue-800';
      case 'Gatekeeper': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!contact) return null;

  return (
    <Dialog open={!!contact} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">{fullName}</DialogTitle>
                {contact.contact_role && (
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {contact.contact_role}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={saving}
            >
              {isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Speichern...' : 'Speichern'}
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {contact.decision_level && (
              <Badge className={getDecisionLevelColor(contact.decision_level)}>
                {contact.decision_level}
              </Badge>
            )}
            {contact.functional_area && (
              <Badge variant="outline">{contact.functional_area}</Badge>
            )}
            {contact.contact_outreach_status && (
              <Badge variant="secondary">{contact.contact_outreach_status}</Badge>
            )}
          </div>

          {/* Company */}
          {contact.company_name && (
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{contact.company_name}</span>
              </div>
            </Card>
          )}

          {/* Contact Info */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vorname</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Nachname</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                />
              </div>

              <div>
                <Label>Telefon</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                />
              </div>

              <div>
                <Label>Position</Label>
                <Input
                  value={formData.contact_role}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_role: e.target.value }))}
                />
              </div>

              <div>
                <Label>LinkedIn URL</Label>
                <Input
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Entscheider-Level</Label>
                  <Select
                    value={formData.decision_level}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, decision_level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entscheider">Entscheider</SelectItem>
                      <SelectItem value="Influencer">Influencer</SelectItem>
                      <SelectItem value="Gatekeeper">Gatekeeper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Funktionsbereich</Label>
                  <Select
                    value={formData.functional_area}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, functional_area: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tech">Tech</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="People">People</SelectItem>
                      <SelectItem value="Ops">Operations</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Abbrechen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {contact.contact_email && (
                <a 
                  href={`mailto:${contact.contact_email}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.contact_email}</span>
                  <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                </a>
              )}

              {contact.contact_phone && (
                <a 
                  href={`tel:${contact.contact_phone}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.contact_phone}</span>
                  <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                </a>
              )}

              {contact.linkedin_url && (
                <a 
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Linkedin className="h-4 w-4 text-[#0077B5]" />
                  <span className="text-sm">LinkedIn Profil</span>
                  <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                </a>
              )}

              {!contact.contact_email && !contact.contact_phone && !contact.linkedin_url && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Keine Kontaktdaten vorhanden
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
