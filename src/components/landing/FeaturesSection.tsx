import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Shield, Workflow, Puzzle, Zap, EyeOff, Mail, MessageSquare, Calendar, DollarSign } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const features = [
  {
    id: "ai-matching", title: "AI Matching & Readiness Score",
    description: "Unsere KI bewertet nicht nur Skills. Sie versteht Motivation, Verhalten, kulturelle Passung und die Wahrscheinlichkeit eines Angebots.",
    icon: Brain,
    scores: [
      { label: "Skill Match", value: 94 }, { label: "Experience Fit", value: 88 },
      { label: "Salary Fit", value: 92 }, { label: "Readiness Score", value: 85 },
      { label: "Closing Probability", value: 78 },
    ],
    cta: "AI in Aktion sehen", reversed: false,
  },
  {
    id: "identity-protection", title: "Identity Protection / Triple Blind",
    description: "Kandidaten werden anonymisiert, bis sie zustimmen. Recruiter sehen keine Unternehmen. Unternehmen sehen keine Daten, bevor der Kandidat es erlaubt.",
    subtext: "Das ist Fairness. Das ist Compliance. Das ist die Zukunft.",
    icon: Shield, visual: "triple-blind", reversed: true,
  },
  {
    id: "automation", title: "Workflow Automation Engine",
    description: "Interviews planen sich selbst. Angebote verschicken sich selbst. Payments laufen automatisch. Erinnerungen eliminieren Ghosting.",
    icon: Workflow,
    automations: [
      { icon: Calendar, label: "Auto-Scheduling" }, { icon: Mail, label: "Email Sequences" },
      { icon: MessageSquare, label: "WhatsApp & SMS" }, { icon: DollarSign, label: "Escrow Payments" },
    ],
    reversed: false,
  },
  {
    id: "integrations", title: "ATS Integrationen", description: "Plug into everything you already use.",
    icon: Puzzle, integrations: ["Personio", "Greenhouse", "Lever", "Workday", "BambooHR"],
    cta: "Integrationen ansehen", reversed: true,
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <FeatureHeader />
        <div className="space-y-32">
          {features.map((feature, index) => (
            <FeatureBlock key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

const FeatureHeader = () => {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div ref={ref} className={`max-w-4xl mx-auto text-center mb-20 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
      <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">Deep Features</p>
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
        The Tools that Make You <span className="text-muted-foreground">Faster than Your Competition</span>
      </h2>
    </div>
  );
};

const FeatureBlock = ({ feature, index }: { feature: any; index: number }) => {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`flex flex-col ${feature.reversed ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12 lg:gap-20 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="flex-1 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-foreground flex items-center justify-center shadow-lg">
          <feature.icon className="w-8 h-8 text-background" />
        </div>
        <h3 className="text-3xl md:text-4xl font-bold">{feature.title}</h3>
        <p className="text-xl text-muted-foreground leading-relaxed">{feature.description}</p>
        {feature.subtext && <p className="text-lg font-semibold text-foreground">{feature.subtext}</p>}
        {feature.cta && (
          <Button variant="outline" className="group mt-4 border-foreground/20 hover:bg-foreground/5">
            {feature.cta}
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}
      </div>

      <div className="flex-1 w-full">
        {feature.scores && (
          <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-xl">
            <div className="space-y-4">
              {feature.scores.map((score: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{score.label}</span>
                    <span className="font-semibold">{score.value}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-foreground/60 rounded-full transition-all duration-1000" style={{ width: `${score.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {feature.visual === "triple-blind" && (
          <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-xl">
            <div className="grid grid-cols-3 gap-4">
              {[{ label: "Kandidat", sub: "anonymisiert" }, { label: "Recruiter", sub: "blind" }, { label: "Unternehmen", sub: "geschützt" }].map((item, i) => (
                <div key={i} className="text-center p-4 rounded-xl bg-muted/50">
                  <EyeOff className="w-8 h-8 mx-auto mb-2 text-foreground" />
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl bg-foreground/5 border border-foreground/10">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-foreground" />
                <span className="text-sm font-medium">100% DSGVO-konform</span>
              </div>
            </div>
          </div>
        )}

        {feature.automations && (
          <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-xl">
            <div className="grid grid-cols-2 gap-4">
              {feature.automations.map((auto: any, i: number) => (
                <div key={i} className="p-4 rounded-xl bg-muted/50 flex items-center gap-3 hover:bg-muted transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
                    <auto.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <span className="font-medium">{auto.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 text-foreground" />
              <span>Vollautomatisch – Zero Admin Work</span>
            </div>
          </div>
        )}

        {feature.integrations && (
          <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-xl">
            <div className="flex flex-wrap gap-4 justify-center">
              {feature.integrations.map((integration: string, i: number) => (
                <div key={i} className="px-6 py-3 rounded-xl bg-muted/50 font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  {integration}
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">+ weitere Integrationen auf Anfrage</p>
          </div>
        )}
      </div>
    </div>
  );
};
