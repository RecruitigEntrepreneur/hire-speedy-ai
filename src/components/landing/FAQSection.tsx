import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const faqs = [
  { question: "Wie schnell bekomme ich Kandidaten?", answer: "In der Regel erhalten Sie innerhalb weniger Tage die ersten qualifizierten Kandidatenvorschläge. Unser Netzwerk verifizierter Recruiter arbeitet sofort nach Freischaltung Ihrer Stellenanzeige an passenden Matches." },
  { question: "Wie sicher sind meine Daten und die der Kandidaten?", answer: "Wir sind DSGVO-konform: Alle Daten werden ausschließlich in EU-Rechenzentren gespeichert, bei Übertragung und Speicherung verschlüsselt, und ein Auftragsverarbeitungsvertrag (AVV) ist inklusive. Die Triple-Blind-Anonymisierung schützt zusätzlich alle Beteiligten." },
  { question: "Was kostet die Nutzung der Plattform?", answer: "Unser Modell ist rein erfolgsbasiert – Sie zahlen nur bei erfolgreicher Einstellung. Keine Fixkosten, keine Retainer, keine versteckten Gebühren. Die genaue Provision wird transparent vor Beginn des Prozesses kommuniziert und über unser Escrow-System sicher abgewickelt." },
  { question: "Was, wenn kein passender Kandidat dabei ist?", answer: "Sollten die vorgeschlagenen Kandidaten nicht Ihren Anforderungen entsprechen, entstehen Ihnen keine Kosten. Unser AI-Matching und die Performance-basierten Recruiter-Rankings sind darauf ausgelegt, nur wirklich passende Kandidaten vorzuschlagen. Bei Bedarf optimieren wir die Suchkriterien gemeinsam." },
  { question: "Wie wird die Qualität der Kandidaten garantiert?", answer: "Qualität wird durch mehrere Mechanismen sichergestellt: AI-gestützte Match-Scores, verifizierte Recruiter mit Performance-Tracking, strukturierte Kandidatenprofile mit Skills-Assessment und transparentes Feedback-System. Nur Recruiter mit nachgewiesener Top-Performance erhalten Zugang zu Ihren Mandaten." },
  { question: "Kann ich die Plattform mit meinem ATS integrieren?", answer: "Integrationen mit gängigen ATS-Systemen (z. B. Personio, Greenhouse, Lever) sind im Aufbau. Sprechen Sie uns an, welches System Sie nutzen – wir priorisieren Integrationen nach Bedarf unserer Kunden." },
];

export const FAQSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="faq" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">FAQ</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Häufig gestellte Fragen</h2>
          <p className="text-xl text-muted-foreground">Alles, was Sie wissen müssen, bevor Sie starten.</p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-card rounded-xl border border-border/50 px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline py-6">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
