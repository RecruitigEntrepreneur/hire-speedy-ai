import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isGermanUi, term } from '@/lib/candidateTerms';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { FREQUENCY_OPTIONS, type DossierForm } from '@/lib/candidateDossier';
import type { RoleFamily } from '@/lib/roleFamily';
import { clientTextIssues } from '@/lib/clientTextCheck';
import { ALL_GOALS, understandGoalWords, type GoalSuggestion, type GoalSuggestions, type GoalUnderstood } from '@/lib/careerGoals';
import { phrasesOf, togglePhrase } from '@/lib/interviewSuggestions';
import {
  MOTIVE_CHIPS,
  MOTIVE_NEG,
  MOTIVE_POS,
  evaluateMotives,
  learnablePhrase,
  motiveChipsFor,
  motiveDetailChoices,
  motiveLabels,
  motiveOwnWords,
  ownWordsSentence,
  replaceMotive,
  resolveAmbiguous,
  resolveAmbiguousIncident,
  toggleMotive,
  understandOwnWords,
  withOwnWords,
  ambiguousIncidents,
  ambiguousMotives,
  incidentAsk,
  incidentChipsFor,
  incidentHasEvent,
  incidentParts,
  incidentSentence,
  incidentTimeOptions,
  joinMotivation,
  setIncidentOwn,
  setIncidentTime,
  toggleIncident,
  motivationQuote,
  splitMotivation,
  type AmbiguousChoice,
  type ClientMotivation,
  type LearnedPhrase,
  type MotiveSide,
  type Understood,
} from '@/lib/situationMotives';
import { AreaField, Field, fieldId } from './DossierFields';

type SetFn = (patch: Partial<DossierForm>) => void;
const FIELD: Record<MotiveSide, 'current_positive' | 'current_negative'> = { pos: 'current_positive', neg: 'current_negative' };

/** Knöpfe mit Reihenfolge: die ersten 3 zählen für die Sätze, weitere sind blasser. */
function MotiveChips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (label: string) => void }) {
  useTranslation('candidateTerms');
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const i = selected.indexOf(o);
        const active = i >= 0;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors',
              !active && 'border-border text-foreground hover:bg-muted',
              active && i < 3 && 'border-primary bg-primary text-primary-foreground',
              active && i >= 3 && 'border-border bg-muted text-muted-foreground',
            )}
          >
            {active && <span className={cn('inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold', i < 3 ? 'bg-primary-foreground text-primary' : 'bg-background')}>{i + 1}</span>}
            {term(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Eigene Worte neben den Knöpfen. Lokal gehalten, damit beim Tippen nichts springt. */
function OwnWords({ side, text, onChange, placeholder, collapsible = false }: { side: MotiveSide; text: string; onChange: (text: string) => void; placeholder: string; collapsible?: boolean }) {
  const { t } = useTranslation('candidateDossier');
  const external = motiveOwnWords(text, side);
  const [value, setValue] = useState(external);
  const [opened, setOpened] = useState(false);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setValue(external); }, [external]);
  if (collapsible && !opened && !value) {
    return <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setOpened(true)}>{t('fields.ownWords')}</button>;
  }
  return (
    <Input
      id={fieldId(FIELD[side])}
      value={value}
      placeholder={placeholder}
      className="h-8 text-xs"
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setValue(motiveOwnWords(text, side)); }}
      onChange={(e) => { setValue(e.target.value); onChange(withOwnWords(text, side, e.target.value)); }}
    />
  );
}

/** Der Satz aus den Klicks, an der Stelle der früheren Komma-Abschrift; eigene Worte blau dahinter. */
const Sentence = ({ lines, own, empty }: { lines: string[]; own?: string; empty: string }) => (
  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
    {lines.length || own ? (
      <>
        {lines.map((l) => <p key={l}>{l}</p>)}
        {own && <p className="text-primary">{own}</p>}
      </>
    ) : (
      <p className="text-muted-foreground">{empty}</p>
    )}
  </div>
);

