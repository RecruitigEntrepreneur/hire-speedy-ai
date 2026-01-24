import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Star, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateSkill {
  id: string;
  skill_name: string;
  level: string | null;
  category: string | null;
  years_experience: number | null;
  last_used: string | null;
  is_primary: boolean;
  from_cv: boolean;
  verified: boolean;
}

interface CandidateSkillLevelEditorProps {
  candidateId: string;
  onUpdate?: () => void;
}

const PROFICIENCY_OPTIONS = [
  { value: 'beginner', label: 'Anfänger' },
  { value: 'intermediate', label: 'Fortgeschritten' },
  { value: 'advanced', label: 'Erfahren' },
  { value: 'expert', label: 'Experte' },
];

export function CandidateSkillLevelEditor({ candidateId, onUpdate }: CandidateSkillLevelEditorProps) {
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<CandidateSkill>>>({});

  useEffect(() => {
    fetchSkills();
  }, [candidateId]);

  const fetchSkills = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidate_skills')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('is_primary', { ascending: false })
      .order('skill_name');

    if (error) {
      console.error('Error fetching skills:', error);
      toast.error('Fehler beim Laden der Skills');
    } else {
      setSkills(data || []);
    }
    setLoading(false);
  };

  const updateLocalSkill = (skillId: string, field: keyof CandidateSkill, value: any) => {
    setSkills(prev => prev.map(s => 
      s.id === skillId ? { ...s, [field]: value } : s
    ));
    setPendingChanges(prev => ({
      ...prev,
      [skillId]: { ...prev[skillId], [field]: value }
    }));
  };

  const saveSkill = async (skillId: string) => {
    const changes = pendingChanges[skillId];
    if (!changes) return;

    setSaving(skillId);
    const { error } = await supabase
      .from('candidate_skills')
      .update(changes)
      .eq('id', skillId);

    if (error) {
      toast.error('Fehler beim Speichern');
      console.error(error);
    } else {
      toast.success('Gespeichert');
      setPendingChanges(prev => {
        const { [skillId]: _, ...rest } = prev;
        return rest;
      });
      onUpdate?.();
    }
    setSaving(null);
  };

  const saveAllChanges = async () => {
    const skillIds = Object.keys(pendingChanges);
    if (skillIds.length === 0) return;

    setSaving('all');
    for (const skillId of skillIds) {
      const changes = pendingChanges[skillId];
      await supabase
        .from('candidate_skills')
        .update(changes)
        .eq('id', skillId);
    }
    setPendingChanges({});
    toast.success(`${skillIds.length} Skills aktualisiert`);
    setSaving(null);
    onUpdate?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Keine Skills vorhanden
      </div>
    );
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-4">
      {hasPendingChanges && (
        <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
          <span className="text-sm text-amber-700 dark:text-amber-400">
            {Object.keys(pendingChanges).length} ungespeicherte Änderungen
          </span>
          <Button size="sm" onClick={saveAllChanges} disabled={saving === 'all'}>
            {saving === 'all' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Alle speichern
          </Button>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Skill</TableHead>
              <TableHead className="w-[120px]">Level</TableHead>
              <TableHead className="w-[80px]">Jahre</TableHead>
              <TableHead className="w-[120px]">Zuletzt genutzt</TableHead>
              <TableHead className="w-[60px] text-center">Primär</TableHead>
              <TableHead className="w-[60px] text-center">Verifiziert</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map(skill => {
              const hasChanges = !!pendingChanges[skill.id];
              return (
                <TableRow key={skill.id} className={cn(hasChanges && "bg-amber-50/50 dark:bg-amber-900/10")}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{skill.skill_name}</span>
                      {skill.from_cv && (
                        <Badge variant="outline" className="text-[10px]">CV</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={skill.level || ''}
                      onValueChange={(v) => updateLocalSkill(skill.id, 'level', v || null)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFICIENCY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      className="h-8 w-16 text-xs"
                      value={skill.years_experience ?? ''}
                      onChange={(e) => updateLocalSkill(skill.id, 'years_experience', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="-"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={skill.last_used || ''}
                      onChange={(e) => updateLocalSkill(skill.id, 'last_used', e.target.value || null)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={skill.is_primary}
                      onCheckedChange={(v) => updateLocalSkill(skill.id, 'is_primary', v)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={skill.verified}
                      onCheckedChange={(v) => updateLocalSkill(skill.id, 'verified', v)}
                    />
                  </TableCell>
                  <TableCell>
                    {hasChanges && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0"
                        onClick={() => saveSkill(skill.id)}
                        disabled={saving === skill.id}
                      >
                        {saving === skill.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3" /> Primär = Hauptkompetenz
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" /> Verifiziert = Durch Interview/Test bestätigt
        </div>
      </div>
    </div>
  );
}