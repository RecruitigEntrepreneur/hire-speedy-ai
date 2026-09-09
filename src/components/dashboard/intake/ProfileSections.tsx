import { useMemo, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { type BuiltJob, type FreelanceTerms, type JobType, type RevealSetup, REVEAL_TRIGGER_LABELS } from './types';
import { cn } from '@/lib/utils';
import { frageNach, type Known as KatalogKnown } from '@/lib/briefCatalog';
import { CatalogFields } from './CatalogFields';
import { AlertTriangle, Building2, Coins, Lock, MapPin, Plus, Sparkles, X } from 'lucide-react';

/** Flexibilitätsmatrix: wie hart ist jedes Muss-Kriterium wirklich? */
export type Flexibility = 'fix' | 'negotiable' | 'flexible';
export type FlexibilityMap = Record<string, Flexibility>;

/**
 * Die drei Stufen, in Markos Worten.
 *
 * Sie ersetzen den alten Klick-Zyklus fix -> verhandelbar -> flexibel, der
 * eine 108 Zeichen lange Anleitung brauchte ("klicken Sie das Label, um die
 * Verhandelbarkeit zu setzen"). Drei beschriftete Knoepfe nebeneinander
 * erklaeren sich selbst.
 *
 * Die Abbildung auf die Spalten:
 *   fix        -> must_have_criteria  (Markos "welche 3 Kriterien")
 *   negotiable -> nice_to_haves
 *   flexible   -> trainable_skills    (Markos "was kann nachgeschult werden")
 */
const STUFEN: { wert: Flexibility; label: string }[] = [
  { wert: 'fix', label: 'unverzichtbar' },
  { wert: 'negotiable', label: 'verhandelbar' },
  { wert: 'flexible', label: 'lernbar' },
];

interface Props {
  type: JobType;
  built: BuiltJob;
  onChange: (b: BuiltJob) => void;
  freelance: FreelanceTerms;
  onFreelanceChange: (f: FreelanceTerms) => void;
  reveal: RevealSetup;
  onRevealChange: (r: RevealSetup) => void;
  flexibility: FlexibilityMap;
  onFlexibilityChange: (f: FlexibilityMap) => void;
  /** Vorschlaege der KI: Skills, die zur Rolle gehoeren, aber fehlen. */
  skillSuggestions?: { skill: string; because: string; kind?: 'must' | 'nice' }[];
  /**
   * Die Katalogfelder, die in DIESE Bloecke gehoeren.
   *
   * Monatsgehaelter und Bonus standen 300 px unter dem Gehaltsband, in einem
   * eigenen Kasten -- drei Angaben zur Verguetung an zwei Orten. Dasselbe bei
   * Teamgroesse, Homeoffice-Tagen und Befristung, die unter den Eckdaten
   * haetten stehen muessen. Sie kommen jetzt dorthin, wo sie thematisch
   * hingehoeren.
   */
  catalogKnown?: KatalogKnown;
  onCatalogSet?: (key: string, value: unknown) => void;
  onDismissSuggestion?: (skill: string) => void;
}

function Section({ title, icon: Icon, children, className }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('border-b p-4 last:border-b-0', className)}>
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

/** Ein Vorschlag fuer die Eingabe. Die Quelle steht dran, damit der Kunde
 *  sieht, warum ihm das angeboten wird. */
export interface SkillVorschlag {
  wert: string;
  quelle: 'ad' | 'ai';
  grund?: string;
}

const QUELLE_ETIKETT: Record<SkillVorschlag['quelle'], string> = {
  ad: 'aus der Anzeige',
  ai: 'Vorschlag',
};

/**
 * Die Eingabe fuer ein weiteres Kriterium -- mit Trefferliste beim Tippen.
 *
 * BEFUND (08.09.2026): Das Feld war ein blankes "+ Skill". Was wir ueber die
 * Rolle schon wussten, stand woanders: die Skills aus der Anzeige waren
 * bereits eingetragen oder gar nicht sichtbar, die KI-Vorschlaege in einem
 * Kasten UNTER der Liste. Wer tippte, tippte ins Leere und musste selbst auf
 * die richtige Bezeichnung kommen.
 *
 * Der Kasten darunter bleibt: er ist Entdeckung ("Passt das auch?"), diese
 * Liste hier ist Vervollstaendigung. Zwei verschiedene Vorgaenge -- der eine
 * beantwortet "woran habe ich nicht gedacht", der andere "wie heisst das noch
 * mal bei euch".
 */
function SkillList({
  label, items, onRemove, onAdd, accent, vorschlaege = [],
}: {
  label: string;
  items: string[];
  onRemove: (s: string) => void;
  onAdd: (s: string) => void;
  accent?: boolean;
  vorschlaege?: SkillVorschlag[];
}) {
  const [draft, setDraft] = useState('');
  const [aktiv, setAktiv] = useState(-1);
  const [offen, setOffen] = useState(false);

  const add = (wert?: string) => {
    const v = (wert ?? draft).trim();
    if (v && !items.includes(v)) onAdd(v);
    setDraft('');
    setAktiv(-1);
    setOffen(false);
  };

  // Erst ab dem ersten Zeichen. Ein Feld, das beim Anklicken aufklappt, macht
  // Laerm, bevor der Kunde etwas will.
  const suche = draft.trim().toLowerCase();
  const treffer = suche
    ? vorschlaege
        .filter((v) => v.wert.toLowerCase().includes(suche))
        .filter((v) => !items.some((i) => i.toLowerCase() === v.wert.toLowerCase()))
        .slice(0, 6)
    : [];
  const zeigen = offen && treffer.length > 0;

  const taste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOffen(false); setAktiv(-1); return; }
    if (!zeigen) {
      if (e.key === 'Enter') add();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAktiv((i) => (i + 1) % treffer.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAktiv((i) => (i <= 0 ? treffer.length : i) - 1); }
    // Enter nimmt den markierten Treffer -- oder, wenn keiner markiert ist,
    // genau das Getippte. Wer seinen eigenen Begriff meint, bekommt ihn.
    else if (e.key === 'Enter') { e.preventDefault(); add(aktiv >= 0 ? treffer[aktiv].wert : undefined); }
  };

  return (
    <div className="mb-2">
      <p className="mb-1.5 text-[11px] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((s) => (
          <Badge key={s} variant={accent ? 'default' : 'secondary'} className="gap-1 pr-1">
            {s}
            <button onClick={() => onRemove(s)} aria-label={`${s} entfernen`} className="rounded-full p-0.5 hover:bg-background/20">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setAktiv(-1); setOffen(true); }}
            onKeyDown={taste}
            // Ohne Verzoegerung schliesst der Blur, bevor der Klick ankommt.
            onBlur={() => window.setTimeout(() => setOffen(false), 120)}
            onFocus={() => setOffen(true)}
            placeholder="+ Skill"
            className="h-7 w-36 text-xs"
            role="combobox"
            aria-expanded={zeigen}
            aria-autocomplete="list"
          />
          {draft.trim() && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => add()} aria-label="Skill hinzufügen">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}

          {zeigen && (
            <ul
              role="listbox"
              className="absolute left-0 top-8 z-20 max-h-56 w-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
            >
              {treffer.map((v, i) => (
                <li key={v.wert}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === aktiv}
                    // Blur feuert vor Click -- ohne mouseDown-Abfang geht der
                    // Treffer verloren, den der Kunde gerade anklickt.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setAktiv(i)}
                    onClick={() => add(v.wert)}
                    className={cn(
                      'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                      i === aktiv ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{v.wert}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {QUELLE_ETIKETT[v.quelle]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\D/g, '')) || null);

/** Linke Studio-Spalte: das KI-gefüllte Profil, in Sektionen editierbar. */
export function ProfileSections({
  type, built, onChange, freelance, onFreelanceChange, reveal, onRevealChange, flexibility, onFlexibilityChange,
  skillSuggestions, onDismissSuggestion, catalogKnown, onCatalogSet,
}: Props) {
  const set = (patch: Partial<BuiltJob>) => onChange({ ...built, ...patch });

  // Nie vorschlagen, was schon dasteht -- das Modell weiss nicht immer, was
  // der Kunde in der Zwischenzeit eingetragen hat.
  const vorhanden = new Set(
    [...(built.must_haves ?? []), ...(built.nice_to_haves ?? [])]
      .map((x) => String(x).toLowerCase().trim()),
  );

  /**
   * Ein Vorschlag, der schon dasteht, ist keiner.
   *
   * BEFUND (09.09.2026): Neben "Maschinenbau" schlug das Modell
   * "Expertenwissen Maschinenbau" vor, neben "Personalvermittlung nach AUEG"
   * das ausgeschriebene "Arbeitnehmerueberlassungsgesetz (AUEG)". Geprueft
   * wurde nur gegen die Kriterienliste -- die SKILLS standen nicht im
   * Vergleich, obwohl der Kunde sie direkt daneben sieht.
   *
   * Verglichen wird deshalb gegen beides und mit Enthaltensein statt
   * Gleichheit: "Maschinenbau" steckt in "Expertenwissen Maschinenbau". Erst
   * ab fuenf Zeichen, sonst schluckt ein kurzer Eintrag wie "SAP" jeden
   * Vorschlag, der ihn zufaellig enthaelt. Was das Modell trotzdem
   * durchlaesst -- dasselbe mit anderen Worten -- faengt nur der Prompt.
   */
  const schonDa = [
    ...(built.must_haves ?? []), ...(built.nice_to_haves ?? []), ...(built.skills ?? []),
  ].map((x) => String(x ?? '').toLowerCase().trim()).filter(Boolean);

  const istDoppelt = (roh: string) => {
    const n = String(roh ?? '').toLowerCase().trim();
    if (!n) return true;
    return schonDa.some((v) =>
      v === n
      || (v.length >= 5 && n.includes(v))
      || (n.length >= 5 && v.includes(n)));
  };

  const vorschlaege = (skillSuggestions ?? [])
    .filter((v) => v?.skill && !istDoppelt(v.skill))
    .slice(0, 6);

  /**
   * Was die Eingabe beim Tippen anbieten kann -- alles rollenspezifisch.
   *
   * Zuerst, was der Parser in DIESER Anzeige gefunden hat und noch nicht in
   * der Liste steht. Danach die Vorschlaege des Modells. Eine allgemeine
   * Skill-Datenbank steht bewusst nicht dahinter: die einzige verfuegbare
   * (skill_synonyms, 113 Zeilen) ist reine IT, und der Matcher uebersetzt
   * ohnehin selbst ueber dieselbe Tabelle -- die Schreibweise zu treffen
   * aendert am Ergebnis nichts.
   */
  const eingabeVorschlaege = useMemo<SkillVorschlag[]>(() => {
    const gesehen = new Set(vorhanden);
    const raus: SkillVorschlag[] = [];
    const nimm = (wert: unknown, quelle: SkillVorschlag['quelle'], grund?: string) => {
      const w = String(wert ?? '').trim();
      const k = w.toLowerCase();
      if (!w || gesehen.has(k)) return;
      gesehen.add(k);
      raus.push({ wert: w, quelle, grund });
    };
    for (const s of built.skills ?? []) nimm(s, 'ad');
    for (const v of skillSuggestions ?? []) {
      if (!istDoppelt(v?.skill ?? '')) nimm(v?.skill, 'ai', v?.because);
    }
    return raus;
  }, [built.skills, skillSuggestions, built.must_haves, built.nice_to_haves]);
  const isFreelance = type === 'freelance';

  /**
   * EINE Liste. Muss- und Kann-Kriterien werden zusammengefuehrt -- welche
   * Rolle ein Kriterium spielt, sagt jetzt sein Zustand, nicht die Liste, in
   * der es steht.
   */
  const kriterien = useMemo(() => {
    const alle = [...(built.must_haves ?? []), ...(built.nice_to_haves ?? [])];
    return [...new Map(alle.map((s) => [String(s).trim(), String(s).trim()])).values()].filter(Boolean);
  }, [built.must_haves, built.nice_to_haves]);

  /** Die Katalogfelder eines Ortes, direkt im passenden Block. */
  const katalog = (place: 'eckdaten' | 'verguetung' | 'skills') =>
    catalogKnown && onCatalogSet ? (
      <div className="mt-3 space-y-3 border-t pt-3">
        <CatalogFields
          place={place}
          known={catalogKnown}
          onSet={onCatalogSet}
          contract={type}
          mustHaves={built.must_haves ?? []}
        />
      </div>
    ) : null;

  /** Markos Wortlaut fuer diesen Block -- aus dem Katalog, nicht abgetippt. */
  const frageSkills = frageNach('kriterien');

  const nach = (w: Flexibility) => kriterien.filter((s) => flexibility[s] === w);
  const unverzichtbar = nach('fix');
  const verhandelbar = nach('negotiable');
  const lernbar = nach('flexible');
  const unmarkiert = kriterien.filter((s) => !flexibility[s]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-4 pb-3">
        <Badge variant="outline" className="mb-2 gap-1 text-xs">
          <Sparkles className="h-3 w-3 text-primary" /> KI-Entwurf · alles editierbar
        </Badge>
        {/* Kein zweiter Titel. Die Ueberschrift steht oben in CaptureStep;
            hier stand sie 120 px tiefer ein zweites Mal, fett und nur 2 px
            kleiner -- der Blick konnte nicht entscheiden, welche gilt, und
            aenderbar war ausgerechnet die kleinere, tiefere. Das Feld bleibt
            editierbar, sieht aber wie ein Feld aus. */}
        <Input
          data-feld="title"
          value={built.title}
          onChange={(e) => set({ title: e.target.value })}
          className="h-8 text-sm"
          placeholder="Jobtitel"
        />
      </div>

      <Section title="Eckdaten" icon={MapPin}>
        <div className="grid grid-cols-2 gap-2">
          <Input value={built.location} onChange={(e) => set({ location: e.target.value })} placeholder="Standort" className="h-8 text-xs" />
          <Select value={built.remote_type || 'hybrid'} onValueChange={(v) => set({ remote_type: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">Vor Ort</SelectItem>
            </SelectContent>
          </Select>
          <Select value={built.experience_level || 'mid'} onValueChange={(v) => set({ experience_level: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="mid">Mid-Level</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
            </SelectContent>
          </Select>
          <Input value={built.industry} onChange={(e) => set({ industry: e.target.value })} placeholder="Branche" className="h-8 text-xs" />
        </div>
        {katalog('eckdaten')}
      </Section>

      <Section title={isFreelance ? 'Konditionen (Contracting)' : 'Vergütung'} icon={Coins}>
        {isFreelance ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              data-feld="day_rate_range"
              value={freelance.dayRateMin ?? ''}
              onChange={(e) => onFreelanceChange({ ...freelance, dayRateMin: numOrNull(e.target.value) })}
              placeholder="Tagessatz von (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Input
              value={freelance.dayRateMax ?? ''}
              onChange={(e) => onFreelanceChange({ ...freelance, dayRateMax: numOrNull(e.target.value) })}
              placeholder="Tagessatz bis (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Input
              data-feld="contract_duration_months"
              value={freelance.durationMonths ?? ''}
              onChange={(e) => onFreelanceChange({ ...freelance, durationMonths: numOrNull(e.target.value) })}
              placeholder="Dauer (Monate)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Select
              value={String(freelance.utilizationDaysPerWeek ?? '')}
              onValueChange={(v) => onFreelanceChange({ ...freelance, utilizationDaysPerWeek: Number(v) })}
            >
              <SelectTrigger data-feld="utilization_days_per_week" className="h-8 text-xs">
                <SelectValue placeholder="Auslastung" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} Tage/Woche</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={freelance.extensionPossible}
                onChange={(e) => onFreelanceChange({ ...freelance, extensionPossible: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              Verlängerung möglich
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Input
              data-feld="salary_range"
              value={built.salary_min ?? ''}
              onChange={(e) => set({ salary_min: numOrNull(e.target.value) })}
              placeholder="Gehalt von (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Input
              value={built.salary_max ?? ''}
              onChange={(e) => set({ salary_max: numOrNull(e.target.value) })}
              placeholder="Gehalt bis (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
          </div>
        )}
        {katalog('verguetung')}
      </Section>

      {/*
        EINE Liste, ein Zustand je Zeile.
        BEFUND (05.09.2026): Dieselben Skills standen dreimal auf einem
        Bildschirm -- als Badge mit Verhandelbarkeits-Pille hier, und 300 px
        tiefer noch einmal als Chips unter "Die drei, ohne die es nicht geht"
        und "Was kann nachgeschult werden?". Vier Konzepte, die dasselbe
        meinen, an drei Stellen.
        Markos beide Fragen sind EINE Achse: unverzichtbar = eines der drei
        fuer den Direkteinsatz, verhandelbar = nice to have, lernbar = kann
        nachgeschult werden. Wer hier klickt, beantwortet beide, ohne dass sie
        noch einmal gestellt werden muessen.
        Der Standardzustand ist bewusst UNMARKIERT und leise. Vorher war er
        'fix' und zugleich die lauteste Marke der Spalte -- sieben Kriterien
        standen auf "unverzichtbar", ohne dass es jemand gesagt hatte. Genau
        diese Wunschliste soll Markos Frage aufbrechen.
      */}
      <Section title="Anforderungen" icon={Sparkles}>
        {/* Der Wortlaut kommt aus dem Katalog, nicht aus diesem Bauteil.
            Vorher stand Markos Frage hier als Literal im JSX -- zwei
            Wahrheiten fuer denselben Satz, und wer den Katalog aendert,
            aendert den Bildschirm nicht mit. */}
        <p className="mb-3 text-sm">{frageSkills?.kurz}</p>

        <div className="mb-3 space-y-1.5">
          {kriterien.map((s) => {
            const flex = flexibility[s];
            return (
              <div key={s} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{s}</span>
                <div className="flex shrink-0 gap-1">
                  {STUFEN.map(({ wert, label }) => (
                    <button
                      key={wert}
                      type="button"
                      onClick={() =>
                        onFlexibilityChange({
                          ...flexibility,
                          // Nochmal klicken hebt die Markierung auf -- ohne das
                          // waere ein Fehlgriff nicht zuruecknehmbar.
                          [s]: flex === wert ? undefined : wert,
                        } as FlexibilityMap)
                      }
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs transition-colors',
                        flex === wert
                          ? 'border-foreground/40 bg-foreground/10 font-medium text-foreground'
                          : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    set({
                      must_haves: built.must_haves.filter((x) => x !== s),
                      nice_to_haves: (built.nice_to_haves ?? []).filter((x) => x !== s),
                    });
                    const rest = { ...flexibility };
                    delete rest[s];
                    onFlexibilityChange(rest);
                  }}
                  aria-label={`${s} entfernen`}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <SkillList
          label="Kriterium hinzufügen"
          // Leer, nicht die Kriterienliste: die steht schon darueber. `items`
          // rendert Badges -- gefuellt stuende jedes Kriterium zweimal da.
          // Doppelte fangt eingabeVorschlaege selbst ab.
          items={[]}
          onRemove={() => undefined}
          onAdd={(s) => set({ must_haves: [...built.must_haves, s] })}
          vorschlaege={eingabeVorschlaege}
        />

        {/* Vorschlaege der KI. Bewusst darunter und zurueckhaltend: es sind
            Angebote, keine Behauptungen. Jeder traegt seine Begruendung bei
            sich -- eine Liste unbegruendeter Woerter waere Raten. */}
        {vorschlaege.length > 0 && (
          <div className="mb-2 rounded-lg border border-dashed p-2.5">
            <p className="mb-1.5 text-xs text-muted-foreground">Passt das auch? Ein Klick übernimmt es.</p>
            <div className="flex flex-wrap gap-1.5">
              {vorschlaege.map((v) => (
                <button
                  key={v.skill}
                  type="button"
                  title={v.because}
                  onClick={() => {
                    set({ must_haves: [...(built.must_haves ?? []), v.skill] });
                    onDismissSuggestion?.(v.skill);
                  }}
                  className="rounded-full border border-input bg-secondary/60 px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                >
                  + {v.skill}
                  <span className="ml-1.5 text-muted-foreground">{v.because}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zaehlt jetzt nur noch, was der Kunde WIRKLICH als unverzichtbar
            markiert hat. Vorher zaehlte sie built.must_haves -- also alles,
            was der Parser aus der Anzeige geworfen hatte. */}
        {unverzichtbar.length >= 8 && (
          <p className="mb-2 flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {unverzichtbar.length} unverzichtbare Kriterien — ab 8 schrumpft der erreichbare
            Markt erheblich. Welche zwei sind ehrlich verhandelbar?
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {unverzichtbar.length} unverzichtbar · {verhandelbar.length} verhandelbar ·{' '}
          {lernbar.length} lernbar
          {unmarkiert.length > 0 && ` · ${unmarkiert.length} nicht eingestuft`}
        </p>
        {/* KEIN katalog('skills') hier: die Zeilen must_have_criteria und
            trainable_skills beantwortet die Einstufung oben (unverzichtbar /
            verhandelbar / lernbar). Sie zusaetzlich als Chip-Reihen zu
            rendern brachte Markos lange Telefonfrage samt Vorspann zurueck --
            genau die Doppelung, die dieser Block aufloesen sollte. */}
      </Section>

      {/*
        Der Reveal-Ausloeser stand hier als Auswahl fuer den Kunden -- und war
        FOLGENLOS: `reveal_trigger` wird in die jobs-Zeile geschrieben und ins
        Formular zurueckgelesen, aber an keiner Stelle ausgewertet. Kein
        Trigger, keine View, keine Function liest ihn.
        Was tatsaechlich aufdeckt, ist die Interview-Zusage des Kandidaten mit
        aktiver, protokollierter Einwilligung -- process-interview-response
        setzt identity_unlocked, company_revealed und consent_confirmed in
        einem Zug, und nur wenn consentGiven === true.
        Das ist eine Plattformregel wie das Honorar, keine Kundenoption. Eine
        Auswahl anzubieten, die nichts bewirkt, verspricht Kontrolle, die es
        nicht gibt.
        Der anonyme Descriptor wird weiterhin automatisch erzeugt und wandert
        in reveal_envelope. Er gehoert als Bestaetigungszeile in die Aufnahme,
        nicht als Eingabefeld: wer ihn selbst formuliert, baut versehentlich
        seine eigene De-Anonymisierung ein ("Marktfuehrer fuer X in Y").
      */}
    </div>
  );
}
