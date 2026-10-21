import type { ReactNode } from 'react';
import { MessageCircleQuestion, Square } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { MandatsBriefing } from '@/lib/mandatsBriefing';

/**
 * Gesprächsleitfaden (21.10.2026): das Werkzeug an Schritt 4 des Briefings,
 * ersetzt den Screening-Leitfaden. Hier dürfen KI-Vorschläge stehen
 * (Einstieg, Fachfragen), klar als Vorschlag; das Briefing selbst zeigt nur
 * Angaben des Kunden. Keine automatische Eignungsentscheidung.
 */
function Teil({ titel, hinweis, children }: { titel: string; hinweis?: string; children: ReactNode }) {
  return <section className="space-y-2">
    <h3 className="text-sm font-medium">{titel}{hinweis && <span className="ml-2 text-xs font-normal text-muted-foreground">{hinweis}</span>}</h3>
    {children}
  </section>;
}

export function GespraechsleitfadenSheet({ open, onOpenChange, jobTitle, anruf, muss, hinterlegt }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  anruf: MandatsBriefing['anruf'];
  muss: string[];
  /** Screening-Fragen, die beim Job hinterlegt sind. */
  hinterlegt: string[];
}) {
  // Was unter „Gleich klären“ schon steht (Sprache, Ort, Gehalt), nicht noch einmal abfragen.
  const geklaert = anruf.knockout.map(k => k.text.toLocaleLowerCase('de-DE'));
  const nachfragen = muss.filter(m => !geklaert.includes(m.toLocaleLowerCase('de-DE')));
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader className="text-left">
        <SheetTitle>Gesprächsleitfaden</SheetTitle>
        <SheetDescription>{jobTitle} · Für dein erstes Gespräch mit dem Kandidaten, keine automatische Eignungsentscheidung.</SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-6 text-sm leading-6">
        {anruf.einstieg && <Teil titel="Einstieg" hinweis="Vorschlag der KI"><p>„{anruf.einstieg}“</p></Teil>}
        {anruf.vorwissen.length > 0 && <Teil titel="Vorher wissen"><ul className="space-y-1 text-amber-700">{anruf.vorwissen.map(v => <li key={v}>{v}</li>)}</ul></Teil>}
        <Teil titel="Gleich klären">
          <ul className="space-y-1">{anruf.knockout.map(k => <li key={k.text} className={`flex gap-2 ${k.fehlt ? 'text-amber-700' : ''}`}><Square className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{k.text}</li>)}</ul>
        </Teil>
        {nachfragen.length > 0 && <Teil titel="Muss-Kriterien nachfragen">
          <p className="text-muted-foreground">Zu jedem Punkt: In welcher Situation hast du das gemacht? Was hast du selbst verantwortet, mit welchem Ergebnis?</p>
          <ul className="space-y-1.5">{nachfragen.map(m => <li key={m} className="flex gap-2"><Square className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{m}</li>)}</ul>
        </Teil>}
        {anruf.fragen.length > 0 && <Teil titel="Fachfragen" hinweis="Vorschlag der KI">
          <ul className="space-y-1.5">{anruf.fragen.map(f => <li key={f.frage} className="flex gap-2"><MessageCircleQuestion className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{f.frage}</li>)}</ul>
        </Teil>}
        {hinterlegt.length > 0 && <Teil titel="Hinterlegte Screening-Fragen"><ul className="list-disc space-y-1 pl-5">{hinterlegt.map((q, i) => <li key={i}>{q}</li>)}</ul></Teil>}
        <Teil titel="Rahmen abgleichen">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Welche Aufgabe und welches Umfeld suchst du als Nächstes?</li>
            <li>Gehaltsvorstellung und Verfügbarkeit</li>
            <li>Passt das Arbeits- und Präsenzmodell?</li>
            <li>Was möchtest du vor einer Vorstellung noch klären?</li>
          </ul>
        </Teil>
      </div>
    </SheetContent>
  </Sheet>;
}
