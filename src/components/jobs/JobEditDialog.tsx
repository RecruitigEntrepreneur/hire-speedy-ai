import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Loader2,
  Building2,
  MapPin,
  Briefcase,
  DollarSign,
  Users,
  Settings,
  Save,
  Trash2,
  Pause,
  Play,
  XCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  fee_percentage: number | null;
  skills: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  status: string | null;
  paused_at: string | null;
  office_address: string | null;
  remote_policy: string | null;
  onsite_days_required: number | null;
  urgency: string | null;
  industry: string | null;
}

interface JobEditDialogProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function JobEditDialog({ job, open, onOpenChange, onSave }: JobEditDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basics');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    company_name: '',
    description: '',
    requirements: '',
    location: '',
    remote_type: 'hybrid',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_min: '',
    salary_max: '',
    fee_percentage: '20',
    skills: '',
    must_haves: '',
    nice_to_haves: '',
    office_address: '',
    remote_policy: 'hybrid',
    onsite_days_required: '3',
    urgency: 'normal',
    industry: '',
  });

  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || '',
        company_name: job.company_name || '',
        description: job.description || '',
        requirements: job.requirements || '',
        location: job.location || '',
        remote_type: job.remote_type || 'hybrid',
        employment_type: job.employment_type || 'full-time',
        experience_level: job.experience_level || 'mid',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        fee_percentage: job.fee_percentage?.toString() || '20',
        skills: job.skills?.join(', ') || '',
        must_haves: job.must_haves?.join(', ') || '',
        nice_to_haves: job.nice_to_haves?.join(', ') || '',
        office_address: job.office_address || '',
        remote_policy: job.remote_policy || 'hybrid',
        onsite_days_required: job.onsite_days_required?.toString() || '3',
        urgency: job.urgency || 'normal',
        industry: job.industry || '',
      });
    }
  }, [job]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!job) return;
    
    setSaving(true);
    try {
      const skillsArray = formData.skills
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : null;
      const mustHavesArray = formData.must_haves
        ? formData.must_haves.split(',').map(s => s.trim()).filter(Boolean)
        : null;
      const niceToHavesArray = formData.nice_to_haves
        ? formData.nice_to_haves.split(',').map(s => s.trim()).filter(Boolean)
        : null;

      const { error } = await supabase
        .from('jobs')
        .update({
          title: formData.title,
          company_name: formData.company_name,
          description: formData.description,
          requirements: formData.requirements,
          location: formData.location,
          remote_type: formData.remote_type,
          employment_type: formData.employment_type,
          experience_level: formData.experience_level,
          salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
          salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
          fee_percentage: formData.fee_percentage ? parseInt(formData.fee_percentage) : 20,
          skills: skillsArray,
          must_haves: mustHavesArray,
          nice_to_haves: niceToHavesArray,
          office_address: formData.office_address || null,
          remote_policy: formData.remote_policy,
          onsite_days_required: formData.remote_policy === 'hybrid' ? parseInt(formData.onsite_days_required) : null,
          urgency: formData.urgency,
          industry: formData.industry || null,
        })
        .eq('id', job.id);

      if (error) throw error;

      toast({ title: 'Job aktualisiert' });
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating job:', error);
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (action: 'publish' | 'pause' | 'resume' | 'close') => {
    if (!job) return;
    
    setSaving(true);
    try {
      let updates: Record<string, any> = {};
      
      switch (action) {
        case 'publish':
          updates = { status: 'published', paused_at: null };
          break;
        case 'pause':
          updates = { paused_at: new Date().toISOString() };
          break;
        case 'resume':
          updates = { paused_at: null };
          break;
        case 'close':
          updates = { status: 'closed' };
          setShowCloseDialog(false);
          break;
      }

      const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', job.id);

      if (error) throw error;

      toast({ 
        title: action === 'publish' ? 'Job veröffentlicht' :
               action === 'pause' ? 'Job pausiert' :
               action === 'resume' ? 'Job reaktiviert' :
               'Job geschlossen'
      });
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!job) return null;

  const isPaused = !!job.paused_at;
  const isDraft = job.status === 'draft';
  const isClosed = job.status === 'closed';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Job bearbeiten
            </DialogTitle>
            <DialogDescription>
              Bearbeite alle Details dieser Stelle
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basics" className="text-xs">
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  Grunddaten
                </TabsTrigger>
                <TabsTrigger value="location" className="text-xs">
                  <MapPin className="h-3.5 w-3.5 mr-1.5" />
                  Standort
                </TabsTrigger>
                <TabsTrigger value="skills" className="text-xs">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Skills
                </TabsTrigger>
                <TabsTrigger value="conditions" className="text-xs">
                  <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                  Konditionen
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[400px] px-6 py-4">
              {/* Basics Tab */}
              <TabsContent value="basics" className="mt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Jobtitel *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="z.B. Senior Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Firmenname *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      placeholder="z.B. Acme GmbH"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Stellenbeschreibung</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={5}
                    placeholder="Beschreibe die Rolle und Verantwortlichkeiten..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Anforderungen</Label>
                  <Textarea
                    id="requirements"
                    value={formData.requirements}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                    rows={4}
                    placeholder="Liste die Qualifikationen auf..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Anstellungsart</Label>
                    <Select
                      value={formData.employment_type}
                      onValueChange={(v) => handleInputChange('employment_type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Vollzeit</SelectItem>
                        <SelectItem value="part-time">Teilzeit</SelectItem>
                        <SelectItem value="contract">Befristet</SelectItem>
                        <SelectItem value="freelance">Freelance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Erfahrungslevel</Label>
                    <Select
                      value={formData.experience_level}
                      onValueChange={(v) => handleInputChange('experience_level', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">Junior (0-2 Jahre)</SelectItem>
                        <SelectItem value="mid">Mid-Level (2-5 Jahre)</SelectItem>
                        <SelectItem value="senior">Senior (5-8 Jahre)</SelectItem>
                        <SelectItem value="lead">Lead/Principal (8+ Jahre)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Dringlichkeit</Label>
                    <Select
                      value={formData.urgency}
                      onValueChange={(v) => handleInputChange('urgency', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Niedrig</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">Hoch</SelectItem>
                        <SelectItem value="urgent">Dringend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Branche</Label>
                    <Input
                      id="industry"
                      value={formData.industry}
                      onChange={(e) => handleInputChange('industry', e.target.value)}
                      placeholder="z.B. Technologie, Finanzen..."
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Location Tab */}
              <TabsContent value="location" className="mt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">Standort</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="z.B. Berlin, Deutschland"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Remote-Modell</Label>
                    <Select
                      value={formData.remote_type}
                      onValueChange={(v) => handleInputChange('remote_type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onsite">Vor Ort</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="office_address">Büro-Adresse</Label>
                  <Input
                    id="office_address"
                    value={formData.office_address}
                    onChange={(e) => handleInputChange('office_address', e.target.value)}
                    placeholder="Straße, PLZ, Stadt"
                  />
                </div>

                {formData.remote_type === 'hybrid' && (
                  <div className="space-y-3">
                    <Label>Pflichttage im Büro pro Woche: {formData.onsite_days_required}</Label>
                    <Slider
                      value={[parseInt(formData.onsite_days_required) || 3]}
                      onValueChange={([v]) => handleInputChange('onsite_days_required', v.toString())}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 Tag</span>
                      <span>5 Tage</span>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Skills Tab */}
              <TabsContent value="skills" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="skills">Technische Skills</Label>
                  <Textarea
                    id="skills"
                    value={formData.skills}
                    onChange={(e) => handleInputChange('skills', e.target.value)}
                    placeholder="Kommagetrennt: React, TypeScript, Node.js..."
                    rows={3}
                  />
                  {formData.skills && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.skills.split(',').map((skill, i) => (
                        skill.trim() && (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill.trim()}
                          </Badge>
                        )
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="must_haves">Must-Haves</Label>
                  <Textarea
                    id="must_haves"
                    value={formData.must_haves}
                    onChange={(e) => handleInputChange('must_haves', e.target.value)}
                    placeholder="Unverzichtbare Anforderungen..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nice_to_haves">Nice-to-Haves</Label>
                  <Textarea
                    id="nice_to_haves"
                    value={formData.nice_to_haves}
                    onChange={(e) => handleInputChange('nice_to_haves', e.target.value)}
                    placeholder="Wünschenswerte Zusatzqualifikationen..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              {/* Conditions Tab */}
              <TabsContent value="conditions" className="mt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="salary_min">Gehalt Min (€/Jahr)</Label>
                    <Input
                      id="salary_min"
                      type="number"
                      value={formData.salary_min}
                      onChange={(e) => handleInputChange('salary_min', e.target.value)}
                      placeholder="z.B. 60000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary_max">Gehalt Max (€/Jahr)</Label>
                    <Input
                      id="salary_max"
                      type="number"
                      value={formData.salary_max}
                      onChange={(e) => handleInputChange('salary_max', e.target.value)}
                      placeholder="z.B. 80000"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Vermittlungsfee: {formData.fee_percentage}%</Label>
                  <Slider
                    value={[parseInt(formData.fee_percentage) || 20]}
                    onValueChange={([v]) => handleInputChange('fee_percentage', v.toString())}
                    min={10}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span>30%</span>
                  </div>
                </div>

                {formData.salary_min && formData.fee_percentage && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Geschätzte Vermittlungsgebühr</p>
                    <p className="text-xl font-bold">
                      €{Math.round((parseInt(formData.salary_min) || 0) * (parseInt(formData.fee_percentage) || 20) / 100).toLocaleString()}
                      {formData.salary_max && (
                        <span className="text-muted-foreground"> - €{Math.round((parseInt(formData.salary_max) || 0) * (parseInt(formData.fee_percentage) || 20) / 100).toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <Separator />

          <DialogFooter className="px-6 py-4 flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              {isDraft && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('publish')}
                  disabled={saving}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Veröffentlichen
                </Button>
              )}
              {!isDraft && !isClosed && (
                isPaused ? (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange('resume')}
                    disabled={saving}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Reaktivieren
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange('pause')}
                    disabled={saving}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pausieren
                  </Button>
                )
              )}
              {!isClosed && (
                <Button
                  variant="outline"
                  onClick={() => setShowCloseDialog(true)}
                  disabled={saving}
                  className="text-destructive border-destructive/20 hover:bg-destructive/10"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Schließen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Confirmation Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Job wirklich schließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Wenn du diesen Job schließt, wird er nicht mehr für Recruiter sichtbar sein. 
              Aktive Bewerbungen bleiben erhalten. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange('close')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Job schließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
