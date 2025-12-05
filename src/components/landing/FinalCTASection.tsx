import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const FinalCTASection = () => {
  return (
    <section className="py-32 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-emerald/10 to-transparent rounded-full" />
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-[10%] w-2 h-2 bg-emerald rounded-full animate-float opacity-60" />
        <div className="absolute top-40 right-[20%] w-3 h-3 bg-blue-400 rounded-full animate-float" style={{ animationDelay: "0.5s" }} />
        <div className="absolute bottom-32 left-[25%] w-2 h-2 bg-purple-400 rounded-full animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-40 right-[15%] w-4 h-4 bg-emerald/50 rounded-full animate-float" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 mb-8">
            <Sparkles className="w-4 h-4 text-emerald" />
            <span className="text-sm font-medium">Put Precision into Your Hiring</span>
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Start Hiring like it's{" "}
            <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
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
            <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-10 py-7 text-xl font-semibold shadow-xl shadow-emerald/40 hover:shadow-emerald/60 transition-all">
              <Link to="/auth?tab=register&role=client">
                Job in 60 Sekunden posten
                <ArrowRight className="ml-2 w-6 h-6" />
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
