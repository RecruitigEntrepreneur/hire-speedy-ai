import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, AlertTriangle, Target, CheckSquare, User } from 'lucide-react';

interface InterviewerGuideProps {
  interviewerGuide: {
    questions_to_ask?: string[];
    red_flags?: string[];
    focus_areas?: string[];
    evaluation_criteria?: string[];
  };
  candidateSummary?: string | null;
  candidateName?: string;
  jobTitle?: string;
}

export function InterviewerGuide({
  interviewerGuide,
  candidateSummary,
  candidateName,
  jobTitle,
}: InterviewerGuideProps) {
  const { questions_to_ask = [], red_flags = [], focus_areas = [], evaluation_criteria = [] } = interviewerGuide;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Interview-Leitfaden</h2>
          {candidateName && jobTitle && (
            <p className="text-muted-foreground">
              {candidateName} • {jobTitle}
            </p>
          )}
        </div>
        <Badge variant="outline" className="bg-primary/10">AI-generiert</Badge>
      </div>

      {/* Candidate Summary */}
      {candidateSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Kandidaten-Zusammenfassung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{candidateSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Focus Areas */}
      {focus_areas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-blue-500" />
              Fokus-Bereiche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {focus_areas.map((area, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <span className="text-sm">{area}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions to Ask */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Empfohlene Fragen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {questions_to_ask.map((question, index) => (
              <li key={index} className="flex items-start gap-3">
                <Badge variant="outline" className="shrink-0 mt-0.5">{index + 1}</Badge>
                <span>{question}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Red Flags */}
      {red_flags.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Warnsignale beachten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {red_flags.map((flag, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-red-500">⚠</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Criteria */}
      {evaluation_criteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckSquare className="h-5 w-5 text-emerald-500" />
              Bewertungskriterien
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {evaluation_criteria.map((criterion, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <span>{criterion}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <div
                        key={score}
                        className="w-6 h-6 border rounded flex items-center justify-center text-xs text-muted-foreground"
                      >
                        {score}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <p className="text-xs text-muted-foreground text-center">
        Dieser Leitfaden wurde automatisch generiert und dient als Unterstützung. 
        Passen Sie die Fragen an Ihre spezifischen Bedürfnisse an.
      </p>
    </div>
  );
}
