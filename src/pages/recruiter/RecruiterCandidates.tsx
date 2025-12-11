import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Plus, User, ChevronDown, Upload, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

import { CandidateStatsBar } from '@/components/candidates/CandidateStatsBar';
import { CandidateFilters, FilterState } from '@/components/candidates/CandidateFilters';
import { ViewToggle, ViewMode } from '@/components/candidates/ViewToggle';
import { CandidateCard, Candidate } from '@/components/candidates/CandidateCard';
import { CandidateListView } from '@/components/candidates/CandidateListView';
import { CandidateTableView } from '@/components/candidates/CandidateTableView';
import { CandidateDetailSheet } from '@/components/candidates/CandidateDetailSheet';
import { TagManagerDialog } from '@/components/candidates/TagManagerDialog';
import { BulkActionsBar } from '@/components/candidates/BulkActionsBar';
import { useCandidateTags } from '@/hooks/useCandidateTags';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';
import { Link } from 'react-router-dom';
const initialFormData = {
  full_name: '', email: '', phone: '', experience_years: '', current_salary: '',
  expected_salary: '', skills: '', summary: '', cv_url: '', linkedin_url: '',
  availability_date: '', notice_period: '',
};

const defaultFilters: FilterState = {
  search: '', experienceMin: 0, experienceMax: 30, salaryMin: 0, salaryMax: 200000,
  availability: 'all', selectedTags: [], sortBy: 'created_at', sortOrder: 'desc',
};

