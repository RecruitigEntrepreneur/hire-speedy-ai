import { createContext, useContext, useEffect, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Minus, Plus } from 'lucide-react';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import './intake-m3.css';

/**
 * Kunden-Aufnahme im Stil M3 (26.11.2026, Variante A): wie das Headhunter-Onboarding.
 * Grauer Grund, ein Blatt in der Mitte, Kopf mittig (Symbol im grauen Kreis,
 * Ortszeile, Titel, Satz), graue Felder und Zeilen, blaue Schaltfläche über die
 * volle Breite, der zweite Weg als Link darunter.
 *
 * Die Bausteine gelten nur, wo der Rahmen der Gast-Aufnahme (IntakeShell,
 * M3Seite) den Kontext setzt. Dieselben Schritte im Dashboard (ClientIntake)
 * bleiben unverändert.
 */

const M3Kontext = createContext(false);
export const M3Provider = M3Kontext.Provider;
/** true innerhalb der Gast-Aufnahme im neuen Look. */
export const useIntakeM3 = () => useContext(M3Kontext);

type Handlung = (() => void) | null;
const ZurueckKontext = createContext<(f: Handlung) => void>(() => {});
export const ZurueckProvider = ZurueckKontext.Provider;

/**
 * Meldet „‹ Zurück“ oben links für die gerade sichtbare Seite an.
 * `aktiv = false`: diese Komponente meldet nichts (eine innere übernimmt).
 */
export function useIntakeBack(back: Handlung, aktiv = true) {
  const setBack = useContext(ZurueckKontext);
  useEffect(() => { if (aktiv) setBack(back); });
  useEffect(() => {
    if (!aktiv) return;
    return () => setBack(null);
  }, [aktiv]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Symbol im grauen Kreis, Ortszeile, Titel, Satz -- alles mittig. */
export function M3Kopf({ icon: Icon, ort, titel, lead, klein, children }: {
  icon?: ComponentType<{ className?: string }>;
  ort?: ReactNode;
  titel: ReactNode;
  lead?: ReactNode;
  /** Kleinere Schrift für lange Fragen. */
  klein?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground">
          <Icon className="h-[22px] w-[22px]" />
        </span>
      )}
      {ort && <div className="mb-1.5 text-xs text-muted-foreground">{ort}</div>}
      <h2 className={cn('font-semibold tracking-tight text-foreground', klein ? 'text-lg leading-snug sm:text-xl' : 'text-[22px] leading-tight sm:text-2xl')}>{titel}</h2>
      {lead && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{lead}</p>}
      {children}
    </div>
  );
}

