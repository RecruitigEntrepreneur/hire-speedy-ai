import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember } from '@/hooks/useTeamData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Shield,
  UserMinus,
  UserCheck,
  Crown,
  Eye,
  Briefcase,
  ClipboardList,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface TeamMemberListProps {
  organizationId: string;
  currentUserId: string;
  members: TeamMember[] | undefined;
  isLoading: boolean;
  isAdmin: boolean;
}

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  hr: <ClipboardList className="h-3 w-3" />,
  hiring_manager: <Briefcase className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
  finance: <ClipboardList className="h-3 w-3" />,
};

const roleColors: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  hr: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  hiring_manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  finance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function TeamMemberList({
  organizationId,
  currentUserId,
  members,
  isLoading,
  isAdmin,
}: TeamMemberListProps) {
  const { t } = useTranslation();
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

  const handleRoleChange = (member: TeamMember, newRole: string) => {
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
      <Card>
        <CardHeader>
          <CardTitle>{t('team.members.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('team.members.title')} ({members?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {members?.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            const isOwner = member.role === 'owner';
            const isInactive = member.status === 'inactive';
            const jobScoped = member.role === 'hiring_manager' || member.role === 'viewer';

            return (
              <div
                key={member.id}
                className={`flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between ${
                  isInactive ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                    <AvatarFallback>
                      {member.full_name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {member.full_name || t('team.members.unknown')}
                      {isCurrentUser && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({t('team.members.you')})
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {isInactive
                        ? t('team.members.deactivated')
                        : member.last_sign_in_at
                          ? `${t('team.members.last_login')}: ${formatDistanceToNow(new Date(member.last_sign_in_at), { locale: de, addSuffix: true })}`
                          : isAdmin
                            ? t('team.members.never_logged_in')
                            : ''}
                    </p>
                    {jobScoped && member.assigned_jobs.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {member.assigned_jobs.slice(0, 3).map((job) => (
                          <Badge key={job.id} variant="outline" className="text-[10px]">
                            {job.title}
                          </Badge>
                        ))}
                        {member.assigned_jobs.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{member.assigned_jobs.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Badge variant="secondary" className={roleColors[member.role]}>
                    {roleIcons[member.role]}
                    <span className="ml-1">{roleLabel(member.role)}</span>
                  </Badge>

                  {isAdmin && !isOwner && !isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('team.members.change_role')}</DropdownMenuLabel>
                        {(['admin', 'hr', 'hiring_manager', 'viewer'] as const)
                          .filter((r) => r !== member.role)
                          .map((r) => (
                            <DropdownMenuItem key={r} onClick={() => handleRoleChange(member, r)}>
                              {roleIcons[r]}
                              <span className="ml-2">{roleLabel(r)}</span>
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuSeparator />
                        {isInactive ? (
                          <DropdownMenuItem onClick={() => handleReactivate(member)}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            {t('team.members.reactivate')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(member)}
                            className="text-destructive"
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            {t('team.members.deactivate')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}

          {!members?.length && (
            <p className="py-8 text-center text-muted-foreground">{t('team.members.empty')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
