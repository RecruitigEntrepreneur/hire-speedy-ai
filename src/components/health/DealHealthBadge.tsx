import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DealHealthBadgeProps {
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function DealHealthBadge({ score, riskLevel, showLabel = true, size = 'md' }: DealHealthBadgeProps) {
  const getIcon = () => {
    switch (riskLevel) {
      case 'low': return <CheckCircle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'medium': return <Activity className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'high': return <AlertTriangle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'critical': return <XCircle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
    }
  };

  const getVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (riskLevel) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'outline';
      case 'critical': return 'destructive';
    }
  };

  const getLabel = (): string => {
    switch (riskLevel) {
      case 'low': return 'Gesund';
      case 'medium': return 'Beobachten';
      case 'high': return 'Kritisch';
      case 'critical': return 'Gefährdet';
    }
  };

  const getBgClass = (): string => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-700 hover:bg-green-200';
      case 'medium': return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
      case 'high': return 'bg-orange-100 text-orange-700 hover:bg-orange-200';
      case 'critical': return 'bg-red-100 text-red-700 hover:bg-red-200';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getVariant()}
            className={cn(
              'gap-1 cursor-help',
              getBgClass(),
              size === 'sm' && 'text-xs px-2 py-0',
              size === 'lg' && 'text-sm px-3 py-1'
            )}
          >
            {getIcon()}
            <span>{score}%</span>
            {showLabel && <span className="hidden sm:inline">- {getLabel()}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Deal Health Score: {score}%</p>
          <p className="text-sm text-muted-foreground">Risikostufe: {getLabel()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