/** Alter Knopf, der zwei Dinge vermischt: genau nachfragen, bis dahin nicht im Kundentext. */
function AmbiguousPrompt({ choices, onResolve }: { choices: AmbiguousChoice[]; onResolve: (legacy: string, chosen: string[]) => void }) {
  const { t } = useTranslation(['candidateInterview', 'candidateTerms']);
  return (
    <>
      {choices.map((a) => (
        <div key={a.label} className="space-y-1 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <p>{t('mot.unclear', { label: term(a.label) })}</p>
          <div className="flex flex-wrap gap-1.5">
            {a.options.map((o) => (
              <button key={o} type="button" onClick={() => onResolve(a.label, [o])} className="rounded-md border border-warning/50 bg-background px-2 py-0.5 text-foreground hover:bg-muted">{term(o)}</button>
            ))}
            <button type="button" onClick={() => onResolve(a.label, a.options)} className="rounded-md border border-warning/50 bg-background px-2 py-0.5 text-foreground hover:bg-muted">{t('mot.both')}</button>
          </div>
          <p>{t('mot.unclearNote')}</p>
        </div>
      ))}
    </>
  );
}

// Beispiele im leeren Feld (so reden Kandidaten am Telefon): candidateInterview:mot.ownExamplesPos / ownExamplesNeg.

const catalogOf = (side: MotiveSide) => (side === 'pos' ? MOTIVE_POS : MOTIVE_NEG);
/** „Führungskraft mischt sich überall ein“ → „mischt sich überall ein“ (unter „Wie genau?“). */
const shortDetail = (label: string) => {
  // Die Kürzung hängt an der deutschen Formulierung; in anderen Sprachen steht der ganze Knopf.
  if (!isGermanUi()) return term(label);
  const t = label.replace(/^Führungskraft /, '');
  return t === label ? `${t.charAt(0).toLowerCase()}${t.slice(1)}` : t;
};

// Herkunft eines Vorschlags: candidateInterview:mot.learned / mot.ai
const SOURCE_TAG: Record<Understood['source'], 'mot.learned' | 'mot.ai' | null> = { wort: null, gelernt: 'mot.learned', ki: 'mot.ai' };

