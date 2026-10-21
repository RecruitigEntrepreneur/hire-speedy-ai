import type { ReactNode } from 'react';
import { MapPin, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { briefingText, list } from '@/lib/recruiterBriefing';
import { mitarbeitende } from '@/lib/stellenKopf';
import type { WorkspaceJob } from './RecruiterJobWorkspace';

/**
 * „Über das Unternehmen“ (21.10.2026): Klick auf den Firmennamen im Kopf der
 * Stelle. Nur, was die Headhunter-Sicht nach „Ich suche“ liefert; Website,
 * Verifizierung und weitere Stellen des Kunden brauchen eine Erweiterung der Sicht.
 */
function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return <section className="space-y-1.5"><h3 className="text-xs font-medium text-muted-foreground">{titel}</h3>{children}</section>;
}

export function FirmaSheet({ open, onOpenChange, job }: { open: boolean; onOpenChange: (open: boolean) => void; job: WorkspaceJob }) {
  const name = job.company_name || 'Unternehmen';
  const besonders = list(job.unique_selling_points).flatMap(t => t.split(/\s·\s/)).map(t => t.trim()).filter(Boolean);
  const kultur = briefingText(job.company_culture);
  const abteilung = briefingText(job.department_structure);
  const berichtet = briefingText(job.reports_to);
  const leute = mitarbeitende(job as never);
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader className="space-y-3 text-left">
        <div className="flex items-center gap-3">
          <FirmenLogo url={job.company_logo_url} name={name} size={48} />
          <div className="min-w-0">
            <SheetTitle className="text-lg leading-tight">{name}</SheetTitle>
            <SheetDescription>{[job.industry, job.location].filter(Boolean).join(' · ')}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {leute && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1"><Users className="h-3.5 w-3.5" />{leute}</span>}
          {job.location && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
        </div>
      </SheetHeader>
      <div className="mt-6 space-y-5 text-sm leading-6">
        {besonders.length > 0 && <Abschnitt titel="Was es besonders macht"><ul className="space-y-1">{besonders.map(b => <li key={b} className="flex gap-2"><span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{b}</li>)}</ul></Abschnitt>}
        {kultur && <Abschnitt titel="Kultur und Zusammenarbeit"><p>{kultur}</p></Abschnitt>}
        {(abteilung || berichtet) && <Abschnitt titel="Abteilung">
          {abteilung && <p>{abteilung}</p>}
          {berichtet && <p className="text-muted-foreground">Die Stelle berichtet an: {berichtet}</p>}
        </Abschnitt>}
        {!besonders.length && !kultur && !abteilung && <p className="text-muted-foreground">Zum Unternehmen hat der Kunde noch nichts Weiteres angegeben.</p>}
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">Alles vom Kunden aus der Aufnahme.</p>
      </div>
    </SheetContent>
  </Sheet>;
}
