import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, MessageSquareOff, Target } from "lucide-react";

const painPoints = [
  {
    icon: Clock,
    title: "Zeitverlust",
    description: "Prozesse, die Wochen dauern, statt Minuten. Jeder Tag ohne Besetzung kostet Geld und Produktivität.",
    color: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-100",
  },
  {
    icon: MessageSquareOff,
    title: "Unkontrollierte Kommunikation",
    description: "Kandidaten springen ab. Recruiter funktionieren im Blindflug. Niemand weiß, wo der Prozess steht.",
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-100",
  },
  {
    icon: Target,
    title: "Fehlanreize",
    description: "Kein Alignment zwischen Unternehmen, Recruitern und Kandidaten. Das System belohnt Quantität, nicht Qualität.",
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-100",
  },
];

export const ProblemSection = () => {
  return (
    <section className="py-24 bg-slate-50 relative overflow-hidden">
      {/* Subtle Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Diagonal Lines Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 40px,
              hsl(222 47% 11%) 40px,
              hsl(222 47% 11%) 41px
            )`
          }}
        />
        
        {/* Subtle glow orbs */}
        <div 
          className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03] blur-[100px]"
          style={{
            background: 'radial-gradient(circle, hsl(0 84% 60%) 0%, transparent 70%)',
            animation: 'pulseGlow 8s ease-in-out infinite'
          }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-[0.03] blur-[80px]"
          style={{
            background: 'radial-gradient(circle, hsl(38 92% 50%) 0%, transparent 70%)',
            animation: 'pulseGlow 10s ease-in-out infinite',
            animationDelay: '2s'
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-slate-900">
            Hiring is Broken.{" "}
            <span className="text-slate-400">Everywhere.</span>
          </h2>
          <p className="text-xl md:text-2xl text-slate-600 leading-relaxed">
            Das heutige Recruiting-System ist ein Flickenteppich aus Tools, E-Mails, 
            ATS-Systemen, Freelancern, Agenturen und Zufällen.
          </p>
          <p className="text-2xl md:text-3xl font-semibold mt-4 bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
            Wir ersetzen Chaos durch Klarheit.
          </p>
        </div>

        {/* Pain Points */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {painPoints.map((point, index) => (
            <div 
              key={index}
              className={`group p-8 rounded-2xl bg-white border ${point.borderColor} shadow-sm hover:shadow-lg transition-all duration-500`}
            >
              <div className={`w-14 h-14 rounded-xl ${point.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <point.icon className={`w-7 h-7 ${point.color}`} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 group-hover:text-red-500 transition-colors">{point.title}</h3>
              <p className="text-slate-600 leading-relaxed">
                {point.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg group shadow-lg shadow-emerald/20 hover:shadow-emerald/30 hover:scale-105 transition-all duration-300">
            <a href="#engine">
              So lösen wir das Problem
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.03; transform: scale(1); }
          50% { opacity: 0.05; transform: scale(1.1); }
        }
      `}</style>
    </section>
  );
};