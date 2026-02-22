import { useState } from "react";
import { METRICS, PIPELINE } from "./data";
import { useCountUp } from "@/hooks/useCountUp";

const MetricValue = ({ end, suffix, enabled }: { end: number; suffix?: string; enabled: boolean }) => {
  const value = useCountUp({ end, duration: 1200, enabled });
  return <>{value}{suffix || ""}</>;
};

export const DashboardView = ({ isVisible }: { isVisible: boolean }) => {
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {METRICS.map((m, i) => (
          <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
              <m.icon className="w-3 h-3 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-bold text-foreground">
              <MetricValue end={m.end} suffix={m.suffix} enabled={isVisible} />
            </p>
            <span className="text-[10px] text-foreground/60">{m.trend}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted/20 border border-border/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-foreground">Kandidaten Pipeline</span>
          <span className="text-[10px] text-muted-foreground">Letzte 7 Tage</span>
        </div>
        <div className="space-y-2">
          {PIPELINE.map((c, i) => (
            <div key={i}>
              <div
                onClick={() => setExpandedCandidate(expandedCandidate === i ? null : i)}
                className="flex items-center gap-3 p-2 rounded-md bg-background/50 hover:bg-foreground/[0.04] transition-colors cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60">
                  {c.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.role}</p>
                </div>
                <div className="text-xs font-bold text-foreground">{c.score}%</div>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-foreground/40 rounded-full transition-all duration-500 group-hover:bg-foreground/60" style={{ width: `${c.score}%` }} />
                </div>
              </div>

              {/* Expanded detail */}
              <div
                className="overflow-hidden transition-all duration-300 ease-out"
                style={{ maxHeight: expandedCandidate === i ? "100px" : "0px", opacity: expandedCandidate === i ? 1 : 0 }}
              >
                <div className="mt-1 ml-10 p-2 rounded-lg bg-foreground/[0.03] border border-border/20">
                  <div className="flex gap-1.5 mb-2">
                    {c.skills.map(s => (
                      <span key={s} className="text-[9px] px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/70 border border-border/30">{s}</span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button className="text-[9px] px-3 py-1 rounded-md bg-foreground/10 text-foreground/80 hover:bg-foreground/20 transition-colors font-medium">
                      Interview
                    </button>
                    <button className="text-[9px] px-3 py-1 rounded-md bg-foreground/5 text-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors">
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
