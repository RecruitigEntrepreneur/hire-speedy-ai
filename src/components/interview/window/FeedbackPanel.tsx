import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { fmtDate } from '@/lib/localeFormat';
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
  /** „Noch unsicher“: Antwort des Headhunters auf die Frage */
  questionAnswer?: string | null;
  /** Gespräch schon vorbei? Sonst nur Hinweis über dem Formular */
  started: boolean;
  notes: InterviewNote[];
  onSaved: (way: FeedbackWay) => void;
  /** Nächster Schritt nach dem Feedback (Runde planen, Angebot, Absage) */
  onNext: (way: FeedbackWay) => void;
  /** Fenster schließen, wenn der Headhunter als Nächstes dran ist */
  onClose?: () => void;
}

/** Beschriftung unter clientInterviews:feedback.score.<key>. */
const SCORES = ['technical', 'communication', 'culture'] as const;

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
  const { t } = useTranslation('clientInterviews');
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
            aria-label={t('feedback.starAria', { n })}
          >
            <Star className={cn('h-5 w-5', n <= value ? 'fill-foreground text-foreground' : 'text-muted-foreground/40')} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Was jeder Weg bedeutet und wie der Speichern-Knopf heißt. */
function waysFor(nextRound: number, hh: string, t: TFunction) {
  const w = (key: string) => t(`feedback.way.${key}`, { n: nextRound, hh });
  return {
    next_round: { label: w('nextRound.label'), hint: w('nextRound.hint'), button: w('nextRound.button'), savedLabel: w('nextRound.saved') },
    offer: { label: w('offer.label'), hint: w('offer.hint'), button: w('offer.button'), savedLabel: w('offer.saved') },
    unsure: { label: w('unsure.label'), hint: w('unsure.hint'), button: w('unsure.button'), savedLabel: w('unsure.saved') },
    reject: { label: w('reject.label'), hint: w('reject.hint'), button: w('reject.button'), savedLabel: w('reject.saved') },
  } satisfies Record<FeedbackWay, { label: string; hint: string; button: string; savedLabel: string }>;
}

const ORDER: FeedbackWay[] = ['next_round', 'offer', 'unsure', 'reject'];

/**
 * Feedback nach dem Gespräch: Eindruck in eigenen Worten und einer von vier Wegen.
 * Der Headhunter bekommt es sofort (Glocke und Mail). Bewertung und Notizen sind optional.
 * Bei „Angebot“ schreibt zuerst der Headhunter die Empfehlung, bei „Noch unsicher“ klärt er die
 * Frage; das Angebot bleibt trotzdem jederzeit möglich (02.11.2026).
 */
