import { useMemo } from "react";

// ASCII art hand shapes built from code characters
const LEFT_HAND = [
  "                        ╭──╮   ",
  "                       │ 0 │   ",
  "                  ╭──╮ │   │   ",
  "                 │ 1 │ │   │   ",
  "            ╭──╮ │   │ │   │   ",
  "           │ { │ │   │ │   │   ",
  "      ╭──╮ │   │ │   │ │   │   ",
  "     │ < │ │   │ │   │ │   │   ",
  "     │   │ │   │ │   │ │   │   ",
  "     │   │ │   │ │   │ ╰───╯   ",
  "     │   │ │   │ ╰───╯         ",
  "     │   │ ╰───╯               ",
  "     │   ╰──────────╮          ",
  "     │              │          ",
  "     ╰──────────────╯          ",
];

const RIGHT_HAND = [
  "   ╭──╮                        ",
  "   │ 1 │                       ",
  "   │   │ ╭──╮                  ",
  "   │   │ │ 0 │                 ",
  "   │   │ │   │ ╭──╮            ",
  "   │   │ │   │ │ } │           ",
  "   │   │ │   │ │   │ ╭──╮      ",
  "   │   │ │   │ │   │ │ > │     ",
  "   │   │ │   │ │   │ │   │     ",
  "   ╰───╯ │   │ │   │ │   │     ",
  "         ╰───╯ │   │ │   │     ",
  "               ╰───╯ │   │     ",
  "          ╭──────────╯   │     ",
  "          │              │     ",
  "          ╰──────────────╯     ",
];

const SPARK_CHARS = ["⚡", "✦", "◈", "◇", "∞", "⟨⟩", "//", "01", "{}", "[]", "<>", "&&", "||", "=>"];

export const AsciiHandsArt = () => {
  const sparkLines = useMemo(() => {
    const lines: string[] = [];
    for (let i = 0; i < 15; i++) {
      let line = "";
      for (let j = 0; j < 12; j++) {
        if (Math.random() > 0.6) {
          line += SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)];
        } else {
          line += "  ";
        }
        line += " ";
      }
      lines.push(line);
    }
    return lines;
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center z-[5]">
      <div className="relative flex items-center gap-0 select-none" style={{ transform: "translateY(-40px)" }}>
        {/* Left Hand */}
        <pre
          className="font-mono text-[8px] sm:text-[10px] md:text-[12px] leading-tight text-foreground/[0.12] animate-hand-left whitespace-pre"
        >
          {LEFT_HAND.join("\n")}
        </pre>

        {/* Spark Gap */}
        <div className="relative w-16 sm:w-20 md:w-28 flex items-center justify-center overflow-hidden">
          <pre className="font-mono text-[8px] sm:text-[10px] md:text-[11px] leading-tight text-foreground/[0.08] animate-spark-flicker whitespace-pre text-center">
            {sparkLines.join("\n")}
          </pre>
          {/* Central glow */}
          <div className="absolute inset-0 bg-foreground/[0.03] blur-2xl rounded-full animate-pulse-slow" />
        </div>

        {/* Right Hand */}
        <pre
          className="font-mono text-[8px] sm:text-[10px] md:text-[12px] leading-tight text-foreground/[0.12] animate-hand-right whitespace-pre"
        >
          {RIGHT_HAND.join("\n")}
        </pre>
      </div>

      {/* Fade edges */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <style>{`
        @keyframes hand-left {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(6px); }
        }
        @keyframes hand-right {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(-6px); }
        }
        @keyframes spark-flicker {
          0%, 100% { opacity: 0.08; }
          25% { opacity: 0.15; }
          50% { opacity: 0.05; }
          75% { opacity: 0.12; }
        }
        .animate-hand-left { animation: hand-left 6s ease-in-out infinite; }
        .animate-hand-right { animation: hand-right 6s ease-in-out infinite; }
        .animate-spark-flicker { animation: spark-flicker 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
};
