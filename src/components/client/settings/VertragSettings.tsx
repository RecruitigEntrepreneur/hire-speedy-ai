import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { SettingsBlock, SettingsSubpage } from './SettingsShell';

type Agreement = {
  agreement_number: string | null;
  status: string;
  customer_signed_at: string | null;
  countersigned_at: string | null;
  signed_document_path: string | null;
};
type Invoice = { id: string; invoice_number: string; total_amount: number | null; status: string; created_at: string; pdf_url: string | null };

const STATUS: Record<string, string> = {
  draft: 'in Vorbereitung', pending_release: 'in Vorbereitung', sent: 'wartet auf Ihre Unterschrift',
  customer_signed: 'von Ihnen unterschrieben, Gegenzeichnung folgt', active: 'unterschrieben und gegengezeichnet',
  declined: 'abgelehnt', expired: 'abgelaufen', voided: 'zurückgezogen', superseded: 'ersetzt', terminated: 'beendet',
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('de-DE') : null);
const euro = (n: number | null) => (n == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n));

/** Den Stand des Rahmenvertrags und die Rechnungen an einem Ort; das ausführliche bleibt unter „Abrechnung“. */
export function useVertragStand() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['client-vertrag', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [rv, inv] = await Promise.all([
        supabase.from('client_framework_agreements')
          .select('agreement_number,status,customer_signed_at,countersigned_at,signed_document_path')
          .not('status', 'in', '(superseded,voided)')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('invoices').select('id,invoice_number,total_amount,status,created_at,pdf_url').eq('client_id', user!.id).order('created_at', { ascending: false }).limit(10),
      ]);
      return { agreement: (rv.data as Agreement | null) ?? null, invoices: (inv.data as Invoice[] | null) ?? [] };
    },
  });
}

export function VertragSettings({ billingEmail, onBack, onEditCompany }: { billingEmail: string | null; onBack: () => void; onEditCompany: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useVertragStand();
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

          <SettingsBlock title="Rechnungen" aside={<Link to="/dashboard/billing" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Alle Abrechnungen</Link>}>
            {data && data.invoices.length > 0 ? (
              <ul className="divide-y divide-border text-sm">
                {data.invoices.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                    <span className="min-w-0 flex-1 font-medium">{i.invoice_number}</span>
                    <span className="text-xs text-muted-foreground">{day(i.created_at)}</span>
                    <span className="w-24 text-right tabular-nums">{euro(i.total_amount)}</span>
                    <span className={`w-16 text-xs ${i.status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>{i.status === 'paid' ? 'bezahlt' : 'offen'}</span>
                    {i.pdf_url
                      ? <a href={i.pdf_url} target="_blank" rel="noreferrer" aria-label={`Rechnung ${i.invoice_number} öffnen`} className="text-muted-foreground hover:text-foreground"><FileText className="h-4 w-4" /></a>
                      : <span className="w-4" />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Rechnungen. Rechnungen entstehen erst mit einer Einstellung.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Rechnungen gehen an {billingEmail || 'Ihre Rechnungs-E-Mail (noch nicht hinterlegt)'} ·{' '}
              <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={onEditCompany}>ändern</button>
            </p>
          </SettingsBlock>
        </>
      )}
    </SettingsSubpage>
  );
}
