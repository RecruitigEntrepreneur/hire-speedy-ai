import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
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
  MessageSquare,
  CreditCard,
  Shield,
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
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from './NotificationBell';
import { HonorarSchalter } from '@/components/recruiter/Honorar';
import { GlobalSearch } from './GlobalSearch';
import { useDashboardKeyboardShortcuts } from '@/hooks/useDashboardKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/dashboard/KeyboardShortcutsHelp';
import { useNewFeedbackCount } from '@/hooks/useAdminFeedback';
import { useClientTasks } from '@/lib/clientTasksApi';
import { useClientInvoices } from '@/lib/billingApi';

interface DashboardLayoutProps {
  children: ReactNode;
  /** Volle Breite statt zentriertem `container` (z. B. fürs Bento-Dashboard). */
  fluid?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  /** Zähler rechts neben dem Eintrag, z. B. neues Feedback. */
  badge?: number;
}

export function DashboardLayout({ children, fluid = false }: DashboardLayoutProps) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  
  // Initialize keyboard shortcuts
  const { shortcuts } = useDashboardKeyboardShortcuts(() => setShortcutsHelpOpen(true));
  const { data: newFeedback = 0 } = useNewFeedbackCount(role === 'admin');
  const clientTasks = useClientTasks();
  const clientInvoices = useClientInvoices();

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

  const clientNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    // Kunden-Aufgaben (23.10.2026): Zahl bleibt, bis alles erledigt ist
    { label: 'Aufgaben', href: '/dashboard/aufgaben', icon: <CheckSquare className="h-4 w-4" />, badge: clientTasks.data?.counts.total ?? 0 },
    { label: 'Meine Jobs', href: '/dashboard/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Bewerber', href: '/dashboard/candidates', icon: <Users className="h-4 w-4" /> },
    { label: 'Interviews', href: '/dashboard/interviews', icon: <Calendar className="h-4 w-4" /> },
    // Besetzungen (Etappe 2, 25.10.2026): ersetzt „Angebote“ und „Placements“
    { label: 'Besetzungen', href: '/dashboard/besetzungen', icon: <UserCheck className="h-4 w-4" /> },
    // Rechnungen (Etappe 3): eigener Bereich, nur wer Rechnungen sehen darf; Zahl = offene Belege
    ...(clientInvoices.data?.canSee ? [{ label: 'Rechnungen', href: '/dashboard/rechnungen', icon: <Receipt className="h-4 w-4" />, badge: clientInvoices.data.totals.openCount }] : []),
    { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Team', href: '/dashboard/team', icon: <UsersRound className="h-4 w-4" /> },
    { label: 'Nachrichten', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
  ];

  const recruiterNavItems: NavItem[] = [
    { label: 'Übersicht', href: '/recruiter', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Aufgaben', href: '/recruiter/influence', icon: <CheckSquare className="h-4 w-4" /> },
    { label: 'Interviews', href: '/recruiter/interviews', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Offene Jobs', href: '/recruiter/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Meine Kandidaten', href: '/recruiter/candidates', icon: <Users className="h-4 w-4" /> },
    { label: 'Pipeline', href: '/recruiter/submissions', icon: <FileText className="h-4 w-4" /> },
    { label: 'Talent Pool', href: '/recruiter/talent-pool', icon: <Database className="h-4 w-4" /> },
    { label: 'Matchunt Liga', href: '/recruiter/liga', icon: <Trophy className="h-4 w-4" /> },
    { label: 'Verdienste', href: '/recruiter/earnings', icon: <DollarSign className="h-4 w-4" /> },
    { label: 'Auszahlungen', href: '/recruiter/payouts', icon: <Wallet className="h-4 w-4" /> },
    { label: 'Benachrichtigungen', href: '/recruiter/notifications', icon: <Activity className="h-4 w-4" /> },
    { label: 'Nachrichten', href: '/recruiter/messages', icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Profil', href: '/recruiter/profile', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Datenschutz', href: '/recruiter/privacy', icon: <Shield className="h-4 w-4" /> },
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
    { label: 'Deal Health', href: '/admin/deal-health', icon: <Activity className="h-4 w-4" /> },
    { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Matching Config', href: '/admin/matching-config', icon: <Target className="h-4 w-4" /> },
    { label: 'Domains', href: '/admin/domains', icon: <Database className="h-4 w-4" /> },
    { label: 'Skill Synonyme', href: '/admin/skill-synonyms', icon: <Activity className="h-4 w-4" /> },
    { label: 'Activity', href: '/admin/activity', icon: <Activity className="h-4 w-4" /> },
    { label: 'Fraud', href: '/admin/fraud', icon: <AlertTriangle className="h-4 w-4" /> },
    { label: 'Auszahlungen', href: '/admin/payouts', icon: <Wallet className="h-4 w-4" /> },
    { label: 'Outreach', href: '/admin/outreach', icon: <Mail className="h-4 w-4" /> },
  ];

  // Solange die Rolle lädt, kein Menü raten: sonst blitzt beim Headhunter das Kunden-Menü auf (Live-Test 23.10.2026)
  const navItems = role === 'admin'
    ? adminNavItems
    : role === 'recruiter'
    ? recruiterNavItems
    : role === 'client'
    ? clientNavItems
    : [];

  const settingsHref = role === 'admin' ? '/admin/settings' : role === 'client' ? '/dashboard/settings' : '/recruiter/settings';

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
          <div className="flex items-center gap-3">
            <GlobalSearch />
            {/* Honorar ausblenden (21.10.2026): nur für Headhunter, gemerkt auf diesem Gerät. */}
            {role === 'recruiter' && <HonorarSchalter />}
            <NotificationBell />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={settingsHref} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Einstellungen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
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
                const isActive = location.pathname === item.href || 
                  (item.href !== '/dashboard' && item.href !== '/recruiter' && item.href !== '/admin' && location.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    data-tour={`nav:${item.href}`}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.icon}
                    {item.label}
                    {!!item.badge && (
                      <span
                        className={cn(
                          'ml-auto rounded-full px-1.5 text-[11px] font-medium leading-5',
                          isActive ? 'bg-primary-foreground text-primary' : 'bg-destructive text-destructive-foreground',
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

            <div className="border-t border-border pt-4 space-y-1">
              <Link
                to={settingsHref}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  location.pathname === settingsHref
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Settings className="h-4 w-4" />
                Einstellungen
              </Link>
              <div className="flex items-center gap-3 px-3 py-1">
                <ThemeToggle />
                <span className="text-xs text-muted-foreground">Theme</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content. min-w-0 ist Pflicht: als Flex-Kind haette main
            min-width:auto und wuerde von breitem Inhalt (z.B. dem Kanban mit
            min-w-max) auf dessen Breite aufgeblaeht — dann sprengt die Seite
            den Viewport und innere overflow-x-auto-Container koennen nicht
            mehr scrollen. */}
        <main className="min-w-0 flex-1 md:ml-64">
          <div className={cn(fluid ? 'w-full px-4 md:px-6' : 'container', 'py-6')}>
            {children}
          </div>
        </main>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp 
        open={shortcutsHelpOpen} 
        onOpenChange={setShortcutsHelpOpen}
        shortcuts={shortcuts}
      />
    </div>
  );
}