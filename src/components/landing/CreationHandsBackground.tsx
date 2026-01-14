import creationHands from "@/assets/creation-hands.png";

export const CreationHandsBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Container for split hands animation */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Left Hand - clipped to show only left half */}
        <div 
          className="absolute animate-left-hand-approach"
          style={{ 
            clipPath: 'inset(0 50% 0 0)',
            willChange: 'transform, opacity'
          }}
        >
          <img 
            src={creationHands}
            alt=""
            className="w-[85%] max-w-[1100px] h-auto select-none"
            style={{ 
              filter: 'contrast(1.1) brightness(0.95)'
            }}
          />
        </div>
        
        {/* Right Hand - clipped to show only right half */}
        <div 
          className="absolute animate-right-hand-approach"
          style={{ 
            clipPath: 'inset(0 0 0 50%)',
            willChange: 'transform, opacity'
          }}
        >
          <img 
            src={creationHands}
            alt=""
            className="w-[85%] max-w-[1100px] h-auto select-none"
            style={{ 
              filter: 'contrast(1.1) brightness(0.95)'
            }}
          />
        </div>
      </div>

      {/* Electric Sparks SVG - positioned at contact point */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[15%] z-[2]">
        <svg 
          width="120" 
          height="120" 
          viewBox="-60 -60 120 120"
          className="overflow-visible"
        >
          {/* Outer glow ring */}
          <circle 
            cx="0" 
            cy="0" 
            r="30"
            fill="none"
            stroke="hsl(var(--emerald))"
            strokeWidth="0.5"
            className="animate-spark-ring"
            style={{ filter: 'blur(4px)' }}
          />
          
          {/* Inner glow at contact point */}
          <circle 
            cx="0" 
            cy="0" 
            r="15"
            fill="hsl(var(--emerald))"
            className="animate-contact-glow"
            style={{ filter: 'blur(12px)' }}
          />
          
          {/* Electric spark lines - primary */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
            <line
              key={`primary-${i}`}
              x1="0"
              y1="0"
              x2={Math.cos(angle * Math.PI / 180) * (20 + (i % 3) * 8)}
              y2={Math.sin(angle * Math.PI / 180) * (20 + (i % 3) * 8)}
              stroke="hsl(var(--emerald))"
              strokeWidth="1"
              strokeLinecap="round"
              className="animate-spark-flash"
              style={{ 
                animationDelay: `${i * 0.03}s`,
                opacity: 0
              }}
            />
          ))}
          
          {/* Secondary sparks - smaller, offset angles */}
          {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((angle, i) => (
            <line
              key={`secondary-${i}`}
              x1={Math.cos(angle * Math.PI / 180) * 5}
              y1={Math.sin(angle * Math.PI / 180) * 5}
              x2={Math.cos(angle * Math.PI / 180) * (12 + (i % 2) * 6)}
              y2={Math.sin(angle * Math.PI / 180) * (12 + (i % 2) * 6)}
              stroke="hsl(var(--foreground))"
              strokeWidth="0.5"
              strokeLinecap="round"
              className="animate-spark-flash-delayed"
              style={{ 
                animationDelay: `${0.1 + i * 0.025}s`,
                opacity: 0
              }}
            />
          ))}
          
          {/* Central spark core */}
          <circle 
            cx="0" 
            cy="0" 
            r="4"
            fill="hsl(var(--emerald))"
            className="animate-core-pulse"
          />
          
          {/* Particle effects */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <circle
              key={`particle-${i}`}
              cx="0"
              cy="0"
              r="1.5"
              fill="hsl(var(--emerald-light))"
              className="animate-particle-fly"
              style={{
                animationDelay: `${4.2 + i * 0.08}s`,
                '--particle-angle': `${angle}deg`,
                opacity: 0
              } as React.CSSProperties}
            />
          ))}
        </svg>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes left-hand-approach {
          0%, 100% {
            transform: translateX(-25px) scale(0.98);
            opacity: 0.30;
          }
          35% {
            transform: translateX(-15px) scale(0.99);
            opacity: 0.35;
          }
          42%, 58% {
            transform: translateX(0) scale(1);
            opacity: 0.42;
          }
          65% {
            transform: translateX(-15px) scale(0.99);
            opacity: 0.35;
          }
        }
        
        @keyframes right-hand-approach {
          0%, 100% {
            transform: translateX(25px) scale(0.98);
            opacity: 0.30;
          }
          35% {
            transform: translateX(15px) scale(0.99);
            opacity: 0.35;
          }
          42%, 58% {
            transform: translateX(0) scale(1);
            opacity: 0.42;
          }
          65% {
            transform: translateX(15px) scale(0.99);
            opacity: 0.35;
          }
        }
        
        @keyframes spark-flash {
          0%, 38%, 62%, 100% {
            opacity: 0;
            transform: scaleX(0.2);
          }
          42%, 58% {
            opacity: 0.8;
            transform: scaleX(1);
          }
          50% {
            opacity: 1;
            transform: scaleX(1.1);
          }
        }
        
        @keyframes spark-flash-delayed {
          0%, 40%, 60%, 100% {
            opacity: 0;
            transform: scaleX(0.3);
          }
          45%, 55% {
            opacity: 0.5;
            transform: scaleX(1);
          }
        }
        
        @keyframes spark-ring {
          0%, 38%, 62%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          45%, 55% {
            opacity: 0.4;
            transform: scale(1.2);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.5);
          }
        }
        
        @keyframes contact-glow {
          0%, 38%, 62%, 100% {
            opacity: 0;
            transform: scale(0.3);
          }
          45%, 55% {
            opacity: 0.5;
            transform: scale(1.2);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.4);
          }
        }
        
        @keyframes core-pulse {
          0%, 38%, 62%, 100% {
            opacity: 0;
            transform: scale(0);
          }
          42%, 58% {
            opacity: 0.9;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }
        
        @keyframes particle-fly {
          0%, 38%, 100% {
            opacity: 0;
            transform: translate(0, 0) scale(1);
          }
          42% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          62% {
            opacity: 0;
            transform: 
              translateX(calc(cos(var(--particle-angle)) * 40px))
              translateY(calc(sin(var(--particle-angle)) * 40px))
              scale(0);
          }
        }
        
        .animate-left-hand-approach {
          animation: left-hand-approach 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-right-hand-approach {
          animation: right-hand-approach 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-spark-flash {
          animation: spark-flash 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-spark-flash-delayed {
          animation: spark-flash-delayed 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-spark-ring {
          animation: spark-ring 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-contact-glow {
          animation: contact-glow 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-core-pulse {
          animation: core-pulse 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-particle-fly {
          animation: particle-fly 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
};
