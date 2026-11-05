import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { terminSeiteApi, type AnfrageDaten } from '@/lib/terminApi';
import { LebenslaufNachreichen } from '@/components/termin/LebenslaufNachreichen';
import { TerminFuss, TerminKopf } from './TerminSeite';

/**
 * Lebenslauf-Anfrage ohne Termin (05.11.2026): matchunt.ai/t/lebenslauf/<token>. Der Kandidat
 * lädt den Lebenslauf hoch oder gibt sein LinkedIn-Profil an; der Link gehört nur ihm.
 */
export default function TerminLebenslauf() {
  const { token = '' } = useParams();
  const [d, setD] = useState<AnfrageDaten | null>(null);
  const [ladeFehler, setLadeFehler] = useState('');

  useEffect(() => {
    document.title = 'Lebenslauf · Matchunt';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    terminSeiteApi.anfrage(token).then(setD).catch(e => setLadeFehler(e instanceof Error ? e.message : 'Diese Anfrage gibt es nicht.'));
    return () => { robots.remove(); };
  }, [token]);

  const huelle = (inhalt: React.ReactNode) => <div className="min-h-screen bg-background">
    <TerminKopf/>
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10"><div className="rounded-xl border border-border bg-card p-5 sm:p-7">{inhalt}</div></main>
    <TerminFuss/>
  </div>;

  if (ladeFehler) return huelle(<><h1 className="text-xl font-semibold">Diese Anfrage gibt es nicht</h1><p className="mt-2 text-sm text-muted-foreground">{ladeFehler}</p></>);
  if (!d) return <div className="min-h-screen bg-background"><TerminKopf/><main className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></main></div>;

  const hh = d.headhunter;
  const hhVorname = hh.name.split(' ')[0];

  if (d.stand === 'erledigt') {
    return huelle(<div className="space-y-2"><CheckCircle2 className="h-8 w-8 text-emerald-600"/><h1 className="text-xl font-semibold">Danke, {hhVorname} hat deinen Lebenslauf</h1><p className="text-sm text-muted-foreground">Du musst nichts weiter tun.</p></div>);
  }
  if (d.stand !== 'offen') {
    return huelle(<><h1 className="text-xl font-semibold">{d.stand === 'abgelaufen' ? 'Dieser Link ist abgelaufen' : 'Diese Anfrage gilt nicht mehr'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{d.stand === 'abgelaufen' ? `Schreib ${hhVorname} kurz, dann bekommst du einen neuen Link.` : `Bei Fragen melde dich gern direkt bei ${hhVorname}.`}</p></>);
  }

  return huelle(<div className="space-y-5">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{hh.initialen}</span>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight">Hallo {d.vorname}, {hhVorname} bittet um deinen Lebenslauf</h1>
        <p className="text-sm text-muted-foreground">{hh.name}{hh.titel ? ` · ${hh.titel}` : ' · Headhunter'} · vertraulich</p>
      </div>
    </div>
    <LebenslaufNachreichen ziel={{ anfrage: token }} hhName={hh.name} linkedinHinweis={`Kein aktueller Lebenslauf? Dein LinkedIn-Profil hilft ${hhVorname} für den Anfang.`}/>
  </div>);
}
