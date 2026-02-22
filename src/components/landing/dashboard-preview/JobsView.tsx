import { useState, useEffect, useRef } from "react";
import { Briefcase, Pause, XCircle, MoreHorizontal } from "lucide-react";
import { JOBS } from "./data";

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "Aktiv") return <Briefcase className="w-3 h-3 text-foreground/60" />;
  if (status === "Pause") return <Pause className="w-3 h-3 text-muted-foreground" />;
  return <XCircle className="w-3 h-3 text-muted-foreground/50" />;
};

export const JobsView = () => {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (openMenu !== null) {
      timerRef.current = setTimeout(() => setOpenMenu(null), 2000);
    }
    return () => clearTimeout(timerRef.current);
  }, [openMenu]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-foreground">Offene Positionen</span>
        <span className="text-[10px] text-muted-foreground">{JOBS.length} Jobs</span>
      </div>
      <div className="space-y-2">
        {JOBS.map((job, i) => (
          <div key={i} className="relative">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors cursor-default">
              <StatusIcon status={job.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{job.title}</p>
                <p className="text-[10px] text-muted-foreground">{job.company}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                job.status === "Aktiv" ? "bg-foreground/10 text-foreground" :
                job.status === "Pause" ? "bg-muted text-muted-foreground" :
                "bg-muted/50 text-muted-foreground/60"
              }`}>{job.status}</span>
              <span className="text-[10px] text-muted-foreground">{job.count} Kandidaten</span>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === i ? null : i); }}
                className="p-1 rounded hover:bg-foreground/10 transition-colors"
              >
                <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>

            {/* Mini Dropdown */}
            <div
              className="absolute right-2 top-full mt-1 z-10 transition-all duration-200 origin-top-right"
              style={{
                opacity: openMenu === i ? 1 : 0,
                transform: openMenu === i ? "scale(1)" : "scale(0.9)",
                pointerEvents: openMenu === i ? "auto" : "none",
              }}
            >
              <div className="bg-card border border-border/50 rounded-lg shadow-lg p-1 min-w-[100px]">
                {["Boost", "Pause", "Details"].map((action) => (
                  <button
                    key={action}
                    onClick={() => setOpenMenu(null)}
                    className="block w-full text-left text-[10px] px-3 py-1.5 rounded hover:bg-foreground/5 text-foreground/80 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
