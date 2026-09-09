import { useEffect, useMemo } from 'react';
import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react';

/**
 * Rückkehrseite nach dem Signaturlauf.
 *
 * BEFUND (09.09.2026, vom Kunden gemeldet): Diese Seite meldete
 * "Unterschrift eingegangen" — bei JEDEM Ausgang. Der Kunde landete hier mit
 * `?event=ttl_expired`, also nachdem die Signatursitzung abgelaufen war, ohne
 * je ein Dokument gesehen zu haben, und las eine Bestätigung samt "Matchunt
 * zeichnet gegen — danach starten wir die Suche".
 *
 * Das ist die folgenschwerste Falschaussage im ganzen Ablauf: Der Kunde geht
 * davon aus, beauftragt zu haben. Er wartet auf Kandidaten, wir warten auf
 * eine Unterschrift, und niemand merkt es, bis einer nachfragt.
 *
 * DocuSign meldet den Ausgang im Parameter `event`. Diese Seite behauptet
 * eine Unterschrift ab jetzt nur noch, wenn dort `signing_complete` steht.
 * Alles andere wird benannt — auch `viewing_complete`, denn "angesehen" ist
 * nicht "unterschrieben".
 */

type Ausgang = 'unterschrieben' | 'abgelehnt' | 'abgebrochen';

const AUSGANG: Record<string, Ausgang> = {
  signing_complete: 'unterschrieben',
  decline: 'abgelehnt',
};

const TEXTE: Record<Ausgang, { titel: string; text: string }> = {
  unterschrieben: {
    titel: 'Unterschrift eingegangen',
    text: 'Vielen Dank. Matchunt zeichnet gegen — danach starten wir die Suche. '
        + 'Sie können dieses Fenster schließen.',
  },
  abgelehnt: {
    titel: 'Sie haben die Unterschrift abgelehnt',
    text: 'Der Vertrag ist damit nicht zustande gekommen und die Suche startet nicht. '
        + 'Ihre Aufnahme bleibt gespeichert — melden Sie sich, wenn Sie etwas ändern möchten.',
  },
  abgebrochen: {
    titel: 'Noch nicht unterschrieben',
    text: 'Der Signaturvorgang wurde beendet, ohne dass eine Unterschrift zustande kam — '
        + 'meist, weil das Fenster zu lange offen stand. Ihre Aufnahme ist gespeichert, '
        + 'nichts ist verloren. Sie bekommen einen neuen Link; solange gilt kein Vertrag '
        + 'und die Suche startet nicht.',
  },
};

export default function SignReturn() {
  const event = useMemo(
    () => new URLSearchParams(window.location.search).get('event') ?? '',
    [],
  );
  const ausgang: Ausgang = AUSGANG[event] ?? 'abgebrochen';

  useEffect(() => {
    if (window.parent && window.parent !== window) {
      /* Den ROHEN Ausgang melden, nicht "signed". Vorher hiess die Nachricht
         `matchunt:signed`, egal was passiert war -- der Rahmen ausserhalb
         konnte gar nicht unterscheiden. Ohne `event` gibt es keine Aussage. */
      window.parent.postMessage(
        { type: 'matchunt:sign-return', event: event || 'unknown' },
        window.location.origin,
      );
    }
  }, [event]);

  const { titel, text } = TEXTE[ausgang];
  const Symbol = ausgang === 'unterschrieben' ? CheckCircle2
               : ausgang === 'abgelehnt' ? XCircle : TriangleAlert;
  const farbe = ausgang === 'unterschrieben' ? 'text-emerald-600'
              : ausgang === 'abgelehnt' ? 'text-destructive' : 'text-amber-600';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <Symbol className={`mx-auto mb-3 h-8 w-8 ${farbe}`} />
        <h1 className="text-lg font-semibold">{titel}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
