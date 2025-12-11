import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Building2, User, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

// Mock data for matching visualization
const matchPairs = [
  { 
    job: { title: "Senior Software Engineer", company: "Tech Scale GmbH", salary: "80-100k€" },
    candidate: { initials: "M.S.", role: "Full-Stack Developer", score: 94 }
  },
  { 
    job: { title: "Product Manager", company: "AI Startup", salary: "70-90k€" },
    candidate: { initials: "A.K.", role: "Product Lead", score: 87 }
  },
  { 
    job: { title: "Head of Sales DACH", company: "SaaS Corp", salary: "90-120k€" },
    candidate: { initials: "L.W.", role: "Sales Director", score: 91 }
  },
];

// Job Card Component
const JobCard = ({ job, isActive, delay }: { 
  job: typeof matchPairs[0]['job']; 
  isActive: boolean;
  delay: number;
}) => (
  <div 
    className={`relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-700 animate-card-enter
                ${isActive 
                  ? 'bg-emerald/10 border-emerald/40 shadow-lg shadow-emerald/20 scale-105' 
                  : 'bg-card/80 border-border/50 shadow-md'}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500
                      ${isActive ? 'bg-gradient-to-br from-emerald to-emerald-light' : 'bg-primary/10'}`}>
        <Building2 className={`w-5 h-5 ${isActive ? 'text-white' : 'text-primary'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm truncate">{job.title}</p>
        <p className="text-xs text-muted-foreground">{job.company}</p>
      </div>
    </div>
    <div className="mt-3 text-xs text-muted-foreground">
      <span className="px-2 py-1 rounded-full bg-secondary/60">{job.salary}</span>
    </div>
    {isActive && (
      <div className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-emerald flex items-center justify-center shadow-lg shadow-emerald/40">
        <Zap className="w-3 h-3 text-white" />
      </div>
    )}
  </div>
);

// Candidate Card Component
const CandidateCard = ({ candidate, isActive, delay }: { 
  candidate: typeof matchPairs[0]['candidate']; 
  isActive: boolean;
  delay: number;
}) => (
  <div 
    className={`relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-700 animate-card-enter
                ${isActive 
                  ? 'bg-emerald/10 border-emerald/40 shadow-lg shadow-emerald/20 scale-105' 
                  : 'bg-card/80 border-border/50 shadow-md'}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-500
                      ${isActive ? 'bg-gradient-to-br from-emerald to-emerald-light text-white' : 'bg-primary/10 text-primary'}`}>
        {candidate.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm">{candidate.role}</p>
        <p className="text-xs text-muted-foreground">Match: {candidate.score}%</p>
      </div>
    </div>
    <div className="mt-3">
      <div className={`h-1.5 rounded-full overflow-hidden ${isActive ? 'bg-emerald/20' : 'bg-secondary/50'}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ${isActive ? 'bg-gradient-to-r from-emerald to-emerald-light' : 'bg-primary/50'}`}
          style={{ width: `${candidate.score}%` }}
        />
      </div>
    </div>
    {isActive && (
      <div className="absolute -left-1 -top-1 w-5 h-5 rounded-full bg-emerald flex items-center justify-center shadow-lg shadow-emerald/40">
        <User className="w-3 h-3 text-white" />
      </div>
    )}
  </div>
);

// Animated Connection Line
const ConnectionLine = ({ isActive }: { isActive: boolean }) => (
  <svg className="w-24 md:w-32 h-16" viewBox="0 0 120 60">
    <defs>
      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(var(--emerald))" stopOpacity="0.5" />
        <stop offset="50%" stopColor="hsl(var(--emerald-light))" stopOpacity="1" />
        <stop offset="100%" stopColor="hsl(var(--emerald))" stopOpacity="0.5" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    
    {/* Background line */}
    <path 
      d="M 0 30 Q 60 30 120 30"
      fill="none"
      stroke="hsl(var(--border))"
      strokeWidth="2"
      strokeDasharray="4 4"
      className="opacity-30"
    />
    
    {/* Active animated line */}
    {isActive && (
      <>
        <path 
          d="M 0 30 Q 60 30 120 30"
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#glow)"
          className="animate-draw-line"
        />
        <circle cx="60" cy="30" r="6" fill="hsl(var(--emerald))" filter="url(#glow)" className="animate-pulse" />
      </>
    )}
  </svg>
);

// Match Badge
const MatchBadge = ({ isActive }: { isActive: boolean }) => (
  <div 
    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-500
                ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
  >
    <div className="relative">
      <div className="absolute -inset-4 rounded-full bg-emerald/30 blur-xl animate-pulse" />
      <div className="relative px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald to-emerald-light shadow-xl shadow-emerald/40 border border-white/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm tracking-wide">MATCH!</span>
        </div>
      </div>
    </div>
  </div>
);

// Matching Visualization
const MatchingVisualization = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showMatch, setShowMatch] = useState(false);

  useEffect(() => {
    const cycleMatch = () => {
      // Reset
      setActiveIndex(null);
      setShowMatch(false);
      
      // Start animation after a delay
      setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * matchPairs.length);
        setActiveIndex(randomIndex);
        
        // Show match badge after line animates
        setTimeout(() => setShowMatch(true), 600);
        
        // Reset after showing
        setTimeout(() => {
          setShowMatch(false);
          setTimeout(() => setActiveIndex(null), 300);
        }, 2000);
      }, 500);
    };

    cycleMatch();
    const interval = setInterval(cycleMatch, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mt-12 md:mt-16">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald/5 via-transparent to-transparent rounded-3xl blur-3xl" />
      
      <div className="relative flex items-center justify-center gap-4 md:gap-8">
        {/* Jobs Column */}
        <div className="flex flex-col gap-3 w-44 md:w-52">
          {matchPairs.map((pair, i) => (
            <JobCard 
              key={i} 
              job={pair.job} 
              isActive={activeIndex === i}
              delay={i * 100}
            />
          ))}
        </div>

        {/* Center - Connection */}
        <div className="relative flex flex-col items-center gap-3">
          {matchPairs.map((_, i) => (
            <div key={i} className="relative h-[76px] flex items-center">
              <ConnectionLine isActive={activeIndex === i} />
              {activeIndex === i && showMatch && <MatchBadge isActive={true} />}
            </div>
          ))}
        </div>

        {/* Candidates Column */}
        <div className="flex flex-col gap-3 w-44 md:w-52">
          {matchPairs.map((pair, i) => (
            <CandidateCard 
              key={i} 
              candidate={pair.candidate} 
              isActive={activeIndex === i}
              delay={i * 100 + 150}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

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
      {/* Minimal Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
      
      {/* Subtle grid */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
      
      {/* Single gradient orb */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-24 md:pt-32 pb-16">
        {/* Badge */}
        <div className="flex justify-center mb-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald/10 border border-emerald/20 text-sm text-emerald">
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
            className="h-14 px-8 text-base font-semibold border-border/60 hover:bg-muted/50"
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

      {/* CSS for animations */}
      <style>{`
        @keyframes card-enter {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        @keyframes draw-line {
          0% { stroke-dasharray: 0 200; }
          100% { stroke-dasharray: 200 0; }
        }
        
        .animate-card-enter {
          animation: card-enter 0.6s ease-out forwards;
        }
        
        .animate-draw-line {
          animation: draw-line 0.8s ease-out forwards;
        }
      `}</style>
    </section>
  );
};
