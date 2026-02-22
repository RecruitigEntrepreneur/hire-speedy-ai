import { useState } from "react";
import { useParallax } from "@/hooks/useParallax";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useCountUp } from "@/hooks/useCountUp";
import { Users, BarChart3, TrendingUp, CheckCircle2, Briefcase, Pause, XCircle } from "lucide-react";

type Tab = "dashboard" | "jobs" | "kandidaten";

const SIDEBAR_ITEMS: { label: string; tab: Tab | null }[] = [
  { label: "Dashboard", tab: "dashboard" },
  { label: "Jobs", tab: "jobs" },
  { label: "Kandidaten", tab: "kandidaten" },
  { label: "Analytics", tab: null },
  { label: "Settings", tab: null },
];

const METRICS = [
  { label: "Aktive Jobs", end: 12, icon: BarChart3, trend: "+3" },
  { label: "Submissions", end: 248, icon: Users, trend: "+47" },
  { label: "Interviews", end: 18, icon: CheckCircle2, trend: "+5" },
  { label: "Match Rate", end: 94, icon: TrendingUp, trend: "↑8%", suffix: "%" },
];

const PIPELINE = [
  { name: "Anna M.", role: "Senior Developer", score: 94 },
  { name: "Thomas K.", role: "Product Manager", score: 89 },
  { name: "Lisa S.", role: "UX Lead", score: 87 },
];

const JOBS = [
  { title: "Senior Frontend Engineer", company: "TechVentures GmbH", status: "Aktiv", count: 14 },
  { title: "Product Manager", company: "ScaleUp AG", status: "Aktiv", count: 8 },
  { title: "DevOps Lead", company: "CloudFirst", status: "Pause", count: 3 },
  { title: "UX Designer", company: "DesignLab", status: "Geschlossen", count: 22 },
];

const KANDIDATEN = [
  { name: "Sarah B.", role: "Full-Stack Dev", score: 96, skills: ["React", "Node", "AWS"] },
  { name: "Max W.", role: "Backend Engineer", score: 91, skills: ["Go", "K8s", "PostgreSQL"] },
  { name: "Elena R.", role: "Product Lead", score: 88, skills: ["Strategy", "Agile", "Analytics"] },
];

const MetricValue = ({ end, suffix, enabled }: { end: number; suffix?: string; enabled: boolean }) => {
  const value = useCountUp({ end, duration: 1200, enabled });
  return <>{value}{suffix || ""}</>;
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "Aktiv") return <Briefcase className="w-3 h-3 text-foreground/60" />;
  if (status === "Pause") return <Pause className="w-3 h-3 text-muted-foreground" />;
  return <XCircle className="w-3 h-3 text-muted-foreground/50" />;
};

export const DashboardPreview = () => {
  const { ref: parallaxRef, offset } = useParallax(0.3);
  const { ref: revealRef, isVisible } = useScrollReveal();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div ref={parallaxRef} className="mt-20 md:mt-24 max-w-5xl mx-auto px-4">
      <div
        ref={revealRef}
        className="relative transition-transform duration-300"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden transition-transform duration-700 pointer-events-auto"
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
                {SIDEBAR_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => item.tab && setActiveTab(item.tab)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      item.tab === activeTab
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    } ${item.tab ? "cursor-pointer" : "opacity-50"}`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-5 min-h-[280px]">
              {/* Dashboard View */}
              <div className={`transition-opacity duration-300 ${activeTab === "dashboard" ? "opacity-100" : "hidden"}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {METRICS.map((m, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">{m.label}</span>
                        <m.icon className="w-3 h-3 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-bold text-foreground">
                        <MetricValue end={m.end} suffix={m.suffix} enabled={isVisible && activeTab === "dashboard"} />
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
                      <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-background/50 hover:bg-foreground/[0.04] transition-colors cursor-default group">
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
                    ))}
                  </div>
                </div>
              </div>

              {/* Jobs View */}
              <div className={`transition-opacity duration-300 ${activeTab === "jobs" ? "opacity-100" : "hidden"}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-foreground">Offene Positionen</span>
                  <span className="text-[10px] text-muted-foreground">{JOBS.length} Jobs</span>
                </div>
                <div className="space-y-2">
                  {JOBS.map((job, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors cursor-default">
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
                    </div>
                  ))}
                </div>
              </div>

              {/* Kandidaten View */}
              <div className={`transition-opacity duration-300 ${activeTab === "kandidaten" ? "opacity-100" : "hidden"}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-foreground">Top Matches</span>
                  <span className="text-[10px] text-muted-foreground">Sortiert nach Score</span>
                </div>
                <div className="space-y-3">
                  {KANDIDATEN.map((k, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors cursor-default">
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
