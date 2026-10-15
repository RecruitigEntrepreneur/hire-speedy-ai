import { useRef, useState } from 'react';
import { Building2, Globe, Info, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { AusAufnahme, Fehlt, SettingsBlock, SettingsSubpage } from './SettingsShell';
import type { useCompanyProfile } from './useCompanyProfile';

const INDUSTRIES = [
  'Technologie', 'Finanzen & Banking', 'Gesundheitswesen', 'E-Commerce', 'Beratung', 'Produktion',
  'Logistik', 'Immobilien', 'Medien & Entertainment', 'Energie', 'Bildung', 'Sonstiges',
];
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Unterseite „Unternehmen“: Name, Logo, Branche, Website, Rechnungsanschrift. */
export function UnternehmenSettings({ company, onBack }: { company: ReturnType<typeof useCompanyProfile>; onBack: () => void }) {
  const { profile, update, saveState, ausAufnahme, verifiedAt } = company;
  const { user } = useAuth();
  const { toast } = useToast();
  const [impressumLaedt, setImpressumLaedt] = useState(false);
  const [logoLaedt, setLogoLaedt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadLogo = async (file: File) => {
    if (!user) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast({ title: 'Bitte ein PNG, JPG oder WebP bis 2 MB wählen', variant: 'destructive' });
      return;
    }
    setLogoLaedt(true);
    try {
      const pfad = `${user.id}/logo-${Date.now()}.${file.type.split('/')[1]}`;
      const { error } = await supabase.storage.from('company-logos').upload(pfad, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('company-logos').getPublicUrl(pfad);
      update({ logo_url: data.publicUrl });
    } catch (err) {
      console.error('Logo-Upload fehlgeschlagen:', err);
      toast({ title: 'Logo konnte nicht hochgeladen werden', variant: 'destructive' });
    } finally {
      setLogoLaedt(false);
    }
  };

  const impressum = async () => {
    setImpressumLaedt(true);
    const { data, error } = await supabase.functions.invoke('enrich-company-from-domain', { body: { domain: profile.website } });
    setImpressumLaedt(false);
    const a = (data as { data?: Record<string, string | undefined> } | null)?.data;
    if (error || !a) {
      toast({ title: 'Impressum konnte nicht gelesen werden', variant: 'destructive' });
      return;
    }
    // Der Vorschlag überschreibt bewusst; der Kunde sieht die Werte direkt im Formular.
    update({
      legal_name: a.legal_name || profile.legal_name,
      street: a.street || profile.street,
      postal_code: a.postal_code || profile.postal_code,
      city: a.city || profile.city,
      registration_number: a.registration_number || profile.registration_number,
      tax_id: a.vat_id || profile.tax_id,
    });
    toast({ title: 'Aus dem Impressum übernommen. Bitte kurz prüfen.' });
  };

  return (
    <SettingsSubpage title="Unternehmen" description="Ihre Firmendaten für Vertrag und Rechnungen." saveState={saveState} onBack={onBack}>
      <SettingsBlock title="Über Ihr Unternehmen">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
            {profile.logo_url ? <img src={profile.logo_url} alt="Logo" className="h-full w-full object-contain" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
          </div>
          <div>
            <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ''; }} />
            <Button variant="outline" size="sm" disabled={logoLaedt} onClick={() => fileRef.current?.click()}>
              {logoLaedt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {profile.logo_url ? 'Logo ersetzen' : 'Logo hochladen'}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG oder WebP bis 2 MB. Headhunter sehen es erst nach „Ich suche“.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">Firmenname<AusAufnahme show={ausAufnahme('company_name')} /><Fehlt show={!profile.company_name.trim()} /></Label>
            <Input id="company_name" value={profile.company_name} onChange={(e) => update({ company_name: e.target.value })} placeholder="Meine Firma GmbH" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Branche<AusAufnahme show={ausAufnahme('industry')} /></Label>
            <Select value={profile.industry || ''} onValueChange={(v) => update({ industry: v })}>
              <SelectTrigger id="industry"><SelectValue placeholder="Branche auswählen" /></SelectTrigger>
              <SelectContent>
                {/* Die Aufnahme kennt freie Branchen ("Telemedizin") -- sonst bliebe die Auswahl leer. */}
                {[...INDUSTRIES, ...(profile.industry && !INDUSTRIES.includes(profile.industry) ? [profile.industry] : [])].map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website<AusAufnahme show={ausAufnahme('website')} /></Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="website" className="pl-9" value={profile.website || ''} onChange={(e) => update({ website: e.target.value })} placeholder="https://meinefirma.de" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Kurzbeschreibung</Label>
          <Textarea id="description" rows={3} value={profile.description || ''} onChange={(e) => update({ description: e.target.value })} placeholder="Was Ihr Unternehmen macht, in zwei Sätzen" />
        </div>
      </SettingsBlock>

      <div id="firmendaten" className="scroll-mt-24">
        <SettingsBlock
          title="Rechnungsanschrift"
          aside={
            <div className="flex flex-wrap items-center gap-2">
              {verifiedAt && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">✓ von Matchunt verifiziert am {new Date(verifiedAt).toLocaleDateString('de-DE')}</span>}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={impressumLaedt || !profile.website} onClick={() => void impressum()}>
                {impressumLaedt ? 'Wird gelesen …' : 'Aus Impressum übernehmen'}
              </Button>
            </div>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="legal_name">Vollständige Firmierung<AusAufnahme show={ausAufnahme('legal_name')} /><Fehlt show={!profile.legal_name?.trim()} /></Label>
            <Input id="legal_name" value={profile.legal_name || ''} placeholder="Muster & Partner GmbH" onChange={(e) => update({ legal_name: e.target.value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="street">Straße und Nr.<AusAufnahme show={ausAufnahme('street')} /></Label>
              <Input id="street" value={profile.street || ''} placeholder="Musterstraße 1" onChange={(e) => update({ street: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">PLZ<AusAufnahme show={ausAufnahme('postal_code')} /></Label>
              <Input id="postal_code" value={profile.postal_code || ''} placeholder="80331" onChange={(e) => update({ postal_code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ort<AusAufnahme show={ausAufnahme('city')} /></Label>
              <Input id="city" value={profile.city || ''} placeholder="München" onChange={(e) => update({ city: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="registration_number">Handelsregister<AusAufnahme show={ausAufnahme('registration_number')} /></Label>
              <Input id="registration_number" value={profile.registration_number || ''} placeholder="HRB 123456" onChange={(e) => update({ registration_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">USt-IdNr.<AusAufnahme show={ausAufnahme('tax_id')} /></Label>
              <Input id="tax_id" value={profile.tax_id || ''} placeholder="DE123456789" onChange={(e) => update({ tax_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_email">Rechnungs-E-Mail<AusAufnahme show={ausAufnahme('billing_email')} /><Fehlt show={!profile.billing_email?.trim()} /></Label>
              <Input id="billing_email" type="email" value={profile.billing_email || ''} placeholder="buchhaltung@firma.de" onChange={(e) => update({ billing_email: e.target.value })} />
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Stehen auf Ihrem Rahmenvertrag. Ändern Sie sie nur, wenn sich Firmierung oder Anschrift geändert haben.</p>
        </SettingsBlock>
      </div>

    </SettingsSubpage>
  );
}
