import { useEffect, useState } from 'react';
import creationHands from '@/assets/creation-hands.png';

const ElectricSparks = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  
  return (
    <div className="absolute left-1/2 top-1/2 z-10" style={{ transform: 'translateX(-50%) translateY(calc(-50% - 80px))' }}>
      {/* Expanding pulse ring */}
      <div className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400/60 animate-pulse-ring" />
      <div className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/40 animate-pulse-ring" style={{ animationDelay: '100ms' }} />
      
      {/* Central glow - enhanced */}
      <div className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/50 blur-2xl animate-pulse" />
      <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/40 blur-xl animate-pulse" style={{ animationDelay: '50ms' }} />
      <div className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 blur-md" />
      
      {/* Spark lines - more of them */}
      <svg 
        className="absolute w-40 h-40 -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 100 100"
      >
        {[0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350].map((angle, i) => (
          <line
            key={i}
            x1="50"
            y1="50"
            x2={50 + Math.cos((angle * Math.PI) / 180) * 40}
            y2={50 + Math.sin((angle * Math.PI) / 180) * 40}
            stroke={i % 2 === 0 ? "url(#sparkGradient)" : "url(#goldGradient)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-spark-shoot"
            style={{ 
              animationDelay: `${i * 40}ms`,
              opacity: 0.9
            }}
          />
        ))}
        <defs>
          <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Particles - more and varied colors */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={`absolute w-1.5 h-1.5 rounded-full animate-particle-fly ${i % 3 === 0 ? 'bg-amber-300' : 'bg-emerald-300'}`}
          style={{
            animationDelay: `${i * 60}ms`,
            '--angle': `${i * 30}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export const CreationHandsBackground = () => {
  const [showSparks, setShowSparks] = useState(false);
  
  useEffect(() => {
    // Sync sparks with animation timing (10s loop, sparks at 45-55%)
    const interval = setInterval(() => {
      setShowSparks(true);
      setTimeout(() => setShowSparks(false), 1400);
    }, 10000);
    
    // Initial spark after first approach
    const initialTimeout = setTimeout(() => {
      setShowSparks(true);
      setTimeout(() => setShowSparks(false), 1400);
    }, 4500); // 45% of 10s
    
    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Left hand - soft mask gradient */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-hand-left"
        style={{ 
          maskImage: 'linear-gradient(to right, black 0%, black 40%, transparent 58%)',
          WebkitMaskImage: 'linear-gradient(to right, black 0%, black 40%, transparent 58%)',
        }}
      >
        <img
          src={creationHands}
          alt=""
          className="w-[85%] max-w-5xl opacity-30"
          style={{ filter: 'grayscale(20%) contrast(1.1)' }}
        />
      </div>
      
      {/* Right hand - soft mask gradient */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-hand-right"
        style={{ 
          maskImage: 'linear-gradient(to left, black 0%, black 40%, transparent 58%)',
          WebkitMaskImage: 'linear-gradient(to left, black 0%, black 40%, transparent 58%)',
        }}
      >
        <img
          src={creationHands}
          alt=""
          className="w-[85%] max-w-5xl opacity-30"
          style={{ filter: 'grayscale(20%) contrast(1.1)' }}
        />
      </div>
      
      {/* Sparks at contact point */}
      <ElectricSparks visible={showSparks} />
      
      <style>{`
        @keyframes hand-left {
          0%, 30% {
            transform: translate(-30px, -80px);
          }
          42% {
            transform: translate(3px, -80px);
          }
          45%, 55% {
            transform: translate(0, -80px);
          }
          58% {
            transform: translate(3px, -80px);
          }
          70%, 100% {
            transform: translate(-30px, -80px);
          }
        }
        
        @keyframes hand-right {
          0%, 30% {
            transform: translate(30px, -80px);
          }
          42% {
            transform: translate(-3px, -80px);
          }
          45%, 55% {
            transform: translate(0, -80px);
          }
          58% {
            transform: translate(-3px, -80px);
          }
          70%, 100% {
            transform: translate(30px, -80px);
          }
        }
        
        @keyframes spark-shoot {
          0% {
            opacity: 0;
            stroke-dasharray: 0 100;
          }
          15% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            stroke-dasharray: 25 100;
          }
        }
        
        @keyframes particle-fly {
          0% {
            transform: rotate(var(--angle, 0deg)) translateX(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--angle, 0deg)) translateX(50px);
            opacity: 0;
          }
        }
        
        @keyframes pulse-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.5);
            opacity: 0;
          }
        }
        
        .animate-hand-left {
          animation: hand-left 10s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
        }
        
        .animate-hand-right {
          animation: hand-right 10s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
        }
        
        .animate-spark-shoot {
          animation: spark-shoot 0.7s ease-out forwards;
        }
        
        .animate-particle-fly {
          animation: particle-fly 0.9s ease-out forwards;
        }
        
        .animate-pulse-ring {
          animation: pulse-ring 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
