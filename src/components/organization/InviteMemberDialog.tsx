import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { UserPlus, Loader2, Copy, Check, MailCheck } from 'lucide-react';
import { toast } from 'sonner';

const inviteSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  role: z.enum(['admin', 'hr', 'hiring_manager', 'viewer']),
  job_ids: z.array(z.string()).default([]),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  organizationId: string;
  /** Vorbelegte Rolle, z. B. 'hiring_manager' bei kontextueller Einladung von der Job-Seite */
  defaultRole?: InviteFormData['role'];
  /** Vorbelegte Job-Zuweisung (kontextuelle Einladung) */
  defaultJobIds?: string[];
  /** Eigener Trigger-Button (Standard: "Mitglied einladen") */
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function InviteMemberDialog({
  organizationId,
  defaultRole = 'hiring_manager',
  defaultJobIds = [],
  trigger,
  onSuccess,
}: InviteMemberDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const { sendInvite } = useOrganizationInvites(organizationId);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: defaultRole,
      job_ids: defaultJobIds,
    },
  });

  const selectedRole = form.watch('role');
  const needsJobScope = selectedRole === 'hiring_manager' || selectedRole === 'viewer';

  const { data: orgJobs } = useQuery({
    queryKey: ['org-jobs-for-invite', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status')
        .eq('organization_id', organizationId)
        .in('status', ['draft', 'pending_approval', 'published'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && needsJobScope,
  });

  const roleDescriptions: Record<string, string> = {
    admin: t('team.roles.admin_desc'),
    hr: t('team.roles.hr_desc'),
    hiring_manager: t('team.roles.hiring_manager_desc'),
    viewer: t('team.roles.viewer_desc'),
  };

  const onSubmit = async (data: InviteFormData) => {
    const result = await sendInvite.mutateAsync({
      organization_id: organizationId,
      email: data.email,
      role: data.role,
      job_ids: needsJobScope ? data.job_ids : [],
    });
    setInviteUrl(result.invite_url);
    setEmailSent(result.email_sent);
    onSuccess?.();
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success(t('team.invite.link_copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset({ email: '', role: defaultRole, job_ids: defaultJobIds });
      setInviteUrl(null);
      setEmailSent(false);
      setCopied(false);
    }
  };

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('team.invite.title')}</DialogTitle>
          <DialogDescription>{t('team.invite.description')}</DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
              <MailCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">
                  {emailSent ? t('team.invite.sent_title') : t('team.invite.created_title')}
                </p>
                <p className="text-muted-foreground">
                  {emailSent ? t('team.invite.sent_hint') : t('team.invite.created_hint')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>{t('team.invite.done')}</Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('team.invite.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="kollege@unternehmen.de" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('team.invite.role')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('team.invite.role_placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">{t('team.roles.admin')}</SelectItem>
                        <SelectItem value="hr">{t('team.roles.hr')}</SelectItem>
                        <SelectItem value="hiring_manager">{t('team.roles.hiring_manager')}</SelectItem>
                        <SelectItem value="viewer">{t('team.roles.viewer')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>{roleDescriptions[field.value]}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {needsJobScope && (
                <FormField
                  control={form.control}
                  name="job_ids"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('team.invite.jobs')}</FormLabel>
                      <FormDescription>{t('team.invite.jobs_hint')}</FormDescription>
                      <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
                        {(orgJobs ?? []).map((job) => (
                          <label key={job.id} className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                              checked={field.value.includes(job.id)}
                              onCheckedChange={(checked) => {
                                field.onChange(
                                  checked
                                    ? [...field.value, job.id]
                                    : field.value.filter((id) => id !== job.id)
                                );
                              }}
                            />
                            <span className="flex-1 truncate">{job.title}</span>
                          </label>
                        ))}
                        {!orgJobs?.length && (
                          <p className="text-sm text-muted-foreground">{t('team.invite.no_jobs')}</p>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {t('team.invite.cancel')}
                </Button>
                <Button type="submit" disabled={sendInvite.isPending}>
                  {sendInvite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('team.invite.submit')}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
