import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, MessageSquareOff, Target } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTranslation } from "react-i18next";

const painPoints = [
  {
    icon: Clock,
    titleKey: "painPoints.item1_title",
    descriptionKey: "painPoints.item1_description",
  },
  {
    icon: MessageSquareOff,
    titleKey: "painPoints.item2_title",
    descriptionKey: "painPoints.item2_description",
  },
  {
    icon: Target,
    titleKey: "painPoints.item3_title",
    descriptionKey: "painPoints.item3_description",
  },
];

const PainCard = ({ point, index }: { point: typeof painPoints[0]; index: number }) => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`group p-8 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-xl transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <point.icon className="w-7 h-7 text-foreground" />
      </div>
      <h3 className="text-2xl font-bold mb-4 text-foreground">{t(`problem.${point.titleKey}`)}</h3>
      <p className="text-muted-foreground leading-relaxed">{t(`problem.${point.descriptionKey}`)}</p>
    </div>
  );
};

export const ProblemSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Subtle pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 40px, hsl(var(--foreground)) 40px, hsl(var(--foreground)) 41px)`,
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div
          ref={ref}
          className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-foreground">
            {t("problem.headline_main")}{" "}
            <span className="text-muted-foreground">{t("problem.headline_accent")}</span>
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
            {t("problem.intro")}
          </p>
          <p className="text-2xl md:text-3xl font-bold mt-4 text-foreground">
            {t("problem.tagline")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {painPoints.map((point, index) => (
            <PainCard key={index} point={point} index={index} />
          ))}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-lg group shadow-lg">
            <a href="#engine">
              {t("problem.cta")}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
