import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Quote } from "lucide-react";

const logos = [
  "TechCorp", "InnovateCo", "ScaleUp", "GrowthLabs", "FutureWorks", 
  "NextGen", "Velocity", "Quantum", "Apex", "Horizon"
];

const metrics = [
  { value: "3.8", suffix: " Tage", label: "bis zum ersten Interview" },
  { value: "+42", suffix: "%", label: "höhere Offer Acceptance Rate" },
  { value: "12.000", suffix: "+", label: "verifizierte Recruiter" },
];

export const SocialProofSection = () => {
  return (
    <section id="why-us" className="py-24 bg-background relative overflow-hidden">
      {/* Logo Carousel */}
      <div className="mb-16 overflow-hidden">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-wider mb-8">
          Vertraut von führenden Unternehmen
        </p>
        <div className="flex animate-scroll-x">
          {[...logos, ...logos].map((logo, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 mx-8 md:mx-12 text-2xl font-bold text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
            >
              {logo}
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Metric Trio */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {metrics.map((metric, index) => (
            <div 
              key={index}
              className="text-center p-8 rounded-2xl bg-card border border-border/50 hover:border-emerald/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="text-5xl md:text-6xl font-bold text-foreground mb-2">
                {metric.value}
                <span className="text-emerald">{metric.suffix}</span>
              </div>
              <p className="text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="max-w-3xl mx-auto text-center">
          <Quote className="w-12 h-12 text-emerald/30 mx-auto mb-6" />
          <blockquote className="text-2xl md:text-3xl font-medium text-foreground mb-6 leading-relaxed">
            „Das schnellste, präziseste und verlässlichste Recruiting-Erlebnis, das wir je hatten."
          </blockquote>
          <cite className="text-muted-foreground not-italic">
            – HR Director, Enterprise Kunde
          </cite>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Button asChild variant="outline" size="lg" className="group">
            <Link to="/auth">
              Ergebnisse ansehen
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
