import { useParallax } from "@/hooks/useParallax";
import { Users, BarChart3, TrendingUp, CheckCircle2 } from "lucide-react";

export const DashboardPreview = () => {
  const { ref, offset } = useParallax(0.3);

  return (
    <div ref={ref} className="mt-16 max-w-5xl mx-auto px-4">
      <div
        className="relative transition-transform duration-300"
        style={{
          perspective: "1200px",
        }}
      >
        <div
          className="relative rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden transition-transform duration-700"
          style={{
            transform: `rotateX(${Math.max(0, 4 + offset * 2)}deg)`,
            transformOrigin: "center bottom",
          }}
        >
          {/* Browser Chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-foreground/10" />
              <div className="w-3 h-3 rounded-full bg-foreground/10" />
              <div className="w-3 h-3 rounded-full bg-foreground/10" />
            </div>
            <div className="flex-1 mx-4">
              <div className="h-6 rounded-md bg-muted/80 max-w-sm mx-auto flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground font-mono">app.matchunt.com/dashboard</span>
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="flex">
            {/* Sidebar */}
            <div className="w-48 border-r border-border/30 bg-muted/20 p-4 hidden md:block">
              <div className="space-y-1">
                {["Dashboard", "Jobs", "Kandidaten", "Analytics", "Settings"].map((item, i) => (
                  <div
                    key={item}
                    className={`px-3 py-2 rounded-lg text-xs font-medium ${
                      i === 0 ? "bg-foreground/10 text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Main */}
            <div className="flex-1 p-5">
              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Aktive Jobs", value: "12", icon: BarChart3, trend: "+3" },
                  { label: "Submissions", value: "248", icon: Users, trend: "+47" },
                  { label: "Interviews", value: "18", icon: CheckCircle2, trend: "+5" },
                  { label: "Match Rate", value: "94%", icon: TrendingUp, trend: "↑8%" },
                ].map((m, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                      <m.icon className="w-3 h-3 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-bold text-foreground">{m.value}</p>
                    <span className="text-[10px] text-foreground/60">{m.trend}</span>
                  </div>
                ))}
              </div>

              {/* Pipeline preview */}
              <div className="rounded-lg bg-muted/20 border border-border/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-foreground">Kandidaten Pipeline</span>
                  <span className="text-[10px] text-muted-foreground">Letzte 7 Tage</span>
                </div>
                <div className="space-y-2">
                  {[
                    { name: "Anna M.", role: "Senior Developer", score: 94 },
                    { name: "Thomas K.", role: "Product Manager", score: 89 },
                    { name: "Lisa S.", role: "UX Lead", score: 87 },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-background/50">
                      <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60">
                        {c.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.role}</p>
                      </div>
                      <div className="text-xs font-bold text-foreground">{c.score}%</div>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-foreground/40 rounded-full" style={{ width: `${c.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Glow underneath */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-foreground/[0.03] blur-2xl rounded-full" />
      </div>
    </div>
  );
};
