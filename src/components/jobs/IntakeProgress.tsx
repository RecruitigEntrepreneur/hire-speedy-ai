import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface IntakeProgressProps {
  completeness: number;
  className?: string;
}

export function IntakeProgress({ completeness, className }: IntakeProgressProps) {
  const { t } = useTranslation('recruiterJobEdit');
  const getStatus = () => {
    if (completeness >= 85) {
      return {
        label: t('progress.excellent'),
        description: t('progress.excellentText'),
        icon: CheckCircle,
        color: 'text-emerald-600',
        progressColor: 'bg-emerald-500'
      };
    }
    if (completeness >= 60) {
      return {
        label: t('progress.good'),
        description: t('progress.goodText'),
        icon: Info,
        color: 'text-amber-600',
        progressColor: 'bg-amber-500'
      };
    }
    return {
      label: t('progress.basic'),
      description: t('progress.basicText'),
      icon: AlertCircle,
      color: 'text-red-500',
      progressColor: 'bg-red-500'
    };
  };

  const status = getStatus();
  const Icon = status.icon;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', status.color)} />
          <span className={cn('text-sm font-medium', status.color)}>
            {status.label}
          </span>
          <span className="text-sm text-muted-foreground">
            – {status.description}
          </span>
        </div>
        <span className={cn('text-sm font-semibold', status.color)}>
          {completeness}%
        </span>
      </div>
      
      <Progress 
        value={completeness} 
        className="h-2"
      />
    </div>
  );
}
