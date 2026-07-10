import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useMyOrganization } from '@/hooks/useOrganization';
import { useTeamData } from '@/hooks/useTeamData';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberList } from '@/components/organization/TeamMemberList';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import { PendingInvites } from '@/components/organization/PendingInvites';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, Settings, ScrollText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export default function TeamManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { organization, myRole, isAdmin, isLoading: orgLoading, ensureOrganization } = useMyOrganization();
  const teamQuery = useTeamData(organization?.id);

  const [orgName, setOrgName] = useState<string | null>(null);
  const [billingEmail, setBillingEmail] = useState<string | null>(null);

  const settings = (organization?.settings ?? {}) as Record<string, unknown>;
  const intakeApprovalRequired = settings.intake_approval_required === true;

  const auditQuery = useQuery({
    queryKey: ['team-audit', organization?.id],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action, entity_type, details, created_at')
        .eq('organization_id', organization!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as AuditEntry[];
    },
    enabled: !!organization?.id && isAdmin,
  });

  const updateOrg = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from('organizations')
        .update(patch)
        .eq('id', organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-organization'] });
      toast.success(t('team.settings.saved'));
    },
    onError: (error) => {
      console.error('Error updating organization:', error);
      toast.error(t('team.settings.save_error'));
    },
  });

  const toggleIntakeApproval = (checked: boolean) => {
    updateOrg.mutate({
      settings: { ...settings, intake_approval_required: checked },
    });
  };

  const auditLabel = (entry: AuditEntry): string => {
    const d = (entry.details ?? {}) as Record<string, string>;
    switch (entry.action) {
      case 'team_member_added':
        return t('team.audit.member_added', { role: t(`team.roles.${d.role}`, d.role ?? '') });
      case 'team_role_changed':
        return t('team.audit.role_changed', {
          from: t(`team.roles.${d.old_role}`, d.old_role ?? ''),
          to: t(`team.roles.${d.new_role}`, d.new_role ?? ''),
        });
      case 'team_member_deactivated':
        return t('team.audit.member_deactivated');
      case 'team_member_reactivated':
        return t('team.audit.member_reactivated');
      case 'team_invite_created':
        return t('team.audit.invite_created', { email: d.email ?? '' });
      case 'team_invite_accepted':
        return t('team.audit.invite_accepted', { email: d.email ?? '' });
      case 'team_invite_deleted':
        return t('team.audit.invite_deleted', { email: d.email ?? '' });
      case 'candidate_profile_viewed':
        return t('team.audit.candidate_viewed');
      default:
        return entry.action;
    }
  };

  if (orgLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Noch keine Organisation → Team-Funktion aktivieren (lazy)
  if (!organization) {
    return (
      <DashboardLayout>
        <div className="mx-auto mt-12 max-w-md">
          <Card>
            <CardHeader className="text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <CardTitle>{t('team.activate.title')}</CardTitle>
              <CardDescription>{t('team.activate.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => ensureOrganization.mutate()}
                disabled={ensureOrganization.isPending}
              >
                {ensureOrganization.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('team.activate.button')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('team.title')}</h1>
            <p className="text-muted-foreground">
              {organization.name}
              {myRole && (
                <Badge variant="outline" className="ml-2 align-middle text-xs">
                  {t(`team.roles.${myRole}`, myRole)}
                </Badge>
              )}
            </p>
          </div>

          {isAdmin && <InviteMemberDialog organizationId={organization.id} />}
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">
              <Users className="mr-2 h-4 w-4" />
              {t('team.tabs.members')}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="audit">
                <ScrollText className="mr-2 h-4 w-4" />
                {t('team.tabs.audit')}
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="settings">
                <Settings className="mr-2 h-4 w-4" />
                {t('team.tabs.settings')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="members" className="mt-6 space-y-6">
            {isAdmin && <PendingInvites organizationId={organization.id} />}
            <TeamMemberList
              organizationId={organization.id}
              currentUserId={user?.id || ''}
              members={teamQuery.data?.members}
              isLoading={teamQuery.isLoading}
              isAdmin={isAdmin}
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="audit" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('team.audit.title')}</CardTitle>
                  <CardDescription>{t('team.audit.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {auditQuery.isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : auditQuery.data?.length ? (
                    <div className="space-y-2">
                      {auditQuery.data.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        >
                          <span>{auditLabel(entry)}</span>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.created_at), {
                              locale: de,
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-muted-foreground">
                      {t('team.audit.empty')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="settings" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('team.settings.intake_title')}</CardTitle>
                  <CardDescription>{t('team.settings.intake_description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="pr-4">
                      <p className="font-medium">{t('team.settings.intake_label')}</p>
                      <p className="text-sm text-muted-foreground">
                        {intakeApprovalRequired
                          ? t('team.settings.intake_on_hint')
                          : t('team.settings.intake_off_hint')}
                      </p>
                    </div>
                    <Switch
                      checked={intakeApprovalRequired}
                      onCheckedChange={toggleIntakeApproval}
                      disabled={updateOrg.isPending}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('team.settings.org_title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('team.settings.org_name')}</Label>
                      <Input
                        value={orgName ?? organization.name}
                        onChange={(e) => setOrgName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('team.settings.billing_email')}</Label>
                      <Input
                        type="email"
                        value={billingEmail ?? organization.billing_email ?? ''}
                        placeholder="billing@firma.de"
                        onChange={(e) => setBillingEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      updateOrg.mutate({
                        name: orgName ?? organization.name,
                        billing_email: billingEmail ?? organization.billing_email,
                      })
                    }
                    disabled={updateOrg.isPending}
                  >
                    {updateOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('team.settings.save')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
