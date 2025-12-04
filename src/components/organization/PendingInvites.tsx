import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Mail, Clock, X, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PendingInvitesProps {
  organizationId: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  hiring_manager: 'Hiring Manager',
  viewer: 'Betrachter',
  finance: 'Finanzen',
};

export function PendingInvites({ organizationId }: PendingInvitesProps) {
  const { invites, isLoading, cancelInvite } = useOrganizationInvites(organizationId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ausstehende Einladungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!invites?.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Ausstehende Einladungen ({invites.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invites.map((invite) => {
            const expiresIn = formatDistanceToNow(new Date(invite.expires_at), {
              locale: de,
              addSuffix: true,
            });

            return (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Läuft ab {expiresIn}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline">{roleLabels[invite.role]}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => cancelInvite.mutate(invite.id)}
                    disabled={cancelInvite.isPending}
                  >
                    {cancelInvite.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
