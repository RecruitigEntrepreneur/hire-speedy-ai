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
    <section id="security" className="py-24 bg-white relative overflow-hidden">
      {/* Subtle animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating gradient orbs */}
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-emerald/5 rounded-full blur-3xl animate-[float_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-20 right-[10%] w-96 h-96 bg-emerald/3 rounded-full blur-3xl animate-[float_25s_ease-in-out_infinite_reverse]" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgb(16, 185, 129) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(16, 185, 129) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Trust & Security</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
            Built for Enterprise.{" "}
            <span className="text-slate-400">Ready for Scale.</span>
          </h2>
          <p className="text-xl text-slate-600">
            Höchste Sicherheitsstandards für Ihre sensibelsten Recruiting-Daten.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {securityFeatures.map((feature, index) => (
            <div 
              key={index}
              className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald/30 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center mb-4 group-hover:bg-emerald/20 transition-colors">
                <feature.icon className="w-6 h-6 text-emerald" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" size="lg" className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-emerald/50 group">
            Mehr über Sicherheit
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
      `}</style>
    </section>
  );
};
