import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, Book, Code, Puzzle, Shield, Zap, FileCode } from "lucide-react";

const docCategories = [
  {
    title: "Getting Started",
    description: "Schnelleinstieg und erste Schritte mit der Plattform.",
    icon: Zap,
    articles: ["Registrierung", "Erstes Projekt", "Dashboard Overview"],
  },
  {
    title: "API Reference",
    description: "Vollständige API-Dokumentation für Entwickler.",
    icon: Code,
    articles: ["Authentication", "Endpoints", "Webhooks"],
  },
  {
    title: "Integrations",
    description: "Verbinden Sie Matchunt mit Ihren bestehenden Tools.",
    icon: Puzzle,
    articles: ["ATS Integration", "Calendar Sync", "HRIS Systeme"],
  },
  {
    title: "Security",
    description: "Sicherheit, Compliance und Datenschutz.",
    icon: Shield,
    articles: ["DSGVO", "SSO & SAML", "Audit Logs"],
  },
];

export default function Docs() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Documentation</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Technische Dokumentation
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Alles, was Sie für die Integration und Nutzung von Matchunt brauchen.
            </p>
          </div>
        </div>
      </section>

      {/* Documentation Categories */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {docCategories.map((category, index) => (
              <div key={index} className="bg-card rounded-2xl p-8 border border-border/50 hover:shadow-lg transition-all">
                <div className="w-14 h-14 rounded-xl bg-emerald/10 flex items-center justify-center mb-6">
                  <category.icon className="w-7 h-7 text-emerald" />
                </div>
                <h3 className="text-xl font-bold mb-2">{category.title}</h3>
                <p className="text-muted-foreground mb-4">{category.description}</p>
                <ul className="space-y-2 mb-6">
                  {category.articles.map((article, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileCode className="w-4 h-4 text-emerald" />
                      {article}
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="group p-0 h-auto">
                  Alle Artikel anzeigen
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            ))}
          </div>

          <div className="text-center mt-16 p-8 bg-muted/30 rounded-2xl max-w-2xl mx-auto">
            <Book className="w-12 h-12 text-emerald mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Dokumentation in Arbeit</h3>
            <p className="text-muted-foreground mb-4">
              Wir arbeiten an einer umfassenden Dokumentation. 
              Kontaktieren Sie uns bei Fragen.
            </p>
            <Button variant="outline">
              Support kontaktieren
            </Button>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
