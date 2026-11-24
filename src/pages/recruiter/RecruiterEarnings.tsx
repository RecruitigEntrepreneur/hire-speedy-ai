import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVerdienste } from '@/lib/abrechnungApi';
import { VerdiensteUebersicht } from '@/components/recruiter/verdienste/VerdiensteUebersicht';
import { GutschriftenReiter } from '@/components/recruiter/verdienste/GutschriftenReiter';
import { AbrechnungsdatenReiter } from '@/components/recruiter/verdienste/AbrechnungsdatenReiter';
import { BesetzungFenster } from '@/components/recruiter/verdienste/BesetzungFenster';
import { KonditionenHinweis } from '@/components/recruiter/verdienste/KonditionenHinweis';
import { Honorar } from '@/components/recruiter/Honorar';
import i18n from '@/i18n';
import { eur0 } from '../../../supabase/functions/_shared/abrechnung-view';

type Reiter = 'uebersicht' | 'gutschriften' | 'abrechnungsdaten';
const REITER: Reiter[] = ['uebersicht', 'gutschriften', 'abrechnungsdaten'];

/**
 * Verdienste (Umbau 11.11.2026, H8/H11/H13): was du bekommst, wann und wofür.
 * Ersetzt „Earnings & Payouts“ und die Seite „Auszahlungen“. Reiter über ?reiter=,
 * ein Besetzungs-Fenster über ?besetzung=<placementId>, Konto ändern über ?konto=1.
 */
export default function RecruiterEarnings() {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation('recruiterEarnings');
  const reiter: Reiter = REITER.includes(params.get('reiter') as Reiter) ? params.get('reiter') as Reiter : 'uebersicht';
  const besetzung = params.get('besetzung');
  const q = useVerdienste();
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'reiter') next.delete('konto');
    setParams(next, { replace: key !== 'besetzung' });
  };
  const count = q.data?.creditNoteCount ?? 0;

  return (
    <DashboardLayout>
      {/* Apple-Stil (25.11.2026): volle Breite und großer Kopf wie auf den anderen Seiten, Summen in der Unterzeile */}
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('page.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {q.data && q.data.rows.length > 0
              ? <>{t('page.summaryCount', { count: q.data.rows.length })} · <Honorar>{t('page.summaryOpen', { amount: eur0(q.data.totals.waitingStartCents + q.data.totals.waitingGuaranteeCents, i18n.language) })}</Honorar> · <Honorar>{t('page.summaryReceived', { amount: eur0(q.data.totals.receivedYearCents, i18n.language), year: q.data.year })}</Honorar></>
              : t('page.subtitle')}
          </p>
        </div>
        <KonditionenHinweis />
        <Tabs value={reiter} onValueChange={(v) => setParam('reiter', v === 'uebersicht' ? null : v)}>
          <TabsList>
            <TabsTrigger value="uebersicht">{t('page.tabOverview')}</TabsTrigger>
            <TabsTrigger value="gutschriften">{t('page.tabCreditNotes')}{count > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>}</TabsTrigger>
            <TabsTrigger value="abrechnungsdaten">{t('page.tabBilling')}</TabsTrigger>
          </TabsList>
          <TabsContent value="uebersicht" className="mt-4">
            {q.isLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              : q.isError ? <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : t('api.overview')}</p>
                : q.data ? <VerdiensteUebersicht data={q.data} onOpen={(id) => setParam('besetzung', id)} onAbrechnungsdaten={() => setParam('reiter', 'abrechnungsdaten')} onGutschriften={() => setParam('reiter', 'gutschriften')} /> : null}
          </TabsContent>
          <TabsContent value="gutschriften" className="mt-4"><GutschriftenReiter /></TabsContent>
          <TabsContent value="abrechnungsdaten" className="mt-4"><AbrechnungsdatenReiter openAccount={params.get('konto') === '1'} /></TabsContent>
        </Tabs>
      </div>
      <BesetzungFenster placementId={besetzung} onClose={() => setParam('besetzung', null)} />
    </DashboardLayout>
  );
}
