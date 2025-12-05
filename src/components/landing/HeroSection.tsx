import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Shield, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export const HeroSection = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState("");

  const suggestions = [
    "Senior Software Engineer",
    "Product Manager",
    "Sales Lead DACH",
    "Data Scientist",
    "UX Designer",
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (position.trim()) {
      navigate(`/dashboard/create-job?position=${encodeURIComponent(position.trim())}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPosition(suggestion);
    navigate(`/dashboard/create-job?position=${encodeURIComponent(suggestion)}`);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary pt-20">
      {/* Simplified Background Effects */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--emerald) / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(var(--emerald) / 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Aurora Orb 1 - Emerald */}
        <div 
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--emerald)) 0%, transparent 70%)',
            animation: 'aurora1 15s ease-in-out infinite'
          }}
        />
        
        {/* Aurora Orb 2 - Blue */}
        <div 
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, hsl(210, 100%, 50%) 0%, transparent 70%)',
            animation: 'aurora2 18s ease-in-out infinite'
          }}
        />

        {/* Floating Particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald/40 rounded-full"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `floatParticle ${8 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-dark border border-emerald/20">
            <Zap className="w-4 h-4 text-emerald" />
            <span className="text-sm text-primary-foreground/80">AI-Powered Recruiting Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground leading-tight">
            Hiring.{" "}
            <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
              Rebuilt from Zero.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-primary-foreground/70 max-w-2xl mx-auto">
            Die schnellste Art, die besten Talente zu finden.
            <br />
            <span className="text-primary-foreground/50">KI-gestützt. Recruiter-geliefert. Erfolgsbasiert.</span>
          </p>

          {/* AI Input Field */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mt-12">
            <div className="relative glass-card-dark p-2 rounded-2xl border border-emerald/20 shadow-2xl shadow-emerald/10 hover:border-emerald/40 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="pl-4">
                  <Sparkles className="w-6 h-6 text-emerald animate-pulse" />
                </div>
                <input 
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Welche Position möchten Sie besetzen?"
                  className="flex-1 bg-transparent text-primary-foreground text-lg py-4 px-2 
                             placeholder:text-primary-foreground/40 focus:outline-none"
                />
                <Button 
                  type="submit"
                  className="bg-emerald hover:bg-emerald-light text-primary px-6 py-6 rounded-xl transition-all duration-300"
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            {/* Quick Suggestions */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 rounded-full glass-card-dark text-sm text-primary-foreground/60 
                             border border-white/5 hover:text-emerald hover:border-emerald/30 
                             transition-all duration-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </form>

          {/* Trust Line */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-primary-foreground/50">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald" />
              <span>DSGVO-konform</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald" />
              <span>500+ Top-Recruiter</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald" />
              <span>Ø 12 Tage bis zur Besetzung</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
