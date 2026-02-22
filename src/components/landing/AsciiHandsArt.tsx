import { useMemo } from "react";

const LEFT_HAND = [
  "              ╭───╮      ",
  "             │ => │      ",
  "        ╭───╮│   │      ",
  "       │ fn ││   │      ",
  "  ╭───╮│   ││   │      ",
  " │ {  ││   ││   │      ",
  " │ (  ││   ││   │      ",
  " │    ││   │╰───╯      ",
  " │    │╰───╯           ",
  " │    ╰─────────╮      ",
  " │  match()     │      ",
  " ╰──────────────╯      ",
];

const RIGHT_HAND = [
  "      ╭───╮              ",
  "      │ <= │             ",
  "      │   │╭───╮        ",
  "      │   ││ () │       ",
  "      │   ││   │╭───╮  ",
  "      │   ││   ││  } │ ",
  "      │   ││   ││  ) │ ",
  "      ╰───╯│   ││    │ ",
  "           ╰───╯│    │ ",
  "      ╭─────────╯    │ ",
  "      │     hire()    │ ",
  "      ╰──────────────╯ ",
];

const SPARK_CHARS = ["⚡", "✦", "◈", "∞", "⟨⟩", "//", "01", "{}", "[]", "<>", "=>", "::"];

export const AsciiHandsArt = () => {
  const sparkLines = useMemo(() => {
    const lines: string[] = [];
    for (let i = 0; i < 12; i++) {
      let line = "";
      for (let j = 0; j < 6; j++) {
        if (Math.random() > 0.5) {
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
    <div className="absolute inset-x-0 top-8 md:top-16 overflow-hidden pointer-events-none flex justify-center z-[5]">
      <div className="relative flex items-center gap-0 select-none animate-ascii-pulse">
        {/* Left Hand */}
        <pre className="font-mono text-[11px] sm:text-sm md:text-base lg:text-lg leading-tight text-foreground/[0.07] animate-hand-left whitespace-pre">
          {LEFT_HAND.join("\n")}
        </pre>

        {/* Spark Gap */}
        <div className="relative w-24 sm:w-32 md:w-48 flex items-center justify-center overflow-hidden">
          <pre className="font-mono text-[10px] sm:text-xs md:text-sm leading-tight text-foreground/[0.06] animate-spark-flicker whitespace-pre text-center">
            {sparkLines.join("\n")}
          </pre>
          <div className="absolute inset-0 bg-foreground/[0.02] blur-3xl rounded-full animate-spark-flash" />
        </div>

        {/* Right Hand */}
        <pre className="font-mono text-[11px] sm:text-sm md:text-base lg:text-lg leading-tight text-foreground/[0.07] animate-hand-right whitespace-pre">
          {RIGHT_HAND.join("\n")}
        </pre>
      </div>

      {/* Fade edges */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      <style>{`
        @keyframes hand-left {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(8px); }
        }
        @keyframes hand-right {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(-8px); }
        }
        @keyframes spark-flicker {
          0%, 100% { opacity: 0.06; }
          25% { opacity: 0.14; }
          50% { opacity: 0.04; }
          75% { opacity: 0.1; }
        }
        @keyframes spark-flash {
          0%, 90%, 100% { opacity: 0.02; }
          95% { opacity: 0.15; }
        }
        @keyframes ascii-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-hand-left { animation: hand-left 5s ease-in-out infinite; }
        .animate-hand-right { animation: hand-right 5s ease-in-out infinite; }
        .animate-spark-flicker { animation: spark-flicker 2.5s ease-in-out infinite; }
        .animate-spark-flash { animation: spark-flash 6s ease-in-out infinite; }
        .animate-ascii-pulse { animation: ascii-pulse 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};
