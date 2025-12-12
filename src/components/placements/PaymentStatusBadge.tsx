import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  CreditCard,
  FileCheck
} from 'lucide-react';

interface PaymentStatusBadgeProps {
  status: string | null;
  totalFee?: number | null;
}

export function PaymentStatusBadge({ status, totalFee }: PaymentStatusBadgeProps) {
  const config = {
    pending: {
      label: 'Ausstehend',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      icon: Clock,
      description: 'Zahlung noch nicht eingegangen',
    },
    invoiced: {
      label: 'Rechnung gestellt',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: FileCheck,
      description: 'Rechnung wurde versendet',
    },
    confirmed: {
      label: 'Bestätigt',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      icon: CheckCircle,
      description: 'Kandidat hat Arbeit angetreten',
    },
    paid: {
      label: 'Bezahlt',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      icon: CreditCard,
      description: 'Zahlung eingegangen',
    },
    disputed: {
      label: 'Streitfall',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: AlertTriangle,
      description: 'Zahlung wird geprüft',
    },
  };

  const statusConfig = config[status as keyof typeof config] || config.pending;
  const Icon = statusConfig.icon;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${statusConfig.color} ${statusConfig.bgColor} ${statusConfig.borderColor} gap-1 cursor-help`}
          >
            <Icon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-1">
            <p className="font-medium">{statusConfig.description}</p>
            {totalFee && (
              <p className="text-xs text-muted-foreground">
                Gebühr: {formatCurrency(totalFee)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
