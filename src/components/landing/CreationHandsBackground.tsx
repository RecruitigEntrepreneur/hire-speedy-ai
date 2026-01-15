import creationHands from '@/assets/creation-hands.png';

export const CreationHandsBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
      <img
        src={creationHands}
        alt=""
        className="w-[90%] max-w-6xl opacity-25 animate-breathe"
        style={{ 
          filter: 'grayscale(20%) contrast(1.1)',
          transform: 'translateY(-60px)'
        }}
      />
      
      <style>{`
        @keyframes breathe {
          0%, 100% {
            transform: translateY(-60px) scale(1);
            opacity: 0.20;
          }
          50% {
            transform: translateY(-60px) scale(1.02);
            opacity: 0.28;
          }
        }
        
        .animate-breathe {
          animation: breathe 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
