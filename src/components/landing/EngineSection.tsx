import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Users, Shield, Workflow, BarChart3 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTranslation } from "react-i18next";

const layers = [
  { icon: Brain, titleKey: "layer1_title", descriptionKey: "layer1_description" },
  { icon: Users, titleKey: "layer2_title", descriptionKey: "layer2_description" },
  { icon: Shield, titleKey: "layer3_title", descriptionKey: "layer3_description" },
  { icon: Workflow, titleKey: "layer4_title", descriptionKey: "layer4_description" },
  { icon: BarChart3, titleKey: "layer5_title", descriptionKey: "layer5_description" },
];

const LayerCard = ({ layer, index }: { layer: typeof layers[0]; index: number }) => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`group relative p-6 md:p-8 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-xl transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="absolute inset-0 rounded-2xl bg-foreground/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center text-xl font-bold">
          {index + 1}
        </div>
        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
          <layer.icon className="w-7 h-7 text-background" />
        </div>
        <div className="flex-grow">
          <h3 className="text-xl md:text-2xl font-bold mb-2 group-hover:text-foreground/80 transition-colors">{t(`engine.${layer.titleKey}`)}</h3>
          <p className="text-muted-foreground">{t(`engine.${layer.descriptionKey}`)}</p>
        </div>
        <ArrowRight className="w-6 h-6 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-2 transition-all hidden md:block" />
      </div>
      {index < layers.length - 1 && (
        <div className="absolute left-[2.25rem] top-full w-0.5 h-6 bg-foreground/20 hidden md:block" />
      )}
    </div>
  );
};

export const EngineSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="engine" className="py-24 bg-background relative overflow-hidden">
      {/* Animated Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-[800px] h-[800px] rounded-full border border-border/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slow" />
        <div className="w-[600px] h-[600px] rounded-full border border-border/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-reverse">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-foreground/30 rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-foreground/20 rounded-full" />
        </div>
        <div className="w-[400px] h-[400px] rounded-full border border-border/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slow" style={{ animationDuration: "40s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-foreground/25 rounded-full" />
        </div>
        <div className="w-[200px] h-[200px] rounded-full border-2 border-foreground/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse" />
        <div className="w-[100px] h-[100px] rounded-full bg-foreground/5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse blur-xl" />
      </div>

      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background pointer-events-none" />
      <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-background to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div
          ref={ref}
          className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            {t("engine.heading1")} <span className="text-muted-foreground">{t("engine.heading2")}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            {t("engine.subline1")}
            <br />
            {t("engine.subline2")}
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid gap-6">
          {layers.map((layer, index) => (
            <LayerCard key={index} layer={layer} index={index} />
          ))}
        </div>

        <div className="text-center mt-16">
          <Button asChild size="lg" variant="outline" className="group border-foreground/20 hover:bg-foreground/5">
            <a href="#features">
              {t("engine.cta")}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
