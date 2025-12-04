import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Building2, 
  Globe,
  Save,
  Upload,
} from 'lucide-react';

interface CompanyProfile {
  id?: string;
  company_name: string;
  logo_url: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  address: string | null;
  tax_id: string | null;
  billing_email: string | null;
}

const INDUSTRIES = [
  'Technologie',
  'Finanzen & Banking',
  'Gesundheitswesen',
  'E-Commerce',
  'Beratung',
  'Produktion',
  'Logistik',
  'Immobilien',
  'Medien & Entertainment',
  'Energie',
  'Bildung',
  'Sonstiges',
];

export default function ClientSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile>({
    company_name: '',
    logo_url: null,
    industry: null,
    website: null,
    description: null,
    address: null,
    tax_id: null,
    billing_email: null,
  });

  useEffect(() => {
    if (user) {
      fetchCompanyProfile();
    }
  }, [user]);

  const fetchCompanyProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      if (profile.id) {
        // Update existing
        const { error } = await supabase
          .from('company_profiles')
          .update({
            company_name: profile.company_name,
            logo_url: profile.logo_url,
            industry: profile.industry,
            website: profile.website,
            description: profile.description,
            address: profile.address,
            tax_id: profile.tax_id,
            billing_email: profile.billing_email,
          })
          .eq('id', profile.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('company_profiles')
          .insert({
            user_id: user.id,
            company_name: profile.company_name,
            logo_url: profile.logo_url,
            industry: profile.industry,
            website: profile.website,
            description: profile.description,
            address: profile.address,
            tax_id: profile.tax_id,
            billing_email: profile.billing_email,
          })
          .select()
          .single();

        if (error) throw error;
        setProfile(data);
      }

      toast({ title: 'Einstellungen gespeichert' });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
            <p className="text-muted-foreground">Verwalte dein Firmenprofil und Einstellungen</p>
          </div>

          {/* Company Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Firmenprofil
              </CardTitle>
              <CardDescription>
                Informationen zu deinem Unternehmen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                  {profile.logo_url ? (
                    <img 
                      src={profile.logo_url} 
                      alt="Logo" 
                      className="h-full w-full object-cover rounded-lg"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Button variant="outline" size="sm" disabled>
                    <Upload className="h-4 w-4 mr-2" />
                    Logo hochladen
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG bis 2MB (Coming soon)
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Firmenname *</Label>
                  <Input
                    id="company_name"
                    value={profile.company_name}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    placeholder="Meine Firma GmbH"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Branche</Label>
                  <Select 
                    value={profile.industry || ''} 
                    onValueChange={(v) => setProfile({ ...profile, industry: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Branche auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="website"
                      value={profile.website || ''}
                      onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                      placeholder="https://meinefirma.de"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_email">Rechnungs-E-Mail</Label>
                  <Input
                    id="billing_email"
                    type="email"
                    value={profile.billing_email || ''}
                    onChange={(e) => setProfile({ ...profile, billing_email: e.target.value })}
                    placeholder="buchhaltung@meinefirma.de"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={profile.description || ''}
                  onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                  placeholder="Kurze Beschreibung deines Unternehmens..."
                  rows={3}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea
                    id="address"
                    value={profile.address || ''}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Musterstraße 1&#10;12345 Berlin"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">USt-IdNr.</Label>
                  <Input
                    id="tax_id"
                    value={profile.tax_id || ''}
                    onChange={(e) => setProfile({ ...profile, tax_id: e.target.value })}
                    placeholder="DE123456789"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Members - Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Team-Mitglieder</CardTitle>
              <CardDescription>
                Verwalte wer Zugriff auf dein Dashboard hat
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Team-Verwaltung kommt bald
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hier kannst du bald Hiring Manager, HR und Viewer einladen.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !profile.company_name}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </div>
  );
}