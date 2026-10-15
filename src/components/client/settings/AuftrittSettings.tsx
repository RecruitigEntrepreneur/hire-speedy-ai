import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ARBEITGEBER_FELDER, listeAus } from '@/lib/arbeitgeberVorschlaege';
import { AusAufnahme, Fehlt, SettingsBlock, SettingsSubpage } from './SettingsShell';
import type { CompanyProfile, useCompanyProfile } from './useCompanyProfile';

const groesse = (n: number | null) =>
  n == null ? null : n < 50 ? '1–50 MA' : n < 250 ? '50–250 MA' : n < 500 ? '250–500 MA' : n < 1000 ? '500–1.000 MA' : n < 5000 ? '1.000–5.000 MA' : '5.000+ MA';

/** Was Headhunter vor „Ich suche“ ungefähr sehen: Branche, Größenband, drei Argumente -- ohne Namen. */
function Vorschau({ p }: { p: CompanyProfile }) {
  const punkte = [p.unique_selling_point?.trim(), ...listeAus(p.employer_selling_points), ...listeAus(p.benefits)]
    .filter((t): t is string => !!t)
    .slice(0, 3);
  const kopf = [p.industry, groesse(p.headcount)].filter(Boolean).join(' · ');
  return (
    <aside className="space-y-2 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">So sehen Headhunter Sie</h2>
      <p className="text-sm font-medium">{kopf || 'Branche und Größe fehlen noch'}</p>
      <p className="text-xs text-muted-foreground">Ihren Firmennamen sehen sie erst nach „Ich suche“.</p>
      {punkte.length > 0
        ? <ul className="space-y-1 pt-1 text-sm">{punkte.map((t) => <li key={t} className="flex gap-2"><span className="text-muted-foreground">·</span><span className="min-w-0">{t}</span></li>)}</ul>
        : <p className="pt-1 text-xs text-muted-foreground">Noch keine Argumente. Ergänzen Sie links, was Sie besonders macht.</p>}
      <p className="pt-2 text-[11px] text-muted-foreground">Kandidaten sehen es erst nach Ihrer Freigabe.</p>
    </aside>
  );
}

/** Unterseite „Auftritt bei Headhuntern“: Eckdaten, USP, Arbeitgeberprofil, mit Vorschau. */
export function AuftrittSettings({ company, onBack }: { company: ReturnType<typeof useCompanyProfile>; onBack: () => void }) {
  const { profile, update, saveState, ausAufnahme, vorschlaege, stelle } = company;
  const zahl = (v: string) => (v ? parseInt(v, 10) : null);
  const feldWert = (feld: string) => (profile as unknown as Record<string, unknown>)[feld];

  return (
    <SettingsSubpage title="Auftritt bei Headhuntern" description="Übernehmen wir in jede neue Stelle. So stellen Headhunter Sie Kandidaten vor." saveState={saveState} onBack={onBack}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-5">
          <SettingsBlock title="Eckdaten">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="headcount">Mitarbeitende<AusAufnahme show={ausAufnahme('headcount')} /><Fehlt show={profile.headcount == null} /></Label>
                <Input id="headcount" type="number" value={profile.headcount ?? ''} onChange={(e) => update({ headcount: zahl(e.target.value) })} placeholder="z. B. 400" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annual_revenue">Umsatz</Label>
                <Input id="annual_revenue" value={profile.annual_revenue || ''} onChange={(e) => update({ annual_revenue: e.target.value })} placeholder="z. B. 80 Mio. €" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="founded_year">Gegründet</Label>
                <Input id="founded_year" type="number" value={profile.founded_year ?? ''} onChange={(e) => update({ founded_year: zahl(e.target.value) })} placeholder="z. B. 1987" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unique_selling_point">Was macht Sie besonders?<Fehlt show={!profile.unique_selling_point?.trim()} /></Label>
              <Textarea id="unique_selling_point" rows={2} value={profile.unique_selling_point || ''} onChange={(e) => update({ unique_selling_point: e.target.value })} placeholder="z. B. Weltmarktführer für Dialysetechnik, familiengeführt" />
            </div>
          </SettingsBlock>

          <SettingsBlock title="Als Arbeitgeber">
            {ARBEITGEBER_FELDER.filter((f) => f.feld !== 'target_companies' && f.feld !== 'excluded_companies').map(({ feld, label, hilfe }) => (
              <ListenFeld key={feld} feld={feld} label={label} hilfe={hilfe} wert={feldWert(feld)} vorschlag={vorschlaege.find((v) => v.feld === feld)?.werte} stelleTitel={stelle?.title} onChange={(v) => update({ [feld]: v } as Partial<CompanyProfile>)} />
            ))}
          </SettingsBlock>

          <SettingsBlock title="Wo Headhunter suchen sollen">
            <div className="grid gap-4 md:grid-cols-2">
              {ARBEITGEBER_FELDER.filter((f) => f.feld === 'target_companies' || f.feld === 'excluded_companies').map(({ feld, label, hilfe }) => (
                <ListenFeld key={feld} feld={feld} label={feld === 'excluded_companies' ? 'Bitte nicht abwerben bei' : label} hilfe={hilfe} wert={feldWert(feld)} vorschlag={vorschlaege.find((v) => v.feld === feld)?.werte} stelleTitel={stelle?.title} onChange={(v) => update({ [feld]: v } as Partial<CompanyProfile>)} />
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
  return (
    <div className="space-y-2">
      <Label htmlFor={feld}>{label}</Label>
      {vorschlag && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Aus Ihrer Stelle{stelleTitel ? ` „${stelleTitel}“` : ''}:</p>
            <p>{vorschlag.join(' · ')}</p>
          </div>
          <Button size="sm" onClick={() => onChange(vorschlag)}>Übernehmen</Button>
        </div>
      )}
      <Textarea id={feld} rows={2} value={Array.isArray(wert) ? wert.join('\n') : listeAus(wert).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} placeholder="Eine Angabe pro Zeile" />
      <p className="text-xs text-muted-foreground">{hilfe}</p>
    </div>
  );
}
