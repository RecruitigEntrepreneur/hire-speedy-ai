import { useState, useEffect, useRef } from "react";

const SEARCH_TEXT = "Senior Frontend...";
const SEARCH_RESULTS = [
  "Senior Frontend Engineer — TechVentures GmbH (14 Kandidaten)",
  "Senior Frontend Dev — ScaleUp AG (6 Kandidaten)",
];

export const SearchBar = () => {
  const [active, setActive] = useState(false);
  const [typed, setTyped] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) { setTyped(""); setShowResults(false); return; }

    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setTyped(SEARCH_TEXT.slice(0, idx));
      if (idx >= SEARCH_TEXT.length) {
        clearInterval(interval);
        setTimeout(() => setShowResults(true), 300);
        setTimeout(() => { setActive(false); }, 3500);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setActive(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="flex-1 mx-4 relative">
      <div
        onClick={() => !active && setActive(true)}
        className="h-6 rounded-md bg-muted/80 max-w-sm mx-auto flex items-center justify-center cursor-text px-3"
      >
        {active ? (
          <span className="text-[10px] text-foreground font-mono">
            {typed}
            <span className="animate-pulse">|</span>
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground font-mono">app.matchunt.com/dashboard</span>
        )}
      </div>

      {/* Search results dropdown */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 w-full max-w-sm transition-all duration-300"
        style={{
          opacity: showResults && active ? 1 : 0,
          transform: showResults && active ? "translateY(0)" : "translateY(-4px)",
          pointerEvents: showResults && active ? "auto" : "none",
        }}
      >
        <div className="bg-card border border-border/50 rounded-lg shadow-xl p-1">
          {SEARCH_RESULTS.map((r, i) => (
            <div key={i} className="px-3 py-1.5 rounded hover:bg-foreground/5 transition-colors cursor-default">
              <p className="text-[10px] text-foreground/80">{r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
