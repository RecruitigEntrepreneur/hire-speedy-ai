import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ContractReportDialog } from '@/components/contracts/ContractReportDialog';
import { contractApi, dateDe, euro, timeDe, type AdminCase } from '@/lib/contractApi';

const STAND: Record<string, string> = {
  preparing: 'Vertrag in Arbeit', sent_self: 'selbst verschickt', sent_digital: 'digital verschickt', company_signed: 'Firma unterschrieben, Kandidat offen',
  reported: 'gemeldet, Kunde bestätigt nicht', signed: 'Kunde hat gemeldet (24 h)', final: 'verbindlich', declined: 'in DocuSign abgelehnt',
};
const EVENT: Record<string, string> = {
  sent_self: 'Kunde: selbst verschickt', way_self: 'Kunde schickt selbst', sent_digital: 'digital verschickt', company_signed: 'Firma hat unterschrieben',
  signed_digital: 'beide haben unterschrieben (DocuSign)', declined: 'in DocuSign abgelehnt', voided: 'Umschlag zurückgezogen', reported: 'Unterschrift gemeldet',
  reported_with_evidence: 'mit Beleg bestätigt', confirmed: 'Kunde hat bestätigt', confirmed_other_values: 'Kunde hat mit anderen Werten bestätigt',
  report_rejected: 'Kunde: noch nicht unterschrieben', undone: 'Kunde hat zurückgenommen', check_ok: 'Gegenprobe: stimmt', check_differs: 'Gegenprobe: weicht ab',
  dropped: 'abgesprungen', reminder_client: 'Erinnerung an den Kunden (Tag 7)', reminder_recruiter: 'Aufgabe an den Headhunter (Tag 10)', admin_case: 'Fall für Matchunt (Tag 21)', final: 'verbindlich',
};
const days = (iso: string | null) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : null);

/** Admin › Unterschriften klären (Paket 3): hängende Verträge, Abweichungen, Fälle ab Tag 21. */
export default function AdminVertraege() {
  const q = useQuery({ queryKey: ['admin-contract-cases'], queryFn: () => contractApi.adminCases() });
  const [open, setOpen] = useState<AdminCase | null>(null);
  const cases = q.data?.cases ?? [];
  const needs = (c: AdminCase) => c.adminCaseAt || c.contract.recruiterCheck === 'differs' || (c.contract.status === 'reported' && (days(c.contract.reportedAt) ?? 0) >= 5) || c.contract.status === 'declined';

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Unterschriften klären</h1>
          <p className="text-sm text-muted-foreground">Verträge nach der Zusage: was hängt, was abweicht, was Matchunt klären muss.</p>
        </div>
        {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : cases.length === 0 ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">Nichts offen.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {cases.map((c) => (
              <div key={c.contract.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.candidateName} · {c.companyName}</p>
                  <p className="text-xs text-muted-foreground">{c.jobTitle} · Headhunter {c.recruiterName ?? '–'}{c.acceptedAt ? ` · Zusage vor ${days(c.acceptedAt)} Tagen` : ''}</p>
                </div>
                <span className="text-muted-foreground">{STAND[c.contract.status] ?? c.contract.status}</span>
                {c.contract.recruiterCheck === 'differs' && <Badge variant="destructive">Gegenprobe weicht ab</Badge>}
                {c.adminCaseAt && <Badge variant="secondary">Tag 21</Badge>}
                <Button size="sm" variant={needs(c) ? 'default' : 'outline'} onClick={() => setOpen(c)}>{needs(c) ? 'Klären' : 'Ansehen'}</Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <CaseDialog item={open} onClose={() => setOpen(null)} />
    </DashboardLayout>
  );
}

function CaseDialog({ item, onClose }: { item: AdminCase | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['contract', item?.submissionId], queryFn: () => contractApi.context(item!.submissionId), enabled: !!item });
  const [report, setReport] = useState(false);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctx = q.data ?? null;
  const c = ctx?.contract ?? null;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-contract-cases'] });
    queryClient.invalidateQueries({ queryKey: ['contract', item?.submissionId] });
  };
  const drop = async () => {
    if (!item || !dropReason?.trim()) return;
    setBusy(true);
    try { await contractApi.drop(item.submissionId, dropReason.trim()); toast.success('Als abgesprungen geschlossen.'); refresh(); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.'); }
    finally { setBusy(false); }
  };
  const canReport = !!c && ['preparing', 'sent_self', 'reported', 'declined'].includes(c.status);

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) { setDropReason(null); onClose(); } }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle>Unterschrift klären · {item?.candidateName}</DialogTitle>
          <DialogDescription>{item?.companyName} · {item?.jobTitle} · Headhunter {item?.recruiterName ?? '–'}</DialogDescription>
        </DialogHeader>
        {!ctx ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="font-medium">Stand: {STAND[c?.status ?? ''] ?? c?.status}</p>
              {c?.signedOn && <p className="text-muted-foreground">Unterschrieben am {dateDe(c.signedOn)} · {euro(c.salary)}{c.variable ? ` + ${euro(c.variable)}` : ''} · Start {dateDe(c.startDate)}</p>}
              {c?.recruiterCheck === 'differs' && <p className="mt-1 text-destructive">Gegenprobe weicht ab: {c.recruiterCheckNote}</p>}
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {ctx.offer?.acceptedAt && <li>{timeDe(ctx.offer.acceptedAt)} · Zusage eingetragen</li>}
                {ctx.events.map((e, i) => <li key={i}>{timeDe(e.at)} · {EVENT[e.type] ?? e.type}{e.details?.reason ? `: ${String(e.details.reason)}` : ''}{e.details?.note ? `: ${String(e.details.note)}` : ''}</li>)}
              </ul>
            </div>
            {dropReason !== null && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder="Grund" className="h-8 min-w-[16rem] flex-1" aria-label="Grund" />
                <Button size="sm" variant="destructive" disabled={busy || !dropReason.trim()} onClick={drop}>Schließen</Button>
                <Button size="sm" variant="ghost" onClick={() => setDropReason(null)}>Abbrechen</Button>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              {c && ['preparing', 'sent_self', 'sent_digital', 'company_signed', 'declined'].includes(c.status) && dropReason === null && <Button size="sm" variant="ghost" onClick={() => setDropReason('')}>Als abgesprungen schließen</Button>}
              {canReport && <Button size="sm" onClick={() => setReport(true)}>Unterschrift melden</Button>}
              {!canReport && <Button size="sm" variant="ghost" onClick={onClose}>Schließen</Button>}
            </div>
            <p className="text-xs text-muted-foreground">Melden mit Beleg ist sofort verbindlich; ohne Beleg bestätigt der Kunde. Die Notiz sehen Kunde und Headhunter nicht.</p>
            <ContractReportDialog ctx={ctx} open={report} onOpenChange={setReport} onDone={() => { refresh(); onClose(); }} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
