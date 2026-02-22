import { useState } from "react";
import { MESSAGES } from "./data";

export const MessagesView = () => {
  const [expandedMsg, setExpandedMsg] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-foreground">Nachrichten</span>
        <span className="text-[10px] text-muted-foreground">{MESSAGES.filter(m => m.unread).length} ungelesen</span>
      </div>
      <div className="space-y-2">
        {MESSAGES.map((msg, i) => (
          <div key={i}>
            <div
              onClick={() => setExpandedMsg(expandedMsg === i ? null : i)}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60 shrink-0">
                {msg.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground">{msg.name}</p>
                  {msg.unread && <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{msg.text}</p>
              </div>
              <span className="text-[9px] text-muted-foreground shrink-0">{msg.time}</span>
            </div>

            {/* Expanded chat bubble */}
            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{ maxHeight: expandedMsg === i ? "80px" : "0px", opacity: expandedMsg === i ? 1 : 0 }}
            >
              <div className="mt-1 ml-11 p-2 rounded-lg bg-foreground/[0.04] border border-border/20">
                <p className="text-[10px] text-foreground/80">{msg.text}</p>
                <div className="flex gap-2 mt-1.5">
                  <button className="text-[9px] px-2 py-0.5 rounded bg-foreground/10 text-foreground/70 hover:bg-foreground/20 transition-colors">
                    Antworten
                  </button>
                  <button className="text-[9px] px-2 py-0.5 rounded bg-foreground/5 text-foreground/50 hover:bg-foreground/10 transition-colors">
                    Später
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
