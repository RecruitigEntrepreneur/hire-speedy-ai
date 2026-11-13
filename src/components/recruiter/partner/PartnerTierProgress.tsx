import { useEffect, useState } from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtDay, myPartnerProgress, nextTierHint, TIER_THRESHOLDS, type PartnerProgress, type PartnerTier } from '@/lib/jobSearch';
import { cn } from '@/lib/utils';

const ORDER: PartnerTier[] = ['partner', 'silver', 'gold'];

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {ok ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />}
      <span className={ok ? '' : 'text-muted-foreground'}>{children}</span>
    </li>
  );
}

/**
 * Partnerstufe mit Fortschritt (Profil › Partnerstatus). Die Plattform rechnet die
 * Stufe täglich aus den letzten 12 Monaten; beantragen muss niemand etwas.
 */
export function PartnerTierProgress() {
  const [p, setP] = useState<PartnerProgress | null | undefined>(undefined);
  const { t } = useTranslation('recruiterPartner');

  useEffect(() => {
    myPartnerProgress().then(setP).catch(() => setP(null));
  }, []);

  if (p === undefined) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (p === null) return <p className="text-sm text-muted-foreground">{t('progress.pending')}</p>;

  const m = p.metrics;
  const quote = m.interview_quote === null ? null : Math.round(m.interview_quote * 100);
  const rank = ORDER.indexOf(p.tier);
  const hint = nextTierHint(p);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium">{t(`progress.name.${p.tier}`)}</p>
        <p className="text-xs text-muted-foreground">
          {p.tier_valid_until ? t('progress.sinceUntil', { date: fmtDay(p.tier_since), until: fmtDay(p.tier_valid_until) }) : t('progress.since', { date: fmtDay(p.tier_since) })}
        </p>
        {hint && <p className="mt-1 text-xs text-primary">{hint}</p>}
      </div>

      {p.tier !== 'gold' && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{p.tier === 'partner' ? t('progress.untilSilver') : t('progress.untilGold')}</p>
          <ul className="space-y-1">
            {p.tier === 'partner' ? (
              <>
                <Row ok={m.interviews >= TIER_THRESHOLDS.silver.interviews || m.placements >= 1}>
                  {t('progress.interviewsOrPlacements', { interviews: m.interviews, placements: m.placements })}
                </Row>
                <Row ok={quote === null || quote >= 20}>{quote === null ? t('progress.quotePending', { target: 20 }) : t('progress.quote', { quote, target: 20 })}</Row>
              </>
            ) : (
              <>
                <Row ok={m.placements >= TIER_THRESHOLDS.gold.placements}>{t('progress.placements', { placements: m.placements })}</Row>
                <Row ok={quote === null || quote >= 35}>{quote === null ? t('progress.quotePending', { target: 35 }) : t('progress.quote', { quote, target: 35 })}</Row>
                <Row ok={m.months_active >= TIER_THRESHOLDS.gold.months}>{t('progress.months', { count: m.months_active })}</Row>
              </>
            )}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border">
        {ORDER.map((tier, i) => (
          <li key={tier} className="flex items-start justify-between gap-3 py-2 first:pt-0">
            <span className={cn('flex items-center gap-2', i > rank && 'text-muted-foreground')}>
              {i <= rank ? <Check className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground/50" />}
              {t(`progress.short.${tier}`)}
            </span>
            <span className="max-w-[60%] text-right text-xs text-muted-foreground">{i === rank ? t('progress.active') : t(`progress.rule.${tier}`)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t('progress.note')}
      </p>
    </div>
  );
}
