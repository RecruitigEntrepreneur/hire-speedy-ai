import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember } from '@/hooks/useTeamData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { dfLocale } from '@/lib/localeFormat';
import { toast } from 'sonner';

interface TeamMemberListProps {
  organizationId: string;
  currentUserId: string;
  members: TeamMember[] | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  /** Eigene Rolle und eigener Name – für die Karte „Sie“, wenn man selbst nicht in der Liste steht (Inhaber). */
  selfRole?: string | null;
  selfName?: string | null;
}

export function TeamMemberList({
  organizationId,
  currentUserId,
  members,
  isLoading,
  isAdmin,
  selfRole,
  selfName,
}: TeamMemberListProps) {
  const { t } = useTranslation();
  const { t: tt } = useTranslation('clientTeam');
  const queryClient = useQueryClient();

  const roleLabel = (role: string) => t(`team.roles.${role}`, role);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['team-data', organizationId] });
  };

  const updateMember = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; role?: string; status?: string }) => {
      const { error } = await supabase.from('organization_members').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success(t('team.members.updated'));
    },
    onError: (error) => {
      console.error('Error updating member:', error);
      toast.error(t('team.members.update_error'));
    },
  });

  const handleRoleChange = async (member: TeamMember, newRole: string) => {
    // Buchhaltung (Etappe 4, 25.10.2026) sieht keine Stellen: Zuweisungen in dieser Firma fallen weg
    if (newRole === 'finance') {
      const { data: jobs } = await supabase.from('jobs').select('id').eq('organization_id', organizationId);
      const ids = (jobs ?? []).map((j) => j.id);
      if (ids.length) {
        const { error } = await supabase.from('job_collaborators').delete().eq('user_id', member.user_id).in('job_id', ids);
        if (error) { toast.error(t('team.members.update_error')); return; }
      }
    }
    updateMember.mutate({ id: member.id, role: newRole });
  };

  const handleDeactivate = (member: TeamMember) => {
    if (confirm(t('team.members.deactivate_confirm'))) {
      updateMember.mutate({ id: member.id, status: 'inactive' });
    }
  };

  const handleReactivate = (member: TeamMember) => {
    updateMember.mutate({ id: member.id, status: 'active' });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const initials = (name: string | null | undefined) =>
    name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  // Apple-Stil (22.11.2026, Vorschlag 1): eine Karte je Person – wer, welche Rolle, was die Person darf, welche Stellen.
  const selfMissing = !!selfRole && !members?.some((m) => m.user_id === currentUserId);
  const rights = (role: string, jobs: number) => {
    if (role === 'hiring_manager') return jobs ? tt('page.decides', { count: jobs }) : tt('dialog.roles.hiring_manager_text');
    if (role === 'viewer') return jobs ? tt('page.reads', { count: jobs }) : tt('dialog.roles.viewer_text');
    return tt(`dialog.roles.${role === 'owner' ? 'admin' : role}_text`);
  };
  const karte = 'flex flex-col rounded-xl border bg-card p-5';

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {selfMissing && (
        <div className={karte}>
          <div className="flex items-center gap-3">
            <Avatar><AvatarFallback>{initials(selfName)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <p className="font-medium">{tt('page.you')}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(selfRole!)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm">{rights(selfRole!, 0)}</p>
          <p className="mt-3 text-xs text-muted-foreground">{selfRole === 'finance' ? tt('page.noJobs') : tt('page.allJobs')}</p>
        </div>
      )}

      {members?.map((member) => {
        const isCurrentUser = member.user_id === currentUserId;
        const isOwner = member.role === 'owner';
        const isInactive = member.status === 'inactive';
        const jobScoped = member.role === 'hiring_manager' || member.role === 'viewer';
        const jobs = member.assigned_jobs;

        return (
          <div key={member.id} className={cn(karte, isInactive && 'opacity-60')}>
            <div className="flex items-center gap-3">
              <Avatar>
                {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{isCurrentUser ? tt('page.you') : member.full_name || t('team.members.unknown')}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(member.role)}</p>
              </div>
              {isAdmin && !isOwner && !isCurrentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('team.members.change_role')}</DropdownMenuLabel>
                    {(['admin', 'hr', 'hiring_manager', 'viewer', 'finance'] as const)
                      .filter((r) => r !== member.role)
                      .map((r) => (
                        <DropdownMenuItem key={r} onClick={() => void handleRoleChange(member, r)}>
                          {roleLabel(r)}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    {isInactive ? (
                      <DropdownMenuItem onClick={() => handleReactivate(member)}>
                        {t('team.members.reactivate')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleDeactivate(member)} className="text-destructive">
                        {t('team.members.deactivate')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <p className="mt-4 text-sm">{rights(member.role, jobs.length)}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {jobScoped
                ? jobs.length
                  ? [...jobs.slice(0, 3).map((j) => j.title), ...(jobs.length > 3 ? [tt('page.more', { count: jobs.length - 3 })] : [])].join(' · ')
                  : tt('page.noJobsYet')
                : member.role === 'finance' ? tt('page.noJobs') : tt('page.allJobs')}
            </p>
            <p className="mt-auto pt-3 text-xs text-muted-foreground">
              {!isCurrentUser && member.email}
              {!isCurrentUser && member.email && (isInactive || member.last_sign_in_at || isAdmin) ? ' · ' : ''}
              {isInactive
                ? t('team.members.deactivated')
                : member.last_sign_in_at
                  ? `${t('team.members.last_login')} ${formatDistanceToNow(new Date(member.last_sign_in_at), { locale: dfLocale(), addSuffix: true })}`
                  : isAdmin && !isCurrentUser
                    ? t('team.members.never_logged_in')
                    : ''}
            </p>
          </div>
        );
      })}

      {!members?.length && !selfMissing && (
        <p className="py-8 text-center text-muted-foreground sm:col-span-2 xl:col-span-3">{t('team.members.empty')}</p>
      )}
    </div>
  );
}
