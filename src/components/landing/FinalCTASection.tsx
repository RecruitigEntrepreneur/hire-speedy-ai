import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const FinalCTASection = () => {
  return (
    <section className="py-32 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground relative overflow-hidden">
      {/* Starfield Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Stars Layer 1 - Small */}
        {[...Array(50)].map((_, i) => (
          <div
            key={`star-1-${i}`}
            className="absolute w-0.5 h-0.5 bg-white rounded-full animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
        
        {/* Stars Layer 2 - Medium */}
        {[...Array(30)].map((_, i) => (
          <div
            key={`star-2-${i}`}
            className="absolute w-1 h-1 bg-white/80 rounded-full animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
        
        {/* Stars Layer 3 - Large with glow */}
        {[...Array(10)].map((_, i) => (
          <div
            key={`star-3-${i}`}
            className="absolute w-1.5 h-1.5 bg-white rounded-full animate-twinkle shadow-lg shadow-white/50"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${4 + Math.random() * 2}s`,
            }}
          />
        ))}

        {/* Aurora Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald/20 rounded-full blur-[150px] animate-aurora-1" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-[120px] animate-aurora-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[150px] animate-aurora-3" />
        
        {/* Central Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald/30 rounded-full blur-[100px] animate-glow-pulse" />

        {/* Shooting Stars */}
        <div className="absolute top-20 left-0 w-32 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent animate-shooting-star" style={{ animationDelay: "0s" }} />
        <div className="absolute top-40 right-0 w-24 h-0.5 bg-gradient-to-r from-transparent via-emerald to-transparent animate-shooting-star-reverse" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-32 left-1/4 w-20 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent animate-shooting-star" style={{ animationDelay: "4s" }} />
      </div>

      {/* Floating Particles with trails */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-2 h-2 rounded-full animate-float-particle"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${8 + Math.random() * 7}s`,
              background: `radial-gradient(circle, ${['hsl(152, 69%, 40%)', 'hsl(200, 100%, 60%)', 'hsl(280, 70%, 60%)'][i % 3]} 0%, transparent 70%)`,
            }}
          />
        ))}
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 mb-8 backdrop-blur-sm animate-fade-in">
            <Sparkles className="w-4 h-4 text-emerald animate-pulse" />
            <span className="text-sm font-medium">Put Precision into Your Hiring</span>
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Start Hiring like it's{" "}
            <span className="bg-gradient-to-r from-emerald via-cyan-400 to-emerald bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
              2030
            </span>
            .
            <br />
            <span className="text-primary-foreground/50">Not like it's 2010.</span>
          </h2>

          <p className="text-xl md:text-2xl text-primary-foreground/70 mb-12 max-w-2xl mx-auto">
            Die Zukunft des Recruitings ist hier. Und sie wartet nicht.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-10 py-7 text-xl font-semibold shadow-xl shadow-emerald/40 hover:shadow-emerald/60 hover:scale-105 transition-all duration-300 relative group">
              <Link to="/auth?tab=register&role=client">
                <span className="relative z-10 flex items-center">
                  Job in 60 Sekunden posten
                  <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </span>
                {/* Button Glow */}
                <div className="absolute inset-0 bg-emerald rounded-md blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
              </Link>
            </Button>
          </div>

          <p className="text-primary-foreground/50 mt-8 text-lg">
            Keine Kosten. Keine Bindung. Nur Ergebnisse.
          </p>
        </div>
      </div>
    </section>
  );
};