export function FeedbackPanel({ interviewId, round, candidateName, recruiterName, feedback, questionAnswer, started, notes, onSaved, onNext, onClose }: Props) {
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  const saved = parse(feedback);
  const hh = recruiterName?.trim() || t('feedback.yourHh');
  const nextRound = (round || 1) + 1;
  const WAYS = waysFor(nextRound, hh, t);
  const first = candidateName.split(' ')[0] || candidateName;

  const [way, setWay] = useState<FeedbackWay | null>(null);
  const [impression, setImpression] = useState('');
  const [more, setMore] = useState(false);
  const [scores, setScores] = useState({ technical: 0, communication: 0, culture: 0 });
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  /** Gerade gespeichert und der Headhunter ist dran: Hinweis statt nächstem Fenster */
  const [hhTurn, setHhTurn] = useState<null | { way: 'offer' | 'unsure'; decided: boolean }>(null);
  const [skipHint, setSkipHint] = useState(false);

  // Stärken und Bedenken aus den Live-Notizen vorbelegen (nur solange leer)
  useEffect(() => {
    const pick = (type: string) => notes.filter((n) => n.note_type === type).map((n) => `• ${n.content}`).join('\n');
    setStrengths((cur) => cur || pick('strength'));
    setConcerns((cur) => cur || pick('concern'));
  }, [notes]);

  // Das Profil lädt beim Speichern neu und baut dieses Fenster dabei neu auf: Der Hinweis hängt
  // deshalb auch am gespeicherten Zeitpunkt, nicht nur am Zustand hier
  const savedWayNow = feedbackWayOf(feedback);
  const savedAtMs = Date.parse(String(saved?.unsure_decided_at ?? saved?.submitted_at ?? ''));
  const justSaved = !skipHint && (savedWayNow === 'offer' || savedWayNow === 'unsure') && Date.now() - savedAtMs < 60_000
    ? { way: savedWayNow, decided: !!saved?.unsure_decided_at } : null;
  const turn = skipHint ? null : hhTurn ?? justSaved;

  if (turn) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <p className="font-medium">{turn.decided ? t('feedback.saved') : t('feedback.feedbackSaved')}</p>
          <p className="text-muted-foreground">
            {turn.way === 'offer'
              ? t('feedback.hhOffer', { hh, first })
              : t('feedback.hhUnsure', { hh })}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {turn.way === 'offer'
            ? <button type="button" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => onNext('offer')}>{t('feedback.offerAnyway')}</button>
            : <button type="button" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setSkipHint(true)}>{t('feedback.decideNow')}</button>}
          {onClose && <Button onClick={onClose}>{t('common.close')}</Button>}
        </div>
      </div>
    );
  }

  const decide = async (next: 'offer' | 'next_round') => {
    setBusy(true);
    try {
      await interviewApi.decideUnsure(interviewId, next);
      onSaved(next);
      if (next === 'offer') { setSkipHint(false); setHhTurn({ way: 'offer', decided: true }); }
      else onNext(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('interviews:error.decision'));
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    const savedWay = feedbackWayOf(feedback);
    const stars = (pct: unknown) => Math.round((Number(pct) || 0) / 20);
    const text = (saved.impression as string) || (saved.notes as string) || '';
    return (
      <div className="space-y-4">
        <p className="text-sm">
          {saved.submitted_at ? t('feedback.savedOn', { date: fmtDate(String(saved.submitted_at)) }) : t('feedback.savedDot')}
          {savedWay && <> {t('feedback.nextWith')} <strong>{WAYS[savedWay].savedLabel}</strong></>}
        </p>
        {text && <p className="whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-sm">„{text}“</p>}
        {saved.question && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">{t('feedback.yourQuestion', { hh })} </span>{String(saved.question)}</p>}
        {questionAnswer && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">{t('feedback.answerFrom', { hh })} </span>{questionAnswer}</p>}
        {Number(saved.technical_score) > 0 && (
          <div className="space-y-1.5">
            <Stars label={t('feedback.score.technical')} value={stars(saved.technical_score)} />
            <Stars label={t('feedback.score.communication')} value={stars(saved.communication)} />
            <Stars label={t('feedback.score.culture')} value={stars(saved.culture_fit)} />
          </div>
        )}
        {saved.strengths && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">{t('feedback.strengthsColon')} </span>{String(saved.strengths)}</p>}
        {saved.concerns && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">{t('feedback.concernsColon')} </span>{String(saved.concerns)}</p>}
        {savedWay === 'next_round' && <Button size="sm" onClick={() => onNext('next_round')}>{t('feedback.planRound', { n: nextRound })}</Button>}
        {savedWay === 'unsure' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void decide('offer')}>{t('feedback.makeOffer')}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void decide('next_round')}>{t('feedback.planRound', { n: nextRound })}</Button>
          </div>
        )}
        {savedWay === 'offer' && <Button size="sm" onClick={() => onNext('offer')}>{t('feedback.makeOffer')}</Button>}
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
        question: way === 'unsure' ? question.trim() : undefined,
      });
      onSaved(way);
      if (way === 'offer' || way === 'unsure') {
        setHhTurn({ way, decided: false });
      } else {
        toast.success(t('feedback.savedInformed', { hh }));
        onNext(way);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('interviews:error.feedback'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!started && <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t('feedback.afterTalk')}</p>}
      <div className="space-y-1.5">
        <label htmlFor={`impression-${interviewId}`} className="text-sm font-medium">
          {t('feedback.impression')} <span className="font-normal text-muted-foreground">{t('feedback.goesTo', { hh })}</span>
        </label>
        <Textarea
          id={`impression-${interviewId}`}
          value={impression}
          onChange={(e) => setImpression(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t('feedback.impressionPh', { first })}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('feedback.howNext')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('feedback.howNext')}>
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

      {way === 'unsure' && (
        <div className="space-y-1.5">
          <label htmlFor={`question-${interviewId}`} className="text-sm font-medium">{t('feedback.clarify', { hh })}</label>
          <Textarea
            id={`question-${interviewId}`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t('feedback.clarifyPh', { first })}
          />
        </div>
      )}

      <div>
        <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" aria-expanded={more}>
          <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} /> {t('feedback.more')}
        </button>
        {more && (
          <div className="mt-3 space-y-4">
            <div className="space-y-1.5">
              {SCORES.map((key) => (
                <Stars key={key} label={t(`feedback.score.${key}`)} value={scores[key]} onChange={(v) => setScores((cur) => ({ ...cur, [key]: v }))} />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium">{t('feedback.strengths')}</p>
                <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">{t('feedback.concerns')}</p>
                <Textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={3} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <p className="text-xs text-muted-foreground">{t('feedback.footer', { hh, first })}</p>
        <Button disabled={!way || busy || !started || (way === 'unsure' && question.trim().length < 2)} onClick={submit} className="gap-1.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {way ? WAYS[way].button : t('feedback.pickWay')}
        </Button>
      </div>
    </div>
  );
}
