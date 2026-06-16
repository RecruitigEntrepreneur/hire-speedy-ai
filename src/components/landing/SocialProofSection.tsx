import { BadgeCheck, ShieldCheck, Wallet } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTranslation } from "react-i18next";

const principles = [
  {
    icon: Wallet,
    titleKey: "principles.item1_title",
    descriptionKey: "principles.item1_description",
  },
  {
    icon: BadgeCheck,
    titleKey: "principles.item2_title",
    descriptionKey: "principles.item2_description",
  },
  {
    icon: ShieldCheck,
    titleKey: "principles.item3_title",
    descriptionKey: "principles.item3_description",
  },
];

const MARQUEE_TEXT_KEY = "marqueeText";

export const SocialProofSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="why-us" className="py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={`max-w-3xl mx-auto text-center mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-muted-foreground text-sm uppercase tracking-wider mb-4">
            {t("socialProof.eyebrow")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            {t("socialProof.heading")}
          </h2>
        </div>

        {/* Principles */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-6xl mx-auto">
          {principles.map((principle, index) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal();
            return (
              <div
                key={index}
                ref={cardRef}
                className={`text-center p-8 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-lg transition-all duration-500 ${
                  cardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-foreground/10 flex items-center justify-center mx-auto mb-6">
                  <principle.icon className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{t(`socialProof.${principle.titleKey}`)}</h3>
                <p className="text-muted-foreground leading-relaxed">{t(`socialProof.${principle.descriptionKey}`)}</p>
              </div>
            );
          })}
        </div>

        {/* Marquee Band */}
        <div className="overflow-hidden -mx-4">
          <div className="flex animate-scroll-x whitespace-nowrap">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="text-4xl md:text-6xl font-bold text-foreground/[0.04] mx-0 select-none">
                {t(`socialProof.${MARQUEE_TEXT_KEY}`)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
