import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ProfileSections, type FlexibilityMap } from '@/components/dashboard/intake/ProfileSections';
import { DynamicBriefing, EMPTY_DYN_STATE, type DynState } from '@/components/dashboard/intake/DynamicBriefing';
import { QualityCheck } from '@/components/dashboard/intake/QualityCheck';
import {
  briefingProgress, openBriefingQuestions, prefillFromBuilt, serializeBriefing, type Answers,
} from '@/components/dashboard/IntakeBriefing';
import { EMPTY_FREELANCE, type BuiltJob, type FreelanceTerms, type RevealSetup } from '@/components/dashboard/intake/types';
import {
  EMPTY_BUILT, buildAiJobDraft, fromParsedJobData, toBriefBuilt,
} from '@/lib/intakeMapping';
import { isFailure } from '@/hooks/useGuestIntake';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, FileText, FileUp, Link2, Loader2, Sparkles } from 'lucide-react';

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
  askAi: (payload: Record<string, unknown>) => Promise<Record<string, any>>;
  parseText: (text: string) => Promise<any>;
  parseUrl: (url: string) => Promise<any>;
  parsePdf: (file: File) => Promise<any>;
  onNext: () => void;
}

/** Welcher Einstieg gerade zu sehen ist. */
type EntryMode = 'confirm' | 'choose' | 'paste' | 'url';

export function CaptureStep({
  state, onState, companyDefaults, seedTitle, seedText, contactName,
  askAi, parseText, parseUrl, parsePdf, onNext,
}: Props) {
  const [text, setText] = useState(seedText ?? '');
  const [url, setUrl] = useState('');
  // Kennt der Link die gesuchte Position, beginnen wir mit der Bestätigung.
  // Sonst mit der Wahl des Wegs — nie mit einer leeren Fläche.
  const [entryMode, setEntryMode] = useState<EntryMode>(seedTitle ? 'confirm' : 'choose');
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

  const openQuestions = useMemo(
    () => (built ? openBriefingQuestions(type, { remote_type: built.remote_type }, answers) : []),
    [built, type, answers],
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
    if (!job.company_name && companyDefaults?.company_name) job.company_name = companyDefaults.company_name;
    if (!job.location && companyDefaults?.location) job.location = companyDefaults.location;
    if (!job.industry && companyDefaults?.industry) job.industry = companyDefaults.industry;
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
  if (!built || entryMode === 'paste' || entryMode === 'url') {
    const showEntry = !built;

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
          <h2 className="text-xl font-bold tracking-tight">{built.title || 'Ihre Position'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Links steht das Profil, rechts die offenen Fragen. Alles ist änderbar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {dyn.available
              ? `${dyn.answers.length} beantwortet${dyn.chapterProgress.filter((c) => c.state === 'open').length ? ` · ${dyn.chapterProgress.filter((c) => c.state === 'open').length} Kapitel offen` : ''}`
              : `${staticProg.open} von ${staticProg.totalQ} Fragen offen`}
          </span>
          {/* Der Rückweg. Vorher war der Einstieg nach dem ersten Klick
              unerreichbar: wer versehentlich „ohne Vorlage" wählte, tippte den
              Rest von Hand. Das Profil bleibt dabei erhalten. */}
          <button
            type="button"
            onClick={() => setEntryMode('paste')}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Anzeige doch einfügen
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border">
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
          />
        </div>

        <div className="space-y-4" ref={briefingRef}>
          <div className="rounded-xl border p-4">
            <DynamicBriefing
              type={type}
              jobDraft={jobDraft}
              state={dyn}
              onState={(updater) => onState((s) => ({ ...s, dyn: updater(s.dyn) }))}
              onMoveSkillToNice={moveSkillToNice}
              onDone={onNext}
              askAi={askAi as any}
              fallback={{
                built: toBriefBuilt(built),
                value: answers,
                onChange: (a) => onState((s) => ({ ...s, answers: a })),
              }}
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

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <span className="text-xs text-muted-foreground">
          Reicht Ihnen das? Sie können jederzeit weiter — Lücken lassen sich später ergänzen.
        </span>
        <Button onClick={onNext} disabled={!built.title.trim()} className="gap-2">
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
