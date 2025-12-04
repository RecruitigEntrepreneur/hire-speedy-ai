import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Send, 
  Eye, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';

interface OfferStatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ElementType;
  className?: string;
}> = {
  draft: {
    label: 'Entwurf',
    variant: 'secondary',
    icon: FileText,
    className: 'bg-muted text-muted-foreground'
  },
  sent: {
    label: 'Gesendet',
    variant: 'default',
    icon: Send,
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  },
  viewed: {
    label: 'Angesehen',
    variant: 'outline',
    icon: Eye,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
  },
  negotiating: {
    label: 'In Verhandlung',
    variant: 'outline',
    icon: MessageSquare,
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20'
  },
  accepted: {
    label: 'Angenommen',
    variant: 'default',
    icon: CheckCircle,
    className: 'bg-green-500/10 text-green-600 border-green-500/20'
  },
  rejected: {
    label: 'Abgelehnt',
    variant: 'destructive',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-600 border-red-500/20'
  },
  expired: {
    label: 'Abgelaufen',
    variant: 'secondary',
    icon: Clock,
    className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  },
  withdrawn: {
    label: 'Zurückgezogen',
    variant: 'secondary',
    icon: AlertTriangle,
    className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }
};

export function OfferStatusBadge({ status, className }: OfferStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className} gap-1`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
