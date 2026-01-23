import { useState } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [showTasks, setShowTasks] = useState(true);
  const [showRequirements, setShowRequirements] = useState(true);
  const [showBenefits, setShowBenefits] = useState(true);

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

  return (
    <div className="space-y-6">
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

      {/* Key Facts Grid */}
      {summary.key_facts && summary.key_facts.length > 0 && (
        <KeyFactsGrid facts={summary.key_facts} />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Tasks */}
        <Collapsible open={showTasks} onOpenChange={setShowTasks}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Aufgabenbereich</span>
                  {showTasks ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <TasksStructured tasks={summary.tasks_structured} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Right Column: Requirements */}
        <Collapsible open={showRequirements} onOpenChange={setShowRequirements}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Anforderungsprofil</span>
                  {showRequirements ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <StructuredRequirements requirements={summary.requirements_structured} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Benefits Section */}
      {summary.benefits_extracted && summary.benefits_extracted.length > 0 && (
        <Collapsible open={showBenefits} onOpenChange={setShowBenefits}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Benefits & Vorteile</span>
                  {showBenefits ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <ExtractedBenefits benefits={summary.benefits_extracted.slice(0, Math.ceil(summary.benefits_extracted.length / 2))} />
                  <ExtractedBenefits benefits={summary.benefits_extracted.slice(Math.ceil(summary.benefits_extracted.length / 2))} />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* AI Insights + Intake Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        {summary.ai_insights && (
          <AIInsightsCard insights={summary.ai_insights} />
        )}

        {/* Intake Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Intake-Status</span>
              {onEditIntake && (
                <Button variant="ghost" size="sm" onClick={onEditIntake}>
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  Ergänzen
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vollständigkeit</span>
                <span className="font-medium">{intakeCompleteness}%</span>
              </div>
              <Progress value={intakeCompleteness} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              {intakeCompleteness < 50 
                ? 'Füge mehr Intake-Informationen hinzu für bessere Kandidatenmatches.'
                : intakeCompleteness < 80 
                  ? 'Gute Basis! Weitere Details verbessern die Suche.'
                  : 'Exzellent! Das Profil ist sehr vollständig.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
