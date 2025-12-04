import { AlertTriangle, Shield, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FraudAlertBannerProps {
  pendingCount: number;
  criticalCount: number;
  onViewAlerts?: () => void;
  onDismiss?: () => void;
}

export function FraudAlertBanner({ pendingCount, criticalCount, onViewAlerts, onDismiss }: FraudAlertBannerProps) {
  if (pendingCount === 0) return null;

  const isCritical = criticalCount > 0;

  return (
    <Alert 
      variant={isCritical ? 'destructive' : 'default'}
      className={cn(
        'relative',
        isCritical ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50'
      )}
    >
      <Shield className={cn('h-4 w-4', isCritical ? 'text-red-600' : 'text-amber-600')} />
      <AlertTitle className={cn(isCritical ? 'text-red-800' : 'text-amber-800')}>
        {isCritical ? 'Kritische Fraud-Warnung' : 'Fraud-Signale erkannt'}
      </AlertTitle>
      <AlertDescription className={cn('flex items-center justify-between', isCritical ? 'text-red-700' : 'text-amber-700')}>
        <span>
          {pendingCount} ausstehende{pendingCount === 1 ? 's Signal' : ' Signale'}
          {criticalCount > 0 && `, davon ${criticalCount} kritisch`}
        </span>
        <div className="flex items-center gap-2">
          {onViewAlerts && (
            <Button 
              variant={isCritical ? 'destructive' : 'outline'} 
              size="sm"
              onClick={onViewAlerts}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Prüfen
            </Button>
          )}
        </div>
      </AlertDescription>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Alert>
  );
}
