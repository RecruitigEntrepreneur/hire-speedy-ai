import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '@/lib/localeFormat';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Globe, Info, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { companyAddress, companyLabel, holeFirmenlogo, useClientCompanies } from '@/hooks/useClientCompanies';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { normalizeDomain } from '@/lib/domain';
import { AusAufnahme, Fehlt, SettingsBlock, SettingsSubpage } from './SettingsShell';
import { FirmenBlock } from './FirmenBlock';
import type { useCompanyProfile } from './useCompanyProfile';

/** Gespeicherte Werte (deutsch); angezeigt über clientSettings:unternehmen.industry.i<n>. */
const INDUSTRIES = [
  'Technologie', 'Finanzen & Banking', 'Gesundheitswesen', 'E-Commerce', 'Beratung', 'Produktion',
  'Logistik', 'Immobilien', 'Medien & Entertainment', 'Energie', 'Bildung', 'Sonstiges',
];
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Unterseite „Unternehmen“: Name, Logo, Branche, Website, Rechnungsanschrift. */
export function UnternehmenSettings({ company, onBack }: { company: ReturnType<typeof useCompanyProfile>; onBack: () => void }) {
  const { t } = useTranslation('clientSettings');
  const { profile, update, saveState, ausAufnahme, verifiedAt } = company;
  const industryLabel = (ind: string) => {
    const i = INDUSTRIES.indexOf(ind);
    return i >= 0 ? t(`unternehmen.industry.i${i}`, { defaultValue: ind }) : ind;
  };
  const { user } = useAuth();
  const { toast } = useToast();
  // Firmierung, Anschrift und Register gehören zur Hauptfirma; geändert werden
  // sie nur über „Änderung beantragen“ (Matchunt prüft), nicht frei im Profil.
  const { companies, unavailable } = useClientCompanies();
  const main = unavailable ? null : companies.find((c) => c.role === 'main') ?? null;
  const [impressumLaedt, setImpressumLaedt] = useState(false);
  const [logoLaedt, setLogoLaedt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const neuLaden = () => qc.invalidateQueries({ queryKey: ['client-companies'] });

  // Das Logo gehört zur Hauptfirma (client_companies); die RPC spiegelt es ins
  // Firmenprofil. Vor der Logo-Migration fehlt sie -- dann bleibt es beim Profil.
  const logoDerFirma = async (url: string | null) => {
    if (!main) return;
    const { error } = await (supabase as any).rpc('client_set_company_logo', { p_company_id: main.id, p_logo_url: url });
    if (error && !/client_set_company_logo|function/i.test(error.message ?? '')) console.warn('Logo der Firma:', error.message);
    void neuLaden();
  };
  const logoUrl = profile.logo_url || main?.logo_url || null;
  const vonWebsite = !!logoUrl && main?.logo_source === 'website' && main.logo_url === logoUrl;

  // Website eingetragen: Logo holen, sobald das Profil gespeichert ist (die Function liest es von dort).
  const websiteFertig = () => {
    if (!main || !normalizeDomain(profile.website)) return;
    setTimeout(() => void holeFirmenlogo(main.id).then(neuLaden), 1500);
  };

  const uploadLogo = async (file: File) => {
    if (!user) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast({ title: t('unternehmen.logoType'), variant: 'destructive' });
      return;
    }
    setLogoLaedt(true);
    try {
      const pfad = `${user.id}/logo-${Date.now()}.${file.type.split('/')[1]}`;
      const { error } = await supabase.storage.from('company-logos').upload(pfad, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('company-logos').getPublicUrl(pfad);
      update({ logo_url: data.publicUrl });
      await logoDerFirma(data.publicUrl);
    } catch (err) {
      console.error('Logo-Upload fehlgeschlagen:', err);
      toast({ title: t('unternehmen.logoFailed'), variant: 'destructive' });
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
      toast({ title: t('unternehmen.imprintFailed'), variant: 'destructive' });
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
    toast({ title: t('unternehmen.imprintDone') });
  };

  return (
    <SettingsSubpage title={t('unternehmen.title')} description={t('unternehmen.description')} saveState={saveState} onBack={onBack}>
      <FirmenBlock />

      <SettingsBlock title={t('unternehmen.about')}>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <FirmenLogo url={logoUrl} name={profile.company_name} size={64} className="rounded-lg" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            {vonWebsite && (
              <p className="mb-1.5 text-xs text-muted-foreground">
                {main?.logo_check?.website ? t('unternehmen.logoFromSite', { site: main.logo_check.website }) : t('unternehmen.logoFromYourSite')}
              </p>
            )}
            <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ''; }} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={logoLaedt} onClick={() => fileRef.current?.click()}>
                {logoLaedt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {logoUrl ? t('unternehmen.logoReplace') : t('unternehmen.logoUpload')}
              </Button>
              {logoUrl && (
                <Button variant="ghost" size="sm" disabled={logoLaedt} onClick={() => { update({ logo_url: null }); void logoDerFirma(null); }}>
                  {t('unternehmen.remove')}
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {logoUrl ? t('unternehmen.logoHint') : t('unternehmen.logoHintAuto')}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">{t('unternehmen.companyName')}<AusAufnahme show={ausAufnahme('company_name')} /><Fehlt show={!profile.company_name.trim()} /></Label>
            <Input id="company_name" value={profile.company_name} onChange={(e) => update({ company_name: e.target.value })} placeholder={t('unternehmen.companyNamePh')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">{t('unternehmen.industryLabel')}<AusAufnahme show={ausAufnahme('industry')} /></Label>
            <Select value={profile.industry || ''} onValueChange={(v) => update({ industry: v })}>
              <SelectTrigger id="industry"><SelectValue placeholder={t('unternehmen.industryPh')} /></SelectTrigger>
              <SelectContent>
                {/* Die Aufnahme kennt freie Branchen ("Telemedizin") -- sonst bliebe die Auswahl leer. */}
                {[...INDUSTRIES, ...(profile.industry && !INDUSTRIES.includes(profile.industry) ? [profile.industry] : [])].map((ind) => (
                  <SelectItem key={ind} value={ind}>{industryLabel(ind)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website<AusAufnahme show={ausAufnahme('website')} /></Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="website" className="pl-9" value={profile.website || ''} onChange={(e) => update({ website: e.target.value })} onBlur={websiteFertig} placeholder={t('unternehmen.websitePh')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">{t('unternehmen.descriptionLabel')}</Label>
          <Textarea id="description" rows={3} value={profile.description || ''} onChange={(e) => update({ description: e.target.value })} placeholder={t('unternehmen.descriptionPh')} />
        </div>
      </SettingsBlock>

      <div id="firmendaten" className="scroll-mt-24">
        {main ? (
          <SettingsBlock
            title={t('unternehmen.billingAddress')}
            aside={main.status === 'verified' && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
                {main.decided_at ? t('unternehmen.verifiedOn', { date: fmtDate(main.decided_at) }) : t('unternehmen.verified')}
              </span>
            )}
          >
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">{t('unternehmen.legalNameShort')}</dt><dd>{companyLabel(main)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t('unternehmen.address')}</dt><dd>{companyAddress(main) || '–'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t('unternehmen.registration')}</dt><dd>{main.registration_number || '–'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t('unternehmen.vatId')}</dt><dd>{main.vat_id || '–'}</dd></div>
            </dl>
            <div className="space-y-2 md:w-1/2">
              <Label htmlFor="billing_email">{t('unternehmen.billingEmail')}<AusAufnahme show={ausAufnahme('billing_email')} /><Fehlt show={!profile.billing_email?.trim()} /></Label>
              <Input id="billing_email" type="email" value={profile.billing_email || ''} placeholder={t('unternehmen.billingEmailPh')} onChange={(e) => update({ billing_email: e.target.value })} />
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('unternehmen.fromMain')}</p>
          </SettingsBlock>
        ) : (
        <SettingsBlock
          title={t('unternehmen.billingAddress')}
          aside={
            <div className="flex flex-wrap items-center gap-2">
              {verifiedAt && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">{t('unternehmen.verifiedOn', { date: fmtDate(verifiedAt) })}</span>}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={impressumLaedt || !profile.website} onClick={() => void impressum()}>
                {impressumLaedt ? t('unternehmen.imprintReading') : t('unternehmen.imprintApply')}
              </Button>
            </div>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="legal_name">{t('unternehmen.legalName')}<AusAufnahme show={ausAufnahme('legal_name')} /><Fehlt show={!profile.legal_name?.trim()} /></Label>
            <Input id="legal_name" value={profile.legal_name || ''} placeholder={t('unternehmen.legalNamePh')} onChange={(e) => update({ legal_name: e.target.value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="street">{t('unternehmen.street')}<AusAufnahme show={ausAufnahme('street')} /></Label>
              <Input id="street" value={profile.street || ''} placeholder={t('unternehmen.streetPh')} onChange={(e) => update({ street: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">{t('unternehmen.postalCode')}<AusAufnahme show={ausAufnahme('postal_code')} /></Label>
              <Input id="postal_code" value={profile.postal_code || ''} placeholder={t('unternehmen.postalCodePh')} onChange={(e) => update({ postal_code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t('unternehmen.city')}<AusAufnahme show={ausAufnahme('city')} /></Label>
              <Input id="city" value={profile.city || ''} placeholder={t('unternehmen.cityPh')} onChange={(e) => update({ city: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="registration_number">{t('unternehmen.registration')}<AusAufnahme show={ausAufnahme('registration_number')} /></Label>
              <Input id="registration_number" value={profile.registration_number || ''} placeholder={t('unternehmen.registrationPh')} onChange={(e) => update({ registration_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">{t('unternehmen.vatId')}<AusAufnahme show={ausAufnahme('tax_id')} /></Label>
              <Input id="tax_id" value={profile.tax_id || ''} placeholder={t('unternehmen.vatIdPh')} onChange={(e) => update({ tax_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_email">{t('unternehmen.billingEmail')}<AusAufnahme show={ausAufnahme('billing_email')} /><Fehlt show={!profile.billing_email?.trim()} /></Label>
              <Input id="billing_email" type="email" value={profile.billing_email || ''} placeholder={t('unternehmen.billingEmailPh')} onChange={(e) => update({ billing_email: e.target.value })} />
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('unternehmen.onContract')}</p>
        </SettingsBlock>
        )}
      </div>

    </SettingsSubpage>
  );
}
