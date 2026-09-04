import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IntakeBriefing, type Answers, type BriefBuilt, type JobType } from '../IntakeBriefing';
import { EMPTY_CATALOG_STATE, type CatalogState } from '@/lib/briefCatalog';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Check, CheckCircle2, Circle, CircleDashed, HelpCircle, Loader2, Sparkles, ChevronDown } from 'lucide-react';

export interface DynQuestion {
  id: string;
  chapter: string;
  question: string;
  why?: string;
  chips: string[];
  /** Die Frage verlangt eine Aufzaehlung -- mehrere Chips duerfen zugleich
   *  gelten. Ohne das nimmt die Oberflaeche bei "welche 3 Hauptaufgaben"
   *  genau eine Antwort und wirft zwei Drittel der Auskunft weg. */
  multi?: boolean;
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
  /** Skills, die zur Rolle passen, aber noch nicht im Profil stehen.
   *  Vorschlaege zum Anklicken -- der Kunde entscheidet, nicht die KI. */
  skillSuggestions: { skill: string; because: string; kind?: 'must' | 'nice' }[];
  payloadPatch: Record<string, unknown>;
  envelopePatch: Record<string, unknown>;
  tensionFlags: TensionFlag[];
  done: boolean;
  /**
   * Der Zustand des katalog-gefuehrten Briefings (CatalogBriefing).
   *
   * Er haengt hier drin und nicht in einer eigenen Entwurfsspalte, weil
   * intake-draft `dyn` bereits als Ganzes speichert -- CONTENT_FIELDS
   * enthaelt es. Eine neue Spalte haette eine Migration gebraucht, um
   * dasselbe zu erreichen.
   */
  catalog?: CatalogState;
}

/**
 * Reservefragen.
 *
 * Der Kunde soll nie auf die KI warten. "KI waehlt die naechste wichtige
 * Frage..." mit Spinner stand am Anfang und immer dann wieder da, wenn die
 * Warteschlange leerlief -- eine Wartezeit an der schlechtesten Stelle:
 * direkt nachdem er etwas getan hat.
 *
 * Diese Fragen passen IMMER und stehen in keiner Stellenanzeige -- die KI
 * kann sie also nie aus dem Entwurf beantworten. Es ist genau das, was der
 * Recruiter im Kandidatengespraech braucht: warum die Stelle offen ist, wer
 * entscheidet, wie lang der Prozess ist, wann gestartet wird. Der Kunde
 * beantwortet eine davon, waehrend die KI im Hintergrund weiterwaehlt --
 * und seine Antwort geht in deren Auswahl mit ein.
 *
 * Doppelfragen sind ausgeschlossen: die Antwort steht mit Fragetext in
 * `answers` und die id in `asked_ids`, beides sieht die KI in ihrem Prompt.
 */
