import React from 'react';

const leftHand = `
            ██
           ████
          ██████
         ████████
        ██████████
       ████████████
      ██████████████
     ████████████████
    ██████████████████
   ████████████████████
  ██████████████████████
 ████████████████████████
██████████████████████████
 ██████████████████████████
  ████████████████████████
   ██████████████████████
    ████████████████████
     ██████████████████
      ████████████████
       ██████████████
        ████████████
         ██████████
          ████████
           ██████
            ████
             ██`;

const rightHand = `
                          ██
                         ████
                        ██████
                       ████████
                      ██████████
                     ████████████
                    ██████████████
                   ████████████████
                  ██████████████████
                 ████████████████████
                ██████████████████████
               ████████████████████████
              ██████████████████████████
             ██████████████████████████
              ████████████████████████
               ██████████████████████
                ████████████████████
                 ██████████████████
                  ████████████████
                   ██████████████
                    ████████████
                     ██████████
                      ████████
                       ██████
                        ████
                         ██`;

const ElectricSparks = () => (
  <svg 
    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 z-10"
    viewBox="0 0 100 100"
  >
    {/* Central glow */}
    <circle 
      cx="50" 
      cy="50" 
      r="8" 
      className="animate-[spark-glow_12s_ease-in-out_infinite]"
      style={{
        fill: 'hsl(var(--emerald))',
        filter: 'blur(4px)',
        opacity: 0
      }}
    />
    
    {/* Spark lines */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <line
        key={i}
        x1="50"
        y1="50"
        x2={50 + Math.cos(angle * Math.PI / 180) * 25}
        y2={50 + Math.sin(angle * Math.PI / 180) * 25}
        stroke="hsl(var(--emerald))"
        strokeWidth="1"
        strokeLinecap="round"
        className="animate-[spark-line_12s_ease-in-out_infinite]"
        style={{
          opacity: 0,
          animationDelay: `${i * 0.05}s`,
          filter: 'drop-shadow(0 0 3px hsl(var(--emerald)))'
        }}
      />
    ))}
    
    {/* Particles */}
    {[...Array(6)].map((_, i) => (
      <circle
        key={`particle-${i}`}
        cx="50"
        cy="50"
        r="1.5"
        fill="hsl(var(--emerald))"
        className="animate-[spark-particle_12s_ease-out_infinite]"
        style={{
          opacity: 0,
          animationDelay: `${4.5 + i * 0.1}s`,
          ['--particle-angle' as string]: `${i * 60}deg`
        }}
      />
    ))}
  </svg>
);

export const AsciiHandsAnimation = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Container for hands */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Left Hand */}
        <pre 
          className="absolute font-mono text-[6px] sm:text-[8px] md:text-[10px] lg:text-[12px] leading-[0.8] text-emerald/15 select-none animate-[left-hand-move_12s_cubic-bezier(0.4,0,0.2,1)_infinite] whitespace-pre"
          style={{ 
            left: '5%',
            transform: 'translateX(-60px)',
            textShadow: '0 0 20px hsl(var(--emerald) / 0.1)'
          }}
          aria-hidden="true"
        >
          {leftHand}
        </pre>
        
        {/* Right Hand */}
        <pre 
          className="absolute font-mono text-[6px] sm:text-[8px] md:text-[10px] lg:text-[12px] leading-[0.8] text-emerald/15 select-none animate-[right-hand-move_12s_cubic-bezier(0.4,0,0.2,1)_infinite] whitespace-pre"
          style={{ 
            right: '5%',
            transform: 'translateX(60px)',
            textShadow: '0 0 20px hsl(var(--emerald) / 0.1)'
          }}
          aria-hidden="true"
        >
          {rightHand}
        </pre>
        
        {/* Electric Sparks in the middle */}
        <ElectricSparks />
      </div>
      
      {/* Animations */}
      <style>{`
        @keyframes left-hand-move {
          0%, 100% {
            transform: translateX(-60px);
            opacity: 0.12;
          }
          35% {
            transform: translateX(-60px);
            opacity: 0.12;
          }
          45%, 55% {
            transform: translateX(0px);
            opacity: 0.22;
          }
          65% {
            transform: translateX(-60px);
            opacity: 0.12;
          }
        }
        
        @keyframes right-hand-move {
          0%, 100% {
            transform: translateX(60px);
            opacity: 0.12;
          }
          35% {
            transform: translateX(60px);
            opacity: 0.12;
          }
          45%, 55% {
            transform: translateX(0px);
            opacity: 0.22;
          }
          65% {
            transform: translateX(60px);
            opacity: 0.12;
          }
        }
        
        @keyframes spark-glow {
          0%, 40%, 60%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          45%, 55% {
            opacity: 0.8;
            transform: scale(1.5);
          }
          50% {
            opacity: 1;
            transform: scale(2);
          }
        }
        
        @keyframes spark-line {
          0%, 40%, 60%, 100% {
            opacity: 0;
            stroke-dasharray: 0 25;
          }
          45%, 55% {
            opacity: 0.7;
            stroke-dasharray: 15 10;
          }
          50% {
            opacity: 1;
            stroke-dasharray: 20 5;
          }
        }
        
        @keyframes spark-particle {
          0%, 44% {
            opacity: 0;
            transform: translate(0, 0) scale(1);
          }
          45% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          60% {
            opacity: 0;
            transform: translate(
              calc(cos(var(--particle-angle)) * 30px),
              calc(sin(var(--particle-angle)) * 30px)
            ) scale(0);
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default AsciiHandsAnimation;
