import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Search, MessageCircle, Mail, Phone, HelpCircle, FileText, Users, CreditCard } from "lucide-react";

const helpCategories = [
  {
    title: "Erste Schritte",
    description: "Grundlagen und Onboarding",
    icon: HelpCircle,
    articles: 8,
  },
  {
    title: "Account & Einstellungen",
    description: "Profil, Sicherheit, Benachrichtigungen",
    icon: Users,
    articles: 12,
  },
  {
    title: "Abrechnung & Zahlung",
    description: "Rechnungen, Escrow, Payouts",
    icon: CreditCard,
    articles: 6,
  },
  {
    title: "Anleitungen",
    description: "Step-by-Step Tutorials",
    icon: FileText,
    articles: 15,
  },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Help Center</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Wie können wir helfen?
            </h1>
            <div className="max-w-xl mx-auto relative mt-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Suchen Sie nach Antworten..." 
                className="pl-12 h-14 text-lg bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Hilfekategorien</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {helpCategories.map((category, index) => (
                <div key={index} className="bg-card rounded-2xl p-6 border border-border/50 hover:shadow-lg hover:border-emerald/30 transition-all cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald/20 transition-colors">
                      <category.icon className="w-6 h-6 text-emerald" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 group-hover:text-emerald transition-colors">{category.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{category.description}</p>
                      <span className="text-xs text-emerald">{category.articles} Artikel</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-8">Brauchen Sie weitere Hilfe?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-card rounded-2xl p-6 border border-border/50">
                <MessageCircle className="w-10 h-10 text-emerald mx-auto mb-4" />
                <h3 className="font-bold mb-2">Live Chat</h3>
                <p className="text-sm text-muted-foreground mb-4">Chatten Sie mit unserem Support-Team.</p>
                <Button variant="outline" size="sm">Chat starten</Button>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border/50">
                <Mail className="w-10 h-10 text-emerald mx-auto mb-4" />
                <h3 className="font-bold mb-2">E-Mail</h3>
                <p className="text-sm text-muted-foreground mb-4">support@talentbridge.de</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/contact">E-Mail senden</Link>
                </Button>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border/50">
                <Phone className="w-10 h-10 text-emerald mx-auto mb-4" />
                <h3 className="font-bold mb-2">Telefon</h3>
                <p className="text-sm text-muted-foreground mb-4">Mo-Fr, 9:00 - 18:00 Uhr</p>
                <Button variant="outline" size="sm">Anrufen</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
