import { useMemo } from "react";

// Left hand (God's hand) - index finger pointing right
const LEFT_HAND = [
  "                                    . : x",
  "                                  . x X X x",
  "                                . x X X X x",
  "                    . x x .    . x X X X x .",
  "                  . x X X x . x X X X # x  ",
  "                 . x X X X x x X X # # x   ",
  "     . x x .    . x X X X X X X # # # x    ",
  "   . x X X x . . x X X X X X # # # # x     ",
  "  . x X X X x x x X X X X # # # @ # x      ",
  "  : x X X X X X X X X X # # # @ @ x        ",
  "  : x X X X X X X X X # # # @ @ x .        ",
  "  . x X X X X X X X # # # @ @ x .          ",
  "    x X X X X X X X # # @ @ # x            ",
  "    . x X X X X X # # @ @ # x .            ",
  "      . x X X X X # @ @ # x .              ",
  "        . x X X X # @ # x .                ",
  "          . x X X # # x .                  ",
  "           . x X X # x .                   ",
  "            . x X X x .                    ",
  "             : x X x .                     ",
  "              . x x                        ",
  "               . x                         ",
  "                .                          ",
];

// Right hand (Adam's hand) - index finger pointing left
const RIGHT_HAND = [
  "x : .                                    ",
  "  x X X x .                              ",
  "  x X X X x .                            ",
  "  . x X X X x .    . x x .               ",
  "    x # X X X x . x X X x .              ",
  "     x # # X X x x X X X x .             ",
  "      x # # # X X X X X X x .    . x x . ",
  "       x # # # # X X X X X x . . x X X x.",
  "        x # @ # # X X X X x x x X X X x .",
  "          x @ @ # # # X X X X X X X X x :",
  "          . x @ @ # # # X X X X X X X x :",
  "            . x @ @ # # # X X X X X X x .",
  "              x # @ @ # # X X X X X X x  ",
  "              . x # @ @ # # X X X X x .  ",
  "                . x # @ @ # X X X X x .  ",
  "                  . x # @ # X X X x .    ",
  "                    . x # # X X x .      ",
  "                     . x # X X x .       ",
  "                      . x X X x .        ",
  "                       . x X x :         ",
  "                          x x .          ",
  "                           x .           ",
  "                            .            ",
];

const SPARK_CHARS = ["*", "+", ".", "x", ":", "*", "·", "°", "×"];

export const AsciiHandsArt = () => {
  const sparkLines = useMemo(() => {
    const lines: string[] = [];
    for (let i = 0; i < 23; i++) {
      let line = "";
      for (let j = 0; j < 4; j++) {
        if (Math.random() > 0.6) {
          line += SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)];
        } else {
          line += " ";
        }
      }
      lines.push(line);
    }
    return lines;
  }, []);

  return (
    <div className="absolute inset-x-0 top-4 md:top-12 overflow-hidden pointer-events-none flex justify-center z-[5]">
      <div className="relative flex items-start gap-0 select-none animate-ascii-breathe">
        {/* Left Hand */}
        <pre className="font-mono text-[8px] sm:text-xs md:text-sm lg:text-base leading-none text-foreground/[0.14] animate-hand-drift-left whitespace-pre">
          {LEFT_HAND.join("\n")}
        </pre>

        {/* Spark Gap */}
        <div className="relative w-6 sm:w-8 md:w-12 flex items-center justify-center overflow-hidden">
          <pre className="font-mono text-[8px] sm:text-xs md:text-sm leading-none text-foreground/[0.08] animate-spark-flicker whitespace-pre text-center">
            {sparkLines.join("\n")}
          </pre>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-foreground/[0.04] blur-md animate-spark-flash" />
          </div>
        </div>

        {/* Right Hand */}
        <pre className="font-mono text-[8px] sm:text-xs md:text-sm lg:text-base leading-none text-foreground/[0.14] animate-hand-drift-right whitespace-pre">
          {RIGHT_HAND.join("\n")}
        </pre>
      </div>

      {/* Fade edges */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
      </div>

      <style>{`
        @keyframes hand-drift-left {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(10px); }
        }
        @keyframes hand-drift-right {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-10px); }
        }
        @keyframes ascii-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes spark-flicker {
          0%, 100% { opacity: 0.08; }
          25% { opacity: 0.18; }
          50% { opacity: 0.05; }
          75% { opacity: 0.14; }
        }
        @keyframes spark-flash {
          0%, 85%, 100% { opacity: 0.03; transform: scale(1); }
          90% { opacity: 0.2; transform: scale(1.4); }
        }
        .animate-hand-drift-left { animation: hand-drift-left 6s ease-in-out infinite; }
        .animate-hand-drift-right { animation: hand-drift-right 6s ease-in-out infinite; }
        .animate-ascii-breathe { animation: ascii-breathe 4s ease-in-out infinite; }
        .animate-spark-flicker { animation: spark-flicker 2.5s ease-in-out infinite; }
        .animate-spark-flash { animation: spark-flash 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};
