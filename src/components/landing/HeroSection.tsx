import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AsciiHandsArt } from "./AsciiHandsArt";
import { DashboardPreview } from "./DashboardPreview";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      {/* ASCII Hands Background */}
      <AsciiHandsArt />

      {/* Content */}
      <div className="relative z-20 container mx-auto px-4 pt-24 md:pt-32 pb-8">
        {/* Badge */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-border/30 text-sm text-muted-foreground backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">KI-gestütztes Recruiting</span>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center max-w-5xl mx-auto animate-slide-up">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tight leading-[1.05]">
            <span className="text-foreground">Perfect Match.</span>
            <br />
            <span className="text-stroke-animated">Perfect Hire.</span>
          </h1>
        </div>

        {/* Subheadline */}
        <p className="mt-6 text-center text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "100ms" }}>
          Recruiters submittieren Kandidaten. Unternehmen finden ihr Perfect Match.
          <span className="text-foreground font-medium"> Erfolgsbasiert.</span>
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <Button
            size="lg"
            className="h-14 px-8 text-base font-semibold bg-foreground text-background hover:bg-foreground/90 transition-opacity shadow-lg"
            onClick={() => navigate("/auth?type=client")}
          >
            Job starten
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-8 text-base font-semibold border-foreground/20 hover:bg-foreground/5 backdrop-blur-sm"
            onClick={() => navigate("/auth?type=recruiter")}
          >
            Recruiter werden
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Micro proof */}
        <div className="mt-12 flex justify-center animate-fade-in" style={{ animationDelay: "400ms" }}>
          <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">Bereits 500+ erfolgreiche Placements</p>
        </div>

        {/* Dashboard Preview – extra spacing */}
        <DashboardPreview />

        {/* Scroll Indicator */}
        <div className="flex justify-center mt-12 animate-fade-in" style={{ animationDelay: "600ms" }}>
          <a href="#why-us" className="flex flex-col items-center gap-1 text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors">
            <span className="text-[10px] uppercase tracking-widest">Scroll</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </a>
        </div>
      </div>

      {/* Stroke Text CSS */}
      <style>{`
        .text-stroke-animated {
          -webkit-text-stroke: 2px hsl(var(--foreground));
          color: transparent;
          background: linear-gradient(90deg, hsl(var(--foreground)) 0%, hsl(var(--foreground) / 0.3) 50%, hsl(var(--foreground)) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: strokeShine 4s ease-in-out infinite;
        }
        @keyframes strokeShine {
          0%, 100% { background-position: -200% 0; }
          50% { background-position: 200% 0; }
        }
      `}</style>
    </section>
  );
};
