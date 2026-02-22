import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, BadgeDollarSign, Eye, BarChart3 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const benefits = [
  { icon: Clock, title: "Bewerber in Tagen, nicht Wochen", description: "Durchschnittlich 3,8 Tage bis zum ersten Interview – statt wochenlanger Wartezeit." },
  { icon: BadgeDollarSign, title: "Erfolgsbasiertes Modell", description: "Sie zahlen nur, wenn Sie tatsächlich einstellen. Keine Fixkosten, keine Retainer." },
  { icon: Eye, title: "Transparenz & volle Kontrolle", description: "Sehen Sie jeden Schritt im Prozess. Jederzeit. In Echtzeit." },
  { icon: BarChart3, title: "Deep Analytics & Funnel Insights", description: "Verstehen Sie, wo Kandidaten abspringen und optimieren Sie Ihre Hiring-Pipeline." },
];

export const ForCompaniesSection = () => {
  const { ref, isVisible } = useScrollReveal();
  return (
    <section id="for-companies" className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div ref={ref} className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">Für Unternehmen</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground">Hire with Precision</h2>
          <p className="text-xl text-muted-foreground">Die schnellste und effektivste Art, Top-Talente zu finden und einzustellen.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16">
          {benefits.map((benefit, index) => {
            const { ref: cardRef, isVisible: cardVisible } = useScrollReveal();
            return (
              <div
                key={index} ref={cardRef}
                className={`p-8 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-lg transition-all duration-500 group ${
                  cardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <benefit.icon className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-lg shadow-lg">
            <Link to="/auth?tab=register&role=client">
              Job starten
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
