import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fmtDate, fmtMoney } from '@/lib/localeFormat';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { SettingsBlock, SettingsSubpage } from './SettingsShell';
import { useClientInvoices } from '@/lib/billingApi';

type Agreement = {
  agreement_number: string | null;
  status: string;
  customer_signed_at: string | null;
  countersigned_at: string | null;
  signed_document_path: string | null;
};

/** Stände des Rahmenvertrags mit Anzeige unter clientSettings:vertrag.status.<stand>. */
const STATUS = new Set(['draft', 'pending_release', 'sent', 'customer_signed', 'active', 'declined', 'expired', 'voided', 'superseded', 'terminated']);
const day = (iso: string | null) => (iso ? fmtDate(iso) : null);
const eurCents = (c: number) => fmtMoney(c / 100, undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const { t } = useTranslation('clientSettings');
  const { toast } = useToast();
  const { data, isLoading } = useVertragStand();
  const invoices = useClientInvoices();
  const a = data?.agreement ?? null;

  const openPdf = async () => {
    if (!a?.signed_document_path) return;
    const { data: signed, error } = await supabase.storage.from('mandate-documents').createSignedUrl(a.signed_document_path, 300);
    if (error || !signed?.signedUrl) {
      toast({ title: t('vertrag.openFailed'), description: t('vertrag.openFailedLead'), variant: 'destructive' });
      return;
    }
    window.open(signed.signedUrl, '_blank', 'noopener');
  };

  return (
    <SettingsSubpage title={t('vertrag.title')} description={t('vertrag.description')} onBack={onBack}>
      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <SettingsBlock title={t('vertrag.framework')}>
            {a ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm">
                    {a.agreement_number ?? t('vertrag.framework')} · <span className={a.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}>{STATUS.has(a.status) ? t(`vertrag.status.${a.status}`) : a.status}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[a.customer_signed_at && t('vertrag.signedYou', { date: day(a.customer_signed_at) }), a.countersigned_at && t('vertrag.signedMatchunt', { date: day(a.countersigned_at) })].filter(Boolean).join(' · ') || t('vertrag.notSigned')}
                  </p>
                </div>
                {a.signed_document_path && <Button variant="outline" size="sm" onClick={() => void openPdf()}><Download className="h-4 w-4" />{t('vertrag.openPdf')}</Button>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('vertrag.none')}</p>
            )}
          </SettingsBlock>

          {/* Rechnungen haben seit Etappe 3 (25.10.2026) einen eigenen Bereich; hier nur der Stand */}
          <SettingsBlock title={t('vertrag.invoices')} aside={<Link to="/dashboard/rechnungen" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">{t('vertrag.toInvoices')}</Link>}>
            {!invoices.data ? (
              <p className="text-sm text-muted-foreground">{t('vertrag.loading')}</p>
            ) : invoices.data.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('vertrag.noInvoices')}</p>
            ) : (
              <p className="text-sm">
                {invoices.data.totals.openCount === 0 ? t('vertrag.allPaid') : t('vertrag.openInvoices', { count: invoices.data.totals.openCount, amount: eurCents(invoices.data.totals.openCents) })}
                <span className="text-muted-foreground"> · {t('vertrag.documents', { count: invoices.data.invoices.length })}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('vertrag.sentTo', { email: billingEmail || t('vertrag.noBillingEmail') })} ·{' '}
              <Link to="/dashboard/rechnungen?reiter=daten" className="underline underline-offset-2 hover:text-foreground">{t('vertrag.billingData')}</Link>
            </p>
          </SettingsBlock>
        </>
      )}
    </SettingsSubpage>
  );
}
