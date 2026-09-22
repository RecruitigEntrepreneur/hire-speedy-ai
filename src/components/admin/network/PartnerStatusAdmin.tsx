import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';
import { PartnerCard } from '@/components/recruiter/partner/PartnerCard';
import { dayDate, monthYear, type PartnerStatusRow } from '../../../../supabase/functions/_shared/recruiter-partner';

/**
 * Akte › Übersicht: Partnerstatus des Headhunters. Verliehen wird er automatisch mit
 * der Freischaltung ab Vertrag 2.1; hier sieht Matchunt Nummer, Einwilligungen und
 * Website und kann den Status beenden oder wiederherstellen.
 */
export function PartnerStatusAdmin({ userId, active, onChanged }: { userId: string | null; active: boolean; onChanged: () => void }) {
  const [row, setRow] = useState<PartnerStatusRow | null | undefined>(undefined);
  const [missing, setMissing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error: loadError } = await supabase.from('recruiter_partner_status' as never).select('*').eq('user_id', userId).maybeSingle();
    setMissing(!!loadError);
    setRow(loadError ? null : (data as unknown as PartnerStatusRow | null));
  }, [userId]);
  useEffect(() => { if (active && userId) void load(); }, [active, userId, load]);

  const setActive = async (next: boolean) => {
    if (!userId) return;
    setBusy(true); setError('');
    try {
      setRow(await onboardingApi<PartnerStatusRow>(true, { action: 'partner-status', user_id: userId, active: next }));
      setConfirm(false);
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Der Partnerstatus konnte nicht geändert werden.'); }
    finally { setBusy(false); }
  };

  if (!userId || row === undefined) return null;
  return <section className="space-y-3 rounded-lg border p-4">
    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Partnerstatus</p>
    {missing ? <p className="text-sm text-muted-foreground">Auf dem Server noch nicht eingerichtet (Migration fehlt).</p>
      : !row ? <p className="text-sm text-muted-foreground">Noch kein Status. Er entsteht mit der Freischaltung ab Vertrag 2.1.</p>
      : <>
        <div className="flex flex-wrap items-center gap-3">
          <PartnerCard tier={row.tier} size="sm"/>
          <div className="text-sm">
            <p><span className="font-mono">{row.partner_number}</span> · seit {monthYear(row.granted_at)} · Vertrag {row.contract_version}</p>
            <p className={row.ended_at ? 'text-destructive' : 'text-success'}>{row.ended_at ? `Beendet am ${dayDate(row.ended_at)}` : 'Aktiv'}</p>
          </div>
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Verzeichnis</dt><dd>{row.directory_consent_at ? `eingewilligt am ${dayDate(row.directory_consent_at)}` : 'keine Einwilligung'}</dd>
          <dt className="text-muted-foreground">Schwerpunkte zeigen</dt><dd>{row.show_expertise_at ? 'ja' : 'nein'}</dd>
          <dt className="text-muted-foreground">Website</dt><dd>{row.website_domain ? `${row.website_domain}${row.website_seen_at ? `, zuletzt ${dayDate(row.website_seen_at)}` : ''}` : '—'}</dd>
          <dt className="text-muted-foreground">Eingerichtet</dt><dd>{[row.channels.linkedin && 'LinkedIn', row.channels.signature && 'Signatur', row.channels.post && 'Beitrag'].filter(Boolean).join(', ') || '—'}</dd>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => window.open(`/partner/${row.partner_number}`, '_blank', 'noopener')}>Prüfseite<ExternalLink className="ml-1.5 h-3.5 w-3.5"/></Button>
          {row.ended_at
            ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void setActive(true)}>{busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>}Wiederherstellen</Button>
            : confirm
              ? <><Button size="sm" variant="destructive" disabled={busy} onClick={() => void setActive(false)}>{busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>}Ja, beenden</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Abbrechen</Button>
                <span className="text-xs text-muted-foreground">Die Prüfseite zeigt danach „nicht mehr aktiv“.</span></>
              : <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>Status beenden</Button>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </>}
  </section>;
}
