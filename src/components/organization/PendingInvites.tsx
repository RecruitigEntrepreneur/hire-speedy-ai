import { useTranslation } from 'react-i18next';
import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { fmtDate } from '@/lib/localeFormat';
import { Mail, X, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PendingInvitesProps {
  organizationId: string;
}

/** Offene Einladungen – Apple-Stil (22.11.2026): dieselben Karten wie die Mitglieder. */
export function PendingInvites({ organizationId }: PendingInvitesProps) {
  const { t } = useTranslation();
  const { t: tt } = useTranslation('clientTeam');
  const { invites, isLoading, cancelInvite } = useOrganizationInvites(organizationId);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  if (!invites?.length) {
    return <p className="rounded-xl border bg-card py-10 text-center text-sm text-muted-foreground">{tt('page.invitesEmpty')}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {invites.map((invite) => {
        const jobCount = invite.job_ids?.length ?? 0;
        const role = invite.role;
        return (
          <div key={invite.id} className="flex flex-col rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Avatar><AvatarFallback><Mail className="h-4 w-4 text-muted-foreground" /></AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">{t(`team.roles.${role}`, role)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 shrink-0"
                onClick={() => cancelInvite.mutate(invite.id)}
                disabled={cancelInvite.isPending}
                title={t('team.invites.revoke')}
                aria-label={t('team.invites.revoke')}
              >
                {cancelInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-4 text-sm">
              {role === 'hiring_manager' && jobCount
                ? tt('page.decides', { count: jobCount })
                : role === 'viewer' && jobCount
                  ? tt('page.reads', { count: jobCount })
                  : tt(`dialog.roles.${role}_text`, '')}
            </p>
            <p className="mt-auto pt-3 text-xs text-muted-foreground">{tt('page.validUntil', { when: fmtDate(invite.expires_at) })}</p>
          </div>
        );
      })}
    </div>
  );
}
