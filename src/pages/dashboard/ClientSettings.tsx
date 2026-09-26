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
  ARBEITGEBER_FELDER, arbeitgeberVorschlaege, listeAus, type VorschlagStelle,
} from '@/lib/arbeitgeberVorschlaege';
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
  HeartHandshake,
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
  // Arbeitgeberprofil (Variante B, 26.09.2026) -- Listen, beim Tippen roh
  // mit leeren Zeilen, beim Speichern bereinigt.
  culture_values?: unknown;
  employer_selling_points?: unknown;
  benefits?: unknown;
  target_companies?: unknown;
  excluded_companies?: unknown;
  /** Welche Felder aus der Aufnahme kamen (Migration 20260926170000). */
  intake_source?: { draft_id?: string | null; at?: string; fields?: string[] } | null;
}

/** Die still aus der Aufnahme übernommenen Felder -- markiert, bis der Kunde sie ändert. */
const HERKUNFT_FELDER = [
  'company_name', 'legal_name', 'street', 'postal_code', 'city', 'registration_number',
  'tax_id', 'website', 'industry', 'billing_email', 'headcount',
] as const;

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
  const arbeitgeberRef = useRef<HTMLDivElement>(null);
  // Stand beim Laden: daran erkennt die Seite, ob ein Feld aus der Aufnahme
  // noch unverändert ist ("aus Aufnahme") oder vom Kunden geändert wurde.
  const [geladen, setGeladen] = useState<Record<string, unknown>>({});
  // Die jüngste Stelle aus einer Aufnahme -- Quelle der Vorschläge.
  const [stelle, setStelle] = useState<VorschlagStelle | null>(null);
  
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

  // Aus „Ihr Start bei Matchunt“ (Firmendaten ergänzen) direkt zum Abschnitt.
  useEffect(() => {
    if (!loading && window.location.hash === '#firmendaten') {
      document.getElementById('firmendaten')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

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
        const stand = {
          ...(data as any),
          legal_name: f.legal_name,
          street: f.street,
          postal_code: f.postal_code,
          city: f.city,
          registration_number: f.registration_number,
          tax_id: f.vat_id || null,
        };
        setProfile(stand);
        setGeladen(stand);
      }

      const { data: job } = await supabase
        .from('jobs')
        .select('id, title, employment_type, company_culture, unique_selling_points, benefits, target_companies, nogo_companies')
        .eq('client_id', user!.id)
        .not('intake_draft_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setStelle((job as VorschlagStelle | null) ?? null);
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
      const liste = (v: unknown) => { const l = listeAus(v); return l.length ? l : null; };
      // Ein geändertes Feld ist nicht mehr "aus Aufnahme".
      const herkunft = profile.intake_source
        ? {
            ...profile.intake_source,
            fields: (profile.intake_source.fields ?? []).filter(
              (feld) => String((profile as any)[feld] ?? '') === String(geladen[feld] ?? '')),
          }
        : null;
      const neueFelder = {
        legal_name: profile.legal_name || null,
        street: profile.street || null,
        postal_code: profile.postal_code || null,
        city: profile.city || null,
        registration_number: profile.registration_number || null,
        culture_values: liste(profile.culture_values),
        employer_selling_points: liste(profile.employer_selling_points),
        benefits: liste(profile.benefits),
        target_companies: liste(profile.target_companies),
        excluded_companies: liste(profile.excluded_companies),
        intake_source: herkunft,
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
        // Firmierung, Anschrift und Arbeitgeberprofil gingen beim ersten
        // Speichern bisher verloren -- der Insert kannte sie nicht.
        const nach = await supabase.from('company_profiles').update({ ...neueFelder } as any).eq('id', data.id);
        if (nach.error && !/column/i.test(nach.error.message ?? '')) throw nach.error;
        setProfile({ ...profile, ...(data as any) });
      }

      setGeladen({ ...profile });
      toast({ title: 'Einstellungen gespeichert' });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const vorschlaege = arbeitgeberVorschlaege(stelle, profile as any);
  // "aus Aufnahme": übernommen und seitdem nicht geändert.
  const herkunft = (feld: (typeof HERKUNFT_FELDER)[number]) =>
    profile.intake_source?.fields?.includes(feld)
    && String((profile as any)[feld] ?? '') === String(geladen[feld] ?? '')
      ? <span className="ml-1.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-normal text-emerald-600">aus Aufnahme</span>
      : null;

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

          {/* Vorschläge aus der ersten Stelle (Variante B, 26.09.2026) */}
          {vorschlaege.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <p className="flex-1">
                Aus Ihrer ersten Stelle haben wir{' '}
                <strong>{vorschlaege.length === 1 ? 'einen Vorschlag' : `${vorschlaege.length} Vorschläge`}</strong>{' '}
                für Ihr Arbeitgeberprofil. <span className="text-muted-foreground">Prüfen und übernehmen Sie sie unten.</span>
              </p>
              <Button size="sm" variant="outline"
                      onClick={() => arbeitgeberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Ansehen
              </Button>
            </div>
          )}

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
                  <Label htmlFor="company_name">Firmenname *{herkunft('company_name')}</Label>
                  <Input
                    id="company_name"
                    value={profile.company_name}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    placeholder="Meine Firma GmbH"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Branche{herkunft('industry')}</Label>
                  <Select 
                    value={profile.industry || ''} 
                    onValueChange={(v) => setProfile({ ...profile, industry: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Branche auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Die Aufnahme kennt freie Branchen ("Telemedizin") -- sonst
                          bliebe die Auswahl leer, obwohl ein Wert gespeichert ist. */}
                      {[...INDUSTRIES, ...(profile.industry && !INDUSTRIES.includes(profile.industry) ? [profile.industry] : [])]
                        .map((ind) => (
                          <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website{herkunft('website')}</Label>
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
                  <Label htmlFor="billing_email">Rechnungs-E-Mail{herkunft('billing_email')}</Label>
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
              <div id="firmendaten" className="scroll-mt-24 space-y-4">
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
                    <Label htmlFor="legal_name">Vollständige Firmierung{herkunft('legal_name')}</Label>
                    <Input id="legal_name" value={profile.legal_name || ''} placeholder="Muster & Partner GmbH"
                           onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="street">Straße und Hausnummer{herkunft('street')}</Label>
                    <Input id="street" value={profile.street || ''} placeholder="Musterstraße 1"
                           onChange={(e) => setProfile({ ...profile, street: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-[7rem_1fr] gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">PLZ{herkunft('postal_code')}</Label>
                      <Input id="postal_code" value={profile.postal_code || ''} placeholder="80331"
                             onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Ort{herkunft('city')}</Label>
                      <Input id="city" value={profile.city || ''} placeholder="München"
                             onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registration_number">Handelsregister{herkunft('registration_number')}</Label>
                    <Input id="registration_number" value={profile.registration_number || ''} placeholder="HRB 123456"
                           onChange={(e) => setProfile({ ...profile, registration_number: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">USt-IdNr.{herkunft('tax_id')}</Label>
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
                    Mitarbeiteranzahl{herkunft('headcount')}
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

          {/* Arbeitgeberprofil (Variante B, 26.09.2026): was je nach Stelle
              anders sein kann, wird aus der ersten Stelle nur VORGESCHLAGEN. */}
          <Card ref={arbeitgeberRef} className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartHandshake className="h-5 w-5" />
                Arbeitgeberprofil
              </CardTitle>
              <CardDescription>
                Gilt für jede Stelle und hebt Sie bei Recruitern hervor. Kandidaten sehen es erst nach Ihrer Freigabe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {ARBEITGEBER_FELDER.map(({ feld, label, hilfe }) => {
                const roh = (profile as any)[feld];
                const vorschlag = vorschlaege.find((v) => v.feld === feld);
                return (
                  <div key={feld} className="space-y-2">
                    <Label htmlFor={feld}>{label}</Label>
                    {vorschlag && (
                      <div className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            Vorschlag aus Ihrer Stelle{stelle?.title ? ` „${stelle.title}“` : ''}:
                          </p>
                          <p>{vorschlag.werte.join(' · ')}</p>
                        </div>
                        <Button size="sm" onClick={() => setProfile({ ...profile, [feld]: vorschlag.werte })}>
                          Übernehmen
                        </Button>
                      </div>
                    )}
                    <Textarea
                      id={feld}
                      rows={2}
                      value={Array.isArray(roh) ? roh.join('\n') : listeAus(roh).join('\n')}
                      onChange={(e) => setProfile({ ...profile, [feld]: e.target.value.split('\n') })}
                      placeholder="Eine Angabe pro Zeile"
                    />
                    <p className="text-xs text-muted-foreground">{hilfe}</p>
                  </div>
                );
              })}
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