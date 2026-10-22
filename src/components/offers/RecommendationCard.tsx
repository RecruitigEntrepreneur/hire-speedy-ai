import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { offerApi } from '@/lib/offerApi';

/**
 * Empfehlung des Headhunters im Bewerberprofil: was der Kandidat für eine Zusage braucht.
 * Steht nur da, solange noch kein Angebot angenommen ist.
 */
export function RecommendationCard({ submissionId, onOffer }: { submissionId: string; onOffer: () => void }) {
  const ctx = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId), staleTime: 15_000 });
  const rec = ctx.data?.recommendation;
  const cur = ctx.data?.currentOffer;
  if (!rec || (cur && !['withdrawn', 'declined', 'superseded'].includes(cur.status))) return null;
  const hh = ctx.data?.recruiterName?.trim() || 'Ihrem Headhunter';
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 text-sm">
      <p className="text-xs text-muted-foreground">Empfehlung von {hh} · {new Date(rec.createdAt).toLocaleDateString('de-DE')}</p>
      {rec.intro && <p className="mt-1">„{rec.intro}“</p>}
      <dl className="mt-2 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rec.items.map((i) => (
          <div key={i.key} className="contents">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd>{i.value}</dd>
          </div>
        ))}
      </dl>
      <Button size="sm" className="mt-3" onClick={onOffer}>Angebot machen</Button>
    </div>
  );
}
