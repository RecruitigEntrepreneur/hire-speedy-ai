import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, Users, CheckCircle } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-navy-light to-emerald/20">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-emerald/5 to-transparent rounded-full" />
      </div>

      {/* Floating UI Cards */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-[10%] glass-card-dark p-4 rounded-xl animate-float opacity-80" style={{ animationDelay: "0s" }}>
          <div className="flex items-center gap-2 text-primary-foreground/90">
            <div className="w-8 h-8 rounded-lg bg-emerald/20 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-emerald" />
            </div>
            <span className="text-sm font-medium">Job Upload</span>
          </div>
        </div>
        <div className="absolute top-32 right-[15%] glass-card-dark p-4 rounded-xl animate-float opacity-80" style={{ animationDelay: "0.5s" }}>
          <div className="flex items-center gap-2 text-primary-foreground/90">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">AI</span>
            </div>
            <span className="text-sm font-medium">Analyse läuft...</span>
          </div>
        </div>
        <div className="absolute bottom-40 left-[15%] glass-card-dark p-4 rounded-xl animate-float opacity-80" style={{ animationDelay: "1s" }}>
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald to-emerald-light" />
            <div>
              <p className="text-sm font-medium">3 Kandidaten</p>
              <p className="text-xs text-primary-foreground/60">Match Score: 94%</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-32 right-[10%] glass-card-dark p-4 rounded-xl animate-float opacity-80" style={{ animationDelay: "1.5s" }}>
          <div className="flex items-center gap-2 text-primary-foreground/90">
            <CheckCircle className="w-5 h-5 text-emerald" />
            <span className="text-sm font-medium">Offer Accepted</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-primary-foreground leading-tight tracking-tight">
            Hiring.{" "}
            <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
              Rebuilt from Zero.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-primary-foreground/80 font-medium">
            Powered by AI. Delivered by Experts. Engineered for Results.
          </p>

          {/* German Description */}
          <div className="text-primary-foreground/70 text-lg md:text-xl space-y-1 max-w-2xl mx-auto">
            <p>Laden Sie Ihren Job hoch.</p>
            <p>Unsere KI versteht, was Sie wirklich suchen.</p>
            <p>Top-Recruiter liefern passende Kandidaten.</p>
            <p className="font-medium text-primary-foreground/90">Alles automatisiert – vom Matching bis zum Offer.</p>
          </div>

          {/* CTA Zone */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg font-semibold shadow-lg shadow-emerald/30 hover:shadow-emerald/50 transition-all">
              <Link to="/auth?tab=register&role=client">
                Job in 60 Sekunden starten
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 px-8 py-6 text-lg">
              <a href="#why-us">
                Warum Unternehmen uns wählen
              </a>
            </Button>
          </div>

          {/* Ghost CTA for Recruiters */}
          <div className="pt-2">
            <Link 
              to="/auth?tab=register&role=recruiter" 
              className="text-primary-foreground/60 hover:text-emerald transition-colors text-sm font-medium inline-flex items-center gap-1"
            >
              Recruiter werden
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Trust Line */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 pt-8 text-primary-foreground/60 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Escrow-gesichert</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Erfolgsbasiert</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>12.000+ Recruiter</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>3,8 Tage bis zum ersten Interview</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
