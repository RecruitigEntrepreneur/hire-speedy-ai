import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { billingApi, type BillingSettings } from '@/lib/billingApi';

/**
 * Rechnungsdaten (Etappe 3, 25.10.2026): dieselben Felder wie die Firmendaten unter
 * Einstellungen › Unternehmen, hier für die Buchhaltung gebündelt. Ändern dürfen Inhaber,
 * Admins und die Buchhaltung; HR sieht sie nur. Gilt für neue Rechnungen.
 */
export function BillingSettingsForm({ settings, canManage }: { settings: BillingSettings; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [v, setV] = useState(() => toForm(settings));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setV(toForm(settings)); }, [settings]);
  const ro = !canManage;
  const set = (k: keyof ReturnType<typeof toForm>) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const field = (label: string, el: React.ReactNode, hint?: string, missing?: boolean) => (
    <label className="block text-sm">
      <span className={missing ? 'text-destructive' : 'text-muted-foreground'}>{label}{missing ? ' · fehlt' : ''}</span>
      <div className="mt-1">{el}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  const save = async () => {
    setBusy(true);
    try {
      await billingApi.saveSettings({
        name: v.name.trim(), street: v.street.trim(), postalCode: v.postalCode.trim(), city: v.city.trim(), taxId: v.taxId.trim(),
        billingEmail: v.billingEmail.trim(), ccEmails: v.cc.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean),
        purchaseOrderRequired: v.po, defaultCostCenter: v.costCenter.trim(),
      });
      toast.success('Rechnungsdaten gespeichert.');
      queryClient.invalidateQueries({ queryKey: ['client-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gilt für neue Rechnungen. Gestellte Rechnungen ändert nur eine Korrektur. Dieselben Angaben stehen unter Einstellungen › Unternehmen.
        {ro && ' Ändern dürfen Inhaber, Admins und die Buchhaltung.'}
      </p>
      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <div className="space-y-3">
          {field('Firmenname', <Input disabled={ro} value={v.name} onChange={set('name')} />)}
          {field('Straße und Hausnummer', <Input disabled={ro} value={v.street} onChange={set('street')} />, undefined, !settings.street)}
          <div className="grid grid-cols-[110px_1fr] gap-2">
            {field('PLZ', <Input disabled={ro} value={v.postalCode} onChange={set('postalCode')} />, undefined, !settings.postalCode)}
            {field('Ort', <Input disabled={ro} value={v.city} onChange={set('city')} />, undefined, !settings.city)}
          </div>
          {field('USt-ID', <Input disabled={ro} value={v.taxId} onChange={set('taxId')} placeholder="DE123456789" />, 'Firmen in der EU außerhalb Deutschlands: Reverse Charge, ohne deutsche USt.')}
        </div>
        <div className="space-y-3">
          {field('Rechnungen per Mail an', <Input disabled={ro} type="email" value={v.billingEmail} onChange={set('billingEmail')} placeholder="buchhaltung@firma.de" />)}
          {field('Weitere Empfänger (cc)', <Input disabled={ro} value={v.cc} onChange={set('cc')} placeholder="controlling@firma.de, …" />, 'Bis zu fünf Adressen, mit Komma getrennt.')}
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div><p>Bestellnummer Pflicht</p><p className="text-xs text-muted-foreground">Nach der Unterschrift fragt eine Aufgabe die Nummer ab. Ohne sie gibt Matchunt die Rechnung nicht frei.</p></div>
            <Switch disabled={ro} checked={v.po} onCheckedChange={(c) => setV((x) => ({ ...x, po: c }))} aria-label="Bestellnummer Pflicht" />
          </div>
          {field('Standard-Kostenstelle', <Input disabled={ro} value={v.costCenter} onChange={set('costCenter')} placeholder="z. B. 4100" />, 'Je Einstellung überschreibbar.')}
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <p>Zahlungsziel: {settings.paymentTermsDays} Tage</p>
            <p className="text-xs text-muted-foreground">laut Rahmenvertrag, ändert nur Matchunt</p>
          </div>
        </div>
      </div>
      {!ro && <Button disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Speichern</Button>}
    </div>
  );
}

function toForm(s: BillingSettings) {
  return {
    name: s.name ?? '', street: s.street ?? '', postalCode: s.postalCode ?? '', city: s.city ?? '', taxId: s.taxId ?? '',
    billingEmail: s.billingEmail ?? '', cc: (s.ccEmails ?? []).join(', '), po: !!s.purchaseOrderRequired, costCenter: s.defaultCostCenter ?? '',
  };
}
