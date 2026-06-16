import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Shield, FileText, Sparkles } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTranslation } from "react-i18next";

const features = ["features.item1", "features.item2", "features.item3", "features.item4"];

const trustFeatures = [
  { icon: Shield, textKey: "trustFeatures.item1_text" },
  { icon: FileText, textKey: "trustFeatures.item2_text" },
  { icon: Sparkles, textKey: "trustFeatures.item3_text" },
];

export const PricingSection = () => {
  const { ref, isVisible } = useScrollReveal();
  const { t } = useTranslation();

  return (
    <section id="pricing" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`max-w-4xl mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-12">
            <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">{t("pricing.eyebrow")}</p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              {t("pricing.headline1")} <span className="text-muted-foreground">{t("pricing.headline2")}</span>
            </h2>
          </div>

          <div className="bg-card rounded-3xl p-8 md:p-12 border border-border/50 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-foreground/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 text-foreground font-medium mb-6">
                  <Sparkles className="w-4 h-4" />
                  {t("pricing.modelBadge")}
                </div>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <p key={index} className="text-xl md:text-2xl text-muted-foreground">
                      {t(`pricing.${feature}`)}{index < features.length - 1 ? "." : <span className="text-foreground font-semibold">.</span>}
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-10">
                {trustFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                    <feature.icon className="w-5 h-5 text-foreground" />
                    <span className="font-medium">{t(`pricing.${feature.textKey}`)}</span>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-10 py-6 text-lg shadow-lg">
                  <Link to="/auth?mode=signup&role=client">
                    {t("pricing.cta")}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground mt-4">{t("pricing.ctaNote")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
