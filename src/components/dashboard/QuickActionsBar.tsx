import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Users, 
  Calendar,
  BarChart3,
  Settings
} from 'lucide-react';

interface QuickActionsBarProps {
  className?: string;
}

export function QuickActionsBar({ className }: QuickActionsBarProps) {
  const quickActions = [
    {
      label: 'Neuer Job',
      icon: Plus,
      href: '/dashboard/create-job',
      variant: 'default' as const,
    },
    {
      label: 'Talent Hub',
      icon: Users,
      href: '/dashboard/talent-hub',
      variant: 'outline' as const,
    },
    {
      label: 'Interviews',
      icon: Calendar,
      href: '/dashboard/interviews',
      variant: 'outline' as const,
    },
    {
      label: 'Analytics',
      icon: BarChart3,
      href: '/dashboard/analytics',
      variant: 'ghost' as const,
    },
  ];

  return (
    <div className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        {quickActions.map((action) => (
          <Button
            key={action.href}
            variant={action.variant}
            size="sm"
            asChild
            className="h-8"
          >
            <Link to={action.href}>
              <action.icon className="h-4 w-4 mr-1.5" />
              {action.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
