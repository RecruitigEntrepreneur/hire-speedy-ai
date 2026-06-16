import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, Eye, Wallet, FileCheck, Server } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const securityFeatures = [
  { icon: Shield, titleKey: "features.item1_title", descriptionKey: "features.item1_description" },
  { icon: Lock, titleKey: "features.item2_title", descriptionKey: "features.item2_description" },
  { icon: Eye, titleKey: "features.item3_title", descriptionKey: "features.item3_description" },
  { icon: Wallet, titleKey: "features.item4_title", descriptionKey: "features.item4_description" },
  { icon: FileCheck, titleKey: "features.item5_title", descriptionKey: "features.item5_description" },
  { icon: Server, titleKey: "features.item6_title", descriptionKey: "features.item6_description" },
];

export const TrustSecuritySection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="security" className="py-24 bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div ref={ref} className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">{t("trustSecurity.eyebrow")}</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            {t("trustSecurity.headline1")} <span className="text-muted-foreground">{t("trustSecurity.headline2")}</span>
          </h2>
          <p className="text-xl text-muted-foreground">{t("trustSecurity.subline")}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {securityFeatures.map((feature, index) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal();
            return (
              <div
                key={index} ref={cardRef}
                className={`p-6 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-lg transition-all duration-500 group ${
                  cardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center mb-4 group-hover:bg-foreground/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{t(`trustSecurity.${feature.titleKey}`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`trustSecurity.${feature.descriptionKey}`)}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg" className="border-foreground/20 hover:bg-foreground/5 group">
            <Link to="/datenschutz">
              {t("trustSecurity.ctaPrivacy")}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
