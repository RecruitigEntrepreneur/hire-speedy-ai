import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { useTeamData } from '@/hooks/useTeamData';
import { UserPlus, Loader2, Copy, Check, MailCheck, Lock, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'hr' | 'hiring_manager' | 'viewer' | 'finance';

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
  /** Von außen gesteuert (ohne Trigger), z. B. aus „Kollegen fragen“, damit kein Fenster über einem anderen liegt. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Nur Schlüssel; die Texte kommen beim Anzeigen aus clientTeam:dialog.roles / dialog.choices.
const ROLE_CARDS: Role[] = ['admin', 'hr', 'hiring_manager', 'viewer', 'finance'];

const JOB_CHOICES: { key: Role; text: 'decide' | 'read' }[] = [
  { key: 'hiring_manager', text: 'decide' },
  { key: 'viewer', text: 'read' },
];

const STATUS_KEYS = ['published', 'pending_approval', 'pending_client_approval'] as const;

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
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: InviteMemberDialogProps) {
  const { t } = useTranslation();
  const { t: tt } = useTranslation('clientTeam');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (v: boolean) => (controlled ? onOpenChangeProp?.(v) : setOpenState(v));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(jobContext ? 'hiring_manager' : defaultRole);
  const [jobIds, setJobIds] = useState<string[]>(jobContext ? [jobContext.id] : defaultJobIds);
  const [showMoreJobs, setShowMoreJobs] = useState(!jobContext);
  const [jobQuery, setJobQuery] = useState('');
  const [message, setMessage] = useState('');
  const [billingCc, setBillingCc] = useState(true);
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

  const jobTitle = (id: string) => (jobContext?.id === id ? jobContext.title : orgJobs?.find((j) => j.id === id)?.title ?? tt('dialog.jobFallback'));

  const reset = () => {
    setName('');
    setEmail('');
    setRole(jobContext ? 'hiring_manager' : defaultRole);
    setJobIds(jobContext ? [jobContext.id] : defaultJobIds);
    setShowMoreJobs(!jobContext);
    setJobQuery('');
    setMessage('');
    setBillingCc(true);
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
      billing_cc: role === 'finance' ? billingCc : undefined,
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
      toast.success(tt('dialog.granted', { name: existing.full_name || existing.email }));
      queryClient.invalidateQueries({ queryKey: ['team-data', organizationId] });
      onSuccess?.();
      handleOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || tt('dialog.grantError'));
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
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('team.invite.button')}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jobContext ? tt('dialog.titleJob') : tt('dialog.title')}</DialogTitle>
          <DialogDescription>
            {jobContext ? [jobContext.title, jobContext.location].filter(Boolean).join(' · ') : tt('dialog.description')}
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
              <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label={tt('dialog.copyLink')}>
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
                <Label htmlFor="invite-name">{tt('dialog.name')}</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tt('dialog.namePlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">{tt('dialog.email')}</Label>
                <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tt('dialog.emailPlaceholder')} />
              </div>
            </div>

            {existing && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <p className="font-medium">{tt('dialog.alreadyMember', { name: existing.full_name || existing.email })}</p>
                <p className="text-muted-foreground">{role === 'finance' ? tt('dialog.alreadyFinance') : tt('dialog.alreadyGrant')}</p>
              </div>
            )}

            {jobContext ? (
              <div className="space-y-1.5">
                <p className="font-medium">{tt('dialog.whatShould', { name: name.trim().split(' ')[0] || tt('dialog.thePerson') })}</p>
                <div className="grid grid-cols-2 gap-2">
                  {JOB_CHOICES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setRole(c.key)}
                      className={cn('rounded-lg border p-2.5 text-left transition-colors', role === c.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40')}
                    >
                      <span className="block font-medium">{tt(`dialog.choices.${c.text}`)}</span>
                      <span className="block text-xs text-muted-foreground">{tt(`dialog.choices.${c.text}_text`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="font-medium">{tt('dialog.role')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_CARDS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRole(key)}
                      className={cn('rounded-lg border p-2.5 text-left transition-colors', key === 'finance' && 'col-span-2', role === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40')}
                    >
                      <span className="block font-medium">{tt(`dialog.roles.${key}`)}</span>
                      <span className="block text-xs text-muted-foreground">{tt(`dialog.roles.${key}_text`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {role === 'finance' && !existing && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
                <Checkbox checked={billingCc} onCheckedChange={(c) => setBillingCc(c === true)} className="mt-0.5" />
                <span>{tt('dialog.billingCc')}<span className="block text-xs text-muted-foreground">{tt('dialog.billingCcHint')}</span></span>
              </label>
            )}

            {needsJobScope && (
              <div className="space-y-2">
                {jobContext && !showMoreJobs ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    {tt('dialog.onlyThisJob')}
                    <button type="button" className="text-primary hover:underline" onClick={() => setShowMoreJobs(true)}>
                      {tt('dialog.addMoreJobs')}
                    </button>
                  </p>
                ) : (
                  <>
                    <p className="font-medium">{tt('dialog.whichJobs')}</p>
                    {jobIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {jobIds.map((id) => (
                          <Badge key={id} variant="secondary" className="gap-1 pr-1 font-normal">
                            {jobTitle(id)}
                            <button type="button" aria-label={tt('dialog.remove')} onClick={() => toggleJob(id)} className="rounded hover:bg-muted">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} placeholder={tt('dialog.searchJob')} className="h-8 pl-8 text-sm" />
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-lg border">
                      {filteredJobs.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground">{orgJobs ? tt('dialog.noJobMatch') : tt('dialog.jobsLoading')}</p>
                      ) : (
                        filteredJobs.map((j) => (
                          <label key={j.id} className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40">
                            <input type="checkbox" checked={jobIds.includes(j.id)} onChange={() => toggleJob(j.id)} />
                            <span className="min-w-0 flex-1 truncate">{j.title}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{(STATUS_KEYS as readonly string[]).includes(j.status) ? tt(`dialog.status.${j.status}`) : j.status}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{tt('dialog.jobsHint')}</p>
                  </>
                )}
              </div>
            )}

            {!existing && (
              <div className="space-y-1.5">
                <Label htmlFor="invite-message" className="text-xs text-muted-foreground">{tt('dialog.message')}</Label>
                <Textarea
                  id="invite-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={jobContext ? tt('dialog.messagePlaceholder', { name: name.trim().split(' ')[0] || tt('dialog.hello') }) : ''}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-muted-foreground">{existing ? '' : tt('dialog.footer')}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {t('team.invite.cancel')}
                </Button>
                {existing ? (
                  <Button onClick={grantAccess} disabled={granting || jobIds.length === 0 || !needsJobScope}>
                    {granting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {tt('dialog.grant')}
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
