import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Clock, Users, BarChart3 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export const AnalyticsSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="analytics" className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`grid lg:grid-cols-2 gap-16 items-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div>
            <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">Analytics</p>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Clarity is <span className="text-muted-foreground">Power</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Sehen Sie jeden Schritt. Verstehen Sie Engpässe. Optimieren Sie Entscheidungen.
              Mit Echtzeit-Analytics haben Sie volle Kontrolle über Ihre Hiring-Pipeline.
            </p>
            <div className="space-y-4 mb-8">
              {[
                { icon: Clock, text: "Time to Interview Tracking" },
                { icon: TrendingUp, text: "Offer Acceptance Rate" },
                { icon: BarChart3, text: "Funnel Conversion Analysis" },
                { icon: Users, text: "Recruiter Performance Heatmap" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <item.icon className="w-6 h-6 text-foreground" />
                  <span className="text-lg text-foreground/80">{item.text}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="lg" className="group border-foreground/20 hover:bg-foreground/5">
              Analytics entdecken
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative" style={{ perspective: "1200px" }}>
            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-xl" style={{ transform: "rotateX(2deg)", transformOrigin: "center bottom" }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-foreground">Hiring Dashboard</h3>
                <span className="text-sm text-muted-foreground">Letzte 30 Tage</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: "Time to Interview", value: "3.8", unit: "Tage", trend: "↓ 24% vs. Vormonat" },
                  { label: "Offer Acceptance", value: "87", unit: "%", trend: "↑ 12% vs. Vormonat" },
                  { label: "Aktive Kandidaten", value: "124", unit: "", trend: "+18 diese Woche" },
                  { label: "Placements", value: "8", unit: "", trend: "Ziel: 10" },
                ].map((m, i) => (
                  <div key={i} className="p-4 rounded-xl bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">{m.label}</p>
                    <p className="text-2xl font-bold text-foreground">{m.value}<span className="text-sm font-normal text-muted-foreground ml-1">{m.unit}</span></p>
                    <p className="text-xs text-foreground/60 font-medium">{m.trend}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-muted/20">
                <p className="text-sm font-medium text-foreground mb-4">Funnel Conversion</p>
                <div className="space-y-3">
                  {[
                    { label: "Submitted", w: "100%", count: "248" },
                    { label: "Opt-In", w: "72%", count: "178" },
                    { label: "Interview", w: "45%", count: "112" },
                    { label: "Offer", w: "18%", count: "45" },
                    { label: "Placed", w: "15%", count: "38" },
                  ].map((bar, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs w-20 text-muted-foreground">{bar.label}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-foreground rounded-full" style={{ width: bar.w, opacity: 1 - i * 0.15 }} />
                      </div>
                      <span className="text-xs font-medium text-foreground/70">{bar.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -inset-4 bg-foreground/[0.03] rounded-3xl blur-xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};
