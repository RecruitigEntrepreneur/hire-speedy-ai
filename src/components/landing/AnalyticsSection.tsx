import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Clock, Users, BarChart3 } from "lucide-react";

export const AnalyticsSection = () => {
  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Analytics</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Clarity is{" "}
              <span className="bg-gradient-to-r from-emerald to-blue-500 bg-clip-text text-transparent">
                Power
              </span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Sehen Sie jeden Schritt. Verstehen Sie Engpässe. Optimieren Sie Entscheidungen.
              Mit Echtzeit-Analytics haben Sie volle Kontrolle über Ihre Hiring-Pipeline.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <Clock className="w-6 h-6 text-emerald" />
                <span className="text-lg">Time to Interview Tracking</span>
              </div>
              <div className="flex items-center gap-4">
                <TrendingUp className="w-6 h-6 text-emerald" />
                <span className="text-lg">Offer Acceptance Rate</span>
              </div>
              <div className="flex items-center gap-4">
                <BarChart3 className="w-6 h-6 text-emerald" />
                <span className="text-lg">Funnel Conversion Analysis</span>
              </div>
              <div className="flex items-center gap-4">
                <Users className="w-6 h-6 text-emerald" />
                <span className="text-lg">Recruiter Performance Heatmap</span>
              </div>
            </div>

            <Button variant="outline" size="lg" className="group">
              Analytics entdecken
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative">
            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold">Hiring Dashboard</h3>
                <span className="text-sm text-muted-foreground">Letzte 30 Tage</span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-emerald/10">
                  <p className="text-sm text-muted-foreground mb-1">Time to Interview</p>
                  <p className="text-2xl font-bold">3.8 <span className="text-sm font-normal text-muted-foreground">Tage</span></p>
                  <p className="text-xs text-emerald">↓ 24% vs. Vormonat</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/10">
                  <p className="text-sm text-muted-foreground mb-1">Offer Acceptance</p>
                  <p className="text-2xl font-bold">87<span className="text-sm font-normal text-muted-foreground">%</span></p>
                  <p className="text-xs text-blue-500">↑ 12% vs. Vormonat</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10">
                  <p className="text-sm text-muted-foreground mb-1">Aktive Kandidaten</p>
                  <p className="text-2xl font-bold">124</p>
                  <p className="text-xs text-purple-500">+18 diese Woche</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10">
                  <p className="text-sm text-muted-foreground mb-1">Placements</p>
                  <p className="text-2xl font-bold">8</p>
                  <p className="text-xs text-amber-500">Ziel: 10</p>
                </div>
              </div>

              {/* Mini Chart */}
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm font-medium mb-4">Funnel Conversion</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-muted-foreground">Submitted</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-full bg-blue-500 rounded-full" />
                    </div>
                    <span className="text-xs font-medium">248</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-muted-foreground">Opt-In</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-[72%] bg-purple-500 rounded-full" />
                    </div>
                    <span className="text-xs font-medium">178</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-muted-foreground">Interview</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-[45%] bg-amber-500 rounded-full" />
                    </div>
                    <span className="text-xs font-medium">112</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-muted-foreground">Offer</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-[18%] bg-emerald rounded-full" />
                    </div>
                    <span className="text-xs font-medium">45</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-muted-foreground">Placed</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-[15%] bg-emerald rounded-full" />
                    </div>
                    <span className="text-xs font-medium">38</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-emerald/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};
