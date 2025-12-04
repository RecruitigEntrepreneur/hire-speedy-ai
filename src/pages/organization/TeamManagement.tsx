import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/lib/auth';
import { TeamMemberList } from '@/components/organization/TeamMemberList';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import { PendingInvites } from '@/components/organization/PendingInvites';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Settings, Plus, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizations, memberships, isLoading, createOrganization } = useOrganization();
  
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState<'client' | 'agency'>('client');

  // Select first organization by default
  useEffect(() => {
    if (organizations?.length && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    
    await createOrganization.mutateAsync({
      name: newOrgName,
      type: newOrgType,
    });
    
    setShowCreateForm(false);
    setNewOrgName('');
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // No organizations yet - show create form
  if (!organizations?.length) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-12">
          <Card>
            <CardHeader className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle>Organisation erstellen</CardTitle>
              <CardDescription>
                Erstellen Sie eine Organisation, um Ihr Team zu verwalten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Name der Organisation</Label>
                <Input
                  id="org-name"
                  placeholder="Meine Firma GmbH"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-type">Typ</Label>
                <Select value={newOrgType} onValueChange={(v: any) => setNewOrgType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Unternehmen (Arbeitgeber)</SelectItem>
                    <SelectItem value="agency">Recruiting-Agentur</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={handleCreateOrg}
                disabled={!newOrgName.trim() || createOrganization.isPending}
              >
                {createOrganization.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Organisation erstellen
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team-Verwaltung</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihr Team und Berechtigungen
            </p>
          </div>

          <div className="flex items-center gap-4">
            {organizations.length > 1 && (
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Organisation wählen" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedOrgId && (
              <InviteMemberDialog organizationId={selectedOrgId} />
            )}
          </div>
        </div>

        {selectedOrg && (
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Mitglieder
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Einstellungen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-6 mt-6">
              <PendingInvites organizationId={selectedOrgId} />
              <TeamMemberList
                organizationId={selectedOrgId}
                currentUserId={user?.id || ''}
              />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Organisation: {selectedOrg.name}</CardTitle>
                  <CardDescription>
                    Typ: {selectedOrg.type === 'client' ? 'Unternehmen' : 'Agentur'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={selectedOrg.name} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Billing E-Mail</Label>
                      <Input 
                        value={selectedOrg.billing_email || ''} 
                        placeholder="billing@firma.de"
                        readOnly 
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Erstellt am: {new Date(selectedOrg.created_at).toLocaleDateString('de-DE')}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Create new org button */}
        {!showCreateForm ? (
          <Button
            variant="outline"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Weitere Organisation erstellen
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Neue Organisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="Organisation Name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select value={newOrgType} onValueChange={(v: any) => setNewOrgType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Unternehmen</SelectItem>
                      <SelectItem value="agency">Agentur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewOrgName('');
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleCreateOrg}
                  disabled={!newOrgName.trim() || createOrganization.isPending}
                >
                  {createOrganization.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Erstellen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
