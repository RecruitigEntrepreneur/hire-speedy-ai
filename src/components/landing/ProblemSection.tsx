import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, MessageSquareOff, Target } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const painPoints = [
  {
    icon: Clock,
    title: "Zeitverlust",
    description: "Prozesse, die Wochen dauern, statt Minuten. Jeder Tag ohne Besetzung kostet Geld und Produktivität.",
  },
  {
    icon: MessageSquareOff,
    title: "Unkontrollierte Kommunikation",
    description: "Kandidaten springen ab. Recruiter funktionieren im Blindflug. Niemand weiß, wo der Prozess steht.",
  },
  {
    icon: Target,
    title: "Fehlanreize",
    description: "Kein Alignment zwischen Unternehmen, Recruitern und Kandidaten. Das System belohnt Quantität, nicht Qualität.",
  },
];

const PainCard = ({ point, index }: { point: typeof painPoints[0]; index: number }) => {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`group p-8 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-xl transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <point.icon className="w-7 h-7 text-foreground" />
      </div>
      <h3 className="text-2xl font-bold mb-4 text-foreground">{point.title}</h3>
      <p className="text-muted-foreground leading-relaxed">{point.description}</p>
    </div>
  );
};

export const ProblemSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Subtle pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 40px, hsl(var(--foreground)) 40px, hsl(var(--foreground)) 41px)`,
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div
          ref={ref}
          className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-foreground">
            Hiring is Broken.{" "}
            <span className="text-muted-foreground">Everywhere.</span>
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
            Das heutige Recruiting-System ist ein Flickenteppich aus Tools, E-Mails,
            ATS-Systemen, Freelancern, Agenturen und Zufällen.
          </p>
          <p className="text-2xl md:text-3xl font-bold mt-4 text-foreground">
            Wir ersetzen Chaos durch Klarheit.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {painPoints.map((point, index) => (
            <PainCard key={index} point={point} index={index} />
          ))}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-lg group shadow-lg">
            <a href="#engine">
              So lösen wir das Problem
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
