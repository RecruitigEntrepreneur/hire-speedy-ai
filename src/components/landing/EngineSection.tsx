import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Users, Shield, Workflow, BarChart3 } from "lucide-react";

const layers = [
  {
    icon: Brain,
    title: "AI Matching Layer",
    description: "Versteht Rollen. Versteht Menschen. Versteht Passung.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Users,
    title: "Recruiter Performance Marketplace",
    description: "Top-Recruiter, algorithmisch ausgewählt, leistungsbasiert gerankt.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Shield,
    title: "Triple-Blind Identity Protection",
    description: "Keine Vorurteile. Keine Umgehung. Keine Compliance-Risiken.",
    color: "from-emerald to-teal-500",
  },
  {
    icon: Workflow,
    title: "Workflow Automation Engine",
    description: "WhatsApp, SMS, E-Mail, Interviews, Offers, Escrow. Alles ohne manuell einen Finger zu rühren.",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: BarChart3,
    title: "Intelligence Layer",
    description: "Employer Score. Candidate Readiness. Conversion Analytics. Jeder Schritt ist messbar.",
    color: "from-indigo-500 to-violet-500",
  },
];

export const EngineSection = () => {
  return (
    <section id="engine" className="py-24 bg-background relative overflow-hidden">
      {/* Background Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-[300px] h-[300px] rounded-full border border-border/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="w-[500px] h-[500px] rounded-full border border-border/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="w-[700px] h-[700px] rounded-full border border-border/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            The Recruiting{" "}
            <span className="bg-gradient-to-r from-emerald to-blue-500 bg-clip-text text-transparent">
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
                className="group relative p-6 md:p-8 rounded-2xl bg-card border border-border/50 hover:border-border hover:shadow-xl transition-all duration-500"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  {/* Layer Number */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${layer.color} flex items-center justify-center shadow-lg`}>
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
                  <div className="absolute left-[2.25rem] top-full w-0.5 h-6 bg-gradient-to-b from-border to-transparent hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Button asChild size="lg" variant="outline" className="group">
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
