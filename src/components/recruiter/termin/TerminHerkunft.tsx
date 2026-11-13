import { FileCheck2, Linkedin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { useErstgespraeche } from './Erstgespraeche';

/**
 * Akte (21.10.2026): woher der Kandidat kommt und sein gebuchtes Erstgespräch.
 * Erscheint nur bei Kandidaten aus der Terminseite oder mit Buchung.
 */
export function TerminHerkunft({ candidateId, importSource, createdAt, cvParsedAt }: { candidateId: string; importSource?: string | null; createdAt?: string | null; cvParsedAt?: string | null }) {
  const { t, i18n } = useTranslation('recruiterTermin');
  const { data: termine = [] } = useErstgespraeche({ candidateId });
  const ausBeitrag = importSource === 'linkedin_beitrag';
  // Nur die Herkunft: Den Termin selbst zeigt die Interview-Karte (01.11.2026), sonst stünde er doppelt da.
  if (!ausBeitrag && importSource !== 'terminseite') return null;
  const stelle = termine.find(g => g.job_title)?.job_title;
  const seit = createdAt ? new Date(createdAt).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }) : null;
  return <Card className="border-primary/20">
    <CardContent className="space-y-3 p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {ausBeitrag ? <span className="inline-flex items-center gap-1.5 text-[#0A66C2]"><Linkedin className="h-4 w-4"/>{t('herkunft.linkedin')}</span> : <span className="text-muted-foreground">{t('herkunft.page')}</span>}
        {stelle && <span className="text-muted-foreground">· {stelle}</span>}
        {seit && <span className="text-muted-foreground">{t('herkunft.bookedOn', { date: seit })}</span>}
        {cvParsedAt && <span className="inline-flex items-center gap-1 text-xs text-amber-700"><FileCheck2 className="h-3.5 w-3.5"/>{t('herkunft.prefilled')}</span>}
      </p>
      {termine.filter(g => g.note).map(g => <p key={`n${g.id}`} className="text-sm"><span className="text-muted-foreground">{t('herkunft.noteFrom', { name: g.first_name })}</span> <i>{t('herkunft.noteQuote', { note: g.note })}</i></p>)}
    </CardContent>
  </Card>;
}
