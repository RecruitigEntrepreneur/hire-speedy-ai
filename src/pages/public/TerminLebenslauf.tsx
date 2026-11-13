import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('candidatePages');
  const [d, setD] = useState<AnfrageDaten | null>(null);
  const [ladeFehler, setLadeFehler] = useState('');

  useEffect(() => {
    document.title = t('anfrage.docTitle');
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    terminSeiteApi.anfrage(token).then(setD).catch(e => setLadeFehler(e instanceof Error ? e.message : t('anfrage.notFound')));
    return () => { robots.remove(); };
  }, [token, t]);

  const huelle = (inhalt: React.ReactNode) => <div className="min-h-screen bg-background">
    <TerminKopf/>
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10"><div className="rounded-xl border border-border bg-card p-5 sm:p-7">{inhalt}</div></main>
    <TerminFuss/>
  </div>;

  if (ladeFehler) return huelle(<><h1 className="text-xl font-semibold">{t('anfrage.notFoundTitle')}</h1><p className="mt-2 text-sm text-muted-foreground">{ladeFehler}</p></>);
  if (!d) return <div className="min-h-screen bg-background"><TerminKopf/><main className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></main></div>;

  const hh = d.headhunter;
  const hhVorname = hh.name.split(' ')[0];

  if (d.stand === 'erledigt') {
    return huelle(<div className="space-y-2"><CheckCircle2 className="h-8 w-8 text-emerald-600"/><h1 className="text-xl font-semibold">{t('anfrage.thanks', { name: hhVorname })}</h1><p className="text-sm text-muted-foreground">{t('anfrage.nothingToDo')}</p></div>);
  }
  if (d.stand !== 'offen') {
    return huelle(<><h1 className="text-xl font-semibold">{d.stand === 'abgelaufen' ? t('anfrage.expiredTitle') : t('anfrage.withdrawnTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{d.stand === 'abgelaufen' ? t('common.expiredHint', { name: hhVorname }) : t('common.contactDirectly', { name: hhVorname })}</p></>);
  }

  return huelle(<div className="space-y-5">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{hh.initialen}</span>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight">{t('anfrage.hello', { first: d.vorname, name: hhVorname })}</h1>
        <p className="text-sm text-muted-foreground">{hh.name} · {hh.titel ?? t('common.headhunter')} {t('anfrage.confidential')}</p>
      </div>
    </div>
    <LebenslaufNachreichen ziel={{ anfrage: token }} hhName={hh.name} linkedinHinweis={t('anfrage.linkedinHint', { name: hhVorname })}/>
  </div>);
}
