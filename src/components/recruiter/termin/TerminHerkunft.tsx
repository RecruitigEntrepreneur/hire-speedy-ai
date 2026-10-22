import { FileCheck2, Linkedin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ErstgespraechZeile, useErstgespraeche } from './Erstgespraeche';

/**
 * Akte (21.10.2026): woher der Kandidat kommt und sein gebuchtes Erstgespräch.
 * Erscheint nur bei Kandidaten aus der Terminseite oder mit Buchung.
 */
export function TerminHerkunft({ candidateId, importSource, createdAt, cvParsedAt }: { candidateId: string; importSource?: string | null; createdAt?: string | null; cvParsedAt?: string | null }) {
  const { data: termine = [] } = useErstgespraeche({ candidateId });
  const ausBeitrag = importSource === 'linkedin_beitrag';
  if (!termine.length && !ausBeitrag && importSource !== 'terminseite') return null;
  const stelle = termine.find(t => t.job_title)?.job_title;
  const seit = createdAt ? new Date(createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }) : null;
  return <Card className="border-primary/20">
    <CardContent className="space-y-3 p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {ausBeitrag ? <span className="inline-flex items-center gap-1.5 text-[#0A66C2]"><Linkedin className="h-4 w-4"/>Herkunft: LinkedIn-Beitrag</span> : <span className="text-muted-foreground">Herkunft: Terminseite</span>}
        {stelle && <span className="text-muted-foreground">· {stelle}</span>}
        {seit && <span className="text-muted-foreground">· gebucht am {seit}</span>}
        {cvParsedAt && <span className="inline-flex items-center gap-1 text-xs text-amber-700"><FileCheck2 className="h-3.5 w-3.5"/>Akte aus dem Lebenslauf vorbefüllt · bitte prüfen</span>}
      </p>
      {termine.map(t => <ErstgespraechZeile key={t.id} g={t} ohneAkte/>)}
      {termine.filter(t => t.note).map(t => <p key={`n${t.id}`} className="text-sm"><span className="text-muted-foreground">Notiz von {t.first_name}:</span> <i>„{t.note}“</i></p>)}
    </CardContent>
  </Card>;
}
