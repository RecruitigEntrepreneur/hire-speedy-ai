import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export const FinalCTASection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-32 bg-background relative overflow-hidden">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "30px 30px",
        }}
      />

      <div className="container mx-auto px-4 relative z-10 text-center">
        <div ref={ref} className={`max-w-4xl mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 mb-8">
            <Sparkles className="w-4 h-4 text-foreground/60" />
            <span className="text-sm font-medium text-foreground/60">Put Precision into Your Hiring</span>
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-foreground">
            Start Hiring like it's{" "}
            <span className="text-foreground font-extrabold">2030</span>.
            <br />
            <span className="text-muted-foreground">Not like it's 2010.</span>
          </h2>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Die Zukunft des Recruitings ist hier. Und sie wartet nicht.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-10 py-7 text-xl font-semibold shadow-xl hover:scale-105 transition-all duration-300 relative group overflow-hidden">
              <Link to="/auth?tab=register&role=client">
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-background/20 to-transparent" />
                <span className="relative z-10 flex items-center">
                  Job in 60 Sekunden posten
                  <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-8 text-lg">
            Keine Kosten. Keine Bindung. Nur Ergebnisse.
          </p>
        </div>
      </div>
    </section>
  );
};
