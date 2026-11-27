import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

/** Die Texte stehen in den Sprachdateien (clientFunnel: signReturn.*). */
const TEXTE: Record<Ausgang, 'signed' | 'declined' | 'aborted'> = {
  unterschrieben: 'signed',
  abgelehnt: 'declined',
  abgebrochen: 'aborted',
};

/** Headhunter unterschreiben auf /recruiter/unterschrift-fertig: gleiche Seite, du-Form (signReturnDu.*). Im Rahmen ist sie kaum zu sehen. */
export default function SignReturn({ du = false }: { du?: boolean }) {
  const { t } = useTranslation('clientFunnel');
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

  const gruppe = du ? 'signReturnDu' : 'signReturn';
  const titel = t(`${gruppe}.${TEXTE[ausgang]}Title`);
  const text = t(`${gruppe}.${TEXTE[ausgang]}Text`);
  const Symbol = ausgang === 'unterschrieben' ? CheckCircle2
               : ausgang === 'abgelehnt' ? XCircle : TriangleAlert;
  // Grün nur, wenn wirklich unterschrieben ist; Ablehnung und Abbruch ruhig grau (26.11.2026).
  const farbe = ausgang === 'unterschrieben' ? 'text-emerald-600' : 'text-foreground';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Symbol className={`h-[22px] w-[22px] ${farbe}`} />
        </span>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{titel}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
