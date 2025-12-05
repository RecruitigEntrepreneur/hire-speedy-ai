import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, TrendingUp, BadgeDollarSign } from "lucide-react";

const caseStudies = [
  {
    icon: Building2,
    metric: "6 Tage",
    title: "Engineering Lead eingestellt",
    description: "Von der Jobbeschreibung bis zum unterschriebenen Vertrag in unter einer Woche.",
    industry: "Tech Scale-Up",
    color: "from-emerald to-teal-500",
  },
  {
    icon: TrendingUp,
    metric: "+42%",
    title: "Offer Rate gesteigert",
    description: "Nach 3 Wochen Plattformnutzung signifikant bessere Annahmequoten.",
    industry: "Enterprise",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: BadgeDollarSign,
    metric: "80%",
    title: "Cost Reduction vs. Agency",
    description: "Deutlich geringere Kosten bei gleichzeitig besserer Qualität der Kandidaten.",
    industry: "Mittelstand",
    color: "from-purple-500 to-pink-500",
  },
];

export const CaseStudiesSection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Case Studies</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Proof that the System{" "}
            <span className="bg-gradient-to-r from-emerald to-blue-500 bg-clip-text text-transparent">
              Works
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {caseStudies.map((study, index) => (
            <div 
              key={index}
              className="group bg-card rounded-2xl p-8 border border-border/50 hover:border-emerald/30 hover:shadow-xl transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${study.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                <study.icon className="w-7 h-7 text-white" />
              </div>
              
              <p className="text-4xl font-bold mb-2">{study.metric}</p>
              <h3 className="text-xl font-bold mb-3">{study.title}</h3>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                {study.description}
              </p>
              
              <div className="pt-4 border-t border-border/50">
                <span className="text-sm text-muted-foreground">{study.industry}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" size="lg" className="group">
            Mehr Erfolge ansehen
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};
