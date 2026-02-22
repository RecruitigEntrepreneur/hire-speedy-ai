import { useState } from "react";
import { useParallax } from "@/hooks/useParallax";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { SIDEBAR_ITEMS, Tab } from "./dashboard-preview/data";
import { DashboardView } from "./dashboard-preview/DashboardView";
import { JobsView } from "./dashboard-preview/JobsView";
import { KandidatenView } from "./dashboard-preview/KandidatenView";
import { AnalyticsView } from "./dashboard-preview/AnalyticsView";
import { MessagesView } from "./dashboard-preview/MessagesView";
import { NotificationBell } from "./dashboard-preview/NotificationBell";
import { SearchBar } from "./dashboard-preview/SearchBar";

export const DashboardPreview = () => {
  const { ref: parallaxRef, offset } = useParallax(0.3);
  const { ref: revealRef, isVisible } = useScrollReveal();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div ref={parallaxRef} className="mt-20 md:mt-24 max-w-5xl mx-auto px-4">
      <div
        ref={revealRef}
        className="relative transition-transform duration-300"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden transition-transform duration-700 pointer-events-auto"
          style={{
            transform: `rotateX(${Math.max(0, 4 + offset * 2)}deg)`,
            transformOrigin: "center bottom",
          }}
        >
          {/* Browser Chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-foreground/10" />
              <div className="w-3 h-3 rounded-full bg-foreground/10" />
              <div className="w-3 h-3 rounded-full bg-foreground/10" />
            </div>
            <SearchBar />
            <NotificationBell />
          </div>

          {/* Dashboard Content */}
          <div className="flex">
            {/* Sidebar */}
            <div className="w-48 border-r border-border/30 bg-muted/20 p-4 hidden md:block">
              <div className="space-y-1">
                {SIDEBAR_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => item.tab && setActiveTab(item.tab)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                      item.tab === activeTab
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    } ${item.tab ? "cursor-pointer" : "opacity-50 cursor-default"}`}
                    title={!item.tab ? "Coming soon" : undefined}
                  >
                    {item.label}
                    {item.badge && (
                      <span className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center text-[8px] font-bold text-destructive-foreground">
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-5 min-h-[280px]">
              {activeTab === "dashboard" && <DashboardView isVisible={isVisible} />}
              {activeTab === "jobs" && <JobsView />}
              {activeTab === "kandidaten" && <KandidatenView />}
              {activeTab === "analytics" && <AnalyticsView isVisible={isVisible} />}
              {activeTab === "messages" && <MessagesView />}
            </div>
          </div>
        </div>

        {/* Glow underneath */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-foreground/[0.03] blur-2xl rounded-full" />
      </div>
    </div>
  );
};
