import { Briefcase, User, Zap } from 'lucide-react';

const JobCard = ({ title, company, index }: { title: string; company: string; index: number }) => (
  <div 
    className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-slate-200/50 animate-card-left-loop"
    style={{ animationDelay: `${index * 0.2}s` }}
  >
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy to-slate-blue flex items-center justify-center">
      <Briefcase className="w-4 h-4 text-white" />
    </div>
    <div className="text-left">
      <p className="text-xs font-semibold text-navy">{title}</p>
      <p className="text-[10px] text-muted-foreground">{company}</p>
    </div>
  </div>
);

const CandidateCard = ({ name, role, index }: { name: string; role: string; index: number }) => (
  <div 
    className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-slate-200/50 animate-card-right-loop"
    style={{ animationDelay: `${index * 0.2}s` }}
  >
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald to-emerald/70 flex items-center justify-center">
      <User className="w-4 h-4 text-white" />
    </div>
    <div className="text-left">
      <p className="text-xs font-semibold text-navy">{name}</p>
      <p className="text-[10px] text-muted-foreground">{role}</p>
    </div>
  </div>
);

const ConnectionLines = () => (
  <svg 
    className="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 400 250"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.6" />
        <stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.6" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Connection lines with flowing animation */}
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M 60 ${60 + i * 65} Q 200 ${80 + i * 40} 340 ${60 + i * 65}`}
        fill="none"
        stroke="url(#lineGradient1)"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#glow)"
        className="animate-line-flow"
        style={{ 
          animationDelay: `${i * 0.3}s`,
          strokeDasharray: '8 12',
        }}
      />
    ))}
    
    {/* Energy particles flowing along paths */}
    {[0, 1, 2].map((i) => (
      <circle
        key={`particle-${i}`}
        r="3"
        fill="#10b981"
        filter="url(#glow)"
        className="animate-energy-particle"
        style={{ animationDelay: `${i * 0.4}s` }}
      >
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path={`M 60 ${60 + i * 65} Q 200 ${80 + i * 40} 340 ${60 + i * 65}`}
        />
      </circle>
    ))}
  </svg>
);

const MatchingCore = () => (
  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
    {/* Outer pulsing rings */}
    <div className="absolute -inset-8 rounded-full border-2 border-emerald/20 animate-ring-pulse-1" />
    <div className="absolute -inset-6 rounded-full border border-emerald/30 animate-ring-pulse-2" />
    <div className="absolute -inset-4 rounded-full border border-emerald/40 animate-ring-pulse-3" />
    
    {/* Glow effect */}
    <div className="absolute -inset-3 rounded-full bg-emerald/20 blur-xl animate-core-glow" />
    
    {/* Core circle */}
    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald to-emerald/80 flex items-center justify-center shadow-lg shadow-emerald/30 animate-core-pulse">
      <Zap className="w-6 h-6 text-white animate-zap-flash" />
    </div>
    
    {/* Match score badge */}
    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 animate-score-pulse">
      <div className="bg-white/95 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-lg border border-emerald/30">
        <span className="text-sm font-bold text-emerald animate-counter">94%</span>
        <span className="text-xs text-muted-foreground ml-1">Match</span>
      </div>
    </div>
  </div>
);

export const MatchingVisualization = () => {
  const jobs = [
    { title: 'Senior Developer', company: 'TechCorp' },
    { title: 'Product Manager', company: 'StartupXY' },
    { title: 'UX Designer', company: 'DesignCo' },
  ];

  const candidates = [
    { name: 'Anna M.', role: 'Full-Stack Dev' },
    { name: 'Thomas K.', role: 'PM Expert' },
    { name: 'Lisa S.', role: 'UI/UX Lead' },
  ];

  return (
    <div className="relative w-full max-w-xl mx-auto h-72 mt-8">
      {/* Glass container */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/20 backdrop-blur-sm rounded-2xl border border-white/30 shadow-xl overflow-hidden">
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #1e3a5f 1px, transparent 1px),
              linear-gradient(to bottom, #1e3a5f 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />
        
        {/* Connection lines */}
        <ConnectionLines />
        
        {/* Job cards - left side */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          {jobs.map((job, i) => (
            <JobCard key={i} {...job} index={i} />
          ))}
        </div>
        
        {/* Candidate cards - right side */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          {candidates.map((candidate, i) => (
            <CandidateCard key={i} {...candidate} index={i} />
          ))}
        </div>
        
        {/* Central matching core */}
        <MatchingCore />
      </div>
      
      <style>{`
        @keyframes card-left-loop {
          0%, 100% {
            transform: translateX(-8px);
            opacity: 0.7;
          }
          15%, 85% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes card-right-loop {
          0%, 100% {
            transform: translateX(8px);
            opacity: 0.7;
          }
          15%, 85% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes line-flow {
          0%, 100% {
            stroke-dashoffset: 40;
            opacity: 0.4;
          }
          50% {
            stroke-dashoffset: 0;
            opacity: 0.8;
          }
        }
        
        @keyframes ring-pulse-1 {
          0%, 100% {
            transform: scale(1);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.4;
          }
        }
        
        @keyframes ring-pulse-2 {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.5;
          }
        }
        
        @keyframes ring-pulse-3 {
          0%, 100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.6;
          }
        }
        
        @keyframes core-pulse {
          0%, 100% {
            transform: scale(0.95);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        @keyframes core-glow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2);
          }
        }
        
        @keyframes zap-flash {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          25% {
            opacity: 1;
            transform: scale(1.1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1);
          }
          75% {
            opacity: 1;
            transform: scale(1.05);
          }
        }
        
        @keyframes score-pulse {
          0%, 100% {
            transform: translateX(-50%) scale(0.95);
            opacity: 0.8;
          }
          50% {
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes energy-particle {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }
        
        .animate-card-left-loop {
          animation: card-left-loop 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-card-right-loop {
          animation: card-right-loop 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-line-flow {
          animation: line-flow 3s ease-in-out infinite;
        }
        
        .animate-ring-pulse-1 {
          animation: ring-pulse-1 4s ease-in-out infinite;
        }
        
        .animate-ring-pulse-2 {
          animation: ring-pulse-2 4s ease-in-out infinite 0.3s;
        }
        
        .animate-ring-pulse-3 {
          animation: ring-pulse-3 4s ease-in-out infinite 0.6s;
        }
        
        .animate-core-pulse {
          animation: core-pulse 2s ease-in-out infinite;
        }
        
        .animate-core-glow {
          animation: core-glow 3s ease-in-out infinite;
        }
        
        .animate-zap-flash {
          animation: zap-flash 1.5s ease-in-out infinite;
        }
        
        .animate-score-pulse {
          animation: score-pulse 3s ease-in-out infinite;
        }
        
        .animate-energy-particle {
          animation: energy-particle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
