import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User } from 'lucide-react';
import { PendingButton, pendingText } from '@/components/recruiter/RecruiterWaiting';
import { useRecruiterPending } from '@/components/verification/RecruiterAccessGate';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { CandidateFilters, FilterState, FILTER_GEHALT_MAX } from '@/components/candidates/CandidateFilters';
import { ViewToggle, ViewMode } from '@/components/candidates/ViewToggle';
import type { Candidate } from '@/components/candidates/CandidateCard';
import { KandidatKarte, type KarteAufgabe } from '@/components/candidates/KandidatKarte';
import { KandidatenListe } from '@/components/candidates/KandidatenListe';
import { useKandidatenStand } from '@/hooks/useKandidatenStand';
import { usePool } from '@/hooks/usePool';
import { istFaellig } from '@/lib/talentPool';
import { NeuerPoolFenster, PoolFenster, PoolKontaktFenster, type PoolKandidat } from '@/components/candidates/pool/PoolFenster';
import { useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { buildGuide } from '@/components/recruiter/tasks/taskWindow';
import { cn } from '@/lib/utils';
import { TagManagerDialog } from '@/components/candidates/TagManagerDialog';
import { BulkActionsBar } from '@/components/candidates/BulkActionsBar';
import { useCandidateTags } from '@/hooks/useCandidateTags';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { fetchCandidateIdsWithCv } from '@/hooks/useCandidateCv';
import { CandidateFormDialog } from '@/components/candidates/CandidateFormDialog';
import { KandidatAnlegenMenu } from '@/components/candidates/KandidatAnlegenMenu';
import { lebenslaufWaehlen } from '@/lib/lebenslaufAblage';
import { KandidatKurzDialog } from '@/components/candidates/KandidatKurzDialog';
import { PerMailWeiterleitenDialog } from '@/components/candidates/PerMailWeiterleitenDialog';

const defaultFilters: FilterState = {
  search: '', experienceMin: 0, experienceMax: 30, salaryMin: 0, salaryMax: FILTER_GEHALT_MAX,
  availability: 'all', selectedTags: [], sortBy: 'created_at', sortOrder: 'desc', jobId: 'all', nurOhneCv: false,
};

/** Reiter nach Stand (Vorschlag 1, 24.11.2026); sie sind der wichtigste Filter. */
// Talent Pool ist seit 25.11.2026 ein eigener Reiter; „Lebenslauf fehlt“ ist dafür ein Filter.
type Reiter = 'alle' | 'prozess' | 'frei' | 'pool' | 'eingestellt';
const REITER: Reiter[] = ['alle', 'prozess', 'frei', 'pool', 'eingestellt'];
const REITER_TEXT: Record<Reiter, string> = { alle: 'all', prozess: 'process', frei: 'free', pool: 'pool', eingestellt: 'placed' };

export default function RecruiterCandidates() {
  const { t } = useTranslation('recruiterCandidates');
  const pending = useRecruiterPending();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [reiter, setReiter] = useState<Reiter>('alle');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleViewCandidate = (c: Candidate) => navigate(`/recruiter/candidates/${c.id}`);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagManagerCandidateId, setTagManagerCandidateId] = useState<string | null>(null);
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);
  const [cvUploadDialogOpen, setCvUploadDialogOpen] = useState(false);
  const [cvStartText, setCvStartText] = useState(false);
  const [kurzOpen, setKurzOpen] = useState(false);
  const [perMailOpen, setPerMailOpen] = useState(false);
  // Wer hat einen hochgeladenen Lebenslauf? Ohne ihn kein Einreichen.
  const [withCvIds, setWithCvIds] = useState<Set<string> | null>(null);

  const { tags, getCandidateTags, createTag, deleteTag, assignTag, removeTag, assignments } = useCandidateTags();

  useEffect(() => { if (user) fetchCandidates(); }, [user]);

  const fetchCandidates = async () => {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('recruiter_id', user?.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setCandidates(data as unknown as Candidate[]);
      // Stand, Einstellungen und passende Stellen lädt useKandidatenStand (24.11.2026).
      fetchCandidateIdsWithCv(data.map((c) => c.id)).then(setWithCvIds, () => setWithCvIds(null));
    }
    setLoading(false);
  };

  const { uebersicht, stellenAuswahl, laedt: standLaedt } = useKandidatenStand(candidates as unknown as Record<string, unknown>[]);

  // Anstehende Aufgabe je Kandidat: dieselbe Quelle wie die Aufgaben-Seite
  const { allItems: aufgabenItems } = useUnifiedTaskInbox('all');
  const aufgabeJe = useMemo(() => {
    const m = new Map<string, UnifiedTaskItem>();
    for (const item of aufgabenItems) {
      if (!item.candidateId) continue;
      const vorher = m.get(item.candidateId);
      if (!vorher || item.sortPriority < vorher.sortPriority) m.set(item.candidateId, item);
    }
    return m;
  }, [aufgabenItems]);
  const aufgabeFuer = (id: string): KarteAufgabe | null => {
    const item = aufgabeJe.get(id);
    if (!item) return null;
    const g = buildGuide(item);
    return { label: `${g.pill} · ${g.primary.label}`, onOpen: () => navigate(`/recruiter/influence?item=${encodeURIComponent(item.itemId)}`) };
  };

  const pool = usePool();
  const [poolFenster, setPoolFenster] = useState<PoolKandidat[] | null>(null);
  const [meldenBei, setMeldenBei] = useState<Candidate | null>(null);
  /** Im Reiter „Talent Pool“: alle, nur fällige oder ein bestimmter Pool */
  const [poolFilter, setPoolFilter] = useState<string>('alle');
  const [neuerPool, setNeuerPool] = useState(false);
  const [poolBearbeiten, setPoolBearbeiten] = useState(false);
  const gewaehlterPool = pool.pools.find((p) => p.id === poolFilter) ?? null;
  /** Eintrag, den die Karte zeigt: im gewählten Pool der von dort, sonst der nächste */
  const poolEintrag = (id: string) => (reiter === 'pool' && poolFilter !== 'alle' && poolFilter !== 'faellig'
    ? pool.alleJeKandidat.get(id)?.find((e) => e.pool_id === poolFilter) : pool.jeKandidat.get(id)) ?? null;
  const imPoolReiter = candidates.filter((c) => uebersicht.get(c.id)?.stand.art === 'frei' && pool.jeKandidat.has(c.id));
  const alsPool = (c: Candidate): PoolKandidat => ({ id: c.id, name: c.full_name, rolle: c.job_title, phone: c.phone, email: c.email });
  /** Im Pool zählt, wer einen Eintrag hat und gerade nicht in einem Prozess oder eingestellt ist. */
  const standVon = (id: string): Reiter | null => {
    const art = uebersicht.get(id)?.stand.art ?? null;
    return art === 'frei' && pool.jeKandidat.has(id) ? 'pool' : art;
  };
  const ohneCv = (id: string) => !!withCvIds && !withCvIds.has(id);
  const zaehlung = useMemo(() => ({
    alle: candidates.length,
    prozess: candidates.filter((c) => standVon(c.id) === 'prozess').length,
    frei: candidates.filter((c) => standVon(c.id) === 'frei').length,
    pool: candidates.filter((c) => standVon(c.id) === 'pool').length,
    eingestellt: candidates.filter((c) => standVon(c.id) === 'eingestellt').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [candidates, uebersicht, pool.jeKandidat]);

  const filteredCandidates = useMemo(() => {
    
    const jetzt = Date.now();
    const TAG = 86_400_000;
    let result = candidates.filter(c => {
      if (reiter !== 'alle' && standVon(c.id) !== reiter) return false;
      if (filters.nurOhneCv && !ohneCv(c.id)) return false;
      if (reiter === 'pool' && poolFilter === 'faellig' && !(pool.alleJeKandidat.get(c.id) ?? []).some((e) => istFaellig(e))) return false;
      if (reiter === 'pool' && poolFilter !== 'alle' && poolFilter !== 'faellig' && !(pool.alleJeKandidat.get(c.id) ?? []).some((e) => e.pool_id === poolFilter)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!c.full_name.toLowerCase().includes(q) && !(c.email ?? '').toLowerCase().includes(q) &&
            !(c.job_title ?? '').toLowerCase().includes(q) &&
            !c.skills?.some(s => s.toLowerCase().includes(q))) return false;
      }
      if (filters.jobId !== 'all') {
        const u = uebersicht.get(c.id);
        if (!u || (!u.vorgestellt.includes(filters.jobId) && !u.passend.includes(filters.jobId))) return false;
      }
      if (filters.availability !== 'all') {
        const ab = c.availability_date ? new Date(c.availability_date).getTime() : null;
        if (ab == null) return false;
        const tage = (ab - jetzt) / TAG;
        if (filters.availability === 'immediate' && tage > 0) return false;
        if (filters.availability === '30days' && tage > 30) return false;
        if (filters.availability === '90days' && tage > 90) return false;
        if (filters.availability === 'later' && tage <= 90) return false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, filters, assignments, reiter, uebersicht, withCvIds, pool.jeKandidat, pool.alleJeKandidat, poolFilter]);

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
        const { error: insertError, data: insertedData } = await supabase.from('candidates').insert(insertData as never).select('id').single();
        error = insertError;
        // Log GDPR consent for new candidates
        if (!insertError && insertedData && user?.id) {
          await supabase.from('consents').insert({
            subject_id: user.id,
            subject_type: 'recruiter',
            consent_type: 'candidate_data_processing',
            granted: true,
            granted_at: new Date().toISOString(),
            scope: (insertedData as { id: string }).id,
            version: '1.0',
          }).then(({ error: consentError }) => {
            if (consentError) console.error('Failed to log GDPR consent:', consentError);
          });
        }
      }
      if (error) throw error;
      toast.success(editingCandidate ? t('list.updated') : t('list.added'));
      setFormDialogOpen(false);
      fetchCandidates();
    } catch (error) {
      toast.error(t('list.saveFailed'));
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (candidate: Candidate) => {
    if (!confirm(t('list.confirmDelete'))) return;
    const { error } = await supabase.from('candidates').delete().eq('id', candidate.id);
    if (error) toast.error(t('list.deleteFailed')); else { toast.success(t('list.deleted')); fetchCandidates(); }
  };

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds(prev => selected ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? filteredCandidates.map(c => c.id) : []);
  };

  const handleBulkExport = () => {
    const selected = candidates.filter(c => selectedIds.includes(c.id));
    const csv = [t('list.csvHeader'), ...selected.map(c =>
      `"${c.full_name}","${c.email}","${c.phone || ''}","${c.experience_years || ''}","${c.expected_salary || ''}","${c.skills?.join('; ') || ''}"`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = t('list.csvFile'); a.click();
    toast.success(t('list.exported', { count: selected.length }));
  };

  const handleBulkDelete = async () => {
    if (!confirm(t('list.confirmBulkDelete', { count: selectedIds.length }))) return;
    await supabase.from('candidates').delete().in('id', selectedIds);
    toast.success(t('list.bulkDeleted', { count: selectedIds.length }));
    setSelectedIds([]); fetchCandidates();
  };

  const handleBulkAssignTag = async (tagId: string) => {
    for (const id of selectedIds) await assignTag(id, tagId);
    toast.success(t('list.tagAssigned'));
  };

  const handleBulkRemoveTag = async (tagId: string) => {
    for (const id of selectedIds) await removeTag(id, tagId);
    toast.success(t('list.tagRemoved'));
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
        {/* Kopf (Vorschlag 1, 24.11.2026): Satz mit echten Zahlen statt der vier Kästen */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('list.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{standLaedt ? '\u00a0' : t('list.summary', { total: zaehlung.alle, process: zaehlung.prozess, placed: zaehlung.eingestellt })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap sm:gap-3">
            <Button variant="outline" onClick={() => { setTagManagerCandidateId(null); setTagManagerOpen(true); }}>
              {t('list.manageTags')}
            </Button>
            {pending
              ? <PendingButton label={pendingText('addCandidate')} data-tour="candidates.add" className="order-first w-full sm:order-none sm:w-auto" />
              : <KandidatAnlegenMenu
                size="default"
                className="order-first w-full sm:order-none sm:w-auto"
                tour="candidates.add"
                onLebenslauf={lebenslaufWaehlen}
                onText={() => { setCvStartText(true); setCvUploadDialogOpen(true); }}
                onOhneLebenslauf={() => setKurzOpen(true)}
                onHubspot={() => setHubspotDialogOpen(true)}
                onPerMail={() => setPerMailOpen(true)}
              />}
          </div>
        </div>

        {/* Reiter nach Stand, graue Pillen mit Zahl; am Handy wischbar */}
        <div className="handy-wischen -mx-1 overflow-x-auto px-1">
          <div role="tablist" aria-label={t('list.tabs.label')} className="inline-flex gap-0.5 rounded-full bg-secondary p-1">
            {REITER.map((r) => (
              <button key={r} type="button" role="tab" aria-selected={reiter === r} onClick={() => setReiter(r)}
                className={cn('whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors',
                  reiter === r ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {t(`list.tabs.${REITER_TEXT[r]}`)}<span className="ml-1.5 tabular-nums text-muted-foreground">{r !== 'alle' && (standLaedt || pool.laedt) ? '–' : zaehlung[r]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reiter „Talent Pool“: eigene Pools als Auswahl, dazu „Melden fällig“ und „Neuen Pool erstellen“ */}
        {reiter === 'pool' && !pool.laedt && (
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'alle', label: t('list.pool.all'), count: imPoolReiter.length },
              { key: 'faellig', label: t('list.pool.due'), count: imPoolReiter.filter((c) => (pool.alleJeKandidat.get(c.id) ?? []).some((e) => istFaellig(e))).length },
              ...pool.pools.map((p) => ({ key: p.id, label: p.name, count: imPoolReiter.filter((c) => (pool.alleJeKandidat.get(c.id) ?? []).some((e) => e.pool_id === p.id)).length })),
            ].map((x) => (
              <button key={x.key} type="button" aria-pressed={poolFilter === x.key} onClick={() => setPoolFilter(x.key)}
                className={cn('max-w-[16rem] truncate rounded-full border px-3 py-1.5 text-sm transition-colors', poolFilter === x.key ? 'border-foreground bg-foreground text-background' : 'bg-background hover:border-foreground/30')}>
                {x.label} <span className="tabular-nums opacity-70">· {x.count}</span>
              </button>
            ))}
            <button type="button" className="px-2 text-sm font-medium text-klick hover:underline" onClick={() => setNeuerPool(true)}>＋ {t('list.pool.create')}</button>
          </div>
        )}
        {reiter === 'pool' && gewaehlterPool && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{gewaehlterPool.name}</span>
            {gewaehlterPool.description && <> · {gewaehlterPool.description}</>}
            {' · '}<button type="button" className="font-medium text-klick hover:underline" onClick={() => setPoolBearbeiten(true)}>{t('list.pool.edit')} ›</button>
          </p>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <CandidateFilters filters={filters} onFilterChange={setFilters} tags={tags} allSkills={[]} stellen={stellenAuswahl} />
          <ViewToggle view={viewMode === 'table' ? 'list' : viewMode} onViewChange={setViewMode} />
        </div>

        {viewMode === 'cards' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCandidates.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  {candidates.length === 0 && !filters.search ? <>
                    <p className="font-medium">{t('list.emptyTitle')}</p>
                    <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">{t('list.emptyText')}</p>
                  </> : <p className="text-muted-foreground">{t('list.noneFound')}</p>}
                  {!filters.search && (
                    pending
                      ? <div className="mt-4 text-center"><PendingButton label={pendingText('addCandidate')} /><p className="mt-2 text-sm text-muted-foreground">{pendingText('emptyNote')}</p></div>
                      : <div className="mt-4">
                      <KandidatAnlegenMenu
                        size="default"
                        onLebenslauf={lebenslaufWaehlen}
                        onText={() => { setCvStartText(true); setCvUploadDialogOpen(true); }}
                        onOhneLebenslauf={() => setKurzOpen(true)}
                        onHubspot={() => setHubspotDialogOpen(true)}
                        onPerMail={() => setPerMailOpen(true)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : filteredCandidates.map(c => {
              const u = uebersicht.get(c.id);
              return (
                <KandidatKarte
                  key={c.id}
                  candidate={c}
                  stand={u?.stand ?? null}
                  passend={u ? u.passend.length : null}
                  aufgabe={aufgabeFuer(c.id)}
                  cvMissing={ohneCv(c.id)}
                  pool={poolEintrag(c.id)}
                  onMelden={setMeldenBei}
                  isSelected={selectedIds.includes(c.id)}
                  onSelect={handleSelect}
                  onView={handleViewCandidate}
                  onPassend={(k) => navigate(`/recruiter/candidates/${k.id}?stellen=1`)}
                  onEdit={handleOpenDialog}
                  onDelete={handleDelete}
                  onAssignTag={(id) => { setTagManagerCandidateId(id); setTagManagerOpen(true); }}
                  onAddToPool={(k) => setPoolFenster([alsPool(k)])}
                />
              );
            })}
          </div>
        )}

        {viewMode !== 'cards' && (
          filteredCandidates.length === 0
            ? <p className="rounded-xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground">{t('list.noneFound')}</p>
            : <KandidatenListe
              candidates={filteredCandidates}
              selectedIds={selectedIds}
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onSort={(k) => setFilters((f) => ({ ...f, sortBy: k, sortOrder: f.sortBy === k && f.sortOrder === 'desc' ? 'asc' : 'desc' }))}
              zeile={(c) => {
                const u = uebersicht.get(c.id);
                return {
                  stand: u?.stand ?? null,
                  passend: u ? u.passend.length : null,
                  aufgabe: aufgabeFuer(c.id),
                  cvMissing: ohneCv(c.id),
                  pool: poolEintrag(c.id),
                  onMelden: setMeldenBei,
                  onSelect: handleSelect,
                  onView: handleViewCandidate,
                  onPassend: (k) => navigate(`/recruiter/candidates/${k.id}?stellen=1`),
                  onEdit: handleOpenDialog,
                  onDelete: handleDelete,
                  onAssignTag: (id) => { setTagManagerCandidateId(id); setTagManagerOpen(true); },
                  onAddToPool: (k) => setPoolFenster([alsPool(k)]),
                };
              }}
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
        onAddToPool={() => setPoolFenster(candidates.filter((c) => selectedIds.includes(c.id)).map(alsPool))} 
      />

      <PoolFenster kandidaten={poolFenster} poolId={reiter === 'pool' && poolFilter !== 'alle' && poolFilter !== 'faellig' ? poolFilter : undefined} onClose={() => setPoolFenster(null)} />
      <NeuerPoolFenster offen={neuerPool} onClose={() => setNeuerPool(false)} onCreated={setPoolFilter} />
      <NeuerPoolFenster offen={poolBearbeiten} pool={gewaehlterPool} onClose={() => setPoolBearbeiten(false)} onDeleted={() => setPoolFilter('alle')} />
      <PoolKontaktFenster
        eintrag={meldenBei ? poolEintrag(meldenBei.id) : null}
        kandidat={meldenBei ? alsPool(meldenBei) : null}
        onClose={() => setMeldenBei(null)}
      />

      {/* New Tab-Based Form Dialog */}
      <CandidateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        candidate={editingCandidate}
        onSave={handleSaveCandidate}
        processing={processing}
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
          toast.success(t('list.imported'));
        }} 
      />

      <CvUploadDialog
        open={cvUploadDialogOpen}
        onOpenChange={(o) => { setCvUploadDialogOpen(o); if (!o) setCvStartText(false); }}
        startWithText={cvStartText}
        onCandidateCreated={() => {
          fetchCandidates();
          toast.success(t('list.createdFromCv'));
        }}
      />
      <KandidatKurzDialog open={kurzOpen} onOpenChange={setKurzOpen} />
      <PerMailWeiterleitenDialog open={perMailOpen} onOpenChange={setPerMailOpen} />
    </DashboardLayout>
  );
}
