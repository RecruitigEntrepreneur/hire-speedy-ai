import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageHint } from '@/components/language/LanguageHint';
import { Check, ChevronLeft, CloudOff, Loader2, TriangleAlert } from 'lucide-react';
import { Kuerzel } from './mitarbeit';
import { M3Blatt, M3Fuss, M3Logo, M3Punkte, M3Provider, M3Seite, ZurueckProvider } from './m3';
import type { PackageSummary } from '@/hooks/useGuestIntake';

/**
 * Rahmen der login-freien Jobaufnahme.
 *
 * Bewusst nicht die vorhandene Navbar: die zeigt für nicht angemeldete
 * Besucher „Anmelden" und „Jetzt starten" (Navbar.tsx:273-278) und lädt zum
 * Absprung ein — auf einer Seite, deren einziger Zweck die Aufnahme ist, ist
 * das ein Leck.
 *
 * Farben ausschließlich über Design-Tokens, nie über dark:-Klassen:
 * tailwind.config.ts:4 setzt darkMode: ["class", ".light"], die dark:-Variante
 * feuert im Projekt also im HELLEN Modus.
 */

export interface StepDef {
  key: string;
  label: string;
}

interface Props {
  steps: StepDef[];
  activeStep: string;
  /** Bis hierher darf zurückgesprungen werden. */
  reachable: string[];
  onStep: (key: string) => void;
  packages: PackageSummary[] | null;
  /** Contracting: statt der Festanstellungs-Pakete die Aufteilung des Tagessatzes. */
  contracting?: boolean;
  ownerName?: string | null;
  saving?: boolean;
  saveError?: string | null;
  lastSavedAt?: Date | null;
  onResumeLater?: () => void;
  /** „‹ Zurück“ oben links, solange keine innere Seite eine eigene Handlung anmeldet. */
  onBack?: () => void;
  /** Gleichzeitiges Arbeiten: Kürzel aller, die gerade in der Aufnahme sind (ich zuerst). */
  anwesend?: { kuerzel: string; name: string | null; ich?: boolean }[];
  /** Zeilen oben im Blatt: wer ist wo, fremde Änderungen, Einladungen. */
  oben?: ReactNode;
  children: ReactNode;
}

export function IntakeShell({
  steps, activeStep, reachable, onStep, packages, contracting, ownerName,
  saving, saveError, lastSavedAt, onResumeLater, onBack, anwesend, oben, children,
}: Props) {
  const { t } = useTranslation('clientFunnel');
  // „‹ Zurück“: eine innere Seite (Etappen, Einfügen) meldet ihre eigene Handlung an,
  // sonst gilt die des Schritts (onBack aus GuestIntake).
  const innen = useRef<(() => void) | null>(null);
  const [hatInnen, setHatInnen] = useState(false);
  const setzeInnen = useRef((f: (() => void) | null) => { innen.current = f; setHatInnen(!!f); }).current;
  const zurueck = hatInnen ? () => innen.current?.() : onBack;

  // Die Kondition steht ab der ersten Sekunde da -- AGB § 9 sagt genau das zu.
  // Im neuen Look klein unter dem Logo, auch auf dem Handy.
  const kondition = contracting
    ? t('shell.contractingBadge')
    : packages && packages.length > 0
      ? t('shell.feeBadge', { percent: Math.min(...packages.map((p) => p.fee_percent)) })
      : null;

  return (
    <M3Provider value>
      <ZurueckProvider value={setzeInnen}>
        <div className="mk3 min-h-screen text-foreground">
          {/* ---- Kopf: Zurück, Logo mit Kondition, Speicherstand und Sprache ---- */}
          <header className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 md:px-6">
            <div>
              {zurueck && (
                <button type="button" onClick={zurueck} className="inline-flex items-center gap-0.5 text-sm font-medium text-klick hover:underline">
                  <ChevronLeft className="h-4 w-4" />{t('common.back')}
                </button>
              )}
            </div>
            <M3Logo unterzeile={kondition && <>{kondition}<span className="hidden sm:inline"> {t('shell.noFixedCosts')}</span></>} />
            <div className="flex items-center justify-end gap-2 sm:gap-3">
              {anwesend && anwesend.length > 1 && (
                /* Auf dem Handy reicht die Zeile im Blatt; oben wäre kein Platz neben dem Logo. */
                <span className="hidden -space-x-1.5 sm:flex" aria-label={anwesend.map((a) => a.name ?? a.kuerzel).join(', ')}>
                  {anwesend.map((a, i) => <Kuerzel key={i} k={a.kuerzel} ich={a.ich} className="ring-2 ring-background" />)}
                </span>
              )}
              <SaveState saving={saving} error={saveError} at={lastSavedAt} />
              {onResumeLater && (
                <button type="button" onClick={onResumeLater} className="hidden text-sm font-medium text-klick hover:underline sm:inline">
                  {t('shell.resumeLater')}
                </button>
              )}
              <LanguageMenu />
              <ThemeToggle standard="light" />
            </div>
          </header>
          {/* Der Link startet in einer anderen Sprache als der Browser: einmalige Hinweiszeile. */}
          <LanguageHint className="border-b-0" />

          <main className="px-3 md:px-6">
            <M3Blatt>{oben}{children}</M3Blatt>
            <M3Punkte schritte={steps} aktiv={activeStep} erreichbar={reachable} onSchritt={onStep} />
            {onResumeLater && (
              <p className="mt-3 text-center text-xs sm:hidden">
                <button type="button" onClick={onResumeLater} className="font-medium text-klick hover:underline">{t('shell.resumeLater')}</button>
              </p>
            )}
          </main>
          <M3Fuss ownerName={ownerName} />
        </div>
      </ZurueckProvider>
    </M3Provider>
  );
}

/**
 * Der Speicherstand wird ehrlich angezeigt.
 *
 * Der Dashboard-Pfad meldet heute „Entwurf gespeichert", auch wenn die
 * erweiterten Felder still verworfen wurden (intakeCapture.ts:56). Ein Gast
 * hat kein Dashboard, in dem er das bemerken könnte — hier steht deshalb, was
 * wirklich passiert ist.
 */
function SaveState({ saving, error, at }: { saving?: boolean; error?: string | null; at?: Date | null }) {
  const { t } = useTranslation('clientFunnel');
  if (error) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground" role="status">
        <CloudOff className="h-3.5 w-3.5" /> {t('shell.notSaved')}
      </span>
    );
  }
  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('shell.saving')}
      </span>
    );
  }
  if (at) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex" role="status">
        <Check className="h-3.5 w-3.5" /> {t('shell.saved')}
      </span>
    );
  }
  return null;
}

/** Sprachmenü oben rechts auf den ganzseitigen Zuständen (ohne Kopfzeile). Der Rahmen braucht `relative`. */
export function PageLanguageMenu() {
  return (
    <div className="absolute right-4 top-3 z-10">
      <LanguageMenu />
    </div>
  );
}

/** Ganzseitige Absage: ungültiger, abgelaufener oder widerrufener Link. */
export function IntakeFailurePage({
  title, message, action,
}: { title: string; message: string; action?: ReactNode }) {
  return (
    <M3Seite>
      <div className="flex flex-col items-center text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <TriangleAlert className="h-[22px] w-[22px] text-foreground" />
        </span>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
        {action && <div className="mt-6 w-full [&>*]:w-full">{action}</div>}
      </div>
    </M3Seite>
  );
}
