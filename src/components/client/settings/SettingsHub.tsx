import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Calendar, ChevronRight, FileText, Lock, Megaphone, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SaveIndicator } from './SettingsShell';
import { fehlendeAuftrittAngaben, fehlendeFirmendaten, type useCompanyProfile } from './useCompanyProfile';

export type Bereich = 'konto' | 'kalender' | 'auftritt' | 'team' | 'unternehmen' | 'vertrag';

// Apple-Stil (22.11.2026): offen = blauer Hinweis mit ›, erledigt = grau, nur „Unterschrieben“ grün.
type Tile = { key: Bereich; icon: ComponentType<{ className?: string }>; title: string; text: string; status: string; tone: 'ok' | 'warn' | 'neutral' | 'signed' };

/**
 * Übersicht der Einstellungen: oben „Noch offen“ (immer nur eine Frage), darunter
 * die Bereiche als Kacheln mit Stand. Firmenbereiche nur für den Inhaber des Kontos,
 * weil Firmenprofil, Rechnungen und Vertrag in der Datenbank an ihm hängen.
 */
export function SettingsHub({ company, companyName, isOwner, financeOnly = false, calendarConnected, contractStatus, teamCount = null, onOpen }: {
  company: ReturnType<typeof useCompanyProfile>;
  companyName: string;
  isOwner: boolean;
  /** Rolle Buchhaltung: nur „Mein Konto“ */
  financeOnly?: boolean;
  calendarConnected: boolean | null;
  /** signed · countersign · awaitingYou · preparing */
  contractStatus: string | null;
  /** Personen im Team, für die Kachel „Team“ */
  teamCount?: number | null;
  onOpen: (b: Bereich) => void;
}) {
  const { t } = useTranslation('clientSettings');
  const { profile, update } = company;
  const offen = isOwner ? fehlendeAuftrittAngaben(profile) : [];
  const [spaeter, setSpaeter] = useState<string[]>([]);
  const fragen = offen.filter((f) => !spaeter.includes(f.feld));
  const frage = fragen[0];
  const [antwort, setAntwort] = useState('');
  const firmaFehlt = isOwner ? fehlendeFirmendaten(profile) : [];

  const speichern = () => {
    if (!frage || !antwort.trim()) return;
    update(frage.feld === 'headcount' ? { headcount: parseInt(antwort, 10) || null } : { unique_selling_point: antwort.trim() });
    setAntwort('');
  };

  const allTiles: Tile[] = [
    { key: 'konto', icon: User, title: t('hub.tiles.konto.title'), text: t('hub.tiles.konto.text'), status: t('hub.tiles.konto.status'), tone: 'neutral' },
    {
      key: 'kalender', icon: Calendar, title: t('hub.tiles.kalender.title'), text: t('hub.tiles.kalender.text'),
      status: calendarConnected == null ? t('hub.tiles.kalender.checking') : calendarConnected ? t('hub.tiles.kalender.connected') : t('hub.tiles.kalender.connectNow'), tone: calendarConnected === false ? 'warn' : 'ok',
    },
    ...(isOwner ? [{
      key: 'auftritt' as const, icon: Megaphone, title: t('hub.tiles.auftritt.title'), text: t('hub.tiles.auftritt.text'),
      status: offen.length ? t('hub.tiles.auftritt.missing', { count: offen.length }) : t('hub.complete'), tone: (offen.length ? 'warn' : 'ok') as Tile['tone'],
    }] : []),
    { key: 'team', icon: Users, title: t('hub.tiles.team.title'), text: t('hub.tiles.team.text'), status: teamCount ? t('hub.tiles.team.people', { count: teamCount }) : t('hub.tiles.team.status'), tone: 'neutral' },
    ...(isOwner ? [
      {
        key: 'unternehmen' as const, icon: Building2, title: t('hub.tiles.unternehmen.title'), text: t('hub.tiles.unternehmen.text'),
        status: firmaFehlt.length ? t('hub.tiles.unternehmen.missing', { fields: firmaFehlt.join(', ') }) : t('hub.complete'), tone: (firmaFehlt.length ? 'warn' : 'ok') as Tile['tone'],
      },
      {
        key: 'vertrag' as const, icon: FileText, title: t('hub.tiles.vertrag.title'), text: t('hub.tiles.vertrag.text'),
        status: contractStatus ? t(`hub.contract.${contractStatus}`) : t('hub.contract.none'), tone: (contractStatus === 'signed' ? 'signed' : contractStatus === 'awaitingYou' ? 'warn' : 'neutral') as Tile['tone'],
      },
    ] : []),
  ];
  const tiles = financeOnly ? allTiles.filter((x) => x.key === 'konto') : allTiles;
  const offenGesamt = offen.length + (firmaFehlt.length ? 1 : 0);
  // Ein Satz zum Stand statt grünem Kasten: was eingerichtet ist und was noch fehlt.
  const kalenderOffen = calendarConnected === false;
  const satz = !isOwner || financeOnly
    ? companyName
    : [
        offenGesamt ? t('hub.summaryOpen', { company: companyName, count: offenGesamt }) : t('hub.summaryReady', { company: companyName }),
        kalenderOffen ? (offenGesamt ? t('hub.calendarAlso') : t('hub.calendarOnly')) : null,
      ].filter(Boolean).join(' ');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('hub.title')}</h1>
        <p className="mt-1 text-base">{satz}</p>
      </div>

      {isOwner && (frage ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium">{t('hub.stillOpen')}</h2><SaveIndicator state={company.saveState} /></div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">{t('hub.questionOf', { n: offen.indexOf(frage) + 1, total: offen.length })}</p>
            <p className="mt-1 text-base font-medium">{frage.frage}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{frage.hilfe}</p>
            <div className="mt-4 flex flex-wrap items-start gap-2">
              {frage.feld === 'headcount'
                ? <Input type="number" className="max-w-48" value={antwort} onChange={(e) => setAntwort(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && speichern()} placeholder={t('hub.headcountPh')} />
                : <Textarea rows={2} className="min-w-64 flex-1" value={antwort} onChange={(e) => setAntwort(e.target.value)} placeholder={t('hub.uspPh')} />}
              <Button onClick={speichern} disabled={!antwort.trim()}>{t('hub.save')}</Button>
              <Button variant="ghost" onClick={() => { setSpaeter((s) => [...s, frage.feld]); setAntwort(''); }}>{t('hub.later')}</Button>
            </div>
          </div>
          {fragen[1] && <p className="px-1 text-sm text-muted-foreground">{t('hub.nextUp', { question: fragen[1].frage })}</p>}
        </section>
      ) : null)}

      <section className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ key, icon: Icon, title, text, status, tone }) => (
            <button
              key={key}
              type="button"
              onClick={() => onOpen(key)}
              className="group rounded-xl border bg-card p-5 text-left transition-colors hover:bg-secondary/60"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-klick" />
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
              <p className={cn('mt-3 text-xs', tone === 'signed' ? 'text-green-600' : tone === 'warn' ? 'font-medium text-klick' : 'text-muted-foreground')}>{status}{tone === 'warn' && ' ›'}</p>
            </button>
          ))}
        </div>
        {!isOwner && (
          <p className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />{financeOnly
            ? t('hub.financeOnly')
            : t('hub.ownerOnly')}</p>
        )}
      </section>
    </div>
  );
}
