import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { feedbackWayOf, interviewApi, type FeedbackWay } from '@/lib/interviewScheduling';
import type { InterviewNote } from '@/hooks/useLiveInterviewNotes';

interface Props {
  interviewId: string;
  /** Runde dieses Gesprächs (1, 2, …) */
  round: number;
  candidateName: string;
  /** Name des Headhunters für die Hinweise; ohne Namen „Ihr Headhunter“ */
  recruiterName?: string | null;
  /** gespeichertes Feedback (JSON) */
  feedback: string | null;
  /** Gespräch schon vorbei? Sonst nur Hinweis über dem Formular */
  started: boolean;
  notes: InterviewNote[];
  onSaved: (way: FeedbackWay) => void;
  /** Nächster Schritt nach dem Feedback (Runde planen, Angebot, Absage) */
  onNext: (way: FeedbackWay) => void;
}

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
            onClick={() => onChange?.(value === n ? 0 : n)}
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

/** Was jeder Weg bedeutet und wie der Speichern-Knopf heißt. */
function waysFor(nextRound: number, hh: string) {
  return {
    next_round: { label: 'Nächste Runde', hint: `Interview ${nextRound} planen`, button: `Speichern und Interview ${nextRound} planen`, savedLabel: 'nächste Runde' },
    offer: { label: 'Angebot machen', hint: 'ohne weitere Runde', button: 'Speichern und Angebot vorbereiten', savedLabel: 'Angebot machen' },
    unsure: { label: 'Noch unsicher', hint: `${hh} meldet sich`, button: 'Feedback speichern', savedLabel: 'noch unsicher' },
    reject: { label: 'Absage', hint: `mit Grund an ${hh}`, button: 'Speichern und Absage formulieren', savedLabel: 'Absage' },
  } satisfies Record<FeedbackWay, { label: string; hint: string; button: string; savedLabel: string }>;
}

const ORDER: FeedbackWay[] = ['next_round', 'offer', 'unsure', 'reject'];

/**
 * Feedback nach dem Gespräch: Eindruck in eigenen Worten und einer von vier Wegen.
 * Der Headhunter bekommt es sofort (Glocke und Mail). Bewertung und Notizen sind optional.
 */
export function FeedbackPanel({ interviewId, round, candidateName, recruiterName, feedback, started, notes, onSaved, onNext }: Props) {
  const saved = parse(feedback);
  const hh = recruiterName?.trim() || 'Ihr Headhunter';
  const nextRound = (round || 1) + 1;
  const WAYS = waysFor(nextRound, hh);
  const first = candidateName.split(' ')[0] || candidateName;

  const [way, setWay] = useState<FeedbackWay | null>(null);
  const [impression, setImpression] = useState('');
  const [more, setMore] = useState(false);
  const [scores, setScores] = useState({ technical: 0, communication: 0, culture: 0 });
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [busy, setBusy] = useState(false);

  // Stärken und Bedenken aus den Live-Notizen vorbelegen (nur solange leer)
  useEffect(() => {
    const pick = (type: string) => notes.filter((n) => n.note_type === type).map((n) => `• ${n.content}`).join('\n');
    setStrengths((cur) => cur || pick('strength'));
    setConcerns((cur) => cur || pick('concern'));
  }, [notes]);

  if (saved) {
    const savedWay = feedbackWayOf(feedback);
    const stars = (pct: unknown) => Math.round((Number(pct) || 0) / 20);
    const text = (saved.impression as string) || (saved.notes as string) || '';
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Feedback gespeichert{saved.submitted_at ? ` am ${new Date(String(saved.submitted_at)).toLocaleDateString('de-DE')}` : ''}.
          {savedWay && <> Weiter mit: <strong>{WAYS[savedWay].savedLabel}</strong></>}
        </p>
        {text && <p className="whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-sm">„{text}“</p>}
        {Number(saved.technical_score) > 0 && (
          <div className="space-y-1.5">
            <Stars label="Fachlich" value={stars(saved.technical_score)} />
            <Stars label="Kommunikation" value={stars(saved.communication)} />
            <Stars label="Passung zum Team" value={stars(saved.culture_fit)} />
          </div>
        )}
        {saved.strengths && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">Stärken: </span>{String(saved.strengths)}</p>}
        {saved.concerns && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">Bedenken: </span>{String(saved.concerns)}</p>}
        {(savedWay === 'next_round' || savedWay === 'unsure') && (
          <Button size="sm" variant={savedWay === 'next_round' ? 'default' : 'outline'} onClick={() => onNext('next_round')}>Interview {nextRound} planen</Button>
        )}
        {savedWay === 'offer' && <Button size="sm" onClick={() => onNext('offer')}>Angebot machen</Button>}
      </div>
    );
  }

  const submit = async () => {
    if (!way) return;
    setBusy(true);
    try {
      await interviewApi.feedback({
        interviewId,
        way,
        impression: impression.trim(),
        scores: { technical: scores.technical || undefined, communication: scores.communication || undefined, culture: scores.culture || undefined },
        strengths: strengths.trim(),
        concerns: concerns.trim(),
      });
      toast.success(`Feedback gespeichert. ${hh} ist informiert.`);
      onSaved(way);
      onNext(way);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das Feedback konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!started && <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Das Feedback ist nach dem Gespräch dran.</p>}
      <div className="space-y-1.5">
        <label htmlFor={`impression-${interviewId}`} className="text-sm font-medium">
          Ihr Eindruck in ein, zwei Sätzen <span className="font-normal text-muted-foreground">(geht an {hh})</span>
        </label>
        <Textarea
          id={`impression-${interviewId}`}
          value={impression}
          onChange={(e) => setImpression(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={`Was hat Sie an ${first} überzeugt, was ist offen?`}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Wie geht es weiter?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Wie geht es weiter?">
          {ORDER.map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={way === w}
              onClick={() => setWay(w)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                way === w ? 'border-foreground ring-1 ring-foreground' : 'hover:border-primary/40 hover:bg-accent',
              )}
            >
              <span className="block text-sm font-medium">{WAYS[w].label}</span>
              <span className="block text-xs text-muted-foreground">{WAYS[w].hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" aria-expanded={more}>
          <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} /> Bewertung und Notizen (optional)
        </button>
        {more && (
          <div className="mt-3 space-y-4">
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
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <p className="text-xs text-muted-foreground">{hh} bekommt Ihr Feedback sofort und spricht mit {first}.</p>
        <Button disabled={!way || busy || !started} onClick={submit} className="gap-1.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {way ? WAYS[way].button : 'Weg wählen'}
        </Button>
      </div>
    </div>
  );
}
