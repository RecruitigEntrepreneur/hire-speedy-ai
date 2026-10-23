import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import type { Answer, MatchOptions, Option, PublicQuestion, QuestionType } from '../lib/ausbildung';

export const TYPE_LABEL: Record<QuestionType, string> = {
  single: 'Eine Antwort',
  multi: 'Mehrere Antworten richtig',
  order: 'Reihenfolge',
  match: 'Zuordnen',
};

/** Startwert je Fragetyp: Reihenfolge beginnt in der (gemischten) Anzeigereihenfolge. */
export function initialAnswer(q: PublicQuestion): Answer | undefined {
  if (q.type === 'order') return (q.options as Option[]).map((o) => o.id);
  if (q.type === 'multi') return [];
  if (q.type === 'match') return {};
  return undefined;
}

export function isComplete(q: PublicQuestion, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  if (q.type === 'single') return typeof a === 'string' && a.length > 0;
  if (q.type === 'multi') return Array.isArray(a) && a.length > 0;
  if (q.type === 'order') return Array.isArray(a) && a.length === (q.options as Option[]).length;
  const left = (q.options as MatchOptions).left;
  return typeof a === 'object' && !Array.isArray(a) && left.every((l) => !!(a as Record<string, string>)[l.id]);
}

export function missingHint(q: PublicQuestion): string {
  if (q.type === 'multi') return 'Wähle mindestens eine Antwort.';
  if (q.type === 'match') return 'Ordne jedem Punkt links etwas zu.';
  return 'Wähle zuerst eine Antwort.';
}

interface Props {
  question: PublicQuestion;
  value: Answer | undefined;
  onChange: (a: Answer) => void;
  /** Nach der Auswertung: richtige Lösung zum Einfärben, Eingabe gesperrt. */
  reveal?: { correct: boolean; correct_answer: Answer } | null;
}

const optionBase = 'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors';

export function QuestionView({ question: q, value, onChange, reveal }: Props) {
  const locked = !!reveal;

  if (q.type === 'single' || q.type === 'multi') {
    const options = q.options as Option[];
    const selected = q.type === 'single' ? [value as string].filter(Boolean) : ((value as string[]) ?? []);
    const correctIds = reveal ? (Array.isArray(reveal.correct_answer) ? reveal.correct_answer as string[] : [reveal.correct_answer as string]) : [];
    const toggle = (id: string) => {
      if (locked) return;
      if (q.type === 'single') onChange(id);
      else onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    };
    return (
      <div role={q.type === 'single' ? 'radiogroup' : 'group'} className="space-y-2">
        {options.map((o) => {
          const isSel = selected.includes(o.id);
          const isRight = correctIds.includes(o.id);
          const tone = reveal
            ? isRight ? 'border-[hsl(152_56%_48%/0.7)] bg-[hsl(152_56%_48%/0.08)]'
              : isSel ? 'border-[hsl(6_85%_72%/0.7)] bg-[hsl(6_85%_72%/0.06)]' : 'border-[hsl(40_30%_90%/0.1)] opacity-70'
            : isSel ? 'border-[hsl(var(--acad-gold))] bg-[hsl(var(--acad-gold)/0.08)]' : 'border-[hsl(30_5%_42%)] hover:border-[hsl(var(--acad-gold)/0.6)]';
          return (
            <button
              key={o.id}
              type="button"
              role={q.type === 'single' ? 'radio' : 'checkbox'}
              aria-checked={isSel}
              disabled={locked}
              onClick={() => toggle(o.id)}
              className={`${optionBase} ${tone}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${q.type === 'single' ? 'rounded-full' : 'rounded-md'} ${isSel ? 'border-[hsl(var(--acad-gold))] bg-[hsl(var(--acad-gold))] text-[hsl(30_30%_8%)]' : 'border-[hsl(30_5%_50%)]'}`}>
                {isSel && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="flex-1">{o.text}</span>
              {reveal && isRight && <span className="text-xs text-[hsl(152_48%_66%)]">richtig</span>}
              {reveal && isSel && !isRight && <span className="text-xs text-[hsl(6_85%_75%)]">deine Wahl</span>}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'order') {
    const byId = new Map((q.options as Option[]).map((o) => [o.id, o]));
    const order = (value as string[]) ?? (q.options as Option[]).map((o) => o.id);
    const move = (i: number, d: -1 | 1) => {
      const j = i + d;
      if (locked || j < 0 || j >= order.length) return;
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    const correctOrder = reveal ? (reveal.correct_answer as string[]) : null;
    return (
      <div className="space-y-2">
        <ol className="space-y-2">
          {order.map((id, i) => {
            const right = correctOrder ? correctOrder[i] === id : null;
            return (
              <li key={id} className={`${optionBase} ${right === null ? 'border-[hsl(30_5%_42%)]' : right ? 'border-[hsl(152_56%_48%/0.7)]' : 'border-[hsl(6_85%_72%/0.7)]'}`}>
                <span className="font-display w-6 text-lg text-[hsl(var(--acad-gold-soft))]">{i + 1}</span>
                <span className="flex-1">{byId.get(id)?.text}</span>
                {!locked && (
                  <span className="flex gap-1">
                    <button type="button" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-md border border-[hsl(30_5%_42%)] p-1.5 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Nach unten" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="rounded-md border border-[hsl(30_5%_42%)] p-1.5 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {correctOrder && !reveal?.correct && (
          <div className="rounded-xl border border-[hsl(152_56%_48%/0.35)] p-3 text-sm text-[hsl(36_10%_82%)]">
            <span className="text-[hsl(152_48%_66%)]">Richtige Reihenfolge: </span>
            {correctOrder.map((id, i) => `${i + 1}. ${byId.get(id)?.text}`).join(' · ')}
          </div>
        )}
      </div>
    );
  }

  // match
  const opts = q.options as MatchOptions;
  const map = (value as Record<string, string>) ?? {};
  const correctMap = reveal ? (reveal.correct_answer as Record<string, string>) : null;
  const rightText = new Map(opts.right.map((r) => [r.id, r.text]));
  return (
    <div className="space-y-2">
      {opts.left.map((l) => {
        const chosen = map[l.id] ?? '';
        const right = correctMap ? correctMap[l.id] === chosen : null;
        return (
          <div key={l.id} className={`grid gap-2 rounded-xl border p-3 ${right === null ? 'border-[hsl(30_5%_42%)]' : right ? 'border-[hsl(152_56%_48%/0.7)]' : 'border-[hsl(6_85%_72%/0.7)]'}`}>
            <span className="text-[15px] font-medium">{l.text}</span>
            <div>
              <select
                aria-label={`Zuordnung für: ${l.text}`}
                disabled={locked}
                value={chosen}
                title={rightText.get(chosen) ?? ''}
                onChange={(e) => onChange({ ...map, [l.id]: e.target.value })}
                className="w-full rounded-lg border border-[hsl(30_5%_42%)] bg-[hsl(30_7%_8%)] px-3 py-2 text-[15px] text-[hsl(40_20%_93%)]"
              >
                <option value="">Bitte wählen …</option>
                {opts.right.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
              </select>
              {correctMap && right === false && (
                <p className="mt-1 text-sm text-[hsl(152_48%_66%)]">Richtig: {rightText.get(correctMap[l.id])}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ResultMark({ correct }: { correct: boolean }) {
  return correct
    ? <span className="chip chip-emerald"><Check className="h-3 w-3" /> richtig</span>
    : <span className="chip border-[hsl(6_85%_72%/0.5)] text-[hsl(6_85%_75%)]"><X className="h-3 w-3" /> falsch</span>;
}
