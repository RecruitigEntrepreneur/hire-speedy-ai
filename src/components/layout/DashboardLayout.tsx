import i18n from '@/i18n';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LebenslaufAblageLeiste } from '@/components/candidates/LebenslaufAblageLeiste';
import { LigaSeitenleiste } from '@/components/recruiter/liga/LigaSeitenleiste';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Settings,
  ChevronRight,
  Building2,
  UserCheck,
  Activity,
  CreditCard,
  Wallet,
  Target,
  CheckSquare,
  Receipt,
  BarChart3,
  UsersRound,
  AlertTriangle,
  Database,
  LogOut,
  User,
  Mail,
  Keyboard,
  GraduationCap,
  Inbox,
  Link2,
  MessageSquareWarning,
  Trophy,
  Handshake,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { useLanguageState } from '@/i18n';
import { languageDef } from '@/i18n/languages';
import { Flag } from '@/components/language/Flag';
import { LanguageItems } from '@/components/language/LanguageMenu';
import { NotificationBell } from './NotificationBell';
import { PosteingangKnopf } from './PosteingangKnopf';
import { ansichtAnwenden } from '@/lib/ansicht';
import { HonorarSchalter } from '@/components/recruiter/Honorar';
import { GlobalSearch } from './GlobalSearch';
import { HandyLeiste } from './HandyLeiste';
import { istAktiv } from '@/lib/navAktiv';
import { useFeedbackEnabled } from '@/lib/feedback/api';
import { useDashboardKeyboardShortcuts } from '@/hooks/useDashboardKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/dashboard/KeyboardShortcutsHelp';
import { useNewFeedbackCount } from '@/hooks/useAdminFeedback';
import { useClientTasks } from '@/lib/clientTasksApi';
import { useClientInvoices } from '@/lib/billingApi';
import { useClientWaiting } from '@/hooks/useClientWaiting';

/**
 * Streifen über dem Seiteninhalt, etwa „Beispiel an Ihrer Stelle · nichts wird gespeichert“
 * auf der Beispiel-Bühne des Kunden-Rundgangs, die echte Seiten mit Beispieldaten zeigt.
 */
export const LayoutBannerContext = createContext<ReactNode>(null);

interface DashboardLayoutProps {
  children: ReactNode;
  /** Volle Breite statt zentriertem `container` (z. B. fürs Bento-Dashboard). */
  fluid?: boolean;
  /** Markierter Menüpunkt, wenn er nicht aus der Adresse folgt (Beispiel-Bühne des Kunden-Rundgangs). */
  activeHref?: string;
}

interface NavItem {
  label: string;
  /** Kurzfassung für die Handy-Leiste unten. */
  kurz?: string;
  href: string;
  icon: ReactNode;
  /** Zähler rechts neben dem Eintrag, z. B. neues Feedback. */
  badge?: number;
}

