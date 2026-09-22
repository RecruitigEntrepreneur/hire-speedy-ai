import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';
import { EVIDENCE, INCOME_OPTIONS, evidenceState, type EvidenceRow, type IncomeDeclaration } from '../../../../supabase/functions/_shared/recruiter-evidence';
import { cleanExpertise } from '../../../../supabase/functions/_shared/recruiter-expertise';
import { shortDate } from './mailFormat';

/**
 * Akte › Nachweise: was der Headhunter hochgeladen hat, zum Öffnen, Prüfen oder
 * Ablehnen mit Grund (der Grund geht per Mail an ihn). Dazu seine Erklärung zu
 * den Einkünften und die Schwerpunkte, wie er sie aktuell pflegt.
 */
const dateOnly = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const STATE_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Zu prüfen', variant: 'default' }, approved: { label: 'Geprüft', variant: 'secondary' },
  rejected: { label: 'Abgelehnt', variant: 'destructive' }, expiring: { label: 'Läuft bald ab', variant: 'outline' }, expired: { label: 'Abgelaufen', variant: 'destructive' },
};

export function EvidencePanel({ userId, active, onChanged }: { userId: string | null; active: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<EvidenceRow[] | null>(null);
  const [expertise, setExpertise] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setError('');
    const [{ data, error: rowsError }, { data: profile }] = await Promise.all([
      supabase.from('recruiter_evidence' as never).select('*').eq('recruiter_id', userId).order('uploaded_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (rowsError) { setRows([]); setError('Nachweise sind auf dem Server noch nicht eingerichtet (Migration fehlt).'); return; }
    setRows((data ?? []) as unknown as EvidenceRow[]);
    const current = (profile as Record<string, unknown> | null)?.recruiter_expertise;
    if (current) {
      const x = cleanExpertise(current);
      setExpertise([[...x.areas, ...x.extras].join(', '), x.levels.join(', '), x.regions.join(', '), x.languages.join(', ')].filter(Boolean).join(' · '));
    } else setExpertise('');
  }, [userId]);
  useEffect(() => { if (active && userId) void load(); }, [active, userId, load]);

  const openFile = async (path: string) => {
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    const { data, error: urlError } = await supabase.storage.from('recruiter-evidence').createSignedUrl(path, 300);
    if (urlError || !data?.signedUrl) { win?.close(); setError('Datei konnte nicht geöffnet werden.'); return; }
    if (win) win.location.href = data.signedUrl; else window.location.assign(data.signedUrl);
  };
  const review = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(id); setError('');
    try {
      await onboardingApi(true, { action: 'evidence-review', id, decision, reason: decision === 'rejected' ? reason : undefined });
      setRejecting(null); setReason('');
      await load(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Prüfung konnte nicht gespeichert werden.'); }
    finally { setBusy(''); }
  };

  if (!userId) return <p className="text-sm text-muted-foreground">Noch kein Konto, daher keine Nachweise.</p>;
  if (!rows) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Nachweise werden geladen …</p>;

  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {!rows.length && !error && <p className="text-sm text-muted-foreground">Noch keine Nachweise hochgeladen.</p>}
    <ul className="divide-y rounded-lg border">
      {rows.map(row => {
        const state = row.kind === 'income' ? 'approved' : evidenceState(row);
        const badge = STATE_BADGE[state];
        return <li key={row.id} className="space-y-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{EVIDENCE[row.kind]?.label ?? row.kind}</p>
              <p className="text-xs text-muted-foreground">{row.kind === 'income'
                ? `${INCOME_OPTIONS[row.declaration as IncomeDeclaration] ?? row.declaration} · erklärt am ${shortDate(row.uploaded_at)}`
                : [`${row.file_name ?? 'Datei'} · hochgeladen am ${shortDate(row.uploaded_at)}`, row.valid_until && `gültig bis ${dateOnly(row.valid_until)}`, row.reviewed_at && `geprüft am ${shortDate(row.reviewed_at)}`].filter(Boolean).join(' · ')}</p>
              {row.status === 'rejected' && row.reason && <p className="text-xs text-destructive">Grund: {row.reason}</p>}
            </div>
            {row.kind !== 'income' && <Badge variant={badge.variant}>{badge.label}</Badge>}
          </div>
          {row.file_path && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void openFile(row.file_path!)}><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>Datei öffnen</Button>
            {row.status === 'pending' && <>
              <Button size="sm" disabled={busy === row.id} onClick={() => void review(row.id, 'approved')}><Check className="mr-1.5 h-3.5 w-3.5"/>Geprüft</Button>
              <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => { setRejecting(rejecting === row.id ? null : row.id); setReason(''); }}><X className="mr-1.5 h-3.5 w-3.5"/>Ablehnen</Button>
            </>}
          </div>}
          {rejecting === row.id && <div className="space-y-2">
            <Textarea rows={2} value={reason} maxLength={500} placeholder="Grund für die Ablehnung, geht per Mail an den Headhunter" onChange={e => setReason(e.target.value)}/>
            <Button size="sm" variant="destructive" disabled={busy === row.id || reason.trim().length < 5} onClick={() => void review(row.id, 'rejected')}>Ablehnung senden</Button>
          </div>}
        </li>;
      })}
    </ul>
    {expertise && <p className="text-sm"><span className="text-muted-foreground">Aktuelle Schwerpunkte (vom Headhunter gepflegt): </span>{expertise}</p>}
  </div>;
}
