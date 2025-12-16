import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Zap, Check, AlertCircle, Loader2, ChevronDown, Briefcase, User, Code, Sparkles } from 'lucide-react';
import { OutreachLead, OutreachCampaign } from '@/hooks/useOutreach';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GenerateEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: OutreachLead[];
  campaigns: OutreachCampaign[];
  preSelectedLeadIds?: string[];
}

type Tone = 'formal' | 'professional' | 'casual' | 'direct';
type Length = 'short' | 'medium' | 'long';
type Focus = 'demo' | 'meeting' | 'info' | 'case-study';

interface GenerationOptions {
  tone: Tone;
  length: Length;
  focus: Focus;
  customInstruction: string;
  generateVariants: boolean;
}

export function GenerateEmailsDialog({ open, onOpenChange, leads, campaigns, preSelectedLeadIds }: GenerateEmailsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(() => 
    preSelectedLeadIds ? new Set(preSelectedLeadIds) : new Set()
  );
  const [step, setStep] = useState<'select' | 'generating' | 'done'>('select');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, errors: 0 });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  const [options, setOptions] = useState<GenerationOptions>({
    tone: 'professional',
    length: 'medium',
    focus: 'demo',
    customInstruction: '',
    generateVariants: false
  });

  const activeCampaigns = campaigns.filter(c => c.is_active);
  const eligibleLeads = leads.filter(l => l.status === 'new' || l.status === 'contacted');

  const getLeadSignals = (lead: OutreachLead) => {
    const signals: string[] = [];
    if (lead.hiring_signals && Array.isArray(lead.hiring_signals) && lead.hiring_signals.length > 0) {
      signals.push(`${lead.hiring_signals.length} Stellen`);
    }
    if (lead.job_change_data && typeof lead.job_change_data === 'object' && Object.keys(lead.job_change_data).length > 0) {
      signals.push('Job-Wechsel');
    }
    if (lead.company_technologies && Array.isArray(lead.company_technologies) && lead.company_technologies.length > 0) {
      signals.push('Tech-Stack');
    }
    return signals;
  };

  const resetState = () => {
    setStep('select');
    setSelectedCampaign('');
    setSelectedLeads(new Set());
    setProgress(0);
    setResults({ success: 0, errors: 0 });
    setOptions({
      tone: 'professional',
      length: 'medium',
      focus: 'demo',
      customInstruction: '',
      generateVariants: false
    });
    setAdvancedOpen(false);
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
    const totalIterations = options.generateVariants ? leadIds.length * 2 : leadIds.length;

    for (let i = 0; i < leadIds.length; i++) {
      const variants = options.generateVariants ? [false, true] : [false];
      
      for (const isVariant of variants) {
        try {
          const { error } = await supabase.functions.invoke('generate-outreach-email', {
            body: { 
              lead_id: leadIds[i], 
              campaign_id: selectedCampaign,
              sequence_step: 1,
              options: {
                tone: options.tone,
                length: options.length,
                focus: options.focus,
                customInstruction: options.customInstruction || undefined,
                isVariant
              }
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
      }

      setProgress(Math.round(((i + 1) / leadIds.length) * 100));
    }

    setResults({ success, errors });
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['outreach-emails'] });
    queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
  };

  const toneOptions = [
    { value: 'formal', label: 'Formal', desc: 'Sehr höflich, distanziert' },
    { value: 'professional', label: 'Professionell', desc: 'Standard B2B' },
    { value: 'casual', label: 'Locker', desc: 'Freundlich, nahbar' },
    { value: 'direct', label: 'Direkt', desc: 'Kurz, auf den Punkt' },
  ];

  const focusOptions = [
    { value: 'demo', label: 'Demo-Anfrage', desc: '15-Min Demo anbieten' },
    { value: 'meeting', label: 'Meeting', desc: 'Termin vereinbaren' },
    { value: 'info', label: 'Info', desc: 'Informationen teilen' },
    { value: 'case-study', label: 'Case Study', desc: 'Erfolgsgeschichte zeigen' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            E-Mails generieren
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-5">
            {/* Campaign Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Kampagne</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="h-10">
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
                <p className="text-xs text-muted-foreground">
                  Keine aktiven Kampagnen vorhanden
                </p>
              )}
            </div>

            {/* Personalization Options */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
              <p className="text-sm font-medium">Personalisierung</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tonalität</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {toneOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setOptions(prev => ({ ...prev, tone: opt.value as Tone }))}
                        className={cn(
                          "px-3 py-2 text-xs rounded-md border transition-colors text-left",
                          options.tone === opt.value 
                            ? "border-primary bg-primary/10 text-primary" 
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <p className="font-medium">{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Fokus / CTA</Label>
                  <Select value={options.focus} onValueChange={(v) => setOptions(prev => ({ ...prev, focus: v as Focus }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {focusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Länge</Label>
                <RadioGroup 
                  value={options.length} 
                  onValueChange={(v) => setOptions(prev => ({ ...prev, length: v as Length }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="short" id="short" />
                    <Label htmlFor="short" className="text-sm cursor-pointer">Kurz (50-80)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="medium" />
                    <Label htmlFor="medium" className="text-sm cursor-pointer">Mittel (80-120)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="long" id="long" />
                    <Label htmlFor="long" className="text-sm cursor-pointer">Lang (120+)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Advanced Options */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8">
                  <span className="text-xs text-muted-foreground">Erweiterte Optionen</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <div className="flex items-center space-x-2 p-3 rounded-lg border">
                  <Checkbox 
                    id="variants" 
                    checked={options.generateVariants}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, generateVariants: !!checked }))}
                  />
                  <Label htmlFor="variants" className="text-sm cursor-pointer flex-1">
                    <span className="font-medium">2 Varianten generieren</span>
                    <span className="text-xs text-muted-foreground block">Für A/B Testing</span>
                  </Label>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Custom-Anweisung (optional)</Label>
                  <Textarea 
                    placeholder="z.B. 'Erwähne unsere Expertise in HR-Tech' oder 'Fokussiere auf Kostenersparnis'"
                    value={options.customInstruction}
                    onChange={(e) => setOptions(prev => ({ ...prev, customInstruction: e.target.value }))}
                    className="h-20 text-sm"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Lead Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Leads ({selectedLeads.size} von {eligibleLeads.length})
                </Label>
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                  {selectedLeads.size === eligibleLeads.length ? 'Keine' : 'Alle'}
                </Button>
              </div>
              
              <ScrollArea className="h-[200px] border rounded-lg">
                {eligibleLeads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Keine Leads mit Status "neu" oder "kontaktiert"</p>
                  </div>
                ) : (
                  <div className="p-1">
                    {eligibleLeads.map(lead => {
                      const signals = getLeadSignals(lead);
                      return (
                        <div
                          key={lead.id}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                            selectedLeads.has(lead.id) ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleLead(lead.id)}
                        >
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={() => toggleLead(lead.id)}
                            className="h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{lead.contact_name}</p>
                              <span className="text-muted-foreground">•</span>
                              <p className="text-sm text-muted-foreground truncate">{lead.company_name}</p>
                            </div>
                            {signals.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {signals.map((sig, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] h-4 px-1.5">
                                    {sig}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                {options.generateVariants && ' (mit Varianten)'}
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <Check className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
              <p className="text-lg font-medium">Generierung abgeschlossen</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{results.success}</p>
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
                <Sparkles className="h-4 w-4 mr-2" />
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
