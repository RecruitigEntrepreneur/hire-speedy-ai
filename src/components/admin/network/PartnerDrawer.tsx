import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { onboardingApi, stateLabels, type AuditEntry } from '@/lib/recruiterOnboardingApi';
import { buildTimeline, PHASE_LABELS, relativeTime, STEP_LABELS, type Partner } from '@/lib/recruiterNetwork';
import type { MailStat } from '../../../../supabase/functions/_shared/email-stats';
import { cleanContractDetails } from '../../../../supabase/functions/_shared/recruiter-contract-data';
import { CaseWorkflow } from './CaseWorkflow';
import { EvidencePanel } from './EvidencePanel';
import { PartnerStatusAdmin } from './PartnerStatusAdmin';
import { MailPanel, type MailState } from './MailPanel';
import { shortDate } from './mailFormat';
import { saveNotes, setSuspended, setVerified } from './accounts';
import type { InvitePrefill } from './InviteSheet';

/**
 * Akte einer Person: nächster Schritt, Verlauf, E-Mails, Vertrag, Leistung und
 * Notizen. Öffnet sich rechts, die Liste bleibt im Blick.
 */
export type DrawerTab = 'overview' | 'mails' | 'contract' | 'evidence' | 'performance' | 'notes';
const NOT_DEPLOYED = /Unbekannte Aktion|Ungültiger Vertragsvorgang/;
const errorText = (e: unknown, fallback: string) => {
  const text = e instanceof Error ? e.message : '';
  return NOT_DEPLOYED.test(text) ? 'Auf dem Server noch nicht ausgerollt.' : text || fallback;
};
const percent = (part: number, total: number) => total ? `${Math.round((part / total) * 100)} %` : '–';

