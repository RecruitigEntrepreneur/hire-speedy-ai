import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Circle, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { contractApi, contractDataPdf, dateDe, download, euro, linkLine, timeDe } from '@/lib/contractApi';
import { ContractDialog } from './ContractDialog';
import { ContractReportDialog } from './ContractReportDialog';

export type ContractOpen = 'contract' | 'digital' | 'melden' | 'werte' | 'verschickt' | 'abgesprungen' | 'unterschreiben' | 'unterzeichner' | null;

interface Props {
  submissionId: string;
  /** Fenster direkt öffnen (aus Liste, Erinnerungs-Mail ?vertrag=…) */
  openRequest?: ContractOpen;
  onOpenHandled?: () => void;
  /** Rücksprung aus der eigenen Unterschrift bei DocuSign (?vertrag=zurueck&event=…) */
  returnEvent?: string | null;
  onReturnHandled?: () => void;
  /** Im Aufgaben-Fenster: Bestätigung nach dem Rücksprung ist da (Fenster zeigt „Erledigt“) */
  onSignedBack?: (at: string | null) => void;
  /** Aus der Aufgabe „Ist er unterschrieben?“: zusätzlich „Noch nicht“ (fragt in einer Woche wieder) */
  onNotYet?: () => void;
}

/** Nach dem Rücksprung so lange nachfragen (DocuSign erlaubt eine Abfrage erst nach 20 s) */
const RETURN_CHECKS_MS = [0, 21_000, 60_000, 120_000];

/**
 * Arbeitsvertrag im Bewerberprofil (Kunde, Paket 3): nach der Zusage bis zur
 * verbindlichen Unterschrift, jeweils mit genau den passenden Schritten.
 */
