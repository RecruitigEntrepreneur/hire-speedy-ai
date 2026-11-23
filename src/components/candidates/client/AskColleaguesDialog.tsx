import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import type { TeamMember } from '@/hooks/useTeamData';
import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';

const ROLLEN = ['owner', 'admin', 'hr', 'hiring_manager', 'viewer', 'finance'];
// Inhaber, Admin und HR sehen alle Stellen; Fachbereich und Nur lesen brauchen Zugriff auf diese Stelle.
const SIEHT_ALLE = ['owner', 'admin', 'hr'];

function fristen() {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
  const freitag = (() => { const x = new Date(); x.setDate(x.getDate() + ((5 - x.getDay() + 7) % 7 || 7)); return x; })();
  return [
    { key: 'morgen', date: d(1) },
    { key: 'freitag', date: freitag },
    { key: 'woche', date: d(7) },
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
  const { t, i18n } = useTranslation('clientCandidates');
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
    // Entwurf in der Sprache des Kunden; die Nachricht schreibt er selbst.
    const mentions = gewaehlt.map((m) => `@${m.full_name}`).join(' ');
    const bitte = bis
      ? t('ask.contentUntil', { mentions, date: bis.toLocaleDateString(intlLocale(i18n.language), { weekday: 'long', day: 'numeric', month: 'long' }) })
      : t('ask.content', { mentions });
    const content = `${bitte}${nachricht.trim() ? ` ${nachricht.trim()}` : ''}`;
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
          <DialogTitle>{t('ask.title')}</DialogTitle>
          <DialogDescription>{jobTitle} · {t('ask.description')}</DialogDescription>
        </DialogHeader>
        {/* B1 (22.11.2026): Personen als Zeilen mit Häkchen, dann Frist, dann Nachricht */}
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">{t('ask.who')}</p>
            {kollegen.length === 0 && <p className="mb-2 text-sm text-muted-foreground">{t('ask.noColleagues')}</p>}
            <div className="divide-y">
              {kollegen.map((m) => {
                const an = auswahl.includes(m.user_id);
                return (
                  <label key={m.user_id} className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                    <Checkbox checked={an} onCheckedChange={() => setAuswahl((a) => (an ? a.filter((x) => x !== m.user_id) : [...a, m.user_id]))} />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">
                      {(m.full_name ?? '').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate', an && 'font-medium')}>{m.full_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{ROLLEN.includes(m.role) ? t(`ask.roles.${m.role}`) : m.role}</span>
                  </label>
                );
              })}
            </div>
            {organizationId && (
              <button type="button" onClick={() => setInviteOpen(true)} className="mt-2 text-sm text-klick hover:underline">{t('ask.invite')} ›</button>
            )}
            {offen.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('ask.pending', { count: offen.length, emails: offen.map((i) => i.email).join(', ') })}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('ask.until')}</p>
            <div className="flex flex-wrap gap-2">
              {optionen.map((o) => (
                <button key={o.key} type="button" onClick={() => setFrist(o.key)}
                  className={cn('rounded-full border px-3 py-1 text-sm', frist === o.key ? 'border-foreground ring-1 ring-foreground font-medium' : 'border-border hover:bg-secondary/70')}>{t(`ask.deadline.${o.key}`)}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('ask.message')} <span className="font-normal text-muted-foreground">{t('ask.optional')}</span></p>
            <Textarea rows={2} value={nachricht} onChange={(e) => setNachricht(e.target.value)} placeholder={t('ask.messagePlaceholder')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('ask.cancel')}</Button>
          <Button onClick={() => void senden()} disabled={busy || auswahl.length === 0}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{auswahl.length === 1 ? t('ask.sendOne', { name: (kollegen.find((m) => m.user_id === auswahl[0])?.full_name ?? '').split(' ')[0] }) : auswahl.length > 1 ? t('ask.sendMany', { count: auswahl.length }) : t('ask.send')}</Button>
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
