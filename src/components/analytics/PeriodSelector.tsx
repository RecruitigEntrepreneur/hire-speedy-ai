import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Download, RefreshCw } from 'lucide-react';

interface PeriodSelectorProps {
  value: number;
  onChange: (days: number) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  isRefreshing?: boolean;
}

export function PeriodSelector({
  value,
  onChange,
  onRefresh,
  onExport,
  isRefreshing,
}: PeriodSelectorProps) {
  const periods = [
    { value: 7, label: 'Last 7 Days' },
    { value: 14, label: 'Last 14 Days' },
    { value: 30, label: 'Last 30 Days' },
    { value: 60, label: 'Last 60 Days' },
    { value: 90, label: 'Last 90 Days' },
    { value: 180, label: 'Last 6 Months' },
    { value: 365, label: 'Last Year' },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Select
          value={value.toString()}
          onValueChange={(v) => onChange(parseInt(v))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((period) => (
              <SelectItem key={period.value} value={period.value.toString()}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {onRefresh && (
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      )}

      {onExport && (
        <Button variant="outline" size="icon" onClick={onExport}>
          <Download className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
