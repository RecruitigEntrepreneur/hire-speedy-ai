import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useOutreachCampaigns, useOutreachLeads, useBulkGenerateEmails, useOutreachEmails } from '@/hooks/useOutreach';
import { Loader2, Mail, AlertTriangle, CheckCircle } from 'lucide-react';

interface BulkGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkGenerateDialog({ open, onOpenChange }: BulkGenerateDialogProps) {
  const { data: campaigns } = useOutreachCampaigns();
  const { data: leads } = useOutreachLeads();
  const { data: emails } = useOutreachEmails();
  const bulkGenerate = useBulkGenerateEmails();

  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ successful: number; failed: number } | null>(null);

  const activeCampaigns = campaigns?.filter(c => c.is_active) || [];
  
  // Find leads that don't have an email for the selected campaign yet
  const eligibleLeads = leads?.filter(lead => {
    if (!selectedCampaign) return false;
    if (lead.status === 'converted' || lead.status === 'unsubscribed') return false;
    if (lead.is_suppressed) return false;
    
    // Check if lead already has an email for this campaign
    const hasEmail = emails?.some(
      e => e.lead_id === lead.id && e.campaign_id === selectedCampaign
    );
    return !hasEmail;
  }) || [];

  const handleGenerate = async () => {
    if (!selectedCampaign || eligibleLeads.length === 0) return;

    setIsGenerating(true);
    setResult(null);

    try {
      const data = await bulkGenerate.mutateAsync({
        leadIds: eligibleLeads.map(l => l.id),
        campaignId: selectedCampaign
      });
      setResult(data);
    } catch (error) {
      console.error('Bulk generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedCampaignData = campaigns?.find(c => c.id === selectedCampaign);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Bulk E-Mail-Generierung
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Kampagne auswählen</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Kampagne wählen..." />
              </SelectTrigger>
              <SelectContent>
                {activeCampaigns.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Keine aktiven Kampagnen verfügbar
                  </div>
                ) : (
                  activeCampaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedCampaign && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Kampagne:</span>
                <Badge variant="outline">{selectedCampaignData?.name}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Absender:</span>
                <span className="text-sm">{selectedCampaignData?.sender_email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Geeignete Leads:</span>
                <Badge>{eligibleLeads.length}</Badge>
              </div>
            </div>
          )}

          {selectedCampaignData && !selectedCampaignData.sender_email?.includes('@') && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                Die Absender-E-Mail "{selectedCampaignData.sender_email}" ist ungültig. 
                Bitte korrigieren Sie die Kampagnen-Einstellungen.
              </p>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-2">
              <Progress value={undefined} className="animate-pulse" />
              <p className="text-sm text-center text-muted-foreground">
                Generiere E-Mails...
              </p>
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg text-green-600">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm">
                {result.successful} E-Mails erfolgreich generiert
                {result.failed > 0 && `, ${result.failed} fehlgeschlagen`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          <Button 
            onClick={handleGenerate}
            disabled={!selectedCampaign || eligibleLeads.length === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {eligibleLeads.length} E-Mails generieren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
