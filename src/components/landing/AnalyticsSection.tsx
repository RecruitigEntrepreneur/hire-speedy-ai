import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Clock, Users, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const features = [
  { icon: Clock, textKey: "features.item1_text" },
  { icon: TrendingUp, textKey: "features.item2_text" },
  { icon: BarChart3, textKey: "features.item3_text" },
  { icon: Users, textKey: "features.item4_text" },
];

const metrics = [
  { labelKey: "metrics.item1_label", value: "3.8", unitKey: "metrics.item1_unit", trendKey: "metrics.item1_trend" },
  { labelKey: "metrics.item2_label", value: "87", unitKey: "metrics.item2_unit", trendKey: "metrics.item2_trend" },
  { labelKey: "metrics.item3_label", value: "124", unitKey: "metrics.item3_unit", trendKey: "metrics.item3_trend" },
  { labelKey: "metrics.item4_label", value: "8", unitKey: "metrics.item4_unit", trendKey: "metrics.item4_trend" },
];

const funnel = [
  { labelKey: "funnel.item1_label", w: "100%", count: "248" },
  { labelKey: "funnel.item2_label", w: "72%", count: "178" },
  { labelKey: "funnel.item3_label", w: "45%", count: "112" },
  { labelKey: "funnel.item4_label", w: "18%", count: "45" },
  { labelKey: "funnel.item5_label", w: "15%", count: "38" },
];

export const AnalyticsSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="analytics" className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`grid lg:grid-cols-2 gap-16 items-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div>
            <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">{t("analytics.eyebrow")}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t("analytics.headline1")} <span className="text-muted-foreground">{t("analytics.headline2")}</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              {t("analytics.subline")}
            </p>
            <div className="space-y-4 mb-8">
              {features.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <item.icon className="w-6 h-6 text-foreground" />
                  <span className="text-lg text-foreground/80">{t(`analytics.${item.textKey}`)}</span>
                </div>
              ))}
            </div>
            <Button asChild variant="outline" size="lg" className="group border-foreground/20 hover:bg-foreground/5">
              <Link to="/auth?mode=signup&role=client">
                {t("analytics.cta")}
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative" style={{ perspective: "1200px" }}>
            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-xl" style={{ transform: "rotateX(2deg)", transformOrigin: "center bottom" }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-foreground">{t("analytics.dashboard.title")}</h3>
                <span className="text-sm text-muted-foreground">{t("analytics.dashboard.period")}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {metrics.map((m, i) => (
                  <div key={i} className="p-4 rounded-xl bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">{t(`analytics.${m.labelKey}`)}</p>
                    <p className="text-2xl font-bold text-foreground">{m.value}<span className="text-sm font-normal text-muted-foreground ml-1">{t(`analytics.${m.unitKey}`)}</span></p>
                    <p className="text-xs text-foreground/60 font-medium">{t(`analytics.${m.trendKey}`)}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-muted/20">
                <p className="text-sm font-medium text-foreground mb-4">{t("analytics.funnel.title")}</p>
                <div className="space-y-3">
                  {funnel.map((bar, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs w-20 text-muted-foreground">{t(`analytics.${bar.labelKey}`)}</span>
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
