import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, Eye, Wallet, FileCheck, Server } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const securityFeatures = [
  { icon: Shield, title: "DSGVO + SOC2", description: "Vollständig compliant mit europäischen und internationalen Standards" },
  { icon: Lock, title: "End-to-End Encryption", description: "Alle Daten sind durchgehend verschlüsselt" },
  { icon: Eye, title: "Identity Protection", description: "Triple-Blind Anonymisierung schützt alle Parteien" },
  { icon: Wallet, title: "Escrow Engine", description: "Sichere Zahlungsabwicklung mit Treuhandservice" },
  { icon: FileCheck, title: "Audit Logs", description: "Lückenlose Dokumentation aller Aktivitäten" },
  { icon: Server, title: "EU Data Centers", description: "Daten werden ausschließlich in der EU gespeichert" },
];

export const TrustSecuritySection = () => {
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
          <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">Trust & Security</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Built for Enterprise. <span className="text-muted-foreground">Ready for Scale.</span>
          </h2>
          <p className="text-xl text-muted-foreground">Höchste Sicherheitsstandards für Ihre sensibelsten Recruiting-Daten.</p>
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
                <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="outline" size="lg" className="border-foreground/20 hover:bg-foreground/5 group">
            Mehr über Sicherheit
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};
