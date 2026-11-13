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
import { useTranslation } from 'react-i18next';

/**
 * Rechnungsdaten (Etappe 3, 25.10.2026; Umbau 11.11.2026, K12): dieselben Felder wie die
 * Firmendaten unter Einstellungen › Unternehmen, hier für die Buchhaltung gebündelt. Neu: das
 * Land (es bestimmt die Steuer) und ein erklärter Schalter „Bestellnummer ist bei uns Pflicht“.
 * Ändern dürfen Inhaber, Admins und die Buchhaltung; HR sieht sie nur. Gilt für neue Rechnungen.
 * Ein „Konto für Erstattungen“ gibt es nicht, weil es keine Erstattung gibt; das Format
 * (E-Rechnung) kommt später, bis dahin nur der stille Hinweis „Format: PDF“.
 */
export function BillingSettingsForm({ settings, canManage }: { settings: BillingSettings; canManage: boolean }) {
  const { t } = useTranslation('clientInvoices');
  const queryClient = useQueryClient();
  const [v, setV] = useState(() => toForm(settings));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setV(toForm(settings)); }, [settings]);
  const ro = !canManage;
  const set = (k: keyof ReturnType<typeof toForm>) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const field = (label: string, el: React.ReactNode, hint?: string, missing?: boolean) => (
    <label className="block text-sm">
      <span className={missing ? 'text-destructive' : 'text-muted-foreground'}>{label}{missing ? t('settings.missing') : ''}</span>
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
      toast.success(t('settings.saved'));
      queryClient.invalidateQueries({ queryKey: ['client-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('settings.intro')}
        {ro && t('settings.readOnly')}
      </p>
      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <div className="space-y-3">
          {field(t('settings.company'), <Input disabled={ro} value={v.name} onChange={set('name')} />)}
          {field(t('settings.street'), <Input disabled={ro} value={v.street} onChange={set('street')} />, undefined, !settings.street)}
          <div className="grid grid-cols-[110px_1fr] gap-2">
            {field(t('settings.postalCode'), <Input disabled={ro} value={v.postalCode} onChange={set('postalCode')} />, undefined, !settings.postalCode)}
            {field(t('settings.city'), <Input disabled={ro} value={v.city} onChange={set('city')} />, undefined, !settings.city)}
          </div>
          {field(t('settings.country'), (
            <Select disabled={ro} value={v.country || 'DE'} onValueChange={(c) => setV((x) => ({ ...x, country: c }))}>
              <SelectTrigger aria-label={t('settings.country')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(settings.countries?.length ? settings.countries : [{ code: 'DE', name: 'Deutschland' }]).map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ), t('settings.countryHint', { hint: taxHint(v.country || 'DE', v.taxId) }))}
          {field(t('settings.vatId'), <Input disabled={ro} value={v.taxId} onChange={set('taxId')} placeholder="DE123456789" />)}
        </div>
        <div className="space-y-3">
          {field(t('settings.billingEmail'), <Input disabled={ro} type="email" value={v.billingEmail} onChange={set('billingEmail')} placeholder={t('settings.billingEmailPlaceholder')} />)}
          {field(t('settings.cc'), <Input disabled={ro} value={v.cc} onChange={set('cc')} placeholder={t('settings.ccPlaceholder')} />, t('settings.ccHint'))}
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div><p>{t('settings.poRequired')}</p><p className="text-xs text-muted-foreground">{t('settings.poRequiredHint')}</p></div>
            <Switch disabled={ro} checked={v.po} onCheckedChange={(c) => setV((x) => ({ ...x, po: c }))} aria-label={t('settings.poRequired')} />
          </div>
          {field(t('settings.defaultCostCenter'), <Input disabled={ro} value={v.costCenter} onChange={set('costCenter')} placeholder={t('settings.costCenterPlaceholder')} />, t('settings.costCenterHint'))}
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <p>{t('settings.paymentTerms', { days: settings.paymentTermsDays })}</p>
            <p className="text-xs text-muted-foreground">{t('settings.paymentTermsHint', { format: settings.format || 'PDF' })}</p>
          </div>
        </div>
      </div>
      {!ro && <Button disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('common.save')}</Button>}
    </div>
  );
}

function toForm(s: BillingSettings) {
  return {
    name: s.name ?? '', street: s.street ?? '', postalCode: s.postalCode ?? '', city: s.city ?? '', country: s.country ?? '', taxId: s.taxId ?? '',
    billingEmail: s.billingEmail ?? '', cc: (s.ccEmails ?? []).join(', '), po: !!s.purchaseOrderRequired, costCenter: s.defaultCostCenter ?? '',
  };
}
