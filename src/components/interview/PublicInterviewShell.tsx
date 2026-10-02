import type { ComponentType, ReactNode } from 'react';
import { Mail, Phone } from 'lucide-react';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { cn } from '@/lib/utils';

/**
 * Rahmen der login-freien Interview-Seiten (Kandidatenseite, Bestätigung aus
 * der Kundenmail). Bewusst ohne Navbar: wer hier landet, soll antworten und
 * nicht ins Marketing abbiegen. Farben nur über Design-Tokens, keine
 * dark:-Klassen (tailwind.config.ts: darkMode ["class", ".light"]).
 */
export function PublicInterviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-lg items-center px-4 py-3">
          <MatchuntWordmark size="sm" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-12 pt-6">{children}</main>
      <footer className="mx-auto flex w-full max-w-lg gap-4 px-4 pb-8 text-xs text-muted-foreground">
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Datenschutz</a>
        <a href="/impressum" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Impressum</a>
      </footer>
    </div>
  );
}

/** MEZ oder MESZ zum jeweiligen Zeitpunkt, ermittelt über Intl. */
function berlinZone(iso: string): 'MEZ' | 'MESZ' {
  const name = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', timeZoneName: 'short' })
    .formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName')?.value ?? '';
  if (name === 'MEZ' || name === 'MESZ') return name;
  // Manche Laufzeitumgebungen liefern „GMT+2“ statt des deutschen Kürzels.
  return /[+]0?2/.test(name) ? 'MESZ' : 'MEZ';
}

/** „deutsche Zeit (MESZ)“; liegen die Zeiten beiderseits der Umstellung: „(MESZ/MEZ)“. */
export function GermanTime({ isos, className }: { isos: (string | null | undefined)[]; className?: string }) {
  const list = isos.filter((i): i is string => !!i);
  const zones = Array.from(new Set((list.length ? list : [new Date().toISOString()]).map(berlinZone)));
  return <span className={className}>deutsche Zeit ({zones.join('/')})</span>;
}

/** Zitatblock für Nachrichten (Unternehmen an Kandidat, Kandidat an Unternehmen). */
export function QuoteBlock({ label, text }: { label: string; text: string }) {
  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</figcaption>
      <blockquote className="whitespace-pre-line border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">{text}</blockquote>
    </figure>
  );
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

/** Karte des Headhunters: Initialen, Rolle, ein direkter Kontaktweg (Telefon vor Mail). */
export function RecruiterContactCard({ recruiter }: { recruiter: { name: string; phone: string | null; email: string | null } | null }) {
  if (!recruiter) return null;
  const phone = recruiter.phone?.trim() || null;
  const href = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : recruiter.email ? `mailto:${recruiter.email}` : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
        {initialsOf(recruiter.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{recruiter.name} · Ihr Headhunter</p>
        <p className="text-sm text-muted-foreground">Fragen? Ich bin für Sie da</p>
      </div>
      {href && (
        <a
          href={href}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-secondary/60 px-3 text-sm font-medium hover:bg-accent"
          aria-label={phone ? `${recruiter.name} anrufen: ${phone}` : `${recruiter.name} eine E-Mail schreiben`}
        >
          {phone ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          {phone ?? 'E-Mail'}
        </a>
      )}
    </div>
  );
}

/** Großes rundes Symbol über End- und Statusansichten. */
export function StatusIcon({ icon: Icon, tone = 'muted' }: { icon: ComponentType<{ className?: string }>; tone?: 'success' | 'muted' | 'warning' | 'destructive' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'mx-auto flex h-14 w-14 items-center justify-center rounded-full',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'destructive' && 'bg-destructive/15 text-destructive',
        tone === 'muted' && 'bg-secondary text-muted-foreground',
      )}
    >
      <Icon className="h-7 w-7" />
    </div>
  );
}
