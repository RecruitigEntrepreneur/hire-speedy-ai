import { ANALYTICS_WEEKLY, FUNNEL_DATA } from "./data";
import { useCountUp } from "@/hooks/useCountUp";

const KpiValue = ({ end, suffix, enabled }: { end: number; suffix?: string; enabled: boolean }) => {
  const value = useCountUp({ end, duration: 1200, enabled });
  return <>{value}{suffix || ""}</>;
};

const KPIS = [
  { label: "Time-to-Hire", end: 23, suffix: " Tage" },
  { label: "Cost-per-Hire", end: 2.4, suffix: "k €" },
  { label: "Offer-Accept", end: 87, suffix: "%" },
];

export const AnalyticsView = ({ isVisible }: { isVisible: boolean }) => {
  const maxVal = Math.max(...ANALYTICS_WEEKLY.map(d => d.value));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {KPIS.map((kpi, i) => (
          <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
            <span className="text-[10px] text-muted-foreground block mb-1">{kpi.label}</span>
            <p className="text-lg font-bold text-foreground">
              <KpiValue end={kpi.end} suffix={kpi.suffix} enabled={isVisible} />
            </p>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="rounded-lg bg-muted/20 border border-border/30 p-4">
        <span className="text-xs font-semibold text-foreground block mb-3">Submissions pro Woche</span>
        <div className="flex items-end gap-2 h-20">
          {ANALYTICS_WEEKLY.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-foreground/20 hover:bg-foreground/40 transition-colors cursor-default"
                style={{ height: `${(d.value / maxVal) * 100}%` }}
              />
              <span className="text-[9px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Funnel */}
      <div className="rounded-lg bg-muted/20 border border-border/30 p-4">
        <span className="text-xs font-semibold text-foreground block mb-3">Recruiting Funnel</span>
        <div className="space-y-2">
          {FUNNEL_DATA.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-16 text-right">{step.label}</span>
              <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground/20 rounded-full transition-all duration-700"
                  style={{ width: `${(step.value / FUNNEL_DATA[0].value) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-foreground w-8">{step.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
