import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { onboardingApi, type StoredContract, type StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import {
  buildPartners, countGroups, countTiles, filterPartners, GROUP_LABELS, PHASE_LABELS, relativeTime, TILE_LABELS,
  type Group, type Partner, type RecruiterAccount, type Tile,
} from '@/lib/recruiterNetwork';
import { loadRecruiterAccounts } from './accounts';
import { ConditionsDialog } from './ConditionsDialog';
import { InviteSheet, type InvitePrefill } from './InviteSheet';
import { PartnerDrawer, type DrawerTab } from './PartnerDrawer';

/**
 * Recruiterverwaltung als Cockpit: oben, was jetzt dran ist, darunter jede
 * Person genau einmal mit Phase, letztem Signal und nächstem Schritt. Ein Klick
 * öffnet die Akte. Konditionen stehen einmal für alle am Fuß.
 */
const PREF_KEY = 'matchunt.admin.network.hideTests';
const readPref = () => { try { return localStorage.getItem(PREF_KEY) === '1'; } catch { return false; } };
const writePref = (v: boolean) => { try { localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch { /* egal */ } };
const TILES: Tile[] = ['decide', 'activate', 'followUp', 'expiring'];
const GROUPS: (Group | 'all')[] = ['all', 'onboarding', 'active', 'no_contract', 'suspended', 'archive'];
const ACTIONABLE = ['review', 'countersign', 'activate', 'remind', 'resend', 'start_contract'];
const URGENT = ['review', 'countersign', 'activate'];

function Dots({ step }: { step: number }) {
  return <span className="inline-flex gap-1" aria-hidden>{Array.from({ length: 6 }, (_, i) =>
    <span key={i} className={`h-2 w-2 rounded-full ${i < step ? 'bg-primary' : 'border border-muted-foreground/40'}`}/>)}</span>;
}

const performance = (p: Partner) => p.account ? `${p.account.submissions} Einr. · ${p.account.interviewed} Int. · ${p.account.placements} Plac.` : '';

export default function NetworkCockpit() {
  const [cases, setCases] = useState<StoredOnboarding[]>([]);
  const [contracts, setContracts] = useState<StoredContract[]>([]);
  const [accounts, setAccounts] = useState<RecruiterAccount[]>([]);
  const [docusign, setDocusign] = useState({ enabled: false, message: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [group, setGroup] = useState<Group | 'all'>('all');
  const [tile, setTile] = useState<Tile | null>(null);
  const [search, setSearch] = useState('');
  const [hideTests, setHideTests] = useState(readPref);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');
  const [invite, setInvite] = useState<{ open: boolean; prefill: InvitePrefill | null }>({ open: false, prefill: null });
  const [conditionsOpen, setConditionsOpen] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true); setError('');
    try {
      const [list, accs] = await Promise.all([
        onboardingApi<{ cases: StoredOnboarding[]; contracts: StoredContract[]; docusign_enabled: boolean; docusign_setup_message?: string }>(true, { action: 'list' }),
        loadRecruiterAccounts(),
      ]);
      setCases(list.cases); setContracts(list.contracts); setAccounts(accs);
      setDocusign({ enabled: list.docusign_enabled, message: list.docusign_setup_message ?? '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Daten konnten nicht geladen werden.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const partners = useMemo(() => buildPartners({ cases, contracts, accounts }), [cases, contracts, accounts]);
  const base = useMemo(() => hideTests ? partners.filter(p => !p.isTest) : partners, [partners, hideTests]);
  const tiles = countTiles(base);
  const groups = countGroups(base);
  const visible = filterPartners(partners, { group, tile, search, hideTests });
  const selectedPartner = partners.find(p => p.key === selected) ?? null;
  const legacyFees = accounts.filter(a => a.customFee != null);

  // Rückkehr aus DocuSign (?contract_return=<id>): die Akte des Vorgangs öffnen.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('contract_return');
    const contract = id ? contracts.find(row => row.id === id) : null;
    const owner = contract ? partners.find(p => p.caseRow?.id === contract.case_id) : null;
    if (owner) { setSelected(owner.key); setDrawerTab('contract'); }
  }, [contracts]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPartner = (p: Partner, tab: DrawerTab = 'overview') => { setSelected(p.key); setDrawerTab(tab); };
  const act = (p: Partner) => {
    if (p.next.kind === 'start_contract') { setInvite({ open: true, prefill: { name: p.name, email: p.email, company: p.company } }); return; }
    openPartner(p, URGENT.includes(p.next.kind) ? 'contract' : 'overview');
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Headhunter-Netzwerk</p>
        <h1 className="text-3xl font-bold">Recruiterverwaltung</h1>
        <p className="mt-1 text-muted-foreground">{loading ? 'Wird geladen …' : `${groups.onboarding} im Onboarding · ${groups.active} aktiv · ${groups.no_contract} ohne Vertrag`}</p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input className="pl-9" placeholder="Name, E-Mail oder Firma" value={search} onChange={e => setSearch(e.target.value)} aria-label="Partner suchen"/>
        </div>
        <Button onClick={() => setInvite({ open: true, prefill: null })}><Plus className="mr-1 h-4 w-4"/>Einladen</Button>
      </div>
    </header>

    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {!loading && !docusign.enabled && docusign.message && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{docusign.message}</p>}

    <section aria-label="Jetzt dran" className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Jetzt dran</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map(key => <button key={key} type="button" aria-pressed={tile === key} onClick={() => setTile(tile === key ? null : key)}
          className={`rounded-xl border p-4 text-left transition hover:bg-muted/50 ${tile === key ? 'border-primary ring-1 ring-primary' : ''} ${tiles[key] ? '' : 'opacity-60'}`}>
          <span className="block text-3xl font-bold tabular-nums">{loading ? '–' : tiles[key]}</span>
          <span className="block font-medium">{TILE_LABELS[key].title}</span>
          <span className="block text-sm text-muted-foreground">{TILE_LABELS[key].hint}</span>
        </button>)}
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Gruppen">
        {GROUPS.filter(g => g === 'all' || groups[g] > 0 || g === group).map(g => <Button key={g} size="sm" variant={group === g ? 'default' : 'outline'} onClick={() => setGroup(g)}>
          {g === 'all' ? 'Alle' : GROUP_LABELS[g]} <span className="ml-1.5 tabular-nums opacity-70">{groups[g]}</span>
        </Button>)}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={hideTests} onCheckedChange={v => { setHideTests(v); writePref(v); }}/>Tests ausblenden</label>
        <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => void load()} aria-label="Aktualisieren"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}/></Button>
      </div>
    </div>
    {tile && <p className="text-sm text-muted-foreground">Gefiltert nach „{TILE_LABELS[tile].title}“. <button type="button" className="underline" onClick={() => setTile(null)}>Filter aufheben</button></p>}

    <section className="overflow-hidden rounded-xl border">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(150px,auto)] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground md:grid">
        <span>Partner</span><span>Phase</span><span>Letztes Signal</span><span className="text-right">Nächster Schritt</span>
      </div>
      {loading ? <div className="space-y-3 p-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full"/>)}</div>
        : !visible.length ? <p className="p-6 text-center text-sm text-muted-foreground">{search || tile ? 'Keine Partner in dieser Auswahl.' : 'Noch keine Partner. Lade den ersten ein.'}</p>
        : <ul className="divide-y">{visible.map(p => {
          const actionable = ACTIONABLE.includes(p.next.kind);
          return <li key={p.key}>
            <div role="button" tabIndex={0} aria-label={`${p.name}, ${PHASE_LABELS[p.phase]}: Akte öffnen`} onClick={() => openPartner(p)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPartner(p); } }}
              className="grid cursor-pointer grid-cols-1 gap-2 px-4 py-3 outline-none transition hover:bg-muted/40 focus-visible:bg-muted/60 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(150px,auto)] md:items-center md:gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="truncate font-medium">{p.name}</span>{p.isTest && <Badge variant="outline" className="shrink-0">Test</Badge>}</div>
                <p className="truncate text-sm text-muted-foreground">{p.company || p.email}</p>
              </div>
              <div className="flex items-center gap-2 text-sm"><Dots step={p.step}/><span>{PHASE_LABELS[p.phase]}</span></div>
              <div className="min-w-0 text-sm"><p className="truncate">{p.signal.text}</p><p className="text-muted-foreground">{relativeTime(p.signal.at)}</p></div>
              <div className="md:text-right">{actionable
                ? <Button size="sm" variant={URGENT.includes(p.next.kind) ? 'default' : 'outline'} onClick={e => { e.stopPropagation(); act(p); }}>{p.next.label}</Button>
                : <span className="text-sm text-muted-foreground">{p.group === 'active' ? performance(p) : p.next.label}</span>}</div>
            </div>
          </li>;
        })}</ul>}
    </section>

    <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
      <p><strong>Konditionen einheitlich</strong> · Rahmenvertrag Fassung 2.1 · Recruiter erhalten in jedem Paket 15 Punkte vom Bruttojahreszielgehalt</p>
      <div className="flex flex-wrap items-center gap-2">
        {legacyFees.length > 0 && <span className="text-amber-600 dark:text-amber-400">{legacyFees.length} Altwerte ohne Wirkung</span>}
        <Button size="sm" variant="outline" onClick={() => setConditionsOpen(true)}>Anlage 2 ansehen</Button>
      </div>
    </footer>

    <PartnerDrawer partner={selectedPartner} open={!!selectedPartner} tab={drawerTab} docusignEnabled={docusign.enabled}
      onTabChange={setDrawerTab} onOpenChange={open => { if (!open) setSelected(null); }} onChanged={() => void load()}
      onStartContract={prefill => { setSelected(null); setInvite({ open: true, prefill }); }}/>
    <InviteSheet open={invite.open} prefill={invite.prefill} onOpenChange={open => setInvite(v => ({ ...v, open }))} onChanged={() => void load()}/>
    <ConditionsDialog open={conditionsOpen} legacy={legacyFees} onOpenChange={setConditionsOpen} onChanged={() => void load()}/>
  </div>;
}
