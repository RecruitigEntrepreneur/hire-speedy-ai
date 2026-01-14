import { Briefcase, User, Zap, CheckCircle2 } from "lucide-react";

interface JobCardProps {
  title: string;
  company: string;
  delay: number;
}

const JobCard = ({ title, company, delay }: JobCardProps) => (
  <div 
    className="flex items-center gap-3 px-4 py-3 bg-card/80 backdrop-blur-sm border border-border/30 rounded-xl shadow-sm animate-card-enter-left"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="w-9 h-9 rounded-lg bg-emerald/10 flex items-center justify-center flex-shrink-0">
      <Briefcase className="w-4 h-4 text-emerald" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{title}</p>
      <p className="text-xs text-muted-foreground truncate">{company}</p>
    </div>
  </div>
);

interface CandidateCardProps {
  name: string;
  role: string;
  delay: number;
}

const CandidateCard = ({ name, role, delay }: CandidateCardProps) => (
  <div 
    className="flex items-center gap-3 px-4 py-3 bg-card/80 backdrop-blur-sm border border-border/30 rounded-xl shadow-sm animate-card-enter-right"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
      <User className="w-4 h-4 text-navy" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{name}</p>
      <p className="text-xs text-muted-foreground truncate">{role}</p>
    </div>
  </div>
);

const ConnectionLines = () => (
  <svg 
    className="absolute inset-0 w-full h-full" 
    viewBox="0 0 400 300"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(var(--emerald))" stopOpacity="0.6" />
        <stop offset="50%" stopColor="hsl(var(--emerald-light))" stopOpacity="0.8" />
        <stop offset="100%" stopColor="hsl(var(--emerald))" stopOpacity="0.6" />
      </linearGradient>
    </defs>
    
    {/* Connection paths from jobs to center */}
    <path
      d="M 80 75 Q 150 75 200 150"
      fill="none"
      stroke="url(#lineGradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="animate-line-draw"
      style={{ animationDelay: '0.8s' }}
    />
    <path
      d="M 80 150 Q 140 150 200 150"
      fill="none"
      stroke="url(#lineGradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="animate-line-draw"
      style={{ animationDelay: '1s' }}
    />
    <path
      d="M 80 225 Q 150 225 200 150"
      fill="none"
      stroke="url(#lineGradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="animate-line-draw"
      style={{ animationDelay: '1.2s' }}
    />
    
    {/* Connection paths from center to candidates */}
    <path
      d="M 200 150 Q 250 75 320 75"
      fill="none"
      stroke="url(#lineGradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="animate-line-draw"
      style={{ animationDelay: '1.4s' }}
    />
    <path
      d="M 200 150 Q 260 150 320 150"
      fill="none"
      stroke="url(#lineGradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="animate-line-draw"
      style={{ animationDelay: '1.6s' }}
    />
    <path
      d="M 200 150 Q 250 225 320 225"
      fill="none"
      stroke="url(#lineGradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="animate-line-draw"
      style={{ animationDelay: '1.8s' }}
    />
  </svg>
);

const MatchingCore = () => (
  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
    {/* Outer pulse ring */}
    <div className="absolute inset-0 -m-6 rounded-full bg-emerald/10 animate-core-ring" />
    
    {/* Inner glow */}
    <div className="absolute inset-0 -m-3 rounded-full bg-emerald/20 animate-core-glow" />
    
    {/* Core badge */}
    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald to-emerald-light flex items-center justify-center shadow-lg shadow-emerald/30 animate-core-appear">
      <Zap className="w-7 h-7 text-white" />
    </div>
    
    {/* Match score badge */}
    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 animate-score-appear">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-card border border-emerald/30 rounded-full shadow-md">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald" />
        <span className="text-xs font-semibold text-emerald">87% Match</span>
      </div>
    </div>
  </div>
);

export const MatchingVisualization = () => {
  const jobs = [
    { title: "Senior Developer", company: "TechCorp GmbH" },
    { title: "Product Manager", company: "ScaleUp AG" },
    { title: "UX Designer", company: "StartupX" },
  ];
  
  const candidates = [
    { name: "M. Schmidt", role: "Full-Stack Developer" },
    { name: "A. Müller", role: "Product Lead" },
    { name: "L. Weber", role: "Senior Designer" },
  ];

  return (
    <div className="mt-16 animate-fade-in" style={{ animationDelay: '400ms' }}>
      {/* Container with glassmorphism */}
      <div className="relative max-w-3xl mx-auto px-6 py-8 bg-card/40 backdrop-blur-md border border-border/20 rounded-3xl shadow-xl">
        {/* Background gradient */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald/5 via-transparent to-navy/5 pointer-events-none" />
        
        {/* Connection lines SVG */}
        <ConnectionLines />
        
        {/* Content grid */}
        <div className="relative grid grid-cols-3 gap-4 items-center min-h-[280px]">
          {/* Left: Jobs */}
          <div className="flex flex-col gap-3">
            {jobs.map((job, i) => (
              <JobCard key={job.title} {...job} delay={0.1 + i * 0.15} />
            ))}
          </div>
          
          {/* Center: Matching core */}
          <div className="relative h-full">
            <MatchingCore />
          </div>
          
          {/* Right: Candidates */}
          <div className="flex flex-col gap-3">
            {candidates.map((candidate, i) => (
              <CandidateCard key={candidate.name} {...candidate} delay={0.2 + i * 0.15} />
            ))}
          </div>
        </div>
        
        {/* "Perfect Match" label */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 animate-label-appear">
          <div className="px-4 py-1.5 bg-gradient-to-r from-emerald to-emerald-light text-white text-xs font-semibold rounded-full shadow-lg shadow-emerald/25">
            Perfect Match in Sekunden
          </div>
        </div>
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes card-enter-left {
          0% {
            opacity: 0;
            transform: translateX(-30px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes card-enter-right {
          0% {
            opacity: 0;
            transform: translateX(30px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes line-draw {
          0% {
            stroke-dasharray: 200;
            stroke-dashoffset: 200;
            opacity: 0;
          }
          50% {
            stroke-dashoffset: 0;
            opacity: 0.8;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.4;
          }
        }
        
        @keyframes core-ring {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.1;
          }
        }
        
        @keyframes core-glow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.2;
          }
        }
        
        @keyframes core-appear {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes score-appear {
          0%, 50% {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        @keyframes label-appear {
          0%, 60% {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        .animate-card-enter-left {
          animation: card-enter-left 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          opacity: 0;
        }
        
        .animate-card-enter-right {
          animation: card-enter-right 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          opacity: 0;
        }
        
        .animate-line-draw {
          animation: line-draw 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
        }
        
        .animate-core-ring {
          animation: core-ring 3s ease-in-out infinite;
        }
        
        .animate-core-glow {
          animation: core-glow 3s ease-in-out infinite 0.5s;
        }
        
        .animate-core-appear {
          animation: core-appear 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          animation-delay: 0.6s;
          opacity: 0;
        }
        
        .animate-score-appear {
          animation: score-appear 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .animate-label-appear {
          animation: label-appear 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
};
