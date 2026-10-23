import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Circle, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { contractApi, contractDataPdf, dateDe, download, euro, timeDe } from '@/lib/contractApi';
import { ContractDialog } from './ContractDialog';
import { ContractReportDialog } from './ContractReportDialog';

export type ContractOpen = 'contract' | 'digital' | 'melden' | 'werte' | 'verschickt' | 'abgesprungen' | null;

interface Props {
  submissionId: string;
  /** Fenster direkt öffnen (aus Liste, Erinnerungs-Mail ?vertrag=…) */
  openRequest?: ContractOpen;
  onOpenHandled?: () => void;
}

/**
 * Arbeitsvertrag im Bewerberprofil (Kunde, Paket 3): nach der Zusage bis zur
 * verbindlichen Unterschrift, jeweils mit genau den passenden Schritten.
 */
export function ContractBox({ submissionId, openRequest = null, onOpenHandled }: Props) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId), staleTime: 15_000 });
  const [showSend, setShowSend] = useState<null | 'digital' | 'self' | 'any'>(null);
  const [showReport, setShowReport] = useState<null | 'report' | 'values'>(null);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!openRequest || !q.data) return;
    if (openRequest === 'contract') setShowSend('any');
    if (openRequest === 'digital') setShowSend('digital');
    if (openRequest === 'verschickt') setShowSend('self');
    if (openRequest === 'melden') setShowReport('report');
    if (openRequest === 'werte') setShowReport('values');
    if (openRequest === 'abgesprungen') setDropReason('');
    onOpenHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest, q.data]);

  const ctx = q.data ?? null;
  if (!ctx) return null;
  const c = ctx.contract;
  const first = ctx.candidateName.split(' ')[0];
  const hh = ctx.recruiterName ?? 'Ihr Headhunter';
  const hhFirst = hh.split(' ')[0];

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      setDropReason(null);
      queryClient.invalidateQueries({ queryKey: ['contract', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  const openPdf = async () => {
    try { const { url } = await contractApi.document(submissionId); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das PDF ist gerade nicht abrufbar.'); }
  };
  const dataPdf = async () => download(await contractDataPdf(ctx), `Vertragsdaten_${ctx.candidateName.replace(/\s+/g, '_')}.pdf`);
  const values = (v: { salary: number | null; variable: number | null; startDate: string | null }) =>
    [v.salary ? `${euro(v.salary)}${v.variable ? ` + ${euro(v.variable)}` : ''}` : null, v.startDate ? `Start ${dateDe(v.startDate)}` : null].filter(Boolean).join(' · ');

  const status = c?.status ?? 'preparing';
  const notSent = status === 'preparing' && !c?.sentAt;
  const tone = status === 'final' || status === 'signed' ? 'ok' : status === 'reported' || status === 'declined' ? 'warn' : status === 'dropped' ? 'muted' : 'info';

  const dropRow = dropReason !== null ? (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder={`Warum ist ${first} abgesprungen?`} className="h-8 min-w-[16rem] flex-1" aria-label="Grund" />
      <Button size="sm" variant="destructive" disabled={busy || !dropReason.trim()} onClick={() => run(() => contractApi.drop(submissionId, dropReason.trim()), `Gespeichert. ${hhFirst} ist informiert.`)}>Abgesprungen melden</Button>
      <Button size="sm" variant="ghost" onClick={() => setDropReason(null)}>Abbrechen</Button>
    </div>
  ) : null;
  const dropButton = <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDropReason('')}>{first} ist abgesprungen</Button>;

  const step = (done: boolean, label: string, when?: string | null) => (
    <li className="flex items-center gap-2">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className={cn(!done && 'text-muted-foreground')}>{label}</span>
      {when && <span className="text-xs text-muted-foreground">{when}</span>}
    </li>
  );

  return (
    <div className={cn('mt-3 rounded-lg border p-3 text-sm',
      tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/[0.06]',
      tone === 'warn' && 'border-amber-500/30 bg-amber-500/[0.06]',
      tone === 'info' && 'border-primary/20 bg-primary/[0.04]',
      tone === 'muted' && 'border-border bg-muted/30')}>

      {notSent && c?.way !== 'digital' && (
        <>
          <p className="font-medium">{first} hat zugesagt{ctx.offer ? `: ${values({ salary: ctx.offer.salary, variable: ctx.offer.variable, startDate: ctx.offer.startDate })}` : ''}</p>
          <p className="mt-0.5 text-muted-foreground">Schicken Sie {first} jetzt den Arbeitsvertrag. Sobald er unterschrieben ist, melden Sie es hier.</p>
          {dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowSend('any')}>Vertrag schicken</Button>
              <Button size="sm" variant="outline" onClick={() => setShowReport('report')}>Unterschrieben melden</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {notSent && c?.way === 'digital' && (
        <>
          <p className="font-medium">Digitaler Vertrag zurückgezogen</p>
          <p className="mt-0.5 text-muted-foreground">Laden Sie den Vertrag neu hoch oder schicken Sie ihn selbst.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowSend('digital')}>Neu senden</Button>
            <Button size="sm" variant="outline" onClick={() => setShowSend('self')}>Selbst verschicken</Button>
          </div>
        </>
      )}

      {status === 'sent_self' && (
        <>
          <p className="font-medium">Vertrag am {dateDe(c!.sentAt)} an {first} verschickt <span className="font-normal text-muted-foreground">(Ihre Angabe)</span></p>
          <p className="mt-0.5 text-muted-foreground">{hhFirst} weiß Bescheid und hakt bei {first} nach.</p>
          {dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowReport('report')}>Unterschrift melden</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={dataPdf}><FileDown className="h-3.5 w-3.5" />Vertragsdaten (PDF)</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {(status === 'sent_digital' || status === 'company_signed') && (
        <>
          <p className="font-medium">Stand der Unterschriften</p>
          <ul className="mt-1 space-y-1">
            {step(true, 'Versendet über DocuSign', timeDe(c!.sentAt))}
            {step(!!c!.companySignedAt, c!.companySignedAt ? `${c!.companySignerName ?? 'Die Firma'} hat unterschrieben` : `${c!.companySignerName ?? 'Die Firma'} unterschreibt zuerst`, timeDe(c!.companySignedAt))}
            {step(false, c!.companySignedAt ? `${first}: noch nicht unterschrieben. ${hhFirst} stößt ${first} an.` : `Danach unterschreibt ${first}`)}
          </ul>
          {dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.refresh(submissionId), 'Stand aktualisiert.')}>Stand aktualisieren</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.voidDigital(submissionId, false), 'Zurückgezogen. Sie können den Vertrag neu senden.')}>Zurückziehen und neu senden</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.voidDigital(submissionId, true), 'Zurückgezogen. Schicken Sie den Vertrag selbst.')}>Doch selbst verschicken</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {status === 'reported' && (
        <>
          <p className="font-medium">{c!.reportedRole === 'admin' ? 'Matchunt' : (ctx.reporterName ?? hh)} meldet: {first} hat am {dateDe(c!.signedOn)} unterschrieben</p>
          <p className="mt-0.5 text-muted-foreground">{values(c!)}{c!.reportNote ? ` · „${c!.reportNote}“` : ''}. Stimmt das?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => contractApi.confirm(submissionId, 'yes'), 'Bestätigt. Die Einstellung ist verbindlich.')}>Ja, stimmt</Button>
            <Button size="sm" variant="outline" onClick={() => setShowReport('values')}>Stimmt, aber andere Werte</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.confirm(submissionId, 'not_yet'), `${hhFirst} ist informiert.`)}>Noch nicht unterschrieben</Button>
          </div>
        </>
      )}

      {status === 'signed' && (
        <>
          <p className="font-medium">Unterschrift gemeldet: am {dateDe(c!.signedOn)} · {values(c!)}</p>
          <p className="mt-0.5 text-muted-foreground">Bis {timeDe(c!.undoUntil)} können Sie die Meldung zurücknehmen. Danach ist die Einstellung verbindlich. {hhFirst} bestätigt parallel bei {first}.</p>
          <div className="mt-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.undo(submissionId), 'Zurückgenommen.')}>Rückgängig machen</Button></div>
        </>
      )}

      {status === 'final' && (
        <>
          <p className="font-medium">Arbeitsvertrag unterschrieben am {dateDe(c!.signedOn)}</p>
          <p className="mt-0.5 text-muted-foreground">
            {values(c!)}{c!.way === 'digital' ? ' · über DocuSign' : ''}
            {c!.recruiterCheck === 'ok' ? ` · ${hhFirst} hat es bei ${first} bestätigt` : ''}
          </p>
          {c!.hasSignedDocument && <div className="mt-2"><Button size="sm" variant="outline" className="gap-1" onClick={openPdf}><FileDown className="h-3.5 w-3.5" />Vertrag (PDF)</Button></div>}
        </>
      )}

      {status === 'declined' && (
        <>
          <p className="font-medium">Der Vertrag wurde in DocuSign abgelehnt</p>
          <p className="mt-0.5 text-muted-foreground">{c!.declineReason ? `„${c!.declineReason}“` : 'Ohne Grund.'} {hhFirst} ist informiert.</p>
          {dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowSend('digital')}>Vertrag anpassen und neu senden</Button>
              <Button size="sm" variant="outline" onClick={() => setShowSend('self')}>Selbst verschicken</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {status === 'dropped' && (
        <>
          <p className="font-medium">{first} ist abgesprungen</p>
          <p className="mt-0.5 text-muted-foreground">{c!.dropReason ? `„${c!.dropReason}“` : ''}</p>
          <div className="mt-2"><Button size="sm" variant="ghost" asChild><Link to="/dashboard/candidates">Andere Bewerber ansehen</Link></Button></div>
        </>
      )}

      {busy && <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />}

      <ContractDialog ctx={ctx} open={showSend !== null} onOpenChange={(o) => { if (!o) setShowSend(null); }} initialWay={showSend === 'any' ? null : showSend} />
      <ContractReportDialog ctx={ctx} open={showReport !== null} mode={showReport ?? 'report'} onOpenChange={(o) => { if (!o) setShowReport(null); }} />
    </div>
  );
}
