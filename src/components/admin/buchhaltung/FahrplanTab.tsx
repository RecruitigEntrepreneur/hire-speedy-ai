import { Button } from '@/components/ui/button';
import { eur0, type FahrplanRow } from '@/lib/buchhaltungApi';
import { Empty } from './ui';

export type FahrplanAction =
  | { kind: 'release' | 'dunning'; invoiceId: string; recruiterFirst: string | null }
  | { kind: 'case'; claimId: string }
  | { kind: 'joker' | 'start'; placementId: string };

/** Betragszeile: „Julia · Kunde 19.000 € · Headhunter 14.250 € bei Antritt · Matchunt 4.750 €“ */
function amounts(r: FahrplanRow): string {
  const who = r.recruiterFirst ?? '–';
  if (r.replacementFor) {
    return [who, `Nachbesetzung für ${r.replacementFor}`, r.bountyCents ? `Auslobung ${eur0(r.bountyCents)}` : null, r.clientFeeCents ? `Unterschied ${eur0(r.clientFeeCents)}` : null].filter(Boolean).join(' · ');
  }
  const hh = r.core || !r.recruiterRetentionCents ? `${eur0(r.recruiterInitialCents)} bei Antritt` : `${eur0(r.recruiterInitialCents)} + ${eur0(r.recruiterRetentionCents)}`;
  return `${who} · Kunde ${eur0(r.clientFeeCents)} · Headhunter ${hh} · Matchunt ${eur0(r.matchuntCents)}`;
}

/** A1 Fahrplan: je Besetzung genau ein nächster Schritt – Knopf, wenn Matchunt dran ist, sonst grauer Text. */
export function FahrplanTab({ rows, onAction }: { rows: FahrplanRow[]; onAction: (a: FahrplanAction) => void }) {
  if (!rows.length) return <Empty>Noch keine Besetzung.</Empty>;
  const act = (r: FahrplanRow) => {
    const k = r.next.key;
    if ((k === 'release' || k === 'dunning') && r.invoice) onAction({ kind: k, invoiceId: r.invoice.id, recruiterFirst: r.recruiterFirst });
    else if (k === 'case' && r.claimId) onAction({ kind: 'case', claimId: r.claimId });
    else if (k === 'joker' || k === 'start') onAction({ kind: k, placementId: r.placementId });
  };
  return (
    <div className="divide-y rounded-lg border">
      {rows.map((r) => (
        <div key={r.placementId} className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{r.candidateName} · {r.companyName} · <span className="font-normal text-muted-foreground">{r.packageLabel}</span></p>
            <p className="text-xs text-muted-foreground tabular-nums">{amounts(r)}</p>
          </div>
          {r.next.action
            ? <Button size="sm" variant={r.next.key === 'dunning' ? 'outline' : 'default'} onClick={() => act(r)}>{r.next.label}</Button>
            : <span className="text-xs text-muted-foreground">{r.next.label}</span>}
        </div>
      ))}
    </div>
  );
}
