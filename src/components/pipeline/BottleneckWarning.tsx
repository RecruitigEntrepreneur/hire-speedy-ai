import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { AlertTriangle, Clock } from 'lucide-react';

interface BottleneckWarningProps {
  hoursInStage: number;
  stageName: string;
  candidateName: string;
}

export function BottleneckWarning({ hoursInStage, stageName, candidateName }: BottleneckWarningProps) {
  const daysInStage = Math.floor(hoursInStage / 24);
  
  if (daysInStage < 3) return null;

  const severity = daysInStage >= 7 ? 'critical' : daysInStage >= 5 ? 'high' : 'medium';
  
  const config = {
    critical: {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      message: `Kritisch: ${daysInStage} Tage ohne Fortschritt`,
    },
    high: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      message: `Warnung: ${daysInStage} Tage in "${stageName}"`,
    },
    medium: {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      message: `${daysInStage} Tage in "${stageName}"`,
    },
  };

  const { color, bgColor, borderColor, message } = config[severity];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${color} ${bgColor} ${borderColor} gap-1 text-[10px] cursor-help`}
          >
            <AlertTriangle className="h-3 w-3" />
            {daysInStage}d
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{message}</p>
            <p className="text-xs text-muted-foreground">
              {candidateName} wartet auf nächste Aktion
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
