import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CaseReview } from '@/components/admin/network/CaseReview';
import { useAuth } from '@/lib/auth';
import { buildTimeline } from '@/lib/recruiterNetwork';
import { onboardingApi, type AuditEntry, type StoredContract, type StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import type { MailStat } from '../../../supabase/functions/_shared/email-stats';

/**
 * Vorgangsseite eines Headhunters (/admin/recruiters/:caseId). Lädt über die
 * Admin-Liste; dabei fragt der Server offene Unterschriften bei DocuSign ab.
 */
const DONE: Record<string, string> = {
  approve: 'Prüfung abgeschlossen.',
  sync: 'Bei DocuSign nachgefragt. Neu abgefragt wird höchstens alle 15 Minuten.',
  activate: 'Freigeschaltet, die Zugangsmail ist unterwegs.',
  changes: 'Zur Ergänzung geöffnet. Der Headhunter sieht die Rückfrage beim nächsten Öffnen.',
  void: 'Vertragsvorgang zurückgenommen.',
  revoke: 'Einladung widerrufen.',
  send: 'An DocuSign übergeben.',
};

interface Loaded { c: StoredOnboarding; contract: StoredContract | null; docusign: boolean }

export default function AdminRecruiterCase() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [mails, setMails] = useState<MailStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const list = await onboardingApi<{ cases: StoredOnboarding[]; contracts: StoredContract[]; docusign_enabled: boolean }>(true, { action: 'list' });
    const c = (list.cases ?? []).find(row => row.id === caseId);
    if (!c) throw new Error('Diesen Vorgang gibt es nicht oder nicht mehr unter den letzten 100.');
    const own = (list.contracts ?? []).filter(row => row.case_id === c.id);
    const contract = own.find(row => !['declined', 'voided'].includes(row.state)) ?? own[0] ?? null;
    setData({ c, contract, docusign: list.docusign_enabled });
    const [h, m] = await Promise.allSettled([
      onboardingApi<{ history: AuditEntry[] }>(true, { action: 'history', case_id: c.id }),
      onboardingApi<{ mails: MailStat[] }>(true, { action: 'mails', case_id: c.id }),
    ]);
    setHistory(h.status === 'fulfilled' ? h.value.history ?? [] : []);
    setMails(m.status === 'fulfilled' ? m.value.mails ?? [] : []);
  }, [caseId]);

  useEffect(() => {
    setLoading(true); setError('');
    load().catch(e => setError(e instanceof Error ? e.message : 'Der Vorgang konnte nicht geladen werden.')).finally(() => setLoading(false));
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!data) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await onboardingApi<{ url?: string }>(true, { action, case_id: data.c.id, revision: data.c.revision, contract_id: data.contract?.id, ...extra });
      if (result.url) {
        if (action === 'document') window.open(result.url, '_blank', 'noopener'); else window.location.assign(result.url);
        return;
      }
      await load();
      setMessage(DONE[action] ?? 'Vorgang aktualisiert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Die Aktion ist fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const timeline = useMemo(() => data ? buildTimeline({ caseRow: data.c, contract: data.contract, mails, history, account: null }) : [], [data, mails, history]);

  return <DashboardLayout>
    <div className="container py-6">
      {loading && !data ? <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/>Vorgang wird geladen …</div>
        : !data ? <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Vorgang nicht verfügbar</h1>
          <p role="alert" className="text-sm text-muted-foreground">{error}</p>
          <Link to="/admin/recruiters" className="text-sm underline">Zur Recruiterverwaltung</Link>
        </div>
        : <CaseReview c={data.c} contract={data.contract} history={history} timeline={timeline}
          isCountersigner={!!user?.id && data.contract?.counter_user_id === user.id} docusignEnabled={data.docusign}
          busy={busy} error={error} message={message} onAction={(action, extra) => void act(action, extra)}
          backHref="/admin/recruiters" akteHref={`/admin/recruiters?akte=${data.c.id}`}/>}
    </div>
  </DashboardLayout>;
}
