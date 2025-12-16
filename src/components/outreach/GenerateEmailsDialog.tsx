import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Zap, Check, AlertCircle, Loader2 } from 'lucide-react';
import { OutreachLead, OutreachCampaign } from '@/hooks/useOutreach';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface GenerateEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: OutreachLead[];
  campaigns: OutreachCampaign[];
}

export function GenerateEmailsDialog({ open, onOpenChange, leads, campaigns }: GenerateEmailsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'select' | 'generating' | 'done'>('select');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, errors: 0 });

  const activeCampaigns = campaigns.filter(c => c.is_active);
  const eligibleLeads = leads.filter(l => l.status === 'new' || l.status === 'contacted');

  const resetState = () => {
    setStep('select');
    setSelectedCampaign('');
    setSelectedLeads(new Set());
    setProgress(0);
    setResults({ success: 0, errors: 0 });
  };

  const toggleLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const selectAll = () => {
    if (selectedLeads.size === eligibleLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(eligibleLeads.map(l => l.id)));
    }
  };

  const handleGenerate = async () => {
    if (!selectedCampaign || selectedLeads.size === 0) {
      toast.error('Bitte Kampagne und Leads auswählen');
      return;
    }

    setStep('generating');
    setProgress(0);

    let success = 0;
    let errors = 0;
    const leadIds = Array.from(selectedLeads);

    for (let i = 0; i < leadIds.length; i++) {
      try {
        const { error } = await supabase.functions.invoke('generate-outreach-email', {
          body: { 
            lead_id: leadIds[i], 
            campaign_id: selectedCampaign,
            sequence_step: 1
          }
        });

        if (error) {
          errors++;
        } else {
          success++;
        }
      } catch {
        errors++;
      }

      setProgress(Math.round(((i + 1) / leadIds.length) * 100));
    }

    setResults({ success, errors });
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['outreach-emails'] });
    queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            E-Mails generieren
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kampagne auswählen</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Kampagne wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCampaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeCampaigns.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine aktiven Kampagnen vorhanden
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Leads auswählen ({selectedLeads.size} von {eligibleLeads.length})</Label>
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedLeads.size === eligibleLeads.length ? 'Keine auswählen' : 'Alle auswählen'}
                </Button>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                {eligibleLeads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Keine Leads mit Status "neu" oder "kontaktiert" gefunden</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {eligibleLeads.map(lead => (
                      <div
                        key={lead.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${
                          selectedLeads.has(lead.id) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => toggleLead(lead.id)}
                      >
                        <Checkbox
                          checked={selectedLeads.has(lead.id)}
                          onCheckedChange={() => toggleLead(lead.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lead.company_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {lead.contact_name} • {lead.contact_email}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {lead.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Generiere E-Mails...</p>
              <p className="text-sm text-muted-foreground">
                {Math.round(progress * selectedLeads.size / 100)} von {selectedLeads.size} abgeschlossen
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Generierung abgeschlossen</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{results.success}</p>
                <p className="text-sm text-muted-foreground">Erfolgreich</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{results.errors}</p>
                <p className="text-sm text-muted-foreground">Fehler</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Die generierten E-Mails sind jetzt im Review-Tab zur Freigabe verfügbar.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={!selectedCampaign || selectedLeads.size === 0}
              >
                <Zap className="h-4 w-4 mr-2" />
                {selectedLeads.size} E-Mails generieren
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { resetState(); onOpenChange(false); }}>
              Schließen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
