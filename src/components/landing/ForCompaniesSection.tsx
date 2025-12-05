import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, BadgeDollarSign, Eye, BarChart3 } from "lucide-react";

const benefits = [
  {
    icon: Clock,
    title: "Bewerber in Tagen, nicht Wochen",
    description: "Durchschnittlich 3,8 Tage bis zum ersten Interview – statt wochenlanger Wartezeit.",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-100",
  },
  {
    icon: BadgeDollarSign,
    title: "Erfolgsbasiertes Modell",
    description: "Sie zahlen nur, wenn Sie tatsächlich einstellen. Keine Fixkosten, keine Retainer.",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100",
  },
  {
    icon: Eye,
    title: "Transparenz & volle Kontrolle",
    description: "Sehen Sie jeden Schritt im Prozess. Jederzeit. In Echtzeit.",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-100",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics & Funnel Insights",
    description: "Verstehen Sie, wo Kandidaten abspringen und optimieren Sie Ihre Hiring-Pipeline.",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-100",
  },
];

export const ForCompaniesSection = () => {
  return (
    <section id="for-companies" className="py-24 bg-slate-50 relative overflow-hidden">
      {/* Subtle Background Decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute top-20 right-20 w-[400px] h-[400px] rounded-full opacity-[0.03] blur-[100px]"
          style={{ background: 'radial-gradient(circle, hsl(var(--emerald)) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-20 left-20 w-[300px] h-[300px] rounded-full opacity-[0.03] blur-[80px]"
          style={{ background: 'radial-gradient(circle, hsl(200 100% 50%) 0%, transparent 70%)' }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Für Unternehmen</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-slate-900">
            Hire with Precision
          </h2>
          <p className="text-xl text-slate-600">
            Die schnellste und effektivste Art, Top-Talente zu finden und einzustellen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16">
          {benefits.map((benefit, index) => (
            <div 
              key={index}
              className={`p-8 rounded-2xl bg-white border ${benefit.borderColor} shadow-sm hover:shadow-lg transition-all duration-300 group`}
            >
              <div className={`w-14 h-14 rounded-xl ${benefit.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <benefit.icon className="w-7 h-7 text-emerald" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">{benefit.title}</h3>
              <p className="text-slate-600 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-emerald hover:bg-emerald-light text-white px-8 py-6 text-lg shadow-lg shadow-emerald/20 hover:shadow-emerald/30">
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