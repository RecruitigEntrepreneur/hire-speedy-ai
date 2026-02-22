import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Shield, FileText, Sparkles } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const features = ["Keine Fixkosten", "Keine Retainer", "Keine Überraschungen", "Sie zahlen nur, wenn Sie wirklich einstellen"];

const trustFeatures = [
  { icon: Shield, text: "Automatisiertes Escrow" },
  { icon: FileText, text: "Digitale Rechnungen" },
  { icon: Sparkles, text: "Transparente Gebühren" },
];

export const PricingSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="pricing" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`max-w-4xl mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-12">
            <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">Pricing</p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Simple, Fair, <span className="text-muted-foreground">Aligned with You</span>
            </h2>
          </div>

          <div className="bg-card rounded-3xl p-8 md:p-12 border border-border/50 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-foreground/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 text-foreground font-medium mb-6">
                  <Sparkles className="w-4 h-4" />
                  Erfolgsbasiertes Modell
                </div>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <p key={index} className="text-xl md:text-2xl text-muted-foreground">
                      {feature}{index < features.length - 1 ? "." : <span className="text-foreground font-semibold">.</span>}
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-10">
                {trustFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                    <feature.icon className="w-5 h-5 text-foreground" />
                    <span className="font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-10 py-6 text-lg shadow-lg">
                  <Link to="/auth?tab=register&role=client">
                    Jetzt risikofrei starten
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground mt-4">Keine Kreditkarte erforderlich • Kostenlose Registrierung</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
