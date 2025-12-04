import { useOrganizationMembers, OrganizationMember } from '@/hooks/useOrganization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Shield, UserMinus, Crown, Eye, Calculator } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamMemberListProps {
  organizationId: string;
  currentUserId: string;
}

const roleLabels: Record<string, string> = {
  owner: 'Inhaber',
  admin: 'Administrator',
  hiring_manager: 'Hiring Manager',
  viewer: 'Betrachter',
  finance: 'Finanzen',
};

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  hiring_manager: <Eye className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
  finance: <Calculator className="h-3 w-3" />,
};

const roleColors: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  hiring_manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  finance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function TeamMemberList({ organizationId, currentUserId }: TeamMemberListProps) {
  const { members, isLoading, updateMember, removeMember } = useOrganizationMembers(organizationId);

  const handleRoleChange = (member: OrganizationMember, newRole: string) => {
    updateMember.mutate({ id: member.id, role: newRole as any });
  };

  const handleRemove = (memberId: string) => {
    if (confirm('Möchten Sie dieses Mitglied wirklich entfernen?')) {
      removeMember.mutate(memberId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Teammitglieder</CardTitle>
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
        <CardTitle>Teammitglieder ({members?.length || 0})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {members?.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            const isOwner = member.role === 'owner';
            
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.profiles?.full_name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {member.profiles?.full_name || 'Unbekannt'}
                      {isCurrentUser && (
                        <span className="text-muted-foreground text-sm ml-2">(Sie)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.profiles?.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={roleColors[member.role]}>
                    {roleIcons[member.role]}
                    <span className="ml-1">{roleLabels[member.role]}</span>
                  </Badge>

                  {!isOwner && !isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRoleChange(member, 'admin')}>
                          <Shield className="h-4 w-4 mr-2" />
                          Zum Admin machen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member, 'hiring_manager')}>
                          <Eye className="h-4 w-4 mr-2" />
                          Zum Hiring Manager machen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member, 'viewer')}>
                          <Eye className="h-4 w-4 mr-2" />
                          Zum Betrachter machen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member, 'finance')}>
                          <Calculator className="h-4 w-4 mr-2" />
                          Zu Finanzen machen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleRemove(member.id)}
                          className="text-destructive"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Entfernen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}

          {!members?.length && (
            <p className="text-center text-muted-foreground py-8">
              Keine Teammitglieder gefunden
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
