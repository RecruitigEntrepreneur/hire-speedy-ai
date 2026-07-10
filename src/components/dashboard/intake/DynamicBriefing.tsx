import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IntakeBriefing, type Answers, type BriefBuilt, type JobType } from '../IntakeBriefing';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Circle, CircleDashed, HelpCircle, Loader2, Sparkles,
} from 'lucide-react';

export interface DynQuestion {
  id: string;
  chapter: string;
  question: string;
  why?: string;
  chips: string[];
}

export interface DynAnswered {
  id: string;
  chapter: string;
  question: string;
  answer: string; // '__unknown__' = Weiß ich nicht
}

export interface TensionFlag {
  id: string;
  message: string;
  suggestion: string;
  move_skill_to_nice?: string;
}

export interface DynState {
  available: boolean | null; // null = noch nicht probiert
  answers: DynAnswered[];
  askedIds: string[];
  completeness: number;
  chapterProgress: { chapter: string; state: 'done' | 'partial' | 'open' | 'skipped' }[];
  typedFields: Record<string, unknown>;
  skillRequirements: { skill: string; kind: 'must' | 'nice'; min_years?: number; proficiency?: string; recency?: string }[];
  payloadPatch: Record<string, unknown>;
  envelopePatch: Record<string, unknown>;
  tensionFlags: TensionFlag[];
  done: boolean;
}

export const EMPTY_DYN_STATE: DynState = {
  available: null,
  answers: [],
  askedIds: [],
  completeness: 0,
  chapterProgress: [],
  typedFields: {},
  skillRequirements: [],
  payloadPatch: {},
  envelopePatch: {},
  tensionFlags: [],
  done: false,
};

interface Props {
  type: JobType;
  jobDraft: Record<string, unknown>;
  state: DynState;
  onState: (updater: (prev: DynState) => DynState) => void;
  onMoveSkillToNice: (skill: string) => void;
  onDone: () => void;
  /** Fallback-Props für das statische Briefing (Function nicht erreichbar) */
  fallback: { built: BriefBuilt; value: Answers; onChange: (a: Answers) => void };
}

const stateIcon = (s: string) =>
  s === 'done' ? CheckCircle2 : s === 'partial' ? CircleDashed : Circle;

/**
 * Voll-KI-dynamisches Briefing (intake-questions, stateless): nach jeder
 * Antwort entscheidet die KI die nächste Frage, normalisiert Felder und meldet
 * Zielkonflikte. Ist die Function nicht erreichbar (noch nicht deployed),
 * fällt die Komponente transparent auf das statische IntakeBriefing zurück.
 */
