import { useMemo } from "react";

const ASCII_CHARS = "0 1 / \\ _ # = + < > { } [ ] | - ~ . : ; * @ $ % & ^".split(" ");

export const AsciiCodeOverlay = () => {
  // Generate ASCII pattern once
  const asciiPattern = useMemo(() => {
    const rows = 60;
    const cols = 120;
    const lines: string[] = [];
    
    for (let row = 0; row < rows; row++) {
      let line = "";
      for (let col = 0; col < cols; col++) {
        // Add some randomness with spaces for breathing room
        if (Math.random() > 0.7) {
          line += ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)];
        } else {
          line += " ";
        }
        // Add spacing
        line += " ";
      }
      lines.push(line);
    }
    
    return lines.join("\n");
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
      {/* ASCII Text Layer */}
      <div 
        className="absolute inset-0 font-mono text-[10px] leading-[14px] text-foreground whitespace-pre select-none animate-ascii-drift"
        style={{
          opacity: 0.035,
          willChange: 'transform',
          width: '200%',
          height: '200%',
        }}
      >
        {asciiPattern}
        {/* Duplicate for seamless loop */}
        {asciiPattern}
      </div>

      {/* Fade edges for seamless blend */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes ascii-drift {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(-3%, -50%);
          }
        }
        
        .animate-ascii-drift {
          animation: ascii-drift 45s linear infinite;
        }
      `}</style>
    </div>
  );
};
