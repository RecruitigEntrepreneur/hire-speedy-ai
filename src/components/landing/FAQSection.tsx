import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useTranslation } from "react-i18next";

const faqs = [
  { questionKey: "faqs.item1_question", answerKey: "faqs.item1_answer" },
  { questionKey: "faqs.item2_question", answerKey: "faqs.item2_answer" },
  { questionKey: "faqs.item3_question", answerKey: "faqs.item3_answer" },
  { questionKey: "faqs.item4_question", answerKey: "faqs.item4_answer" },
  { questionKey: "faqs.item5_question", answerKey: "faqs.item5_answer" },
  { questionKey: "faqs.item6_question", answerKey: "faqs.item6_answer" },
];

export const FAQSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="faq" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`max-w-4xl mx-auto text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-muted-foreground font-semibold uppercase tracking-wider mb-4">{t("faq.eyebrow")}</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{t("faq.title")}</h2>
          <p className="text-xl text-muted-foreground">{t("faq.subtitle")}</p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-card rounded-xl border border-border/50 px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline py-6">{t(`faq.${faq.questionKey}`)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">{t(`faq.${faq.answerKey}`)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
