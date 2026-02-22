import { useMemo } from "react";

const CODE_CHARS = ["{", "}", "=>", "fn", "()", "0", "1", "match", "hire", "//", "&&", "||", "let", "if", "++", "==", "<<", ">>", "0x", "nil"];

// Generate columns of code characters for the rain effect
const generateCodeColumns = (cols: number, rows: number) => {
  const columns: string[][] = [];
  for (let c = 0; c < cols; c++) {
    const col: string[] = [];
    for (let r = 0; r < rows * 2; r++) {
      col.push(CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]);
    }
    columns.push(col);
  }
  return columns;
};

export const AsciiHandsArt = () => {
  const leftColumns = useMemo(() => generateCodeColumns(28, 20), []);
  const rightColumns = useMemo(() => generateCodeColumns(28, 20), []);

  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden pointer-events-none flex justify-center z-[5]" style={{ height: "70vh" }}>
      {/* SVG Definitions for clip paths */}
      <svg width="0" height="0" className="absolute">
        <defs>
          {/* Left hand - God's hand reaching right */}
          <clipPath id="left-hand-clip" clipPathUnits="objectBoundingBox">
            <path d="
              M 0.85,0.08 
              C 0.88,0.06 0.92,0.05 0.95,0.07
              C 0.98,0.09 1.0,0.13 0.98,0.17
              C 0.96,0.20 0.92,0.21 0.88,0.19
              
              L 0.82,0.22
              C 0.86,0.20 0.90,0.18 0.94,0.20
              C 0.98,0.22 1.0,0.28 0.97,0.32
              C 0.94,0.36 0.90,0.35 0.86,0.33
              
              L 0.78,0.30
              C 0.82,0.30 0.88,0.28 0.92,0.34
              C 0.96,0.40 0.95,0.46 0.90,0.48
              C 0.86,0.50 0.82,0.48 0.78,0.44
              
              L 0.72,0.38
              C 0.76,0.42 0.80,0.48 0.82,0.54
              C 0.84,0.60 0.82,0.66 0.76,0.68
              C 0.70,0.70 0.66,0.66 0.64,0.60
              
              L 0.60,0.50
              C 0.58,0.56 0.56,0.62 0.52,0.66
              C 0.48,0.70 0.42,0.72 0.36,0.70
              L 0.30,0.68
              C 0.24,0.72 0.18,0.74 0.14,0.78
              C 0.10,0.82 0.06,0.88 0.04,0.94
              C 0.02,0.98 0.0,1.0 0.0,0.96
              C 0.0,0.90 0.02,0.82 0.06,0.74
              C 0.10,0.66 0.16,0.60 0.22,0.56
              C 0.28,0.52 0.32,0.50 0.36,0.46
              C 0.40,0.42 0.42,0.38 0.44,0.34
              C 0.46,0.30 0.48,0.26 0.52,0.22
              C 0.56,0.18 0.62,0.14 0.68,0.12
              C 0.74,0.10 0.80,0.09 0.85,0.08
              Z
            " />
          </clipPath>

          {/* Right hand - Adam's hand reaching left (mirrored) */}
          <clipPath id="right-hand-clip" clipPathUnits="objectBoundingBox">
            <path d="
              M 0.15,0.08 
              C 0.12,0.06 0.08,0.05 0.05,0.07
              C 0.02,0.09 0.0,0.13 0.02,0.17
              C 0.04,0.20 0.08,0.21 0.12,0.19
              
              L 0.18,0.22
              C 0.14,0.20 0.10,0.18 0.06,0.20
              C 0.02,0.22 0.0,0.28 0.03,0.32
              C 0.06,0.36 0.10,0.35 0.14,0.33
              
              L 0.22,0.30
              C 0.18,0.30 0.12,0.28 0.08,0.34
              C 0.04,0.40 0.05,0.46 0.10,0.48
              C 0.14,0.50 0.18,0.48 0.22,0.44
              
              L 0.28,0.38
              C 0.24,0.42 0.20,0.48 0.18,0.54
              C 0.16,0.60 0.18,0.66 0.24,0.68
              C 0.30,0.70 0.34,0.66 0.36,0.60
              
              L 0.40,0.50
              C 0.42,0.56 0.44,0.62 0.48,0.66
              C 0.52,0.70 0.58,0.72 0.64,0.70
              L 0.70,0.68
              C 0.76,0.72 0.82,0.74 0.86,0.78
              C 0.90,0.82 0.94,0.88 0.96,0.94
              C 0.98,0.98 1.0,1.0 1.0,0.96
              C 1.0,0.90 0.98,0.82 0.94,0.74
              C 0.90,0.66 0.84,0.60 0.78,0.56
              C 0.72,0.52 0.68,0.50 0.64,0.46
              C 0.60,0.42 0.58,0.38 0.56,0.34
              C 0.54,0.30 0.52,0.26 0.48,0.22
              C 0.44,0.18 0.38,0.14 0.32,0.12
              C 0.26,0.10 0.20,0.09 0.15,0.08
              Z
            " />
          </clipPath>
        </defs>
      </svg>

      <div className="relative w-full h-full flex items-start justify-center animate-hands-breathe">
        {/* Left Hand */}
        <div
          className="absolute left-[5%] md:left-[10%] top-[5%] w-[40%] md:w-[35%] animate-hand-drift-left"
          style={{
            aspectRatio: "1 / 1",
            clipPath: "url(#left-hand-clip)",
          }}
        >
          <div className="w-full h-full overflow-hidden relative bg-foreground/[0.04]">
            <div className="absolute inset-0 flex gap-[2px] font-mono text-[10px] md:text-xs text-foreground/[0.20]">
              {leftColumns.map((col, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-[2px] whitespace-nowrap animate-code-rain"
                  style={{
                    animationDelay: `${-(i * 0.7)}s`,
                    animationDuration: `${12 + (i % 5) * 3}s`,
                  }}
                >
                  {col.map((char, j) => (
                    <span key={j} className="leading-tight opacity-70">{char}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Hand */}
        <div
          className="absolute right-[5%] md:right-[10%] top-[5%] w-[40%] md:w-[35%] animate-hand-drift-right"
          style={{
            aspectRatio: "1 / 1",
            clipPath: "url(#right-hand-clip)",
          }}
        >
          <div className="w-full h-full overflow-hidden relative bg-foreground/[0.04]">
            <div className="absolute inset-0 flex gap-[2px] font-mono text-[10px] md:text-xs text-foreground/[0.20]">
              {rightColumns.map((col, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-[2px] whitespace-nowrap animate-code-rain"
                  style={{
                    animationDelay: `${-(i * 0.5 + 3)}s`,
                    animationDuration: `${14 + (i % 4) * 2}s`,
                  }}
                >
                  {col.map((char, j) => (
                    <span key={j} className="leading-tight opacity-70">{char}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Spark between fingertips */}
        <div className="absolute left-1/2 top-[12%] -translate-x-1/2 flex items-center justify-center">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-foreground/[0.06] blur-lg animate-spark-flash" />
          <span className="absolute font-mono text-foreground/[0.12] text-xs animate-spark-flicker select-none">⚡</span>
        </div>
      </div>

      {/* Fade edges */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute top-0 left-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent" />
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent" />
      </div>

      <style>{`
        @keyframes hand-drift-left {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(12px); }
        }
        @keyframes hand-drift-right {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-12px); }
        }
        @keyframes hands-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes code-rain {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes spark-flicker {
          0%, 100% { opacity: 0.08; }
          25% { opacity: 0.25; }
          50% { opacity: 0.04; }
          75% { opacity: 0.18; }
        }
        @keyframes spark-flash {
          0%, 85%, 100% { opacity: 0.04; transform: scale(1); }
          90% { opacity: 0.3; transform: scale(1.8); }
        }
        .animate-hand-drift-left { animation: hand-drift-left 6s ease-in-out infinite; }
        .animate-hand-drift-right { animation: hand-drift-right 6s ease-in-out infinite; }
        .animate-hands-breathe { animation: hands-breathe 4s ease-in-out infinite; }
        .animate-code-rain { animation: code-rain 15s linear infinite; }
        .animate-spark-flicker { animation: spark-flicker 2.5s ease-in-out infinite; }
        .animate-spark-flash { animation: spark-flash 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};
