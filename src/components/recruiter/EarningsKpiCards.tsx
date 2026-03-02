import { Card, CardContent } from '@/components/ui/card';
import { Euro, Briefcase, AlertTriangle, TrendingUp } from 'lucide-react';

interface KpiData {
  totalPotential: number;
  totalJobs: number;
  urgentJobs: number;
  avgEarningPerJob: number;
}

interface EarningsKpiCardsProps {
  kpis: KpiData;
}

const formatEuro = (n: number) => {
  if (n >= 1000) return `€${Math.round(n / 1000).toLocaleString('de-DE')}k`;
  return `€${n.toLocaleString('de-DE')}`;
};

const formatEuroFull = (n: number) => `€${n.toLocaleString('de-DE')}`;

export function EarningsKpiCards({ kpis }: EarningsKpiCardsProps) {
  const items = [
    {
      label: 'Potenzial',
      value: formatEuroFull(kpis.totalPotential),
      icon: Euro,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Offene Jobs',
      value: String(kpis.totalJobs),
      icon: Briefcase,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Dringend',
      value: String(kpis.urgentJobs),
      icon: AlertTriangle,
      color: kpis.urgentJobs > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: kpis.urgentJobs > 0 ? 'bg-destructive/10' : 'bg-muted/50',
    },
    {
      label: 'Ø / Job',
      value: formatEuro(kpis.avgEarningPerJob),
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="border-border/30 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold tabular-nums">{item.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
