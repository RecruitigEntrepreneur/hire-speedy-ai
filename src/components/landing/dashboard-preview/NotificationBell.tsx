import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { NOTIFICATIONS } from "./data";

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1 rounded hover:bg-foreground/10 transition-colors"
      >
        <Bell className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-destructive flex items-center justify-center text-[7px] font-bold text-destructive-foreground animate-pulse">
          3
        </span>
      </button>

      <div
        className="absolute right-0 top-full mt-2 z-20 transition-all duration-200 origin-top-right"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.95)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="bg-card border border-border/50 rounded-lg shadow-xl p-2 w-56">
          <span className="text-[10px] font-semibold text-foreground px-2 block mb-1">Benachrichtigungen</span>
          {NOTIFICATIONS.map((n, i) => (
            <div key={i} className="px-2 py-1.5 rounded hover:bg-foreground/5 transition-colors cursor-default">
              <p className="text-[10px] text-foreground/80">{n.text}</p>
              <p className="text-[8px] text-muted-foreground">{n.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