/** Vorschläge aus den eigenen Worten: „Satzteil“ → Knopf, bei ungenauen Knöpfen gleich „Wie genau?“. */
function Understanding({ side, hits, loading, onPick }: { side: MotiveSide; hits: Understood[]; loading: boolean; onPick: (label: string, hit: Understood) => void }) {
  const { t } = useTranslation(['candidateInterview', 'candidateTerms']);
  if (!hits.length && !loading) return null;
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-muted-foreground">{hits.length ? t('mot.understood') : t('mot.understanding')}</p>
      {hits.map((h) => {
        const details = catalogOf(side)[h.label]?.details;
        const tag = SOURCE_TAG[h.source];
        return (
          <div key={h.label} className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => onPick(h.label, h)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary px-2 py-0.5 text-left text-primary hover:bg-primary/10">
              „{h.quote}“ → {term(h.label)}
              {tag && <span className="rounded bg-primary/10 px-1 text-[10px]">{t(tag)}</span>}
            </button>
            {details && (
              <>
                <span className="text-muted-foreground">{t('mot.howExactly')}</span>
                {details.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onPick(d, h)}
                    className={cn('rounded-md border px-2 py-0.5 hover:bg-muted', d === h.detail ? 'border-dashed border-primary text-primary' : 'border-border text-foreground')}
                  >
                    {shortDetail(d)}
                  </button>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Angetippter ungenauer Knopf: „Wie genau?“ ersetzt ihn durch den genauen. */
function DetailChoices({ choices, onPick }: { choices: Array<{ label: string; options: string[] }>; onPick: (from: string, to: string) => void }) {
  const { t } = useTranslation(['candidateInterview', 'candidateTerms']);
  return (
    <>
      {choices.map((c) => (
        <div key={c.label} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{t('mot.detailOf', { label: term(c.label) })}</span>
          {c.options.map((o) => (
            <button key={o} type="button" onClick={() => onPick(c.label, o)} className="rounded-md border border-border px-2 py-0.5 text-foreground hover:bg-muted">{shortDetail(o)}</button>
          ))}
        </div>
      ))}
    </>
  );
}

// Lernendes Wörterbuch (interview_phrase_learnings, Migration 20261019100000): einmal je
// Sitzung geladen. Fehlt die Tabelle noch, bleibt es still beim festen Wörterbuch.
let learnedCache: LearnedPhrase[] | null = null;
let learnedLoading: Promise<void> | null = null;
const db = supabase as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

function useLearnedPhrases(family: RoleFamily) {
  const [learned, setLearned] = useState<LearnedPhrase[]>(learnedCache ?? []);
  useEffect(() => {
    if (learnedCache) return;
    learnedLoading ??= db.from('interview_phrase_learnings').select('side, phrase, label').limit(3000).then(({ data, error }: { data: LearnedPhrase[] | null; error: unknown }) => {
      learnedCache = !error && data ? data : [];
    });
    void learnedLoading.then(() => setLearned(learnedCache ?? []));
  }, []);
  const remember = (side: MotiveSide | 'goal', quote: string, label: string) => {
    const phrase = learnablePhrase(quote);
    if (!phrase) return;
    learnedCache = [...(learnedCache ?? []), { side: side as MotiveSide, phrase, label }];
    setLearned(learnedCache);
    void db.from('interview_phrase_learnings').insert({ side, phrase, label, family }).then(() => undefined);
  };
  return { learned, remember };
}

// KI als Rückfall (Edge Function interview-understand): nur wenn Wörterbuch und gelernte
// Wendungen nichts finden. Ist die Function noch nicht deployt, wird sie in dieser
// Sitzung nicht mehr gefragt.
let kiUnavailable = false;
const kiCache = new Map<string, Understood[]>();

/** KI-Rückfall für eigene Worte (gefällt, stört oder Karriereziel): nur vorhandene Knöpfe, nur wenn sonst nichts passt. */
function useKiFallback(candidateId: string | undefined, side: MotiveSide | 'goal', own: string, labels: string[], localHits: number, chosen: string[]) {
  const text = own.trim();
  const key = `${side}|${text}`;
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const words = text.split(/\s+/).filter(Boolean).length;
  const labelKey = labels.join('|');
  useEffect(() => {
    if (!candidateId || kiUnavailable || localHits > 0 || words < 3 || kiCache.has(key)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('interview-understand', { body: { candidateId, side, text, labels } });
      if (cancelled) return;
      setLoading(false);
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (!status || status === 404 || status >= 500) kiUnavailable = true;
        return;
      }
      const matches = Array.isArray(data?.matches) ? (data.matches as Array<{ label: string; quote: string }>) : [];
      kiCache.set(key, matches.filter((m) => labels.includes(m.label)).map((m) => ({ label: m.label, quote: m.quote, source: 'ki' as const })));
      setTick((t) => t + 1);
    }, 1200);
    return () => { cancelled = true; window.clearTimeout(timer); setLoading(false); };
  }, [candidateId, key, localHits, words, labelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const taken = new Set(chosen.map((c) => c.toLowerCase()));
  return { hits: (kiCache.get(key) ?? []).filter((h) => !taken.has(h.label.toLowerCase())), loading };
}

/** Knöpfe, die die KI bei gefällt/stört vorschlagen darf (Familie zuerst, keine alten oder genauen). */
function kiLabels(side: MotiveSide, family: RoleFamily): string[] {
  const cat = catalogOf(side);
  return [...MOTIVE_CHIPS[family][side], ...Object.keys(cat)].filter((l, i, a) => a.indexOf(l) === i && !cat[l].ambiguous && !cat[l].detailOf).slice(0, 80);
}

/**
 * „Was gefällt, was stört“: Knöpfe je Rollenfamilie, darunter je Seite der Satz
 * aus den Klicks (situationMotives.ts). Eigene Worte werden beim Tippen verstanden
 * (Wörterbuch, gelernte Wendungen, KI als Rückfall) und als Knopf vorgeschlagen.
 * Der Rest der Auswertung läuft im Hintergrund. stacked: beide Fragen untereinander,
 * eigene Worte erst auf Klick (Schritt-für-Schritt-Ansicht des Interviews).
 */
export function MotiveBlock({ form, set, family, candidateId, stacked = false }: { form: DossierForm; set: SetFn; family: RoleFamily; candidateId?: string; stacked?: boolean }) {
  const { t } = useTranslation(['candidateInterview', 'candidateTerms']);
  const [lastNeg, setLastNeg] = useState<string | null>(null);
  const pos = motiveLabels(form.current_positive, 'pos');
  const neg = motiveLabels(form.current_negative, 'neg');
  const ev = useMemo(() => evaluateMotives(family, pos, neg), [family, pos.join('|'), neg.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const { learned, remember } = useLearnedPhrases(family);

  const togglePos = (label: string) => set({ current_positive: toggleMotive(form.current_positive, label, 'pos') });
  // Wechselgrund-Themen leitet das Interview im Hintergrund aus den Stör-Knöpfen ab.
  const toggleNeg = (label: string) => {
    const next = toggleMotive(form.current_negative, label, 'neg');
    set({ current_negative: next });
    if (motiveLabels(next, 'neg').includes(label)) setLastNeg(label);
  };

  const posHits = useMemo(() => understandOwnWords(form.current_positive, 'pos', family, learned), [form.current_positive, family, learned]);
  const negHits = useMemo(() => understandOwnWords(form.current_negative, 'neg', family, learned), [form.current_negative, family, learned]);
  const posKi = useKiFallback(candidateId, 'pos', motiveOwnWords(form.current_positive, 'pos'), kiLabels('pos', family), posHits.length, pos);
  const negKi = useKiFallback(candidateId, 'neg', motiveOwnWords(form.current_negative, 'neg'), kiLabels('neg', family), negHits.length, neg);

  // Vorschlag übernehmen; ein KI-Vorschlag wird dabei fürs Wörterbuch gelernt.
  const pick = (side: MotiveSide, label: string, hit: Understood) => {
    const text = side === 'pos' ? form.current_positive : form.current_negative;
    const generic = catalogOf(side)[label]?.detailOf;
    const next = generic && motiveLabels(text, side).includes(generic) ? replaceMotive(text, generic, label, side) : toggleMotive(text, label, side);
    set(side === 'pos' ? { current_positive: next } : { current_negative: next });
    if (side === 'neg') setLastNeg(label);
    if (hit.source === 'ki') remember(side, hit.quote, generic ?? label);
  };

  const live = lastNeg && neg.includes(lastNeg) ? MOTIVE_NEG[lastNeg] : neg.length ? MOTIVE_NEG[neg[0]] : null;
  // Die deutschen Sätze baut situationMotives.ts aus festen Bausteinen (Fälle, Artikel). In den
  // anderen Sprachen steht dieselbe Aussage als Aufzählung der ersten drei Knöpfe.
  const satz = (side: MotiveSide): string[] => {
    if (isGermanUi()) return side === 'pos' ? ev.satzPos : ev.satzNeg;
    const top = (side === 'pos' ? pos : neg).slice(0, 3);
    return top.length ? [t(side === 'pos' ? 'mot.posLine' : 'mot.negLine', { list: top.map((l) => term(l)).join(', ') })] : [];
  };

  return (
    <div className="space-y-3">
      <div className={stacked ? 'space-y-5' : 'grid gap-3 sm:grid-cols-2'}>
        <Field label={t('mot.qPositive')} field="current_positive">
          <p className="-mt-1 text-xs text-muted-foreground">{t('mot.whyPositive')}</p>
          <MotiveChips options={motiveChipsFor(family, 'pos', form.current_positive)} selected={pos} onToggle={togglePos} />
          <Sentence lines={satz('pos')} own={ownWordsSentence(motiveOwnWords(form.current_positive, 'pos'))} empty={t('mot.sentenceEmpty')} />
          <OwnWords side="pos" text={form.current_positive} onChange={(t) => set({ current_positive: t })} placeholder={t('mot.ownExamplesPos')} collapsible={stacked} />
          <Understanding side="pos" hits={[...posHits, ...posKi.hits]} loading={posKi.loading} onPick={(l, h) => pick('pos', l, h)} />
        </Field>
        <Field label={t('mot.qNegative')} field="current_negative">
          <p className="-mt-1 text-xs text-muted-foreground">{t('mot.whyNegative')}</p>
          <MotiveChips options={motiveChipsFor(family, 'neg', form.current_negative)} selected={neg} onToggle={toggleNeg} />
          <DetailChoices choices={motiveDetailChoices(form.current_negative, 'neg')} onPick={(from, to) => { set({ current_negative: replaceMotive(form.current_negative, from, to, 'neg') }); setLastNeg(to); }} />
          <AmbiguousPrompt choices={ambiguousMotives(form.current_negative, 'neg')} onResolve={(legacy, chosen) => set({ current_negative: resolveAmbiguous(form.current_negative, 'neg', legacy, chosen) })} />
          <Sentence lines={satz('neg')} own={ownWordsSentence(motiveOwnWords(form.current_negative, 'neg'))} empty={t('mot.sentenceEmpty')} />
          <OwnWords side="neg" text={form.current_negative} onChange={(t) => set({ current_negative: t })} placeholder={t('mot.ownExamplesNeg')} collapsible={stacked} />
          <Understanding side="neg" hits={[...negHits, ...negKi.hits]} loading={negKi.loading} onPick={(l, h) => pick('neg', l, h)} />
        </Field>
      </div>
      {(live?.ask || ev.zuViele) && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {live?.ask && <p><span className="font-medium text-foreground">{t('mot.followUp')}</span> {term(live.ask)}</p>}
          {ev.zuViele && <p>{t('mot.tooMany')}</p>}
        </div>
      )}
    </div>
  );
}

/** Ergänzungsfeld: lokal gehalten, damit beim Tippen nichts springt. */
function AdditionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('candidateInterview');
  const [v, setV] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value); }, [value]);
  return (
    <Input
      id={fieldId('change_motivation')}
      value={v}
      placeholder={t('mot.additionPlaceholder')}
      className="h-8 text-xs"
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setV(value); }}
      onChange={(e) => { setV(e.target.value); onChange(e.target.value); }}
    />
  );
}

/**
 * „Woher kommt Ihre Wechselmotivation?“: der Kundentext „Warum wechseln“. Vorn der
 * Satz aus den Klicks (clientMotivation), der mitzieht; hinten eine Ergänzung aus dem
 * Feld, den Vorschlägen oder dem Zitat. „Ganz selbst schreiben“ macht ihn frei
 * editierbar, dann gibt es „Neu formulieren“.
 */
export function ClientMotivationField({ form, set, motivation, onRegenerate, children }: {
  form: DossierForm;
  set: SetFn;
  motivation: ClientMotivation;
  onRegenerate: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation(['candidateInterview', 'candidateTerms']);
  const [selfWrite, setSelfWrite] = useState(false);
  const text = form.change_motivation.trim();
  const gen = motivation.text;
  const split = splitMotivation(text, gen);
  // Ohne Satz aus Klicks ist alles Ergänzung; selbst geschriebener Text ist frei.
  const frei = selfWrite || (!!text && !!gen && !split.auto);
  const addition = gen ? split.addition : text;
  const setAddition = (a: string) => set({ change_motivation: joinMotivation(gen, a) });
  const quote = motivationQuote(form.current_negative);
  const issues = text ? clientTextIssues({ ...form, summary_motivation: form.change_motivation }).filter((i) => i.field === 'summary_motivation') : [];
  const kunde = form.summary_motivation.trim();
  const weg = motivation.weggelassen.map((l) => `„${term(l)}“`);
  return (
    <Field label={t('mot.qMotivation')} field="change_motivation">
      <p className="-mt-1 text-xs text-muted-foreground">{t('mot.whyMotivation')}</p>
      {children}
      {frei ? (
        <>
          <AreaField field="change_motivation" value={form.change_motivation} onChange={(v) => set({ change_motivation: v })} rows={3} placeholder={t('mot.motivationPlaceholder')} />
          {gen && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {split.auto ? t('mot.freeAuto') : t('mot.freeOwn')}
              <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => { setSelfWrite(false); onRegenerate(); }}>{t('mot.rephrase')}</Button>
            </p>
          )}
        </>
      ) : (
        <>
          <div className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            {motivation.parts.length || addition ? (
              <>
                {motivation.parts.map((p) => (
                  <p key={p.text}>
                    {p.text} <span className="whitespace-nowrap rounded bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] text-primary">{term(p.src)}</span>
                  </p>
                ))}
                {addition && <p className="text-primary">{addition} <span className="whitespace-nowrap rounded bg-primary/10 px-1.5 py-0.5 align-middle text-[10px]">{t('mot.yourAddition')}</span></p>}
              </>
            ) : (
              <p className="text-muted-foreground">{t('mot.fromClicks')}</p>
            )}
          </div>
          {gen && <p className="text-xs text-muted-foreground">{t('mot.follows')}</p>}
          <AdditionInput value={addition} onChange={setAddition} />
          {quote && !addition.includes(quote) && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setAddition(joinMotivation(addition, quote))} className="rounded-md border border-dashed border-primary px-2.5 py-1 text-xs text-primary">
                {t('mot.quoteApply', { quote: quote.replace(/\.$/, '') })}
              </button>
            </div>
          )}
        </>
      )}
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {weg.length > 0 && <p>{t('mot.leftOut', { list: weg.join(', ') })}</p>}
        {motivation.ungenau.length > 0 && <p className="text-warning">{t('mot.leftUnclear', { list: motivation.ungenau.map((l) => `„${term(l)}“`).join(', ') })}</p>}
        {text && !issues.length && <p>{addition ? t('mot.checkedAddition') : t('mot.checked')}</p>}
        {issues.map((i) => <p key={i.message} className={i.level === 'danger' ? 'text-destructive' : 'text-warning'}>{term(i.message)}</p>)}
        {!frei && gen && (
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setSelfWrite(true)}>{t('mot.writeSelf')}</button>
        )}
      </div>
      {motivation.fehltGrund && !addition && (!text || !frei) && (
        <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          {motivation.ohneGrund && weg.length
            ? t('mot.noReasonLeftOut', { count: weg.length, list: weg.join(', ') })
            : t('mot.noReason')}
        </p>
      )}
      {kunde && kunde !== text && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{t('mot.clientOther')}</p>
          <p><span className="text-muted-foreground">{t('mot.clientWhy')}</span> {kunde}</p>
        </div>
      )}
    </Field>
  );
}

