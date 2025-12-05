import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const FinalCTASection = () => {
  return (
    <section className="py-32 bg-white relative overflow-hidden">
      {/* Modern Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Mesh */}
        <div 
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[120px]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--emerald)) 0%, transparent 70%)',
            animation: 'meshFloat1 15s ease-in-out infinite'
          }}
        />
        <div 
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.03] blur-[100px]"
          style={{
            background: 'radial-gradient(circle, hsl(200 100% 50%) 0%, transparent 70%)',
            animation: 'meshFloat2 18s ease-in-out infinite'
          }}
        />

        {/* Floating Emerald Dots */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-emerald/15 rounded-full"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 4) * 20}%`,
              animation: `floatDots ${8 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}

        {/* Subtle Grid */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(hsl(222 47% 11% / 0.2) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(222 47% 11% / 0.2) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Accent Lines */}
        <div className="absolute top-1/3 left-0 w-40 h-px bg-gradient-to-r from-emerald/30 to-transparent" />
        <div className="absolute bottom-1/3 right-0 w-32 h-px bg-gradient-to-l from-emerald/30 to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald/5 border border-emerald/20 mb-8">
            <Sparkles className="w-4 h-4 text-emerald" />
            <span className="text-sm font-medium text-emerald">Put Precision into Your Hiring</span>
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-slate-900">
            Start Hiring like it's{" "}
            <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
              2030
            </span>
            .
            <br />
            <span className="text-slate-300">Not like it's 2010.</span>
          </h2>

          <p className="text-xl md:text-2xl text-slate-500 mb-12 max-w-2xl mx-auto">
            Die Zukunft des Recruitings ist hier. Und sie wartet nicht.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-10 py-7 text-xl font-semibold shadow-xl shadow-emerald/20 hover:shadow-emerald/30 hover:scale-105 transition-all duration-300 relative group">
              <Link to="/auth?tab=register&role=client">
                <span className="relative z-10 flex items-center">
                  Job in 60 Sekunden posten
                  <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
          </div>

          <p className="text-slate-400 mt-8 text-lg">
            Keine Kosten. Keine Bindung. Nur Ergebnisse.
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes meshFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -20px) scale(1.05); }
          66% { transform: translate(-30px, 30px) scale(0.95); }
        }
        @keyframes meshFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 40px) scale(1.1); }
          66% { transform: translate(40px, -20px) scale(0.9); }
        }
        @keyframes floatDots {
          0%, 100% { transform: translateY(0); opacity: 0.15; }
          50% { transform: translateY(-15px); opacity: 0.3; }
        }
      `}</style>
    </section>
  );
};