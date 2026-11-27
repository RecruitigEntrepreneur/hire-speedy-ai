import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { LanguageHint } from '@/components/language/LanguageHint';
import { cn } from '@/lib/utils';
import './onboarding.css';

const STEP_KEYS = ['verify', 'details', 'contract', 'review'] as const;

/** „‹ Zurück“ oben links und „Später weiter“ oben rechts; die jeweilige Seite meldet ihre Handlung an. */
type Handlung = (() => void) | null;
const NavKontext = createContext<{ setBack: (f: Handlung) => void; setLater: (f: Handlung) => void }>({ setBack: () => {}, setLater: () => {} });

/** Meldet für die gerade sichtbare Seite „Zurück“ und „Später weiter“ an (null = ausblenden). */
export function useOnboardingNav(back: Handlung, later: Handlung = null) {
  const nav = useContext(NavKontext);
  useEffect(() => { nav.setBack(back); nav.setLater(later); });
  useEffect(() => () => { nav.setBack(null); nav.setLater(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Rahmen des Headhunter-Onboardings, Fassung M3 (26.11.2026): wie der Einrichtungsassistent von Apple.
 * Grauer Grund, ein weißes Blatt in der Mitte, „‹ Zurück“ oben links, Logo mittig, darunter vier Punkte
 * für die vier Kapitel. `.mh-neu.mh-m3` schaltet die Regeln in onboarding.css nur hier ein
 * (Anmeldeseiten und Admin teilen die Datei und bleiben unverändert).
 */
export default function OnboardingFrame({ stage, title, description, email, accountAction, wide = false, einladung = true, children }: { stage: number; title: string; description: string; email?: string; accountAction?: ReactNode; /** Breites Blatt, für den Vertrag im Rahmen. */ wide?: boolean; /** „Persönliche Einladung“ unter dem Blatt – nur, wenn jemand mit Einladungslink kommt. */ einladung?: boolean; children: ReactNode }) {
  const { t } = useTranslation('recruiterFunnel');
  const backRef = useRef<Handlung>(null);
  const laterRef = useRef<Handlung>(null);
  const [hasBack, setHasBack] = useState(false);
  const [hasLater, setHasLater] = useState(false);
  const nav = useRef({
    setBack: (f: Handlung) => { backRef.current = f; setHasBack(!!f); },
    setLater: (f: Handlung) => { laterRef.current = f; setHasLater(!!f); },
  }).current;
  return <NavKontext.Provider value={nav}>
    <div className="mh-ui mh-onboarding mh-neu mh-m3 min-h-screen">
      <header className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 md:px-6">
        <div>{hasBack && <button type="button" className="inline-flex items-center gap-0.5 text-sm font-medium text-klick hover:underline" onClick={() => backRef.current?.()}><ChevronLeft className="h-4 w-4"/>{t('frame.back')}</button>}</div>
        <a href="/" aria-label={t('common.homeAria')}><MatchuntWordmark size="md"/></a>
        <div className="flex items-center justify-end gap-2 text-sm">
          {hasLater && <button type="button" className="hidden font-medium text-klick hover:underline sm:inline" onClick={() => laterRef.current?.()}>{t('frame.later')}</button>}
          <LanguageMenu/><ThemeToggle standard="light"/>
        </div>
      </header>
      <LanguageHint className="border-b-0"/>
      <main className={cn('mx-auto px-3 pb-6 md:px-6', wide ? 'max-w-5xl' : 'max-w-xl')}>
        {/* Titel und Einleitung bleiben für Vorleseprogramme; sichtbar spricht das Blatt selbst. */}
        <h1 className="sr-only">{title}</h1>
        <p className="sr-only">{description}</p>
        <div className="mh-blatt rounded-[22px] px-5 py-7 sm:px-8 sm:py-8">
          <div className="mh-stack">{children}</div>
        </div>
        <ol className="mt-5 flex items-center justify-center gap-1.5" aria-label={t('frame.stepsAria')}>
          {STEP_KEYS.map((key, i) => <li key={key} aria-current={stage === i ? 'step' : undefined} title={t(`frame.steps.${key}`)}
            className={cn('h-1.5 rounded-full transition-all', stage === i ? 'w-5 bg-foreground' : 'w-1.5', stage !== i && (i < stage ? 'bg-foreground/50' : 'bg-foreground/15'))}>
            <span className="sr-only">{t(`frame.steps.${key}`)}</span>
          </li>)}
        </ol>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {email ? <span className="max-w-[16rem] truncate" title={email}>{email}</span> : einladung ? <span className="inline-flex items-center gap-1"><LockKeyhole className="h-3 w-3"/>{t('frame.invitation')}</span> : null}
          {accountAction}
          {hasLater && <button type="button" className="font-medium text-klick hover:underline sm:hidden" onClick={() => laterRef.current?.()}>· {t('frame.later')}</button>}
        </div>
      </main>
      <footer className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-10 text-xs text-muted-foreground">
        <span>{t('common.footerClaim')}</span>
        <a className="hover:text-foreground" href="/impressum">{t('common.imprint')}</a>
        <a className="hover:text-foreground" href="/datenschutz">{t('common.privacy')}</a>
      </footer>
    </div>
  </NavKontext.Provider>;
}
