import type { ReactNode } from 'react';
import { ArrowRight, Calendar, Lock, MapPin, MessageSquareText, Search, Unlock, Users, Video } from 'lucide-react';
import type { GuideExample } from '@/lib/recruiterGuide';

/** Beispiele im Rundgang: ausgedachte Daten, klar als Beispiel markiert. */
function Frame({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-3">
    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Beispiel</p>
    {children}
  </div>;
}

const Chip = ({ children, strong = false }: { children: ReactNode; strong?: boolean }) =>
  <span className={strong ? 'rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground' : 'rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground'}>{children}</span>;

const PHASES = ['Eingereicht', 'In Prüfung', 'Interview angefragt', 'Opt-In erteilt', 'Termin steht', 'Interview geführt', 'Angebot', 'Vermittelt'];

export function GuideExampleView({ kind }: { kind: GuideExample }) {
  switch (kind) {
    case 'job': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug">Senior Controller (m/w/d)</p>
          <p className="shrink-0 text-right"><span className="block text-sm font-semibold">€12.400</span><span className="text-[10px] text-muted-foreground">15 % Fee</span></p>
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />Industrieunternehmen · 250–500 MA</p>
        <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />München · hybrid · 75.000–90.000 €</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />2 Recruiter · 1 Einreichung</span>
          <span className="flex items-center gap-1"><Search className="h-3 w-3" />Ich suche</span>
        </div>
      </div>
    </Frame>;
    case 'submit': return <Frame>
      <ol className="space-y-1.5 text-xs">
        {['Kandidat wählen oder neu anlegen', 'Deine Einschätzung: warum passt er?', 'Einwilligung des Kandidaten bestätigen', 'Prüfen und an den Kunden senden'].map((text, i) =>
          <li key={text} className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{i + 1}</span>{text}</li>)}
      </ol>
    </Frame>;
    case 'candidate': return <Frame>
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-xs">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">LM</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Laura M.</p>
          <p className="text-muted-foreground">Senior Controllerin · 8 Jahre Erfahrung</p>
          <p className="text-muted-foreground">München · verfügbar ab 01.01.</p>
        </div>
      </div>
    </Frame>;
    case 'pipeline': return <Frame>
      <div className="flex flex-wrap items-center gap-1">
        {PHASES.map((phase, i) => <span key={phase} className="flex items-center gap-1"><Chip strong={phase === 'Interview angefragt'}>{phase}</Chip>{i < PHASES.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}</span>)}
      </div>
    </Frame>;
    case 'optin': return <Frame>
      <ol className="space-y-1.5 text-xs">
        {[
          { icon: MessageSquareText, text: 'Der Kunde möchte Laura M. kennenlernen.' },
          { icon: Users, text: 'Du fragst Laura, ob sie einverstanden ist.' },
          { icon: Unlock, text: 'Laura sagt Ja: Jetzt siehst du die Firma.' },
          { icon: Calendar, text: 'Ihr stimmt den Interviewtermin ab.' },
        ].map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 shrink-0 text-primary" />{text}</li>)}
      </ol>
    </Frame>;
    case 'task': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <div className="flex items-center gap-1.5"><Chip strong>Opt-In</Chip><span className="text-[11px] font-medium text-destructive">dringend</span></div>
        <p className="mt-2 text-sm font-medium">Kunde möchte Laura M. interviewen</p>
        <p className="text-muted-foreground">Senior Controller (m/w/d) · Hol heute ihre Zustimmung ein.</p>
      </div>
    </Frame>;
    case 'interview': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Video className="h-3.5 w-3.5 text-primary" />Do, 14:00 · Laura M.</p>
        <p className="mt-1 text-muted-foreground">Video-Interview · Termin bestätigt</p>
        <p className="mt-2 text-muted-foreground">Danach: kurzer Debrief, wie es gelaufen ist.</p>
      </div>
    </Frame>;

    // ---- Kunden-Rundgang (lib/clientGuide.ts) ------------------------------
    case 'clientSubmit': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <p className="text-sm font-semibold">Einreichen</p>
        <p className="mt-1 text-muted-foreground">Unter Ihrem Rahmenvertrag · Paket Core 20 % · keine neue Unterschrift</p>
        <div className="mt-2 flex flex-wrap items-center gap-2"><Chip>Diese Position aufstocken</Chip><Chip strong>Position einreichen</Chip></div>
      </div>
    </Frame>;
    case 'clientStatus': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">Senior Controller (m/w/d) <Chip>In Prüfung bei Matchunt</Chip></p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[['Eingereicht', 'done'], ['Prüfung', 'now'], ['Live', ''], ['Kandidaten', '']].map(([label, st]) =>
            <div key={label} className={st === 'done' ? 'border-t-[3px] border-emerald-500 pt-1' : st === 'now' ? 'border-t-[3px] border-primary pt-1 font-medium' : 'border-t-[3px] border-border pt-1 text-muted-foreground'}>{st === 'done' ? '✓ ' : ''}{label}</div>)}
        </div>
      </div>
    </Frame>;
    case 'clientCandidate': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">PR-3F8A21 · Senior Controller</p>
          <p className="shrink-0 text-sm font-semibold text-emerald-600">89 %</p>
        </div>
        <p className="mt-1 text-muted-foreground">„8 Jahre Konzernabschluss, SAP S/4HANA, sucht mehr Gestaltung.“ (Headhunter)</p>
        <p className="mt-1.5 flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />Name und Lebenslauf nach Zustimmung der Person</p>
        <div className="mt-2 flex items-center gap-2"><Chip strong>Kennenlernen</Chip><Chip>Absagen</Chip></div>
      </div>
    </Frame>;
  }
}
