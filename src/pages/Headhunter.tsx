import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Einstieg from '@/startseite/neu/h1-einstieg';
import Schritte from '@/startseite/matchunt/s19-hhschritte';
import Film from '@/startseite/matchunt/s49-hhfilm';
import Fertig from '@/startseite/neu/h2-fertig';
import Werkzeug from '@/startseite/neu/h5-werkzeug';
import Name from '@/startseite/neu/h7-name';
import Deins from '@/startseite/neu/h4-deins';
import Regeln from '@/startseite/neu/h6-regeln';
import Fragen from '@/startseite/neu/h9-fragen';
import Start from '@/startseite/neu/h8-start';
import Verdienst from '@/startseite/neu/h3-verdienst';
import { Rahmen } from '@/startseite/website/Rahmen';
import { Kopf } from '@/startseite/website/Kopf';
import { Abschluss } from '@/startseite/website/Abschluss';
import { websiteSprache } from './website/sprache';
import '@/startseite/matchunt/stil.css';
import '@/startseite/seiten/seiten.css';
import '@/startseite/schriften.css';

/**
 * „Für Headhunter“: Seite H aus dem Website-Labor (27.11.2026, Marko: „soll doch auf die Headhunter-Seite zeigen“).
 * Inhalt noch nicht final – Marko geht die Sektionen einzeln durch. Kommt per `node scripts/startseite-aus-labor.mjs`.
 * Ohne jo:3 „Geflecht“ (braucht die 3D-Bibliothek three, die die App nicht hat).
 */
const SEKTIONEN = [
  ['neu:h1', Einstieg], ['lo:5', Schritte], ['r1:7', Film], ['neu:h2', Fertig], ['neu:h5', Werkzeug],
  ['neu:h7', Name], ['neu:h4', Deins], ['neu:h6', Regeln], ['neu:h9', Fragen], ['neu:h8', Start], ['neu:h3', Verdienst],
] as const;

/** Sprungmarken der Kopfzeile dieser Seite („Ablauf“, „Verdienst“). */
const ANKER: Record<string, string> = { 'lo:5': 'ablauf', 'neu:h3': 'verdienst' };

export default function Headhunter() {
  const code = useMemo(() => websiteSprache(), []);
  const { hash } = useLocation();
  useEffect(() => { document.title = 'Für Headhunter · Matchunt'; }, []);
  useEffect(() => {
    const ziel = hash.slice(1);
    if (!ziel) return;
    const uhr = window.setTimeout(() => document.getElementById(ziel)?.scrollIntoView({ block: 'start' }), 60);
    return () => window.clearTimeout(uhr);
  }, [hash]);
  return (
    <div className="mu-schriften">
      <Rahmen code={code} stil="apple" modus="hell" kopf={<Kopf art="headhunter" />}>
        {SEKTIONEN.map(([id, Teil]) => (
          <div key={id} id={ANKER[id]} className="sa-teil">
            <div className="mu" data-stil="apple" data-modus="hell"><Teil /></div>
          </div>
        ))}
        <div className="mu" data-stil="apple" data-modus="hell"><Abschluss art="headhunter" /></div>
      </Rahmen>
    </div>
  );
}
