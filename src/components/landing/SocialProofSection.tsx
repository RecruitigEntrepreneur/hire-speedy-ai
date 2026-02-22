import { Button } from "@/components/ui/button";
import { ArrowRight, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useCountUp } from "@/hooks/useCountUp";

const logos = [
  "TechCorp", "InnovateCo", "ScaleUp", "GrowthLabs", "FutureWorks",
  "NextGen", "Velocity", "Quantum", "Apex", "Horizon"
];

const MetricCard = ({ value, suffix, label, decimals = 0 }: { value: number; suffix: string; label: string; decimals?: number }) => {
  const { ref, isVisible } = useScrollReveal();
  const count = useCountUp({ end: value, decimals, enabled: isVisible });

  return (
    <div
      ref={ref}
      className={`text-center p-8 rounded-2xl bg-card border border-border/50 hover:border-foreground/20 hover:shadow-lg transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="text-5xl md:text-6xl font-bold text-foreground mb-2">
        {decimals > 0 ? count.toFixed(decimals) : count.toLocaleString("de-DE")}
        <span className="text-foreground/60">{suffix}</span>
      </div>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
};

const MARQUEE_TEXT = "Schneller · Präziser · Fairer · Ergebnisorientiert · ";

export const SocialProofSection = () => {
  const { ref: quoteRef, isVisible: quoteVisible } = useScrollReveal();

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
              className="flex-shrink-0 mx-8 md:mx-12 text-2xl font-bold text-muted-foreground/20 hover:text-muted-foreground/40 transition-colors"
            >
              {logo}
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Metrics */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <MetricCard value={3.8} suffix=" Tage" label="bis zum ersten Interview" decimals={1} />
          <MetricCard value={42} suffix="%" label="höhere Offer Acceptance Rate" />
          <MetricCard value={12000} suffix="+" label="verifizierte Recruiter" />
        </div>

        {/* Marquee Band */}
        <div className="overflow-hidden mb-16 -mx-4">
          <div className="flex animate-scroll-x whitespace-nowrap">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="text-4xl md:text-6xl font-bold text-foreground/[0.04] mx-0 select-none">
                {MARQUEE_TEXT}
              </span>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div
          ref={quoteRef}
          className={`max-w-3xl mx-auto text-center transition-all duration-700 ${
            quoteVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Quote className="w-12 h-12 text-foreground/10 mx-auto mb-6" />
          <blockquote className="text-2xl md:text-3xl font-medium text-foreground mb-6 leading-relaxed">
            „Das schnellste, präziseste und verlässlichste Recruiting-Erlebnis, das wir je hatten."
          </blockquote>
          <cite className="text-muted-foreground not-italic">
            – HR Director, Enterprise Kunde
          </cite>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Button asChild variant="outline" size="lg" className="group border-foreground/20 hover:bg-foreground/5">
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
