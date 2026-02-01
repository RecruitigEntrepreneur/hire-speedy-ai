import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Nachricht gesendet",
      description: "Wir werden uns so schnell wie möglich bei Ihnen melden.",
    });
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-navy-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-emerald font-semibold uppercase tracking-wider mb-4">Kontakt</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Sprechen Sie mit uns
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Haben Sie Fragen? Wir sind hier, um zu helfen.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16">
            {/* Contact Form */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Senden Sie uns eine Nachricht</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input id="firstName" placeholder="Max" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input id="lastName" placeholder="Mustermann" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input id="email" type="email" placeholder="max@beispiel.de" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Unternehmen (optional)</Label>
                  <Input id="company" placeholder="Ihr Unternehmen" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Nachricht</Label>
                  <Textarea id="message" placeholder="Ihre Nachricht..." rows={5} required />
                </div>
                <Button type="submit" size="lg" className="w-full bg-emerald hover:bg-emerald-light text-white" disabled={isSubmitting}>
                  {isSubmitting ? "Wird gesendet..." : (
                    <>
                      Nachricht senden
                      <Send className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Kontaktinformationen</h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-6 bg-card rounded-xl border border-border/50">
                  <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-emerald" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">E-Mail</h3>
                    <p className="text-muted-foreground">hello@matchunt.ai</p>
                    <p className="text-muted-foreground">support@matchunt.ai</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-6 bg-card rounded-xl border border-border/50">
                  <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-emerald" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Telefon</h3>
                    <p className="text-muted-foreground">+49 30 123 456 789</p>
                    <p className="text-sm text-muted-foreground">Mo-Fr, 9:00 - 18:00 Uhr</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-6 bg-card rounded-xl border border-border/50">
                  <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-emerald" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Adresse</h3>
                    <p className="text-muted-foreground">Matchunt GmbH</p>
                    <p className="text-muted-foreground">Musterstraße 123</p>
                    <p className="text-muted-foreground">10115 Berlin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
