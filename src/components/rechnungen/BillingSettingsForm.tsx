import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { billingApi, type BillingSettings } from '@/lib/billingApi';
import { taxHint } from './invoiceView';

/**
 * Rechnungsdaten (Etappe 3, 25.10.2026; Umbau 11.11.2026, K12): dieselben Felder wie die
 * Firmendaten unter Einstellungen › Unternehmen, hier für die Buchhaltung gebündelt. Neu: das
 * Land (es bestimmt die Steuer) und ein erklärter Schalter „Bestellnummer ist bei uns Pflicht“.
 * Ändern dürfen Inhaber, Admins und die Buchhaltung; HR sieht sie nur. Gilt für neue Rechnungen.
 * Ein „Konto für Erstattungen“ gibt es nicht, weil es keine Erstattung gibt; das Format
 * (E-Rechnung) kommt später, bis dahin nur der stille Hinweis „Format: PDF“.
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
        country: v.country || 'DE',
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
          {field('Land', (
            <Select disabled={ro} value={v.country || 'DE'} onValueChange={(c) => setV((x) => ({ ...x, country: c }))}>
              <SelectTrigger aria-label="Land"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(settings.countries?.length ? settings.countries : [{ code: 'DE', name: 'Deutschland' }]).map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ), `Das Land bestimmt die Steuer. ${taxHint(v.country || 'DE', v.taxId)}`)}
          {field('USt-IdNr.', <Input disabled={ro} value={v.taxId} onChange={set('taxId')} placeholder="DE123456789" />)}
        </div>
        <div className="space-y-3">
          {field('Rechnungen per Mail an', <Input disabled={ro} type="email" value={v.billingEmail} onChange={set('billingEmail')} placeholder="buchhaltung@firma.de" />)}
          {field('Weitere Empfänger (cc)', <Input disabled={ro} value={v.cc} onChange={set('cc')} placeholder="controlling@firma.de, …" />, 'Bis zu fünf Adressen, mit Komma getrennt.')}
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div><p>Bestellnummer ist bei uns Pflicht</p><p className="text-xs text-muted-foreground">Dann fragen wir sie nach jeder Unterschrift als Aufgabe ab. Fehlt sie nach 7 Tagen, stellen wir die Rechnung mit „Bestellnummer folgt“.</p></div>
            <Switch disabled={ro} checked={v.po} onCheckedChange={(c) => setV((x) => ({ ...x, po: c }))} aria-label="Bestellnummer ist bei uns Pflicht" />
          </div>
          {field('Standard-Kostenstelle', <Input disabled={ro} value={v.costCenter} onChange={set('costCenter')} placeholder="z. B. 4100" />, 'Je Einstellung überschreibbar.')}
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <p>Zahlungsziel: {settings.paymentTermsDays} Tage</p>
            <p className="text-xs text-muted-foreground">laut Rahmenvertrag, ändert nur Matchunt · Format der Rechnung: {settings.format || 'PDF'}</p>
          </div>
        </div>
      </div>
      {!ro && <Button disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Speichern</Button>}
    </div>
  );
}

function toForm(s: BillingSettings) {
  return {
    name: s.name ?? '', street: s.street ?? '', postalCode: s.postalCode ?? '', city: s.city ?? '', country: s.country ?? '', taxId: s.taxId ?? '',
    billingEmail: s.billingEmail ?? '', cc: (s.ccEmails ?? []).join(', '), po: !!s.purchaseOrderRequired, costCenter: s.defaultCostCenter ?? '',
  };
}
