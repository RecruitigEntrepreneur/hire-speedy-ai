import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Users, Zap, CheckCircle2, Eye, FileText, Target, TrendingUp, Clock, Star, BarChart3 } from "lucide-react";
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
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [target, duration, startOnMount, hasStarted]);

  return count;
};

// KPI Box Component - Enhanced with gradient
const KPIBox = ({ icon: Icon, value, suffix = "", label }: { 
  icon: React.ElementType; 
  value: number; 
  suffix?: string; 
  label: string;
}) => {
  const animatedValue = useCountUp(value, 2000);
  
  return (
    <div className="flex flex-col items-center py-3 px-4">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-emerald to-emerald-light flex items-center justify-center mb-2 shadow-lg shadow-emerald/30">
        <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
      </div>
      <span className="text-xl md:text-2xl font-bold text-foreground">
        {animatedValue.toLocaleString('de-DE')}{suffix}
      </span>
      <span className="text-xs text-muted-foreground mt-0.5 text-center">{label}</span>
    </div>
  );
};

// Dashboard Mockup Component - Enhanced with glow
const DashboardMockup = () => {
  return (
    <div className="relative w-full max-w-xl mx-auto mt-6 group">
      {/* Glow effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald/20 via-primary/10 to-emerald/20 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
      
      <div className="relative rounded-2xl bg-card/90 backdrop-blur-md border border-border/60 overflow-hidden shadow-2xl shadow-navy/20">
        {/* Browser-like header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-muted/40 border-b border-border/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald/70" />
          </div>
          <div className="flex-1 mx-4">
            <div className="h-5 w-40 rounded-md bg-background/80 mx-auto flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground">app.talen.to/dashboard</span>
            </div>
          </div>
        </div>
        
        {/* Dashboard Content */}
        <div className="p-4 space-y-3">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/40 to-muted/20 border border-border/40">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="w-3.5 h-3.5 text-emerald" />
                <span className="text-[10px] text-muted-foreground">Jobs</span>
              </div>
              <span className="text-lg font-bold text-foreground">12</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/40 to-muted/20 border border-border/40">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">Kandidaten</span>
              </div>
              <span className="text-lg font-bold text-foreground">47</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/40 to-muted/20 border border-border/40">
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-3.5 h-3.5 text-warning" />
                <span className="text-[10px] text-muted-foreground">Matches</span>
              </div>
              <span className="text-lg font-bold text-foreground">8</span>
            </div>
          </div>

          {/* Candidate List Preview */}
          <div className="space-y-2">
            {[
              { name: "M. Schmidt", role: "Senior Dev", score: 96, status: "Interview" },
              { name: "A. Koch", role: "Product Lead", score: 91, status: "Opt-In" },
              { name: "L. Weber", role: "Sales Dir.", score: 88, status: "Review" },
            ].map((candidate, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 p-2.5 rounded-lg bg-background/60 border border-border/40 hover:border-emerald/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{candidate.name}</p>
                  <p className="text-[10px] text-muted-foreground">{candidate.role}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-14 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald to-emerald-light"
                      style={{ width: `${candidate.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-emerald">{candidate.score}%</span>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                  candidate.status === 'Interview' ? 'bg-emerald/15 text-emerald' :
                  candidate.status === 'Opt-In' ? 'bg-primary/15 text-primary' :
                  'bg-warning/15 text-warning'
                }`}>
                  {candidate.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Floating Job Card Component
const FloatingJobCard = ({ job, style, isMatching }: { job: typeof jobCards[0]; style: React.CSSProperties; isMatching: boolean }) => (
  <div 
    className={`absolute w-56 p-4 rounded-xl backdrop-blur-md border transition-all duration-700
                ${isMatching 
                  ? 'bg-emerald/20 border-emerald/50 shadow-xl shadow-emerald/30' 
                  : 'bg-card/90 border-border/50 shadow-lg shadow-navy/10'
                }`}
    style={style}
  >
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500 ${isMatching ? 'bg-gradient-to-br from-emerald to-emerald-light shadow-lg shadow-emerald/30' : 'bg-primary/10'}`}>
        <Building2 className={`w-5 h-5 ${isMatching ? 'text-white' : 'text-primary'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{job.title}</p>
        <p className="text-xs text-muted-foreground truncate">{job.company}</p>
      </div>
    </div>
    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
      <span className="px-2 py-0.5 rounded-full bg-secondary/50">{job.salary}</span>
      <span>{job.location}</span>
    </div>
    {isMatching && (
      <div className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-gradient-to-br from-emerald to-emerald-light flex items-center justify-center animate-pulse shadow-lg shadow-emerald/40">
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
                  ? 'bg-emerald/20 border-emerald/50 shadow-xl shadow-emerald/30' 
                  : 'bg-card/90 border-border/50 shadow-lg shadow-navy/10'
                }`}
    style={style}
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-500
                      ${isMatching ? 'bg-gradient-to-br from-emerald to-emerald-light text-white shadow-lg shadow-emerald/30' : 'bg-primary/10 text-primary'}`}>
        {candidate.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm">{candidate.role}</p>
        <p className="text-xs text-muted-foreground">{candidate.experience}</p>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2">
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isMatching ? 'bg-emerald/30' : 'bg-secondary/50'}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ${isMatching ? 'bg-gradient-to-r from-emerald to-emerald-light' : 'bg-primary/60'}`}
          style={{ width: `${candidate.matchScore}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${isMatching ? 'text-emerald' : 'text-muted-foreground'}`}>
        {candidate.matchScore}%
      </span>
    </div>
    {isMatching && (
      <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-gradient-to-br from-emerald to-emerald-light flex items-center justify-center animate-pulse shadow-lg shadow-emerald/40">
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

// Radar Ping Animation Component
const RadarPing = () => (
  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
    {/* Outer ring */}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-emerald/5 animate-ping-slow opacity-30" />
    {/* Middle ring */}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-emerald/10 animate-ping-medium opacity-50" />
    {/* Inner ring */}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] rounded-full border-2 border-emerald/20 animate-ping-fast opacity-70" />
    {/* Center dot */}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald animate-pulse shadow-lg shadow-emerald/50" />
  </div>
);

// Network Lines Background
const NetworkLines = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.15]">
    <defs>
      <linearGradient id="networkGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(var(--emerald))" stopOpacity="0" />
        <stop offset="50%" stopColor="hsl(var(--emerald))" stopOpacity="0.5" />
        <stop offset="100%" stopColor="hsl(var(--emerald))" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="networkGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
      </linearGradient>
    </defs>
    
    {/* Diagonal lines from corners */}
    <line x1="0" y1="0" x2="50%" y2="60%" stroke="url(#networkGradient1)" strokeWidth="1" className="animate-draw-line" />
    <line x1="100%" y1="0" x2="50%" y2="60%" stroke="url(#networkGradient2)" strokeWidth="1" className="animate-draw-line" style={{ animationDelay: '0.5s' }} />
    <line x1="0" y1="100%" x2="50%" y2="60%" stroke="url(#networkGradient1)" strokeWidth="1" className="animate-draw-line" style={{ animationDelay: '1s' }} />
    <line x1="100%" y1="100%" x2="50%" y2="60%" stroke="url(#networkGradient2)" strokeWidth="1" className="animate-draw-line" style={{ animationDelay: '1.5s' }} />
    
    {/* Nodes */}
    <circle cx="15%" cy="20%" r="3" fill="hsl(var(--emerald))" className="animate-pulse" style={{ animationDelay: '0s' }} />
    <circle cx="85%" cy="25%" r="3" fill="hsl(var(--primary))" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
    <circle cx="10%" cy="70%" r="3" fill="hsl(var(--emerald))" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
    <circle cx="90%" cy="75%" r="3" fill="hsl(var(--primary))" className="animate-pulse" style={{ animationDelay: '0.9s' }} />
    <circle cx="50%" cy="60%" r="5" fill="hsl(var(--emerald))" className="animate-glow-pulse" />
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
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground) / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(var(--foreground) / 0.3) 1px, transparent 1px)`,
            backgroundSize: '80px 80px'
          }}
        />
        
        {/* Emerald Gradient Stripe - Top Right */}
        <div className="absolute -top-20 -right-20 w-[600px] h-[600px] rotate-12 opacity-[0.08]">
          <div className="w-full h-full bg-gradient-to-br from-emerald via-emerald-light to-transparent rounded-full blur-3xl" />
        </div>
        
        {/* Navy Gradient Stripe - Bottom Left */}
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] -rotate-12 opacity-[0.06]">
          <div className="w-full h-full bg-gradient-to-tr from-primary via-navy to-transparent rounded-full blur-3xl" />
        </div>
        
        {/* Gradient Orbs - More vivid */}
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.08] blur-[80px] bg-emerald animate-aurora-1" />
        <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] rounded-full opacity-[0.05] blur-[60px] bg-primary animate-aurora-2" />
        
        {/* Network Lines */}
        <NetworkLines />
        
        {/* Radar Ping Effect */}
        <RadarPing />
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

          {/* KPI Bar in Glassy Container */}
          <div className="max-w-md mx-auto">
            <div className="relative group">
              {/* Glow effect behind */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald/20 via-primary/10 to-emerald/20 rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
              
              {/* Glass container */}
              <div className="relative bg-gradient-to-r from-card/80 via-card/90 to-card/80 backdrop-blur-xl rounded-2xl border border-emerald/20 shadow-xl shadow-navy/10 overflow-hidden">
                {/* Top shine */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald/30 to-transparent" />
                
                <div className="grid grid-cols-3 divide-x divide-emerald/10">
                  <KPIBox icon={Eye} value={2847} label="Recruiter-Views" />
                  <KPIBox icon={FileText} value={142} label="Profile" />
                  <KPIBox icon={Target} value={96} suffix="%" label="Match-Score" />
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Mockup */}
          <div className="hidden md:block">
            <DashboardMockup />
          </div>

          {/* Simplified Dual CTA Cards */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto mt-8">
            
            {/* Client CTA Card */}
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border border-border/50 
                          hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 overflow-hidden">
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-emerald/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {/* Top shine */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-primary/20 transition-shadow duration-500">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Für Unternehmen</h3>
                </div>

                {/* Single Key Stat */}
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald/10 to-emerald/5 border border-emerald/20">
                  <Clock className="w-5 h-5 text-emerald" />
                  <span className="text-emerald font-semibold">Ø 3,8 Tage</span>
                  <span className="text-muted-foreground text-sm">bis Interview</span>
                </div>

                <Button 
                  onClick={() => navigate('/auth?role=client')}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground rounded-xl py-5 text-base font-medium group/btn shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                >
                  Job starten
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Recruiter CTA Card */}
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border border-border/50 
                          hover:border-emerald/40 hover:shadow-2xl hover:shadow-emerald/10 transition-all duration-500 overflow-hidden">
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {/* Top shine */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald/20 to-emerald/10 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-emerald/20 transition-shadow duration-500">
                    <Users className="w-5 h-5 text-emerald" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Für Recruiter</h3>
                </div>

                {/* Single Key Stat */}
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald/10 to-emerald/5 border border-emerald/20">
                  <TrendingUp className="w-5 h-5 text-emerald" />
                  <span className="text-emerald font-semibold">Bis zu €15.000</span>
                  <span className="text-muted-foreground text-sm">pro Placement</span>
                </div>

                <Button 
                  onClick={() => navigate('/auth?role=recruiter')}
                  className="w-full bg-gradient-to-r from-emerald to-emerald-light hover:from-emerald-light hover:to-emerald text-white rounded-xl py-5 text-base font-medium group/btn shadow-lg shadow-emerald/20 hover:shadow-xl hover:shadow-emerald/30 transition-all duration-300"
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
        
        @keyframes ping-slow {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        
        @keyframes ping-medium {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        
        @keyframes ping-fast {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        
        .animate-ping-slow {
          animation: ping-slow 4s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        
        .animate-ping-medium {
          animation: ping-medium 3s cubic-bezier(0, 0, 0.2, 1) infinite;
          animation-delay: 0.5s;
        }
        
        .animate-ping-fast {
          animation: ping-fast 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          animation-delay: 1s;
        }
      `}</style>
    </section>
  );
};
