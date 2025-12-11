import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Users, Shield, Lock, Clock, Zap, TrendingUp, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

// Mock data for floating cards
const jobCards = [
  { id: 1, title: "Senior Software Engineer", company: "Tech Scale GmbH", salary: "80-100k€", location: "Berlin" },
  { id: 2, title: "Product Manager", company: "AI Startup", salary: "70-90k€", location: "Remote" },
  { id: 3, title: "Head of Sales DACH", company: "SaaS Corp", salary: "90-120k€", location: "München" },
];

const candidateCards = [
  { id: 1, initials: "M.S.", role: "Full-Stack Developer", experience: "8 Jahre", matchScore: 94 },
  { id: 2, initials: "A.K.", role: "Product Lead", experience: "6 Jahre", matchScore: 87 },
  { id: 3, initials: "L.W.", role: "Sales Director", experience: "10 Jahre", matchScore: 91 },
];

// Floating Job Card Component
const FloatingJobCard = ({ job, style, isMatching }: { job: typeof jobCards[0]; style: React.CSSProperties; isMatching: boolean }) => (
  <div 
    className={`absolute w-56 p-4 rounded-xl backdrop-blur-md border transition-all duration-700
                ${isMatching 
                  ? 'bg-emerald/20 border-emerald/50 shadow-lg shadow-emerald/20' 
                  : 'bg-white/80 border-border/40 shadow-lg shadow-black/5'
                }`}
    style={style}
  >
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-500 ${isMatching ? 'bg-emerald' : 'bg-primary/10'}`}>
        <Building2 className={`w-5 h-5 ${isMatching ? 'text-white' : 'text-primary'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{job.title}</p>
        <p className="text-xs text-muted-foreground truncate">{job.company}</p>
      </div>
    </div>
    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
      <span className="px-2 py-0.5 rounded-full bg-secondary">{job.salary}</span>
      <span>{job.location}</span>
    </div>
    {isMatching && (
      <div className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-emerald flex items-center justify-center animate-pulse">
        <Zap className="w-3 h-3 text-white" />
      </div>
    )}
  </div>
);

// Floating Candidate Card Component
const FloatingCandidateCard = ({ candidate, style, isMatching }: { candidate: typeof candidateCards[0]; style: React.CSSProperties; isMatching: boolean }) => (
  <div 
    className={`absolute w-52 p-4 rounded-xl backdrop-blur-md border transition-all duration-700
                ${isMatching 
                  ? 'bg-emerald/20 border-emerald/50 shadow-lg shadow-emerald/20' 
                  : 'bg-white/80 border-border/40 shadow-lg shadow-black/5'
                }`}
    style={style}
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors duration-500
                      ${isMatching ? 'bg-emerald text-white' : 'bg-primary/10 text-primary'}`}>
        {candidate.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm">{candidate.role}</p>
        <p className="text-xs text-muted-foreground">{candidate.experience}</p>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2">
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isMatching ? 'bg-emerald/30' : 'bg-secondary'}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ${isMatching ? 'bg-emerald' : 'bg-primary/60'}`}
          style={{ width: `${candidate.matchScore}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${isMatching ? 'text-emerald' : 'text-muted-foreground'}`}>
        {candidate.matchScore}%
      </span>
    </div>
    {isMatching && (
      <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-emerald flex items-center justify-center animate-pulse">
        <CheckCircle2 className="w-3 h-3 text-white" />
      </div>
    )}
  </div>
);

// Connecting Line SVG
const ConnectingLine = ({ isActive }: { isActive: boolean }) => (
  <svg 
    className="absolute inset-0 w-full h-full pointer-events-none z-0"
    style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.5s ease' }}
  >
    <defs>
      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(var(--emerald))" stopOpacity="0.3" />
        <stop offset="50%" stopColor="hsl(var(--emerald))" stopOpacity="0.8" />
        <stop offset="100%" stopColor="hsl(var(--emerald))" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    <line 
      x1="25%" y1="50%" x2="75%" y2="50%" 
      stroke="url(#lineGradient)" 
      strokeWidth="2"
      strokeDasharray="8 4"
      className={isActive ? 'animate-dash' : ''}
    />
  </svg>
);

export const HeroSection = () => {
  const navigate = useNavigate();
  const [matchingPair, setMatchingPair] = useState<number | null>(null);

  // Animate matching every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMatchingPair(prev => {
        if (prev === null) return 0;
        if (prev >= 2) return null;
        return prev + 1;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const jobPositions = [
    { top: '15%', left: '8%', animationDelay: '0s' },
    { top: '45%', left: '5%', animationDelay: '1s' },
    { top: '70%', left: '10%', animationDelay: '2s' },
  ];

  const candidatePositions = [
    { top: '12%', right: '8%', animationDelay: '0.5s' },
    { top: '42%', right: '5%', animationDelay: '1.5s' },
    { top: '68%', right: '10%', animationDelay: '2.5s' },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-20">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Subtle Grid */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground) / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(var(--foreground) / 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Gradient Orbs */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06] blur-[100px] bg-emerald animate-float-slow" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-[80px] bg-primary animate-float-slow-reverse" />
      </div>

      {/* Floating Job Cards - Left Side (Hidden on mobile) */}
      <div className="hidden lg:block">
        {jobCards.map((job, index) => (
          <FloatingJobCard
            key={job.id}
            job={job}
            isMatching={matchingPair === index}
            style={{
              ...jobPositions[index],
              animation: `floatCard 8s ease-in-out infinite`,
              animationDelay: jobPositions[index].animationDelay,
            }}
          />
        ))}
      </div>

      {/* Floating Candidate Cards - Right Side (Hidden on mobile) */}
      <div className="hidden lg:block">
        {candidateCards.map((candidate, index) => (
          <FloatingCandidateCard
            key={candidate.id}
            candidate={candidate}
            isMatching={matchingPair === index}
            style={{
              ...candidatePositions[index],
              animation: `floatCard 8s ease-in-out infinite`,
              animationDelay: candidatePositions[index].animationDelay,
            }}
          />
        ))}
      </div>

      {/* Connecting Line (Hidden on mobile) */}
      <div className="hidden lg:block">
        <ConnectingLine isActive={matchingPair !== null} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          
          {/* Minimal Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
              Perfect Match.{" "}
              <span className="bg-gradient-to-r from-emerald via-emerald-light to-emerald bg-clip-text text-transparent">
                Perfect Hire.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto">
              KI-gestütztes Recruiting. Erfolgsbasiert.
            </p>
          </div>

          {/* Dual CTA Cards */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-3xl mx-auto mt-12">
            
            {/* Client CTA Card */}
            <div className="group relative p-6 md:p-8 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 
                          hover:border-emerald/30 hover:shadow-xl hover:shadow-emerald/5 transition-all duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Für Unternehmen</h3>
                  <p className="text-muted-foreground text-sm mt-1">Top-Talente in Rekordzeit</p>
                </div>

                {/* Key Stat */}
                <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-emerald/10 border border-emerald/20">
                  <Clock className="w-5 h-5 text-emerald" />
                  <span className="text-emerald font-semibold">Ø 3,8 Tage</span>
                  <span className="text-muted-foreground text-sm">bis zum Interview</span>
                </div>

                {/* Benefits */}
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Nur bei erfolgreicher Einstellung zahlen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>KI-vorselektierte Kandidaten</span>
                  </li>
                </ul>

                <Button 
                  onClick={() => navigate('/auth?role=client')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-6 text-base font-medium group/btn"
                >
                  Job starten
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Recruiter CTA Card */}
            <div className="group relative p-6 md:p-8 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 
                          hover:border-emerald/30 hover:shadow-xl hover:shadow-emerald/5 transition-all duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Für Recruiter</h3>
                  <p className="text-muted-foreground text-sm mt-1">Verdiene mit jedem Placement</p>
                </div>

                {/* Key Stat */}
                <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-emerald/10 border border-emerald/20">
                  <TrendingUp className="w-5 h-5 text-emerald" />
                  <span className="text-emerald font-semibold">Bis zu 15%</span>
                  <span className="text-muted-foreground text-sm">Provision</span>
                </div>

                {/* Benefits */}
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Exklusive Job-Aufträge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Sichere Escrow-Zahlung</span>
                  </li>
                </ul>

                <Button 
                  onClick={() => navigate('/auth?role=recruiter')}
                  variant="outline"
                  className="w-full border-emerald/30 text-emerald hover:bg-emerald hover:text-white rounded-xl py-6 text-base font-medium group/btn"
                >
                  Als Recruiter starten
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>

          {/* Trust Stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mt-12 pt-8 border-t border-border/30">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-5 h-5 text-emerald" />
              <span className="text-muted-foreground">DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Lock className="w-5 h-5 text-emerald" />
              <span className="text-muted-foreground">Escrow-gesichert</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-5 h-5 text-emerald" />
              <span className="text-muted-foreground">92% Match-Quote</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-5 h-5 text-emerald" />
              <span className="text-muted-foreground">3,8 Tage Ø</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes floatCard {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(1deg); }
        }
        
        @keyframes animate-dash {
          to { stroke-dashoffset: -24; }
        }
        
        .animate-dash {
          animation: animate-dash 1s linear infinite;
        }
        
        .animate-float-slow {
          animation: floatCard 20s ease-in-out infinite;
        }
        
        .animate-float-slow-reverse {
          animation: floatCard 25s ease-in-out infinite reverse;
        }
      `}</style>
    </section>
  );
};
