import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { contractApi, dateDe, euro, linkLine, timeDe } from '@/lib/contractApi';

/**
 * Arbeitsvertrag im Bewerberprofil (24.10.2026, „Profil: nachsehen“): der Stand als ruhige
 * Zeitleiste. Gehandelt wird im Aufgaben-Fenster (Karte oben oder „Öffnen“ in der laufenden Zeile).
 */
export function ContractTimeline({ submissionId, onOpen }: { submissionId: string; onOpen: () => void }) {
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId), staleTime: 15_000 });
  const ctx = q.data ?? null;
  if (!ctx) return null;
  const c = ctx.contract;
  const o = ctx.offer;
  const sig = ctx.signing ?? null;
  const first = ctx.candidateName.split(' ')[0];
  const status = c?.status ?? 'preparing';
  const values = (v: { salary: number | null; variable: number | null; startDate: string | null }) =>
    [v.salary ? `${euro(v.salary)}${v.variable ? ` + ${euro(v.variable)}` : ''}` : null, v.startDate ? `Start ${dateDe(v.startDate)}` : null].filter(Boolean).join(' · ');
  const openLink = <button type="button" className="ml-1 text-primary underline underline-offset-2" onClick={onOpen}>Öffnen</button>;
  const openPdf = async () => {
    try { const { url } = await contractApi.document(submissionId); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das PDF ist gerade nicht abrufbar.'); }
  };

  type Row = { state: 'done' | 'now' | 'next' | 'bad'; text: React.ReactNode; when?: string | null };
  const rows: Row[] = [];
  if (o) rows.push({ state: 'done', text: `${first} hat zugesagt · ${values({ salary: o.salary, variable: o.variable, startDate: o.startDate })}`, when: o.acceptedAt ? dateDe(o.acceptedAt) : null });
  const digital = c?.way === 'digital' && ['sent_digital', 'company_signed', 'final'].includes(status);
  if (status === 'preparing' && !c?.sentAt) {
    rows.push({ state: 'now', text: <>Vertrag noch nicht verschickt{openLink}</> });
    rows.push({ state: 'next', text: 'Unterschriften · verbindlich' });
  } else if (status === 'sent_self') {
    rows.push({ state: 'done', text: 'Vertrag selbst verschickt (Ihre Angabe)', when: dateDe(c!.sentAt) });
    rows.push({ state: 'now', text: <>Unterschrift von {first} melden, sobald sie da ist{openLink}</> });
  } else if (digital) {
    rows.push({ state: 'done', text: sig?.mode === 'embedded' ? 'Vertrag hochgeladen' : 'Versendet über DocuSign', when: timeDe(c!.sentAt) });
    if (c!.companySignedAt) rows.push({ state: 'done', text: sig?.youSign ? 'Sie haben unterschrieben' : `${c!.companySignerName ?? 'Die Firma'} hat unterschrieben`, when: timeDe(c!.companySignedAt) });
    else rows.push({ state: 'now', text: <>{sig?.youSign ? 'Ihre Unterschrift' : `${c!.companySignerName ?? 'Die Firma'} unterschreibt`}{sig?.mode === 'embedded' && !sig.companyViaApp && sig.company ? <span className="text-muted-foreground"> · {linkLine(sig.company, sig.companyEmail)}</span> : null}{openLink}</> });
    if (status === 'final') rows.push({ state: 'done', text: `${first} hat unterschrieben`, when: timeDe(c!.candidateSignedAt) });
    else if (c!.companySignedAt) rows.push({ state: 'now', text: <>{first} unterschreibt{sig?.mode === 'embedded' && sig.candidate ? <span className="text-muted-foreground"> · {linkLine(sig.candidate, sig.candidateEmail)}</span> : null}{openLink}</> });
    else rows.push({ state: 'next', text: `danach ${first}` });
  } else if (status === 'reported') {
    rows.push({ state: 'now', text: <>{c!.reportedRole === 'admin' ? 'Matchunt' : (ctx.reporterName ?? ctx.recruiterName ?? 'Ihr Headhunter')} meldet die Unterschrift vom {dateDe(c!.signedOn)}, bitte bestätigen{openLink}</> });
  } else if (status === 'signed') {
    rows.push({ state: 'done', text: `Unterschrift gemeldet · ${values(c!)}`, when: dateDe(c!.signedOn) });
    rows.push({ state: 'now', text: <>bis {timeDe(c!.undoUntil)} rücknehmbar, dann verbindlich{openLink}</> });
  } else if (status === 'declined') {
    rows.push({ state: 'bad', text: <>In DocuSign abgelehnt{c!.declineReason ? `: „${c!.declineReason}“` : ''}{openLink}</> });
  } else if (status === 'dropped') {
    rows.push({ state: 'bad', text: `${first} ist abgesprungen${c!.dropReason ? `: „${c!.dropReason}“` : ''}` });
  }
  if (status === 'final') rows.push({ state: 'done', text: `Verbindlich · unterschrieben am ${dateDe(c!.signedOn)}${c!.way === 'digital' ? ' über DocuSign' : ''}` });

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-card p-3 text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Arbeitsvertrag</p>
        {status === 'final' && c?.hasSignedDocument && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={openPdf}><FileDown className="h-3.5 w-3.5" />Vertrag (PDF)</Button>}
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
