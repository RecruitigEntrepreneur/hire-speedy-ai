import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Shield, Clock, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const typingExamples = [
  "Senior Software Engineer Berlin",
  "Head of Sales DACH",
  "HR Business Partner Remote",
  "Finance Manager Scale-up",
  "Product Manager SaaS",
];

export const HeroSection = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [currentExample, setCurrentExample] = useState(0);
  const [userHasTyped, setUserHasTyped] = useState(false);

  const suggestions = [
    "Senior Software Engineer",
    "Product Manager",
    "Sales Lead DACH",
    "Data Scientist",
  ];

  // Typing animation effect
  useEffect(() => {
    if (userHasTyped || position) return;

    const example = typingExamples[currentExample];
    let charIndex = 0;
    let isDeleting = false;
    let pauseTimeout: NodeJS.Timeout;

    const typeInterval = setInterval(() => {
      if (!isDeleting) {
        if (charIndex <= example.length) {
          setDisplayText(example.slice(0, charIndex));
          charIndex++;
        } else {
          isDeleting = true;
          pauseTimeout = setTimeout(() => {}, 1500);
        }
      } else {
        if (charIndex > 0) {
          charIndex--;
          setDisplayText(example.slice(0, charIndex));
        } else {
          isDeleting = false;
          setCurrentExample((prev) => (prev + 1) % typingExamples.length);
        }
      }
    }, isDeleting ? 40 : 80);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(pauseTimeout);
    };
  }, [currentExample, userHasTyped, position]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPosition(e.target.value);
    if (!userHasTyped && e.target.value) {
      setUserHasTyped(true);
    }
    if (!e.target.value) {
      setUserHasTyped(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (position.trim()) {
      navigate(`/dashboard/create-job?position=${encodeURIComponent(position.trim())}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPosition(suggestion);
    setUserHasTyped(true);
    navigate(`/dashboard/create-job?position=${encodeURIComponent(suggestion)}`);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--emerald) / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(var(--emerald) / 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Aurora Orb 1 - Emerald */}
        <div 
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-15 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--emerald)) 0%, transparent 70%)',
            animation: 'aurora1 15s ease-in-out infinite'
          }}
        />
        
        {/* Aurora Orb 2 - Blue/Purple */}
        <div 
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, hsl(250, 80%, 60%) 0%, transparent 70%)',
            animation: 'aurora2 18s ease-in-out infinite'
          }}
        />

        {/* Floating Particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald/30 rounded-full"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `floatParticle ${8 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* Bottom gradient fade / Soft Divider */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/50 to-transparent" />

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* (1) Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-emerald" />
            <span className="text-xs tracking-wide text-primary-foreground/70">
              Powered by AI. Delivered by Experts. Designed for Speed.
            </span>
          </div>

          {/* (2) Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-[1.1] tracking-tight">
            Your next hire is{" "}
            <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
              one prompt away.
            </span>
          </h1>

          {/* (3) Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/60 max-w-xl mx-auto">
            Die schnellste Art, Top-Talente zu finden.
            <br />
            <span className="text-primary-foreground/40">KI-gestützt. Recruiter-geliefert. Erfolgsbasiert.</span>
          </p>

          {/* (4) AI Input Bar */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mt-10">
            <div className="relative glass-card-dark p-2 rounded-2xl border border-emerald/20 shadow-2xl shadow-emerald/5 hover:border-emerald/40 hover:shadow-emerald/10 transition-all duration-500">
              <div className="flex items-center gap-3">
                <div className="pl-4">
                  <Sparkles className="w-5 h-5 text-emerald" />
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="text"
                    value={position}
                    onChange={handleInputChange}
                    className="w-full bg-transparent text-primary-foreground text-lg py-4 px-2 
                               placeholder:text-primary-foreground/30 focus:outline-none"
                    placeholder=""
                  />
                  {/* Typing animation overlay */}
                  {!position && (
                    <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                      <span className="text-primary-foreground/40 text-lg">
                        {displayText}
                        <span className="animate-pulse">|</span>
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  type="submit"
                  className="bg-emerald hover:bg-emerald-light text-primary px-5 py-5 rounded-xl transition-all duration-300"
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            {/* Suggestion Chips */}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 rounded-full bg-white/5 text-sm text-primary-foreground/50 
                             border border-white/5 hover:text-emerald hover:border-emerald/30 hover:bg-emerald/5
                             transition-all duration-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </form>

          {/* (5) Micro-CTA Row */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button 
              onClick={handleSubmit}
              className="bg-emerald hover:bg-emerald-light text-primary px-6 py-2 rounded-full text-sm font-medium"
            >
              Job starten
            </Button>
            <Button 
              variant="ghost"
              onClick={() => navigate('/auth?role=recruiter')}
              className="text-primary-foreground/50 hover:text-emerald hover:bg-transparent text-sm"
            >
              Ich bin Recruiter
            </Button>
          </div>

          {/* (6) Trust Line */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-10 text-xs text-primary-foreground/40">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald/70" />
              <span>DSGVO-konform</span>
            </div>
            <span className="text-white/10">·</span>
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald/70" />
              <span>Escrow-gesichert</span>
            </div>
            <span className="text-white/10">·</span>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald/70" />
              <span>3,8 Tage bis zum ersten Interview</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
