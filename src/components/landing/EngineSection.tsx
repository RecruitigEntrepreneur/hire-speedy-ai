import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Users, Shield, Workflow, BarChart3 } from "lucide-react";

const layers = [
  {
    icon: Brain,
    title: "AI Matching Layer",
    description: "Versteht Rollen. Versteht Menschen. Versteht Passung.",
    color: "from-blue-500 to-cyan-500",
    glowColor: "shadow-blue-500/20",
  },
  {
    icon: Users,
    title: "Recruiter Performance Marketplace",
    description: "Top-Recruiter, algorithmisch ausgewählt, leistungsbasiert gerankt.",
    color: "from-purple-500 to-pink-500",
    glowColor: "shadow-purple-500/20",
  },
  {
    icon: Shield,
    title: "Triple-Blind Identity Protection",
    description: "Keine Vorurteile. Keine Umgehung. Keine Compliance-Risiken.",
    color: "from-emerald to-teal-500",
    glowColor: "shadow-emerald/20",
  },
  {
    icon: Workflow,
    title: "Workflow Automation Engine",
    description: "WhatsApp, SMS, E-Mail, Interviews, Offers, Escrow. Alles ohne manuell einen Finger zu rühren.",
    color: "from-orange-500 to-amber-500",
    glowColor: "shadow-orange-500/20",
  },
  {
    icon: BarChart3,
    title: "Intelligence Layer",
    description: "Employer Score. Candidate Readiness. Conversion Analytics. Jeder Schritt ist messbar.",
    color: "from-indigo-500 to-violet-500",
    glowColor: "shadow-indigo-500/20",
  },
];

export const EngineSection = () => {
  return (
    <section id="engine" className="py-24 bg-background relative overflow-hidden">
      {/* Animated Background Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {/* Outer Ring */}
        <div className="w-[800px] h-[800px] rounded-full border border-border/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slow" />
        {/* Middle Ring with dots */}
        <div className="w-[600px] h-[600px] rounded-full border border-border/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-reverse">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-emerald/50 rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-blue-500/50 rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500/50 rounded-full" />
          <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500/50 rounded-full" />
        </div>
        {/* Inner Ring */}
        <div className="w-[400px] h-[400px] rounded-full border border-border/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slow" style={{ animationDuration: '40s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500/50 rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-pink-500/50 rounded-full" />
        </div>
        {/* Core Ring */}
        <div className="w-[200px] h-[200px] rounded-full border-2 border-emerald/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse" />
        {/* Pulsing Core */}
        <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-emerald/20 to-blue-500/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse blur-xl" />
        <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-emerald to-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 animate-pulse" />
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background pointer-events-none" />
      <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-background to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            The Recruiting{" "}
            <span className="bg-gradient-to-r from-emerald via-cyan-500 to-blue-500 bg-clip-text text-transparent">
              Operating System
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Eine Plattform. Ein Netzwerk. Ein automatisierter Hiring-Stack.
            <br />
            Alles orchestriert durch KI, abgesichert durch Prozesse – gebaut für Ergebnisorientierung.
          </p>
        </div>

        {/* 5-Layer System */}
        <div className="max-w-5xl mx-auto">
          <div className="grid gap-6">
            {layers.map((layer, index) => (
              <div 
                key={index}
                className={`group relative p-6 md:p-8 rounded-2xl bg-card border border-border/50 hover:border-border hover:shadow-2xl ${layer.glowColor} transition-all duration-500`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Hover Glow Effect */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${layer.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative">
                  {/* Layer Number */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground group-hover:bg-gradient-to-br group-hover:from-emerald/20 group-hover:to-blue-500/20 transition-all">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${layer.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <layer.icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-grow">
                    <h3 className="text-xl md:text-2xl font-bold mb-2 group-hover:text-emerald transition-colors">
                      {layer.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {layer.description}
                    </p>
                  </div>

                  {/* Hover Arrow */}
                  <ArrowRight className="w-6 h-6 text-muted-foreground/30 group-hover:text-emerald group-hover:translate-x-2 transition-all hidden md:block" />
                </div>

                {/* Connecting Line */}
                {index < layers.length - 1 && (
                  <div className="absolute left-[2.25rem] top-full w-0.5 h-6 bg-gradient-to-b from-border via-emerald/30 to-transparent hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Button asChild size="lg" variant="outline" className="group hover:border-emerald/50 hover:bg-emerald/5">
            <a href="#features">
              Technologie entdecken
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
