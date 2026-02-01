import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Clock, Users, Rocket, Heart, Zap } from "lucide-react";

const openPositions = [
  {
    title: "Senior Full-Stack Engineer",
    department: "Engineering",
    location: "Berlin / Remote",
    type: "Vollzeit",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Berlin",
    type: "Vollzeit",
  },
  {
    title: "Account Executive",
    department: "Sales",
    location: "Berlin / München",
    type: "Vollzeit",
  },
  {
    title: "Customer Success Manager",
    department: "Customer Success",
    location: "Remote",
    type: "Vollzeit",
  },
];

const benefits = [
  { icon: Rocket, title: "Startup Spirit", description: "Schnelle Entscheidungen, echte Verantwortung" },
  { icon: Heart, title: "Work-Life Balance", description: "Flexible Arbeitszeiten, Remote-Option" },
  { icon: Users, title: "Starkes Team", description: "Lernen von den Besten der Branche" },
  { icon: Zap, title: "Wachstum", description: "Persönliche und fachliche Entwicklung" },
];

export default function Careers() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Karriere</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Gestalte die Zukunft des{" "}
              <span className="text-emerald">Recruitings</span>
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Werde Teil eines Teams, das die Art und Weise verändert, wie Unternehmen Talente finden.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Warum Matchunt?</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-8 h-8 text-emerald" />
                  </div>
                  <h3 className="font-bold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Offene Stellen</h2>
            <div className="space-y-4">
              {openPositions.map((position, index) => (
                <div key={index} className="bg-card rounded-2xl p-6 border border-border/50 hover:shadow-lg hover:border-emerald/30 transition-all group cursor-pointer">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald">{position.department}</span>
                      <h3 className="text-xl font-bold group-hover:text-emerald transition-colors">{position.title}</h3>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {position.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {position.type}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" className="group/btn whitespace-nowrap">
                      Bewerben
                      <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12 p-8 bg-card rounded-2xl border border-border/50">
              <h3 className="text-xl font-bold mb-2">Keine passende Stelle dabei?</h3>
              <p className="text-muted-foreground mb-4">
                Initiativbewerbungen sind immer willkommen. Zeig uns, was du kannst!
              </p>
              <Button className="bg-emerald hover:bg-emerald-light text-white">
                Initiativbewerbung senden
              </Button>
            </div>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
