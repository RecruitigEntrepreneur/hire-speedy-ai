import { useEffect, useRef, useState } from 'react';
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
 *  3. Wir fragen den Server, ob unterschrieben ist (`onPruefen`).
 *
 * Der zweite Weg trägt allein, wenn die Nachricht ausbleibt — was je nach
 * Kontoeinstellung vorkommt. Auf nur einen zu setzen hieße, den Kunden vor
 * einem fertig unterschriebenen Vertrag sitzen zu lassen, ohne dass die Seite
 * es merkt.
 *
 * Der DRITTE Weg ist der einzige, der ohne den Rahmen auskommt — und deshalb
 * der einzige, der immer trägt. Die ersten beiden setzen voraus, dass das
 * Einbetten überhaupt gelingt; gelingt es nicht (localhost, Firmennetz,
 * strenge Drittanbieter-Einstellungen), unterschreibt der Kunde im eigenen
 * Fenster. Das ist kein Kindfenster und meldet uns nichts. Ohne die
 * Serverfrage bliebe diese Seite dann für immer bei „Vertrag wird geladen“,
 * obwohl längst unterschrieben ist.
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
  /**
   * Holt eine FRISCHE Signaturadresse.
   *
   * BEFUND (09.09.2026, an einer echten Aufnahme erlebt): Die Adresse von
   * DocuSign gilt nur wenige Minuten und nur EINMAL. Der Rahmen verbraucht sie
   * schon beim Laden -- auch dann, wenn die Anzeige danach an einer CSP
   * scheitert und der Kunde nur eine schwarze Flaeche sieht. Genau in dieser
   * Lage bot "In neuem Fenster oeffnen" DIESELBE, bereits verbrauchte Adresse
   * an. DocuSign antwortete `ttl_expired` und leitete auf die Rueckkehrseite
   * um. Der Ausweg war also in dem einen Fall tot, fuer den es ihn gibt.
   */
  onNeuerLink?: () => Promise<string | null>;
  /**
   * Fragt den SERVER, ob unterschrieben ist.
   *
   * Der einzige Weg, der weder am Rahmen noch an einer postMessage haengt --
   * und damit der einzige, der auch traegt, wenn der Kunde in einem eigenen
   * Fenster unterschreibt. Das ist kein Kindfenster: es kann uns nichts
   * melden, und DocuSigns Rueckkehr landet auf der oeffentlichen Adresse,
   * nicht in diesem Tab.
   */
  onPruefen?: () => Promise<'offen' | 'unterschrieben' | 'abgelehnt'>;
}

