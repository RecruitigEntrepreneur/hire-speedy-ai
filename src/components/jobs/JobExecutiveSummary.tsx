import { 
  Sparkles, 
  RefreshCw, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KeyFactsGrid } from './KeyFactsGrid';
import { StructuredRequirements } from './StructuredRequirements';
import { ExtractedBenefits } from './ExtractedBenefits';
import { TasksStructured } from './TasksStructured';
import { AIInsightsCard } from './AIInsightsCard';

interface KeyFact {
  icon: string;
  label: string;
  value: string;
}

interface TaskCategory {
  category: string;
  items: string[];
}

interface RequirementsStructured {
  education: string[];
  experience: string[];
  tools: string[];
  soft_skills: string[];
  certifications: string[];
}

interface Benefit {
  icon: string;
  text: string;
}

interface AIInsights {
  role_type: string;
  ideal_profile: string;
  unique_selling_point: string;
  hiring_recommendation: string;
}

interface JobSummary {
  key_facts: KeyFact[];
  tasks_structured: TaskCategory[];
  requirements_structured: RequirementsStructured;
  benefits_extracted: Benefit[];
  ai_insights: AIInsights;
  generated_at: string;
}

interface JobExecutiveSummaryProps {
  summary: JobSummary | null;
  intakeCompleteness: number;
  isGenerating?: boolean;
  onRefreshSummary: () => void;
  onEditIntake?: () => void;
}

export function JobExecutiveSummary({
  summary,
  intakeCompleteness,
  isGenerating = false,
  onRefreshSummary,
  onEditIntake
}: JobExecutiveSummaryProps) {
  if (isGenerating) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Generiere Executive Summary...</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Die KI analysiert die Stellenanzeige und strukturiert die Informationen
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Keine Zusammenfassung verfügbar</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Generiere eine strukturierte Übersicht der Stellenanforderungen
            </p>
          </div>
          <Button onClick={onRefreshSummary} className="mt-2">
            <Sparkles className="h-4 w-4 mr-2" />
            Summary generieren
          </Button>
        </div>
      </Card>
    );
  }

  const hasBenefits = summary.benefits_extracted && summary.benefits_extracted.length > 0;
  const hasAI = !!summary.ai_insights;

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Executive Summary</h2>
          {summary.generated_at && (
            <span className="text-xs text-muted-foreground">
              • Generiert am {new Date(summary.generated_at).toLocaleDateString('de-DE')}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onRefreshSummary}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Key Facts Grid - always visible */}
      {summary.key_facts && summary.key_facts.length > 0 && (
        <KeyFactsGrid facts={summary.key_facts} />
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="tasks">Aufgaben</TabsTrigger>
          <TabsTrigger value="requirements">Anforderungen</TabsTrigger>
          {hasBenefits && <TabsTrigger value="benefits">Benefits</TabsTrigger>}
          {hasAI && <TabsTrigger value="ai">KI-Analyse</TabsTrigger>}
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <TasksStructured tasks={summary.tasks_structured} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <StructuredRequirements requirements={summary.requirements_structured} />
            </CardContent>
          </Card>
        </TabsContent>

        {hasBenefits && (
          <TabsContent value="benefits" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <ExtractedBenefits benefits={summary.benefits_extracted.slice(0, Math.ceil(summary.benefits_extracted.length / 2))} />
                  <ExtractedBenefits benefits={summary.benefits_extracted.slice(Math.ceil(summary.benefits_extracted.length / 2))} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasAI && (
          <TabsContent value="ai" className="mt-4">
            <AIInsightsCard insights={summary.ai_insights} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
