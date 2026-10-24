import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper, MessageSquareReply, UserX, FileCheck2, Sunrise, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { taskHref, useClientTasks, type ClientNewsItem } from '@/lib/clientTasksApi';
import { ContractTaskWindow } from '@/components/contracts/ContractTaskWindow';
import { OfferTaskWindow } from '@/components/offers/OfferTaskWindow';

/**
 * Leiste „Neuigkeit“ unter der Begrüßung (24.10.2026, „Dashboard: melden“): nur Meilensteine
 * (Zusage, Gegenwunsch, Absage, Vertrag unterschrieben, erster Arbeitstag). Die wichtigste groß,
 * eine weitere als Zeile. Mit Aufgabe bleibt sie bis zur Erledigung, sonst drei Tage.
 * „Vertrag schicken“ öffnet das Aufgaben-Fenster direkt hier.
 */

const LOOK: Record<ClientNewsItem['kind'], { icon: LucideIcon; tone: string }> = {
  accepted: { icon: PartyPopper, tone: 'border-emerald-500/30 bg-emerald-500/[0.07]' },
  counter: { icon: MessageSquareReply, tone: 'border-amber-500/30 bg-amber-500/[0.07]' },
  declined: { icon: UserX, tone: 'border-border bg-muted/40' },
  signed: { icon: FileCheck2, tone: 'border-emerald-500/30 bg-emerald-500/[0.07]' },
  start: { icon: Sunrise, tone: 'border-emerald-500/30 bg-emerald-500/[0.07]' },
};

export function MilestoneBand() {
  const navigate = useNavigate();
  const { data } = useClientTasks();
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const news = data?.news ?? [];
  // Beide Fenster öffnen hier auf dem Dashboard; eigener Vorschlag und Absage führen ins Profil
  const windows = (
    <>
      <ContractTaskWindow submissionId={contractFor} open={!!contractFor} onOpenChange={(o) => { if (!o) setContractFor(null); }} />
      <OfferTaskWindow submissionId={offerFor} open={!!offerFor} onOpenChange={(o) => { if (!o) setOfferFor(null); }}
        onAdjust={() => offerFor && navigate(`/dashboard/candidates/${offerFor}`, { state: { open: 'offer' } })}
        onReject={() => offerFor && navigate(`/dashboard/candidates/${offerFor}`, { state: { open: 'reject' } })} />
    </>
  );
  if (!news.length) return windows;

  const go = (n: ClientNewsItem) => {
    if (n.kind === 'accepted') { setContractFor(n.submissionId); return; }
    if (n.kind === 'counter') { setOfferFor(n.submissionId); return; }
    navigate(n.taskKey ? taskHref({ key: n.taskKey, submissionId: n.submissionId }) : `/dashboard/candidates/${n.submissionId}`);
  };
  const [top, second] = news;
  const { icon: Icon, tone } = LOOK[top.kind];

  return (
    <div className="space-y-1.5">
      <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3', tone)}>
        <Icon className="h-5 w-5 shrink-0 text-foreground/70" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{top.title} <span className="font-normal text-muted-foreground">· {top.detail}</span></p>
          {top.hint && <p className="text-xs text-muted-foreground">{top.hint}</p>}
        </div>
        <Button size="sm" variant={top.taskKey ? 'default' : 'outline'} onClick={() => go(top)}>{top.cta}</Button>
      </div>
      {second && (
        <p className="px-1 text-xs text-muted-foreground">
          Weitere Neuigkeit: <span className="text-foreground">{second.title}</span> · {second.detail}{' '}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => go(second)}>{second.cta}</button>
          {news.length > 2 && <> · <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => navigate('/dashboard/aufgaben')}>alle Aufgaben</button></>}
        </p>
      )}
      {windows}
    </div>
  );
}
