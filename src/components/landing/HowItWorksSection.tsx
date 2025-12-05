import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Users, CalendarCheck, FileText, Brain, CheckCircle2 } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Upload",
    subtitle: "Sie geben uns Ihren Job",
    description: "Link, PDF oder Text – unsere KI extrahiert Must-Haves, Skills, Gehaltsdaten und seniority-basierte Anforderungen automatisch.",
    icon: Upload,
    details: ["URL-Parsing", "PDF-Extraktion", "Freitext-Analyse", "Skill-Mapping"],
  },
  {
    number: "02",
    title: "Curated Submissions",
    subtitle: "Geprüfte Recruiter liefern",
    description: "Triple-Blind. Fair. Performance-basiert. Nur die besten Recruiter mit den passendsten Kandidaten erreichen Sie.",
    icon: Users,
    details: ["AI-Matching", "Anonymisierung", "Quality Score", "Behavior Tracking"],
  },
  {
    number: "03",
    title: "Interview & Hire",
    subtitle: "Automatisiert bis zum Offer",
    description: "Das System plant automatisch Interviews, sendet Reminder, sammelt Feedback und führt Sie bis zum unterschriebenen Offer.",
    icon: CalendarCheck,
    details: ["Auto-Scheduling", "Multi-Channel", "Escrow Payment", "Digital Signing"],
  },
];

export const HowItWorksSection = () => {
  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-50">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald/5 to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-emerald font-semibold uppercase tracking-wider mb-4">How It Works</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            The 60-Second Journey
          </h2>
          <p className="text-xl text-muted-foreground">
            Von der Jobbeschreibung zum unterschriebenen Vertrag – vollautomatisiert.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-4 relative">
            {/* Connecting Line */}
            <div className="hidden lg:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-emerald/50 via-emerald to-emerald/50" />

            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Step Card */}
                <div className="bg-card rounded-2xl p-8 border border-border/50 hover:border-emerald/30 hover:shadow-xl transition-all duration-300 h-full">
                  {/* Step Number Badge */}
                  <div className="relative mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald to-emerald-light flex items-center justify-center shadow-lg shadow-emerald/30 mx-auto lg:mx-0">
                      <step.icon className="w-8 h-8 text-white" />
                    </div>
                    <span className="absolute -top-2 -right-2 lg:left-12 lg:right-auto w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                      {step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                  <p className="text-emerald font-medium mb-4">{step.subtitle}</p>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Details */}
                  <div className="space-y-2">
                    {step.details.map((detail, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow (mobile) */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center py-4 lg:hidden">
                    <ArrowRight className="w-6 h-6 text-emerald rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Micro Proof */}
        <div className="text-center mt-16">
          <p className="text-2xl font-semibold text-muted-foreground mb-8">
            „Bereit in Minuten. <span className="text-emerald">Ergebnisse in Tagen.</span>"
          </p>
          <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg shadow-lg shadow-emerald/30">
            <Link to="/auth?tab=register&role=client">
              Job jetzt starten
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
