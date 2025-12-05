import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Clock, Users, BarChart3 } from "lucide-react";

export const AnalyticsSection = () => {
  return (
    <section id="analytics" className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Analytics</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Clarity is{" "}
              <span className="text-emerald">Power</span>
            </h2>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Sehen Sie jeden Schritt. Verstehen Sie Engpässe. Optimieren Sie Entscheidungen.
              Mit Echtzeit-Analytics haben Sie volle Kontrolle über Ihre Hiring-Pipeline.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <Clock className="w-6 h-6 text-emerald" />
                <span className="text-lg text-slate-700">Time to Interview Tracking</span>
              </div>
              <div className="flex items-center gap-4">
                <TrendingUp className="w-6 h-6 text-emerald" />
                <span className="text-lg text-slate-700">Offer Acceptance Rate</span>
              </div>
              <div className="flex items-center gap-4">
                <BarChart3 className="w-6 h-6 text-emerald" />
                <span className="text-lg text-slate-700">Funnel Conversion Analysis</span>
              </div>
              <div className="flex items-center gap-4">
                <Users className="w-6 h-6 text-emerald" />
                <span className="text-lg text-slate-700">Recruiter Performance Heatmap</span>
              </div>
            </div>

            <Button variant="outline" size="lg" className="group border-slate-300 hover:border-emerald/50">
              Analytics entdecken
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-900">Hiring Dashboard</h3>
                <span className="text-sm text-slate-500">Letzte 30 Tage</span>
              </div>

              {/* Metrics Grid - All emerald themed */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-emerald/10">
                  <p className="text-sm text-slate-600 mb-1">Time to Interview</p>
                  <p className="text-2xl font-bold text-slate-900">3.8 <span className="text-sm font-normal text-slate-500">Tage</span></p>
                  <p className="text-xs text-emerald font-medium">↓ 24% vs. Vormonat</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald/5">
                  <p className="text-sm text-slate-600 mb-1">Offer Acceptance</p>
                  <p className="text-2xl font-bold text-slate-900">87<span className="text-sm font-normal text-slate-500">%</span></p>
                  <p className="text-xs text-emerald font-medium">↑ 12% vs. Vormonat</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100">
                  <p className="text-sm text-slate-600 mb-1">Aktive Kandidaten</p>
                  <p className="text-2xl font-bold text-slate-900">124</p>
                  <p className="text-xs text-emerald font-medium">+18 diese Woche</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100">
                  <p className="text-sm text-slate-600 mb-1">Placements</p>
                  <p className="text-2xl font-bold text-slate-900">8</p>
                  <p className="text-xs text-slate-500">Ziel: 10</p>
                </div>
              </div>

              {/* Mini Chart - All emerald bars */}
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-sm font-medium text-slate-900 mb-4">Funnel Conversion</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-slate-500">Submitted</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full w-full bg-emerald rounded-full" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">248</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-slate-500">Opt-In</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full w-[72%] bg-emerald/80 rounded-full" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">178</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-slate-500">Interview</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full w-[45%] bg-emerald/60 rounded-full" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">112</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-slate-500">Offer</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full w-[18%] bg-emerald/40 rounded-full" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">45</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-slate-500">Placed</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full w-[15%] bg-emerald/30 rounded-full" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">38</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow Effect - Emerald only */}
            <div className="absolute -inset-4 bg-emerald/10 rounded-3xl blur-xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};
