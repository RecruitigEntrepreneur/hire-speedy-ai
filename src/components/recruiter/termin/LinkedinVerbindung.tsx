import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linkedin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { intlLocale } from '@/i18n/languages';
import type { Aktuell } from '@/lib/linkedinAbgleich';
import { LinkedinAbgleichDialog } from './LinkedinAbgleichDialog';
import { useLinkedin, useRuecksprung } from './useTerminseite';

const datum = (iso: string, language: string) => new Date(iso).toLocaleDateString(intlLocale(language), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const RUECKSPRUNG = '/recruiter/profile/ueber-dich#linkedin';

/**
 * Profil › Über dich (16.11.2026): LinkedIn verbinden. Danach liest Matchunt Foto und
 * (mit Datenfreigabe) Werdegang, Sprachen und Fähigkeiten und schlägt vor, was fehlt.
 * Dieselbe Verbindung nutzt das Beitragsfenster zum Posten, nie ohne Klick.
 */
export function LinkedinVerbindung({ aktuell, onUebernommen }: { aktuell: Aktuell; onUebernommen: () => void }) {
  const { t, i18n } = useTranslation('recruiterTermin');
  // Vor useRuecksprung lesen: der räumt ?linkedin= nach dem ersten Zeichnen weg.
  const [frischVerbunden] = useState(() => new URLSearchParams(window.location.search).get('linkedin') === 'verbunden');
  useRuecksprung();
  const { status, isLoading, verbinden, trennen } = useLinkedin();
  const [offen, setOffen] = useState(false);
  const geoeffnet = useRef(false);
  useEffect(() => {
    if (frischVerbunden && status?.verbunden && !geoeffnet.current) { geoeffnet.current = true; setOffen(true); }
  }, [frischVerbunden, status?.verbunden]);

  if (isLoading) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin"/>{t('linkedin.checking')}</p>;

  const rahmen = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5';
  if (!status?.eingerichtet) return <div id="linkedin" className={`${rahmen} border-dashed`}>
    <div className="text-sm text-muted-foreground">
      <p className="flex items-center gap-1.5"><Linkedin className="h-4 w-4"/>{t('linkedin.connectTitle')}</p>
      <p className="text-xs">{t('linkedin.notReady')}</p>
    </div>
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{t('linkedin.soon')}</span>
  </div>;

  return <div id="linkedin" className={rahmen}>
    {status.verbunden ? <div className="text-sm">
      <p className="flex items-center gap-1.5"><Linkedin className="h-4 w-4 text-[#0A66C2]"/>{status.name ? t('linkedin.connectedAs', { name: status.name }) : t('linkedin.connected')}</p>
      <p className="text-xs text-muted-foreground">{status.gueltig_bis ? t('linkedin.validUntil', { date: datum(status.gueltig_bis, i18n.language) }) : t('linkedin.privacyNote')}</p>
    </div> : <div className="text-sm">
      <p className="font-medium">{status.abgelaufen ? t('linkedin.reconfirmTitle') : t('linkedin.connectTitle')}</p>
      <p className="text-xs text-muted-foreground">{t('linkedin.text')}</p>
    </div>}
    {status.verbunden
      ? <div className="flex gap-1.5">
        <Button variant="outline" size="sm" onClick={() => setOffen(true)}>{t('linkedin.resync')}</Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={trennen.isPending} onClick={() => trennen.mutate()}>{t('linkedin.disconnect')}</Button>
      </div>
      : <Button size="sm" className="bg-[#0A66C2] text-white hover:bg-[#004182]" disabled={verbinden.isPending} onClick={() => verbinden.mutate(RUECKSPRUNG)}>
        {verbinden.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Linkedin className="mr-1.5 h-3.5 w-3.5"/>}{status.abgelaufen ? t('linkedin.reconfirm') : t('linkedin.connectTitle')}
      </Button>}
    <LinkedinAbgleichDialog open={offen} onOpenChange={setOffen} aktuell={aktuell} onUebernommen={onUebernommen} onFreigeben={() => verbinden.mutate(RUECKSPRUNG)}/>
  </div>;
}