export function ContractBox({ submissionId, openRequest = null, onOpenHandled, returnEvent = null, onReturnHandled, onSignedBack, onNotYet }: Props) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId), staleTime: 15_000 });
  const [showSend, setShowSend] = useState<null | 'digital' | 'self' | 'any'>(null);
  const [showReport, setShowReport] = useState<null | 'report' | 'values'>(null);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Unterzeichner ändern: null = zu, sonst Eingabe
  const [signer, setSigner] = useState<null | { self: boolean; name: string; email: string }>(null);
  // Rücksprung aus DocuSign: checking → signed | late | left
  const [back, setBack] = useState<null | { state: 'checking' | 'signed' | 'late' | 'left'; at?: string | null }>(null);
  const timers = useRef<number[]>([]);

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['contract', submissionId] });
    queryClient.invalidateQueries({ queryKey: ['submission-state'] });
    queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
  };

  /** „Jetzt unterschreiben“: weiter zu DocuSign im selben Fenster */
  const signNow = async () => {
    setBusy(true);
    try {
      const { url } = await contractApi.signUrl(submissionId);
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Unterschrift lässt sich gerade nicht starten.');
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!openRequest || !q.data) return;
    if (openRequest === 'contract') setShowSend('any');
    if (openRequest === 'digital') setShowSend('digital');
    if (openRequest === 'verschickt') setShowSend('self');
    if (openRequest === 'melden') setShowReport('report');
    if (openRequest === 'werte') setShowReport('values');
    if (openRequest === 'abgesprungen') setDropReason('');
    if (openRequest === 'unterschreiben') void signNow();
    if (openRequest === 'unterzeichner') setSigner({ self: false, name: '', email: '' });
    onOpenHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest, q.data]);

  // Zurück von DocuSign: Bestätigung holen, wie beim Headhunter-Vertrag (0 / 21 / 60 / 120 s)
  useEffect(() => {
    if (!returnEvent) return;
    onReturnHandled?.();
    if (returnEvent !== 'signing_complete') {
      setBack({ state: 'left' });
      if (returnEvent === 'decline') void contractApi.refresh(submissionId, true).then(refetchAll).catch(() => undefined);
      return;
    }
    setBack({ state: 'checking' });
    let done = false;
    RETURN_CHECKS_MS.forEach((ms, i) => {
      timers.current.push(window.setTimeout(async () => {
        if (done) return;
        try {
          const r = await contractApi.refresh(submissionId, true);
          if (r.contract?.companySignedAt || !['sent_digital'].includes(r.contract?.status ?? '')) {
            done = true;
            setBack({ state: 'signed', at: r.contract?.companySignedAt ?? null });
            refetchAll();
            onSignedBack?.(r.contract?.companySignedAt ?? null);
          } else if (i === RETURN_CHECKS_MS.length - 1) {
            setBack({ state: 'late' });
          }
        } catch {
          if (i === RETURN_CHECKS_MS.length - 1) setBack({ state: 'late' });
        }
      }, ms));
    });
    // Kein Aufräumen hier: das Profil setzt returnEvent gleich zurück, die Nachfragen laufen weiter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnEvent]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; }, []);

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
      refetchAll();
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

  const sig = ctx.signing ?? null;
  const embedded = sig?.mode === 'embedded' || c?.signingMode === 'embedded';
  const signerLabel = sig?.youSign ? 'Sie' : (c?.companySignerName ?? 'Die Firma');
  const changeSigner = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const r = await contractApi.changeSigner(submissionId, signer.self ? { signerSelf: true } : { signerName: signer.name.trim(), signerEmail: signer.email.trim() });
      refetchAll();
      if (r.signUrl) { toast.success('Neu angelegt. Sie werden zur Unterschrift weitergeleitet …'); window.location.assign(r.signUrl); return; }
      toast.success(`Neu angelegt. ${signer.name.trim()} bekommt jetzt eine Mail mit Link.`);
      setSigner(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  const signerRow = signer ? (
    <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-background/60 p-2">
      <div className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" onClick={() => setSigner({ ...signer, self: v })}
            className={cn('rounded px-3 py-1 text-xs', signer.self === v ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}>{v ? 'Ich selbst' : 'Jemand anderes'}</button>
        ))}
      </div>
      {!signer.self && (
        <div className="flex flex-wrap gap-2">
          <Input value={signer.name} onChange={(e) => setSigner({ ...signer, name: e.target.value })} placeholder="Name" className="h-8 min-w-[10rem] flex-1" aria-label="Name" />
          <Input value={signer.email} onChange={(e) => setSigner({ ...signer, email: e.target.value })} placeholder="Mail" className="h-8 min-w-[12rem] flex-1" aria-label="Mail" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{signer.self ? 'Sie unterschreiben gleich danach hier in Matchunt.' : 'Bekommt eine Mail von Matchunt mit persönlichem Link.'} Der Vertrag bleibt derselbe, der alte Umschlag wird zurückgezogen.</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || (!signer.self && (!signer.name.trim() || !/\S+@\S+\.\S+/.test(signer.email)))} onClick={changeSigner}>{signer.self ? 'Ändern und jetzt unterschreiben' : 'Ändern und Link senden'}</Button>
        <Button size="sm" variant="ghost" onClick={() => setSigner(null)}>Abbrechen</Button>
      </div>
    </div>
  ) : null;

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

      {back?.state === 'signed' && status === 'company_signed' && (
        <p className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-2.5 py-1.5 text-emerald-800 dark:text-emerald-300">Unterschrieben{back.at ? `, ${timeDe(back.at)}` : ''}. {first} bekommt jetzt eine Mail mit Link.</p>
      )}

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
              {onNotYet && <Button size="sm" variant="outline" onClick={onNotYet}>Noch nicht unterschrieben</Button>}
              <Button size="sm" variant="outline" className="gap-1" onClick={dataPdf}><FileDown className="h-3.5 w-3.5" />Vertragsdaten (PDF)</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {(status === 'sent_digital' || status === 'company_signed') && embedded && (
        <>
          <p className="font-medium">Stand der Unterschriften</p>
          {back?.state === 'checking' && <p className="mt-1 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Wir holen die Bestätigung bei DocuSign …</p>}
          {back?.state === 'late' && <p className="mt-1 text-amber-700 dark:text-amber-400">DocuSign hat Ihre Unterschrift noch nicht gemeldet. Das kann ein paar Minuten dauern; „Stand aktualisieren“ fragt erneut.</p>}
          {back?.state === 'left' && !c!.companySignedAt && <p className="mt-1 text-amber-700 dark:text-amber-400">Sie haben DocuSign ohne Unterschrift verlassen.</p>}
          <ul className="mt-1 space-y-1">
            {step(true, 'Vertrag hochgeladen', timeDe(c!.sentAt))}
            {c!.companySignedAt
              ? step(true, sig?.youSign ? 'Sie haben in Matchunt unterschrieben' : `${signerLabel} hat ${sig?.companyViaApp ? 'in Matchunt ' : ''}unterschrieben`, timeDe(c!.companySignedAt))
              : step(false, sig?.youSign ? 'Ihre Unterschrift' : `${signerLabel} unterschreibt zuerst`, sig?.companyViaApp ? 'in Matchunt' : linkLine(sig?.company, sig?.companyEmail))}
            {c!.companySignedAt
              ? step(false, `${first} unterschreibt`, linkLine(sig?.candidate, sig?.candidateEmail))
              : step(false, `Danach ${first}`, 'bekommt dann einen Link per Mail')}
          </ul>
          {signerRow ?? dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              {status === 'sent_digital' && sig?.youSign && back?.state !== 'checking' && <Button size="sm" disabled={busy} onClick={signNow}>{back?.state === 'left' ? 'Weiter unterschreiben' : 'Jetzt unterschreiben'}</Button>}
              {status === 'sent_digital' && !sig?.companyViaApp && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.resendLink(submissionId), `Neuer Link an ${c!.companySignerName ?? 'den Unterzeichner'} ist unterwegs; der alte gilt nicht mehr.`)}>Link erneut senden</Button>}
              {status === 'company_signed' && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.resendLink(submissionId), `Neuer Link an ${first} ist unterwegs; der alte gilt nicht mehr.`)}>Link an {first} erneut senden</Button>}
              {status === 'sent_digital' && <Button size="sm" variant="ghost" onClick={() => setSigner({ self: !sig?.youSign, name: '', email: '' })}>Unterzeichner ändern</Button>}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.refresh(submissionId), 'Stand aktualisiert.')}>Stand aktualisieren</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.voidDigital(submissionId, true), 'Zurückgezogen. Schicken Sie den Vertrag selbst.')}>Doch selbst verschicken</Button>
              {dropButton}
            </div>
          )}
          {ctx.digitalDemo && <p className="mt-2 text-xs text-muted-foreground">Testbetrieb: Unterschriften sind noch nicht rechtsverbindlich.</p>}
        </>
      )}

      {(status === 'sent_digital' || status === 'company_signed') && !embedded && (
        <>
          <p className="font-medium">Stand der Unterschriften</p>
          <ul className="mt-1 space-y-1">
            {step(true, 'Versendet über DocuSign', timeDe(c!.sentAt))}
            {step(!!c!.companySignedAt, c!.companySignedAt ? `${c!.companySignerName ?? 'Die Firma'} hat unterschrieben` : `${c!.companySignerName ?? 'Die Firma'} unterschreibt zuerst`, timeDe(c!.companySignedAt))}
            {step(false, c!.companySignedAt ? `${first}: noch nicht unterschrieben. ${hhFirst} stößt ${first} an.` : `Danach unterschreibt ${first}`)}
          </ul>
          {!c!.companySignedAt && <p className="mt-1 text-xs text-muted-foreground">Keine DocuSign-Mail angekommen? „Unterzeichner ändern“ stellt auf die Unterschrift über Matchunt um, ohne neues Hochladen.</p>}
          {signerRow ?? dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.refresh(submissionId), 'Stand aktualisiert.')}>Stand aktualisieren</Button>
              {status === 'sent_digital' && <Button size="sm" variant="outline" onClick={() => setSigner({ self: true, name: '', email: '' })}>Unterzeichner ändern</Button>}
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
