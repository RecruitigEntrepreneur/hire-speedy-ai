import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Settings, 
  Building2, 
  Mail, 
  Percent, 
  Zap,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface PlatformSettings {
  platform_name: string;
  platform_logo_url: string;
  default_recruiter_fee: number;
  platform_fee_percentage: number;
  auto_approve_recruiters: boolean;
  require_opt_in: boolean;
  email_notifications_enabled: boolean;
  sender_email: string;
  sender_name: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger_event: string;
  is_active: boolean;
  description: string | null;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>({
    platform_name: 'Matchunt',
    platform_logo_url: '',
    default_recruiter_fee: 20,
    platform_fee_percentage: 5,
    auto_approve_recruiters: false,
    require_opt_in: true,
    email_notifications_enabled: true,
    sender_email: 'noreply@matchunt.ai',
    sender_name: 'Matchunt Team',
  });
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchAutomationRules();
  }, []);

  const fetchSettings = async () => {
    // In a real app, this would fetch from a settings table
    // For now, using default values
    setLoading(false);
  };

  const fetchAutomationRules = async () => {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .order('name');

    if (!error && data) {
      setAutomationRules(data);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    // In a real app, this would save to a settings table
    await new Promise(resolve => setTimeout(resolve, 500));
    toast.success('Einstellungen gespeichert');
    setSaving(false);
  };

  const toggleAutomationRule = async (ruleId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('automation_rules')
      .update({ is_active: isActive })
      .eq('id', ruleId);

    if (error) {
      toast.error('Fehler beim Aktualisieren der Regel');
    } else {
      toast.success(isActive ? 'Regel aktiviert' : 'Regel deaktiviert');
      fetchAutomationRules();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Admin-Einstellungen
            </h1>
            <p className="text-muted-foreground mt-1">
              Plattform-Konfiguration und Automatisierung
            </p>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">Allgemein</TabsTrigger>
            <TabsTrigger value="fees">Gebühren</TabsTrigger>
            <TabsTrigger value="email">E-Mail</TabsTrigger>
            <TabsTrigger value="automation">Automatisierung</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Plattform
                </CardTitle>
                <CardDescription>
                  Grundlegende Plattform-Einstellungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="platform-name">Plattform-Name</Label>
                    <Input
                      id="platform-name"
                      value={settings.platform_name}
                      onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform-logo">Logo URL</Label>
                    <Input
                      id="platform-logo"
                      value={settings.platform_logo_url}
                      onChange={(e) => setSettings({ ...settings, platform_logo_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Recruiter automatisch freigeben</Label>
                      <p className="text-sm text-muted-foreground">
                        Neue Recruiter werden automatisch verifiziert
                      </p>
                    </div>
                    <Switch
                      checked={settings.auto_approve_recruiters}
                      onCheckedChange={(checked) => setSettings({ ...settings, auto_approve_recruiters: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Opt-In erforderlich</Label>
                      <p className="text-sm text-muted-foreground">
                        Kandidaten müssen der Weitergabe ihrer Daten zustimmen
                      </p>
                    </div>
                    <Switch
                      checked={settings.require_opt_in}
                      onCheckedChange={(checked) => setSettings({ ...settings, require_opt_in: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fee Settings */}
          <TabsContent value="fees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Gebühren-Konfiguration
                </CardTitle>
                <CardDescription>
                  Standard-Provisionen und Gebühren
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recruiter-fee">Standard Recruiter-Provision (%)</Label>
                    <Input
                      id="recruiter-fee"
                      type="number"
                      min="0"
                      max="100"
                      value={settings.default_recruiter_fee}
                      onChange={(e) => setSettings({ ...settings, default_recruiter_fee: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Prozentsatz des Jahresgehalts für Recruiter
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform-fee">Plattform-Gebühr (%)</Label>
                    <Input
                      id="platform-fee"
                      type="number"
                      min="0"
                      max="100"
                      value={settings.platform_fee_percentage}
                      onChange={(e) => setSettings({ ...settings, platform_fee_percentage: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Anteil der Provision für die Plattform
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Beispielrechnung</h4>
                  <p className="text-sm text-muted-foreground">
                    Bei einem Jahresgehalt von €60.000:
                  </p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>Gesamt-Fee: €{(60000 * settings.default_recruiter_fee / 100).toLocaleString()}</li>
                    <li>Recruiter erhält: €{(60000 * settings.default_recruiter_fee / 100 * (1 - settings.platform_fee_percentage / 100)).toLocaleString()}</li>
                    <li>Plattform erhält: €{(60000 * settings.default_recruiter_fee / 100 * settings.platform_fee_percentage / 100).toLocaleString()}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Settings */}
          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  E-Mail-Konfiguration
                </CardTitle>
                <CardDescription>
                  Einstellungen für E-Mail-Benachrichtigungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>E-Mail-Benachrichtigungen</Label>
                    <p className="text-sm text-muted-foreground">
                      System-E-Mails aktivieren
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_notifications_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, email_notifications_enabled: checked })}
                  />
                </div>

                <Separator className="my-4" />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sender-name">Absender-Name</Label>
                    <Input
                      id="sender-name"
                      value={settings.sender_name}
                      onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sender-email">Absender-E-Mail</Label>
                    <Input
                      id="sender-email"
                      type="email"
                      value={settings.sender_email}
                      onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Settings */}
          <TabsContent value="automation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Automatisierungsregeln
                </CardTitle>
                <CardDescription>
                  Automatische Aktionen und Workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                {automationRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Keine Automatisierungsregeln konfiguriert</p>
                    <p className="text-sm mt-1">Regeln werden in der Datenbank erstellt</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {automationRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {rule.description || `Trigger: ${rule.trigger_event}`}
                          </p>
                        </div>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => toggleAutomationRule(rule.id, checked)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}