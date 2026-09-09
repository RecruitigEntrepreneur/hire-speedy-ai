import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ProfileSections, type FlexibilityMap } from '@/components/dashboard/intake/ProfileSections';
import { CompanyBlock, type CompanyDraft, type Anreicherung } from './CompanyBlock';
import { BenefitsBlock } from './BenefitsBlock';
import { DynamicBriefing, EMPTY_DYN_STATE, type DynState } from '@/components/dashboard/intake/DynamicBriefing';
import { CatalogBriefing } from '@/components/dashboard/intake/CatalogBriefing';
import { CatalogFields } from '@/components/dashboard/intake/CatalogFields';
import { CollapsibleGroup } from './CollapsibleGroup';
import { ContractKindStep, ContractKindDeclined } from './ContractKindStep';
import {
  EMPTY_CATALOG_STATE, blockingGaps, completeness as katalogCompleteness, knownFromForm,
  ungepruefte, slotLabel, slotChipWert, slotChips,
  sizeBand, type SlotState,
} from '@/lib/briefCatalog';
import { QualityCheck } from '@/components/dashboard/intake/QualityCheck';
import {
  briefingProgress, openBriefingQuestions, prefillFromBuilt, serializeBriefing, type Answers,
} from '@/components/dashboard/IntakeBriefing';
import { EMPTY_FREELANCE, type BuiltJob, type FreelanceTerms, type RevealSetup } from '@/components/dashboard/intake/types';
import {
  EMPTY_BUILT, buildAiJobDraft, catalogFromParsed, flexibilityFromParsed,
  freelanceFromParsed, fromParsedJobData,
  toBriefBuilt, typedFieldsFromParsed,
} from '@/lib/intakeMapping';
import { isFailure } from '@/hooks/useGuestIntake';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowLeft, ArrowRight, FileText, FileUp, Link2, Loader2, Sparkles } from 'lucide-react';

/**
 * Die Aufnahme selbst — dieselben Bausteine wie im Dashboard-Studio.
 *
 * ProfileSections, DynamicBriefing, QualityCheck und der 36-Fragen-Katalog aus
 * IntakeBriefing werden unverändert wiederverwendet; sie greifen weder auf
 * useAuth noch direkt auf Supabase zu. Der einzige Unterschied ist der Weg zur
 * KI: statt supabase.functions.invoke('intake-questions') mit dem JWT des
 * Kunden läuft hier der token-geprüfte Proxy (askAi-Prop).
 *
 * Ein zweiter Fragenkatalog wäre der Anfang von zwei Wahrheiten darüber, was
 * eine vollständige Aufnahme ist.
 */

export interface CaptureState {
  type: 'full-time' | 'freelance';
  built: BuiltJob | null;
  answers: Answers;
  dyn: DynState;
  freelance: FreelanceTerms;
  flexibility: FlexibilityMap;
  revealSetup: RevealSetup;
}

export const emptyCapture = (type: 'full-time' | 'freelance'): CaptureState => ({
  type,
  built: null,
  answers: {},
  dyn: EMPTY_DYN_STATE,
  freelance: EMPTY_FREELANCE,
  flexibility: {},
  revealSetup: { descriptor: '', trigger: 'after_first_interview' },
});

interface Props {
  state: CaptureState;
  onState: (updater: (prev: CaptureState) => CaptureState) => void;
  companyDefaults: {
    industry?: string | null;
    size?: string | null;
    company_name?: string | null;
    location?: string | null;
  } | null;
  /** Was der Link über die gesuchte Position weiß. Ist ein Titel dabei,
   *  beginnt die Aufnahme mit einer Bestätigungsfrage statt einem leeren Feld. */
  seedTitle?: string | null;
  seedText?: string | null;
  /** Name des Ansprechpartners aus der Vorbelegung — für die Anrede. */
  contactName?: string | null;
  /** Die Firmenfelder des Entwurfs -- sie gehoeren in die Positionsaufnahme,
   *  nicht erst unter Kontakt. */
  company: Partial<CompanyDraft>;
  onCompany: (patch: Partial<CompanyDraft>) => void;
  onEnrich: (domain?: string) => Promise<Anreicherung | { reason: string; message: string }>;
  askAi: (payload: Record<string, unknown>) => Promise<Record<string, any>>;
  /** Oeffnet den Dialog "Speichern und spaeter fertigstellen" (Link per Mail). */
  onResumeLater: () => void;
  parseText: (text: string) => Promise<any>;
  parseUrl: (url: string) => Promise<any>;
  parsePdf: (file: File) => Promise<any>;
  onNext: () => void;
}

/** Welcher Einstieg gerade zu sehen ist. */
// 'choose' ist der Normalzustand vor dem ersten Profil -- start() setzt ihn
// selbst. 'reselect' ist etwas anderes: der bewusste Rueckweg aus dem Editor
// zur Startauswahl. Beides in einen Wert zu legen hiesse, den Rueckweg nicht
// vom Ausgangszustand unterscheiden zu koennen.
type EntryMode = 'kind' | 'anue' | 'confirm' | 'choose' | 'reselect' | 'paste' | 'url';