/** Eine graue Wahlzeile; gewählt = Blattfarbe mit dunklem Rand. */
export function M3Zeile({ icon: Icon, titel, text, gewaehlt, onClick, disabled, rechts, ...rest }: {
  icon?: ComponentType<{ className?: string }>;
  titel: ReactNode;
  text?: ReactNode;
  gewaehlt?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  rechts?: ReactNode;
  [data: `data-${string}`]: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={gewaehlt}
      {...rest}
      className={cn(
        'mk3-zeile flex w-full items-center gap-3 rounded-[14px] border-2 px-4 py-3 text-left transition-colors disabled:opacity-60',
        gewaehlt ? 'border-foreground bg-background' : 'border-transparent bg-secondary hover:border-foreground/25',
      )}
    >
      {Icon && <Icon className="h-5 w-5 shrink-0 text-foreground" />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{titel}</span>
        {text && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{text}</span>}
      </span>
      {rechts ?? (gewaehlt ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null)}
    </button>
  );
}

/** Grauer Hinweis ohne Warnfarbe. */
export function M3Hinweis({ icon: Icon, children, className }: { icon?: ComponentType<{ className?: string }>; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-3 rounded-[14px] bg-secondary p-4 text-sm leading-relaxed text-foreground', className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Kacheln mit Symbol (Airbnb-Stil, Marko 27.11.2026): nur wo es wenige, klar
 * verschiedene Antworten gibt -- Arbeitsmodell, Schwerpunkt, Benefits.
 * Grau wie die Zeilen; gewählt = Blattfarbe mit dunklem Rand. `anzeige`: was die
 * Anzeige sagt, gestrichelt, solange etwas anderes gewählt ist.
 */
export interface M3Kachel<T extends string | number> {
  wert: T;
  titel: ReactNode;
  text?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  hinweis?: ReactNode;
}
export function M3Kacheln<T extends string | number>({ optionen, gewaehlt, onWahl, spalten = 3, anzeige, ...rest }: {
  optionen: M3Kachel<T>[];
  /** Gewählte Werte (eine oder mehrere). */
  gewaehlt: T[];
  onWahl: (wert: T) => void;
  spalten?: 2 | 3;
  anzeige?: T;
  [data: `data-${string}`]: string | undefined;
}) {
  return (
    <div {...rest} className={cn('grid gap-2', spalten === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
      {optionen.map((o) => {
        const an = gewaehlt.includes(o.wert);
        const Icon = o.icon;
        return (
          <button
            key={String(o.wert)}
            type="button"
            onClick={() => onWahl(o.wert)}
            aria-pressed={an}
            className={cn(
              'mk3-kachel flex min-h-[76px] flex-col items-start justify-between gap-2 rounded-[14px] border-2 px-3 py-2.5 text-left transition-colors',
              an ? 'border-foreground bg-background'
                : anzeige === o.wert ? 'border-dashed border-foreground/40 bg-secondary hover:border-foreground/60'
                : 'border-transparent bg-secondary hover:border-foreground/25',
            )}
          >
            <Icon className="h-5 w-5 shrink-0 text-foreground" />
            <span className="block">
              <span className="block text-sm font-medium leading-snug text-foreground">{o.titel}</span>
              {o.text && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{o.text}</span>}
              {o.hinweis && <span className="mt-0.5 block text-[10px] text-muted-foreground">{o.hinweis}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Zähler mit − und + (Airbnb-Stil), optional mit einem Ausweg wie „frei wählbar“. */
export function M3Zaehler({ wert, min = 0, max, onWert, einheit, frei, minusLabel, plusLabel }: {
  wert: number | null;
  min?: number;
  max: number;
  onWert: (n: number) => void;
  einheit: ReactNode;
  frei?: { label: ReactNode; aktiv: boolean; onClick: () => void };
  minusLabel: string;
  plusLabel: string;
}) {
  const knopf = 'mk3-zaehler-knopf flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-foreground transition-colors disabled:opacity-30';
  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-secondary px-4 py-3">
        <span className="text-sm text-foreground">{einheit}</span>
        <span className="flex items-center gap-4">
          <button type="button" aria-label={minusLabel} className={knopf} disabled={wert !== null && wert <= min}
                  onClick={() => onWert(wert === null ? min : Math.max(min, wert - 1))}>
            <Minus className="h-4 w-4" />
          </button>
          <span className={cn('w-5 text-center text-base font-semibold tabular-nums', wert === null && 'text-muted-foreground')} aria-live="polite">
            {wert === null ? '–' : wert}
          </span>
          <button type="button" aria-label={plusLabel} className={knopf} disabled={wert !== null && wert >= max}
                  onClick={() => onWert(wert === null ? Math.min(max, min + 1) : Math.min(max, wert + 1))}>
            <Plus className="h-4 w-4" />
          </button>
        </span>
      </div>
      {frei && (
        <button type="button" onClick={frei.onClick} aria-pressed={frei.aktiv}
                className={cn('mt-2 inline-flex items-center gap-1 text-xs', frei.aktiv ? 'font-medium text-foreground' : 'text-klick hover:underline')}>
          {frei.aktiv && <Check className="h-3.5 w-3.5" />}{frei.label}
        </button>
      )}
    </div>
  );
}

/** Graue Liste mit feinen Trennlinien, Bezeichnung links, Wert rechts. */
export function M3Liste({ zeilen }: { zeilen: [ReactNode, ReactNode][] }) {
  return (
    <dl className="overflow-hidden rounded-[14px] bg-secondary text-sm">
      {zeilen.map(([k, v], i) => (
        <div key={i} className={cn('flex items-baseline justify-between gap-4 px-4 py-2.5', i > 0 && 'border-t border-background')}>
          <dt className="shrink-0 text-muted-foreground">{k}</dt>
          <dd className="min-w-0 text-right text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Der weiße (dunkel: kartengraue) Bogen in der Mitte. */
export function M3Blatt({ breit, children, className }: { breit?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full', breit ? 'max-w-5xl' : 'max-w-xl')}>
      <div className={cn('mk3-blatt rounded-[22px] px-5 py-7 sm:px-8 sm:py-8', className)}>{children}</div>
    </div>
  );
}

/** Fünf Punkte unter dem Blatt; erreichbare Kapitel lassen sich antippen. */
export function M3Punkte({ schritte, aktiv, erreichbar, onSchritt }: {
  schritte: { key: string; label: string }[];
  aktiv: string;
  erreichbar: string[];
  onSchritt: (key: string) => void;
}) {
  const { t } = useTranslation('clientFunnel');
  const idx = Math.max(0, schritte.findIndex((s) => s.key === aktiv));
  return (
    <ol className="mt-5 flex items-center justify-center gap-1.5" aria-label={t('shell.stepsAria', { defaultValue: 'Schritte' })}>
      {schritte.map((s, i) => {
        const geht = erreichbar.includes(s.key) && s.key !== aktiv;
        return (
          <li key={s.key}>
            <button
              type="button"
              disabled={!geht}
              onClick={() => geht && onSchritt(s.key)}
              title={s.label}
              aria-current={s.key === aktiv ? 'step' : undefined}
              className={cn(
                'block h-1.5 rounded-full transition-all',
                i === idx ? 'w-5 bg-foreground' : i < idx ? 'w-1.5 bg-foreground/50' : 'w-1.5 bg-foreground/15',
                geht && 'cursor-pointer hover:bg-foreground/70',
              )}
            >
              <span className="sr-only">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Fuß unter dem Blatt: Ansprechpartner, Speicher-Hinweis, Rechtliches. */
export function M3Fuss({ ownerName }: { ownerName?: string | null }) {
  const { t } = useTranslation('clientFunnel');
  return (
    <footer className="mx-auto max-w-xl px-4 pb-10 pt-6 text-center text-xs leading-relaxed text-muted-foreground">
      {ownerName && <p className="mb-1">{t('shell.contactPerson', { name: ownerName })}</p>}
      <p>
        {t('shell.footerNote')}{' '}
        <a href="/datenschutz" className="hover:text-foreground" target="_blank" rel="noreferrer">{t('shell.privacy')}</a>
        {' · '}
        <a href="/agb" className="hover:text-foreground" target="_blank" rel="noreferrer">{t('shell.terms')}</a>
        {' · '}
        <a href="/impressum" className="hover:text-foreground" target="_blank" rel="noreferrer">{t('shell.imprint')}</a>
      </p>
    </footer>
  );
}

/** Logo mit der Honorar-Zeile darunter (steht ab der ersten Sekunde da, AGB § 9). */
export function M3Logo({ unterzeile }: { unterzeile?: ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <MatchuntWordmark size="sm" />
      {unterzeile && <span className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">{unterzeile}</span>}
    </div>
  );
}

/**
 * Ganze Seite außerhalb des Ablaufs (Vertrag wird vorbereitet, Unterschrift,
 * Fehler, Rückkehr aus DocuSign): grauer Grund, Logo, Sprache, ein Blatt.
 */
export function M3Seite({ breit, children, ohneSprache, rechts }: { breit?: boolean; children: ReactNode; ohneSprache?: boolean; rechts?: ReactNode }) {
  return (
    <M3Provider value>
      <div className="mk3 min-h-screen text-foreground">
        <header className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 md:px-6">
          <div />
          <M3Logo />
          <div className="flex items-center justify-end gap-2">{rechts}{!ohneSprache && <LanguageMenu />}<ThemeToggle standard="light" /></div>
        </header>
        <main className="px-3 pb-10 md:px-6">
          <M3Blatt breit={breit}>{children}</M3Blatt>
        </main>
      </div>
    </M3Provider>
  );
}
