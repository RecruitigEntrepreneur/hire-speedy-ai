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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-20">
      {/* Modern Animated Background */}
      <div className="absolute inset-0">
        {/* Subtle Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(222 47% 11% / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(222 47% 11% / 0.3) 1px, transparent 1px)`,
            backgroundSize: '80px 80px'
          }}
        />
        
        {/* Floating Gradient Blob 1 - Top Right */}
        <div 
          className="absolute -top-20 -right-20 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[100px]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--emerald)) 0%, transparent 70%)',
            animation: 'floatBlob1 20s ease-in-out infinite'
          }}
        />
        
        {/* Floating Gradient Blob 2 - Bottom Left */}
        <div 
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.03] blur-[80px]"
          style={{
            background: 'radial-gradient(circle, hsl(200 100% 50%) 0%, transparent 70%)',
            animation: 'floatBlob2 25s ease-in-out infinite'
          }}
        />

        {/* Floating Dots */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-emerald/20 rounded-full"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 3) * 20}%`,
              animation: `floatDot ${10 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.8}s`
            }}
          />
        ))}

        {/* Geometric Accent Lines */}
        <div className="absolute top-1/4 right-0 w-32 h-px bg-gradient-to-l from-emerald/20 to-transparent" />
        <div className="absolute bottom-1/3 left-0 w-24 h-px bg-gradient-to-r from-emerald/20 to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* (1) Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald" />
            <span className="text-xs tracking-wide text-slate-600">
              Powered by AI. Delivered by Experts. Designed for Speed.
            </span>
          </div>

          {/* (2) Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight">
            Your next hire is{" "}
            <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
              one prompt away.
            </span>
          </h1>

          {/* (3) Subheadline */}
          <p className="text-lg md:text-xl text-slate-600 max-w-xl mx-auto">
            Die schnellste Art, Top-Talente zu finden.
            <br />
            <span className="text-slate-400">KI-gestützt. Recruiter-geliefert. Erfolgsbasiert.</span>
          </p>

          {/* (4) AI Input Bar */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mt-10">
            <div className="relative p-2 rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-200/50 hover:border-emerald/40 hover:shadow-emerald/10 transition-all duration-500">
              <div className="flex items-center gap-3">
                <div className="pl-4">
                  <Sparkles className="w-5 h-5 text-emerald" />
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="text"
                    value={position}
                    onChange={handleInputChange}
                    className="w-full bg-transparent text-slate-900 text-lg py-4 px-2 
                               placeholder:text-slate-400 focus:outline-none"
                    placeholder=""
                  />
                  {/* Typing animation overlay */}
                  {!position && (
                    <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                      <span className="text-slate-400 text-lg">
                        {displayText}
                        <span className="animate-pulse text-emerald">|</span>
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  type="submit"
                  className="bg-emerald hover:bg-emerald-light text-white px-5 py-5 rounded-xl transition-all duration-300"
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
                  className="px-4 py-2 rounded-full bg-slate-50 text-sm text-slate-500 
                             border border-slate-200 hover:text-emerald hover:border-emerald/30 hover:bg-emerald/5
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
              className="bg-emerald hover:bg-emerald-light text-white px-6 py-2 rounded-full text-sm font-medium"
            >
              Job starten
            </Button>
            <Button 
              variant="ghost"
              onClick={() => navigate('/auth?role=recruiter')}
              className="text-slate-500 hover:text-emerald hover:bg-transparent text-sm"
            >
              Ich bin Recruiter
            </Button>
          </div>

          {/* (6) Trust Line */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-10 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald" />
              <span>DSGVO-konform</span>
            </div>
            <span className="text-slate-200">·</span>
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald" />
              <span>Escrow-gesichert</span>
            </div>
            <span className="text-slate-200">·</span>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald" />
              <span>3,8 Tage bis zum ersten Interview</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 to-transparent" />

      {/* CSS Animations */}
      <style>{`
        @keyframes floatBlob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes floatBlob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 20px) scale(1.1); }
          66% { transform: translate(30px, -30px) scale(0.9); }
        }
        @keyframes floatDot {
          0%, 100% { transform: translateY(0) opacity(0.2); }
          50% { transform: translateY(-20px) opacity(0.4); }
        }
      `}</style>
    </section>
  );
};