/** Eingabefeld mit lokalem Stand, damit beim Tippen nichts springt. */
function LocalInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [v, setV] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value); }, [value]);
  return (
    <Input
      id={id}
      value={v}
      placeholder={placeholder}
      className="h-8 text-xs"
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setV(value); }}
      onChange={(e) => { setV(e.target.value); onChange(e.target.value); }}
    />
  );
}

const chip = (active: boolean, suggested = false) =>
  cn(
    'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors',
    active ? 'border-primary bg-primary text-primary-foreground' : suggested ? 'border-dashed border-primary text-primary' : 'border-border text-foreground hover:bg-muted',
  );

/**
 * „Gab es einen konkreten Auslöser?“: „Was ist passiert?“ (Vorschläge aus den
 * Stör-Knöpfen und dem Werdegang zuerst) und „Wann?“ in Worten, darunter der Satz,
 * der auch „Wie oft kommt das vor?“ aufnimmt. Nur für den Headhunter; sachliche
 * Anlässe nutzt der Kundentext „Warum wechseln“.
 */
export function IncidentBlock({ form, set, family, suggestions, whyNowNote, children }: {
  form: DossierForm;
  set: SetFn;
  family: RoleFamily;
  suggestions: string[];
  /** Früher bei „Warum gerade jetzt?“ selbst notiert (bleibt sichtbar, wird nicht überschrieben). */
  whyNowNote?: string;
  children?: ReactNode;
}) {
  const { t: td } = useTranslation('candidateDossier');
  const { t } = useTranslation(['candidateInterview', 'candidateTerms']);
  const [last, setLast] = useState<string | null>(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const text = form.specific_incident;
  const parts = incidentParts(text);
  const times = incidentTimeOptions();
  const fremdeZeit = parts.time && !times.some((x) => x.value === parts.time) ? parts.time : null;
  // „Wann“ und „Wie oft“ nur bei einem echten Anlass; bei „Kein einzelner Anlass“ erübrigen sie sich.
  const hasEvent = incidentHasEvent(text);
  // Der deutsche Satz kommt aus situationMotives.ts; sonst dieselben Angaben als Aufzählung.
  const satz = isGermanUi()
    ? incidentSentence(text, hasEvent ? form.frequency_of_issues : null)
    : [parts.events.map((e) => term(e)).join(', '), hasEvent && parts.time ? term(times.find((x) => x.value === parts.time)?.label ?? parts.time) : '', hasEvent && form.frequency_of_issues ? term(form.frequency_of_issues) : ''].filter(Boolean).join(' · ');
  const own = ownWordsSentence(parts.own);
  const ask = incidentAsk(last && parts.events.includes(last) ? last : parts.events[0] ?? null);
  const toggle = (label: string) => {
    const next = toggleIncident(text, label);
    set({ specific_incident: next });
    if (incidentParts(next).events.includes(label)) setLast(label);
  };
  return (
    <Field label={t('mot.qIncident')} field="specific_incident">
      {children}
      <div className="flex flex-wrap gap-1.5">
        {incidentChipsFor(family, suggestions, text).map((l) => {
          const active = parts.events.includes(l);
          const suggested = suggestions.includes(l);
          return <button key={l} type="button" aria-pressed={active} title={suggested ? t('mot.incidentFits') : undefined} className={chip(active, suggested)} onClick={() => toggle(l)}>{term(l)}</button>;
        })}
      </div>
      <AmbiguousPrompt choices={ambiguousIncidents(text)} onResolve={(legacy, chosen) => set({ specific_incident: resolveAmbiguousIncident(text, legacy, chosen) })} />
      {hasEvent && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium">{t('mot.when')}</p>
            <div className="flex flex-wrap gap-1.5">
              {times.map((zeit) => {
                const active = parts.time === zeit.value;
                return (
                  <button key={zeit.value} type="button" aria-pressed={active} className={chip(active)} onClick={() => set({ specific_incident: setIncidentTime(text, zeit.value) })}>
                    {term(zeit.label)}
                    {zeit.month && <span className={cn('text-[10px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{zeit.month}</span>}
                  </button>
                );
              })}
              {fremdeZeit && <button type="button" aria-pressed className={chip(true)} onClick={() => set({ specific_incident: setIncidentTime(text, fremdeZeit) })}>{fremdeZeit}</button>}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">{t('mot.howOften')}</p>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map((o) => {
                const active = form.frequency_of_issues === o.value;
                return <button key={o.value} type="button" aria-pressed={active} className={chip(active)} onClick={() => set({ frequency_of_issues: active ? null : o.value })}>{term(o.label)}</button>;
              })}
            </div>
          </div>
        </div>
      )}
      {(satz || own) && (
        <p className="text-sm text-muted-foreground">
          → {satz}{satz && own ? ' ' : ''}{own && <span className="text-primary">{own}</span>}
        </p>
      )}
      {ownOpen || parts.own ? (
        <LocalInput id={fieldId('specific_incident')} value={parts.own} onChange={(v) => set({ specific_incident: setIncidentOwn(text, v) })} placeholder={t('mot.ownOptional')} />
      ) : (
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setOwnOpen(true)}>{td('fields.ownWords')}</button>
      )}
      {whyNowNote?.trim() && <p className="text-xs text-muted-foreground">{t('mot.incidentEarlier', { note: whyNowNote })}</p>}
      {ask && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{t('mot.followUp')}</span> {term(ask)}</p>}
    </Field>
  );
}

