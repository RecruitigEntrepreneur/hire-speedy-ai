import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, MessageSquareOff, Target } from "lucide-react";

const painPoints = [
  {
    icon: Clock,
    title: "Zeitverlust",
    description: "Prozesse, die Wochen dauern, statt Minuten. Jeder Tag ohne Besetzung kostet Geld und Produktivität.",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    icon: MessageSquareOff,
    title: "Unkontrollierte Kommunikation",
    description: "Kandidaten springen ab. Recruiter funktionieren im Blindflug. Niemand weiß, wo der Prozess steht.",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: Target,
    title: "Fehlanreize",
    description: "Kein Alignment zwischen Unternehmen, Recruitern und Kandidaten. Das System belohnt Quantität, nicht Qualität.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

export const ProblemSection = () => {
  return (
    <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Broken Pipeline Visual */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-10">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="brokenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
              <stop offset="100%" stopColor="hsl(38, 92%, 50%)" />
            </linearGradient>
          </defs>
          <path 
            d="M20,100 Q50,80 80,100 T140,100" 
            stroke="url(#brokenGradient)" 
            strokeWidth="4" 
            fill="none" 
            strokeDasharray="10,10"
          />
          <circle cx="30" cy="95" r="8" fill="hsl(0, 84%, 60%)" opacity="0.5" />
          <circle cx="100" cy="100" r="8" fill="hsl(38, 92%, 50%)" opacity="0.5" />
          <circle cx="170" cy="105" r="8" fill="hsl(0, 84%, 60%)" opacity="0.5" />
        </svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8">
            Hiring is Broken.{" "}
            <span className="text-primary-foreground/60">Everywhere.</span>
          </h2>
          <p className="text-xl md:text-2xl text-primary-foreground/80 leading-relaxed">
            Das heutige Recruiting-System ist ein Flickenteppich aus Tools, E-Mails, 
            ATS-Systemen, Freelancern, Agenturen und Zufällen.
          </p>
          <p className="text-2xl md:text-3xl font-semibold mt-4 text-emerald">
            Wir ersetzen Chaos durch Klarheit.
          </p>
        </div>

        {/* Pain Points */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {painPoints.map((point, index) => (
            <div 
              key={index}
              className="p-8 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm hover:bg-primary-foreground/10 transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-xl ${point.bgColor} flex items-center justify-center mb-6`}>
                <point.icon className={`w-7 h-7 ${point.color}`} />
              </div>
              <h3 className="text-2xl font-bold mb-4">{point.title}</h3>
              <p className="text-primary-foreground/70 leading-relaxed">
                {point.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg group">
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
