import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, BadgeDollarSign, Eye, BarChart3 } from "lucide-react";

const benefits = [
  {
    icon: Clock,
    title: "Bewerber in Tagen, nicht Wochen",
    description: "Durchschnittlich 3,8 Tage bis zum ersten Interview – statt wochenlanger Wartezeit.",
  },
  {
    icon: BadgeDollarSign,
    title: "Erfolgsbasiertes Modell",
    description: "Sie zahlen nur, wenn Sie tatsächlich einstellen. Keine Fixkosten, keine Retainer.",
  },
  {
    icon: Eye,
    title: "Transparenz & volle Kontrolle",
    description: "Sehen Sie jeden Schritt im Prozess. Jederzeit. In Echtzeit.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics & Funnel Insights",
    description: "Verstehen Sie, wo Kandidaten abspringen und optimieren Sie Ihre Hiring-Pipeline.",
  },
];

export const ForCompaniesSection = () => {
  return (
    <section id="for-companies" className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
        <div className="absolute top-20 right-20 w-64 h-64 bg-emerald rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-40 w-48 h-48 bg-blue-500 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Für Unternehmen</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Hire with Precision
          </h2>
          <p className="text-xl text-primary-foreground/80">
            Die schnellste und effektivste Art, Top-Talente zu finden und einzustellen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {benefits.map((benefit, index) => (
            <div 
              key={index}
              className="p-8 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm hover:bg-primary-foreground/10 transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-xl bg-emerald/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <benefit.icon className="w-7 h-7 text-emerald" />
              </div>
              <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
              <p className="text-primary-foreground/70 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg shadow-lg shadow-emerald/30">
            <Link to="/auth?tab=register&role=client">
              Job starten
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
