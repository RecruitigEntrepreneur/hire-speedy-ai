import { useState } from "react";
import { KANDIDATEN } from "./data";

export const KandidatenView = () => {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-foreground">Top Matches</span>
        <span className="text-[10px] text-muted-foreground">Sortiert nach Score</span>
      </div>
      <div className="space-y-3">
        {KANDIDATEN.map((k, i) => (
          <div key={i}>
            <div
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60">
                  {k.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">{k.name}</p>
                  <p className="text-[10px] text-muted-foreground">{k.role}</p>
                </div>
                <div className="text-sm font-bold text-foreground">{k.score}%</div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {k.skills.map((s) => (
                  <span key={s} className="text-[9px] px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/70 border border-border/30">{s}</span>
                ))}
              </div>
            </div>

            {/* Expanded detail panel */}
            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{ maxHeight: expanded === i ? "100px" : "0px", opacity: expanded === i ? 1 : 0 }}
            >
              <div className="mt-1 p-3 rounded-lg bg-foreground/[0.03] border border-border/20">
                <p className="text-[10px] text-foreground/70 mb-2">
                  {k.role} · {k.score}% Match · Verfügbar ab sofort
                </p>
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
  );
};
