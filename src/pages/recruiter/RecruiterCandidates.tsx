import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Plus, User, ChevronDown, Upload, Link as LinkIcon, FileText } from 'lucide-react';
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
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { CandidateFormDialog } from '@/components/candidates/CandidateFormDialog';
import { Link } from 'react-router-dom';

const defaultFilters: FilterState = {
  search: '', experienceMin: 0, experienceMax: 30, salaryMin: 0, salaryMax: 500000,
  availability: 'all', selectedTags: [], sortBy: 'created_at', sortOrder: 'desc',
};

export default function RecruiterCandidates() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagManagerCandidateId, setTagManagerCandidateId] = useState<string | null>(null);
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);
  const [cvUploadDialogOpen, setCvUploadDialogOpen] = useState(false);

  const { tags, getCandidateTags, createTag, deleteTag, assignTag, removeTag, assignments } = useCandidateTags();

  useEffect(() => { if (user) fetchCandidates(); }, [user]);

  const fetchCandidates = async () => {
    console.log('[RecruiterCandidates] Fetching candidates for user:', user?.id);
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('recruiter_id', user?.id)
      .order('created_at', { ascending: false });
    console.log('[RecruiterCandidates] Fetched candidates:', data?.length, 'Error:', error);
    if (data) {
      console.log('[RecruiterCandidates] Candidate names:', data.map((c: any) => c.full_name));
    }
    if (!error && data) {
      setCandidates(data as unknown as Candidate[]);
    }
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
    setEditingCandidate(candidate || null);
    setFormDialogOpen(true);
  };

  const handleSaveCandidate = async (candidateData: Partial<Candidate>) => {
    setProcessing(true);
    try {
      let error;
      if (editingCandidate) {
        ({ error } = await supabase.from('candidates').update(candidateData as never).eq('id', editingCandidate.id));
      } else {
        const insertData = { ...candidateData, recruiter_id: user?.id };
        ({ error } = await supabase.from('candidates').insert(insertData as never));
      }
      if (error) throw error;
      toast.success(editingCandidate ? 'Kandidat aktualisiert' : 'Kandidat hinzugefügt');
      setFormDialogOpen(false);
      fetchCandidates();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setProcessing(false);
    }
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
                <DropdownMenuItem onClick={() => setCvUploadDialogOpen(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  CV hochladen
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
                  <Link to="/recruiter/integrations" className="flex items-center">
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

      {/* New Tab-Based Form Dialog */}
      <CandidateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        candidate={editingCandidate}
        onSave={handleSaveCandidate}
        processing={processing}
      />

      <CandidateDetailSheet 
        candidate={detailCandidate} 
        tags={detailCandidate ? getCandidateTags(detailCandidate.id) : []} 
        open={!!detailCandidate} 
        onOpenChange={open => !open && setDetailCandidate(null)} 
        onEdit={c => { setDetailCandidate(null); handleOpenDialog(c); }}
        onCandidateUpdated={fetchCandidates}
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

      <CvUploadDialog
        open={cvUploadDialogOpen}
        onOpenChange={setCvUploadDialogOpen}
        onCandidateCreated={() => {
          fetchCandidates();
          toast.success('Kandidat aus CV erstellt');
        }}
      />
    </DashboardLayout>
  );
}
