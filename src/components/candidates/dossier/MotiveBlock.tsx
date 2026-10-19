import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Eigene Worte neben den Knöpfen. Lokal gehalten, damit beim Tippen nichts springt. */
function OwnWords({ side, text, onChange, placeholder }: { side: MotiveSide; text: string; onChange: (text: string) => void; placeholder: string }) {
  const external = motiveOwnWords(text, side);
  const [value, setValue] = useState(external);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setValue(external); }, [external]);
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
  return (
    <>
      {choices.map((a) => (
        <div key={a.label} className="space-y-1 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <p>„{a.label}“ ist ungenau. Was trifft zu?</p>
          <div className="flex flex-wrap gap-1.5">
            {a.options.map((o) => (
              <button key={o} type="button" onClick={() => onResolve(a.label, [o])} className="rounded-md border border-warning/50 bg-background px-2 py-0.5 text-foreground hover:bg-muted">{o}</button>
            ))}
            <button type="button" onClick={() => onResolve(a.label, a.options)} className="rounded-md border border-warning/50 bg-background px-2 py-0.5 text-foreground hover:bg-muted">Beides</button>
          </div>
          <p>Bis du es klärst, steht dieser Punkt nicht im Kundentext.</p>
        </div>
      ))}
    </>
  );
}

/** Beispiele im leeren Feld: so reden Kandidaten am Telefon. */
const OWN_EXAMPLES: Record<MotiveSide, string> = {
  pos: 'In eigenen Worten, z. B. „tolles Team“ · „kurzer Arbeitsweg“ · „kann viel selbst entscheiden“',
  neg: 'In eigenen Worten, z. B. „Chef mischt sich überall ein“ · „ständig Überstunden“ · „seit der Übernahme alles anders“',
};

const catalogOf = (side: MotiveSide) => (side === 'pos' ? MOTIVE_POS : MOTIVE_NEG);
/** „Führungskraft mischt sich überall ein“ → „mischt sich überall ein“ (unter „Wie genau?“). */
const shortDetail = (label: string) => {
  const t = label.replace(/^Führungskraft /, '');
  return t === label ? `${t.charAt(0).toLowerCase()}${t.slice(1)}` : t;
};

const SOURCE_TAG: Record<Understood['source'], string | null> = { wort: null, gelernt: 'gelernt', ki: 'KI' };

