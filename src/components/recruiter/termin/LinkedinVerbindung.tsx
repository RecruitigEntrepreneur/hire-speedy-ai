import { CheckCircle2, Linkedin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { useLinkedin, useRuecksprung } from './useTerminseite';

const datum = (iso: string, language: string) => new Date(iso).toLocaleDateString(intlLocale(language), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });

/** Profil › Über dich: ob Matchunt nach deiner Freigabe für dich auf LinkedIn posten darf. */
export function LinkedinVerbindung() {
  const { t, i18n } = useTranslation('recruiterTermin');
  useRuecksprung();
  const { status, isLoading, verbinden, trennen } = useLinkedin();
  if (isLoading) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin"/>{t('linkedin.checking')}</p>;
  if (!status?.eingerichtet) return <p className="text-xs text-muted-foreground">{t('linkedin.notReady')}</p>;
  return <div id="linkedin" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
    {status.verbunden ? <div className="text-sm">
      <p className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4"/>{status.name ? t('linkedin.connectedAs', { name: status.name }) : t('linkedin.connected')}</p>
      {status.gueltig_bis && <p className="text-xs text-muted-foreground">{t('linkedin.validUntil', { date: datum(status.gueltig_bis, i18n.language) })}</p>}
    </div> : <div className="text-sm">
      <p className="font-medium">{status.abgelaufen ? t('linkedin.reconfirmTitle') : t('linkedin.connectTitle')}</p>
      <p className="text-xs text-muted-foreground">{t('linkedin.text')}</p>
    </div>}
    {status.verbunden
      ? <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={trennen.isPending} onClick={() => trennen.mutate()}>{t('linkedin.disconnect')}</Button>
      : <Button size="sm" className="bg-[#0A66C2] text-white hover:bg-[#004182]" disabled={verbinden.isPending} onClick={() => verbinden.mutate('/recruiter/profile/ueber-dich#linkedin')}>
        {verbinden.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Linkedin className="mr-1.5 h-3.5 w-3.5"/>}{status.abgelaufen ? t('linkedin.reconfirm') : t('linkedin.connect')}
      </Button>}
  </div>;
}
