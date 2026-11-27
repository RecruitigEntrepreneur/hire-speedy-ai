import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Einstieg from '@/startseite/neu/k12-einstieg-suche';
import Logos from '@/startseite/matchunt/s09-2-logos';
import Klammer from '@/startseite/matchunt/s12-1-klammer';
import SatzWeg from '@/startseite/matchunt/s18-4-satzweg-blau';
import Bahnen from '@/startseite/neu/kb3-bahnen';
import Preis from '@/startseite/matchunt/s15-4-preis';
import Plattform from '@/startseite/neu/pf4-plattform';
import Notizen from '@/startseite/matchunt/s39-notizen';
import Aufgaben from '@/startseite/matchunt/s42-aufgaben';
import Fragen from '@/startseite/matchunt/s80-fragen';
import { Rahmen } from '@/startseite/website/Rahmen';
import { Kopf } from '@/startseite/website/Kopf';
import type { Code } from '@/startseite/website/sprachen';
import { websiteSprache } from './website/sprache';
import '@/startseite/matchunt/stil.css';
import '@/startseite/seiten/seiten.css';
import '@/startseite/schriften.css';

/**
 * Die Website: Startseite C aus dem Website-Labor (27.11.2026, Marko: „ersetzen und live bringen“).
 *
 * Die Sektionen liegen unter src/startseite und kommen per `node scripts/startseite-aus-labor.mjs`
 * aus dem Labor (dort wird weiter gefeilt). Diese Datei legt nur Reihenfolge, Rahmen und Sprache fest.
 * „/“ zeigt Deutsch (oder die im Menü gewählte Sprache), „/w/<sprache>“ eine bestimmte.
 */
const SEKTIONEN = [
  ['neu:k12', Einstieg], ['rm:1@2', Logos], ['lo:1@1', Klammer], ['le:0@4', SatzWeg], ['neu:kb3', Bahnen],
  ['un:4@4', Preis], ['neu:pf4', Plattform], ['co:4', Notizen], ['jo:2', Aufgaben], ['rl:5', Fragen],
] as const;

/** Titel im Browser-Tab und für Suchmaschinen, je Sprache (Österreich und Schweiz lesen Deutsch). */
const TITEL: Record<string, string> = {
  de: 'Matchunt · Die beste Person für Ihre Stelle',
  en: 'Matchunt · The best person for your position',
  sv: 'Matchunt · Den bästa personen för din tjänst',
  nb: 'Matchunt · Den beste personen for stillingen din',
};

/** Sprungmarken der Kopfzeile („Ablauf“, „Honorar“), auch von den Unterseiten aus (/#ablauf). */
const ANKER: Record<string, string> = { 'le:0@4': 'ablauf', 'un:4@4': 'honorar' };

export default function Startseite() {
  const { sprache } = useParams<{ sprache?: string }>();
  const code: Code = useMemo(() => websiteSprache(sprache), [sprache]);
  const { hash } = useLocation();
  useEffect(() => { document.title = TITEL[code.slice(0, 2)] ?? TITEL.de; }, [code]);
  // Von einer Unterseite kommend (/#ablauf): Die Seite lädt nach, der Browser findet die Marke beim Laden
  // noch nicht. Deshalb nach dem ersten Zeichnen selbst hinspringen.
  useEffect(() => {
    const ziel = hash.slice(1);
    if (!ziel) return;
    const uhr = window.setTimeout(() => document.getElementById(ziel)?.scrollIntoView({ block: 'start' }), 60);
    return () => window.clearTimeout(uhr);
  }, [hash]);
  return (
    <div className="mu-schriften">
      {/* Kopf A und Fuß A (27.11.2026): Kopfzeile bleibt oben stehen. Den blauen Abschluss-Aufruf vor dem Fuß hat
          Marko am selben Tag wieder entfernt – nach den Fragen kommt direkt der Fuß. */}
      <Rahmen code={code} stil="apple" modus="hell" kopf={<Kopf />}>
        {SEKTIONEN.map(([id, Teil]) => (
          <div key={id} id={ANKER[id]} className="sa-teil">
            <div className="mu" data-stil="apple" data-modus="hell"><Teil /></div>
          </div>
        ))}
      </Rahmen>
    </div>
  );
}
