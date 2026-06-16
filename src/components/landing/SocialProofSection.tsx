import { BadgeCheck, ShieldCheck, Wallet } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const principles = [
  {
    icon: Wallet,
    title: "Erfolgsbasiert",
    description: "Keine Fixkosten, keine Retainer. Bezahlt wird ausschließlich bei erfolgreicher Einstellung – abgesichert über Escrow.",
  },
  {
    icon: BadgeCheck,
    title: "Geprüfte Recruiter",
    description: "Jeder Recruiter auf der Plattform wird persönlich verifiziert, bevor er Kandidaten vorschlagen darf.",
  },
  {
    icon: ShieldCheck,
    title: "Diskretion by Design",
    description: "Triple-Blind-Anonymisierung schützt Kandidaten, Recruiter und Unternehmen. Deshalb nennen wir auch keine Kundennamen – Diskretion ist unser Produkt.",
  },
];

const MARQUEE_TEXT = "Schneller · Präziser · Fairer · Ergebnisorientiert · ";

export const SocialProofSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="why-us" className="py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={`max-w-3xl mx-auto text-center mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-muted-foreground text-sm uppercase tracking-wider mb-4">
            Gebaut mit Recruitern und Hiring-Teams aus dem DACH-Markt
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Drei Prinzipien statt großer Versprechen
          </h2>
        </div>

        {/* Principles */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-6xl mx-auto">
          {principles.map((principle, index) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal();
            return (
              <div
                key={index}
                ref={cardRef}
                className={`text-center p-8 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-lg transition-all duration-500 ${
                  cardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-foreground/10 flex items-center justify-center mx-auto mb-6">
                  <principle.icon className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{principle.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{principle.description}</p>
              </div>
            );
          })}
        </div>

        {/* Marquee Band */}
        <div className="overflow-hidden -mx-4">
          <div className="flex animate-scroll-x whitespace-nowrap">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="text-4xl md:text-6xl font-bold text-foreground/[0.04] mx-0 select-none">
                {MARQUEE_TEXT}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
