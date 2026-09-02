import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * Rückkehrseite nach der Unterschrift.
 *
 * Läuft im iframe: DocuSign leitet den Rahmen nach der Unterschrift hierher.
 * Die Seite meldet dem umgebenden Fenster, dass unterschrieben wurde — das ist
 * der verlässliche Weg, weil DocuSigns eigene `postMessage` je nach
 * Kontoeinstellung ausbleibt.
 *
 * Wird sie ausnahmsweise im Hauptfenster geöffnet, zeigt sie schlicht eine
 * Bestätigung, statt eine leere Seite zu sein.
 */
export default function SignReturn() {
  useEffect(() => {
    const event = new URLSearchParams(window.location.search).get('event') ?? 'signing_complete';
    if (window.parent && window.parent !== window) {
      // Zielherkunft bewusst eng: nur das eigene Fenster, nicht '*'.
      window.parent.postMessage({ type: 'matchunt:signed', event }, window.location.origin);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
        <h1 className="text-lg font-semibold">Unterschrift eingegangen</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vielen Dank. Matchunt zeichnet gegen — danach starten wir die Suche.
          Sie können dieses Fenster schließen.
        </p>
      </div>
    </div>
  );
}
