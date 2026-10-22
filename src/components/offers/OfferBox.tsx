import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { dayDe, euro, offerApi, overdue, plusWorkdays, type OfferView } from '@/lib/offerApi';

interface Props {
  submissionId: string;
  /** Angebot machen bzw. anpassen (Fenster in der Mitte) */
  onAdjust: () => void;
  /** Absage mit Grund (bestehendes Absage-Fenster) */
  onReject: () => void;
  /** Nach der Zusage: Arbeitsvertrag schicken (Paket 3) */
  onContract?: () => void;
}

/** Kurzfassung eines Angebots: „150.000 € + 20.000 € · Start Fr 01.01.“ */
export function offerSummary(o: OfferView): string {
  return [`${euro(o.salary)}${o.variable ? ` + ${euro(o.variable)}` : ''}`, o.startDate ? `Start ${dayDe(o.startDate)}` : null].filter(Boolean).join(' · ');
}

/**
 * Angebot im Bewerberprofil (Box „Was jetzt“): liegt bei Headhunter, Kandidat überlegt,
 * Gegenwunsch, Zusage, Absage – jeweils mit genau den passenden Schritten.
 */
export function OfferBox({ submissionId, onAdjust, onReject, onContract }: Props) {
  const queryClient = useQueryClient();
  const ctx = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId), staleTime: 15_000 });
  const [busy, setBusy] = useState(false);
  const [keepNote, setKeepNote] = useState<string | null>(null);
  const [newDue, setNewDue] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const o = ctx.data?.currentOffer;
  if (!o || o.status === 'superseded') return null;
  const hh = ctx.data?.recruiterName?.trim() || 'Ihr Headhunter';
  const hhFirst = hh.split(' ')[0];
  const first = (ctx.data?.candidateName ?? '').split(' ')[0] || 'Der Kandidat';
  const late = overdue(o);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      setKeepNote(null); setNewDue(null); setConfirmWithdraw(false);
      queryClient.invalidateQueries({ queryKey: ['offer-context', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const tone = o.status === 'countered' || late ? 'warn' : o.status === 'accepted' ? 'ok' : o.status === 'declined' ? 'crit' : 'info';
  const r = o.response;

  return (
    <div className={cn('mt-3 rounded-lg border p-3 text-sm',
      tone === 'warn' && 'border-amber-500/30 bg-amber-500/[0.06]',
      tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/[0.06]',
      tone === 'crit' && 'border-destructive/30 bg-destructive/[0.05]',
      tone === 'info' && 'border-primary/20 bg-primary/[0.04]')}>
      {(o.status === 'with_recruiter' || o.status === 'considering') && (
        <>
          <p className="font-medium">
            {late ? `Antwortfrist abgelaufen (${dayDe(o.responseDue)})` : o.status === 'considering' ? `${first} überlegt noch${r?.until ? ` bis ${dayDe(r.until)}` : ''}` : `Angebot liegt bei ${hh} · Antwort bis ${dayDe(o.responseDue)}`}
          </p>
          <p className="text-muted-foreground">{offerSummary(o)}{o.version > 1 ? ` · Version ${o.version}` : ''}</p>
          {o.status === 'considering' && r?.note && <p className="mt-1 text-muted-foreground">{hhFirst}: „{r.note}“</p>}
          {r?.client_keep && o.status === 'with_recruiter' && <p className="mt-1 text-muted-foreground">Sie bleiben bei Ihrem Angebot; {hhFirst} spricht noch einmal mit {first}.</p>}
          {newDue !== null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="h-8 w-44" aria-label="Neue Antwortfrist" />
              <Button size="sm" disabled={busy || !newDue} onClick={() => run(() => offerApi.extend(o.id, newDue), `Frist bis ${dayDe(newDue)} verlängert. ${hhFirst} ist informiert.`)}>Speichern</Button>
              <Button size="sm" variant="ghost" onClick={() => setNewDue(null)}>Abbrechen</Button>
            </div>
          ) : confirmWithdraw ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span>Angebot wirklich zurückziehen?</span>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(() => offerApi.withdraw(o.id), `Angebot zurückgezogen. ${hhFirst} ist informiert.`)}>Zurückziehen</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmWithdraw(false)}>Abbrechen</Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {late && <Button size="sm" onClick={() => setNewDue(plusWorkdays(3))}>Frist verlängern</Button>}
              <Button size="sm" variant="outline" onClick={onAdjust}>Ändern</Button>
              {!late && <Button size="sm" variant="ghost" onClick={() => setNewDue(plusWorkdays(3, new Date(`${o.responseDue}T12:00:00`)))}>Frist verlängern</Button>}
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmWithdraw(true)}>Zurückziehen</Button>
            </div>
          )}
        </>
      )}

      {o.status === 'countered' && (
        <>
          <p className="font-medium">
            {first} wünscht {[r?.wish?.salary && `${euro(r.wish.salary)} fix statt ${euro(o.salary)}`, r?.wish?.variable && `${euro(r.wish.variable)} variabel`, r?.wish?.startDate && `Start ${dayDe(r.wish.startDate)}`, r?.wish?.other].filter(Boolean).join(' · ')}
          </p>
          {r?.reason && <p className="mt-0.5 text-muted-foreground">{hhFirst}: „{r.reason}“</p>}
          {keepNote !== null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input value={keepNote} onChange={(e) => setKeepNote(e.target.value)} placeholder={`Kurze Begründung für ${hhFirst} (optional)`} className="h-8 min-w-[16rem] flex-1" aria-label="Begründung" />
              <Button size="sm" disabled={busy} onClick={() => run(() => offerApi.keep(o.id, keepNote), `${hhFirst} ist informiert und spricht noch einmal mit ${first}.`)}>
                {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Senden
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setKeepNote(null)}>Abbrechen</Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={onAdjust}>Angebot anpassen</Button>
              <Button size="sm" variant="outline" onClick={() => setKeepNote('')}>Bei {euro(o.salary)} bleiben</Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onReject}>Absagen</Button>
            </div>
          )}
        </>
      )}

      {o.status === 'accepted' && (
        <>
          <p className="font-medium">{first} hat zugesagt: {offerSummary(o)}</p>
          <p className="mt-0.5 text-muted-foreground">Schicken Sie {first} jetzt den Arbeitsvertrag.{onContract ? ' Die Vertragsdaten stehen bereit.' : ''}</p>
          {onContract && <div className="mt-2"><Button size="sm" onClick={onContract}>Vertrag schicken</Button></div>}
        </>
      )}

      {o.status === 'declined' && (
        <>
          <p className="font-medium">{first} hat abgesagt</p>
          <p className="mt-0.5 text-muted-foreground">{[r?.reason_category && REASONS[r.reason_category], r?.reason].filter(Boolean).join(': ') || 'Ohne Grund.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onAdjust}>Neues Angebot</Button>
            <Button size="sm" variant="ghost" asChild><Link to="/dashboard/candidates">Andere Bewerber ansehen</Link></Button>
          </div>
        </>
      )}

      {o.status === 'withdrawn' && (
        <>
          <p className="font-medium">Angebot zurückgezogen</p>
          <div className="mt-2"><Button size="sm" variant="outline" onClick={onAdjust}>Neues Angebot</Button></div>
        </>
      )}
    </div>
  );
}

const REASONS: Record<string, string> = {
  salary: 'Gehalt', counter_offer: 'Gegenangebot des Arbeitgebers', other_job: 'andere Stelle', personal: 'persönliche Gründe', other: 'anderer Grund',
};
