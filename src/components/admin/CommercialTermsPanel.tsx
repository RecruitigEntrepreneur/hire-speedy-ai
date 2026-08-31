import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Check, Loader2, Percent, Plus, TriangleAlert } from 'lucide-react';
import { intakeDb } from '@/lib/intakeDb';
import { useTermsTemplates } from '@/hooks/useAdminIntakes';
import { useAuth } from '@/lib/auth';

/**
 * Pflege der veröffentlichten Konditionsregel.
 *
 * Ersetzt den bisherigen Gebühren-Tab, der eine Attrappe war: fetchSettings
 * lud nichts, handleSaveSettings wartete 500 ms und meldete „Einstellungen
 * gespeichert" ohne jeden Datenbankzugriff, und keiner der beiden Werte wurde
 * irgendwo gelesen. Der Freigabe-Dialog holte seine Voreinstellungen aus
 * hartkodierten useState-Konstanten.
 *
 * Geändert wird nie eine bestehende Fassung, sondern immer eine neue Version
 * angelegt. Ein Mandat verweist auf die Version, die der Kunde gesehen hat —
 * würde man sie überschreiben, wäre jeder Nachweis wertlos.
 */
export function CommercialTermsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: templates = [], isLoading, error } = useTermsTemplates();

  const active = useMemo(() => templates.find((t) => t.is_active && t.key === 'standard'), [templates]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const openNew = () => {
    const base = active ?? {};
    setForm({
      label: base.label ?? 'Standardkonditionen (Erfolgsbasis)',
      fee_percentage: base.fee_percentage ?? 20,
      recruiter_fee_percentage: base.recruiter_fee_percentage ?? 15,
      min_fee_percentage: base.min_fee_percentage ?? 15,
      max_fee_percentage: base.max_fee_percentage ?? 30,
      min_recruiter_fee_percentage: base.min_recruiter_fee_percentage ?? 10,
      max_recruiter_fee_percentage: base.max_recruiter_fee_percentage ?? 25,
      payment_terms_days: base.payment_terms_days ?? 14,
      guarantee_days: base.guarantee_days ?? 90,
      refund_rule: base.refund_rule ?? '',
      vat_note: base.vat_note ?? 'Alle Beträge verstehen sich zzgl. der gesetzlichen Umsatzsteuer.',
      requires_signature: base.requires_signature ?? true,
      requires_kyb: base.requires_kyb ?? false,
      agb_version: base.agb_version ?? '2026-06',
      body_md: base.body_md ?? '',
    });
    setOpen(true);
  };

  const publish = useMutation({
    mutationFn: async () => {
      const nextVersion = Math.max(0, ...templates.filter((t) => t.key === 'standard').map((t) => Number(t.version))) + 1;

      // Erst die neue Fassung anlegen, dann die alte deaktivieren: der
      // partielle Unique-Index lässt nur eine aktive Fassung je key zu.
      const { error: deactivateErr } = await intakeDb('commercial_terms_templates')
        .update({ is_active: false }).eq('key', 'standard').eq('is_active', true);
      if (deactivateErr) throw deactivateErr;

      const payload = {
        key: 'standard',
        version: nextVersion,
        is_active: true,
        label: String(form.label ?? '').trim() || `Konditionen v${nextVersion}`,
        fee_percentage: Number(form.fee_percentage),
        recruiter_fee_percentage: Number(form.recruiter_fee_percentage),
        min_fee_percentage: Number(form.min_fee_percentage),
        max_fee_percentage: Number(form.max_fee_percentage),
        min_recruiter_fee_percentage: Number(form.min_recruiter_fee_percentage),
        max_recruiter_fee_percentage: Number(form.max_recruiter_fee_percentage),
        fee_basis: 'annual_target_salary',
        payment_terms_days: Number(form.payment_terms_days),
        guarantee_days: form.guarantee_days ? Number(form.guarantee_days) : null,
        refund_rule: String(form.refund_rule ?? '').trim() || null,
        vat_note: String(form.vat_note ?? '').trim() || null,
        requires_signature: form.requires_signature === true,
        requires_kyb: form.requires_kyb === true,
        agb_version: String(form.agb_version ?? '').trim(),
        body_md: String(form.body_md ?? '').trim(),
        body_sha256: await sha256(String(form.body_md ?? '')),
        published_at: new Date().toISOString(),
        created_by: user?.id,
      };

      const { error: insertErr } = await intakeDb('commercial_terms_templates').insert(payload);
      if (insertErr) {
        // Zurückdrehen, sonst steht das System ohne aktive Regel da und
        // nimmt gar keine Beauftragung mehr entgegen.
        if (active) await intakeDb('commercial_terms_templates').update({ is_active: true }).eq('id', active.id);
        throw insertErr;
      }
    },
    onSuccess: () => {
      toast.success('Neue Fassung veröffentlicht.');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['commercial-terms-templates'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Veröffentlichen fehlgeschlagen.'),
  });

  const set = (patch: Record<string, any>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" /> Veröffentlichte Konditionen
            </CardTitle>
            <CardDescription>
              Gilt für alle neuen Beauftragungen. Aufnahme-Links dürfen davon nur innerhalb der
              Bandbreite abweichen — das erzwingt die Datenbank.
            </CardDescription>
          </div>
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Neue Fassung
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Die Konditionsvorlagen sind nicht abrufbar. Vermutlich ist die Migration
                20260901100200_commercial_terms_and_mandates.sql noch nicht angewandt.
              </AlertDescription>
            </Alert>
          ) : !active ? (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Es ist keine Fassung aktiv. Ohne aktive Konditionsregel nimmt das System keine
                Beauftragung entgegen — der Aufnahme-Flow bricht beim Konditionsschritt ab.
              </AlertDescription>
            </Alert>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Fassung" value={`${active.label} · v${active.version}`} />
              <Row label="Erfolgshonorar" value={`${active.fee_percentage} % (Bandbreite ${active.min_fee_percentage}–${active.max_fee_percentage} %)`} />
              <Row label="Recruiter-Anteil" value={`${active.recruiter_fee_percentage} % (Bandbreite ${active.min_recruiter_fee_percentage}–${active.max_recruiter_fee_percentage} %)`} />
              <Row label="Zahlungsziel" value={`${active.payment_terms_days} Tage netto`} />
              <Row label="Nachbesetzung" value={active.guarantee_days ? `${active.guarantee_days} Tage` : '—'} />
              <Row label="Unterschrift" value={active.requires_signature ? 'erforderlich (DocuSign)' : 'nicht erforderlich'} />
              <Row label="KYB vor Freigabe" value={active.requires_kyb ? 'erforderlich' : 'nicht erforderlich'} />
              <Row label="AGB-Fassung" value={active.agb_version} />
              <Row label="Veröffentlicht" value={active.published_at ? format(new Date(active.published_at), 'dd.MM.yyyy', { locale: de }) : '—'} />
            </dl>
          )}
        </CardContent>
      </Card>

      {templates.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Frühere Fassungen</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {templates.filter((t) => !t.is_active).map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                  <span>{t.label} · v{t.version}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.fee_percentage} % · {t.published_at ? format(new Date(t.published_at), 'dd.MM.yyyy', { locale: de }) : 'nie veröffentlicht'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Frühere Fassungen bleiben erhalten: jede bestätigte Vereinbarung verweist auf die
              Version, die der Kunde tatsächlich gesehen hat.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Fassung veröffentlichen</DialogTitle>
            <DialogDescription>
              Die bisherige Fassung bleibt bestehen und gilt für alle bereits bestätigten
              Vereinbarungen weiter. Neue Beauftragungen nutzen ab sofort diese Fassung.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Num label="Erfolgshonorar (%)" k="fee_percentage" form={form} set={set} step={0.5} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Num label="Minimum (%)" k="min_fee_percentage" form={form} set={set} step={0.5} />
              <Num label="Maximum (%)" k="max_fee_percentage" form={form} set={set} step={0.5} />
            </div>
            <Num label="Recruiter-Anteil (%)" k="recruiter_fee_percentage" form={form} set={set} step={0.5} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Num label="Minimum Recruiter (%)" k="min_recruiter_fee_percentage" form={form} set={set} step={0.5} />
              <Num label="Maximum Recruiter (%)" k="max_recruiter_fee_percentage" form={form} set={set} step={0.5} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Num label="Zahlungsziel (Tage)" k="payment_terms_days" form={form} set={set} />
              <Num label="Nachbesetzung (Tage)" k="guarantee_days" form={form} set={set} />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">AGB-Fassung</Label>
              <Input value={form.agb_version ?? ''} onChange={(e) => set({ agb_version: e.target.value })}
                className="mt-1" placeholder="2026-06" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Muss der Angabe auf der AGB-Seite entsprechen — sie wird in jedem Nachweis gespeichert.
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Rückerstattungs- und Nachbesetzungsregel</Label>
              <Textarea rows={3} value={form.refund_rule ?? ''} onChange={(e) => set({ refund_rule: e.target.value })} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Konditionstext (wird dem Kunden gezeigt)</Label>
              <Textarea rows={8} value={form.body_md ?? ''} onChange={(e) => set({ body_md: e.target.value })}
                className="mt-1 font-mono text-xs" />
            </div>

            <label className="flex items-start gap-3 rounded-lg border p-3">
              <Switch checked={form.requires_signature === true} onCheckedChange={(v) => set({ requires_signature: v })} />
              <span className="text-sm">
                Unterzeichnete Vermittlungsvereinbarung vor der Freigabe
                <span className="block text-xs text-muted-foreground">
                  Ist das aus, geht eine Stelle nach der Annahme direkt live. Der Klick des Kunden
                  bleibt protokolliert, aber es gibt kein unterschriebenes Dokument.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3">
              <Switch checked={form.requires_kyb === true} onCheckedChange={(v) => set({ requires_kyb: v })} />
              <span className="text-sm">
                Unternehmensprüfung (KYB) vor der Freigabe
                <span className="block text-xs text-muted-foreground">
                  Standard aus: die Prüfung läuft parallel und blockiert nur Rechnungsstellung und
                  Auszahlung, nicht die Aufnahme.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={() => publish.mutate()} disabled={publish.isPending} className="gap-2">
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Veröffentlichen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Num({
  label, k, form, set, step,
}: { label: string; k: string; form: Record<string, any>; set: (p: Record<string, any>) => void; step?: number }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" step={step ?? 1} value={form[k] ?? ''} className="mt-1"
        onChange={(e) => set({ [k]: e.target.value })} />
    </div>
  );
}
