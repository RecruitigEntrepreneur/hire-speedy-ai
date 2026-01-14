import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CreationHandsBackground } from "./CreationHandsBackground";
import { AsciiCodeOverlay } from "./AsciiCodeOverlay";
import { MatchingVisualization } from "./MatchingVisualization";


// Trust Logos
const TrustLogos = () => (
  <div className="mt-12 flex flex-col items-center gap-4">
    <p className="text-xs text-muted-foreground uppercase tracking-widest">Bereits 500+ erfolgreiche Placements</p>
    <div className="flex items-center gap-8 opacity-50">
      {['TechCorp', 'ScaleUp', 'StartupX', 'EnterpriseAI'].map((name) => (
        <div key={name} className="text-sm font-semibold text-muted-foreground/60">{name}</div>
      ))}
    </div>
  </div>
);

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Pure white/light background */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Creation Hands Background */}
      <CreationHandsBackground />
      
      {/* ASCII Code Overlay */}
      <AsciiCodeOverlay />

      {/* Content */}
      <div className="relative z-20 container mx-auto px-4 pt-24 md:pt-32 pb-16">
        {/* Badge */}
        <div className="flex justify-center mb-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald/10 border border-emerald/20 text-sm text-emerald backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">KI-gestütztes Recruiting</span>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center max-w-4xl mx-auto animate-slide-up">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight text-foreground leading-[1.1]">
            Perfect Match.
            <br />
            <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
              Perfect Hire.
            </span>
          </h1>
        </div>

        {/* Subheadline */}
        <p className="mt-6 text-center text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
          Recruiters submittieren Kandidaten. Unternehmen finden ihr Perfect Match. 
          <span className="text-foreground font-medium"> Erfolgsbasiert.</span>
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <Button 
            size="lg" 
            className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-emerald to-emerald-light hover:opacity-90 transition-opacity shadow-lg shadow-emerald/25"
            onClick={() => navigate('/auth?type=client')}
          >
            Job starten
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="h-14 px-8 text-base font-semibold border-border/60 hover:bg-muted/50 backdrop-blur-sm"
            onClick={() => navigate('/auth?type=recruiter')}
          >
            Recruiter werden
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Trust Logos */}
        <TrustLogos />
        
        {/* Matching Visualization */}
        <MatchingVisualization />
      </div>
    </section>
  );
};
