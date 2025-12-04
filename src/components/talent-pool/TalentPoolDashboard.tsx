import { useTalentPool, useTalentAlerts } from '@/hooks/useTalentPool';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TalentPoolCard } from './TalentPoolCard';
import { TalentMatchAlert } from './TalentMatchAlert';
import { Users, Star, Clock, Coffee, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const poolTypeConfig = {
  general: { label: 'Allgemein', icon: Users, color: 'bg-gray-100 text-gray-800' },
  silver_medalist: { label: 'Silber-Medaillist', icon: Star, color: 'bg-amber-100 text-amber-800' },
  future_fit: { label: 'Zukunft', icon: Clock, color: 'bg-blue-100 text-blue-800' },
  passive: { label: 'Passiv', icon: Coffee, color: 'bg-purple-100 text-purple-800' },
};

export function TalentPoolDashboard() {
  const { entries, isLoading: loadingEntries } = useTalentPool();
  const { alerts, isLoading: loadingAlerts, updateAlert } = useTalentAlerts();

  const entriesByType = {
    all: entries || [],
    general: entries?.filter(e => e.pool_type === 'general') || [],
    silver_medalist: entries?.filter(e => e.pool_type === 'silver_medalist') || [],
    future_fit: entries?.filter(e => e.pool_type === 'future_fit') || [],
    passive: entries?.filter(e => e.pool_type === 'passive') || [],
  };

  const stats = {
    total: entries?.length || 0,
    pendingContact: entries?.filter(e => 
      e.next_contact_at && new Date(e.next_contact_at) <= new Date()
    ).length || 0,
    newAlerts: alerts?.length || 0,
  };

  if (loadingEntries) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Im Pool</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{entriesByType.silver_medalist.length}</p>
                <p className="text-sm text-muted-foreground">Silber-Medaillisten</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pendingContact}</p>
                <p className="text-sm text-muted-foreground">Kontakt fällig</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.newAlerts}</p>
                <p className="text-sm text-muted-foreground">Job-Matches</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Neue Job-Matches
              <Badge variant="secondary">{alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert) => (
                <TalentMatchAlert
                  key={alert.id}
                  alert={alert}
                  onDismiss={() => updateAlert.mutate({ id: alert.id, status: 'dismissed' })}
                  onContact={() => updateAlert.mutate({ id: alert.id, status: 'contacted' })}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Talent Pool Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            Alle ({entriesByType.all.length})
          </TabsTrigger>
          {Object.entries(poolTypeConfig).map(([type, config]) => (
            <TabsTrigger key={type} value={type}>
              <config.icon className="h-4 w-4 mr-1" />
              {config.label} ({entriesByType[type as keyof typeof entriesByType].length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4">
            {entriesByType.all.map((entry) => (
              <TalentPoolCard key={entry.id} entry={entry} />
            ))}
            {entriesByType.all.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Noch keine Kandidaten im Talent Pool</p>
                  <p className="text-sm">
                    Fügen Sie abgelehnte Kandidaten hinzu, um sie für zukünftige Jobs zu reaktivieren
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {Object.keys(poolTypeConfig).map((type) => (
          <TabsContent key={type} value={type} className="mt-4">
            <div className="grid gap-4">
              {entriesByType[type as keyof typeof entriesByType].map((entry) => (
                <TalentPoolCard key={entry.id} entry={entry} />
              ))}
              {entriesByType[type as keyof typeof entriesByType].length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>Keine Kandidaten in dieser Kategorie</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
