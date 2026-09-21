import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowRight, Briefcase, Calendar, CheckSquare, Compass, Database, DollarSign, FileText, LayoutDashboard, Lock, MessageSquare, Moon, Plus, Shield, Sun, User, UserCheck, Users, Wallet } from 'lucide-react';
import { RecruiterGuideProvider, useRecruiterGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { JobActionCard } from '@/components/recruiter/JobActionCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { GUIDE_STATE_KEY } from '@/lib/recruiterGuide';
import { cn } from '@/lib/utils';
import '@/index.css';

// Separate Vite-Entwicklungsseite für den begleiteten Rundgang. Sie meldet niemanden
// an und lädt keine Daten: Seiten, Menü und Anker sind mit Beispieldaten nachgebaut,
// die Jobkarte ist die echte. Der Rundgang selbst ist der echte.
//   /__preview/recruiter-tour.html            startet frisch
//   /__preview/recruiter-tour.html?resume     setzt den gespeicherten Stand fort
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');
if (!new URLSearchParams(location.search).has('resume')) { try { sessionStorage.removeItem(GUIDE_STATE_KEY); } catch { /* egal */ } }

const NAV = [
  { label: 'Übersicht', href: '/recruiter', icon: LayoutDashboard }, { label: 'Aufgaben', href: '/recruiter/influence', icon: CheckSquare },
  { label: 'Interviews', href: '/recruiter/interviews', icon: Calendar }, { label: 'Offene Jobs', href: '/recruiter/jobs', icon: Briefcase },
  { label: 'Meine Kandidaten', href: '/recruiter/candidates', icon: Users }, { label: 'Pipeline', href: '/recruiter/submissions', icon: FileText },
  { label: 'Talent Pool', href: '/recruiter/talent-pool', icon: Database }, { label: 'Verdienste', href: '/recruiter/earnings', icon: DollarSign },
  { label: 'Auszahlungen', href: '/recruiter/payouts', icon: Wallet }, { label: 'Benachrichtigungen', href: '/recruiter/notifications', icon: Activity },
  { label: 'Nachrichten', href: '/recruiter/messages', icon: MessageSquare }, { label: 'Profil', href: '/recruiter/profile', icon: UserCheck },
  { label: 'Datenschutz', href: '/recruiter/privacy', icon: Shield },
];

const JOBS = [
  { id: 'job-controller', title: 'Senior Controller (m/w/d)', location: 'München', remote_type: 'hybrid', salary_min: 75000, salary_max: 90000, recruiter_fee_percentage: 15, skills: ['HGB', 'SAP', 'Konzernabschluss', 'Power BI'], hiring_urgency: 'urgent', industry: 'Industrie', company_size_band: '250–500 MA', funding_stage: null, tech_environment: null, company_name: '', updated_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'job-sales', title: 'Key Account Manager DACH (m/w/d)', location: 'Stuttgart', remote_type: 'remote', salary_min: 70000, salary_max: 85000, recruiter_fee_percentage: 18, skills: ['B2B', 'Maschinenbau', 'CRM'], hiring_urgency: null, industry: 'Maschinenbau', company_size_band: '500–1000 MA', funding_stage: null, tech_environment: null, company_name: '', updated_at: new Date(Date.now() - 5 * 86400000).toISOString() },
];
const earningOf = (job: typeof JOBS[number]) => Math.round(((job.salary_min + job.salary_max) / 2) * job.recruiter_fee_percentage / 100);

function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p></div>{action}</div>
    {children}
  </div>;
}
const Empty = ({ icon: Icon, title, text }: { icon: typeof User; title: string; text: string }) =>
  <Card><CardContent className="py-12 text-center"><Icon className="mx-auto h-10 w-10 text-muted-foreground/40" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p></CardContent></Card>;

function Dashboard() {
  const guide = useRecruiterGuide();
  useEffect(() => { guide.offer(); }, [guide]);
  return <div className="max-w-5xl space-y-5">
    <Card data-tour="dashboard.header"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight">Guten Tag, Danny</h1><p className="mt-1 text-sm text-muted-foreground">Schön, dass du da bist. Such dir eine passende Position und stell deinen ersten Kandidaten vor.</p></div>
      <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={guide.start}><Compass className="mr-1.5 h-3.5 w-3.5" />Rundgang</Button><Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />Kandidaten anlegen</Button></div>
    </CardContent></Card>
    <div className="grid gap-5 md:grid-cols-2">
      <Card><CardContent className="p-5"><h2 className="font-semibold">Aufgaben</h2><div className="py-8 text-center"><Briefcase className="mx-auto mb-2 h-9 w-9 text-muted-foreground/40" /><p className="text-sm font-medium">Noch keine Aufgaben</p><p className="text-xs text-muted-foreground">Sie entstehen, sobald du Kandidaten vorstellst.</p></div></CardContent></Card>
      <Card><CardContent className="p-5"><h2 className="font-semibold">Pipeline</h2>{['Eingereicht', 'In Prüfung', 'Interview', 'Angebot'].map(s => <div key={s} className="mt-3 flex items-center justify-between text-sm"><span>{s}</span><span className="text-muted-foreground">0</span></div>)}</CardContent></Card>
      <Card data-tour="dashboard.topJobs"><CardContent className="p-5"><h2 className="font-semibold">Top Jobs</h2>{JOBS.map(job => <div key={job.id} className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="truncate">{job.title}</span><span className="shrink-0 font-medium">€{earningOf(job).toLocaleString('de-DE')}</span></div>)}</CardContent></Card>
      <Card><CardContent className="p-5"><h2 className="font-semibold">Übersicht</h2><p className="mt-3 text-sm text-muted-foreground">{JOBS.length} offene Jobs · 0 Kandidaten</p></CardContent></Card>
    </div>
  </div>;
}

