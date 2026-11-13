import { useQuery } from '@tanstack/react-query';
import { offerApi } from '@/lib/offerApi';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '@/lib/localeFormat';

/**
 * Empfehlung des Headhunters im Bewerberprofil: was der Kandidat für eine Zusage braucht.
 * Steht nur da, solange noch kein Angebot angenommen ist. „Angebot machen“ ist der Hauptknopf darüber.
 */
export function RecommendationCard({ submissionId }: { submissionId: string }) {
  const { t } = useTranslation('offers');
  const ctx = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId), staleTime: 15_000 });
  const rec = ctx.data?.recommendation;
  const cur = ctx.data?.currentOffer;
  if (!rec || (cur && !['withdrawn', 'declined', 'superseded'].includes(cur.status))) return null;
  const hh = ctx.data?.recruiterName?.trim() || t('client.yourRecruiterDat');
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 text-sm">
      <p className="text-xs text-muted-foreground">{t('client.rec.from', { hh, date: fmtDate(rec.createdAt) })}</p>
      {rec.intro && <p className="mt-1">„{rec.intro}“</p>}
      <dl className="mt-2 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rec.items.map((i) => (
          <div key={i.key} className="contents">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd>{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
