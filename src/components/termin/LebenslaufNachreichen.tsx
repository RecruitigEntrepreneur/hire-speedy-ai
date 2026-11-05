import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { terminSeiteApi } from '@/lib/terminApi';
import { LebenslaufFeld, type LebenslaufDatei } from './LebenslaufFeld';

/**
 * Lebenslauf nachreichen ohne Buchung (05.11.2026): nach dem Buchen über den Einladungslink
 * oder über den Anfrage-Link /t/lebenslauf/<token>. Datei oder LinkedIn, mit Einverständnis.
 */
export function LebenslaufNachreichen({
  ziel,
  hhName,
  linkedinHinweis,
  onFertig,
}: {
  ziel: { einladung: string } | { anfrage: string };
  hhName: string;
  linkedinHinweis?: string;
  onFertig?: () => void;
}) {
  const hhVorname = hhName.split(' ')[0];
  const [datei, setDatei] = useState<LebenslaufDatei | null>(null);
  const [linkedin, setLinkedin] = useState('');
  const [consent, setConsent] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState('');
  const [fertig, setFertig] = useState<'lebenslauf' | 'linkedin' | null>(null);

  if (fertig) {
    return <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-4 w-4"/>Danke, {hhVorname} hat {fertig === 'lebenslauf' ? 'deinen Lebenslauf' : 'dein LinkedIn-Profil'}.
    </p>;
  }

  const senden = async () => {
    setSendet(true);
    setFehler('');
    try {
      const r = await terminSeiteApi.lebenslaufSenden(ziel, { upload_id: datei?.status === 'fertig' ? datei.id : null, linkedin_url: linkedin.trim() || undefined, consent });
      setFertig(r.lebenslauf ? 'lebenslauf' : 'linkedin');
      onFertig?.();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das hat gerade nicht geklappt.');
    } finally { setSendet(false); }
  };

  const hatEtwas = datei?.status === 'fertig' || !!linkedin.trim();
  return <div className="space-y-3">
    <LebenslaufFeld ziel={ziel} hhVorname={hhVorname} datei={datei} onDatei={setDatei} linkedin={linkedin} onLinkedin={setLinkedin} linkedinHinweis={linkedinHinweis}/>
    <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
      <Checkbox checked={consent} onCheckedChange={v => setConsent(v === true)} className="mt-0.5"/>
      <span>Ich bin einverstanden, dass Matchunt und {hhName} meinen Lebenslauf für die Vermittlung verarbeiten. <Link to="/datenschutz" target="_blank" className="underline">Datenschutz</Link></span>
    </label>
    {fehler && <p role="alert" className="text-xs text-destructive">{fehler}</p>}
    <Button type="button" className="w-full" disabled={!hatEtwas || !consent || sendet || datei?.status === 'laedt'} onClick={() => void senden()}>
      {sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Lebenslauf senden
    </Button>
  </div>;
}