function Jobs() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const job = JOBS.find(j => j.id === selected);
  return <Page title="Offene Jobs" subtitle="Finde deinen nächsten Top-Kandidaten">
    <div className="space-y-2 border-b border-border/30 pb-3" data-tour="jobs.filters">
      <div className="flex flex-wrap gap-2">{['Suche…', 'Remote', 'Level', 'Branche', 'Neueste zuerst'].map(f => <span key={f} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">{f}</span>)}</div>
      <div className="flex gap-1.5">{['Alle', 'Dringend', 'Neu', 'Top', 'Enthüllt'].map((t, i) => <span key={t} className={cn('rounded-md px-3 py-1 text-xs', i === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t}</span>)}</div>
    </div>
    <div className="flex gap-4">
      <div className={cn('space-y-2', job ? 'w-full lg:w-1/2' : 'w-full')}>
        {JOBS.map((j, index) => <JobActionCard key={j.id} job={j} earning={earningOf(j)} isRevealed={false} isSelected={selected === j.id} tourId={index === 0 ? 'jobs.firstCard' : undefined}
          isActive={false} recruiterCount={index === 0 ? 2 : 0} submittedCount={index === 0 ? 1 : 0}
          onSelect={() => (selected === j.id ? navigate(`/recruiter/jobs/${j.id}`) : setSelected(j.id))} onToggleActive={e => e.stopPropagation()} />)}
      </div>
      {job && <div className="hidden w-1/2 lg:block" data-tour="jobs.preview"><Card className="h-full"><CardContent className="space-y-3 p-5">
        <h2 className="font-semibold">{job.title}</h2><p className="flex items-center gap-1 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" />{job.industry} · {job.company_size_band}</p>
        <p className="text-sm">Muss: {job.skills.slice(0, 3).join(', ')}</p><Button size="sm" disabled><Lock className="mr-1.5 h-3.5 w-3.5" />Kandidat vorschlagen</Button>
      </CardContent></Card></div>}
    </div>
  </Page>;
}

function JobBriefing() {
  const { id } = useParams();
  const job = JOBS.find(j => j.id === id) ?? JOBS[0];
  return <div data-tour-scope="job" className="contents"><div className="space-y-6">
    <Link to="/recruiter/jobs" className="text-sm text-muted-foreground">← Alle offenen Jobs</Link>
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header className="space-y-2"><p className="text-xs uppercase tracking-widest text-muted-foreground">Dein Mandatsbriefing</p><h1 className="text-2xl font-bold">{job.title}</h1><p className="text-sm text-muted-foreground">{job.location} · {job.remote_type} · {job.salary_min.toLocaleString('de-DE')}–{job.salary_max.toLocaleString('de-DE')} €</p></header>
        <Tabs defaultValue="briefing"><TabsList><TabsTrigger value="briefing">Briefing</TabsTrigger><TabsTrigger value="kandidaten">Meine Kandidaten (0)</TabsTrigger><TabsTrigger value="anzeige">Aus der Anzeige</TabsTrigger></TabsList></Tabs>
        {['Suchprofil', 'Aufgabe', 'Angebot', 'Unternehmen', 'Prozess'].map(s => <div key={s} className="rounded-lg border border-border p-4 text-sm font-medium">{s}</div>)}
      </div>
      <aside aria-label="Aktionen zum Mandat"><Card><CardContent className="space-y-3 p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Dein nächster Schritt</p><p className="font-medium">Die passende Person vorstellen</p><Button className="w-full"><Plus className="mr-1.5 h-4 w-4" />Vorstellung vorbereiten</Button></CardContent></Card></aside>
    </div>
  </div></div>;
}

const Candidates = () => <Page title="Meine Kandidaten" subtitle="Deine Kandidaten an einem Ort" action={<Button data-tour="candidates.add"><Plus className="mr-2 h-4 w-4" />Kandidat hinzufügen</Button>}>
  <Empty icon={User} title="Noch keine Kandidaten" text="Leg deinen ersten an: von Hand, per Lebenslauf oder aus HubSpot. Beim Vorstellen wählst du ihn dann direkt aus dieser Liste." />
</Page>;

const Pipeline = () => <Page title="Meine Pipeline" subtitle="0 in Bearbeitung">
  <div data-tour="pipeline.overview"><Card><CardContent className="p-5"><h2 className="text-lg font-semibold">Übersicht</h2><p className="text-sm text-muted-foreground">0 laufend · offenes Honorar €0</p>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{['Eingereicht', 'In Prüfung', 'Interview angefragt', 'Opt-In erteilt', 'Termin steht'].map(s => <div key={s} className="rounded-md border border-border p-2 text-xs"><p className="text-muted-foreground">{s}</p><p className="text-lg font-semibold">0</p></div>)}</div>
  </CardContent></Card></div>
  <Card><CardContent className="py-12 text-center"><Briefcase className="mx-auto h-10 w-10 text-muted-foreground/40" /><h3 className="mt-3 text-lg font-semibold">Noch keine Vorstellungen</h3><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Sobald du einen Kandidaten für eine Position vorstellst, erscheint er hier und wandert durch die Phasen bis zur Vermittlung.</p><Button className="mt-5" asChild><Link to="/recruiter/jobs">Offene Jobs ansehen <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>
</Page>;

const Tasks = () => <Page title="Aufgaben" subtitle="Dein Arbeitsmodus — priorisiert nach Impact">
  <div className="flex flex-wrap gap-1.5">{['Alle (0)', 'Opt-In (0)', 'Follow-up (0)', 'Interview (0)'].map(f => <span key={f} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">{f}</span>)}</div>
  <div className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2" data-tour="tasks.list"><Empty icon={CheckSquare} title="Noch keine Aufgaben" text="Aufgaben entstehen, sobald Bewegung in deine Vorstellungen kommt, etwa wenn ein Kunde deinen Kandidaten kennenlernen will." /></div>
    <Card><CardContent className="p-5 text-sm text-muted-foreground">Keine anstehenden Interviews.</CardContent></Card></div>
</Page>;

const Interviews = () => <Page title="Interviews" subtitle="Alle Termine deiner Kandidaten — bestätigt, offen und nachzubereiten">
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-tour="interviews.stats">{['Heute', 'Diese Woche', 'Ohne Termin', 'Debrief fällig'].map(s => <Card key={s}><CardContent className="p-3.5"><p className="text-xs text-muted-foreground">{s}</p><p className="text-xl font-semibold">0</p></CardContent></Card>)}</div>
  <Empty icon={Calendar} title="Keine anstehenden Interviews" text="Reiche Kandidaten ein oder fasse offene Einreichungen nach." />
</Page>;

function Shell({ note }: { note: string }) {
  const location = useLocation();
  const [theme, setTheme] = useState('dark');
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/40 bg-card px-4 md:px-6">
      <MatchuntWordmark size="md" />
      <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Vorschau · Beispieldaten{note ? ` · ${note}` : ''}</span>
        <Button variant="ghost" size="icon" aria-label="Farbschema wechseln" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.classList.toggle('light', next === 'light'); }}>{theme === 'dark' ? <Sun /> : <Moon />}</Button>
      </div>
    </header>
    <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 border-r border-border/40 bg-card md:block">
      <nav className="space-y-1 p-4">{NAV.map(({ label, href, icon: Icon }) => {
        const active = location.pathname === href || (href !== '/recruiter' && location.pathname.startsWith(href));
        return <Link key={href} to={href} data-tour={`nav:${href}`} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}><Icon className="h-4 w-4" />{label}</Link>;
      })}</nav>
    </aside>
    <main className="min-w-0 px-4 py-6 md:ml-64 md:px-6">
      <Routes>
        <Route path="/recruiter" element={<Dashboard />} />
        <Route path="/recruiter/jobs" element={<Jobs />} />
        <Route path="/recruiter/jobs/:id" element={<JobBriefing />} />
        <Route path="/recruiter/candidates" element={<Candidates />} />
        <Route path="/recruiter/submissions" element={<Pipeline />} />
        <Route path="/recruiter/influence" element={<Tasks />} />
        <Route path="/recruiter/interviews" element={<Interviews />} />
        <Route path="*" element={<Page title="Andere Seite" subtitle="In der Vorschau nicht nachgebaut."><p className="text-sm text-muted-foreground">Der Rundgang pausiert hier.</p></Page>} />
      </Routes>
    </main>
  </div>;
}

export function Preview() {
  const [note, setNote] = useState('');
  return <MemoryRouter initialEntries={['/recruiter']}>
    <RecruiterGuideProvider identity={{ userId: 'preview-user', firstName: 'Danny' }} isSeen={() => false} onFinished={() => setNote('Rundgang beendet')}>
      <Shell note={note} />
    </RecruiterGuideProvider>
  </MemoryRouter>;
}

createRoot(document.getElementById('root')!).render(<TooltipProvider><Preview /></TooltipProvider>);
