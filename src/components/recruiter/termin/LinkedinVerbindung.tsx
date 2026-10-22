import { CheckCircle2, Linkedin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLinkedin, useRuecksprung } from './useTerminseite';

const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });

/** Profil › Über dich: ob Matchunt nach deiner Freigabe für dich auf LinkedIn posten darf. */
export function LinkedinVerbindung() {
  useRuecksprung();
  const { status, isLoading, verbinden, trennen } = useLinkedin();
  if (isLoading) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin"/>LinkedIn wird geprüft …</p>;
  if (!status?.eingerichtet) return <p className="text-xs text-muted-foreground">Direkt auf LinkedIn posten kommt, sobald Matchunt die LinkedIn-App freigeschaltet hat. Bis dahin postest du Beiträge selbst.</p>;
  return <div id="linkedin" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
    {status.verbunden ? <div className="text-sm">
      <p className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4"/>Zum Posten verbunden{status.name ? ` · ${status.name}` : ''}</p>
      {status.gueltig_bis && <p className="text-xs text-muted-foreground">gültig bis {datum(status.gueltig_bis)} · Matchunt erinnert 7 Tage vorher</p>}
    </div> : <div className="text-sm">
      <p className="font-medium">{status.abgelaufen ? 'LinkedIn kurz neu bestätigen' : 'Mit LinkedIn verbinden'}</p>
      <p className="text-xs text-muted-foreground">Dann postet Matchunt deine Stellen-Beiträge nach deiner Freigabe direkt auf deinem Profil. Nie ohne deinen Klick.</p>
    </div>}
    {status.verbunden
      ? <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={trennen.isPending} onClick={() => trennen.mutate()}>Trennen</Button>
      : <Button size="sm" className="bg-[#0A66C2] text-white hover:bg-[#004182]" disabled={verbinden.isPending} onClick={() => verbinden.mutate('/recruiter/profile/ueber-dich#linkedin')}>
        {verbinden.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Linkedin className="mr-1.5 h-3.5 w-3.5"/>}{status.abgelaufen ? 'Neu bestätigen' : 'Verbinden'}
      </Button>}
  </div>;
}
