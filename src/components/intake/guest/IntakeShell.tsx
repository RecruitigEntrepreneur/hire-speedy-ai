import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { LanguageHint } from '@/components/language/LanguageHint';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, CloudOff, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
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
  children: ReactNode;
}

export function IntakeShell({
  steps, activeStep, reachable, onStep, packages, contracting, ownerName,
  saving, saveError, lastSavedAt, onResumeLater, children,
}: Props) {
  const { t } = useTranslation('clientFunnel');
  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === activeStep));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---- Kopf: Marke, Konditionen, Speicherstand --------------------- */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <MatchuntWordmark size="sm" />

          {/* Die Kondition steht ab der ersten Sekunde hier — nicht als
              Überraschung am Ende. AGB § 9 sagt genau das zu, und die gelockte
              Spezifikation verlangt sie ausdrücklich ab der ersten Sekunde.
              Deshalb auch auf dem Handy sichtbar, dort nur kürzer: der Zusatz
              „keine Fixkosten" weicht, die Zahl bleibt. */}
          {contracting ? (
            <Badge variant="secondary" className="gap-1.5 whitespace-nowrap font-normal">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              {/* Keine Prozentzahl hier: „78 %“ allein liest sich wie eine Gebühr.
                  Die Aufteilung steht mit Erklärung auf der Seite „Anfragen“. */}
              {t('shell.contractingBadge')}
              <span className="hidden sm:inline">{t('shell.noFixedCosts')}</span>
            </Badge>
          ) : packages && packages.length > 0 && (
            <Badge variant="secondary" className="gap-1.5 whitespace-nowrap font-normal">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              {t('shell.feeBadge', { percent: Math.min(...packages.map((p) => p.fee_percent)) })}
              <span className="hidden sm:inline">{t('shell.noFixedCosts')}</span>
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-3">
            <SaveState saving={saving} error={saveError} at={lastSavedAt} />
            {onResumeLater && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onResumeLater}>
                {t('shell.resumeLater')}
              </Button>
            )}
            <LanguageMenu />
          </div>
        </div>

        {/* ---- Schritte ------------------------------------------------- */}
        <div className="mx-auto max-w-5xl px-4 pb-3 md:px-6">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
            {steps.map((step, i) => {
              const done = i < activeIndex;
              const active = step.key === activeStep;
              const canGo = reachable.includes(step.key);
              return (
                <li key={step.key} className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!canGo}
                    onClick={() => canGo && onStep(step.key)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors',
                      active && 'bg-primary text-primary-foreground font-medium',
                      !active && done && 'text-foreground hover:bg-muted',
                      !active && !done && 'text-muted-foreground',
                      canGo && !active && 'cursor-pointer',
                      !canGo && 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full border text-[10px]',
                        active && 'border-primary-foreground/40',
                        done && !active && 'border-emerald-600/50 bg-emerald-600/10 text-emerald-700',
                      )}
                    >
                      {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                    </span>
                    {step.label}
                  </button>
                  {i < steps.length - 1 && <span className="text-border">·</span>}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Der Link startet in einer anderen Sprache als der Browser: einmalige Hinweiszeile. */}
        <LanguageHint className="border-b-0 border-t" />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">{children}</main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 md:px-6">
        <div className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
          {ownerName && <p className="mb-1">{t('shell.contactPerson', { name: ownerName })}</p>}
          <p>
            {t('shell.footerNote')}{' '}
            <a href="/datenschutz" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
              {t('shell.privacy')}
            </a>
            {' · '}
            <a href="/agb" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
              {t('shell.terms')}
            </a>
            {' · '}
            <a href="/impressum" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
              {t('shell.imprint')}
            </a>
          </p>
        </div>
      </footer>
    </div>
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
      <span className="flex items-center gap-1.5 text-xs text-destructive" role="status">
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
        <Check className="h-3.5 w-3.5 text-emerald-600" /> {t('shell.saved')}
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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <PageLanguageMenu />
      <div className="w-full max-w-md text-center">
        <MatchuntWordmark size="sm" className="mb-8 justify-center" />
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <TriangleAlert className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        {action}
      </div>
    </div>
  );
}
