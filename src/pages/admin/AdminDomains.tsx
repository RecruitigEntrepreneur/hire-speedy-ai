import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Plus, Pencil, Trash2, Globe2 } from 'lucide-react';
import { toast } from 'sonner';

interface TechDomain {
  id: string;
  domain_key: string;
  display_name: string;
  display_name_de: string | null;
  primary_skills: string[];
  secondary_skills: string[];
  title_keywords: string[];
  transferable_to: string[];
  incompatible_with: string[];
  weight: number;
  active: boolean;
  created_at: string;
}

export default function AdminDomains() {
  const [domains, setDomains] = useState<TechDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<TechDomain | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    domain_key: '',
    display_name: '',
    display_name_de: '',
    primary_skills: '',
    secondary_skills: '',
    title_keywords: '',
    transferable_to: '',
    incompatible_with: '',
    weight: 1.0,
    active: true
  });

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tech_domains')
      .select('*')
      .order('display_name');

    if (error) {
      toast.error('Fehler beim Laden der Domains');
      console.error(error);
    } else {
      setDomains(data || []);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingDomain(null);
    setFormData({
      domain_key: '',
      display_name: '',
      display_name_de: '',
      primary_skills: '',
      secondary_skills: '',
      title_keywords: '',
      transferable_to: '',
      incompatible_with: '',
      weight: 1.0,
      active: true
    });
    setDialogOpen(true);
  };

  const openEditDialog = (domain: TechDomain) => {
    setEditingDomain(domain);
    setFormData({
      domain_key: domain.domain_key,
      display_name: domain.display_name,
      display_name_de: domain.display_name_de || '',
      primary_skills: domain.primary_skills.join(', '),
      secondary_skills: domain.secondary_skills.join(', '),
      title_keywords: domain.title_keywords.join(', '),
      transferable_to: domain.transferable_to.join(', '),
      incompatible_with: domain.incompatible_with.join(', '),
      weight: domain.weight,
      active: domain.active
    });
    setDialogOpen(true);
  };

  const parseArrayField = (value: string): string[] => {
    return value.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  };

  const handleSave = async () => {
    if (!formData.domain_key || !formData.display_name) {
      toast.error('Domain Key und Display Name sind erforderlich');
      return;
    }

    setSaving(true);
    
    const payload = {
      domain_key: formData.domain_key.toLowerCase().replace(/\s+/g, '_'),
      display_name: formData.display_name,
      display_name_de: formData.display_name_de || null,
      primary_skills: parseArrayField(formData.primary_skills),
      secondary_skills: parseArrayField(formData.secondary_skills),
      title_keywords: parseArrayField(formData.title_keywords),
      transferable_to: parseArrayField(formData.transferable_to),
      incompatible_with: parseArrayField(formData.incompatible_with),
      weight: formData.weight,
      active: formData.active
    };

    let error;
    if (editingDomain) {
      ({ error } = await supabase
        .from('tech_domains')
        .update(payload)
        .eq('id', editingDomain.id));
    } else {
      ({ error } = await supabase
        .from('tech_domains')
        .insert(payload));
    }

    setSaving(false);

    if (error) {
      toast.error('Fehler beim Speichern');
      console.error(error);
      return;
    }

    toast.success(editingDomain ? 'Domain aktualisiert' : 'Domain erstellt');
    setDialogOpen(false);
    fetchDomains();
  };

  const handleDelete = async (domain: TechDomain) => {
    if (!confirm(`Domain "${domain.display_name}" wirklich löschen?`)) return;

    const { error } = await supabase
      .from('tech_domains')
      .delete()
      .eq('id', domain.id);

    if (error) {
      toast.error('Fehler beim Löschen');
      console.error(error);
      return;
    }

    toast.success('Domain gelöscht');
    fetchDomains();
  };

  const toggleActive = async (domain: TechDomain) => {
    const { error } = await supabase
      .from('tech_domains')
      .update({ active: !domain.active })
      .eq('id', domain.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
      return;
    }

    fetchDomains();
  };

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
            <h1 className="text-2xl font-bold">Tech Domains</h1>
            <p className="text-muted-foreground">
              Verwalte die Domain-Klassifizierung für das Matching
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Domain
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{domains.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aktiv</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{domains.filter(d => d.active).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skills total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{domains.reduce((acc, d) => acc + d.primary_skills.length, 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Alle Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Primary Skills</TableHead>
                  <TableHead>Inkompatibel mit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{domain.display_name}</p>
                        <p className="text-xs text-muted-foreground">{domain.domain_key}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {domain.primary_skills.slice(0, 5).map(skill => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {domain.primary_skills.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{domain.primary_skills.length - 5}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {domain.incompatible_with.slice(0, 3).map(inc => (
                          <Badge key={inc} variant="destructive" className="text-xs">
                            {inc}
                          </Badge>
                        ))}
                        {domain.incompatible_with.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{domain.incompatible_with.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={domain.active}
                        onCheckedChange={() => toggleActive(domain)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(domain)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(domain)}
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDomain ? 'Domain bearbeiten' : 'Neue Domain erstellen'}
              </DialogTitle>
              <DialogDescription>
                Definiere die Skills und Inkompatibilitäten für diese Domain
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Domain Key *</Label>
                  <Input
                    value={formData.domain_key}
                    onChange={(e) => setFormData({ ...formData, domain_key: e.target.value })}
                    placeholder="z.B. backend_cloud"
                    disabled={!!editingDomain}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display Name *</Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="z.B. Backend/Cloud"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Display Name (Deutsch)</Label>
                <Input
                  value={formData.display_name_de}
                  onChange={(e) => setFormData({ ...formData, display_name_de: e.target.value })}
                  placeholder="z.B. Backend/Cloud"
                />
              </div>

              <div className="space-y-2">
                <Label>Primary Skills (kommagetrennt)</Label>
                <Textarea
                  value={formData.primary_skills}
                  onChange={(e) => setFormData({ ...formData, primary_skills: e.target.value })}
                  placeholder="java, spring, aws, kubernetes, docker"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Skills die diese Domain eindeutig identifizieren
                </p>
              </div>

              <div className="space-y-2">
                <Label>Title Keywords (kommagetrennt)</Label>
                <Input
                  value={formData.title_keywords}
                  onChange={(e) => setFormData({ ...formData, title_keywords: e.target.value })}
                  placeholder="backend, java, cloud, api"
                />
                <p className="text-xs text-muted-foreground">
                  Keywords in Jobtiteln die auf diese Domain hinweisen
                </p>
              </div>

              <div className="space-y-2">
                <Label>Transferierbar zu (Domain Keys)</Label>
                <Input
                  value={formData.transferable_to}
                  onChange={(e) => setFormData({ ...formData, transferable_to: e.target.value })}
                  placeholder="devops, data_ml"
                />
              </div>

              <div className="space-y-2">
                <Label>Inkompatibel mit (Domain Keys)</Label>
                <Input
                  value={formData.incompatible_with}
                  onChange={(e) => setFormData({ ...formData, incompatible_with: e.target.value })}
                  placeholder="embedded_hardware, design"
                />
                <p className="text-xs text-muted-foreground">
                  Domains die fundamental inkompatibel sind (führt zu 0.1x Multiplier)
                </p>
              </div>

              <div className="flex items-center gap-4">
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
                {editingDomain ? 'Speichern' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
