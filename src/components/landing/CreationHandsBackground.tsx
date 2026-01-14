import { useEffect, useState } from 'react';
import creationHands from '@/assets/creation-hands.png';

const ElectricSparks = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  
  return (
    <div className="absolute left-1/2 top-1/2 z-10" style={{ transform: 'translateX(-50%) translateY(calc(-50% - 80px))' }}>
      {/* Central glow */}
      <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/60 blur-xl animate-pulse" />
      <div className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 blur-md" />
      
      {/* Spark lines */}
      <svg 
        className="absolute w-32 h-32 -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 100 100"
      >
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
          <line
            key={i}
            x1="50"
            y1="50"
            x2={50 + Math.cos((angle * Math.PI) / 180) * 35}
            y2={50 + Math.sin((angle * Math.PI) / 180) * 35}
            stroke="url(#sparkGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-spark-shoot"
            style={{ 
              animationDelay: `${i * 50}ms`,
              opacity: 0.8
            }}
          />
        ))}
        <defs>
          <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-emerald-300 animate-particle-fly"
          style={{
            animationDelay: `${i * 80}ms`,
            transform: `rotate(${i * 45}deg) translateX(0)`,
          }}
        />
      ))}
    </div>
  );
};

export const CreationHandsBackground = () => {
  const [showSparks, setShowSparks] = useState(false);
  
  useEffect(() => {
    // Sync sparks with animation timing (12s loop, sparks at 45-55%)
    const interval = setInterval(() => {
      setShowSparks(true);
      setTimeout(() => setShowSparks(false), 1200);
    }, 12000);
    
    // Initial spark after first approach
    const initialTimeout = setTimeout(() => {
      setShowSparks(true);
      setTimeout(() => setShowSparks(false), 1200);
    }, 5400); // 45% of 12s
    
    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Left hand - clipped to show only left portion */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-hand-left"
        style={{ 
          clipPath: 'inset(0 55% 0 0)',
        }}
      >
        <img
          src={creationHands}
          alt=""
          className="w-[80%] max-w-4xl opacity-15"
          style={{ filter: 'grayscale(30%)' }}
        />
      </div>
      
      {/* Right hand - clipped to show only right portion */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-hand-right"
        style={{ 
          clipPath: 'inset(0 0 0 45%)',
        }}
      >
        <img
          src={creationHands}
          alt=""
          className="w-[80%] max-w-4xl opacity-15"
          style={{ filter: 'grayscale(30%)' }}
        />
      </div>
      
      {/* Sparks at contact point */}
      <ElectricSparks visible={showSparks} />
      
      <style>{`
        @keyframes hand-left {
          0%, 30% {
            transform: translate(-40px, -80px);
          }
          45%, 55% {
            transform: translate(0, -80px);
          }
          70%, 100% {
            transform: translate(-40px, -80px);
          }
        }
        
        @keyframes hand-right {
          0%, 30% {
            transform: translate(40px, -80px);
          }
          45%, 55% {
            transform: translate(0, -80px);
          }
          70%, 100% {
            transform: translate(40px, -80px);
          }
        }
        
        @keyframes spark-shoot {
          0% {
            opacity: 0;
            stroke-dasharray: 0 100;
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            stroke-dasharray: 20 100;
          }
        }
        
        @keyframes particle-fly {
          0% {
            transform: rotate(var(--angle, 0deg)) translateX(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--angle, 0deg)) translateX(40px);
            opacity: 0;
          }
        }
        
        .animate-hand-left {
          animation: hand-left 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-hand-right {
          animation: hand-right 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-spark-shoot {
          animation: spark-shoot 0.6s ease-out forwards;
        }
        
        .animate-particle-fly {
          animation: particle-fly 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