const RESERVEFRAGEN: DynQuestion[] = [
  {
    id: 'why_open',
    chapter: 'Rolle & Scope',
    question: 'Warum ist die Stelle offen?',
    why: 'Bestimmt Story, Dringlichkeit und Risiko-Profil — und steht in keiner Anzeige.',
    chips: ['Wachstum / neu geschaffen', 'Nachbesetzung', 'Ablösung', 'Elternzeit-Vertretung'],
  },
  {
    id: 'hiring_decider',
    chapter: 'Prozess & Entscheider',
    question: 'Wer trifft am Ende die Einstellungsentscheidung?',
    why: 'Wer das weiß, argumentiert im Gespräch auf die richtige Person hin.',
    chips: ['Fachbereich allein', 'Geschäftsführung', 'Fachbereich und HR gemeinsam', 'Team-Konsens'],
  },
  {
    id: 'process_steps',
    chapter: 'Prozess & Entscheider',
    question: 'Wie viele Gespräche bis zur Zusage?',
    why: 'Kandidaten fragen als Erstes danach — und lange Prozesse kosten die Guten.',
    chips: ['1 Gespräch', '2 Gespräche', '3 Gespräche', 'Mehr als 3'],
  },
  {
    id: 'start_when',
    chapter: 'Timing & Vertrag',
    question: 'Wann soll die Person spätestens anfangen?',
    why: 'Entscheidet, ob gekündigte oder nur langfristig verfügbare Kandidaten passen.',
    chips: ['So schnell wie möglich', 'In 1–3 Monaten', 'In 3–6 Monaten', 'Zeitlich flexibel'],
  },
  {
    id: 'onsite_days',
    chapter: 'Arbeitsmodell & Kultur',
    question: 'Wie viele Tage pro Woche vor Ort sind Pflicht?',
    why: 'Hartes Ausschlusskriterium — und der häufigste Absagegrund im Endspurt.',
    chips: ['5 Tage', '3–4 Tage', '1–2 Tage', 'Frei wählbar / remote'],
  },
  {
    id: 'team_size',
    chapter: 'Rolle & Scope',
    question: 'Wie groß ist das Team, in das die Person kommt?',
    why: 'Ein Alleinkämpfer-Job braucht einen anderen Menschen als eine Rolle im 15er-Team.',
    chips: ['Alleinstellung', '2–5 Personen', '6–15 Personen', 'Mehr als 15'],
  },
  {
    id: 'deal_breaker',
    chapter: 'Muss & Kann & Anti-Profil',
    question: 'Was führt bei Ihnen fast sicher zur Absage?',
    why: 'Erspart beiden Seiten Gespräche, die von vornherein nicht enden können.',
    chips: ['Häufige Jobwechsel', 'Fehlende Branchenerfahrung', 'Zu wenig Deutsch', 'Gehaltsvorstellung zu hoch'],
  },
];

/**
 * Die KI liefert gelegentlich selbst einen Chip "Weiss ich nicht" -- daneben
 * steht der feste Knopf mit derselben Beschriftung, und der Kunde sieht die
 * Auswahl doppelt. Nur der feste zaehlt: er schreibt __unknown__ und markiert
 * das Kapitel als uebersprungen.
 */
const UNBEKANNT = /^(weiss|weiß)ichnicht$|^keineangabe$|^unbekannt$|^unklar$/;
const istEigeneAntwortNoetig = (chip: string) =>
  !UNBEKANNT.test(chip.toLowerCase().replace(/[^a-zäöüß]/g, ''));

export const EMPTY_DYN_STATE: DynState = {
  available: null,
  answers: [],
  askedIds: [],
  completeness: 0,
  chapterProgress: [],
  typedFields: {},
  skillRequirements: [],
  skillSuggestions: [],
  payloadPatch: {},
  envelopePatch: {},
  tensionFlags: [],
  done: false,
  catalog: EMPTY_CATALOG_STATE,
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
  /**
   * Wie die KI erreicht wird. Ohne diese Prop läuft der Dashboard-Weg:
   * supabase.functions.invoke('intake-questions') mit dem JWT des Kunden.
   * Die login-freie Aufnahme reicht hier den token-geprüften Proxy herein —
   * dieselbe Komponente, dieselben Fragen, ein anderer Transportweg.
   */
  askAi?: (payload: {
    contract_type: JobType;
    job_draft: Record<string, unknown>;
    answers: DynAnswered[];
    asked_ids: string[];
    max_questions: number;
  }) => Promise<Record<string, any>>;
}

const stateIcon = (s: string) =>
  s === 'done' ? CheckCircle2 : s === 'partial' ? CircleDashed : Circle;

/**
 * Voll-KI-dynamisches Briefing (intake-questions, stateless): nach jeder
 * Antwort entscheidet die KI die nächste Frage, normalisiert Felder und meldet
 * Zielkonflikte. Ist die Function nicht erreichbar (noch nicht deployed),
 * fällt die Komponente transparent auf das statische IntakeBriefing zurück.
 */