/** Vorschläge aus den eigenen Worten: „Satzteil“ → Knopf, bei ungenauen Knöpfen gleich „Wie genau?“. */
function Understanding({ side, hits, loading, onPick }: { side: MotiveSide; hits: Understood[]; loading: boolean; onPick: (label: string, hit: Understood) => void }) {
  if (!hits.length && !loading) return null;
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-muted-foreground">{hits.length ? 'Verstanden, mit einem Klick übernehmen:' : 'Wird verstanden …'}</p>
      {hits.map((h) => {
        const details = catalogOf(side)[h.label]?.details;
        const tag = SOURCE_TAG[h.source];
        return (
          <div key={h.label} className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => onPick(h.label, h)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary px-2 py-0.5 text-left text-primary hover:bg-primary/10">
              „{h.quote}“ → {h.label}
              {tag && <span className="rounded bg-primary/10 px-1 text-[10px]">{tag}</span>}
            </button>
            {details && (
              <>
                <span className="text-muted-foreground">Wie genau?</span>
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
  return (
    <>
      {choices.map((c) => (
        <div key={c.label} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">„{c.label}“ · Wie genau?</span>
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
 * Der Rest der Auswertung läuft im Hintergrund.
 */
export function MotiveBlock({ form, set, family, candidateId }: { form: DossierForm; set: SetFn; family: RoleFamily; candidateId?: string }) {
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

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Was gefällt Ihnen heute besonders gut?" field="current_positive">
          <p className="-mt-1 text-xs text-muted-foreground">Das muss der neue Job auch bieten, sonst bleibt die Person lieber.</p>
          <MotiveChips options={motiveChipsFor(family, 'pos', form.current_positive)} selected={pos} onToggle={togglePos} />
          <Sentence lines={ev.satzPos} own={ownWordsSentence(motiveOwnWords(form.current_positive, 'pos'))} empty="Der Satz entsteht aus deinen Klicks." />
          <OwnWords side="pos" text={form.current_positive} onChange={(t) => set({ current_positive: t })} placeholder={OWN_EXAMPLES.pos} />
          <Understanding side="pos" hits={[...posHits, ...posKi.hits]} loading={posKi.loading} onPick={(l, h) => pick('pos', l, h)} />
        </Field>
        <Field label="Was gefällt Ihnen weniger? Was stört Sie?" field="current_negative">
          <p className="-mt-1 text-xs text-muted-foreground">Der eigentliche Wechselgrund. Das muss die neue Stelle lösen.</p>
          <MotiveChips options={motiveChipsFor(family, 'neg', form.current_negative)} selected={neg} onToggle={toggleNeg} />
          <DetailChoices choices={motiveDetailChoices(form.current_negative, 'neg')} onPick={(from, to) => { set({ current_negative: replaceMotive(form.current_negative, from, to, 'neg') }); setLastNeg(to); }} />
          <AmbiguousPrompt choices={ambiguousMotives(form.current_negative, 'neg')} onResolve={(legacy, chosen) => set({ current_negative: resolveAmbiguous(form.current_negative, 'neg', legacy, chosen) })} />
          <Sentence lines={ev.satzNeg} own={ownWordsSentence(motiveOwnWords(form.current_negative, 'neg'))} empty="Der Satz entsteht aus deinen Klicks." />
          <OwnWords side="neg" text={form.current_negative} onChange={(t) => set({ current_negative: t })} placeholder={OWN_EXAMPLES.neg} />
          <Understanding side="neg" hits={[...negHits, ...negKi.hits]} loading={negKi.loading} onPick={(l, h) => pick('neg', l, h)} />
        </Field>
      </div>
      {(live?.ask || ev.zuViele) && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {live?.ask && <p><span className="font-medium text-foreground">Nachhaken:</span> {live.ask}</p>}
          {ev.zuViele && <p>Nur die ersten 3 kommen in die Sätze. Zum Umsortieren abwählen und neu antippen.</p>}
        </div>
      )}
    </div>
  );
}

/** Ergänzungsfeld: lokal gehalten, damit beim Tippen nichts springt. */
function AdditionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value); }, [value]);
  return (
    <Input
      id={fieldId('change_motivation')}
      value={v}
      placeholder="Ergänzen (optional), in eigenen Worten"
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
  const weg = motivation.weggelassen.map((l) => `„${l}“`);
  return (
    <Field label="Woher kommt Ihre Wechselmotivation konkret?" field="change_motivation">
      <p className="-mt-1 text-xs text-muted-foreground">Steht so anonym beim Kunden unter „Warum wechseln“.</p>
      {children}
      {frei ? (
        <>
          <AreaField field="change_motivation" value={form.change_motivation} onChange={(v) => set({ change_motivation: v })} rows={3} placeholder="Warum will die Person wechseln?" />
          {gen && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {split.auto ? 'Frei bearbeitbar. Sobald du änderst, zieht nichts mehr mit.' : 'Von dir geschrieben, zieht nicht mehr mit.'}
              <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => { setSelfWrite(false); onRegenerate(); }}>Neu formulieren</Button>
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
                    {p.text} <span className="whitespace-nowrap rounded bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] text-primary">{p.src}</span>
                  </p>
                ))}
                {addition && <p className="text-primary">{addition} <span className="whitespace-nowrap rounded bg-primary/10 px-1.5 py-0.5 align-middle text-[10px]">deine Ergänzung</span></p>}
              </>
            ) : (
              <p className="text-muted-foreground">Entsteht aus deinen Klicks oben.</p>
            )}
          </div>
          {gen && <p className="text-xs text-muted-foreground">Zieht weiter mit. Die blauen Herkunfts-Hinweise siehst nur du, nicht der Kunde.</p>}
          <AdditionInput value={addition} onChange={setAddition} />
          {quote && !addition.includes(quote) && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setAddition(joinMotivation(addition, quote))} className="rounded-md border border-dashed border-primary px-2.5 py-1 text-xs text-primary">
                Zitat übernehmen: „{quote.replace(/\.$/, '')}“
              </button>
            </div>
          )}
        </>
      )}
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {weg.length > 0 && <p>Bewusst nicht drin: {weg.join(', ')}. Kritik an Personen und Gehalt gehen nie zum Kunden.</p>}
        {motivation.ungenau.length > 0 && <p className="text-warning">Noch ungenau, deshalb nicht drin: {motivation.ungenau.map((l) => `„${l}“`).join(', ')}. Oben bei „stört“ klären.</p>}
        {text && !issues.length && <p className="text-success">✓ Geprüft{addition ? ', auch deine Ergänzung' : ''}: kein Name, kein Arbeitgeber, kein Gehalt</p>}
        {issues.map((i) => <p key={i.message} className={i.level === 'danger' ? 'text-destructive' : 'text-warning'}>{i.message}</p>)}
        {!frei && gen && (
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setSelfWrite(true)}>Ganz selbst schreiben</button>
        )}
      </div>
      {motivation.fehltGrund && !addition && (!text || !frei) && (
        <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          {motivation.ohneGrund && weg.length
            ? `${weg.join(', ')} ${weg.length > 1 ? 'stehen' : 'steht'} bewusst nicht im Kundentext. Frag nach dem Grund dahinter oder tippe den Auslöser an, sonst fehlt dem Kunden das Warum.`
            : 'Noch kein Wechselgrund. Frag: „Was gefällt Ihnen weniger? Was stört Sie?“ oder tippe den Auslöser an. Erst dann entsteht der Kundentext.'}
        </p>
      )}
      {kunde && kunde !== text && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Im Kundenprofil (Phase 5) steht ein anderer Text</p>
          <p><span className="text-muted-foreground">Warum wechseln:</span> {kunde}</p>
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
  const [last, setLast] = useState<string | null>(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const text = form.specific_incident;
  const parts = incidentParts(text);
  const times = incidentTimeOptions();
  const fremdeZeit = parts.time && !times.some((t) => t.value === parts.time) ? parts.time : null;
  // „Wann“ und „Wie oft“ nur bei einem echten Anlass; bei „Kein einzelner Anlass“ erübrigen sie sich.
  const hasEvent = incidentHasEvent(text);
  const satz = incidentSentence(text, hasEvent ? form.frequency_of_issues : null);
  const own = ownWordsSentence(parts.own);
  const ask = incidentAsk(last && parts.events.includes(last) ? last : parts.events[0] ?? null);
  const toggle = (label: string) => {
    const next = toggleIncident(text, label);
    set({ specific_incident: next });
    if (incidentParts(next).events.includes(label)) setLast(label);
  };
  return (
    <Field label="Gab es einen konkreten Auslöser? Warum gerade jetzt?" field="specific_incident">
      {children}
      <div className="flex flex-wrap gap-1.5">
        {incidentChipsFor(family, suggestions, text).map((l) => {
          const active = parts.events.includes(l);
          const suggested = suggestions.includes(l);
          return <button key={l} type="button" aria-pressed={active} title={suggested ? 'Passt zu deinen Angaben' : undefined} className={chip(active, suggested)} onClick={() => toggle(l)}>{l}</button>;
        })}
      </div>
      <AmbiguousPrompt choices={ambiguousIncidents(text)} onResolve={(legacy, chosen) => set({ specific_incident: resolveAmbiguousIncident(text, legacy, chosen) })} />
      {hasEvent && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium">Wann?</p>
            <div className="flex flex-wrap gap-1.5">
              {times.map((t) => {
                const active = parts.time === t.value;
                return (
                  <button key={t.value} type="button" aria-pressed={active} className={chip(active)} onClick={() => set({ specific_incident: setIncidentTime(text, t.value) })}>
                    {t.label}
                    {t.month && <span className={cn('text-[10px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{t.month}</span>}
                  </button>
                );
              })}
              {fremdeZeit && <button type="button" aria-pressed className={chip(true)} onClick={() => set({ specific_incident: setIncidentTime(text, fremdeZeit) })}>{fremdeZeit}</button>}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Wie oft?</p>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map((o) => {
                const active = form.frequency_of_issues === o.value;
                return <button key={o.value} type="button" aria-pressed={active} className={chip(active)} onClick={() => set({ frequency_of_issues: active ? null : o.value })}>{o.label}</button>;
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
        <LocalInput id={fieldId('specific_incident')} value={parts.own} onChange={(v) => set({ specific_incident: setIncidentOwn(text, v) })} placeholder="In eigenen Worten (optional)" />
      ) : (
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setOwnOpen(true)}>+ eigene Worte</button>
      )}
      {whyNowNote?.trim() && <p className="text-xs text-muted-foreground">Früher bei „Warum gerade jetzt?“ notiert: {whyNowNote}</p>}
      {ask && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Nachhaken:</span> {ask}</p>}
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
            <button key={g.label} type="button" aria-pressed={active} title={g.reason} className={chip(active, g.top)} onClick={() => toggle(g.label)}>
              {g.label}
              {g.top && g.reason && <span className={cn('text-[10px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{g.reason}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
  const rows = [
    row('Beruflich', [...suggestions.beruflich, ...extra('beruflich')]),
    row('Persönlich', [...suggestions.persoenlich, ...extra('persoenlich')]),
  ];
  return (
    <>
      {/* Immer erst „Beruflich“, dann „Persönlich“ (Wunsch 19.10.). */}
      {rows}
      {ownOpen || own ? (
        <LocalInput id={fieldId('career_ultimate_goal')} value={own} onChange={setOwn} placeholder="In eigenen Worten, z. B. „irgendwann eine Abteilung leiten“ · „bis zur Rente ankommen“ · „Head of Data“" />
      ) : (
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setOwnOpen(true)}>+ eigene Worte</button>
      )}
      {(allHits.length > 0 || ki.loading) && (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-muted-foreground">{allHits.length ? 'Verstanden, mit einem Klick übernehmen:' : 'Wird verstanden …'}</p>
          <div className="flex flex-wrap gap-1.5">
            {allHits.map((h) => (
              <button key={h.label} type="button" onClick={() => pick(h)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary px-2 py-0.5 text-left text-primary hover:bg-primary/10">
                „{h.quote}“ → {h.isNew ? <>{h.label} als Ziel übernehmen</> : h.label}
                {h.isNew && <span className="rounded bg-success/15 px-1 text-[10px] text-success">neuer Knopf</span>}
                {h.source !== 'wort' && <span className="rounded bg-primary/10 px-1 text-[10px]">{h.source === 'ki' ? 'KI' : 'gelernt'}</span>}
                {ALL_GOALS[h.label]?.client === null && <span className="rounded bg-warning/15 px-1 text-[10px] text-warning">nie zum Kunden</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
