import creationHands from "@/assets/creation-hands.png";

export const CreationHandsBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Hands Image with Animation */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img 
          src={creationHands}
          alt=""
          className="w-[85%] max-w-[1100px] h-auto opacity-[0.38] animate-hands-breathe select-none"
          style={{ 
            willChange: 'transform, opacity',
            filter: 'contrast(1.1) brightness(0.95)'
          }}
        />
      </div>

      {/* Electric Sparks SVG - positioned at contact point */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[15%] z-[2]">
        <svg 
          width="80" 
          height="80" 
          viewBox="-40 -40 80 80"
          className="overflow-visible"
        >
          {/* Glow at contact point */}
          <circle 
            cx="0" 
            cy="0" 
            r="12"
            fill="hsl(var(--foreground))"
            className="animate-contact-glow"
            style={{ filter: 'blur(8px)' }}
          />
          
          {/* Electric spark lines */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <line
              key={i}
              x1="0"
              y1="0"
              x2={Math.cos(angle * Math.PI / 180) * 25}
              y2={Math.sin(angle * Math.PI / 180) * 25}
              stroke="hsl(var(--foreground))"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="animate-spark-flash"
              style={{ 
                animationDelay: `${i * 0.05}s`,
                opacity: 0
              }}
            />
          ))}
          
          {/* Central spark dot */}
          <circle 
            cx="0" 
            cy="0" 
            r="3"
            fill="hsl(var(--foreground))"
            className="animate-contact-glow"
          />
        </svg>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes hands-breathe {
          0%, 100% {
            opacity: 0.35;
            transform: scale(1);
          }
          50% {
            opacity: 0.45;
            transform: scale(1.015);
          }
        }
        
        @keyframes spark-flash {
          0%, 40%, 60%, 100% {
            opacity: 0;
            transform: scaleX(0.3);
          }
          45%, 55% {
            opacity: 0.6;
            transform: scaleX(1);
          }
        }
        
        @keyframes contact-glow {
          0%, 40%, 60%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.3);
          }
        }
        
        .animate-hands-breathe {
          animation: hands-breathe 10s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-spark-flash {
          animation: spark-flash 10s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .animate-contact-glow {
          animation: contact-glow 10s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
};
