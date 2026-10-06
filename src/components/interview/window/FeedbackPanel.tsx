import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import type { InterviewNote } from '@/hooks/useLiveInterviewNotes';

type Recommendation = 'proceed' | 'maybe' | 'reject';

interface Props {
  interviewId: string;
  candidateName: string;
  /** gespeichertes Feedback (JSON wie im bisherigen Formular) */
  feedback: string | null;
  /** Gespräch schon vorbei? Sonst nur Hinweis über dem Formular */
  started: boolean;
  notes: InterviewNote[];
  onSaved: () => void;
  onNextRound: () => void;
}

const RECOMMENDATIONS: { value: Recommendation; label: string }[] = [
  { value: 'proceed', label: 'Weiter – nächste Runde' },
  { value: 'maybe', label: 'Unsicher' },
  { value: 'reject', label: 'Absage' },
];
const SCORES = [
  { key: 'technical', label: 'Fachlich' },
  { key: 'communication', label: 'Kommunikation' },
  { key: 'culture', label: 'Passung zum Team' },
] as const;

function parse(feedback: string | null): Record<string, string | number | null | undefined> | null {
  if (!feedback) return null;
  try {
    const v = JSON.parse(feedback);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return { notes: feedback };
  }
}

function Stars({ value, onChange, label }: { value: number; onChange?: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm">{label}</span>
      <div className="flex gap-0.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            disabled={!onChange}
            onClick={() => onChange?.(n)}
            className="p-0.5 disabled:cursor-default"
            aria-label={`${n} von 5`}
          >
            <Star className={cn('h-5 w-5', n <= value ? 'fill-foreground text-foreground' : 'text-muted-foreground/40')} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Feedback nach dem Gespräch: Empfehlung, drei Bewertungen, Stärken/Bedenken aus den Notizen. */
export function FeedbackPanel({ interviewId, candidateName, feedback, started, notes, onSaved, onNextRound }: Props) {
  const { user } = useAuth();
  const saved = parse(feedback);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [scores, setScores] = useState({ technical: 0, communication: 0, culture: 0 });
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  // Stärken und Bedenken aus den Live-Notizen vorbelegen (nur solange leer)
  useEffect(() => {
    const pick = (type: string) => notes.filter((n) => n.note_type === type).map((n) => `• ${n.content}`).join('\n');
    setStrengths((cur) => cur || pick('strength'));
    setConcerns((cur) => cur || pick('concern'));
  }, [notes]);

  if (saved) {
    const rec = RECOMMENDATIONS.find((r) => r.value === saved.recommendation)?.label;
    const stars = (pct: unknown) => Math.round((Number(pct) || 0) / 20);
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Feedback gespeichert{saved.submitted_at ? ` am ${new Date(saved.submitted_at).toLocaleDateString('de-DE')}` : ''}.
          {rec && <> Empfehlung: <strong>{rec}</strong></>}
        </p>
        {saved.technical_score != null && (
          <div className="space-y-1.5">
            <Stars label="Fachlich" value={stars(saved.technical_score)} />
            <Stars label="Kommunikation" value={stars(saved.communication)} />
            <Stars label="Passung zum Team" value={stars(saved.culture_fit)} />
          </div>
        )}
        {saved.strengths && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">Stärken: </span>{saved.strengths}</p>}
        {saved.concerns && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">Bedenken: </span>{saved.concerns}</p>}
        {saved.notes && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">Kommentar: </span>{saved.notes}</p>}
        {saved.recommendation === 'proceed' && (
          <Button size="sm" onClick={onNextRound}>Nächste Runde anfragen</Button>
        )}
      </div>
    );
  }

  const ready = recommendation && SCORES.every((s) => scores[s.key] > 0);
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const pct = (v: number) => v * 20;
      const overall = Math.round((pct(scores.technical) + pct(scores.communication) + pct(scores.culture)) / 3);
      const { error } = await supabase.from('interviews').update({
        feedback: JSON.stringify({
          technical_score: pct(scores.technical),
          culture_fit: pct(scores.culture),
          communication: pct(scores.communication),
          overall_score: overall,
          recommendation,
          strengths: strengths.trim(),
          concerns: concerns.trim(),
          notes: comment.trim(),
          submitted_by: user?.id,
          submitted_at: new Date().toISOString(),
        }),
        status: 'completed',
      }).eq('id', interviewId);
      if (error) throw error;
      toast.success('Feedback gespeichert.');
      onSaved();
      if (recommendation === 'proceed') onNextRound();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das Feedback konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!started && <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Das Feedback ist nach dem Gespräch dran.</p>}
      <div className="space-y-2">
        <p className="text-sm font-medium">Wie geht es weiter mit {candidateName}?</p>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDATIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={recommendation === r.value}
              onClick={() => setRecommendation(r.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                recommendation === r.value ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {SCORES.map((s) => (
          <Stars key={s.key} label={s.label} value={scores[s.key]} onChange={(v) => setScores((cur) => ({ ...cur, [s.key]: v }))} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium">Stärken</p>
          <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">Bedenken</p>
          <Textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={3} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">Kommentar <span className="font-normal text-muted-foreground">(optional)</span></p>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
      </div>
      <div className="flex items-center justify-end gap-2">
        {!ready && <span className="text-xs text-muted-foreground">Empfehlung und drei Bewertungen wählen.</span>}
        <Button disabled={!ready || busy} onClick={submit} className="gap-1.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {recommendation === 'proceed' ? 'Speichern und Runde 2 anfragen' : 'Feedback speichern'}
        </Button>
      </div>
    </div>
  );
}
