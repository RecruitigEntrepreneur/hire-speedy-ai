import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, Loader2, TriangleAlert } from 'lucide-react';

/**
 * Die Unterschrift auf unserer Seite, nicht auf DocuSigns.
 *
 * DocuSign liefert eine kurzlebige Ansicht aus, die wir einbetten dürfen —
 * erlaubt nur, weil docusign-send `frameAncestors` mitschickt. Ohne das setzt
 * DocuSign eine CSP, die das Einbetten verbietet, und der Rahmen bliebe leer.
 *
 * Zwei Wege führen zum Abschluss, und beide sind nötig:
 *
 *  1. DocuSign schickt eine `postMessage` an das umgebende Fenster.
 *  2. Der Rahmen wird auf unsere Rückkehr-Adresse geleitet, und die dortige
 *     Seite meldet sich beim Elternfenster.
 *
 * Der zweite Weg trägt allein, wenn die Nachricht ausbleibt — was je nach
 * Kontoeinstellung vorkommt. Auf nur einen zu setzen hieße, den Kunden vor
 * einem fertig unterschriebenen Vertrag sitzen zu lassen, ohne dass die Seite
 * es merkt.
 */

interface Props {
  url: string;
  onDone: () => void;
  /**
   * Der Lauf endete OHNE Unterschrift -- abgelaufen, abgebrochen, abgelehnt.
   *
   * BEFUND (09.09.2026): Danach blieb die alte Adresse im Zustand stehen. Der
   * Rahmen zeigte eine tote Seite, und die Frage "wer unterschreibt" kam nicht
   * zurueck, weil sie nur ohne Adresse erscheint. Der Kunde war
   * eingeschlossen: kein Vertrag, kein Weg zu einem neuen Link, ausser die
   * Seite von Hand neu zu laden.
   */
  onAbbruch?: (event: string) => void;
}

export function SignFrame({ url, onDone, onAbbruch }: Props) {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  /**
   * Der Rahmen meldet sich nicht.
   *
   * BEFUND (09.09.2026): DocuSign erlaubt das Einbetten nur fuer die Adressen
   * in `frameAncestors`. Stimmt die Herkunft nicht -- ein Test auf localhost,
   * ein Unternehmens-Proxy, strenge Drittanbieter-Einstellungen --, bleibt der
   * Rahmen leer, und der Kunde sitzt vor "Vertrag wird geladen ..." bis die
   * Adresse abgelaufen ist. Sie gilt nur wenige Minuten und nur einmal.
   *
   * Nach sechs Sekunden ohne Ladeereignis steht deshalb der Weg daneben,
   * statt ihn klein unter dem Rahmen zu verstecken.
   */
  const [haengt, setHaengt] = useState(false);
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setHaengt(true), 6000);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Nur DocuSign und unsere eigene Rückkehrseite dürfen hier sprechen.
      const erlaubt = /^https:\/\/apps(-d)?\.docusign\.com$/.test(e.origin)
        || e.origin === window.location.origin;
      if (!erlaubt) return;

      const event = typeof e.data === 'string' ? e.data : (e.data?.event ?? e.data?.type);
      if (typeof event !== 'string') return;

      /**
       * Nur `signing_complete` ist eine Unterschrift.
       *
       * BEFUND (09.09.2026): Hier galten auch `viewing_complete` und
       * `matchunt:signed` als unterschrieben. `viewing_complete` heisst, dass
       * jemand das Dokument ANGESEHEN hat -- oeffnen und schliessen reichte,
       * um "Ihre Unterschrift liegt vor" zu lesen. Und `matchunt:signed`
       * schickte unsere eigene Rueckkehrseite bei JEDEM Ausgang, auch bei
       * abgelaufener Sitzung und bei Ablehnung.
       *
       * Ein `test()` auf einer Alternativenliste passte ausserdem auf
       * Teilzeichenketten -- der Name allein war schon die halbe Miete.
       * Deshalb Gleichheit statt Muster.
       */
      if (event === 'signing_complete') {
        setDone(true);
        onDone();
        return;
      }

      /* Alles andere, was von UNSERER Rueckkehrseite kommt, ist ein Ende ohne
         Unterschrift. DocuSigns eigene Nachrichten melden auch Zwischen-
         zustaende, deshalb nur die eigene Herkunft. */
      if (e.origin === window.location.origin && e.data?.type === 'matchunt:sign-return') {
        onAbbruch?.(event);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onDone]);

  if (done) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Vielen Dank — Ihre Unterschrift liegt vor. Matchunt zeichnet gegen; sobald das
          geschehen ist, starten wir die Suche.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border" style={{ height: '78vh', minHeight: 520 }}>
        {!ready && !haengt && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Vertrag wird geladen …
          </div>
        )}
        {!ready && haengt && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <TriangleAlert className="h-5 w-5 text-amber-600" />
            <p className="text-sm font-medium">Der Vertrag lässt sich hier nicht anzeigen</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Manche Browser und Firmennetze verbieten das Einbetten. Öffnen Sie ihn
              in einem neuen Fenster — der Link gilt nur wenige Minuten.
            </p>
            <Button asChild size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                Vertrag im neuen Fenster öffnen <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        )}
        <iframe
          src={url}
          title="Vertrag unterzeichnen"
          onLoad={() => setReady(true)}
          className="h-full w-full"
          allow="camera; microphone; geolocation"
        />
      </div>
      {/* Rückfallebene: Blockiert ein Browser das Einbetten — strenge
          Drittanbieter-Einstellungen, ein Unternehmens-Proxy —, bleibt der
          Rahmen leer. Dann führt dieser Weg trotzdem zum Ziel. */}
      <p className="text-xs text-muted-foreground">
        Der Vertrag lädt nicht?{' '}
        <Button asChild variant="link" className="h-auto p-0 text-xs">
          <a href={url} target="_blank" rel="noreferrer">
            In neuem Fenster öffnen <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
        </Button>
      </p>
    </div>
  );
}
