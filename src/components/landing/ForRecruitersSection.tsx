import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Brain, Trophy, Zap, Scale, CheckCircle2 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTranslation } from "react-i18next";

const benefits = [
  { icon: Briefcase, textKey: "benefits.item1_text" },
  { icon: Brain, textKey: "benefits.item2_text" },
  { icon: Trophy, textKey: "benefits.item3_text" },
  { icon: Zap, textKey: "benefits.item4_text" },
  { icon: Scale, textKey: "benefits.item5_text" },
];

const notifications = [
  "notifications.item1_text",
  "notifications.item2_text",
  "notifications.item3_text",
];

export const ForRecruitersSection = () => {
  const { ref, isVisible } = useScrollReveal();
  const { t } = useTranslation();

  return (
    <section id="for-recruiters" className="py-24 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1/2 h-full opacity-[0.02]">
        <div className="absolute top-20 left-20 w-64 h-64 bg-foreground rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-40 w-48 h-48 bg-foreground/50 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div ref={ref} className={`grid lg:grid-cols-2 gap-16 items-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div>
            <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">{t("forRecruiters.eyebrow")}</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              {t("forRecruiters.headline1")} <span className="text-muted-foreground">{t("forRecruiters.headline2")}</span> {t("forRecruiters.headline3")}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              {t("forRecruiters.intro")}
            </p>

            <div className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center group-hover:bg-foreground/20 transition-colors">
                    <benefit.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <span className="text-lg font-medium">{t(`forRecruiters.${benefit.textKey}`)}</span>
                </div>
              ))}
            </div>

            <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-lg shadow-lg">
              <Link to="/auth?mode=signup&role=recruiter">
                {t("forRecruiters.cta")}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>

          <div className="relative">
            <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-background" />
                </div>
                <div>
                  <p className="font-bold text-lg">{t("forRecruiters.cockpit_title")}</p>
                  <p className="text-muted-foreground">{t("forRecruiters.cockpit_subtitle")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-lg font-bold">{t("forRecruiters.stat1_title")}</p>
                  <p className="text-sm text-muted-foreground">{t("forRecruiters.stat1_text")}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-lg font-bold text-foreground">{t("forRecruiters.stat2_title")}</p>
                  <p className="text-sm text-muted-foreground">{t("forRecruiters.stat2_text")}</p>
                </div>
              </div>

              <div className="space-y-3">
                {notifications.map((textKey, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-foreground/5 border border-foreground/10">
                    <span className="font-medium">{t(`forRecruiters.${textKey}`)}</span>
                    <CheckCircle2 className="w-5 h-5 text-foreground" />
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-foreground text-background px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
              {t("forRecruiters.badge")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
