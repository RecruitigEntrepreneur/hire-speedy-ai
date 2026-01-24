import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Search, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface SkillSynonym {
  id: string;
  canonical_name: string;
  synonym: string;
  confidence: number;
  bidirectional: boolean;
  category: string | null;
  active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'database', label: 'Database' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'devops', label: 'DevOps' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'data', label: 'Data/ML' },
  { value: 'finance', label: 'Finance' },
  { value: 'methodology', label: 'Methodology' },
  { value: 'tools', label: 'Tools' },
  { value: 'general', label: 'General' },
];

export default function AdminSkillSynonyms() {
  const [synonyms, setSynonyms] = useState<SkillSynonym[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSynonym, setEditingSynonym] = useState<SkillSynonym | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState({
    canonical_name: '',
    synonym: '',
    confidence: 1.0,
    bidirectional: true,
    category: 'general',
    active: true
  });

  useEffect(() => {
    fetchSynonyms();
  }, []);

  const fetchSynonyms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('skill_synonyms')
      .select('*')
      .order('canonical_name');

    if (error) {
      toast.error('Fehler beim Laden der Synonyme');
      console.error(error);
    } else {
      setSynonyms(data || []);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingSynonym(null);
    setFormData({
      canonical_name: '',
      synonym: '',
      confidence: 1.0,
      bidirectional: true,
      category: 'general',
      active: true
    });
    setDialogOpen(true);
  };

  const openEditDialog = (synonym: SkillSynonym) => {
    setEditingSynonym(synonym);
    setFormData({
      canonical_name: synonym.canonical_name,
      synonym: synonym.synonym,
      confidence: synonym.confidence,
      bidirectional: synonym.bidirectional,
      category: synonym.category || 'general',
      active: synonym.active
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.canonical_name || !formData.synonym) {
      toast.error('Canonical Name und Synonym sind erforderlich');
      return;
    }

    setSaving(true);
    
    const payload = {
      canonical_name: formData.canonical_name.toLowerCase().trim(),
      synonym: formData.synonym.toLowerCase().trim(),
      confidence: formData.confidence,
      bidirectional: formData.bidirectional,
      category: formData.category,
      active: formData.active
    };

    let error;
    if (editingSynonym) {
      ({ error } = await supabase
        .from('skill_synonyms')
        .update(payload)
        .eq('id', editingSynonym.id));
    } else {
      ({ error } = await supabase
        .from('skill_synonyms')
        .insert(payload));
    }

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        toast.error('Dieses Synonym existiert bereits');
      } else {
        toast.error('Fehler beim Speichern');
      }
      console.error(error);
      return;
    }

    toast.success(editingSynonym ? 'Synonym aktualisiert' : 'Synonym erstellt');
    setDialogOpen(false);
    fetchSynonyms();
  };

  const handleDelete = async (synonym: SkillSynonym) => {
    if (!confirm(`Synonym "${synonym.canonical_name} → ${synonym.synonym}" wirklich löschen?`)) return;

    const { error } = await supabase
      .from('skill_synonyms')
      .delete()
      .eq('id', synonym.id);

    if (error) {
      toast.error('Fehler beim Löschen');
      console.error(error);
      return;
    }

    toast.success('Synonym gelöscht');
    fetchSynonyms();
  };

  const toggleActive = async (synonym: SkillSynonym) => {
    const { error } = await supabase
      .from('skill_synonyms')
      .update({ active: !synonym.active })
      .eq('id', synonym.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
      return;
    }

    fetchSynonyms();
  };

  // Filter and group synonyms
  const filteredSynonyms = synonyms.filter(s => {
    const matchesSearch = !searchTerm || 
      s.canonical_name.includes(searchTerm.toLowerCase()) ||
      s.synonym.includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || s.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by canonical name
  const groupedSynonyms = filteredSynonyms.reduce((acc, s) => {
    if (!acc[s.canonical_name]) {
      acc[s.canonical_name] = [];
    }
    acc[s.canonical_name].push(s);
    return acc;
  }, {} as Record<string, SkillSynonym[]>);

  const uniqueCanonicalCount = Object.keys(groupedSynonyms).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Skill Synonyme</h1>
            <p className="text-muted-foreground">
              Verwalte Skill-Aliasse für besseres Matching
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Neues Synonym
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Synonyme</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{synonyms.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{new Set(synonyms.map(s => s.canonical_name)).size}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aktiv</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{synonyms.filter(s => s.active).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kategorien</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{new Set(synonyms.map(s => s.category).filter(Boolean)).size}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Skill oder Synonym..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filterCategory !== 'all' || searchTerm 
                ? `${filteredSynonyms.length} Ergebnisse` 
                : `${uniqueCanonicalCount} Skills mit Synonymen`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canonical Name</TableHead>
                  <TableHead>Synonym</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Bidirektional</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSynonyms.map((synonym) => (
                  <TableRow key={synonym.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {synonym.canonical_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">{synonym.synonym}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {synonym.category && (
                        <Badge variant="secondary" className="text-xs">
                          {synonym.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {synonym.bidirectional ? (
                        <Badge className="bg-blue-100 text-blue-700">↔</Badge>
                      ) : (
                        <Badge variant="outline">→</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={synonym.active}
                        onCheckedChange={() => toggleActive(synonym)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(synonym)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(synonym)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSynonym ? 'Synonym bearbeiten' : 'Neues Synonym erstellen'}
              </DialogTitle>
              <DialogDescription>
                Definiere ein Alias für einen Skill
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Canonical Name *</Label>
                <Input
                  value={formData.canonical_name}
                  onChange={(e) => setFormData({ ...formData, canonical_name: e.target.value })}
                  placeholder="z.B. javascript"
                />
                <p className="text-xs text-muted-foreground">
                  Der Standard-Name des Skills
                </p>
              </div>

              <div className="space-y-2">
                <Label>Synonym *</Label>
                <Input
                  value={formData.synonym}
                  onChange={(e) => setFormData({ ...formData, synonym: e.target.value })}
                  placeholder="z.B. js"
                />
                <p className="text-xs text-muted-foreground">
                  Ein alternatives Wort für diesen Skill
                </p>
              </div>

              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.bidirectional}
                    onCheckedChange={(checked) => setFormData({ ...formData, bidirectional: checked })}
                  />
                  <Label>Bidirektional</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label>Aktiv</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSynonym ? 'Speichern' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
