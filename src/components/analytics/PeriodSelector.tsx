import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('clientDashboard');
  const periods = [
    { value: 7, label: t('analytics.period.days', { count: 7 }) },
    { value: 14, label: t('analytics.period.days', { count: 14 }) },
    { value: 30, label: t('analytics.period.days', { count: 30 }) },
    { value: 60, label: t('analytics.period.days', { count: 60 }) },
    { value: 90, label: t('analytics.period.days', { count: 90 }) },
    { value: 180, label: t('analytics.period.sixMonths') },
    { value: 365, label: t('analytics.period.year') },
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