/**
 * „Was wollen Sie in Ihrer Karriere ultimativ erreichen?“: zwei Reihen (erst beruflich,
 * dann persönlich) aus careerGoalSuggestions, die besten
 * Vorschläge gestrichelt mit Grund. Eigene Worte bleiben im selben Feld.
 */
export function CareerGoalBlock({ form, set, suggestions, legacy = [], candidateId, family }: {
  form: DossierForm;
  set: SetFn;
  suggestions: GoalSuggestions;
  /** Frühere Ziel-Knöpfe und Wunschrollen: angetippt bleiben sie als Knopf sichtbar, nicht als eigene Worte. */
  legacy?: string[];
  candidateId?: string;
  family: RoleFamily;
}) {
  const { t: td } = useTranslation('candidateDossier');
  const { t } = useTranslation(['candidateInterview', 'candidateTerms']);
  const [ownOpen, setOwnOpen] = useState(false);
  const text = form.career_ultimate_goal;
  const chosen = phrasesOf(text);
  const norm = (x: string) => x.trim().toLowerCase();
  const isOn = (l: string) => chosen.some((p) => norm(p) === norm(l));
  const visible = new Set([...suggestions.beruflich, ...suggestions.persoenlich].map((g) => norm(g.label)));
  // Früher angetippte Ziele, die gerade nicht vorgeschlagen werden, bleiben als Knopf sichtbar.
  const isLegacy = (p: string) => legacy.some((l) => norm(l) === norm(p));
  const extra = (kind: 'beruflich' | 'persoenlich'): GoalSuggestion[] =>
    chosen
      .filter((p) => !visible.has(norm(p)) && (ALL_GOALS[p] ? ALL_GOALS[p].kind === kind : kind === 'beruflich' && isLegacy(p)))
      .map((p) => ({ label: p, top: false }));
  // Getippte Rollen werden erst durch den Klick zum Knopf (dann stehen sie auch bei den Wunschrollen, also in legacy).
  const isChip = (p: string) => !!ALL_GOALS[p] || visible.has(norm(p)) || isLegacy(p);
  const own = chosen.filter((p) => !isChip(p)).join(', ');
  const known = chosen.filter(isChip);
  const toggle = (l: string) => set({ career_ultimate_goal: togglePhrase(text, l) });
  // Eigene Worte verstehen: Wörterbuch, getippte Rolle, gelernte Wendungen, KI als Rückfall.
  const { learned, remember } = useLearnedPhrases(family);
  const goalLearned = learned.filter((l) => (l.side as string) === 'goal');
  const hits = understandGoalWords(own, known, goalLearned);
  const ki = useKiFallback(candidateId, 'goal', own, Object.keys(ALL_GOALS), hits.length, known);
  const allHits: GoalUnderstood[] = [...hits, ...ki.hits];
  const pick = (h: GoalUnderstood) => {
    const patch: Partial<DossierForm> = { career_ultimate_goal: [...known, h.label, ...(own ? [own] : [])].join(', ') };
    // Eine getippte Rolle ist ab jetzt ein Knopf und gleich eine Wunschrolle.
    if (h.isNew && !form.target_roles.some((r) => norm(r) === norm(h.label))) patch.target_roles = [...form.target_roles, h.label];
    set(patch);
    if (h.source === 'ki') remember('goal', h.quote, h.label);
  };
  const setOwn = (v: string) => set({ career_ultimate_goal: [...known, ...(v.trim() ? [v] : [])].join(', ') });
  const row = (title: string, items: GoalSuggestion[]) => (
    <div className="space-y-1">
      <p className="text-xs font-medium">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((g) => {
          const active = isOn(g.label);
          return (
            <button key={g.label} type="button" aria-pressed={active} title={term(g.reason) || undefined} className={chip(active, g.top)} onClick={() => toggle(g.label)}>
              {term(g.label)}
              {g.top && g.reason && <span className={cn('text-[10px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{term(g.reason)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
  const rows = [
    row(t('mot.professional'), [...suggestions.beruflich, ...extra('beruflich')]),
    row(t('mot.personal'), [...suggestions.persoenlich, ...extra('persoenlich')]),
  ];
  return (
    <>
      {/* Immer erst „Beruflich“, dann „Persönlich“ (Wunsch 19.10.). */}
      {rows}
      {ownOpen || own ? (
        <LocalInput id={fieldId('career_ultimate_goal')} value={own} onChange={setOwn} placeholder={t('mot.goalOwnPlaceholder')} />
      ) : (
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setOwnOpen(true)}>{td('fields.ownWords')}</button>
      )}
      {(allHits.length > 0 || ki.loading) && (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-muted-foreground">{allHits.length ? t('mot.understood') : t('mot.understanding')}</p>
          <div className="flex flex-wrap gap-1.5">
            {allHits.map((h) => (
              <button key={h.label} type="button" onClick={() => pick(h)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary px-2 py-0.5 text-left text-primary hover:bg-primary/10">
                „{h.quote}“ → {h.isNew ? t('mot.takeAsGoal', { label: h.label }) : term(h.label)}
                {h.isNew && <span className="rounded bg-success/15 px-1 text-[10px] text-success">{t('mot.newButton')}</span>}
                {h.source !== 'wort' && <span className="rounded bg-primary/10 px-1 text-[10px]">{h.source === 'ki' ? t('mot.ai') : t('mot.learned')}</span>}
                {ALL_GOALS[h.label]?.client === null && <span className="rounded bg-warning/15 px-1 text-[10px] text-warning">{t('mot.neverClient')}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
