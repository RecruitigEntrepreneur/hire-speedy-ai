import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Users, Zap, CheckCircle2, Eye, FileText, Target, TrendingUp, Clock, Star, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

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

// Animated Counter Hook
const useCountUp = (target: number, duration: number = 2000, startOnMount: boolean = true) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!startOnMount || hasStarted) return;
    setHasStarted(true);
    
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      setCount(Math.floor(target * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [target, duration, startOnMount, hasStarted]);

  return count;
};

// KPI Box Component
const KPIBox = ({ icon: Icon, value, suffix = "", label }: { 
  icon: React.ElementType; 
  value: number; 
  suffix?: string; 
  label: string;
}) => {
  const animatedValue = useCountUp(value, 2000);
  
  return (
    <div className="flex flex-col items-center p-4 md:p-6 rounded-xl bg-card/60 backdrop-blur-sm border border-border/40 hover:border-emerald/30 transition-all duration-300">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-emerald/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 md:w-6 md:h-6 text-emerald" />
      </div>
      <span className="text-2xl md:text-3xl font-bold text-foreground">
        {animatedValue.toLocaleString('de-DE')}{suffix}
      </span>
      <span className="text-xs md:text-sm text-muted-foreground mt-1 text-center">{label}</span>
    </div>
  );
};

// Dashboard Mockup Component
const DashboardMockup = () => {
  return (
    <div className="relative w-full max-w-3xl mx-auto mt-8 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden shadow-2xl shadow-black/10">
      {/* Browser-like header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/40">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          <div className="w-3 h-3 rounded-full bg-warning/60" />
          <div className="w-3 h-3 rounded-full bg-emerald/60" />
        </div>
        <div className="flex-1 mx-4">
          <div className="h-6 w-48 rounded-md bg-background/80 mx-auto" />
        </div>
      </div>
      
      {/* Dashboard Content */}
      <div className="p-4 md:p-6 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-emerald" />
              <span className="text-xs text-muted-foreground">Aktive Jobs</span>
            </div>
            <span className="text-lg font-bold text-foreground">12</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Kandidaten</span>
            </div>
            <span className="text-lg font-bold text-foreground">47</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">Matches</span>
            </div>
            <span className="text-lg font-bold text-foreground">8</span>
          </div>
        </div>

        {/* Candidate List Preview */}
        <div className="space-y-2">
          {[
            { name: "M. Schmidt", role: "Senior Dev", score: 96, status: "Interview" },
            { name: "A. Koch", role: "Product Lead", score: 91, status: "Opt-In" },
            { name: "L. Weber", role: "Sales Dir.", score: 88, status: "Neu" },
          ].map((candidate, i) => (
            <div 
              key={i} 
              className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/30 hover:border-emerald/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {candidate.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{candidate.name}</p>
                <p className="text-xs text-muted-foreground">{candidate.role}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-emerald"
                    style={{ width: `${candidate.score}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-emerald w-8">{candidate.score}%</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                candidate.status === 'Interview' ? 'bg-emerald/10 text-emerald' :
                candidate.status === 'Opt-In' ? 'bg-primary/10 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {candidate.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Subtle animation overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
    </div>
  );
};

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

  // Animate matching every 3 seconds
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-20 pb-12">
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

      {/* Floating Job Cards - Left Side (Hidden on mobile/tablet) */}
      <div className="hidden xl:block">
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

      {/* Floating Candidate Cards - Right Side (Hidden on mobile/tablet) */}
      <div className="hidden xl:block">
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

      {/* Connecting Line (Hidden on mobile/tablet) */}
      <div className="hidden xl:block">
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

          {/* KPI Bar - Rule of 3 */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto">
            <KPIBox icon={Eye} value={2847} label="Recruiter-Views" />
            <KPIBox icon={FileText} value={142} label="Eingereichte Profile" />
            <KPIBox icon={Target} value={96} suffix="%" label="Top-Match-Score" />
          </div>

          {/* Dashboard Mockup */}
          <div className="hidden md:block">
            <DashboardMockup />
          </div>

          {/* Simplified Dual CTA Cards */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto mt-8">
            
            {/* Client CTA Card - Minimal */}
            <div className="group relative p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 
                          hover:border-emerald/30 hover:shadow-xl hover:shadow-emerald/5 transition-all duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Für Unternehmen</h3>
                </div>

                {/* Single Key Stat */}
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald/10 border border-emerald/20">
                  <Clock className="w-5 h-5 text-emerald" />
                  <span className="text-emerald font-semibold">Ø 3,8 Tage</span>
                  <span className="text-muted-foreground text-sm">bis Interview</span>
                </div>

                <Button 
                  onClick={() => navigate('/auth?role=client')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-5 text-base font-medium group/btn"
                >
                  Job starten
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Recruiter CTA Card - Minimal */}
            <div className="group relative p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 
                          hover:border-emerald/30 hover:shadow-xl hover:shadow-emerald/5 transition-all duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Für Recruiter</h3>
                </div>

                {/* Single Key Stat */}
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald/10 border border-emerald/20">
                  <TrendingUp className="w-5 h-5 text-emerald" />
                  <span className="text-emerald font-semibold">Bis zu €15.000</span>
                  <span className="text-muted-foreground text-sm">pro Placement</span>
                </div>

                <Button 
                  onClick={() => navigate('/auth?role=recruiter')}
                  variant="outline"
                  className="w-full border-emerald/30 text-emerald hover:bg-emerald hover:text-white rounded-xl py-5 text-base font-medium group/btn"
                >
                  Recruiter werden
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
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
