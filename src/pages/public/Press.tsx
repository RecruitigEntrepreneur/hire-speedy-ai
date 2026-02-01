import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { Download, Mail, ExternalLink, Calendar } from "lucide-react";

const pressReleases = [
  {
    title: "Matchunt schließt Series A Finanzierung ab",
    date: "10. Nov 2024",
    excerpt: "Das Berliner HR-Tech Startup sichert sich 15 Millionen Euro für weiteres Wachstum.",
  },
  {
    title: "Launch des neuen AI Matching Systems",
    date: "15. Okt 2024",
    excerpt: "Matchunt revolutioniert Kandidaten-Matching mit fortschrittlicher künstlicher Intelligenz.",
  },
  {
    title: "Expansion in den DACH-Markt",
    date: "1. Sep 2024",
    excerpt: "Matchunt erweitert Services nach Österreich und in die Schweiz.",
  },
];

const mediaAssets = [
  { name: "Logo Package", format: "ZIP", size: "2.4 MB" },
  { name: "Pressemappe", format: "PDF", size: "5.1 MB" },
  { name: "Produktscreenshots", format: "ZIP", size: "12 MB" },
  { name: "Gründerfotos", format: "ZIP", size: "8.3 MB" },
];

export default function Press() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Presse</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              News & Media
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Aktuelle Pressemitteilungen, Ressourcen und Kontakte für Journalisten.
            </p>
          </div>
        </div>
      </section>

      {/* Press Releases */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Pressemitteilungen</h2>
            <div className="space-y-6">
              {pressReleases.map((release, index) => (
                <div key={index} className="bg-card rounded-2xl p-6 border border-border/50 hover:shadow-lg transition-all group cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="w-4 h-4" />
                    {release.date}
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-emerald transition-colors">
                    {release.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">{release.excerpt}</p>
                  <Button variant="ghost" size="sm" className="group/btn p-0 h-auto">
                    Weiterlesen
                    <ExternalLink className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Media Assets */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Media Kit</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {mediaAssets.map((asset, index) => (
                <div key={index} className="bg-card rounded-xl p-4 border border-border/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{asset.name}</h3>
                    <p className="text-sm text-muted-foreground">{asset.format} • {asset.size}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Press Contact */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center bg-card rounded-2xl p-8 border border-border/50">
            <Mail className="w-12 h-12 text-emerald mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Pressekontakt</h2>
            <p className="text-muted-foreground mb-4">
              Für Presseanfragen kontaktieren Sie bitte unser Kommunikationsteam.
            </p>
            <p className="font-medium text-emerald mb-6">press@matchunt.ai</p>
            <Button className="bg-emerald hover:bg-emerald-light text-white">
              Presseanfrage senden
            </Button>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
