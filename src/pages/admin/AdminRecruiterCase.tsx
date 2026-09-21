import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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

/** Was DocuSign beim Zurückleiten aus der Gegenzeichnung meldet (event=…), außer signing_complete. */
const RETURN_TEXT: Record<string, string> = {
  cancel: 'Gegenzeichnung abgebrochen. Du kannst sie jederzeit neu starten.',
  decline: 'Du hast die Gegenzeichnung in DocuSign abgelehnt.',
  session_timeout: 'Die DocuSign-Sitzung ist abgelaufen. Starte die Gegenzeichnung neu.',
  ttl_expired: 'Der DocuSign-Link war abgelaufen. Starte die Gegenzeichnung neu.',
  exception: 'DocuSign hat einen Fehler gemeldet. Versuche es noch einmal.',
};
const firstName = (c: StoredOnboarding) => (c.profile.name || '').trim().split(/\s+/)[0] || 'Der Headhunter';
/** Ergebnis nach der Rückkehr aus der eigenen Gegenzeichnung, in Worten. */
const afterCounter = ({ c, contract }: Loaded) => contract?.state === 'completed'
  ? c.activated ? `Gegengezeichnet. ${firstName(c)} ist freigeschaltet, die Willkommensmail ist unterwegs.`
    : 'Gegengezeichnet. Die automatische Freischaltung hat nicht geklappt: Bitte „Freischalten und Zugang senden“ klicken.'
  : contract?.countersigned_at ? 'Deine Unterschrift ist bestätigt. DocuSign stellt den Vertrag noch fertig. Lade die Seite in einer Minute neu.'
    : 'DocuSign hat die Gegenzeichnung noch nicht bestätigt. Lade die Seite in ein paar Minuten neu.';

export default function AdminRecruiterCase() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnHandled = useRef(false);
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
    return { c, contract, docusign: list.docusign_enabled } as Loaded;
  }, [caseId]);

  useEffect(() => {
    setLoading(true); setError('');
    load().catch(e => setError(e instanceof Error ? e.message : 'Der Vorgang konnte nicht geladen werden.')).finally(() => setLoading(false));
  }, [load]);

  // Zurück aus der eigenen Gegenzeichnung (?contract_return=…&event=…): sofort bei DocuSign nachfragen,
  // statt bis zu 15 Minuten zu warten. Ist der Vertrag noch nicht fertig, nach 25 Sekunden ein zweites Mal.
  useEffect(() => {
    if (!data || returnHandled.current) return;
    const params = new URLSearchParams(location.search);
    const contractId = params.get('contract_return');
    if (!contractId) return;
    returnHandled.current = true;
    const event = params.get('event');
    navigate(location.pathname, { replace: true });
    if (event !== 'signing_complete') { setMessage(RETURN_TEXT[event ?? ''] ?? 'Zurück aus DocuSign.'); return; }
    void (async () => {
      setBusy(true); setError(''); setMessage('Deine Unterschrift ist angekommen. Wir holen die Bestätigung von DocuSign …');
      try {
        for (const wait of [0, 25000]) {
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          const result = await onboardingApi<{ contract?: StoredContract }>(true, { action: 'sync', case_id: data.c.id, contract_id: contractId, returned: true, event });
          if (result.contract?.state === 'completed') break;
        }
        setMessage(afterCounter(await load()));
      } catch (e) {
        setMessage('');
        setError(e instanceof Error ? e.message : 'Die Bestätigung von DocuSign konnte nicht abgefragt werden. Lade die Seite in ein paar Minuten neu.');
      } finally { setBusy(false); }
    })();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

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
