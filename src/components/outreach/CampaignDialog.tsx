import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { X, Plus, Target, MessageSquare, Settings, Zap } from 'lucide-react';
import { OutreachCampaign, useCreateCampaign } from '@/hooks/useOutreach';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: OutreachCampaign | null;
}

const SEGMENTS = ['enterprise', 'mid_market', 'smb', 'startup'];
const GOALS = ['discovery', 'meeting', 'qualification', 'nurture'];
const TONALITIES = ['professional', 'friendly', 'direct', 'consultative'];

const DEFAULT_FORBIDDEN_WORDS = [
  'kostenlos', 'gratis', 'Angebot', 'Rabatt', 'Deal', 'Schnäppchen',
  'revolutionär', 'einzigartig', 'unglaublich', 'garantiert'
];

interface SequenceStep {
  day: number;
  type: 'email' | 'reminder' | 'followup';
}

export function CampaignDialog({ open, onOpenChange, campaign }: CampaignDialogProps) {
  const queryClient = useQueryClient();
  const createCampaign = useCreateCampaign();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_segment: 'mid_market',
    goal: 'meeting',
    tonality: 'professional',
    sender_name: '',
    sender_email: '',
    is_active: true,
    is_paused: false,
  });

  const [forbiddenWords, setForbiddenWords] = useState<string[]>(DEFAULT_FORBIDDEN_WORDS);
  const [newWord, setNewWord] = useState('');
  const [maxWords, setMaxWords] = useState([120]);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([
    { day: 0, type: 'email' },
    { day: 3, type: 'followup' },
    { day: 7, type: 'followup' },
  ]);
  const [cta, setCta] = useState('Hätten Sie Zeit für ein kurzes Gespräch?');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        target_segment: campaign.target_segment,
        goal: campaign.goal,
        tonality: campaign.tonality,
        sender_name: campaign.sender_name,
        sender_email: campaign.sender_email,
        is_active: campaign.is_active,
        is_paused: campaign.is_paused,
      });
    }
  }, [campaign]);

  const addForbiddenWord = () => {
    if (newWord && !forbiddenWords.includes(newWord)) {
      setForbiddenWords([...forbiddenWords, newWord]);
      setNewWord('');
    }
  };

  const removeForbiddenWord = (word: string) => {
    setForbiddenWords(forbiddenWords.filter(w => w !== word));
  };

  const addSequenceStep = () => {
    const lastDay = sequenceSteps.length > 0 ? sequenceSteps[sequenceSteps.length - 1].day : 0;
    setSequenceSteps([...sequenceSteps, { day: lastDay + 3, type: 'followup' }]);
  };

  const removeSequenceStep = (index: number) => {
    setSequenceSteps(sequenceSteps.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.sender_name || !formData.sender_email) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setIsSubmitting(true);

    try {
      if (campaign) {
        // Update existing campaign
        const { error } = await supabase
          .from('outreach_campaigns')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaign.id);

        if (error) throw error;
        toast.success('Kampagne aktualisiert');
      } else {
        // Create new campaign
        await createCampaign.mutateAsync({
          ...formData,
          stats: { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 },
        } as any);
      }

      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? 'Kampagne bearbeiten' : 'Neue Kampagne erstellen'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className="gap-1">
              <Target className="h-3 w-3" />
              Grundlagen
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              Inhalt
            </TabsTrigger>
            <TabsTrigger value="sequence" className="gap-1">
              <Zap className="h-3 w-3" />
              Sequenz
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="h-3 w-3" />
              Einstellungen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Kampagnenname *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Q1 Enterprise Outreach"
              />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Interne Beschreibung der Kampagne..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zielgruppe</Label>
                <Select
                  value={formData.target_segment}
                  onValueChange={(v) => setFormData({ ...formData, target_segment: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                    <SelectItem value="mid_market">Mid-Market (100-999)</SelectItem>
                    <SelectItem value="smb">SMB (10-99)</SelectItem>
                    <SelectItem value="startup">Startup (&lt;10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kampagnenziel</Label>
                <Select
                  value={formData.goal}
                  onValueChange={(v) => setFormData({ ...formData, goal: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discovery">Bedarf prüfen</SelectItem>
                    <SelectItem value="meeting">Gespräch vereinbaren</SelectItem>
                    <SelectItem value="qualification">Qualifizierung</SelectItem>
                    <SelectItem value="nurture">Beziehungsaufbau</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Tonalität</Label>
              <Select
                value={formData.tonality}
                onValueChange={(v) => setFormData({ ...formData, tonality: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professionell</SelectItem>
                  <SelectItem value="friendly">Freundlich</SelectItem>
                  <SelectItem value="direct">Direkt</SelectItem>
                  <SelectItem value="consultative">Beratend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Call-to-Action</Label>
              <Input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="z.B. Hätten Sie Zeit für ein kurzes Gespräch?"
              />
            </div>

            <div className="space-y-2">
              <Label>Max. Wortanzahl: {maxWords[0]}</Label>
              <Slider
                value={maxWords}
                onValueChange={setMaxWords}
                min={50}
                max={200}
                step={10}
              />
            </div>

            <div className="space-y-2">
              <Label>Verbotene Wörter</Label>
              <div className="flex gap-2">
                <Input
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Wort hinzufügen..."
                  onKeyDown={(e) => e.key === 'Enter' && addForbiddenWord()}
                />
                <Button variant="outline" size="icon" onClick={addForbiddenWord}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {forbiddenWords.map(word => (
                  <Badge key={word} variant="secondary" className="gap-1">
                    {word}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeForbiddenWord(word)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sequence" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Definiere die E-Mail-Sequenz für diese Kampagne
            </p>

            <div className="space-y-2">
              {sequenceSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Tag</span>
                      <Input
                        type="number"
                        value={step.day}
                        onChange={(e) => {
                          const newSteps = [...sequenceSteps];
                          newSteps[index].day = parseInt(e.target.value) || 0;
                          setSequenceSteps(newSteps);
                        }}
                        className="w-20"
                      />
                    </div>
                    <Select
                      value={step.type}
                      onValueChange={(v: 'email' | 'reminder' | 'followup') => {
                        const newSteps = [...sequenceSteps];
                        newSteps[index].type = v;
                        setSequenceSteps(newSteps);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Initial E-Mail</SelectItem>
                        <SelectItem value="followup">Follow-up</SelectItem>
                        <SelectItem value="reminder">Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSequenceStep(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={addSequenceStep} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Schritt hinzufügen
            </Button>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Absender Name *</Label>
                <Input
                  value={formData.sender_name}
                  onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="space-y-2">
                <Label>Absender E-Mail *</Label>
                <Input
                  type="email"
                  value={formData.sender_email}
                  onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
                  placeholder="max@firma.de"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Kampagne aktiv</p>
                <p className="text-sm text-muted-foreground">
                  Neue E-Mails werden generiert und versendet
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Speichern...' : campaign ? 'Speichern' : 'Kampagne erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
