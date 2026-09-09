import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';

/**
 * Was zu dieser Position NICHT erhoben wurde.
 *
 * Der Grund fuer diese Karte: eine leere Stelle im Briefing wurde bisher mit
 * KI-Text gefuellt. Gemessen an einem echten Job stand auf der Seite
 * "Teamgroesse: Skalierendes Tech-Team" und "Interview-Prozess: ca. 2-3 Wochen",
 * waehrend in der Datenbank zu beidem nichts stand. Der Headhunter erzaehlt so
 * etwas am Telefon weiter und merkt den Fehler erst, wenn der Kandidat
 * abspringt.
 *
 * Eine benannte Luecke ist ehrlicher und nuetzlicher als eine erfundene
 * Antwort: sie sagt dem Recruiter, worauf er sich nicht verlassen darf.
 */

export interface OffenerPunkt {
  frage: string;
  vorhanden: boolean;
  /**
   * Erhoben, aber fuer diesen Recruiter noch gesperrt.
   *
   * Manche Angaben stehen in `recruiter_jobs_view` hinter dem Reveal-Gate --
   * der Arbeitsalltag zum Beispiel. Vor dem Reveal liest die Seite dort NULL.
   * Ohne diese Unterscheidung stuende "nicht erhoben" ueber etwas, das der
   * Kunde beantwortet hat: eine Falschaussage in die andere Richtung.
   */
  gesperrt?: boolean;
}

export function JobOpenPoints({ punkte }: { punkte: OffenerPunkt[] }) {
  const offen = punkte.filter((p) => !p.vorhanden && !p.gesperrt);
  const spaeter = punkte.filter((p) => !p.vorhanden && p.gesperrt);
  if (offen.length === 0 && spaeter.length === 0) return null;

  return (
    <Card className="border-border/30 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Nicht erhoben</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Zu diesen Punkten liegt uns nichts vom Kunden vor. Verlass dich im Gespräch nicht darauf.
        </p>
        <ul className="space-y-1.5">
          {offen.map((p) => (
            <li key={p.frage} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-muted-foreground/50">·</span>
              {p.frage}
            </li>
          ))}
        </ul>

        {spaeter.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Erhoben, aber erst nach dem Reveal sichtbar:
            </p>
            <ul className="space-y-1.5">
              {spaeter.map((p) => (
                <li key={p.frage} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-muted-foreground/50">·</span>
                  {p.frage}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
