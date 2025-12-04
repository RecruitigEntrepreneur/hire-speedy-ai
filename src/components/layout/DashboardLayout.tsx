import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { role } = useAuth();
  const location = useLocation();

  const clientNavItems: NavItem[] = [
    { label: 'Übersicht', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Meine Jobs', href: '/dashboard/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Kandidaten', href: '/dashboard/candidates', icon: <Users className="h-4 w-4" /> },
    { label: 'Interviews', href: '/dashboard/interviews', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Placements', href: '/dashboard/placements', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Nachrichten', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Abrechnung', href: '/dashboard/billing', icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Datenschutz', href: '/dashboard/privacy', icon: <Shield className="h-4 w-4" /> },
  ];

  const recruiterNavItems: NavItem[] = [
    { label: 'Übersicht', href: '/recruiter', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Offene Jobs', href: '/recruiter/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Meine Kandidaten', href: '/recruiter/candidates', icon: <Users className="h-4 w-4" /> },
    { label: 'Pipeline', href: '/recruiter/submissions', icon: <FileText className="h-4 w-4" /> },
    { label: 'Verdienste', href: '/recruiter/earnings', icon: <DollarSign className="h-4 w-4" /> },
    { label: 'Auszahlungen', href: '/recruiter/payouts', icon: <Wallet className="h-4 w-4" /> },
    { label: 'Benachrichtigungen', href: '/recruiter/notifications', icon: <Activity className="h-4 w-4" /> },
    { label: 'Nachrichten', href: '/recruiter/messages', icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Profil', href: '/recruiter/profile', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Datenschutz', href: '/recruiter/privacy', icon: <Shield className="h-4 w-4" /> },
  ];

  const adminNavItems: NavItem[] = [
    { label: 'Übersicht', href: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Kunden', href: '/admin/clients', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Recruiter', href: '/admin/recruiters', icon: <Users className="h-4 w-4" /> },
    { label: 'Alle Jobs', href: '/admin/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Kandidaten', href: '/admin/candidates', icon: <FileText className="h-4 w-4" /> },
    { label: 'Interviews', href: '/admin/interviews', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Placements', href: '/admin/placements', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Zahlungen', href: '/admin/payments', icon: <DollarSign className="h-4 w-4" /> },
    { label: 'Auszahlungen', href: '/admin/payouts', icon: <Wallet className="h-4 w-4" /> },
    { label: 'Aktivität', href: '/admin/activity', icon: <Activity className="h-4 w-4" /> },
  ];

  const navItems = role === 'admin' 
    ? adminNavItems 
    : role === 'recruiter' 
    ? recruiterNavItems 
    : clientNavItems;

  const settingsHref = role === 'client' ? '/dashboard/settings' : '/settings';

  return (
    <div className="min-h-screen bg-background">
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
