import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, Eye, Wallet, FileCheck, Server } from "lucide-react";

const securityFeatures = [
  { icon: Shield, title: "DSGVO + SOC2", description: "Vollständig compliant mit europäischen und internationalen Standards" },
  { icon: Lock, title: "End-to-End Encryption", description: "Alle Daten sind durchgehend verschlüsselt" },
  { icon: Eye, title: "Identity Protection", description: "Triple-Blind Anonymisierung schützt alle Parteien" },
  { icon: Wallet, title: "Escrow Engine", description: "Sichere Zahlungsabwicklung mit Treuhandservice" },
  { icon: FileCheck, title: "Audit Logs", description: "Lückenlose Dokumentation aller Aktivitäten" },
  { icon: Server, title: "EU Data Centers", description: "Daten werden ausschließlich in der EU gespeichert" },
];

export const TrustSecuritySection = () => {
  return (
    <section className="py-24 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Trust & Security</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Built for Enterprise.{" "}
            <span className="text-primary-foreground/60">Ready for Scale.</span>
          </h2>
          <p className="text-xl text-primary-foreground/80">
            Höchste Sicherheitsstandards für Ihre sensibelsten Recruiting-Daten.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {securityFeatures.map((feature, index) => (
            <div 
              key={index}
              className="p-6 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm hover:bg-primary-foreground/10 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald/20 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-emerald" />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-primary-foreground/70">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 group">
            Mehr über Sicherheit
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};
