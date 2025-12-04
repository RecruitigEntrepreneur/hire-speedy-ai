import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, AlertCircle, HelpCircle, Lightbulb, Building } from 'lucide-react';

interface CandidatePrepViewProps {
  candidatePrep: {
    key_strengths?: string[];
    improvement_areas?: string[];
    likely_questions?: string[];
    recommended_answers?: { question: string; answer: string }[];
    tips?: string[];
  };
  companyInsights?: {
    culture?: string;
    values?: string[];
    interview_style?: string;
  };
  candidateName?: string;
  jobTitle?: string;
}

export function CandidatePrepView({
  candidatePrep,
  companyInsights,
  candidateName,
  jobTitle,
}: CandidatePrepViewProps) {
  const { key_strengths = [], improvement_areas = [], likely_questions = [], recommended_answers = [], tips = [] } = candidatePrep;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-4 border-b">
        <h1 className="text-2xl font-bold">Interview-Vorbereitung</h1>
        {candidateName && jobTitle && (
          <p className="text-muted-foreground mt-1">
            {candidateName} • {jobTitle}
          </p>
        )}
      </div>

      {/* Key Strengths */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Ihre Stärken für diese Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {key_strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                  ✓
                </Badge>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Areas to Address */}
      {improvement_areas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Bereiche zum Ansprechen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {improvement_areas.map((area, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                    !
                  </Badge>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Likely Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            Wahrscheinliche Interview-Fragen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {likely_questions.map((question, index) => {
              const answer = recommended_answers.find(a => a.question === question);
              return (
                <AccordionItem key={index} value={`question-${index}`}>
                  <AccordionTrigger className="text-left">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="shrink-0">{index + 1}</Badge>
                      {question}
                    </span>
                  </AccordionTrigger>
                  {answer && (
                    <AccordionContent>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Empfohlene Antwort:</p>
                        <p>{answer.answer}</p>
                      </div>
                    </AccordionContent>
                  )}
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Tips */}
      {tips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Tipps für das Interview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                  <span className="text-yellow-600 font-bold">{index + 1}.</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Company Insights */}
      {companyInsights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-5 w-5 text-primary" />
              Über das Unternehmen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {companyInsights.culture && (
              <div>
                <h4 className="font-medium mb-1">Unternehmenskultur</h4>
                <p className="text-muted-foreground">{companyInsights.culture}</p>
              </div>
            )}
            {companyInsights.values && companyInsights.values.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Wichtige Werte & Anforderungen</h4>
                <div className="flex flex-wrap gap-2">
                  {companyInsights.values.map((value, index) => (
                    <Badge key={index} variant="secondary">{value}</Badge>
                  ))}
                </div>
              </div>
            )}
            {companyInsights.interview_style && (
              <div>
                <h4 className="font-medium mb-1">Interview-Stil</h4>
                <p className="text-muted-foreground">{companyInsights.interview_style}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
