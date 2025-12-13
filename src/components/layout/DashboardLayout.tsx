import { ReactNode } from 'react';
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
  Gift,
  BarChart3,
  UsersRound,
  AlertTriangle,
  Database,
  Plug,
  LogOut,
  User,
  Bell,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from './NotificationBell';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
    { label: 'Command Center', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Meine Jobs', href: '/dashboard/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Talent Hub', href: '/dashboard/talent', icon: <Users className="h-4 w-4" /> },
    { label: 'Angebote', href: '/dashboard/offers', icon: <Gift className="h-4 w-4" /> },
    { label: 'Placements', href: '/dashboard/placements', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Nachrichten', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
  ];

  const recruiterNavItems: NavItem[] = [
    { label: 'Übersicht', href: '/recruiter', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Influence', href: '/recruiter/influence', icon: <Target className="h-4 w-4" /> },
    { label: 'Offene Jobs', href: '/recruiter/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Meine Kandidaten', href: '/recruiter/candidates', icon: <Users className="h-4 w-4" /> },
    { label: 'Pipeline', href: '/recruiter/submissions', icon: <FileText className="h-4 w-4" /> },
    { label: 'Talent Pool', href: '/recruiter/talent-pool', icon: <Database className="h-4 w-4" /> },
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
    { label: 'Alle Jobs', href: '/admin/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Kandidaten', href: '/admin/candidates', icon: <FileText className="h-4 w-4" /> },
    { label: 'Interviews', href: '/admin/interviews', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Placements', href: '/admin/placements', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Deal Health', href: '/admin/deal-health', icon: <Activity className="h-4 w-4" /> },
    { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Activity', href: '/admin/activity', icon: <Activity className="h-4 w-4" /> },
    { label: 'Fraud', href: '/admin/fraud', icon: <AlertTriangle className="h-4 w-4" /> },
    { label: 'Rechnungen', href: '/admin/invoices', icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Zahlungen', href: '/admin/payments', icon: <DollarSign className="h-4 w-4" /> },
    { label: 'Auszahlungen', href: '/admin/payouts', icon: <Wallet className="h-4 w-4" /> },
  ];

  const navItems = role === 'admin' 
    ? adminNavItems 
    : role === 'recruiter' 
    ? recruiterNavItems 
    : clientNavItems;

  const settingsHref = role === 'admin' ? '/admin/settings' : role === 'client' ? '/dashboard/settings' : '/recruiter/settings';

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <Link to={getDashboardHome()} className="flex items-center space-x-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Briefcase className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">TalentBridge</span>
          </Link>

          {/* Right Side */}
          <div className="flex items-center gap-3">
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
              {navItems.map((item) => {
                const isActive = location.pathname === item.href || 
                  (item.href !== '/dashboard' && item.href !== '/recruiter' && item.href !== '/admin' && location.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.icon}
                    {item.label}
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border pt-4">
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
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64">
          <div className="container py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}