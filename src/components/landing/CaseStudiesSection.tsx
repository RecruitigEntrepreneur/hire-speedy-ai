import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, TrendingUp, BadgeDollarSign } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const caseStudies = [
  { icon: Building2, metric: "6 Tage", title: "Engineering Lead eingestellt", description: "Von der Jobbeschreibung bis zum unterschriebenen Vertrag in unter einer Woche.", industry: "Tech Scale-Up" },
  { icon: TrendingUp, metric: "+42%", title: "Offer Rate gesteigert", description: "Nach 3 Wochen Plattformnutzung signifikant bessere Annahmequoten.", industry: "Enterprise" },
  { icon: BadgeDollarSign, metric: "80%", title: "Cost Reduction vs. Agency", description: "Deutlich geringere Kosten bei gleichzeitig besserer Qualität der Kandidaten.", industry: "Mittelstand" },
];

export const CaseStudiesSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">Case Studies</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Proof that the System <span className="text-muted-foreground">Works</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {caseStudies.map((study, index) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal();
            return (
              <div
                key={index} ref={cardRef}
                className={`group bg-card rounded-2xl p-8 border border-border/50 hover:border-foreground/20 hover:shadow-xl transition-all duration-500 ${
                  cardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-foreground flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <study.icon className="w-7 h-7 text-background" />
                </div>
                <p className="text-4xl font-bold text-foreground mb-2">{study.metric}</p>
                <h3 className="text-xl font-bold text-foreground mb-3">{study.title}</h3>
                <p className="text-muted-foreground mb-4 leading-relaxed">{study.description}</p>
                <div className="pt-4 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">{study.industry}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="outline" size="lg" className="group border-foreground/20 hover:bg-foreground/5">
            Mehr Erfolge ansehen
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};
