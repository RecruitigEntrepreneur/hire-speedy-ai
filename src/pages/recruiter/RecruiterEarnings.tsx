import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVerdienste } from '@/lib/abrechnungApi';
import { VerdiensteUebersicht } from '@/components/recruiter/verdienste/VerdiensteUebersicht';
import { GutschriftenReiter } from '@/components/recruiter/verdienste/GutschriftenReiter';
import { AbrechnungsdatenReiter } from '@/components/recruiter/verdienste/AbrechnungsdatenReiter';
import { BesetzungFenster } from '@/components/recruiter/verdienste/BesetzungFenster';
import { KonditionenHinweis } from '@/components/recruiter/verdienste/KonditionenHinweis';

type Reiter = 'uebersicht' | 'gutschriften' | 'abrechnungsdaten';
const REITER: Reiter[] = ['uebersicht', 'gutschriften', 'abrechnungsdaten'];

/**
 * Verdienste (Umbau 11.11.2026, H8/H11/H13): was du bekommst, wann und wofür.
 * Ersetzt „Earnings & Payouts“ und die Seite „Auszahlungen“. Reiter über ?reiter=,
 * ein Besetzungs-Fenster über ?besetzung=<placementId>, Konto ändern über ?konto=1.
 */
export default function RecruiterEarnings() {
  const [params, setParams] = useSearchParams();
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
      <div className="max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verdienste</h1>
          <p className="text-sm text-muted-foreground">Was du bekommst, wann und wofür.</p>
        </div>
        <KonditionenHinweis />
        <Tabs value={reiter} onValueChange={(v) => setParam('reiter', v === 'uebersicht' ? null : v)}>
          <TabsList>
            <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
            <TabsTrigger value="gutschriften">Gutschriften{count > 0 ? ` (${count})` : ''}</TabsTrigger>
            <TabsTrigger value="abrechnungsdaten">Abrechnungsdaten</TabsTrigger>
          </TabsList>
          <TabsContent value="uebersicht" className="mt-4">
            {q.isLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              : q.isError ? <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : 'Deine Verdienste konnten nicht geladen werden.'}</p>
                : q.data ? <VerdiensteUebersicht data={q.data} onOpen={(id) => setParam('besetzung', id)} onAbrechnungsdaten={() => setParam('reiter', 'abrechnungsdaten')} /> : null}
          </TabsContent>
          <TabsContent value="gutschriften" className="mt-4"><GutschriftenReiter /></TabsContent>
          <TabsContent value="abrechnungsdaten" className="mt-4"><AbrechnungsdatenReiter openAccount={params.get('konto') === '1'} /></TabsContent>
        </Tabs>
      </div>
      <BesetzungFenster placementId={besetzung} onClose={() => setParam('besetzung', null)} />
    </DashboardLayout>
  );
}
