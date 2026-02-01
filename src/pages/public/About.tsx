import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Target, Users, Zap, Heart } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Ergebnisorientiert",
    description: "Wir messen uns an Ihrem Erfolg. Keine Platzierung, keine Kosten.",
  },
  {
    icon: Users,
    title: "Menschenzentriert",
    description: "Technologie im Dienst von Menschen – nicht umgekehrt.",
  },
  {
    icon: Zap,
    title: "Geschwindigkeit",
    description: "Zeit ist im Recruiting alles. Wir beschleunigen jeden Schritt.",
  },
  {
    icon: Heart,
    title: "Fairness",
    description: "Transparente Prozesse für alle Beteiligten.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Über uns</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Die Zukunft des{" "}
              <span className="text-emerald">Recruitings</span>
            </h1>
            <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
              Wir verbinden die besten Unternehmen mit den besten Recruitern – 
              vollautomatisiert, fair und erfolgsorientiert.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Unsere Mission</h2>
            <p className="text-xl text-muted-foreground text-center leading-relaxed">
              Matchunt wurde gegründet, um den Recruiting-Prozess grundlegend zu transformieren. 
              Wir glauben, dass die beste Verbindung zwischen Unternehmen und Talenten durch 
              intelligente Technologie, faire Prozesse und messbare Ergebnisse entsteht.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Unsere Werte</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {values.map((value, index) => (
              <div key={index} className="bg-card rounded-2xl p-6 border border-border/50">
                <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-emerald" />
                </div>
                <h3 className="text-xl font-bold mb-2">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Bereit, loszulegen?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Starten Sie noch heute und erleben Sie die Zukunft des Recruitings.
          </p>
          <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white">
            <Link to="/auth?mode=signup">
              Jetzt starten
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