export default function RecruiterCandidates() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [processing, setProcessing] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagManagerCandidateId, setTagManagerCandidateId] = useState<string | null>(null);
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);

  const { tags, getCandidateTags, createTag, deleteTag, assignTag, removeTag, assignments } = useCandidateTags();

  useEffect(() => { if (user) fetchCandidates(); }, [user]);

  const fetchCandidates = async () => {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('recruiter_id', user?.id)
      .order('created_at', { ascending: false });
    if (!error && data) setCandidates(data);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      total: candidates.length,
      thisWeek: candidates.filter(c => new Date(c.created_at) > weekAgo).length,
      availableSoon: candidates.filter(c => c.availability_date && new Date(c.availability_date) <= soon).length,
      activeJobs: 0,
    };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    let result = candidates.filter(c => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!c.full_name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) &&
            !c.skills?.some(s => s.toLowerCase().includes(q))) return false;
      }
      if (c.experience_years !== null && (c.experience_years < filters.experienceMin || c.experience_years > filters.experienceMax)) return false;
      if (c.expected_salary !== null && (c.expected_salary < filters.salaryMin || c.expected_salary > filters.salaryMax)) return false;
      if (filters.selectedTags.length > 0) {
        const candidateTagIds = assignments.filter(a => a.candidate_id === c.id).map(a => a.tag_id);
        if (!filters.selectedTags.some(t => candidateTagIds.includes(t))) return false;
      }
      return true;
    });
    result.sort((a, b) => {
      const aVal = a[filters.sortBy as keyof Candidate];
      const bVal = b[filters.sortBy as keyof Candidate];
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return filters.sortOrder === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [candidates, filters, assignments]);

  const handleOpenDialog = (candidate?: Candidate) => {
    if (candidate) {
      setEditingCandidate(candidate);
      setFormData({
        full_name: candidate.full_name, email: candidate.email, phone: candidate.phone || '',
        experience_years: candidate.experience_years?.toString() || '', current_salary: candidate.current_salary?.toString() || '',
        expected_salary: candidate.expected_salary?.toString() || '', skills: candidate.skills?.join(', ') || '',
        summary: candidate.summary || '', cv_url: candidate.cv_url || '', linkedin_url: candidate.linkedin_url || '',
        availability_date: candidate.availability_date || '', notice_period: candidate.notice_period || '',
      });
    } else { setEditingCandidate(null); setFormData(initialFormData); }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email) { toast.error('Name und E-Mail sind erforderlich'); return; }
    setProcessing(true);
    const candidateData = {
      full_name: formData.full_name, email: formData.email, phone: formData.phone || null,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      current_salary: formData.current_salary ? parseInt(formData.current_salary) : null,
      expected_salary: formData.expected_salary ? parseInt(formData.expected_salary) : null,
      skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : null,
      summary: formData.summary || null, cv_url: formData.cv_url || null, linkedin_url: formData.linkedin_url || null,
      availability_date: formData.availability_date || null, notice_period: formData.notice_period || null, recruiter_id: user?.id,
    };
    let error;
    if (editingCandidate) { ({ error } = await supabase.from('candidates').update(candidateData).eq('id', editingCandidate.id)); }
    else { ({ error } = await supabase.from('candidates').insert(candidateData)); }
    if (error) toast.error('Fehler beim Speichern');
    else { toast.success(editingCandidate ? 'Kandidat aktualisiert' : 'Kandidat hinzugefügt'); setDialogOpen(false); fetchCandidates(); }
    setProcessing(false);
  };

  const handleDelete = async (candidate: Candidate) => {
    if (!confirm('Möchten Sie diesen Kandidaten wirklich löschen?')) return;
    const { error } = await supabase.from('candidates').delete().eq('id', candidate.id);
    if (error) toast.error('Fehler beim Löschen'); else { toast.success('Kandidat gelöscht'); fetchCandidates(); }
  };

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds(prev => selected ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? filteredCandidates.map(c => c.id) : []);
  };

  const handleBulkExport = () => {
    const selected = candidates.filter(c => selectedIds.includes(c.id));
    const csv = ['Name,E-Mail,Telefon,Erfahrung,Gehalt,Skills', ...selected.map(c =>
      `"${c.full_name}","${c.email}","${c.phone || ''}","${c.experience_years || ''}","${c.expected_salary || ''}","${c.skills?.join('; ') || ''}"`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'kandidaten.csv'; a.click();
    toast.success(`${selected.length} Kandidaten exportiert`);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`${selectedIds.length} Kandidaten wirklich löschen?`)) return;
    await supabase.from('candidates').delete().in('id', selectedIds);
    toast.success(`${selectedIds.length} Kandidaten gelöscht`);
    setSelectedIds([]); fetchCandidates();
  };

  const handleBulkAssignTag = async (tagId: string) => {
    for (const id of selectedIds) await assignTag(id, tagId);
    toast.success('Tag zugewiesen');
  };

  const handleBulkRemoveTag = async (tagId: string) => {
    for (const id of selectedIds) await removeTag(id, tagId);
    toast.success('Tag entfernt');
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meine Kandidaten</h1>
            <p className="text-muted-foreground mt-1">Verwalten Sie Ihre Kandidaten-Datenbank</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { setTagManagerCandidateId(null); setTagManagerOpen(true); }}>
              Tags verwalten
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Kandidat hinzufügen
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Manuell hinzufügen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHubspotDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Aus HubSpot importieren
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Upload className="h-4 w-4 mr-2" />
                  CSV importieren (bald)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/integrations" className="flex items-center">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    CRM verbinden
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CandidateStatsBar totalCandidates={stats.total} addedThisWeek={stats.thisWeek} availableSoon={stats.availableSoon} activeAssignments={stats.activeJobs} />

        <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
          <CandidateFilters filters={filters} onFilterChange={setFilters} tags={tags} allSkills={[]} />
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </div>

        {viewMode === 'cards' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCandidates.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine Kandidaten gefunden</p>
                  {!filters.search && (
                    <Button className="mt-4" onClick={() => handleOpenDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Kandidat hinzufügen
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : filteredCandidates.map(c => (
              <CandidateCard 
                key={c.id} 
                candidate={c} 
                tags={getCandidateTags(c.id)} 
                isSelected={selectedIds.includes(c.id)}
                onSelect={handleSelect} 
                onEdit={handleOpenDialog} 
                onDelete={handleDelete} 
                onView={setDetailCandidate}
                onAssignTag={(id) => { setTagManagerCandidateId(id); setTagManagerOpen(true); }} 
                onAddToPool={() => toast.info('Talent Pool Feature')} 
              />
            ))}
          </div>
        )}

        {viewMode === 'list' && (
          <CandidateListView 
            candidates={filteredCandidates} 
            selectedIds={selectedIds} 
            onSelect={handleSelect} 
            onSelectAll={handleSelectAll} 
            getCandidateTags={getCandidateTags} 
            onEdit={handleOpenDialog} 
            onDelete={handleDelete} 
            onView={setDetailCandidate} 
            onAssignTag={(id) => { setTagManagerCandidateId(id); setTagManagerOpen(true); }} 
            onAddToPool={() => toast.info('Talent Pool Feature')} 
          />
        )}

        {viewMode === 'table' && (
          <CandidateTableView 
            candidates={filteredCandidates} 
            selectedIds={selectedIds} 
            onSelect={handleSelect} 
            onSelectAll={handleSelectAll} 
            getCandidateTags={getCandidateTags} 
            onEdit={handleOpenDialog} 
            onDelete={handleDelete} 
            onView={setDetailCandidate} 
            onAssignTag={(id) => { setTagManagerCandidateId(id); setTagManagerOpen(true); }} 
            onAddToPool={() => toast.info('Talent Pool Feature')} 
          />
        )}
      </div>

      <BulkActionsBar 
        selectedCount={selectedIds.length} 
        tags={tags} 
        onClearSelection={() => setSelectedIds([])} 
        onAssignTag={handleBulkAssignTag} 
        onRemoveTag={handleBulkRemoveTag} 
        onExport={handleBulkExport} 
        onDelete={handleBulkDelete} 
        onAddToPool={() => toast.info('Talent Pool Feature')} 
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCandidate ? 'Kandidat bearbeiten' : 'Neuen Kandidaten hinzufügen'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Max Mustermann" />
              </div>
              <div>
                <Label>E-Mail *</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="max@beispiel.de" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefon</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+49 123 456789" />
              </div>
              <div>
                <Label>Berufserfahrung (Jahre)</Label>
                <Input type="number" value={formData.experience_years} onChange={e => setFormData({...formData, experience_years: e.target.value})} placeholder="5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Aktuelles Gehalt (€)</Label>
                <Input type="number" value={formData.current_salary} onChange={e => setFormData({...formData, current_salary: e.target.value})} placeholder="60000" />
              </div>
              <div>
                <Label>Gehaltsvorstellung (€)</Label>
                <Input type="number" value={formData.expected_salary} onChange={e => setFormData({...formData, expected_salary: e.target.value})} placeholder="70000" />
              </div>
            </div>
            <div>
              <Label>Skills (kommagetrennt)</Label>
              <Input value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} placeholder="React, TypeScript, Node.js" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Verfügbar ab</Label>
                <Input type="date" value={formData.availability_date} onChange={e => setFormData({...formData, availability_date: e.target.value})} />
              </div>
              <div>
                <Label>Kündigungsfrist</Label>
                <Input value={formData.notice_period} onChange={e => setFormData({...formData, notice_period: e.target.value})} placeholder="3 Monate" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CV URL</Label>
                <Input value={formData.cv_url} onChange={e => setFormData({...formData, cv_url: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <Label>LinkedIn URL</Label>
                <Input value={formData.linkedin_url} onChange={e => setFormData({...formData, linkedin_url: e.target.value})} placeholder="https://linkedin.com/in/..." />
              </div>
            </div>
            <div>
              <Label>Zusammenfassung</Label>
              <Textarea value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} placeholder="Kurze Beschreibung..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingCandidate ? 'Aktualisieren' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CandidateDetailSheet 
        candidate={detailCandidate} 
        tags={detailCandidate ? getCandidateTags(detailCandidate.id) : []} 
        open={!!detailCandidate} 
        onOpenChange={open => !open && setDetailCandidate(null)} 
        onEdit={c => { setDetailCandidate(null); handleOpenDialog(c); }} 
      />

      <TagManagerDialog 
        open={tagManagerOpen} 
        onOpenChange={setTagManagerOpen} 
        candidateId={tagManagerCandidateId} 
        tags={tags} 
        candidateTags={tagManagerCandidateId ? getCandidateTags(tagManagerCandidateId) : []} 
        onCreateTag={createTag} 
        onDeleteTag={deleteTag} 
        onAssignTag={assignTag} 
        onRemoveTag={removeTag} 
      />

      <HubSpotImportDialog 
        open={hubspotDialogOpen} 
        onOpenChange={setHubspotDialogOpen} 
        onImportComplete={() => {
          fetchCandidates();
          toast.success('Kandidaten importiert');
        }} 
      />
    </DashboardLayout>
  );
}
