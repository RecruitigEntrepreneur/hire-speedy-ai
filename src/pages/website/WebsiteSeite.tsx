import { useEffect, useMemo, type ReactNode } from 'react';
import { Rahmen } from '@/startseite/website/Rahmen';
import { Kopf } from '@/startseite/website/Kopf';
import { texte } from '@/startseite/website/texte';
import { websiteSprache } from './sprache';
import '@/startseite/matchunt/stil.css';
import '@/startseite/seiten/seiten.css';
import '@/startseite/schriften.css';

/**
 * Eine Unterseite der Website im neuen Look (27.11.2026): feste Kopfzeile, Inhalt, Fuß mit Spalten, Sprache und
 * Cookie-Einstellungen – derselbe Rahmen wie die Startseite. Die Sprache kommt aus dem gemerkten Cookie.
 */
export function WebsiteSeite({ titel, children }: { titel: string; children: ReactNode }) {
  const code = useMemo(() => websiteSprache(), []);
  useEffect(() => { document.title = `${titel} · Matchunt`; }, [titel]);
  return (
    <div className="mu-schriften">
      <Rahmen code={code} stil="apple" modus="hell" kopf={<Kopf />}>
        <div className="mu" data-stil="apple" data-modus="hell">{children}</div>
      </Rahmen>
    </div>
  );
}

/** Impressum, Datenschutz, AGB: nur auf Deutsch; in anderen Sprachen steht ein Satz dazu darüber. */
export function RechtsSeite({ titel, children }: { titel: string; children: ReactNode }) {
  const code = useMemo(() => websiteSprache(), []);
  const hinweis = texte(code).recht.nurDeutsch;
  return (
    <WebsiteSeite titel={titel}>
      <main className="mw-rtext" lang="de">
        {hinweis && <p className="mw-rtext-hinweis" lang={code}>{hinweis}</p>}
        <h1>{titel}</h1>
        {children}
      </main>
    </WebsiteSeite>
  );
}
