import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { fmtNumber } from '@/lib/localeFormat';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ARBEITGEBER_FELDER, listeAus } from '@/lib/arbeitgeberVorschlaege';
import { AusAufnahme, Fehlt, SettingsBlock, SettingsSubpage } from './SettingsShell';
import type { CompanyProfile, useCompanyProfile } from './useCompanyProfile';

const BAENDER: [number, number][] = [[1, 50], [50, 250], [250, 500], [500, 1000], [1000, 5000]];
const groesse = (n: number | null) => {
  if (n == null) return null;
  const band = BAENDER.find(([, bis]) => n < bis);
  return band
    ? i18n.t('clientSettings:auftritt.sizeBand', { from: fmtNumber(band[0]), to: fmtNumber(band[1]) })
    : i18n.t('clientSettings:auftritt.sizeOver', { from: fmtNumber(5000) });
};

/** Was Headhunter vor „Ich suche“ ungefähr sehen: Branche, Größenband, drei Argumente -- ohne Namen. */
function Vorschau({ p }: { p: CompanyProfile }) {
  const { t } = useTranslation('clientSettings');
  const punkte = [p.unique_selling_point?.trim(), ...listeAus(p.employer_selling_points), ...listeAus(p.benefits)]
    .filter((x): x is string => !!x)
    .slice(0, 3);
  const kopf = [p.industry, groesse(p.headcount)].filter(Boolean).join(' · ');
  return (
    <aside className="space-y-2 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('auftritt.previewTitle')}</h2>
      <p className="text-sm font-medium">{kopf || t('auftritt.previewMissing')}</p>
      <p className="text-xs text-muted-foreground">{t('auftritt.previewName')}</p>
      {punkte.length > 0
        ? <ul className="space-y-1 pt-1 text-sm">{punkte.map((x) => <li key={x} className="flex gap-2"><span className="text-muted-foreground">·</span><span className="min-w-0">{x}</span></li>)}</ul>
        : <p className="pt-1 text-xs text-muted-foreground">{t('auftritt.previewNoPoints')}</p>}
      <p className="pt-2 text-[11px] text-muted-foreground">{t('auftritt.previewCandidates')}</p>
    </aside>
  );
}

/** Unterseite „Auftritt bei Headhuntern“: Eckdaten, USP, Arbeitgeberprofil, mit Vorschau. */
export function AuftrittSettings({ company, onBack }: { company: ReturnType<typeof useCompanyProfile>; onBack: () => void }) {
  const { t } = useTranslation('clientSettings');
  const { profile, update, saveState, ausAufnahme, vorschlaege, stelle } = company;
  const zahl = (v: string) => (v ? parseInt(v, 10) : null);
  const feldWert = (feld: string) => (profile as unknown as Record<string, unknown>)[feld];

  return (
    <SettingsSubpage title={t('auftritt.title')} description={t('auftritt.description')} saveState={saveState} onBack={onBack}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-5">
          <SettingsBlock title={t('auftritt.facts')}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="headcount">{t('auftritt.headcount')}<AusAufnahme show={ausAufnahme('headcount')} /><Fehlt show={profile.headcount == null} /></Label>
                <Input id="headcount" type="number" value={profile.headcount ?? ''} onChange={(e) => update({ headcount: zahl(e.target.value) })} placeholder={t('hub.headcountPh')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annual_revenue">{t('auftritt.revenue')}</Label>
                <Input id="annual_revenue" value={profile.annual_revenue || ''} onChange={(e) => update({ annual_revenue: e.target.value })} placeholder={t('auftritt.revenuePh')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="founded_year">{t('auftritt.founded')}</Label>
                <Input id="founded_year" type="number" value={profile.founded_year ?? ''} onChange={(e) => update({ founded_year: zahl(e.target.value) })} placeholder={t('auftritt.foundedPh')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unique_selling_point">{t('auftritt.usp')}<Fehlt show={!profile.unique_selling_point?.trim()} /></Label>
              <Textarea id="unique_selling_point" rows={2} value={profile.unique_selling_point || ''} onChange={(e) => update({ unique_selling_point: e.target.value })} placeholder={t('auftritt.uspPh')} />
            </div>
          </SettingsBlock>

          <SettingsBlock title={t('auftritt.asEmployer')}>
            {ARBEITGEBER_FELDER.filter((f) => f.feld !== 'target_companies' && f.feld !== 'excluded_companies').map(({ feld, label, hilfe }) => (
              <ListenFeld key={feld} feld={feld} label={label} hilfe={hilfe} wert={feldWert(feld)} vorschlag={vorschlaege.find((v) => v.feld === feld)?.werte} stelleTitel={stelle?.title} onChange={(v) => update({ [feld]: v } as Partial<CompanyProfile>)} />
            ))}
          </SettingsBlock>

          <SettingsBlock title={t('auftritt.whereSearch')}>
            <div className="grid gap-4 md:grid-cols-2">
              {ARBEITGEBER_FELDER.filter((f) => f.feld === 'target_companies' || f.feld === 'excluded_companies').map(({ feld, label, hilfe }) => (
                <ListenFeld key={feld} feld={feld} label={feld === 'excluded_companies' ? t('auftritt.noPoach') : label} hilfe={hilfe} wert={feldWert(feld)} vorschlag={vorschlaege.find((v) => v.feld === feld)?.werte} stelleTitel={stelle?.title} onChange={(v) => update({ [feld]: v } as Partial<CompanyProfile>)} />
              ))}
            </div>
          </SettingsBlock>
        </div>
        <Vorschau p={profile} />
      </div>
    </SettingsSubpage>
  );
}

/** Mehrzeiliges Listenfeld; Vorschläge aus der jüngsten Stelle lassen sich mit einem Klick übernehmen. */
function ListenFeld({ feld, label, hilfe, wert, vorschlag, stelleTitel, onChange }: {
  feld: string; label: string; hilfe: string; wert: unknown; vorschlag?: string[]; stelleTitel?: string | null; onChange: (v: string[]) => void;
}) {
  const { t } = useTranslation('clientSettings');
  return (
    <div className="space-y-2">
      <Label htmlFor={feld}>{label}</Label>
      {vorschlag && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{stelleTitel ? t('auftritt.fromJobTitled', { title: stelleTitel }) : t('auftritt.fromJob')}</p>
            <p>{vorschlag.join(' · ')}</p>
          </div>
          <Button size="sm" onClick={() => onChange(vorschlag)}>{t('auftritt.apply')}</Button>
        </div>
      )}
      <Textarea id={feld} rows={2} value={Array.isArray(wert) ? wert.join('\n') : listeAus(wert).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} placeholder={t('auftritt.onePerLine')} />
      <p className="text-xs text-muted-foreground">{hilfe}</p>
    </div>
  );
}
