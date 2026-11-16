import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SignFrame } from '@/components/intake/guest/SignFrame';
import { supabase } from '@/integrations/supabase/client';
import { RETURN_CHECKS_MS } from '@/lib/recruiterSignatureReturn';

async function vertrag<T>(action: 'contract-sign' | 'contract-check'): Promise<T> {
  const { data, error } = await supabase.functions.invoke('client-login', { body: { action } });
  if (error) throw error;
  return data as T;
}

/**
 * Unterschreiben aus dem Dashboard, wenn der Kunde das Fenster in der Aufnahme vorher
 * geschlossen hat („Jetzt unterschreiben“ im Start-Kasten). Gleicher Rahmen wie dort.
 */
export default function ClientContractSign() {
  const { t } = useTranslation('clientDashboard');
  const [url, setUrl] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  const [bestaetigen, setBestaetigen] = useState(false);

  const laden = useCallback(async () => {
    setFehler(false);
    try { setUrl((await vertrag<{ url: string }>('contract-sign')).url); }
    catch { setFehler(true); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const pruefen = async () => {
    const stand = await vertrag<{ customer_signed: boolean; declined: boolean }>('contract-check');
    return stand.declined ? 'abgelehnt' as const : stand.customer_signed ? 'unterschrieben' as const : 'offen' as const;
  };

  // Bis der Server die Unterschrift kennt, zeigte das Dashboard sonst wieder „Jetzt unterschreiben“.
  const fertig = async () => {
    setBestaetigen(true);
    let vorher = 0;
    for (const warten of RETURN_CHECKS_MS) {
      await new Promise((r) => setTimeout(r, warten - vorher));
      vorher = warten;
      if (await pruefen().catch(() => 'offen') === 'unterschrieben') break;
    }
    window.location.assign('/dashboard');
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('waiting.signTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('waiting.signText')}</p>
        </div>
        {fehler && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm"><Trans t={t} i18nKey="waiting.signError" components={{ retry: <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void laden()} />, back: <Link to="/dashboard" className="underline" /> }} /></AlertDescription>
          </Alert>
        )}
        {bestaetigen
          ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('waiting.signedOpening')}</p>
          : url
          ? <SignFrame url={url}
              onDone={() => void fertig()}
              onAbbruch={() => { setUrl(null); void laden(); }}
              onNeuerLink={async () => (await vertrag<{ url: string }>('contract-sign')).url}
              onPruefen={pruefen} />
          : !fehler && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('waiting.loading')}</p>}
      </div>
    </DashboardLayout>
  );
}
