import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { QuickRatingStars } from './QuickRatingStars';
import { QuickScores } from '@/hooks/useInterviewSession';

interface ChecklistItem {
  id: string;
  item: string;
  phase: string;
  hint?: string;
  isCompleted: boolean;
}

interface InterviewGuideProps {
  interviewId: string;
  interviewTypeId?: string;
  quickScores: QuickScores;
  onUpdateScore: (category: string, score: number) => void;
}

const DEFAULT_PHASES = [
  {
    id: 'intro',
    name: 'PHASE 1: EINSTIEG',
    duration: '5 Min',
    items: [
      { item: 'Begrüßung & Vorstellung', hint: 'Kurze Vorstellung des Unternehmens und Ihrer Rolle' },
      { item: 'Erwartungen klären', hint: 'Was erwartet der Kandidat vom Gespräch?' },
    ]
  },
  {
    id: 'technical',
    name: 'PHASE 2: FACHLICH',
    duration: '20 Min',
    items: [
      { item: 'Berufserfahrung durchgehen', hint: '"Erzählen Sie mir von Ihrer aktuellen Position"' },
      { item: 'Fachliche Kompetenzen', hint: '"Welche Tools/Technologien nutzen Sie täglich?"' },
      { item: 'Projektbeispiele', hint: '"Beschreiben Sie ein herausforderndes Projekt"' },
      { item: 'Problemlösungsfähigkeit', hint: '"Wie gehen Sie mit unerwarteten Hindernissen um?"' },
    ]
  },
  {
    id: 'culture',
    name: 'PHASE 3: KULTUR & FIT',
    duration: '10 Min',
    items: [
      { item: 'Teamarbeit', hint: '"Wie würden Ihre Kollegen Sie beschreiben?"' },
      { item: 'Arbeitsweise', hint: '"Wie organisieren Sie Ihren Arbeitstag?"' },
      { item: 'Remote-Erfahrung', hint: '"Wie arbeiten Sie am produktivsten?"' },
      { item: 'Motivation & Wechselgrund', hint: '"Was reizt Sie an dieser Position?"' },
    ]
  },
  {
    id: 'closing',
    name: 'PHASE 4: ABSCHLUSS',
    duration: '5 Min',
    items: [
      { item: 'Fragen des Kandidaten', hint: 'Raum für offene Fragen geben' },
      { item: 'Nächste Schritte erklären', hint: 'Timeline und Prozess kommunizieren' },
      { item: 'Verfügbarkeit & Konditionen', hint: 'Startdatum, Gehalt, Kündigungsfrist' },
    ]
  }
];

export function InterviewGuide({ 
  interviewId, 
  interviewTypeId,
  quickScores,
  onUpdateScore 
}: InterviewGuideProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['intro', 'technical']));
  const [loading, setLoading] = useState(true);

  // Initialize checklist
  useEffect(() => {
    const loadChecklist = async () => {
      setLoading(true);
      
      // Try to load existing progress
      const { data: progress } = await supabase
        .from('interview_checklist_progress')
        .select('*')
        .eq('interview_id', interviewId);

      // Build checklist from default phases
      const items: ChecklistItem[] = [];
      DEFAULT_PHASES.forEach(phase => {
        phase.items.forEach((item, idx) => {
          const existingProgress = progress?.find(
            p => p.checklist_item === item.item && p.phase === phase.id
          );
          items.push({
            id: existingProgress?.id || `${phase.id}-${idx}`,
            item: item.item,
            phase: phase.id,
            hint: item.hint,
            isCompleted: existingProgress?.is_completed || false,
          });
        });
      });

      setChecklist(items);
      setLoading(false);
    };

    loadChecklist();
  }, [interviewId, interviewTypeId]);

  const toggleItem = useCallback(async (itemId: string) => {
    const item = checklist.find(i => i.id === itemId);
    if (!item) return;

    const newCompleted = !item.isCompleted;

    // Update locally immediately
    setChecklist(prev => 
      prev.map(i => i.id === itemId ? { ...i, isCompleted: newCompleted } : i)
    );

    // Persist to database
    await supabase
      .from('interview_checklist_progress')
      .upsert({
        interview_id: interviewId,
        checklist_item: item.item,
        phase: item.phase,
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      }, {
        onConflict: 'interview_id,checklist_item'
      });
  }, [checklist, interviewId]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const completedCount = checklist.filter(i => i.isCompleted).length;
  const totalCount = checklist.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Progress header */}
      <div className="p-4 border-b space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Fortschritt</span>
          <span className="font-medium">{completedCount} von {totalCount}</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Checklist */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {DEFAULT_PHASES.map(phase => {
            const phaseItems = checklist.filter(i => i.phase === phase.id);
            const phaseCompleted = phaseItems.filter(i => i.isCompleted).length;
            const isExpanded = expandedPhases.has(phase.id);

            return (
              <div key={phase.id} className="space-y-2">
                {/* Phase header */}
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="flex items-center justify-between w-full text-left group"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold text-primary">
                      {phase.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({phase.duration})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {phaseCompleted}/{phaseItems.length}
                  </span>
                </button>

                {/* Phase items */}
                {isExpanded && (
                  <div className="ml-6 space-y-1">
                    {phaseItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={cn(
                          "flex items-start gap-3 w-full text-left p-2 rounded-md transition-colors",
                          "hover:bg-muted/50",
                          item.isCompleted && "opacity-60"
                        )}
                      >
                        <div className={cn(
                          "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors",
                          item.isCompleted 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-muted-foreground/30"
                        )}>
                          {item.isCompleted && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            item.isCompleted && "line-through"
                          )}>
                            {item.item}
                          </p>
                          {item.hint && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic">
                              → {item.hint}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Quick ratings */}
      <div className="p-4 border-t space-y-3 bg-muted/30">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <CircleDot className="h-3.5 w-3.5" />
          Schnellbewertung
        </h4>
        <div className="space-y-2">
          <QuickRatingStars
            label="Technisch"
            value={quickScores.technical || 0}
            onChange={(v) => onUpdateScore('technical', v)}
          />
          <QuickRatingStars
            label="Kommunikation"
            value={quickScores.communication || 0}
            onChange={(v) => onUpdateScore('communication', v)}
          />
          <QuickRatingStars
            label="Culture Fit"
            value={quickScores.culture_fit || 0}
            onChange={(v) => onUpdateScore('culture_fit', v)}
          />
        </div>
      </div>
    </div>
  );
}
