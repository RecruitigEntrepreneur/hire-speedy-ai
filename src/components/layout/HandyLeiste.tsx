import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Menu, MessageSquare, Moon, Settings, Sun } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { openFeedback } from '@/components/feedback/FeedbackWidget';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { istAktiv } from '@/lib/navAktiv';

export interface HandyEintrag {
  label: string;
  /** Kürzere Fassung für die Leiste unten (z. B. „Kandidaten“ statt „Meine Kandidaten“). */
  kurz?: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  /** Kunde vor der Gegenzeichnung: Seite erreichbar, aber noch gesperrt (Schloss wie in der Seitenleiste). */
  gesperrt?: boolean;
}

interface Props {
  /** Die vier Wege, die immer unten stehen. */
  haupt: HandyEintrag[];
  /** Alles Weitere, im Blatt „Mehr“. */
  mehr: HandyEintrag[];
  einstellungen: { label: string; href: string; aktiv: boolean };
  /** Zusatz im Blatt, z. B. die Liga-Karte des Headhunters. */
  zusatz?: ReactNode;
  feedback: boolean;
}

/** Feld hinter dem Symbol: zeigt, auf welcher Seite man ist (16.11.2026, Marko: 1A). */
const feld = 'relative flex h-7 w-14 items-center justify-center rounded-full transition-colors [&>svg]:h-5 [&>svg]:w-5';

/**
 * Menü am Handy (16.11.2026, Marko: Variante A): Leiste unten mit vier Wegen und „Menü“ (drei Striche).
 * Am Computer unsichtbar, dort bleibt die Seitenleiste. Die Höhe steht als --handy-leiste
 * bereit, damit eigene Leisten am unteren Rand (z. B. „Vorstellung vorbereiten“) darüber sitzen.
 */
export function HandyLeiste({ haupt, mehr, einstellungen, zusatz, feedback }: Props) {
  const { t } = useTranslation('common');
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [offen, setOffen] = useState(false);

  // Klasse an <html>: schaltet --handy-leiste (index.css) für Abstände und eigene Leisten frei.
  useEffect(() => {
    document.documentElement.classList.add('mit-handy-leiste');
    return () => document.documentElement.classList.remove('mit-handy-leiste');
  }, []);
  // Beim Seitenwechsel schließt das Blatt.
  useEffect(() => { setOffen(false); }, [pathname]);

  const mehrAktiv = einstellungen.aktiv || mehr.some((e) => istAktiv(pathname, e.href)) || (!!zusatz && pathname.startsWith('/recruiter/liga'));
  const zeile = 'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors';

  return (
    <>
      <nav
        aria-label={t('mobileNav.label')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${haupt.length + 1}, minmax(0, 1fr))` }}>
          {haupt.map((e) => {
            const aktiv = istAktiv(pathname, e.href);
            return (
              <Link
                key={e.href}
                to={e.href}
                data-tour={`nav:${e.href}`}
                aria-current={aktiv ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-none transition-colors',
                  aktiv ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className={cn(feld, aktiv && 'bg-foreground/10')}>
                  {e.icon}
                  {e.gesperrt && <Lock className="absolute -right-0.5 -top-0.5 !h-3 !w-3 opacity-70" aria-hidden />}
                  {!!e.badge && (
                    <span className="absolute right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-medium leading-4 text-destructive-foreground">
                      {e.badge > 99 ? '99+' : e.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{e.kurz ?? e.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOffen(true)}
            aria-haspopup="dialog"
            aria-expanded={offen}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-none transition-colors',
              mehrAktiv || offen ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {/* Liegt die offene Seite im Menü (z. B. Pipeline), leuchtet „Menü“ */}
            <span className={cn(feld, (mehrAktiv || offen) && 'bg-foreground/10')}><Menu aria-hidden /></span>
            <span>{t('mobileNav.more')}</span>
          </button>
        </div>
      </nav>

      <Sheet open={offen} onOpenChange={setOffen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] overflow-y-auto rounded-t-2xl px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 md:hidden"
        >
          <SheetTitle className="sr-only">{t('mobileNav.more')}</SheetTitle>
          <SheetDescription className="sr-only">{t('mobileNav.label')}</SheetDescription>
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted" aria-hidden />
          <nav className="space-y-0.5">
            {mehr.map((e) => {
              const aktiv = istAktiv(pathname, e.href);
              return (
                <Link
                  key={e.href}
                  to={e.href}
                  aria-current={aktiv ? 'page' : undefined}
                  className={cn(zeile, aktiv ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}
                >
                  <span className="text-muted-foreground [&>svg]:h-5 [&>svg]:w-5" aria-hidden>{e.icon}</span>
                  {e.label}
                  {e.gesperrt && <Lock className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />}
                  {!!e.badge && (
                    <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] font-medium leading-5 text-destructive-foreground">{e.badge}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {zusatz && <div className="px-1 pt-2" onClickCapture={() => setOffen(false)}>{zusatz}</div>}

          <div className="mt-2 space-y-0.5 border-t border-border pt-2">
            <Link
              to={einstellungen.href}
              aria-current={einstellungen.aktiv ? 'page' : undefined}
              className={cn(zeile, einstellungen.aktiv ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}
            >
              <Settings className="h-5 w-5 text-muted-foreground" aria-hidden />
              {einstellungen.label}
            </Link>
            {feedback && (
              <button
                type="button"
                className={cn(zeile, 'w-full text-left text-foreground hover:bg-accent')}
                onClick={() => { setOffen(false); window.setTimeout(() => openFeedback(), 250); }}
              >
                <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
                {t('mobileNav.feedback')}
              </button>
            )}
            <button
              type="button"
              className={cn(zeile, 'w-full text-left text-foreground hover:bg-accent')}
              onClick={toggleTheme}
            >
              {theme === 'dark'
                ? <Sun className="h-5 w-5 text-muted-foreground" aria-hidden />
                : <Moon className="h-5 w-5 text-muted-foreground" aria-hidden />}
              {theme === 'dark' ? t('mobileNav.light') : t('mobileNav.dark')}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
