import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { SettingsBlock, SettingsSubpage } from './SettingsShell';
import { eurCents, useClientInvoices } from '@/lib/billingApi';

type Agreement = {
  agreement_number: string | null;
  status: string;
  customer_signed_at: string | null;
  countersigned_at: string | null;
  signed_document_path: string | null;
};

const STATUS: Record<string, string> = {
  draft: 'in Vorbereitung', pending_release: 'in Vorbereitung', sent: 'wartet auf Ihre Unterschrift',
  customer_signed: 'von Ihnen unterschrieben, Gegenzeichnung folgt', active: 'unterschrieben und gegengezeichnet',
  declined: 'abgelehnt', expired: 'abgelaufen', voided: 'zurückgezogen', superseded: 'ersetzt', terminated: 'beendet',
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('de-DE') : null);

/** Den Stand des Rahmenvertrags; Rechnungen kommen aus dem Bereich „Rechnungen“ (useClientInvoices). */
export function useVertragStand() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['client-vertrag', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [rv] = await Promise.all([
        supabase.from('client_framework_agreements')
          .select('agreement_number,status,customer_signed_at,countersigned_at,signed_document_path')
          .not('status', 'in', '(superseded,voided)')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { agreement: (rv.data as Agreement | null) ?? null };
    },
  });
}

export function VertragSettings({ billingEmail, onBack }: { billingEmail: string | null; onBack: () => void; onEditCompany?: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useVertragStand();
  const invoices = useClientInvoices();
  const a = data?.agreement ?? null;

  const openPdf = async () => {
    if (!a?.signed_document_path) return;
    const { data: signed, error } = await supabase.storage.from('mandate-documents').createSignedUrl(a.signed_document_path, 300);
    if (error || !signed?.signedUrl) {
      toast({ title: 'Vertrag konnte nicht geöffnet werden', description: 'Bitte schreiben Sie uns kurz, wir schicken ihn Ihnen.', variant: 'destructive' });
      return;
    }
    window.open(signed.signedUrl, '_blank', 'noopener');
  };

  return (
    <SettingsSubpage title="Vertrag und Rechnungen" description="Ihr Rahmenvertrag und Ihre Rechnungen an einem Ort." onBack={onBack}>
      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <SettingsBlock title="Rahmenvertrag">
            {a ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm">
                    {a.agreement_number ?? 'Rahmenvertrag'} · <span className={a.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}>{STATUS[a.status] ?? a.status}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[a.customer_signed_at && `Sie: ${day(a.customer_signed_at)}`, a.countersigned_at && `Matchunt: ${day(a.countersigned_at)}`].filter(Boolean).join(' · ') || 'Noch nicht unterschrieben'}
                  </p>
                </div>
                {a.signed_document_path && <Button variant="outline" size="sm" onClick={() => void openPdf()}><Download className="h-4 w-4" />PDF öffnen</Button>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Noch kein Rahmenvertrag. Er entsteht mit Ihrer ersten Stellenaufnahme.</p>
            )}
          </SettingsBlock>

          {/* Rechnungen haben seit Etappe 3 (25.10.2026) einen eigenen Bereich; hier nur der Stand */}
          <SettingsBlock title="Rechnungen" aside={<Link to="/dashboard/rechnungen" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Zu den Rechnungen</Link>}>
            {!invoices.data ? (
              <p className="text-sm text-muted-foreground">wird geladen …</p>
            ) : invoices.data.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Rechnungen. Rechnungen entstehen erst mit einer Einstellung.</p>
            ) : (
              <p className="text-sm">
                {invoices.data.totals.openCount === 0 ? 'Alles bezahlt' : `${invoices.data.totals.openCount === 1 ? '1 offene Rechnung' : `${invoices.data.totals.openCount} offene Rechnungen`} · ${eurCents(invoices.data.totals.openCents)}`}
                <span className="text-muted-foreground"> · {invoices.data.invoices.length === 1 ? '1 Beleg' : `${invoices.data.invoices.length} Belege`} insgesamt</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Rechnungen gehen an {billingEmail || 'Ihre Rechnungs-E-Mail (noch nicht hinterlegt)'} ·{' '}
              <Link to="/dashboard/rechnungen?reiter=daten" className="underline underline-offset-2 hover:text-foreground">Rechnungsdaten</Link>
            </p>
          </SettingsBlock>
        </>
      )}
    </SettingsSubpage>
  );
}
