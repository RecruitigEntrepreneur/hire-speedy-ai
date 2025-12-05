import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Wie schnell bekomme ich Kandidaten?",
    answer: "Im Durchschnitt erhalten Sie innerhalb von 48-72 Stunden die ersten qualifizierten Kandidatenvorschläge. Unser Netzwerk von über 12.000 verifizierten Recruitern arbeitet sofort nach Freischaltung Ihrer Stellenanzeige an passenden Matches.",
  },
  {
    question: "Wie sicher sind meine Daten und die der Kandidaten?",
    answer: "Maximale Sicherheit ist unser Standard. Wir sind DSGVO-konform, nutzen End-to-End-Verschlüsselung, speichern alle Daten ausschließlich in EU-Rechenzentren und setzen auf Triple-Blind-Anonymisierung. Regelmäßige Security-Audits garantieren die Einhaltung höchster Sicherheitsstandards.",
  },
  {
    question: "Was kostet die Nutzung der Plattform?",
    answer: "Unser Modell ist rein erfolgsbasiert – Sie zahlen nur bei erfolgreicher Einstellung. Keine Fixkosten, keine Retainer, keine versteckten Gebühren. Die genaue Provision wird transparent vor Beginn des Prozesses kommuniziert und über unser Escrow-System sicher abgewickelt.",
  },
  {
    question: "Was, wenn kein passender Kandidat dabei ist?",
    answer: "Sollten die vorgeschlagenen Kandidaten nicht Ihren Anforderungen entsprechen, entstehen Ihnen keine Kosten. Unser AI-Matching und die Performance-basierten Recruiter-Rankings sind darauf ausgelegt, nur wirklich passende Kandidaten vorzuschlagen. Bei Bedarf optimieren wir die Suchkriterien gemeinsam.",
  },
  {
    question: "Wie wird die Qualität der Kandidaten garantiert?",
    answer: "Qualität wird durch mehrere Mechanismen sichergestellt: AI-gestützte Match-Scores, verifizierte Recruiter mit Performance-Tracking, strukturierte Kandidatenprofile mit Skills-Assessment und transparentes Feedback-System. Nur Recruiter mit nachgewiesener Top-Performance erhalten Zugang zu Ihren Mandaten.",
  },
  {
    question: "Kann ich die Plattform mit meinem ATS integrieren?",
    answer: "Ja, wir bieten native Integrationen mit allen gängigen ATS-Systemen wie Personio, Greenhouse, Lever, Workday und BambooHR. Weitere Integrationen sind auf Anfrage möglich. So bleiben alle Daten synchron und Sie können in Ihrer gewohnten Umgebung arbeiten.",
  },
];

export const FAQSection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-emerald font-semibold uppercase tracking-wider mb-4">FAQ</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Häufig gestellte Fragen
          </h2>
          <p className="text-xl text-muted-foreground">
            Alles, was Sie wissen müssen, bevor Sie starten.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border/50 px-6 data-[state=open]:shadow-lg transition-shadow"
              >
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
