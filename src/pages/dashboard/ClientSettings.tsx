import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ProfileCompletenessCard } from '@/components/client/ProfileCompletenessCard';
import { firmendatenAus, joinAddress } from '@/lib/firmendaten';
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
  Sparkles,
  Users,
  TrendingUp,
  Calendar,
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
  // Firmendaten fuer die Vereinbarung (Migration 20260924120000)
  legal_name?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  registration_number?: string | null;
  // Partner Facts
  headcount: number | null;
  annual_revenue: string | null;
  founded_year: number | null;
  unique_selling_point: string | null;
  company_awards: string[] | null;
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
  const partnerFactsRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [verifiziertAm, setVerifiziertAm] = useState<string | null>(null);
  const [impressumLaedt, setImpressumLaedt] = useState(false);
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
    headcount: null,
    annual_revenue: null,
    founded_year: null,
    unique_selling_point: null,
    company_awards: null,
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
      
      const { data: verif } = await supabase
        .from('client_verifications')
        .select('kyc_status, kyc_verified_at, company_registration_number, vat_id')
        .eq('client_id', user!.id)
        .maybeSingle();
      const f = firmendatenAus(data as any, verif as any);
      setVerifiziertAm(f.verified_at);
      if (data) {
        // Die Felder kommen aus den neuen Spalten -- oder, solange es die live
        // noch nicht gibt, aus Adresszeile und Verifizierung.
        setProfile({
          ...(data as any),
          legal_name: f.legal_name,
          street: f.street,
          postal_code: f.postal_code,
          city: f.city,
          registration_number: f.registration_number,
          tax_id: f.vat_id || null,
        });
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToPartnerFacts = () => {
    partnerFactsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const adresse = joinAddress({
        street: profile.street ?? '', postal_code: profile.postal_code ?? '', city: profile.city ?? '',
      }) || profile.address;
      const neueFelder = {
        legal_name: profile.legal_name || null,
        street: profile.street || null,
        postal_code: profile.postal_code || null,
        city: profile.city || null,
        registration_number: profile.registration_number || null,
      };
      // HRB und USt-ID auch in der Verifizierung -- die gibt es live schon.
      await supabase
        .from('client_verifications')
        .update({ company_registration_number: profile.registration_number || null, vat_id: profile.tax_id || null } as any)
        .eq('client_id', user.id);

      if (profile.id) {
        // Update existing. Fehlen die neuen Spalten live noch (Migration nicht
        // eingespielt), wird ohne sie gespeichert.
        const erst = await supabase.from('company_profiles').update({ ...neueFelder, address: adresse } as any).eq('id', profile.id);
        if (erst.error && !/column/i.test(erst.error.message ?? '')) throw erst.error;
        if (erst.error) {
          toast({ title: 'Firmierung und Handelsregister werden gespeichert, sobald das Datenbank-Update eingespielt ist.' });
        }
        const { error } = await supabase
          .from('company_profiles')
          .update({
            company_name: profile.company_name,
            logo_url: profile.logo_url,
            industry: profile.industry,
            website: profile.website,
            description: profile.description,
            address: adresse,
            tax_id: profile.tax_id,
            billing_email: profile.billing_email,
            headcount: profile.headcount,
            annual_revenue: profile.annual_revenue,
            founded_year: profile.founded_year,
            unique_selling_point: profile.unique_selling_point,
            company_awards: profile.company_awards,
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
            address: adresse,
            tax_id: profile.tax_id,
            billing_email: profile.billing_email,
            headcount: profile.headcount,
            annual_revenue: profile.annual_revenue,
            founded_year: profile.founded_year,
            unique_selling_point: profile.unique_selling_point,
            company_awards: profile.company_awards,
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
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
        <div className="space-y-6 max-w-3xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
            <p className="text-muted-foreground">Verwalten Sie Ihr Firmenprofil und Ihre Einstellungen</p>
          </div>

          {/* Profile Completeness Banner */}
          <ProfileCompletenessCard 
            profile={profile} 
            onScrollToSection={scrollToPartnerFacts}
          />

          {/* Company Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Firmenprofil
              </CardTitle>
              <CardDescription>
                Informationen zu Ihrem Unternehmen
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
                  placeholder="Kurze Beschreibung Ihres Unternehmens ..."
                  rows={3}
                />
              </div>

              <Separator />

              {/* Firmendaten: stehen auf der Vereinbarung und werden in der
                  Positionsaufnahme nur noch angezeigt, nicht mehr abgefragt. */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">Firmendaten</h3>
                  <span className="text-xs text-muted-foreground">— stehen auf Ihrem Rahmenvertrag</span>
                  {verifiziertAm && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                      ✓ von Matchunt verifiziert am {new Date(verifiziertAm).toLocaleDateString('de-DE')}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    disabled={impressumLaedt || !profile.website}
                    onClick={async () => {
                      setImpressumLaedt(true);
                      const { data, error } = await supabase.functions.invoke('enrich-company-from-domain', {
                        body: { domain: profile.website },
                      });
                      setImpressumLaedt(false);
                      const a = (data as any)?.data;
                      if (error || !a) {
                        toast({ title: 'Impressum konnte nicht gelesen werden', variant: 'destructive' });
                        return;
                      }
                      // Hier ueberschreibt der Vorschlag bewusst -- der Kunde
                      // sieht die Werte und speichert erst selbst.
                      setProfile((p) => ({
                        ...p,
                        legal_name: a.legal_name || p.legal_name,
                        street: a.street || p.street,
                        postal_code: a.postal_code || p.postal_code,
                        city: a.city || p.city,
                        registration_number: a.registration_number || p.registration_number,
                        tax_id: a.vat_id || p.tax_id,
                      }));
                      toast({ title: 'Aus dem Impressum übernommen — bitte prüfen und speichern.' });
                    }}
                  >
                    {impressumLaedt ? 'Wird gelesen …' : 'Aus Impressum übernehmen'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="legal_name">Vollständige Firmierung</Label>
                    <Input id="legal_name" value={profile.legal_name || ''} placeholder="Muster & Partner GmbH"
                           onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="street">Straße und Hausnummer</Label>
                    <Input id="street" value={profile.street || ''} placeholder="Musterstraße 1"
                           onChange={(e) => setProfile({ ...profile, street: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-[7rem_1fr] gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">PLZ</Label>
                      <Input id="postal_code" value={profile.postal_code || ''} placeholder="80331"
                             onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Ort</Label>
                      <Input id="city" value={profile.city || ''} placeholder="München"
                             onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registration_number">Handelsregister</Label>
                    <Input id="registration_number" value={profile.registration_number || ''} placeholder="HRB 123456"
                           onChange={(e) => setProfile({ ...profile, registration_number: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">USt-IdNr.</Label>
                    <Input id="tax_id" value={profile.tax_id || ''} placeholder="DE123456789"
                           onChange={(e) => setProfile({ ...profile, tax_id: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ändern Sie diese Angaben nur, wenn sich Firmierung oder Anschrift geändert haben — sie stehen auf Ihrem Rahmenvertrag.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Partner Facts for Recruiters */}
          <Card ref={partnerFactsRef}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Partner Facts für Recruiter
              </CardTitle>
              <CardDescription>
                Diese Angaben übernehmen wir automatisch in jede neue Stellenaufnahme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headcount" className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Mitarbeiteranzahl
                  </Label>
                  <Input
                    id="headcount"
                    type="number"
                    value={profile.headcount || ''}
                    onChange={(e) => setProfile({ ...profile, headcount: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="z.B. 2000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="annual_revenue" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Jahresumsatz
                  </Label>
                  <Input
                    id="annual_revenue"
                    value={profile.annual_revenue || ''}
                    onChange={(e) => setProfile({ ...profile, annual_revenue: e.target.value })}
                    placeholder="z.B. 250 Mio. €"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="founded_year" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Gründungsjahr
                  </Label>
                  <Input
                    id="founded_year"
                    type="number"
                    value={profile.founded_year || ''}
                    onChange={(e) => setProfile({ ...profile, founded_year: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="z.B. 1943"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unique_selling_point">Unique Selling Point</Label>
                <Textarea
                  id="unique_selling_point"
                  value={profile.unique_selling_point || ''}
                  onChange={(e) => setProfile({ ...profile, unique_selling_point: e.target.value })}
                  placeholder="z.B. Global führendes Unternehmen mit starkem Innovationsfokus"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Was macht Ihr Unternehmen für Kandidaten besonders attraktiv?
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Team Members - Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Team-Mitglieder</CardTitle>
              <CardDescription>
                Verwalten Sie, wer Zugriff auf Ihr Dashboard hat
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Team-Verwaltung kommt bald
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hier können Sie bald Hiring Manager, HR und Viewer einladen.
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
  );
}