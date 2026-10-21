import { useMemo, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import type { TeamMember } from '@/hooks/useTeamData';
import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { cn } from '@/lib/utils';

const ROLLE: Record<string, string> = { owner: 'Inhaber', admin: 'Admin', hr: 'HR', hiring_manager: 'Fachbereich', viewer: 'Nur lesen', finance: 'Finanzen' };
// Inhaber, Admin und HR sehen alle Stellen; Fachbereich und Nur lesen brauchen Zugriff auf diese Stelle.
const SIEHT_ALLE = ['owner', 'admin', 'hr'];

function fristen() {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
  const freitag = (() => { const x = new Date(); x.setDate(x.getDate() + ((5 - x.getDay() + 7) % 7 || 7)); return x; })();
  return [
    { key: 'morgen', label: 'Morgen', date: d(1) },
    { key: 'freitag', label: 'Freitag', date: freitag },
    { key: 'woche', label: 'In einer Woche', date: d(7) },
  ];
}

/**
 * „Kollegen fragen“: wählt Kollegen, gibt ihnen bei Bedarf Zugriff auf die Stelle und
 * schreibt eine Team-Notiz mit @-Erwähnung, Frist und Nachricht. Die Erwähnten werden
 * benachrichtigt; ihre Antwort steht als Notiz unter „Notizen und Meinungen“.
 */
export function AskColleaguesDialog({ open, onOpenChange, members, currentUserId, organizationId, jobId, jobTitle, onSend }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: TeamMember[];
  currentUserId: string;
  organizationId: string | null;
  jobId: string;
  jobTitle: string;
  onSend: (args: { content: string; mentionedIds: string[]; grant: TeamMember[] }) => Promise<boolean>;
}) {
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [nachricht, setNachricht] = useState('');
  const [frist, setFrist] = useState('freitag');
  const [busy, setBusy] = useState(false);
  // Einladen öffnet ein eigenes Fenster; dieses tritt so lange zur Seite (kein Fenster über dem anderen).
  const [inviteOpen, setInviteOpen] = useState(false);
  const { invites } = useOrganizationInvites(open && organizationId ? organizationId : undefined);
  const offen = (invites ?? []).filter((i) => !i.job_ids?.length || i.job_ids.includes(jobId));
  const kollegen = useMemo(() => members.filter((m) => m.user_id !== currentUserId && m.full_name), [members, currentUserId]);
  const optionen = fristen();

  const senden = async () => {
    const gewaehlt = kollegen.filter((m) => auswahl.includes(m.user_id));
    if (!gewaehlt.length) return;
    const bis = optionen.find((o) => o.key === frist)?.date;
    const content = `${gewaehlt.map((m) => `@${m.full_name}`).join(' ')} Bitte um Ihre Meinung zu diesem Kandidaten${bis ? ` bis ${bis.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}.${nachricht.trim() ? ` ${nachricht.trim()}` : ''}`;
    const grant = gewaehlt.filter((m) => !SIEHT_ALLE.includes(m.role) && !m.assigned_jobs.some((j) => j.id === jobId));
    setBusy(true);
    const ok = await onSend({ content, mentionedIds: gewaehlt.map((m) => m.user_id), grant });
    setBusy(false);
    if (ok) {
      setAuswahl([]);
      setNachricht('');
      onOpenChange(false);
    }
  };

  return (
    <>
    <Dialog open={open && !inviteOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kollegen um ihre Meinung bitten</DialogTitle>
          <DialogDescription>{jobTitle} · Ihre Kollegen sehen den Kandidaten so anonym wie Sie.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Wen?</p>
            {kollegen.length === 0 && <p className="mb-2 text-sm text-muted-foreground">Noch keine Kollegen im Team.</p>}
            <div className="flex flex-wrap gap-2">
              {kollegen.map((m) => {
                const an = auswahl.includes(m.user_id);
                return (
                  <button key={m.user_id} type="button" onClick={() => setAuswahl((a) => (an ? a.filter((x) => x !== m.user_id) : [...a, m.user_id]))}
                    className={cn('rounded-full border px-3 py-1 text-sm', an ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50')}>
                    {m.full_name} <span className="text-xs text-muted-foreground">· {ROLLE[m.role] ?? m.role}</span>
                  </button>
                );
              })}
              {organizationId && (
                <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted/50">
                  <UserPlus className="h-3.5 w-3.5" />Kollegen einladen
                </button>
              )}
            </div>
            {offen.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Eingeladen, noch nicht angenommen: {offen.map((i) => i.email).join(', ')}. Nach der Annahme können Sie {offen.length === 1 ? 'diese Person' : 'sie'} hier auswählen.
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Nachricht <span className="font-normal text-muted-foreground">(optional)</span></p>
            <Textarea rows={3} value={nachricht} onChange={(e) => setNachricht(e.target.value)} placeholder="z. B. Passt er fachlich ins Team?" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Bitte bis</p>
            <div className="flex flex-wrap gap-2">
              {optionen.map((o) => (
                <button key={o.key} type="button" onClick={() => setFrist(o.key)}
                  className={cn('rounded-md border px-3 py-1 text-sm', frist === o.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50')}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => void senden()} disabled={busy || auswahl.length === 0}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Anfragen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {organizationId && (
      <InviteMemberDialog
        organizationId={organizationId}
        jobContext={{ id: jobId, title: jobTitle }}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    )}
    </>
  );
}
