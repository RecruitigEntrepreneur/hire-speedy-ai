import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { useTeamData } from '@/hooks/useTeamData';
import { UserPlus, Loader2, Copy, Check, MailCheck, Lock, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'hr' | 'hiring_manager' | 'viewer';

interface InviteMemberDialogProps {
  organizationId: string;
  /** Vorbelegte Rolle, z. B. 'hiring_manager' bei kontextueller Einladung von der Job-Seite */
  defaultRole?: Role;
  /** Vorbelegte Job-Zuweisung (kontextuelle Einladung) */
  defaultJobIds?: string[];
  /** Von der Stellenseite: Einladung zu genau dieser Stelle (nur Mitentscheiden/Mitlesen). */
  jobContext?: { id: string; title: string; location?: string | null };
  /** Eigener Trigger-Button (Standard: "Mitglied einladen") */
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const ROLE_CARDS: { key: Role; label: string; text: string }[] = [
  { key: 'admin', label: 'Administrator', text: 'Alles, auch Nutzer und Verträge' },
  { key: 'hr', label: 'HR / Recruiting', text: 'Alle Stellen und Kandidaten' },
  { key: 'hiring_manager', label: 'Fachbereich', text: 'Nur ausgewählte Stellen, entscheidet mit' },
  { key: 'viewer', label: 'Betrachter', text: 'Nur ausgewählte Stellen, nur lesen' },
];

const JOB_CHOICES: { key: Role; label: string; text: string }[] = [
  { key: 'hiring_manager', label: 'Mitentscheiden', text: 'Kandidaten ansehen und bewerten, Interviews führen, Feedback geben' },
  { key: 'viewer', label: 'Nur mitlesen', text: 'Sieht Kandidaten und Stand, entscheidet nicht' },
];

const STATUS_LABEL: Record<string, string> = { published: 'läuft', pending_approval: 'in Prüfung', pending_client_approval: 'in Freigabe' };

/**
 * Einladen (K8/K9): von der Stelle aus geht es nur um diese Stelle, von der
 * Team-Seite aus um eine Rolle. Ist die Adresse schon im Team, gibt das Fenster nur
 * Zugriff auf die Stelle, statt neu einzuladen.
 */
export function InviteMemberDialog({
  organizationId,
  defaultRole = 'hiring_manager',
  defaultJobIds = [],
  jobContext,
  trigger,
  onSuccess,
}: InviteMemberDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(jobContext ? 'hiring_manager' : defaultRole);
  const [jobIds, setJobIds] = useState<string[]>(jobContext ? [jobContext.id] : defaultJobIds);
  const [showMoreJobs, setShowMoreJobs] = useState(!jobContext);
  const [jobQuery, setJobQuery] = useState('');
  const [message, setMessage] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [granting, setGranting] = useState(false);
  const { sendInvite } = useOrganizationInvites(organizationId);
  const { data: team } = useTeamData(open ? organizationId : undefined);

  const needsJobScope = role === 'hiring_manager' || role === 'viewer';
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const { data: orgJobs } = useQuery({
    queryKey: ['org-jobs-for-invite', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status, location')
        .eq('organization_id', organizationId)
        .in('status', ['published', 'pending_approval', 'pending_client_approval'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; title: string; status: string; location: string | null }[];
    },
    enabled: open && needsJobScope && showMoreJobs,
  });

  const existing = useMemo(() => {
    const e = email.trim().toLowerCase();
    if (!e || !team) return null;
    return team.members.find((m) => (m.email ?? '').toLowerCase() === e && m.status === 'active') ?? null;
  }, [email, team]);

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    return (orgJobs ?? []).filter((j) => !q || j.title.toLowerCase().includes(q) || (j.location ?? '').toLowerCase().includes(q));
  }, [orgJobs, jobQuery]);

  const jobTitle = (id: string) => (jobContext?.id === id ? jobContext.title : orgJobs?.find((j) => j.id === id)?.title ?? 'Stelle');

  const reset = () => {
    setName('');
    setEmail('');
    setRole(jobContext ? 'hiring_manager' : defaultRole);
    setJobIds(jobContext ? [jobContext.id] : defaultJobIds);
    setShowMoreJobs(!jobContext);
    setJobQuery('');
    setMessage('');
    setInviteUrl(null);
    setEmailSent(false);
    setCopied(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const submit = async () => {
    const result = await sendInvite.mutateAsync({
      organization_id: organizationId,
      email: email.trim(),
      role,
      job_ids: needsJobScope ? jobIds : [],
      full_name: name.trim() || undefined,
      message: message.trim() || undefined,
    });
    setInviteUrl(result.invite_url);
    setEmailSent(result.email_sent);
    onSuccess?.();
  };

  // Schon im Team: nur Zugriff auf die Stelle(n) geben.
  const grantAccess = async () => {
    if (!existing || !user) return;
    setGranting(true);
    try {
      const rows = jobIds
        .filter((id) => !existing.assigned_jobs.some((j) => j.id === id))
        .map((id) => ({ job_id: id, user_id: existing.user_id, role: role === 'viewer' ? 'viewer' : 'hiring_manager', added_by: user.id }));
      if (rows.length) {
        const { error } = await supabase.from('job_collaborators').insert(rows as never);
        if (error) throw error;
      }
      toast.success(`${existing.full_name || existing.email} hat jetzt Zugriff.`);
      queryClient.invalidateQueries({ queryKey: ['team-data', organizationId] });
      onSuccess?.();
      handleOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || 'Zugriff konnte nicht gegeben werden.');
    } finally {
      setGranting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success(t('team.invite.link_copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleJob = (id: string) => setJobIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            {t('team.invite.button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jobContext ? 'Kollegen zu dieser Stelle einladen' : 'Teammitglied einladen'}</DialogTitle>
          <DialogDescription>
            {jobContext ? [jobContext.title, jobContext.location].filter(Boolean).join(' · ') : 'Die Einladung kommt per E-Mail und ist 7 Tage gültig.'}
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
              <MailCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">{emailSent ? t('team.invite.sent_title') : t('team.invite.created_title')}</p>
                <p className="text-muted-foreground">{emailSent ? t('team.invite.sent_hint') : t('team.invite.created_hint')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Link kopieren">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>{t('team.invite.done')}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr]">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anna Weber" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">E-Mail</Label>
                <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kollege@unternehmen.de" />
              </div>
            </div>

            {existing && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <p className="font-medium">{existing.full_name || existing.email} ist schon im Team.</p>
                <p className="text-muted-foreground">Statt einer Einladung gibst du nur Zugriff auf die gewählten Stellen.</p>
              </div>
            )}

            {jobContext ? (
              <div className="space-y-1.5">
                <p className="font-medium">Was soll {name.trim().split(' ')[0] || 'die Person'} bei dieser Stelle tun?</p>
                <div className="grid grid-cols-2 gap-2">
                  {JOB_CHOICES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setRole(c.key)}
                      className={cn('rounded-lg border p-2.5 text-left transition-colors', role === c.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40')}
                    >
                      <span className="block font-medium">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="font-medium">Rolle</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_CARDS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setRole(c.key)}
                      className={cn('rounded-lg border p-2.5 text-left transition-colors', role === c.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40')}
                    >
                      <span className="block font-medium">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needsJobScope && (
              <div className="space-y-2">
                {jobContext && !showMoreJobs ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    Zugriff nur auf diese Stelle ·
                    <button type="button" className="text-primary hover:underline" onClick={() => setShowMoreJobs(true)}>
                      weitere Stellen hinzufügen
                    </button>
                  </p>
                ) : (
                  <>
                    <p className="font-medium">Welche Stellen?</p>
                    {jobIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {jobIds.map((id) => (
                          <Badge key={id} variant="secondary" className="gap-1 pr-1 font-normal">
                            {jobTitle(id)}
                            <button type="button" aria-label="Entfernen" onClick={() => toggleJob(id)} className="rounded hover:bg-muted">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} placeholder="Stelle suchen …" className="h-8 pl-8 text-sm" />
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-lg border">
                      {filteredJobs.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground">{orgJobs ? 'Keine laufende Stelle passt.' : 'Stellen werden geladen …'}</p>
                      ) : (
                        filteredJobs.map((j) => (
                          <label key={j.id} className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40">
                            <input type="checkbox" checked={jobIds.includes(j.id)} onChange={() => toggleJob(j.id)} />
                            <span className="min-w-0 flex-1 truncate">{j.title}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{STATUS_LABEL[j.status] ?? j.status}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Es erscheinen nur laufende Stellen und Stellen in Prüfung.</p>
                  </>
                )}
              </div>
            )}

            {!existing && (
              <div className="space-y-1.5">
                <Label htmlFor="invite-message" className="text-xs text-muted-foreground">Kurze Nachricht (optional)</Label>
                <Textarea
                  id="invite-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={jobContext ? `${name.trim().split(' ')[0] || 'Hallo'}, bitte schau dir die Kandidaten an.` : ''}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-muted-foreground">{existing ? '' : 'Einladung per E-Mail, 7 Tage gültig'}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {t('team.invite.cancel')}
                </Button>
                {existing ? (
                  <Button onClick={grantAccess} disabled={granting || jobIds.length === 0 || !needsJobScope}>
                    {granting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Zugriff geben
                  </Button>
                ) : (
                  <Button onClick={submit} disabled={sendInvite.isPending || !emailValid || (needsJobScope && jobIds.length === 0)}>
                    {sendInvite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t('team.invite.submit')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