export function DynamicBriefing({ type, jobDraft, state, onState, onMoveSkillToNice, onDone, fallback, askAi }: Props) {
  const [queue, setQueue] = useState<DynQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  // Laufende Nummer je Anfrage. Beantwortet der Kunde die Startfrage, waehrend
  // schon eine Anfrage unterwegs ist, kennt diese seine Antwort nicht -- traefe
  // sie spaeter ein, wuerde sie das Richtige ueberschreiben. Nur die zuletzt
  // gestartete Anfrage darf ihr Ergebnis anwenden.
  const anfrageNr = useRef(0);
  const laeuft = useRef(false);
  const reserveAktiv = useRef<DynQuestion | null>(null);
  const [freeText, setFreeText] = useState('');
  // Angeklicktes bei Mehrfachfragen. Erst der Knopf "Weiter" sendet.
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [kapitelOffen, setKapitelOffen] = useState(false);
  const [dismissedFlags, setDismissedFlags] = useState<string[]>([]);
  const probing = useRef(false);

  const fetchNext = useCallback(
    async (answers: DynAnswered[], askedIds: string[]) => {
      const meine = ++anfrageNr.current;
      laeuft.current = true;
      setLoading(true);
      try {
        const request = {
          contract_type: type,
          job_draft: jobDraft,
          answers,
          asked_ids: askedIds,
          max_questions: 3,
        };
        let data: Record<string, any> | null;
        if (askAi) {
          data = await askAi(request);
        } else {
          const res = await supabase.functions.invoke('intake-questions', { body: request });
          if (res.error) throw res.error;
          data = res.data as Record<string, any> | null;
        }
        if (!data || data.error) throw new Error(data?.error || 'no data');
        if (meine !== anfrageNr.current) return;   // ueberholt

        onState((prev) => ({
          ...prev,
          available: true,
          completeness: data.weighted_completeness ?? prev.completeness,
          chapterProgress: data.chapter_progress?.length ? data.chapter_progress : prev.chapterProgress,
          typedFields: { ...prev.typedFields, ...(data.typed_fields || {}) },
          skillRequirements: data.skill_requirements?.length ? data.skill_requirements : prev.skillRequirements,
          // Vorschlaege werden ERSETZT, nicht ergaenzt: was der Kunde
          // uebernommen oder abgelehnt hat, soll nicht wiederkommen.
          skillSuggestions: Array.isArray(data.skill_suggestions) ? data.skill_suggestions : [],
          payloadPatch: { ...prev.payloadPatch, ...(data.intake_payload_patch || {}) },
          envelopePatch: { ...prev.envelopePatch, ...(data.reveal_envelope_patch || {}) },
          tensionFlags: data.tension_flags || [],
          done: (data.next_questions || []).length === 0,
        }));
        // ERGAENZEN, nicht ersetzen: nachgeladen wird schon, waehrend noch eine
        // Frage offen ist -- ein Ersetzen wuerde die verschlucken. Und nichts
        // wieder aufmachen, was schon beantwortet oder schon in der Schlange
        // steht.
        setQueue((prev) => [
          ...prev,
          ...(data!.next_questions || []).filter(
            (q: DynQuestion) =>
              !askedIds.includes(q.id) && !prev.some((p) => p.id === q.id)),
        ]);
      } catch (e) {
        if (meine !== anfrageNr.current) return;
        console.warn('intake-questions nicht erreichbar — statisches Briefing als Fallback:', e);
        onState((prev) => ({ ...prev, available: false }));
      } finally {
        if (meine === anfrageNr.current) {
          laeuft.current = false;
          setLoading(false);
        }
      }
    },
    [type, jobDraft, onState, askAi],
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

  // Solange die KI laedt und noch nichts beantwortet wurde, steht die
  // Startfrage da. Sie ist eine echte Frage, keine Beschaeftigung: ihre
  // Antwort geht in die naechste Auswahl der KI ein.
  // Laeuft die Warteschlange leer, waehrend die KI noch waehlt, springt eine
  // Reservefrage ein statt eines Spinners. Einmal gezeigt, bleibt sie stehen,
  // bis sie beantwortet ist -- sonst tauscht die eintreffende KI-Antwort dem
  // Kunden die Frage unter der Hand aus, waehrend er sie noch liest.
  if (!reserveAktiv.current && queue.length === 0 && !state.done) {
    reserveAktiv.current = RESERVEFRAGEN.find((q) => !state.askedIds.includes(q.id)) ?? null;
  }
  const current = reserveAktiv.current ?? queue[0] ?? null;

  const answer = (text: string) => {
    if (!current) return;
    const entry: DynAnswered = { id: current.id, chapter: current.chapter, question: current.question, answer: text };
    const answers = [...state.answers, entry];
    const askedIds = [...state.askedIds, current.id];
    onState((prev) => ({ ...prev, answers, askedIds }));
    setFreeText('');
    setGewaehlt([]);
    // Die Reservefrage steht neben der Warteschlange, nicht darin -- ihre
    // Antwort darf keine bereits geholte Frage verschlucken.
    const rest = (reserveAktiv.current ? queue : queue.slice(1)).filter((q) => q.id !== current.id);
    reserveAktiv.current = null;
    setQueue(rest);
    // Nachladen, BEVOR die Schlange leer ist: eine Anfrage dauert rund zehn
    // Sekunden, ein Klick auf einen Chip zwei. Wer erst beim letzten Eintrag
    // anfragt, laesst den Kunden warten. Mit dem Nachladen bei einer
    // verbleibenden Frage ueberlappt die Wartezeit mit dem Antworten.
    if (rest.length <= 1 && !laeuft.current) void fetchNext(answers, askedIds);
  };

  /** Auswahl und Freitext zu EINER Antwort zusammenfuehren. Beides zugleich
   *  ist der Normalfall: zwei Chips treffen zu, das Dritte tippt der Kunde. */
  const absenden = () => {
    const teile = [...gewaehlt];
    if (freeText.trim()) teile.push(freeText.trim());
    if (teile.length === 0) return;
    answer(teile.join(' · '));
  };

  /**
   * Spannungswarnungen sind vorerst abgeschaltet.
   *
   * Grund ist nicht die Form, sondern die Grundlage: das Modell bekommt als
   * Eingabe nur den Stellenentwurf, die bisherigen Antworten und die Liste
   * gestellter Frage-IDs -- kein Gehaltsband, keinen Marktvergleich, keine
   * Zahl aus unseren eigenen Vermittlungen. "140-160k koennte knapp sein" ist
   * damit Weltwissen eines Sprachmodells, das der Kunde als Marktauskunft
   * seines Dienstleisters liest.
   *
   * Die Daten bleiben erhalten (tension_flags kommt weiter aus der Function),
   * nur die Anzeige ruht. Wieder einschalten heisst: diese Konstante auf true.
   * Sinnvoll, sobald die Aussage auf ausgewerteten Placements steht statt auf
   * Modellgefuehl -- oder mit sichtbarer Kennzeichnung der Herkunft.
   */
  const ZEIGE_SPANNUNGEN = false;
  const visibleFlags = ZEIGE_SPANNUNGEN
    ? state.tensionFlags.filter((f) => !dismissedFlags.includes(f.id))
    : [];

  return (
    <div className="space-y-3">
      {/* Kapitel-Fortschritt */}
      {/* Fortschritt in EINER Zeile.
          Vorher: elf Zeilen mit Symbol und Kapitelnamen -- mehr Platz fuer die
          Orientierung als fuer die Frage, um die es geht. Die Kapitelnamen
          sagen dem Kunden auch wenig; was zaehlt, ist wie weit er ist und wo
          er gerade steht. Wer die Liste sehen will, klappt sie auf. */}
      {state.chapterProgress.length > 0 && (
        <div className="rounded-xl border bg-card px-3 py-2">
          <button
            type="button"
            onClick={() => setKapitelOffen((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <span className="text-xs font-medium text-muted-foreground">
              Briefing · {state.completeness}%
            </span>
            {current?.chapter && (
              <span className="truncate text-xs text-foreground">{current.chapter}</span>
            )}
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
              {state.chapterProgress.filter((c) => c.state === 'done').length}/
              {state.chapterProgress.length}
              <ChevronDown className={cn('h-3 w-3 transition-transform', kapitelOffen && 'rotate-180')} />
            </span>
          </button>

          {/* Ein Segment je Kapitel. Der Name steht im title -- sichtbar auf
              Wunsch, nicht dauerhaft im Weg. */}
          <div className="mt-1.5 flex gap-0.5">
            {state.chapterProgress.map((c) => (
              <span
                key={c.chapter}
                title={`${c.chapter} — ${
                  c.state === 'done' ? 'vollständig'
                  : c.state === 'partial' ? 'teilweise'
                  : c.state === 'skipped' ? 'übersprungen' : 'offen'}`}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  c.state === 'done' ? 'bg-emerald-500'
                  : c.state === 'partial' ? 'bg-primary'
                  : c.state === 'skipped' ? 'bg-muted-foreground/20'
                  : 'bg-muted',
                )}
              />
            ))}
          </div>

          {kapitelOffen && (
            <div className="mt-2 space-y-0.5 border-t pt-2">
              {state.chapterProgress.map((c) => {
                const Icon = stateIcon(c.state);
                return (
                  <div key={c.chapter} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        c.state === 'done' ? 'text-emerald-500'
                        : c.state === 'partial' ? 'text-primary'
                        : 'text-muted-foreground/40',
                      )}
                    />
                    <span className={cn(c.state === 'skipped' && 'line-through opacity-60')}>{c.chapter}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tension-Flags */}
      {visibleFlags.map((f) => (
        <div key={f.id} className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Spannung erkannt
          </p>
          {/* Zwei Zeilen, nicht ein Absatz. Vorher standen message und
              suggestion aneinandergeklebt -- gemessen 58 Woerter am Stueck,
              die kein Kunde liest. Erst die Spannung, dann der Hebel. */}
          <p className="mb-1 text-xs text-muted-foreground">{f.message}</p>
          {f.suggestion && (
            <p className="mb-2 flex gap-1.5 text-xs text-foreground">
              <span className="text-amber-600">→</span>
              <span>{f.suggestion}</span>
            </p>
          )}
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
            {current.chips.filter(istEigeneAntwortNoetig).map((chip) => {
              // h-8 und die feste Hoehe stammten aus der Zeit der statischen
              // Chips: kurze Woerter wie "Wachstum / neu". Die KI schreibt
              // ganze Saetze -- gemessen liefen sie 83 bis 139 Pixel ueber den
              // Rand, der Kunde konnte nicht lesen, was er anklickt.
              // max-w-full bricht die Flex-Regel, dass ein Element nicht unter
              // seine Inhaltsbreite schrumpft.
              const an = gewaehlt.includes(chip);
              return (
                <Button
                  key={chip}
                  size="sm"
                  variant="outline"
                  className={cn(
                    'h-auto max-w-full whitespace-normal rounded-xl py-1.5 text-left text-xs leading-snug',
                    an && 'border-primary bg-primary/10 text-foreground',
                  )}
                  onClick={() =>
                    current.multi
                      // Umschalten statt senden: bei einer Aufzaehlung ist die
                      // erste Auswahl selten die ganze Antwort.
                      ? setGewaehlt((v) => (v.includes(chip) ? v.filter((x) => x !== chip) : [...v, chip]))
                      : answer(chip)
                  }
                >
                  {an && <Check className="mr-1 h-3 w-3 shrink-0" />}
                  {chip}
                </Button>
              );
            })}
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
              onKeyDown={(e) => e.key === 'Enter' && (freeText.trim() || gewaehlt.length) && absenden()}
              placeholder={current.multi ? 'Ergänzen …' : 'Eigene Antwort …'}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!freeText.trim() && gewaehlt.length === 0}
              onClick={absenden}
            >
              {current.multi ? `Weiter${gewaehlt.length ? ` (${gewaehlt.length})` : ''}` : 'OK'}
            </Button>
          </div>
          {current.why && (
            <p className="mt-2 text-[11px] text-muted-foreground">💡 {current.why}</p>
          )}
        </div>
      ) : state.done ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium">Briefing vollständig.</p>
          <p className="text-xs text-muted-foreground">
            Sie können die Stelle jetzt unten übergeben.
          </p>
        </div>
      ) : null}
    </div>
  );
}
