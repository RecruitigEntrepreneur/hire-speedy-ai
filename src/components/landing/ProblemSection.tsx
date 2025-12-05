import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, MessageSquareOff, Target } from "lucide-react";

const painPoints = [
  {
    icon: Clock,
    title: "Zeitverlust",
    description: "Prozesse, die Wochen dauern, statt Minuten. Jeder Tag ohne Besetzung kostet Geld und Produktivität.",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    glowColor: "group-hover:shadow-red-500/20",
  },
  {
    icon: MessageSquareOff,
    title: "Unkontrollierte Kommunikation",
    description: "Kandidaten springen ab. Recruiter funktionieren im Blindflug. Niemand weiß, wo der Prozess steht.",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    glowColor: "group-hover:shadow-orange-500/20",
  },
  {
    icon: Target,
    title: "Fehlanreize",
    description: "Kein Alignment zwischen Unternehmen, Recruitern und Kandidaten. Das System belohnt Quantität, nicht Qualität.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    glowColor: "group-hover:shadow-amber-500/20",
  },
];

export const ProblemSection = () => {
  return (
    <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
      {/* Animated Glitch Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated gradient spots */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] animate-aurora-1" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] animate-aurora-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] animate-aurora-3" />
        
        {/* Broken grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: 'skewY(-2deg)',
        }} />
        
        {/* Glitch lines */}
        <div className="absolute top-[20%] left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent animate-glitch-line" />
        <div className="absolute top-[40%] left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent animate-glitch-line" style={{ animationDelay: "1s" }} />
        <div className="absolute top-[60%] left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent animate-glitch-line" style={{ animationDelay: "2s" }} />
        <div className="absolute top-[80%] left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent animate-glitch-line" style={{ animationDelay: "0.5s" }} />
      </div>

      {/* Broken Pipeline Visual */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 150" className="w-full h-full">
          <defs>
            <linearGradient id="brokenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
              <stop offset="50%" stopColor="hsl(38, 92%, 50%)" />
              <stop offset="100%" stopColor="hsl(0, 84%, 60%)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Broken pipeline path */}
          <path 
            d="M10,75 Q30,50 50,75 T90,75" 
            stroke="url(#brokenGradient)" 
            strokeWidth="3" 
            fill="none" 
            strokeDasharray="8,8"
            filter="url(#glow)"
            className="animate-dash"
          />
          <path 
            d="M110,75 Q130,100 150,75 T190,75" 
            stroke="url(#brokenGradient)" 
            strokeWidth="3" 
            fill="none" 
            strokeDasharray="8,8"
            filter="url(#glow)"
            className="animate-dash"
            style={{ animationDelay: "0.5s" }}
          />
          
          {/* Break in the middle */}
          <text x="100" y="80" fill="hsl(0, 84%, 60%)" fontSize="20" textAnchor="middle" className="animate-pulse">✕</text>
          
          {/* Floating error nodes */}
          <circle cx="25" cy="65" r="6" fill="hsl(0, 84%, 60%)" opacity="0.6" className="animate-pulse" />
          <circle cx="70" cy="85" r="5" fill="hsl(38, 92%, 50%)" opacity="0.5" className="animate-pulse" style={{ animationDelay: "0.3s" }} />
          <circle cx="130" cy="65" r="6" fill="hsl(0, 84%, 60%)" opacity="0.6" className="animate-pulse" style={{ animationDelay: "0.6s" }} />
          <circle cx="175" cy="80" r="5" fill="hsl(38, 92%, 50%)" opacity="0.5" className="animate-pulse" style={{ animationDelay: "0.9s" }} />
        </svg>
      </div>

      {/* Floating error particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-red-500/40 rounded-full animate-float-particle"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${6 + Math.random() * 4}s`,
            }}
          />
        ))}
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
          <p className="text-2xl md:text-3xl font-semibold mt-4 bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
            Wir ersetzen Chaos durch Klarheit.
          </p>
        </div>

        {/* Pain Points */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {painPoints.map((point, index) => (
            <div 
              key={index}
              className={`group p-8 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm hover:bg-primary-foreground/10 hover:shadow-2xl ${point.glowColor} transition-all duration-500`}
            >
              <div className={`w-14 h-14 rounded-xl ${point.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <point.icon className={`w-7 h-7 ${point.color}`} />
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-red-400 transition-colors">{point.title}</h3>
              <p className="text-primary-foreground/70 leading-relaxed">
                {point.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg group shadow-lg shadow-emerald/30 hover:shadow-emerald/50 hover:scale-105 transition-all duration-300">
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