export function DynamicBriefing({ type, jobDraft, state, onState, onMoveSkillToNice, onDone, fallback }: Props) {
  const [queue, setQueue] = useState<DynQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [dismissedFlags, setDismissedFlags] = useState<string[]>([]);
  const probing = useRef(false);

  const fetchNext = useCallback(
    async (answers: DynAnswered[], askedIds: string[]) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('intake-questions', {
          body: {
            contract_type: type,
            job_draft: jobDraft,
            answers,
            asked_ids: askedIds,
            max_questions: 2,
          },
        });
        if (error || !data || data.error) throw error || new Error(data?.error || 'no data');

        onState((prev) => ({
          ...prev,
          available: true,
          completeness: data.weighted_completeness ?? prev.completeness,
          chapterProgress: data.chapter_progress?.length ? data.chapter_progress : prev.chapterProgress,
          typedFields: { ...prev.typedFields, ...(data.typed_fields || {}) },
          skillRequirements: data.skill_requirements?.length ? data.skill_requirements : prev.skillRequirements,
          payloadPatch: { ...prev.payloadPatch, ...(data.intake_payload_patch || {}) },
          envelopePatch: { ...prev.envelopePatch, ...(data.reveal_envelope_patch || {}) },
          tensionFlags: data.tension_flags || [],
          done: (data.next_questions || []).length === 0,
        }));
        setQueue(data.next_questions || []);
      } catch (e) {
        console.warn('intake-questions nicht erreichbar — statisches Briefing als Fallback:', e);
        onState((prev) => ({ ...prev, available: false }));
      } finally {
        setLoading(false);
      }
    },
    [type, jobDraft, onState],
  );

  useEffect(() => {
    if (state.available === null && !probing.current) {
      probing.current = true;
      void fetchNext(state.answers, state.askedIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.available]);

  // ---- Fallback: statisches Briefing --------------------------------------
  if (state.available === false) {
    return (
      <IntakeBriefing
        type={type}
        built={fallback.built}
        value={fallback.value}
        onChange={fallback.onChange}
        onDone={onDone}
      />
    );
  }

  const current = queue[0] ?? null;

  const answer = (text: string) => {
    if (!current) return;
    const entry: DynAnswered = { id: current.id, chapter: current.chapter, question: current.question, answer: text };
    const answers = [...state.answers, entry];
    const askedIds = [...state.askedIds, current.id];
    onState((prev) => ({ ...prev, answers, askedIds }));
    setFreeText('');
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) void fetchNext(answers, askedIds);
  };

  const visibleFlags = state.tensionFlags.filter((f) => !dismissedFlags.includes(f.id));

  return (
    <div className="space-y-3">
      {/* Kapitel-Fortschritt */}
      {state.chapterProgress.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Briefing · {state.completeness}% vollständig</p>
          <div className="space-y-0.5">
            {state.chapterProgress.map((c) => {
              const Icon = stateIcon(c.state);
              return (
                <div
                  key={c.chapter}
                  className={cn('flex items-center gap-2 text-xs', c.state === 'open' ? 'text-muted-foreground' : '')}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      c.state === 'done' ? 'text-emerald-500' : c.state === 'partial' ? 'text-primary' : 'text-muted-foreground/40',
                    )}
                  />
                  <span className={cn(c.state === 'skipped' && 'line-through opacity-60')}>{c.chapter}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tension-Flags */}
      {visibleFlags.map((f) => (
        <div key={f.id} className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Spannung erkannt
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            {f.message} {f.suggestion}
          </p>
          <div className="flex gap-2">
            {f.move_skill_to_nice && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-amber-500/40 text-xs text-amber-600"
                onClick={() => {
                  onMoveSkillToNice(f.move_skill_to_nice!);
                  setDismissedFlags((d) => [...d, f.id]);
                }}
              >
                „{f.move_skill_to_nice}" zu Kann verschieben
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setDismissedFlags((d) => [...d, f.id])}>
              Lassen
            </Button>
          </div>
        </div>
      ))}

      {/* Aktuelle Frage / Lade / Fertig */}
      {loading && !current ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          KI wählt die nächste wichtige Frage …
        </div>
      ) : current ? (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {current.chapter}
          </p>
          <p className="mb-3 text-sm font-medium">{current.question}</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {current.chips.map((chip) => (
              <Button key={chip} size="sm" variant="outline" className="h-8 text-xs" onClick={() => answer(chip)}>
                {chip}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 border border-dashed text-xs text-muted-foreground"
              onClick={() => answer('__unknown__')}
            >
              <HelpCircle className="h-3.5 w-3.5" /> Weiß ich nicht
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && freeText.trim() && answer(freeText.trim())}
              placeholder="Eigene Antwort …"
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8 text-xs" disabled={!freeText.trim()} onClick={() => answer(freeText.trim())}>
              OK
            </Button>
          </div>
          {current.why && (
            <p className="mt-2 text-[11px] text-muted-foreground">💡 {current.why}</p>
          )}
        </div>
      ) : state.done ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium">Briefing vollständig — die Recruiter haben alles.</p>
          <Button size="sm" variant="outline" onClick={onDone}>
            Fertig
          </Button>
        </div>
      ) : null}
    </div>
  );
}
