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
    { label: 'Overview', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'My Jobs', href: '/dashboard/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Candidates', href: '/dashboard/candidates', icon: <Users className="h-4 w-4" /> },
    { label: 'Interviews', href: '/dashboard/interviews', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Placements', href: '/dashboard/placements', icon: <UserCheck className="h-4 w-4" /> },
  ];

  const recruiterNavItems: NavItem[] = [
    { label: 'Overview', href: '/recruiter', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Open Jobs', href: '/recruiter/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'My Candidates', href: '/recruiter/candidates', icon: <Users className="h-4 w-4" /> },
    { label: 'Submissions', href: '/recruiter/submissions', icon: <FileText className="h-4 w-4" /> },
    { label: 'Earnings', href: '/recruiter/earnings', icon: <DollarSign className="h-4 w-4" /> },
  ];

  const adminNavItems: NavItem[] = [
    { label: 'Overview', href: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Clients', href: '/admin/clients', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Recruiters', href: '/admin/recruiters', icon: <Users className="h-4 w-4" /> },
    { label: 'All Jobs', href: '/admin/jobs', icon: <Briefcase className="h-4 w-4" /> },
    { label: 'Placements', href: '/admin/placements', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Payments', href: '/admin/payments', icon: <DollarSign className="h-4 w-4" /> },
    { label: 'Activity', href: '/admin/activity', icon: <Activity className="h-4 w-4" /> },
  ];

  const navItems = role === 'admin' 
    ? adminNavItems 
    : role === 'recruiter' 
    ? recruiterNavItems 
    : clientNavItems;

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
                to="/settings"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  location.pathname === '/settings'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
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
