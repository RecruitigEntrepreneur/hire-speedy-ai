import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { contractApi, dateDe, euro, linkLine, timeDe } from '@/lib/contractApi';
import { useTranslation } from 'react-i18next';

/**
 * Arbeitsvertrag im Bewerberprofil (24.10.2026, „Profil: nachsehen“): der Stand als ruhige
 * Zeitleiste. Gehandelt wird im Aufgaben-Fenster (Karte oben oder „Öffnen“ in der laufenden Zeile).
 */
export function ContractTimeline({ submissionId, onOpen }: { submissionId: string; onOpen: () => void }) {
  const { t: tt } = useTranslation('contracts');
  const t = (key: string, options?: Record<string, unknown>) => tt(`client.timeline.${key}`, options);
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId), staleTime: 15_000 });
  const ctx = q.data ?? null;
  if (!ctx) return null;
  const c = ctx.contract;
  const o = ctx.offer;
  const sig = ctx.signing ?? null;
  const first = ctx.candidateName.split(' ')[0];
  const status = c?.status ?? 'preparing';
  const values = (v: { salary: number | null; variable: number | null; startDate: string | null }) =>
    [v.salary ? (v.variable ? tt('client.valuesVariable', { salary: euro(v.salary), variable: euro(v.variable) }) : euro(v.salary)) : null, v.startDate ? tt('client.valuesStart', { date: dateDe(v.startDate) }) : null].filter(Boolean).join(' · ');
  const openLink = <button type="button" className="ml-1 text-primary underline underline-offset-2" onClick={onOpen}>{t('open')}</button>;
  const openPdf = async () => {
    try { const { url } = await contractApi.document(submissionId); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : tt('client.box.pdfUnavailable')); }
  };

  type Row = { state: 'done' | 'now' | 'next' | 'bad'; text: React.ReactNode; when?: string | null };
  const rows: Row[] = [];
  if (o) rows.push({ state: 'done', text: t('accepted', { first, values: values({ salary: o.salary, variable: o.variable, startDate: o.startDate }) }), when: o.acceptedAt ? dateDe(o.acceptedAt) : null });
  const digital = c?.way === 'digital' && ['sent_digital', 'company_signed', 'final'].includes(status);
  if (status === 'preparing' && !c?.sentAt) {
    rows.push({ state: 'now', text: <>{t('notSent')}{openLink}</> });
    rows.push({ state: 'next', text: t('signaturesBinding') });
  } else if (status === 'sent_self') {
    rows.push({ state: 'done', text: t('sentSelf'), when: dateDe(c!.sentAt) });
    // Antwort des Kandidaten (29.10.2026)
    if (c!.candidateStatus === 'missing') rows.push({ state: 'bad', text: <>{t('missing', { first })}{openLink}</>, when: dateDe(c!.candidateStatusAt) });
    else {
      if (c!.candidateStatus === 'arrived') rows.push({ state: 'done', text: t('arrived', { first }), when: dateDe(c!.candidateStatusAt) });
      rows.push({ state: 'now', text: <>{t('reportWhen', { first })}{openLink}</> });
    }
  } else if (digital) {
    rows.push({ state: 'done', text: sig?.mode === 'embedded' ? t('uploaded') : t('sentDocuSign'), when: timeDe(c!.sentAt) });
    if (c!.companySignedAt) rows.push({ state: 'done', text: sig?.youSign ? t('youSigned') : t('signerSigned', { signer: c!.companySignerName ?? tt('client.theCompany') }), when: timeDe(c!.companySignedAt) });
    else rows.push({ state: 'now', text: <>{sig?.youSign ? t('yourSignature') : t('signerSigns', { signer: c!.companySignerName ?? tt('client.theCompany') })}{sig?.mode === 'embedded' && !sig.companyViaApp && sig.company ? <span className="text-muted-foreground"> · {linkLine(sig.company, sig.companyEmail)}</span> : null}{openLink}</> });
    if (status === 'final') rows.push({ state: 'done', text: t('candidateSigned', { first }), when: timeDe(c!.candidateSignedAt) });
    else if (c!.companySignedAt) rows.push({ state: 'now', text: <>{t('candidateSigns', { first })}{sig?.mode === 'embedded' && sig.candidate ? <span className="text-muted-foreground"> · {linkLine(sig.candidate, sig.candidateEmail)}</span> : null}{openLink}</> });
    else rows.push({ state: 'next', text: t('thenCandidate', { first }) });
  } else if (status === 'reported') {
    rows.push({ state: 'now', text: c!.reportedRole === 'candidate'
      ? <>{t('candidateReports', { first, date: dateDe(c!.signedOn) })}{openLink}</>
      : <>{t('someoneReports', { who: c!.reportedRole === 'admin' ? 'Matchunt' : (ctx.reporterName ?? ctx.recruiterName ?? tt('client.yourRecruiter')), date: dateDe(c!.signedOn) })}{openLink}</> });
  } else if (status === 'signed') {
    rows.push({ state: 'done', text: t('reportedSignature', { values: values(c!) }), when: dateDe(c!.signedOn) });
    rows.push({ state: 'now', text: <>{t('undoUntil', { when: timeDe(c!.undoUntil) })}{openLink}</> });
  } else if (status === 'declined') {
    rows.push({ state: 'bad', text: <>{c!.declineReason ? t('declinedReason', { reason: c!.declineReason }) : t('declined')}{openLink}</> });
  } else if (status === 'dropped') {
    rows.push({ state: 'bad', text: c!.dropReason ? t('droppedReason', { first, reason: c!.dropReason }) : t('dropped', { first }) });
  }
  if (status === 'final') rows.push({ state: 'done', text: t(c!.way === 'digital' ? 'finalDigital' : 'final', { date: dateDe(c!.signedOn) }) });

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-card p-3 text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('title')}</p>
        {status === 'final' && c?.hasSignedDocument && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={openPdf}><FileDown className="h-3.5 w-3.5" />{tt('client.box.contractPdf')}</Button>}
      </div>
      <ol className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.state === 'done' ? 'bg-emerald-500' : r.state === 'now' ? 'bg-amber-500' : r.state === 'bad' ? 'bg-destructive' : 'bg-muted-foreground/30')} />
            <span className={cn('min-w-0 flex-1', r.state === 'next' && 'text-muted-foreground')}>{r.text}</span>
            {r.when && <span className="shrink-0 text-xs text-muted-foreground">{r.when}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
