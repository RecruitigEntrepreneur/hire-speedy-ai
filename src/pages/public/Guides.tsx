import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, FileText, Video, Download } from "lucide-react";

const guides = [
  {
    title: "Erste Schritte mit TalentBridge",
    description: "Lernen Sie die Grundlagen und starten Sie in wenigen Minuten.",
    icon: BookOpen,
    type: "Guide",
  },
  {
    title: "Die perfekte Stellenausschreibung",
    description: "So erstellen Sie Jobbeschreibungen, die Top-Talente anziehen.",
    icon: FileText,
    type: "Whitepaper",
  },
  {
    title: "AI Matching verstehen",
    description: "Wie unsere KI die besten Kandidaten für Sie findet.",
    icon: Video,
    type: "Video",
  },
  {
    title: "Recruiter Onboarding Guide",
    description: "Alles, was Recruiter für einen erfolgreichen Start wissen müssen.",
    icon: Download,
    type: "PDF",
  },
];

export default function Guides() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Guides</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Anleitungen & Ressourcen
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Step-by-Step Guides für Ihren Erfolg mit TalentBridge.
            </p>
          </div>
        </div>
      </section>

      {/* Guides Grid */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {guides.map((guide, index) => (
              <div key={index} className="bg-card rounded-2xl p-8 border border-border/50 hover:shadow-lg transition-all hover:border-emerald/30 group">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-emerald/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald/20 transition-colors">
                    <guide.icon className="w-7 h-7 text-emerald" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald mb-2 block">
                      {guide.type}
                    </span>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-emerald transition-colors">
                      {guide.title}
                    </h3>
                    <p className="text-muted-foreground mb-4">{guide.description}</p>
                    <Button variant="ghost" size="sm" className="group/btn p-0 h-auto">
                      Mehr erfahren
                      <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <p className="text-muted-foreground mb-4">
              Weitere Guides und Ressourcen folgen in Kürze...
            </p>
            <Button variant="outline">
              Benachrichtigung erhalten
            </Button>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