export function SignFrame({ url, onDone, onAbbruch, onNeuerLink, onPruefen }: Props) {
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
   * NACHTRAG, gemessen an der Konsole:
   *   Framing 'https://apps-d.docusign.com/' violates the following Content
   *   Security Policy directive: "frame-ancestors 'self' https://matchunt.ai
   *   https://apps-d.docusign.com". The request has been blocked.
   *
   * Der blockierte Rahmen feuert trotzdem `onLoad` -- der Browser laedt seine
   * eigene Fehlerseite. `ready` wurde also true, der Hinweis blieb aus, und
   * uebrig blieb eine schwarze Flaeche. Auf ein Ladeereignis ist an dieser
   * Stelle kein Verlass; der Weg nach draussen steht deshalb nach sechs
   * Sekunden IMMER da, ueber dem Rahmen statt klein darunter. Traegt der
   * Rahmen, kostet die Zeile eine Zeile.
   */
  const [haengt, setHaengt] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHaengt(true), 6000);
    return () => clearTimeout(t);
  }, []);

  /* Der Weg nach draussen: laeuft, hat einen frischen Link, ist gescheitert. */
  const [externBusy, setExternBusy] = useState(false);
  const [externFehler, setExternFehler] = useState<string | null>(null);
  /**
   * Konnte der Browser das Fenster nicht selbst oeffnen -- Popup-Blocker --,
   * wird der frische Link hier als Knopf angeboten. Ein Klick des Kunden gilt
   * als Geste und wird nie blockiert. Die Alternative waere, den Tab per
   * `location.href` zu verlassen; das reisst die Seite unter dem Kunden weg.
   */
  const [frischerLink, setFrischerLink] = useState<string | null>(null);
  /* Es laeuft eine Unterschrift in einem anderen Fenster. Das zu sagen ist
     kein Schmuck: sonst sieht der Kunde hier den toten Rahmen daneben und
     haelt den Vorgang fuer kaputt. */
  const [wartetExtern, setWartetExtern] = useState(false);

  /**
   * Die Rueckrufe ueber Refs, nicht ueber Abhaengigkeiten.
   *
   * Die Elternseite reicht sie inline weiter -- der Normalfall. Ihre
   * Identitaet wechselt damit bei jedem Rendern, und der Takt unten wuerde
   * bei jedem Rendern neu gesetzt: er liefe nie ab und fragte nie.
   */
  const pruefenRef = useRef(onPruefen);
  const doneRef = useRef(onDone);
  const abbruchRef = useRef(onAbbruch);
  pruefenRef.current = onPruefen;
  doneRef.current = onDone;
  abbruchRef.current = onAbbruch;

  /**
   * Beim Server nachfragen, solange der Vertrag offen ist.
   *
   * Das ist der Weg, der ueberall traegt: er braucht weder ein gelungenes
   * Einbetten noch eine postMessage. Unterschreibt der Kunde in einem eigenen
   * Fenster, ist das hier die EINZIGE Stelle, die es je erfaehrt.
   *
   * Zwei Sparsamkeiten, beide begruendet:
   *
   * Nur im sichtbaren Tab. Jede Abfrage geht bis zu DocuSign durch, und ein
   * vergessener Hintergrundtab soll das nicht eine halbe Stunde lang tun.
   *
   * Und der Takt richtet sich danach, wie sehr wir an dieser Abfrage haengen.
   * Steht der Kunde im eigenen Fenster, ist sie der EINZIGE Weg -- dann alle
   * sechs Sekunden. Traegt der Rahmen, ist sie nur das Netz unter den beiden
   * anderen Wegen -- dann reichen zwanzig. Der Unterschied ist nicht
   * kosmetisch: er trennt rund 300 Fremdaufrufe je Lauf von rund 90.
   */
  useEffect(() => {
    if (done || !pruefenRef.current) return;
    let gestoppt = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abstand = wartetExtern ? 6000 : 20000;
    const schluss = Date.now() + 30 * 60 * 1000;
    const takt = async () => {
      if (gestoppt) return;
      if (document.visibilityState === 'visible') {
        const stand = await pruefenRef.current!().catch(() => 'offen' as const);
        if (gestoppt) return;
        if (stand === 'unterschrieben') { setDone(true); doneRef.current(); return; }
        if (stand === 'abgelehnt') { abbruchRef.current?.('decline'); return; }
      }
      if (Date.now() < schluss) timer = setTimeout(takt, abstand);
    };
    timer = setTimeout(takt, abstand);
    return () => { gestoppt = true; if (timer) clearTimeout(timer); };
  }, [done, wartetExtern]);

  /**
   * Im eigenen Fenster unterschreiben -- mit einer FRISCHEN Adresse.
   *
   * Ohne CSP, ohne Drittanbieter-Sperren, ohne Rahmen. Der Weg, der auch dort
   * funktioniert, wo das Einbetten nie gelingen kann.
   */
  const extern = async () => {
    /* Das Fenster MUSS im Klick selbst entstehen. Eines, das erst nach dem
       Netzaufruf geoeffnet wird, gilt dem Browser als Popup. */
    const fenster = window.open('', '_blank');
    if (!onNeuerLink) {
      if (fenster) { fenster.location.replace(url); setWartetExtern(true); }
      else setFrischerLink(url);
      return;
    }
    setExternBusy(true);
    setExternFehler(null);
    setFrischerLink(null);
    const frisch = await onNeuerLink().catch(() => null);
    setExternBusy(false);
    if (!frisch) {
      fenster?.close();
      setExternFehler('Es ließ sich kein neuer Signaturlink ausstellen. '
        + 'Bitte laden Sie die Seite neu — Ihre Angaben sind gespeichert.');
      return;
    }
    /* "Wir warten" erst sagen, wenn wirklich ein Fenster offen ist.
       BEFUND (09.09.2026, im eigenen Testlauf gesehen): Der Browser hatte das
       Fenster blockiert, der Link stand als Knopf da -- und darunter behauptete
       die Seite trotzdem, der Vertrag sei "im anderen Fenster geoeffnet". Eine
       kleine Unwahrheit, aber genau die Sorte, die diesen ganzen Ablauf
       vergiftet hat. */
    if (fenster) { fenster.location.replace(frisch); setWartetExtern(true); }
    else setFrischerLink(frisch);
  };

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
      {haengt && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-xs">
            <span className="font-medium">Sehen Sie hier keinen Vertrag?</span>{' '}
            Manche Browser und Firmennetze verbieten das Einbetten. Im eigenen
            Fenster geht es immer — wir stellen dafür einen frischen Link aus.
          </p>
          <Button size="sm" className="shrink-0" onClick={extern} disabled={externBusy}>
            {externBusy
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Link wird ausgestellt …</>
              : <>Im neuen Fenster öffnen <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></>}
          </Button>
        </div>
      )}

      {/* Popup blockiert: der frische Link als Knopf. Ein Klick des Kunden
          gilt als Geste und wird nicht abgewiesen. */}
      {frischerLink && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
          <p className="min-w-0 flex-1 text-xs">
            Ihr Browser hat das Fenster nicht geöffnet. Hier ist der Vertrag:
          </p>
          <Button asChild size="sm" className="shrink-0">
            <a href={frischerLink} target="_blank" rel="noreferrer"
               onClick={() => setWartetExtern(true)}>
              Vertrag öffnen <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}

      {externFehler && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">{externFehler}</AlertDescription>
        </Alert>
      )}

      {/* Ohne diese Zeile sitzt der Kunde neben einem toten Rahmen und weiss
          nicht, dass die Seite auf ihn wartet. */}
      {wartetExtern && !externFehler && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Der Vertrag ist im anderen Fenster geöffnet. Sobald Sie dort unterschrieben
          haben, geht es hier von selbst weiter — dieses Fenster bitte offen lassen.
        </p>
      )}
      <div className="relative overflow-hidden rounded-lg border" style={{ height: '78vh', minHeight: 520 }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Vertrag wird geladen …
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
        <Button variant="link" className="h-auto p-0 text-xs" onClick={extern} disabled={externBusy}>
          In neuem Fenster öffnen <ExternalLink className="ml-1 inline h-3 w-3" />
        </Button>
      </p>
    </div>
  );
}