export function CaptureStep({
  state, onState, companyDefaults, seedTitle, seedText, contactName,
  askAi, parseText, parseUrl, parsePdf, onNext, onResumeLater, company, onCompany, onEnrich,
}: Props) {
  const [text, setText] = useState(seedText ?? '');
  const [url, setUrl] = useState('');
  // Kennt der Link die gesuchte Position, beginnen wir mit der Bestätigung.
  // Sonst mit der Wahl des Wegs — nie mit einer leeren Fläche.
  /**
   * Ohne Profil steht die Vertragsart am Anfang -- vorher gab es sie nirgends,
   * und der Contracting-Zweig war damit unerreichbar. Mit Seed-Titel bleibt es
   * bei der Bestaetigungsfrage: dort ist die Rolle bereits vorgegeben, und eine
   * vorgeschaltete Wahl waere eine Huerde vor dem einfachsten Weg.
   */
  const [entryMode, setEntryMode] = useState<EntryMode>(
    seedTitle ? 'confirm' : state.built ? 'choose' : 'kind',
  );
  const [building, setBuilding] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const briefingRef = useRef<HTMLDivElement>(null);

  const { built, answers, dyn, freelance, flexibility, revealSetup, type } = state;

  const staticProg = built
    ? briefingProgress(type, { remote_type: built.remote_type }, answers)
    : { pct: 0, open: 0, totalQ: 0 };

  const jobDraft = useMemo(
    () =>
      built
        ? buildAiJobDraft({
            type, built, freelance, flexibility,
            // Was der Link über das Unternehmen mitbringt, gilt als beantwortet:
            // Regel 8 des Systemprompts fragt company_defaults nie erneut ab.
            companyDefaults: companyDefaults
              ? { industry: companyDefaults.industry, size: companyDefaults.size }
              : null,
          })
        : {},
    [built, type, freelance, flexibility, companyDefaults],
  );


  const start = (job: BuiltJob) => {
    // Zurueck aus dem Einfuegen-/Link-Schirm, sonst bleibt die Ansicht darauf
    // stehen, obwohl das Profil laengst gebaut ist.
    setEntryMode(seedTitle ? 'confirm' : 'choose');
    onState((s) => ({
      ...s,
      built: job,
      answers: prefillFromBuilt(toBriefBuilt(job)),
      revealSetup: s.revealSetup.descriptor
        ? s.revealSetup
        : {
            ...s.revealSetup,
            descriptor: [job.industry || companyDefaults?.industry, job.location && `Region ${job.location}`]
              .filter(Boolean).join(', '),
          },
    }));
  };

  const buildFrom = async (mode: 'text' | 'url' | 'pdf', file?: File) => {
    setBuilding(true);
    setAiNote(null);
    const res =
      mode === 'url' ? await parseUrl(url.trim())
      : mode === 'pdf' ? await parsePdf(file!)
      : await parseText(text.trim());
    setBuilding(false);

    if (isFailure(res)) {
      // Kein Sackgassen-Fehler: der manuelle Weg steht daneben und wird hier
      // ausdrücklich angeboten. Ein Gast hat kein Dashboard zum Ausweichen.
      setAiNote(res.message);
      return;
    }
    const parsed = (res as any)?.data;
    if (!parsed || !parsed.title) {
      setAiNote('Daraus konnten wir keine Position erkennen. Bitte ergänzen Sie den Text — oder tragen Sie die Eckdaten direkt ein.');
      return;
    }
    const job = fromParsedJobData(parsed);
    /**
     * Was die Anzeige als nachschulbar bezeichnet, gehoert in die
     * Kriterienliste -- sonst kann es niemand als "lernbar" einstufen.
     *
     * BEFUND (09.09.2026): Die Anzeige hatte einen Abschnitt "Nachschulbar bei
     * uns" mit Bullhorn, Boolean Search und Branchenkenntnis. Der Parser gab
     * sie zurueck, aber keines davon stand in der Muss- oder Kann-Liste --
     * also gab es nichts, woran die Einstufung haengen konnte, und die Zeile
     * "Was kann nachgeschult werden?" blieb leer. Ein Lernversprechen IST ein
     * Kriterium der Rolle, nur ein weiches.
     */
    const lernbar = (parsed.trainable_skills ?? [])
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .filter((x) => ![...job.must_haves, ...job.nice_to_haves]
        .some((k) => String(k).toLowerCase() === x.toLowerCase()));
    if (lernbar.length) job.nice_to_haves = [...job.nice_to_haves, ...lernbar];

    if (!job.company_name && companyDefaults?.company_name) job.company_name = companyDefaults.company_name;
    if (!job.location && companyDefaults?.location) job.location = companyDefaults.location;
    if (!job.industry && companyDefaults?.industry) job.industry = companyDefaults.industry;

    // Sprachen, Zertifikate und Erfahrungsjahre hat der Parser bereits
    // eingeordnet — sie gehören in die typisierten Felder, nicht in die
    // Muss-Liste. Das Briefing verfeinert sie später, überschreibt sie aber nicht.
    const typed = typedFieldsFromParsed(parsed);
    if (Object.keys(typed).length > 0) {
      onState((s) => ({ ...s, dyn: { ...s.dyn, typedFields: { ...typed, ...s.dyn.typedFields } } }));
    }

    /*
      Was der Parser fuer den Fragenkatalog gelesen hat -- Arbeitsalltag,
      Abteilung, Teamgroesse, Arbeitszeit, Kultur, Karrierewege. Neun dieser
      Felder fielen bisher auf den Boden, weil BuiltJob fuer sie kein Feld hat:
      das Modell las sie, und niemand packte sie aus. Sichtbar war das an der
      Frage nach dem Arbeitsalltag -- leeres Feld, obwohl die Anzeige eine
      vollstaendige Aufgabenliste trug.

      Sie kommen mit from='ad' herein. Das gilt NICHT als beantwortet: die
      Frage wird gestellt, der Wert steht schon drin, daneben "aus der Anzeige
      gelesen -- bitte pruefen". Bestehende Antworten des Kunden gewinnen.
    */
    // Der Tagessatz gehoert ins Contracting-Formular, wo der Kunde ihn sieht --
    // nicht in den Katalog, wo er unsichtbar die Freigabe entsperren wuerde.
    const satz = freelanceFromParsed(parsed);
    if (satz) onState((s) => ({ ...s, freelance: { ...s.freelance, ...satz } }));

    /* Die Einstufung, die in der Anzeige steht. Bestehende Einstufungen des
       Kunden gewinnen -- er hat sie an der Liste selbst vorgenommen. */
    const stufen = flexibilityFromParsed(parsed, job);
    if (Object.keys(stufen).length > 0) {
      onState((s) => ({ ...s, flexibility: { ...stufen, ...s.flexibility } }));
    }

    const ausAnzeige = catalogFromParsed(parsed, type);
    if (Object.keys(ausAnzeige).length > 0) {
      onState((s) => ({
        ...s,
        dyn: {
          ...s.dyn,
          catalog: {
            ...(s.dyn.catalog ?? EMPTY_CATALOG_STATE),
            known: { ...ausAnzeige, ...(s.dyn.catalog?.known ?? {}) },
          },
        },
      }));
    }
    start(job);
  };

  /** Ohne Vorlage weiter — mit dem, was der Link ohnehin schon weiß. */
  const startManual = (title?: string) => {
    const seed = (title ?? text).trim();
    start({
      ...EMPTY_BUILT,
      title: seed.length > 0 && seed.length <= 120 ? seed : '',
      company_name: companyDefaults?.company_name ?? '',
      location: companyDefaults?.location ?? '',
      industry: companyDefaults?.industry ?? '',
    });
  };

  const pickPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setAiNote('Die Datei ist größer als 8 MB. Bitte fügen Sie den Text der Anzeige ein.');
      return;
    }
    void buildFrom('pdf', file);
  };

  /** Ob im Profil schon Arbeit steckt — dann warnt der Einstieg vor dem Ersetzen. */
  const hasWork = Boolean(
    built && (built.title || built.must_haves.length || built.skills.length || built.description),
  );

  /**
   * Was der Link und der Entwurf schon ueber die Firma wissen.
   *
   * Die schwaechste Schicht: die Groesse steht in `link.prefill.company_size`
   * bzw. im gespeicherten Entwurf, ohne dass jemand danach gefragt haette.
   * Alles andere -- Anzeige, Impressum, ausdrueckliche Antwort -- gewinnt
   * darueber.
   */
  const vorwissen = useMemo(() => {
    const band = sizeBand(companyDefaults?.size);
    return band ? { company_size_band: { value: band, from: 'inherit' as const } } : {};
  }, [companyDefaults?.size]);

  /**
   * Was der Katalog weiss -- aus vier Quellen, in aufsteigender Staerke.
   *
   * Das vorhandene Formular links (Gehalt, Kann-Kriterien) zaehlt mit, ohne
   * dass es doppelt gerendert wird: knownFromForm spiegelt seinen Zustand in
   * den Katalog. Antworten des Kunden gewinnen ueber die Spiegelung -- sonst
   * wuerde eine Formularaenderung eine ausdrueckliche Antwort ueberschreiben.
   * `dyn.catalog.known` traegt sowohl das aus der Anzeige Gelesene als auch
   * die Antworten; wer dort schreibt, respektiert die Rangfolge selbst.
   */
  const katalogKnown = useMemo(
    () => ({
      ...vorwissen,
      ...knownFromForm({ built, freelance, contract: type, flexibility }),
      ...(dyn.catalog?.known ?? {}),
    }),
    [vorwissen, built, freelance, type, flexibility, dyn.catalog?.known],
  );

  /**
   * Einen Wert in den Katalog schreiben. `from` sagt, wie stark er ist.
   *
   * Eine ausdrueckliche Antwort wird von einer Anreicherung nie ueberschrieben
   * -- sonst wuerde ein spaeter eintreffendes Impressum die Korrektur des
   * Kunden zuruecksetzen.
   */
  const setKatalogVon = (key: string, value: unknown, from: SlotState['from']) =>
    onState((s) => {
      const known = { ...(s.dyn.catalog?.known ?? {}) };
      if (from !== 'answer' && known[key]?.from === 'answer') return s;
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        delete known[key];
      } else {
        known[key] = { value, from };
      }
      /**
       * Die Groessenklasse folgt der Kopfzahl, statt daneben gefragt zu
       * werden. Der Kunde nennt eine Zahl -- 340 --, und das Band, das der
       * Recruiter vor dem Reveal liest, ergibt sich daraus. Vorher stand die
       * Spanne als eigene Frage da und der Kunde bestaetigte "250-1.000",
       * ohne das je gesagt zu haben.
       *
       * Nur wenn die Zahl selbst gesetzt wird: eine ausdrueckliche Wahl des
       * Bandes (Rueckfall ohne Zahl) darf sie nicht ueberschreiben.
       */
      if (key === 'company_headcount') {
        const band = sizeBand(value as number | null);
        if (band) known.company_size_band = { value: band, from };
        else delete known.company_size_band;
      }
      return { ...s, dyn: { ...s.dyn, catalog: { ...(s.dyn.catalog ?? EMPTY_CATALOG_STATE), known } } };
    });

  const setKatalog = (key: string, value: unknown) => setKatalogVon(key, value, 'answer');

  // Eine Zahl fuer den ganzen Bildschirm: der Katalog rechnet sie, nicht ein
  // Modell und nicht der alte 36-Fragen-Katalog.
  /**
   * Was aus der Anzeige dasteht und niemand bestaetigt hat.
   *
   * BEFUND (09.09.2026, vom Kunden gefunden): Nach einer vollstaendig
   * beantworteten Aufnahme stand "17 von 26 · 69 %", und der Bildschirm war
   * voll. Achtzehn Werte kamen aus der Anzeige. Die Unterscheidung zwischen
   * gelesen und gesagt ist richtig -- sie war nur unsichtbar, und es gab
   * keine Handlung, die sie aufloest.
   */
  const offeneVorschlaege = useMemo(
    () => ungepruefte(katalogKnown, type),
    [katalogKnown, type],
  );
  const [vorschlaegeAuf, setVorschlaegeAuf] = useState(false);

  /** Einen gelesenen Wert zur Aussage des Kunden machen. */
  const bestaetige = (key: string) => {
    const v = katalogKnown[key]?.value;
    if (v !== undefined && v !== null) setKatalogVon(key, v, 'answer');
  };

  const katalogFortschritt = useMemo(
    () => katalogCompleteness(katalogKnown, type),
    [katalogKnown, type],
  );

  /**
   * Was den Uebergang sperrt. Vorher war das allein der Jobtitel -- ein Kunde
   * konnte ohne Gehaltsband, ohne Standort und ohne Firmenname bis zur
   * Beauftragung durchlaufen, und der Recruiter bekam eine Stelle, mit der er
   * niemanden ansprechen kann.
   *
   * Die Luecken werden BENANNT, nicht nur gesperrt: ein ausgegrauter Knopf
   * ohne Begruendung ist die haeufigste Sackgasse in Formularen. Jede Zeile
   * ist anklickbar und springt zum Feld.
   */
  /**
   * Springt zu dem Feld, das noch fehlt, und setzt den Fokus.
   *
   * Ein ausgegrauter Weiter-Knopf ohne Weg zur Ursache ist die haeufigste
   * Sackgasse in langen Formularen -- auf einer 2.400-px-Seite weiss niemand,
   * wo "Standort" steht. Die Sperr-Zeilen sind deshalb Links, keine Etiketten.
   */
  const zeigeFeld = (key: string) => {
    const el =
      document.querySelector<HTMLElement>(`[data-feld="${key}"]`) ??
      document.querySelector<HTMLElement>(`[name="${key}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Der Fokus erst nach dem Scrollen, sonst springt die Seite doppelt.
    window.setTimeout(() => el.focus?.(), 350);
  };

  const sperren = useMemo(() => {
    const aus: { key: string; label: string }[] = [];
    if (!built?.title?.trim()) aus.push({ key: 'title', label: 'Jobtitel' });
    if (!String(company.company_name ?? '').trim()) {
      aus.push({ key: 'company_name', label: 'Firmenname' });
    }
    if (!built?.location?.trim() && built?.remote_type !== 'remote') {
      aus.push({ key: 'location', label: 'Standort' });
    }
    return [...aus, ...blockingGaps(katalogKnown, type)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built?.title, built?.location, built?.remote_type, company.company_name, katalogKnown, type]);

  /**
   * Wie viel in den beiden Firmen-Gruppen noch fehlt.
   *
   * Die Zahl steht in der zugeklappten Zeile -- ohne sie waere eine
   * geschlossene Gruppe eine Blackbox, und der Kunde muesste jede oeffnen,
   * um zu sehen, ob er dort noch etwas zu tun hat.
   */
  const firmaOffen = useMemo(() => {
    const pflicht: (keyof typeof company)[] = ['company_name', 'company_legal_name'];
    return pflicht.filter((k) => !String(company[k] ?? '').trim()).length;
  }, [company]);

  const rahmenOffen = useMemo(
    () =>
      katalogFortschritt.offen.filter(
        (s) => s.q?.place === 'arbeitszeit',
      ).length + ((built?.benefits ?? []).length === 0 ? 1 : 0),
    [katalogFortschritt.offen, built],
  );

  /**
   * Die Hebel unter "Vor der Uebergabe" kommen aus dem Katalog.
   *
   * Vorher stand hier der alte 36-Fragen-Katalog, und die Bedingung dafuer
   * hing an `dyn.available` -- das seit der Umstellung niemand mehr setzt.
   * Ergebnis auf dem Bildschirm: dem Kunden wurden Fragen als Hebel angeboten
   * ("Warum ist die Stelle offen?" beantworten: +9 P), die es im Briefing gar
   * nicht mehr gibt und die er nirgends anklicken kann.
   */
  const openQuestions = useMemo(
    () =>
      katalogFortschritt.offen.slice(0, 2).map((s) => ({
        id: s.key,
        text: s.label,
        chapter: s.q.chapter,
        weight: s.weight,
      })),
    [katalogFortschritt.offen],
  );

  const moveSkillToNice = (skill: string) => {
    onState((s) =>
      s.built
        ? {
            ...s,
            built: {
              ...s.built,
              must_haves: s.built.must_haves.filter((x) => x.toLowerCase() !== skill.toLowerCase()),
              nice_to_haves: s.built.nice_to_haves.some((x) => x.toLowerCase() === skill.toLowerCase())
                ? s.built.nice_to_haves
                : [...s.built.nice_to_haves, skill],
            },
          }
        : s,
    );
    toast.success(`„${skill}" zu Kann verschoben — größerer Kandidaten-Pool.`);
  };

  // ---- Einstieg -----------------------------------------------------------
  // Nie eine leere Fläche. Kennt der Link die Position, steht zuerst eine
  // Bestätigungsfrage — ein Klick, und die Aufnahme läuft. Kennt er sie nicht,
  // stehen die Wege als Karten mit klarer Rangfolge da.
  //
  // Vorher war hier eine leere Textarea. Sie hat die Vorbelegung des
  // persönlichen Links verschenkt und Arbeit verlangt, bevor irgendetwas
  // Sichtbares passiert war — genau der Punkt, an dem Leute abspringen.
  if (entryMode === 'kind') {
    return (
      <ContractKindStep
        onChoose={(kind) => {
          // Die Wahl wandert in den Entwurf: GuestIntake speichert
          // capture.type als contract_type mit jedem Autosave.
          onState((s) => ({ ...s, type: kind }));
          setEntryMode('choose');
        }}
        onDecline={() => setEntryMode('anue')}
        onBack={built ? () => setEntryMode('choose') : undefined}
      />
    );
  }

  if (entryMode === 'anue') {
    return (
      <ContractKindDeclined
        onContracting={() => {
          onState((s) => ({ ...s, type: 'freelance' }));
          setEntryMode('choose');
        }}
        onBack={() => setEntryMode('kind')}
      />
    );
  }

  if (!built || entryMode === 'reselect' || entryMode === 'paste' || entryMode === 'url') {
    // 'reselect' zeigt die Auswahl auch dann, wenn schon ein Profil begonnen
    // wurde -- der Rueckweg aus dem Editor. Ohne diesen Fall klickte der Knopf
    // "Zurueck zur Auswahl" ins Leere.
    const showEntry = !built || entryMode === 'reselect';

    // Zurück zum begonnenen Profil, statt es unerreichbar zu machen.
    const backToProfile = built ? (
      <button
        type="button"
        onClick={() => setEntryMode(seedTitle ? 'confirm' : 'choose')}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Zurück zum begonnenen Profil
      </button>
    ) : null;

    // ---- Anzeige einfügen / Link -------------------------------------------
    if (entryMode === 'paste' || entryMode === 'url') {
      const isUrl = entryMode === 'url';
      return (
        <div className="mx-auto max-w-2xl space-y-4">
          <button
            type="button"
            onClick={() => setEntryMode(seedTitle ? 'confirm' : 'choose')}
            className="-ml-1 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Zurück
          </button>

          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {isUrl ? 'Link zur Stellenanzeige' : 'Stellenanzeige einfügen'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isUrl
                ? 'Wir lesen die Anzeige aus und bauen daraus das Profil.'
                : 'Der komplette Text genügt — Formatierung ist egal.'}
            </p>
          </div>

          {hasWork && (
            <Alert>
              <AlertDescription className="text-xs">
                Sie haben bereits ein Profil begonnen. Wenn Sie hier etwas aufbauen, wird es
                ersetzt. {backToProfile}
              </AlertDescription>
            </Alert>
          )}

          {isUrl ? (
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://karriere.example.com/job/123"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && url.trim() && buildFrom('url')}
            />
          ) : (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              autoFocus
              className="resize-none text-sm"
              placeholder={'Anzeige hier einfügen — oder die Rolle in eigenen Worten beschreiben.\n\nz. B. „Senior Konstrukteur in Stuttgart, hybrid, ~85k, SolidWorks und Serienentwicklung, ab August …"'}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="hero"
              className="gap-2"
              disabled={building || (isUrl ? !url.trim() : text.trim().length < 10)}
              onClick={() => buildFrom(isUrl ? 'url' : 'text')}
            >
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Profil bauen
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => startManual()}>
              Ohne Vorlage weiter
            </Button>
          </div>

          {aiNote && (
            <Alert>
              <AlertDescription className="text-xs">
                {aiNote}{' '}
                <button type="button" onClick={() => startManual()} className="underline underline-offset-2">
                  Eckdaten direkt eintragen
                </button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    // ---- Bestätigungsfrage (persönlicher Link) -----------------------------
    if (entryMode === 'confirm' && seedTitle && showEntry) {
      const ort = companyDefaults?.location;
      return (
        <div className="mx-auto max-w-xl space-y-6 pt-4">
          <div>
            {contactName && (
              <p className="mb-3 text-sm text-muted-foreground">Guten Tag, {contactName}.</p>
            )}
            <h2 className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
              Sie suchen {article(seedTitle)} <span className="text-primary">{seedTitle}</span>
              {ort ? <> in {ort}</> : null} — richtig?
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="hero" size="lg" className="gap-2" onClick={() => startManual(seedTitle)}>
              Ja, darum geht es <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => setEntryMode('choose')}>
              Nein, andere Position
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Danach stellen wir Ihnen ein paar Fragen zur Rolle — meist in drei bis fünf Minuten
            erledigt. Sie können jederzeit unterbrechen und später weitermachen.
          </p>

          <div className="border-t pt-5">
            <p className="text-sm font-medium">Sie haben die Stellenanzeige zur Hand?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Einfügen spart Ihnen die Hälfte der Fragen.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEntryMode('paste')}>
                <FileText className="h-4 w-4" /> Anzeige einfügen
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEntryMode('url')}>
                <Link2 className="h-4 w-4" /> Link
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5"
                disabled={building} onClick={() => fileRef.current?.click()}>
                {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} PDF
              </Button>
            </div>
          </div>

          {aiNote && (
            <Alert>
              <AlertDescription className="text-xs">{aiNote}</AlertDescription>
            </Alert>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={pickPdf} />
        </div>
      );
    }

    // ---- Drei Wege (öffentlicher Link, oder „andere Position") -------------
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ihre offene Position aufnehmen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Meist in drei bis fünf Minuten. Ohne Registrierung — Ihre Angaben werden dabei
            fortlaufend gespeichert.
          </p>
        </div>

        {hasWork && (
          <Alert>
            <AlertDescription className="text-xs">
              Sie haben bereits ein Profil begonnen. Ein neuer Aufbau ersetzt es. {backToProfile}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <EntryCard
            icon={FileText}
            title="Stellenanzeige einfügen"
            hint="Der schnellste Weg: wir bauen daraus das Profil, Sie prüfen nur noch."
            badge="empfohlen"
            onClick={() => setEntryMode('paste')}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <EntryCard icon={Link2} title="Link zur Anzeige" hint="Wir lesen sie aus." onClick={() => setEntryMode('url')} />
            <EntryCard
              icon={building ? Loader2 : FileUp}
              title="PDF hochladen"
              hint={building ? 'Wird gelesen …' : 'Bis 8 MB.'}
              spinning={building}
              onClick={() => !building && fileRef.current?.click()}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => startManual()}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Nichts davon zur Hand? Von Hand beschreiben
        </button>

        {aiNote && (
          <Alert>
            <AlertDescription className="text-xs">
              {aiNote}{' '}
              <button type="button" onClick={() => startManual()} className="underline underline-offset-2">
                Von Hand beschreiben
              </button>
            </AlertDescription>
          </Alert>
        )}
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={pickPdf} />
      </div>
    );
  }

  // ---- Aufnahme -----------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {/* EIN Titel. Vorher stand er zweimal untereinander: hier als h2 und
              120 px tiefer noch einmal als Eingabefeld in ProfileSections --
              zwei Groessen, gleiches Gewicht, und aenderbar war die kleinere. */}
          <h2 className="text-2xl font-bold tracking-tight">{built.title || 'Ihre Position'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[company.company_legal_name || company.company_name, built.location]
              .filter(Boolean).join(' · ') || 'Alles ist änderbar.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Die gewaehlte Vertragsart, sichtbar und aenderbar. Ohne sie war
              die Wahl nach dem ersten Bildschirm unerreichbar -- und ein Kunde,
              der sich vertan hat, haette von vorn anfangen muessen. */}
          <button
            type="button"
            onClick={() => setEntryMode('kind')}
            className="rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {type === 'freelance' ? 'Contracting' : 'Festanstellung'} · ändern
          </button>
          <span className="text-xs text-muted-foreground">
            {katalogFortschritt.feldGesamt - katalogFortschritt.feldOffen} von{' '}
            {katalogFortschritt.feldGesamt} Angaben · {katalogFortschritt.pct} %
          </span>
          {/* Der Rückweg zur Startauswahl. „Anzeige doch einfügen" stand hier
              vorher allein und als unauffälliger Link — der Wortlaut sagte
              nicht, dass man damit zurückkommt, und wer versehentlich „ohne
              Vorlage" gewählt hatte, tippte den Rest von Hand.
              Das Profil bleibt in beiden Fällen erhalten. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setEntryMode('reselect')}
          >
            <ArrowLeft className="h-3 w-3" />
            Zurück zur Auswahl
          </Button>
        </div>
      </div>

      {/* Das Verhaeltnis folgt der Last, nicht der Symmetrie: links ~100
          Bedienelemente, rechts eine Frage. 50/50 verschenkte Formularbreite
          an eine Spalte, die zu 56 % leer stand. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
        <div className="space-y-4">
          <div>
          <ProfileSections
            type={type}
            built={built}
            onChange={(b) => onState((s) => ({ ...s, built: b }))}
            freelance={freelance}
            onFreelanceChange={(f) => onState((s) => ({ ...s, freelance: f }))}
            reveal={revealSetup}
            onRevealChange={(r) => onState((s) => ({ ...s, revealSetup: r }))}
            flexibility={flexibility}
            onFlexibilityChange={(f) => onState((s) => ({ ...s, flexibility: f }))}
            skillSuggestions={dyn.catalog?.skillSuggestions ?? []}
            catalogKnown={katalogKnown}
            onCatalogSet={setKatalog}
            onDismissSuggestion={(skill) =>
              onState((s) => ({
                ...s,
                dyn: {
                  ...s.dyn,
                  // Uebernommenes verschwindet aus der Liste. Ohne das stuende
                  // der Vorschlag weiter da, obwohl er schon im Profil ist.
                  catalog: {
                    ...(s.dyn.catalog ?? EMPTY_CATALOG_STATE),
                    skillSuggestions: (s.dyn.catalog?.skillSuggestions ?? []).filter(
                      (v) => v.skill !== skill,
                    ),
                  },
                },
              }))}
          />
          </div>

          {/* --- Ab hier: was zur FIRMA gehoert, nicht zur Position. --------
              Stand vorher VOR dem Profil und nahm ~1.200 px, bevor der Kunde
              seine Stelle sah. Es sind Werte, die er einmal bestaetigt und die
              ab der zweiten Stelle vererbt werden. */}
          <CollapsibleGroup
            titel="Ihr Unternehmen"
            offen={firmaOffen}
            zusammenfassung={[
              company.company_legal_name || company.company_name,
              company.company_industry,
              company.company_city,
            ].filter(Boolean).join(' · ')}
            fussnote="Diese Angaben stehen später auf der Vereinbarung."
          >
            <CompanyBlock
              werte={company}
              ausAnzeige={{ company_name: built.company_name, industry: built.industry }}
              onChange={onCompany}
              onEnrich={onEnrich}
              onHeadcount={(n) => setKatalogVon('company_size_band', sizeBand(n), 'enrich')}
            />
            <div className="mt-4 border-t pt-4">
              <CatalogFields place="firma" known={katalogKnown} onSet={setKatalog} contract={type} />
            </div>
          </CollapsibleGroup>

          <CollapsibleGroup
            titel="Rahmendaten"
            offen={rahmenOffen}
            zusammenfassung={
              (built.benefits ?? []).slice(0, 3).join(' · ') ||
              (type === 'freelance'
                ? 'Konditionen, Arbeitszeit, Leistungsnachweis'
                : 'Benefits, Arbeitszeit, Betriebsrat')
            }
            fussnote="Gilt für alle Ihre Stellen — einmal ausfüllen, ab der zweiten Position vorausgewählt."
          >
            <div className="space-y-5">
              <BenefitsBlock
                contract={type}
                gewaehlt={built.benefits ?? []}
                onChange={(b) => onState((s) => ({ ...s, built: { ...s.built, benefits: b } }))}
              />
              <CatalogFields place="arbeitszeit" known={katalogKnown} onSet={setKatalog} contract={type} />
            </div>
          </CollapsibleGroup>
        </div>

        {/* Die Frage bleibt stehen. Sie ist der Motor des Ablaufs -- neunmal
            gedrueckt -- und war nach dem ersten Wischen weg, waehrend der Kunde
            ~1.200 px an einer leeren Spalte entlangscrollte. Auf der ganzen
            Seite war KEIN Element fixiert. */}
        <div className="space-y-4 lg:sticky lg:top-24" ref={briefingRef}>
          <div>
            {/*
              Seit dem 04.09.2026 fuehrt der Fragenkatalog das Briefing
              (src/lib/briefCatalog.ts, Wortlaut aus Markos Leitfaden). Die
              Vorgaengerfassung liess die Fragen von einem Modell erfinden --
              gemessen: 97 Fragen ohne Abschluss und danach EIN Muss-Kriterium
              in der Datenbank. DynamicBriefing bleibt im Repo, bis der neue
              Weg an echten Aufnahmen bestaetigt ist.
            */}
            <CatalogBriefing
              type={type}
              jobDraft={jobDraft}
              state={{ ...(dyn.catalog ?? EMPTY_CATALOG_STATE), known: katalogKnown }}
              onState={(updater) =>
                onState((s) => ({
                  ...s,
                  dyn: { ...s.dyn, catalog: updater(s.dyn.catalog ?? EMPTY_CATALOG_STATE) },
                }))}
              onDone={onNext}
              askAi={askAi as any}
            />
          </div>

          <QualityCheck
            type={type}
            built={built}
            freelance={freelance}
            answers={answers}
            openQuestions={openQuestions}
            revealDescriptor={revealSetup.descriptor}
          />
        </div>
      </div>

      {/* Bleibt am Bildschirmrand stehen und traegt drei Dinge: die einzige
          Zahl, den Ausweg und den Weiter-Knopf.
          Der Ausweg stand vorher klein oben rechts in der Kopfzeile -- beim
          Durchklicken habe ich ihn zweimal uebersehen. Kein einziger von 19
          untersuchten Anbietern hat einen gespeicherten Wiedereinstieg
          ueberhaupt; wir haben ihn und haben ihn versteckt.
          Der Satz "Reicht Ihnen das?" stand am Ende von ~2.500 px Formular,
          also fuer die meisten unsichtbar -- er sagt jetzt dasselbe dort, wo
          der Kunde ohnehin hinschaut. */}
      {/* Was aus der Anzeige gelesen wurde, mit Wert -- der Kunde soll sehen,
          was er bestaetigt, nicht blind durchwinken. Steht ueber der
          Fussleiste, damit der Weg vom Zaehler zur Handlung kurz ist. */}
      {vorschlaegeAuf && offeneVorschlaege.length > 0 && (
        <div className="sticky bottom-14 z-20 -mx-4 border-t bg-card/98 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-medium">
              Das haben wir aus Ihrer Anzeige gelesen
            </p>
            <button
              type="button"
              onClick={() => { offeneVorschlaege.forEach((sl) => bestaetige(sl.key)); setVorschlaegeAuf(false); }}
              className="ml-auto rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Alles stimmt
            </button>
          </div>
          <div className="max-h-56 space-y-0 overflow-y-auto">
            {offeneVorschlaege.map((sl) => {
              const roh = katalogKnown[sl.key]?.value;
              const chips = slotChips(sl, type);
              // Der Chip-TEXT, nicht der Speicherwert: "Ja" statt "true".
              const text = Array.isArray(roh)
                ? roh.map(String).join(' · ')
                : chips?.find((c) => slotChipWert(sl, type, c) === roh)
                  ?? (typeof roh === 'boolean' ? (roh ? 'Ja' : 'Nein') : String(roh ?? ''));
              return (
                <div key={sl.key}
                     className="grid grid-cols-[10rem_minmax(0,1fr)_auto] items-center gap-x-3 border-t py-1.5 first:border-t-0">
                  <span className="truncate text-[11px] text-muted-foreground">
                    {slotLabel(sl, type)}
                  </span>
                  <span className="truncate text-xs">{text}</span>
                  <button
                    type="button"
                    onClick={() => bestaetige(sl.key)}
                    className="shrink-0 rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    stimmt
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Was nicht stimmt, ändern Sie oben im Formular — dann verschwindet es hier.
          </p>
        </div>
      )}

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <span className="text-sm font-medium">
          {katalogFortschritt.feldGesamt - katalogFortschritt.feldOffen} von{' '}
          {katalogFortschritt.feldGesamt}
        </span>
        {sperren.length === 0 && offeneVorschlaege.length > 0 ? (
          /* Der Zaehler allein war eine Sackgasse: voller Bildschirm, 69 %,
             keine Handlung. Hier steht, woran es liegt -- und der Weg dahin
             ist ein Klick. */
          <button
            type="button"
            onClick={() => setVorschlaegeAuf((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-amber-600 underline underline-offset-2"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {offeneVorschlaege.length} Angaben stammen aus Ihrer Anzeige — stimmen sie?
          </button>
        ) : sperren.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Weitere Lücken lassen sich später ergänzen — Sie können jederzeit übergeben.
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
            Zum Weitermachen fehlt noch:
            {sperren.map((l, i) => (
              <button
                key={l.key}
                type="button"
                onClick={() => zeigeFeld(l.key)}
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                {l.label}
                {i < sperren.length - 1 ? ',' : ''}
              </button>
            ))}
          </span>
        )}
        <button
          type="button"
          onClick={onResumeLater}
          className="ml-auto shrink-0 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Speichern und später fertigstellen
        </button>
        <Button onClick={onNext} disabled={sperren.length > 0} className="shrink-0 gap-2">
          Weiter zu Ihren Kontaktdaten <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Der serialisierte Briefing-Text — identisch zum Dashboard-Weg. */
export const captureBriefingText = (answers: Answers): string | null => serializeBriefing(answers) || null;

/** Ein Einstiegsweg als Karte. Klarer als drei gleich laute Knöpfe. */
function EntryCard({
  icon: Icon, title, hint, badge, spinning, onClick,
}: {
  icon: any; title: string; hint: string; badge?: string; spinning?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0 text-muted-foreground', spinning && 'animate-spin')} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge && (
            <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

/** „einen Konstrukteur" statt „ein Konstrukteur". Deutsch ohne Wörterbuch:
 *  im Zweifel „einen" — die Berufsbezeichnung im Akkusativ ist ganz
 *  überwiegend maskulin. Bei den erkennbar femininen Endungen „-in"/"-kraft"
 *  wird „eine" daraus. */
function article(title: string): string {
  return /(?:in|kraft|hilfe|leitung|assistenz)\b/i.test(title.trim()) ? 'eine' : 'einen';
}
