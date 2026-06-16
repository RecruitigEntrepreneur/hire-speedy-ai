import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Users, CalendarCheck, CheckCircle2 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTranslation } from "react-i18next";

const steps = [
  {
    number: "01", titleKey: "steps.item1_title", subtitleKey: "steps.item1_subtitle",
    descriptionKey: "steps.item1_description",
    icon: Upload, detailKeys: ["steps.item1_detail1", "steps.item1_detail2", "steps.item1_detail3", "steps.item1_detail4"],
  },
  {
    number: "02", titleKey: "steps.item2_title", subtitleKey: "steps.item2_subtitle",
    descriptionKey: "steps.item2_description",
    icon: Users, detailKeys: ["steps.item2_detail1", "steps.item2_detail2", "steps.item2_detail3", "steps.item2_detail4"],
  },
  {
    number: "03", titleKey: "steps.item3_title", subtitleKey: "steps.item3_subtitle",
    descriptionKey: "steps.item3_description",
    icon: CalendarCheck, detailKeys: ["steps.item3_detail1", "steps.item3_detail2", "steps.item3_detail3", "steps.item3_detail4"],
  },
];

const StepCard = ({ step, index }: { step: typeof steps[0]; index: number }) => {
  const { ref, isVisible } = useScrollReveal();
  const { t } = useTranslation();
  return (
    <div ref={ref} className={`relative transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${index * 150}ms` }}>
      <div className="bg-card rounded-2xl p-8 border border-border/50 hover:border-foreground/20 hover:shadow-xl transition-all duration-300 h-full">
        <div className="relative mb-8">
          <div className="w-16 h-16 rounded-2xl bg-foreground flex items-center justify-center shadow-lg mx-auto lg:mx-0">
            <step.icon className="w-8 h-8 text-background" />
          </div>
          <span className="absolute -top-2 -right-2 lg:left-12 lg:right-auto w-8 h-8 rounded-full bg-muted text-foreground text-sm font-bold flex items-center justify-center border border-border">
            {step.number}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">{t(`howItWorks.${step.titleKey}`)}</h3>
        <p className="text-muted-foreground font-medium mb-4">{t(`howItWorks.${step.subtitleKey}`)}</p>
        <p className="text-muted-foreground mb-6 leading-relaxed">{t(`howItWorks.${step.descriptionKey}`)}</p>
        <div className="space-y-2">
          {step.detailKeys.map((detailKey, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-foreground" />
              <span>{t(`howItWorks.${detailKey}`)}</span>
            </div>
          ))}
        </div>
      </div>
      {index < steps.length - 1 && (
        <div className="flex justify-center py-4 lg:hidden">
          <ArrowRight className="w-6 h-6 text-muted-foreground/30 rotate-90" />
        </div>
      )}
    </div>
  );
};

export const HowItWorksSection = () => {
  const { ref, isVisible } = useScrollReveal();
  const { t } = useTranslation();
  return (
    <section id="how-it-works" className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div ref={ref} className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">{t("howItWorks.eyebrow")}</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">{t("howItWorks.heading")}</h2>
          <p className="text-xl text-muted-foreground">{t("howItWorks.subline")}</p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-4 relative">
            <div className="hidden lg:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5 bg-foreground/10" />
            {steps.map((step, index) => <StepCard key={index} step={step} index={index} />)}
          </div>
        </div>

        <div className="text-center mt-16">
          <p className="text-2xl font-semibold text-muted-foreground mb-8">
            „{t("howItWorks.quote_part1")} <span className="text-foreground font-bold">{t("howItWorks.quote_part2")}</span>"
          </p>
          <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-lg shadow-lg">
            <Link to="/auth?mode=signup&role=client">
              {t("howItWorks.cta")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
