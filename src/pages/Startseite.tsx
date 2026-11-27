import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
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
import { COOKIE_SPRACHE, ausSlug, type Code } from '@/startseite/website/sprachen';
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

function gemerkteSprache(): string | null {
  if (typeof document === 'undefined') return null;
  const eintrag = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_SPRACHE}=`));
  return eintrag ? decodeURIComponent(eintrag.split('=')[1]) : null;
}

export default function Startseite() {
  const { sprache } = useParams<{ sprache?: string }>();
  const code: Code = useMemo(
    () => ausSlug(sprache)?.code ?? ausSlug(gemerkteSprache())?.code ?? 'de',
    [sprache],
  );
  return (
    <div className="mu-schriften">
      <Rahmen code={code} stil="apple" modus="hell">
        {SEKTIONEN.map(([id, Teil]) => (
          <div key={id} className="sa-teil">
            <div className="mu" data-stil="apple" data-modus="hell"><Teil /></div>
          </div>
        ))}
      </Rahmen>
    </div>
  );
}