function Stepper({ step }: { step: number }) {
  return <ol className="grid grid-cols-6 gap-1" aria-label="Fortschritt">
    {STEP_LABELS.map((label, i) => <li key={label} className="space-y-1">
      <div className={`h-1.5 rounded-full ${i < step ? 'bg-primary' : 'bg-muted'}`}/>
      <span className={`block text-[11px] leading-tight ${i === step - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </li>)}
  </ol>;
}

export function PartnerDrawer({ partner, open, tab, docusignEnabled, onTabChange, onOpenChange, onChanged, onStartContract }: {
  partner: Partner | null; open: boolean; tab: DrawerTab; docusignEnabled: boolean;
  onTabChange: (tab: DrawerTab) => void; onOpenChange: (open: boolean) => void; onChanged: () => void; onStartContract: (prefill: InvitePrefill) => void;
}) {
  const c = partner?.caseRow ?? null;
  const caseId = c?.id ?? null;
  const [mails, setMails] = useState<MailState | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyNote, setHistoryNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [reissueNote, setReissueNote] = useState('');

  const loadMails = async (id: string) => {
    setMails({ loading: true, error: '', items: [] });
    try {
      const result = await onboardingApi<{ mails: MailStat[] }>(true, { action: 'mails', case_id: id });
      setMails({ loading: false, error: '', items: result.mails ?? [] });
    } catch (e) { setMails({ loading: false, error: errorText(e, 'Mailstatus konnte nicht geladen werden.'), items: [] }); }
  };
  const loadHistory = async (id: string) => {
    try {
      const result = await onboardingApi<{ history: AuditEntry[] }>(true, { action: 'history', case_id: id });
      setHistory(result.history ?? []); setHistoryNote('');
    } catch (e) { setHistory([]); setHistoryNote(errorText(e, 'Protokoll nicht verfügbar.')); }
  };
  useEffect(() => {
    setMails(null); setHistory([]); setHistoryNote('');
    if (open && caseId) { void loadMails(caseId); void loadHistory(caseId); }
  }, [open, caseId]);
  useEffect(() => { setNotes(partner?.account?.notes ?? ''); setError(''); setMessage(''); setReissueNote(''); }, [partner?.key, partner?.account?.notes]);

  const timeline = useMemo(() => partner
    ? buildTimeline({ caseRow: c, contract: partner.contract, mails: mails?.items ?? [], history, account: partner.account })
    : [], [partner, c, mails, history]);

  if (!partner) return null;
  const p = partner;

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(errorText(e, 'Anfrage fehlgeschlagen.')); } finally { setBusy(false); }
  };
  const caseAction = (action: string, extra: Record<string, unknown> = {}) => run(async () => {
    if (!c) return;
    const result = await onboardingApi<{ url?: string }>(true, { action, case_id: c.id, revision: c.revision, contract_id: p.contract?.id, ...extra });
    if (result.url) {
      if (action === 'document') window.open(result.url, '_blank', 'noopener'); else window.location.assign(result.url);
      return;
    }
    setMessage('Vorgang aktualisiert.'); onChanged(); void loadHistory(c.id);
  });
  const reissue = () => run(async () => {
    if (!c || !window.confirm('Neuen Link senden? Die bisherige Einladung wird dabei widerrufen.')) return;
    const result = await onboardingApi<{ expires_at: string }>(true, { action: 'reissue', case_id: c.id, message: reissueNote });
    setMessage(`Neuer Link verschickt, gültig bis ${shortDate(result.expires_at)}. Die bisherige Einladung ist widerrufen.`);
    setReissueNote(''); onChanged();
  });
  const accountAction = (work: () => Promise<void>, done: string) => run(async () => { await work(); setMessage(done); onChanged(); });

  const d = c ? cleanContractDetails(c.profile.contractDetails) : null;
  const a = p.account;
  const prefill = { name: p.name, email: p.email, company: p.company };

  const nextStep = (() => {
    switch (p.next.kind) {
      case 'review': return { text: p.contract?.recruiter_signed_at ? 'Angaben prüfen. Der Headhunter hat schon unterschrieben, danach könnt ihr gegenzeichnen.' : 'Angaben prüfen und die Prüfung abschließen.', action: <Button onClick={() => onTabChange('contract')}>Zur Prüfung</Button> };
      case 'countersign': return { text: 'Geprüft und vom Headhunter unterschrieben. Jetzt fehlt eure Gegenzeichnung.', action: <Button disabled={busy} onClick={() => void caseAction('counter')}>In DocuSign gegenzeichnen</Button> };
      case 'activate': return { text: 'Der Vertrag ist von beiden Seiten unterzeichnet. Mit der Freischaltung geht die Zugangsmail raus.', action: <Button disabled={busy} onClick={() => { if (window.confirm('Freischalten und Zugangsmail senden?')) void caseAction('activate'); }}>Freischalten & Zugang senden</Button> };
      case 'remind':
      case 'resend': return {
        text: p.phase === 'expired' ? 'Der Link ist abgelaufen, ohne dass der Headhunter begonnen hat.'
          : c && 'mail' in c && c.mail === null ? 'Es wurde noch keine Einladungsmail verschickt.'
          : `Eingeladen ${relativeTime(c?.created_at)}, seitdem keine Reaktion.`,
        action: <div className="w-full space-y-2">
          <Textarea placeholder="Persönliche Zeile für die Mail · optional" value={reissueNote} maxLength={1200} onChange={e => setReissueNote(e.target.value)}/>
          <Button disabled={busy} onClick={() => void reissue()}>Neuen Link senden</Button>
          <p className="text-xs text-muted-foreground">Der Link einer Einladung ist unveränderlich. Es entsteht eine neue Einladung mit denselben Angaben, die bisherige wird widerrufen.</p>
        </div>,
      };
      case 'start_contract': return { text: a?.verified ? 'Aktiv mit Altvertrag. Der Rahmenvertrag in Fassung 2.1 fehlt noch.' : 'Registriert, aber ohne Vertrag.', action: <Button variant="outline" onClick={() => onStartContract(prefill)}>Einladung vorbereiten</Button> };
      case 'wait': return { text: p.phase === 'draft' ? `Der Headhunter ergänzt seine Angaben, begonnen ${relativeTime(c?.claimed_at)}.` : p.phase === 'awaiting_signature' ? 'Geprüft. Jetzt ist die Unterschrift des Headhunters dran.' : 'Die Einladung ist unterwegs. Noch ist nichts zu tun.', action: null };
      default: return { text: p.phase === 'suspended' ? 'Das Konto ist gesperrt.' : p.phase === 'revoked' ? 'Die Einladung ist widerrufen.' : 'Keine offenen Schritte.', action: null };
    }
  })();

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader className="space-y-2 pr-8 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="text-xl">{p.name}</SheetTitle>
          <Badge variant="secondary">{PHASE_LABELS[p.phase]}</Badge>
          {p.kind && <Badge variant="outline">{p.kind === 'agency' ? 'Agentur' : 'Einzelrecruiter'}</Badge>}
          {p.isTest && <Badge variant="outline">Test</Badge>}
        </div>
        <SheetDescription>{[p.company, p.email].filter(Boolean).join(' · ')}{c && !c.claimed_at && c.expires_at && !c.revoked_at ? ` · Link gültig bis ${shortDate(c.expires_at)}` : ''}</SheetDescription>
        {p.step > 0 && <Stepper step={p.step}/>}
      </SheetHeader>

      <div className="mt-5 space-y-4">
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
        {message && <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p>}
        <Tabs value={tab} onValueChange={v => onTabChange(v as DrawerTab)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="overview">Überblick</TabsTrigger>
            <TabsTrigger value="mails" disabled={!c}>E-Mails</TabsTrigger>
            <TabsTrigger value="contract" disabled={!c}>Vertrag</TabsTrigger>
            <TabsTrigger value="evidence" disabled={!(a?.userId ?? c?.claimed_by)}>Nachweise{p.needs.evidence ? ' •' : ''}</TabsTrigger>
            <TabsTrigger value="performance">Leistung</TabsTrigger>
            <TabsTrigger value="notes">Notizen</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5 pt-2">
            <section className="space-y-3 rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Nächster Schritt</p>
              <p className="text-sm">{nextStep.text}</p>
              {nextStep.action}
            </section>
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Verlauf</p>
              {historyNote && <p className="text-xs text-muted-foreground">Protokoll: {historyNote} Der Verlauf zeigt, was die Liste kennt.</p>}
              {!timeline.length ? <p className="text-sm text-muted-foreground">Noch keine Einträge.</p> : <ol className="space-y-1.5">
                {timeline.map((t, i) => <li key={`${t.at}-${i}`} className="grid grid-cols-[124px_1fr] gap-3 text-sm">
                  <span className="text-muted-foreground">{shortDate(t.at)}</span>
                  <span className={t.tone === 'good' ? 'font-medium text-emerald-600 dark:text-emerald-400' : t.tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : t.tone === 'muted' ? 'text-muted-foreground' : ''}>{t.text}</span>
                </li>)}
              </ol>}
            </section>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3 text-sm"><p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Vertrag</p>
                {p.contract ? <><p>Fassung {p.contract.package_version}</p><p>Headhunter {p.contract.recruiter_signed_at ? 'unterschrieben' : 'offen'}</p><p>Matchunt {p.contract.countersigned_at ? 'gegengezeichnet' : 'offen'}</p></>
                  : <p className="text-muted-foreground">{a?.verified ? 'Altvertrag, Fassung 2.1 fehlt' : c ? stateLabels[c.state] : 'noch keiner'}</p>}
              </div>
              <div className="rounded-lg border p-3 text-sm"><p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Angaben</p>
                {c && d ? <><p>Register {d.businessEvidence ? 'ok' : 'fehlt'}</p><p>Steuer {d.taxNumber ? 'ok' : 'fehlt'}</p><p>Vertretung {c.profile.authorityDeclared ? 'bestätigt' : 'offen'}</p></> : <p className="text-muted-foreground">keine</p>}
              </div>
              <div className="rounded-lg border p-3 text-sm"><p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Leistung</p>
                {a && a.submissions ? <><p>{a.submissions} Einreichungen</p><p>{a.interviewed} im Interview</p><p>{a.placements} Placements</p></> : <p className="text-muted-foreground">noch keine Einreichungen</p>}
              </div>
            </section>
            <PartnerStatusAdmin userId={a?.userId ?? c?.claimed_by ?? null} active={open && tab === 'overview'} onChanged={onChanged}/>
          </TabsContent>

          <TabsContent value="mails" className="pt-2">
            <MailPanel state={mails} busy={busy} onRefresh={() => { if (caseId) void loadMails(caseId); }}/>
          </TabsContent>

          <TabsContent value="contract" className="pt-2">
            {c ? <CaseWorkflow key={c.id} c={c} packet={p.contract} docusignEnabled={docusignEnabled} busy={busy} onAction={(action, extra) => void caseAction(action, extra)}/>
              : <p className="text-sm text-muted-foreground">Kein Onboarding-Vorgang.</p>}
          </TabsContent>

          <TabsContent value="evidence" className="pt-2">
            <EvidencePanel userId={a?.userId ?? c?.claimed_by ?? null} active={open && tab === 'evidence'} onChanged={onChanged}/>
          </TabsContent>

          <TabsContent value="performance" className="space-y-3 pt-2">
            {!a ? <p className="text-sm text-muted-foreground">Noch kein Recruiter-Konto. Das entsteht, sobald der Headhunter seine E-Mail bestätigt.</p> : <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Einreichungen', a.submissions], ['Im Interview', a.interviewed], ['Interviews', a.interviews], ['Placements', a.placements]].map(([label, value]) =>
                  <div key={label} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-2xl font-semibold">{value}</dd></div>)}
              </dl>
              <p className="text-sm">Interview-Quote {percent(a.interviewed, a.submissions)} · Placement-Quote {percent(a.placements, a.submissions)}</p>
              <p className="text-sm text-muted-foreground">Letzte Einreichung: {a.lastSubmissionAt ? `${shortDate(a.lastSubmissionAt)} (${relativeTime(a.lastSubmissionAt)})` : 'noch keine'}</p>
            </>}
          </TabsContent>

          <TabsContent value="notes" className="space-y-5 pt-2">
            {a ? <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Notizen zum Recruiter</p>
              <Textarea rows={5} placeholder="Nur für euer Team sichtbar" value={notes} onChange={e => setNotes(e.target.value)}/>
              <Button size="sm" disabled={busy || notes === a.notes} onClick={() => void accountAction(() => saveNotes(a.userId, notes), 'Notiz gespeichert.')}>Notiz speichern</Button>
            </section> : <p className="text-sm text-muted-foreground">Notizen gibt es, sobald ein Recruiter-Konto besteht.</p>}
            {c?.internal_note && <section className="space-y-1"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Notiz zur Einladung</p><p className="whitespace-pre-wrap text-sm">{c.internal_note}</p></section>}
            {a && <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Konto</p>
              <p className="text-sm text-muted-foreground">Registriert {shortDate(a.createdAt)} · {a.verified ? 'verifiziert' : 'nicht verifiziert'} · {a.status === 'suspended' ? 'gesperrt' : 'aktiv'}</p>
              <div className="flex flex-wrap gap-2">
                {!c?.activated && <Button size="sm" variant="outline" disabled={busy} onClick={() => void accountAction(() => setVerified(a.userId, !a.verified), a.verified ? 'Verifizierung entfernt.' : 'Konto verifiziert.')}>{a.verified ? 'Verifizierung entfernen' : 'Ohne Vertrag verifizieren'}</Button>}
                <Button size="sm" variant={a.status === 'suspended' ? 'outline' : 'destructive'} disabled={busy}
                  onClick={() => { if (a.status === 'suspended' || window.confirm('Konto sperren? Der Recruiter verliert den Zugang.')) void accountAction(() => setSuspended(a.userId, a.status !== 'suspended'), a.status === 'suspended' ? 'Konto entsperrt.' : 'Konto gesperrt.'); }}>
                  {a.status === 'suspended' ? 'Entsperren' : 'Sperren'}</Button>
              </div>
            </section>}
            {p.otherCases.length > 0 && <section className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Weitere Vorgänge</p>
              <ul className="space-y-1 text-sm">{p.otherCases.map(o => <li key={o.id}>{o.entry_source === 'website' ? 'Website-Registrierung' : 'Einladung'} vom {shortDate(o.created_at)} · {o.revoked_at ? 'widerrufen' : stateLabels[o.state]}</li>)}</ul>
            </section>}
          </TabsContent>
        </Tabs>
      </div>
    </SheetContent>
  </Sheet>;
}