export function DashboardLayout({ children, fluid = false, activeHref }: DashboardLayoutProps) {
  const banner = useContext(LayoutBannerContext);
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  // Handy: Sprache im Profilmenü eingeklappt, ein Tipp klappt die Liste auf (16.11.2026)
  const [spracheOffen, setSpracheOffen] = useState(false);
  // Schriftgröße und „weniger Bewegung“ aus Einstellungen › Darstellung (16.11.2026)
  useEffect(() => { ansichtAnwenden(); }, []);
  
  // Initialize keyboard shortcuts
  const { shortcuts } = useDashboardKeyboardShortcuts(() => setShortcutsHelpOpen(true));
  const { data: newFeedback = 0 } = useNewFeedbackCount(role === 'admin');
  const clientTasks = useClientTasks();
  const clientInvoices = useClientInvoices();
  const clientWaiting = useClientWaiting().waiting;

  // Konto-Menü: Name statt nur E-Mail, Kürzel im runden Knopf (22.11.2026)
  const kontoName = String((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '').trim();
  const kontoKuerzel = kontoName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getDashboardHome = () => {
    switch (role) {
      case 'admin':
        return '/admin';
      case 'recruiter':
        return '/recruiter';
      case 'client':
      default:
        return '/dashboard';
    }
  };

  // Menü des Kunden in der Sprache der Oberfläche (clientNav); Admin-Menü bleibt deutsch.
  const { t: tClient } = useTranslation('clientNav');
  const clientNavItems: NavItem[] = [
    { label: tClient('items.dashboard'), kurz: tClient('short.dashboard'), href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    // Kunden-Aufgaben (23.10.2026): Zahl bleibt, bis alles erledigt ist
    { label: tClient('items.tasks'), href: '/dashboard/aufgaben', icon: <CheckSquare className="h-4 w-4" />, badge: clientTasks.data?.counts.total ?? 0 },
    { label: tClient('items.jobs'), kurz: tClient('short.jobs'), href: '/dashboard/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: tClient('items.candidates'), href: '/dashboard/candidates', icon: <Users className="h-4 w-4" /> },
    { label: tClient('items.interviews'), href: '/dashboard/interviews', icon: <Calendar className="h-4 w-4" /> },
    // Besetzungen (Etappe 2, 25.10.2026): ersetzt „Angebote“ und „Placements“
    { label: tClient('items.placements'), href: '/dashboard/besetzungen', icon: <UserCheck className="h-4 w-4" /> },
    // Rechnungen (Etappe 3): eigener Bereich, nur wer Rechnungen sehen darf; Zahl = offene Belege
    ...(clientInvoices.data?.canSee ? [{ label: tClient('items.invoices'), href: '/dashboard/rechnungen', icon: <Receipt className="h-4 w-4" />, badge: clientInvoices.data.totals.openCount }] : []),
    { label: tClient('items.analytics'), href: '/dashboard/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: tClient('items.team'), href: '/dashboard/team', icon: <UsersRound className="h-4 w-4" /> },
    // Nachrichten (15.11.2026): als Sprechblase oben neben der Glocke, kein Menüpunkt mehr
  ];

  // Menü des Headhunters in der Sprache der Oberfläche.
  const { t: tNav } = useTranslation('recruiterNav');
  const isRecruiter = role === 'recruiter';
  const recruiterNavItems: NavItem[] = [
    { label: tNav('items.overview'), href: '/recruiter', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: tNav('items.tasks'), href: '/recruiter/influence', icon: <CheckSquare className="h-4 w-4" /> },
    { label: tNav('items.interviews'), href: '/recruiter/interviews', icon: <Calendar className="h-4 w-4" /> },
    { label: tNav('items.jobs'), kurz: tNav('short.jobs'), href: '/recruiter/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: tNav('items.candidates'), kurz: tNav('short.candidates'), href: '/recruiter/candidates', icon: <Users className="h-4 w-4" /> },
    { label: tNav('items.pipeline'), href: '/recruiter/submissions', icon: <FileText className="h-4 w-4" /> },
    { label: tNav('items.analytics'), href: '/recruiter/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    // Talent Pool lebt seit 25.11.2026 als Reiter in „Meine Kandidaten“; die alte Seite bleibt per Adresse erreichbar
    // Matchunt Liga (16.11.2026): kein Menüpunkt mehr, sondern das Kärtchen unten über den Einstellungen
    { label: tNav('items.earnings'), href: '/recruiter/earnings', icon: <DollarSign className="h-4 w-4" /> },
    // 15.11.2026: Benachrichtigungen nur noch über „Alle ansehen“ in der Glocke, Nachrichten als
    // Sprechblase oben (Posteingang), Datenschutz in den Einstellungen.
    { label: tNav('items.profile'), href: '/recruiter/profile', icon: <UserCheck className="h-4 w-4" /> },
  ];

  const adminNavItems: NavItem[] = [
    { label: 'Übersicht', href: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Benutzer', href: '/admin/users', icon: <UsersRound className="h-4 w-4" /> },
    { label: 'Kunden', href: '/admin/clients', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Recruiter', href: '/admin/recruiters', icon: <Users className="h-4 w-4" /> },
    { label: 'Matchunt Liga', href: '/admin/liga', icon: <Trophy className="h-4 w-4" /> },
    { label: 'Akademie', href: '/admin/academy', icon: <GraduationCap className="h-4 w-4" /> },
    { label: 'Alle Jobs', href: '/admin/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Jobaufnahmen', href: '/admin/intakes', icon: <Inbox className="h-4 w-4" /> },
    { label: 'Aufnahme-Links', href: '/admin/intake-links', icon: <Link2 className="h-4 w-4" /> },
    { label: 'Feedback', href: '/admin/feedback', icon: <MessageSquareWarning className="h-4 w-4" />, badge: newFeedback },
    { label: 'Kandidaten', href: '/admin/candidates', icon: <FileText className="h-4 w-4" /> },
    { label: 'Interviews', href: '/admin/interviews', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Besetzungen', href: '/admin/besetzungen', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Unterschriften', href: '/admin/vertraege', icon: <FileText className="h-4 w-4" /> },
    // Pakete & Konditionen (A10, Umbau 11.11.2026): Fassungen, Stichtag, Zustimmungen
    { label: 'Pakete & Konditionen', href: '/admin/pakete', icon: <Wallet className="h-4 w-4" /> },
    // Faire Zusammenarbeit (F1): Kunden mit Signalen, Stufen 1–5
    { label: 'Zusammenarbeit', href: '/admin/zusammenarbeit', icon: <Handshake className="h-4 w-4" /> },
    { label: 'Deal Health', href: '/admin/deal-health', icon: <Activity className="h-4 w-4" /> },
    { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Matching Config', href: '/admin/matching-config', icon: <Target className="h-4 w-4" /> },
    { label: 'Domains', href: '/admin/domains', icon: <Database className="h-4 w-4" /> },
    { label: 'Skill Synonyme', href: '/admin/skill-synonyms', icon: <Activity className="h-4 w-4" /> },
    { label: 'Activity', href: '/admin/activity', icon: <Activity className="h-4 w-4" /> },
    { label: 'Fraud', href: '/admin/fraud', icon: <AlertTriangle className="h-4 w-4" /> },
    { label: 'Outreach', href: '/admin/outreach', icon: <Mail className="h-4 w-4" /> },
  ];

  // Rolle Buchhaltung (Etappe 4, 25.10.2026): nur Rechnungen und Einstellungen
  const financeOnly = role === 'client' && !!clientInvoices.data?.financeOnly;

  // Solange die Rolle lädt, kein Menü raten: sonst blitzt beim Headhunter das Kunden-Menü auf (Live-Test 23.10.2026)
  const navItems = role === 'admin'
    ? adminNavItems
    : role === 'recruiter'
    ? recruiterNavItems
    : role === 'client'
    ? (financeOnly ? clientNavItems.filter((i) => i.href === '/dashboard/rechnungen') : clientNavItems)
    : [];

  // Handy (16.11.2026, Variante A): vier Wege unten, der Rest unter „Mehr“.
  // Headhunter: Übersicht, Aufgaben, Kandidaten, Jobs. Kunde: Dashboard, Aufgaben, Jobs, Bewerber.
  const handyHauptHrefs = role === 'recruiter'
    ? ['/recruiter', '/recruiter/influence', '/recruiter/candidates', '/recruiter/jobs']
    : role === 'client'
    ? ['/dashboard', '/dashboard/aufgaben', '/dashboard/jobs', '/dashboard/candidates']
    : navItems.slice(0, 4).map((i) => i.href);
  const handyGesucht = handyHauptHrefs.map((h) => navItems.find((i) => i.href === h)).filter((i): i is NavItem => !!i);
  // Buchhaltung sieht nur „Rechnungen“: dann steht das unten statt der vier Wege.
  const handyHaupt = handyGesucht.length ? handyGesucht : navItems.slice(0, 4);
  const handyMehr = navItems.filter((i) => !handyHaupt.includes(i));
  // Wartezustand des Kunden: dasselbe Schloss wie in der Seitenleiste
  const mitSchloss = (i: NavItem) => ({ ...i, gesperrt: clientWaiting && i.href !== '/dashboard' });
  const { data: feedbackAn = false } = useFeedbackEnabled();

  const { t: tCommon } = useTranslation('common');
  const isClient = role === 'client';
  const { language } = useLanguageState();
  const settingsHref = role === 'admin' ? '/admin/settings' : role === 'client' ? '/dashboard/settings' : '/recruiter/settings';

  // Buchhaltung landet auf jeder anderen Kundenseite bei „Rechnungen“ (Daten gibt ihr der Server ohnehin nicht)
  if (financeOnly && location.pathname.startsWith('/dashboard') && !['/dashboard/rechnungen', '/dashboard/settings'].some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/dashboard/rechnungen" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <Link to={getDashboardHome()} className="flex items-center group">
            <MatchuntWordmark size="md" />
          </Link>

          {/* Search */}
          <div className="flex items-center gap-1 sm:gap-3">
            <GlobalSearch />
            {/* Hell/Dunkel (15.11.2026): oben neben dem Auge statt unten in der Seitenleiste.
                Am Handy nicht, sonst fällt das Profilmenü aus dem Bild; dort über Einstellungen › Darstellung. */}
            <div className="hidden sm:block"><ThemeToggle /></div>
            {/* Honorar ausblenden (21.10.2026): nur für Headhunter, gemerkt auf diesem Gerät. */}
            {role === 'recruiter' && <HonorarSchalter />}
            {/* Ziel des Kunden-Rundgangs (lib/clientGuide.ts): Nachrichten und Glocke gemeinsam. */}
            <div data-tour="header.notify" className="flex items-center gap-1 sm:gap-3">
              {(role === 'recruiter' || role === 'client') && <PosteingangKnopf href={role === 'recruiter' ? '/recruiter/messages' : '/dashboard/messages'} />}
              <NotificationBell />
            </div>
            
            <DropdownMenu onOpenChange={(o) => { if (!o) setSpracheOffen(false); }}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full text-xs font-medium" aria-label={kontoName || user?.email || undefined}>
                  {kontoKuerzel || <User className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{kontoName || user?.email}</p>
                  {kontoName && <p className="truncate text-xs text-muted-foreground">{user?.email}</p>}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={settingsHref} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    {isRecruiter ? tNav('settings') : isClient ? tClient('settings') : 'Einstellungen'}
                  </Link>
                </DropdownMenuItem>
                {/* Sprache: am Computer als Untermenü; am Handy einklappbar im selben Menü, weil das
                    Untermenü dort links aus dem Bild ragte (16.11.2026). */}
                <div className="hidden md:block">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer" data-testid="account-language">
                      <Flag code={languageDef(language).flag} className="mr-2" />
                      <span className="flex-1">{tCommon('language.label')}</span>
                      <span className="text-xs text-muted-foreground">{languageDef(language).label}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-[13rem]"><LanguageItems /></DropdownMenuSubContent>
                  </DropdownMenuSub>
                </div>
                <div className="md:hidden">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    aria-expanded={spracheOffen}
                    onSelect={(e) => { e.preventDefault(); setSpracheOffen((v) => !v); }}
                  >
                    <Flag code={languageDef(language).flag} className="mr-2" />
                    <span className="flex-1">{tCommon('language.label')}</span>
                    <span className="text-xs text-muted-foreground">{languageDef(language).label}</span>
                    <ChevronRight className={cn('ml-1 h-4 w-4 text-muted-foreground transition-transform', spracheOffen && 'rotate-90')} aria-hidden />
                  </DropdownMenuItem>
                  {spracheOffen && <div className="ml-3 border-l border-border pl-1"><LanguageItems /></div>}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  {isRecruiter ? tNav('signOut') : isClient ? tClient('signOut') : 'Abmelden'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 border-r border-border/40 bg-card md:block">
          <div className="flex h-full flex-col gap-2 p-4">
            <nav className="flex-1 space-y-1">
              {!role && [72, 56, 80, 64, 60, 48].map((w, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2" aria-hidden="true">
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
                </div>
              ))}
              {navItems.map((item) => {
                const isActive = activeHref ? item.href === activeHref : istAktiv(location.pathname, item.href);
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    data-tour={`nav:${item.href}`}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-secondary font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.icon}
                    {item.label}
                    {/* Bleibt ein Link: Der Rundgang führt im Wartezustand hindurch, sonst erklärt die Seite die Sperre. */}
                    {clientWaiting && item.href !== '/dashboard' && <Lock className="ml-auto h-3.5 w-3.5 opacity-60" aria-label={i18n.t('clientDashboard:waiting.lockedTitle')} />}
                    {!!item.badge && (
                      <span
                        className={cn(
                          'ml-auto rounded-full px-1.5 text-[11px] font-medium leading-5',
                          'bg-destructive text-destructive-foreground',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className={cn('h-4 w-4', !item.badge && 'ml-auto')} />}
                  </Link>
                );
              })}
            </nav>

            {isRecruiter && <LigaSeitenleiste />}

            <div className="border-t border-border pt-4 space-y-1">
              <Link
                to={settingsHref}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  location.pathname === settingsHref || (role === 'recruiter' && location.pathname === '/recruiter/integrations')
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Settings className="h-4 w-4" />
                {isRecruiter ? tNav('settings') : isClient ? tClient('settings') : 'Einstellungen'}
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content. min-w-0 ist Pflicht: als Flex-Kind haette main
            min-width:auto und wuerde von breitem Inhalt (z.B. dem Kanban mit
            min-w-max) auf dessen Breite aufgeblaeht — dann sprengt die Seite
            den Viewport und innere overflow-x-auto-Container koennen nicht
            mehr scrollen. */}
        {/* pb: am Handy Platz für die Leiste unten (--handy-leiste, index.css) */}
        <main className="min-w-0 flex-1 pb-[var(--handy-leiste,0px)] md:ml-64 md:pb-0">
          <div className={cn(fluid ? 'w-full px-4 md:px-6' : 'container', 'py-6')}>
            {banner}
            {children}
          </div>
        </main>
        {/* Lebenslauf-Ablage (09.11.2026): bleibt beim Seitenwechsel stehen */}
        {role === 'recruiter' && <LebenslaufAblageLeiste />}
      </div>

      {role && (
        <HandyLeiste
          haupt={handyHaupt.map(mitSchloss)}
          mehr={handyMehr.map(mitSchloss)}
          einstellungen={{
            label: isRecruiter ? tNav('settings') : isClient ? tClient('settings') : 'Einstellungen',
            href: settingsHref,
            aktiv: location.pathname === settingsHref || (role === 'recruiter' && location.pathname === '/recruiter/integrations'),
          }}
          zusatz={isRecruiter ? <LigaSeitenleiste /> : undefined}
          feedback={feedbackAn || role === 'admin'}
          aktivHref={activeHref}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp 
        open={shortcutsHelpOpen} 
        onOpenChange={setShortcutsHelpOpen}
        shortcuts={shortcuts}
      />
    </div>
  );
}