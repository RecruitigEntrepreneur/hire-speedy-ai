import { useEffect, useState } from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';
import { fmtDay, myPartnerProgress, nextTierHint, TIER_THRESHOLDS, type PartnerProgress, type PartnerTier } from '@/lib/jobSearch';
import { cn } from '@/lib/utils';

const ORDER: PartnerTier[] = ['partner', 'silver', 'gold'];
const NAME: Record<PartnerTier, string> = { partner: 'Matchunt Partner', silver: 'Matchunt Silber Partner', gold: 'Matchunt Gold Partner' };
const RULE: Record<PartnerTier, string> = {
  partner: 'Mit dem Vertrag',
  silver: '5 Kunden-Interviews oder 1 Einstellung in 12 Monaten, Interview-Quote ab 20 %',
  gold: '3 Einstellungen in 12 Monaten, Interview-Quote ab 35 %, mindestens 6 Monate dabei',
};

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

  useEffect(() => {
    myPartnerProgress().then(setP).catch(() => setP(null));
  }, []);

  if (p === undefined) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (p === null) return <p className="text-sm text-muted-foreground">Die Stufe wird angezeigt, sobald dein Partnerstatus aktiv ist.</p>;

  const m = p.metrics;
  const quote = m.interview_quote === null ? null : Math.round(m.interview_quote * 100);
  const rank = ORDER.indexOf(p.tier);
  const hint = nextTierHint(p);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium">{NAME[p.tier]}</p>
        <p className="text-xs text-muted-foreground">
          seit {fmtDay(p.tier_since)}
          {p.tier_valid_until ? ` · gültig bis ${fmtDay(p.tier_valid_until)}, verlängert sich, solange die Kriterien erfüllt sind` : ''}
        </p>
        {hint && <p className="mt-1 text-xs text-primary">{hint}</p>}
      </div>

      {p.tier !== 'gold' && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Bis {p.tier === 'partner' ? 'Silber' : 'Gold'}, letzte 12 Monate</p>
          <ul className="space-y-1">
            {p.tier === 'partner' ? (
              <>
                <Row ok={m.interviews >= TIER_THRESHOLDS.silver.interviews || m.placements >= 1}>
                  Kunden-Interviews {m.interviews} von 5 · oder Einstellungen {m.placements} von 1
                </Row>
                <Row ok={quote === null || quote >= 20}>{quote === null ? 'Interview-Quote zählt ab 5 Einreichungen (Ziel ab 20 %)' : `Interview-Quote ${quote} % (ab 20 %)`}</Row>
              </>
            ) : (
              <>
                <Row ok={m.placements >= TIER_THRESHOLDS.gold.placements}>Einstellungen {m.placements} von 3</Row>
                <Row ok={quote === null || quote >= 35}>{quote === null ? 'Interview-Quote zählt ab 5 Einreichungen (Ziel ab 35 %)' : `Interview-Quote ${quote} % (ab 35 %)`}</Row>
                <Row ok={m.months_active >= TIER_THRESHOLDS.gold.months}>dabei seit {m.months_active} {m.months_active === 1 ? 'Monat' : 'Monaten'} (ab 6)</Row>
              </>
            )}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border">
        {ORDER.map((t, i) => (
          <li key={t} className="flex items-start justify-between gap-3 py-2 first:pt-0">
            <span className={cn('flex items-center gap-2', i > rank && 'text-muted-foreground')}>
              {i <= rank ? <Check className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground/50" />}
              {NAME[t].replace('Matchunt ', '')}
            </span>
            <span className="max-w-[60%] text-right text-xs text-muted-foreground">{i === rank ? 'aktiv' : RULE[t]}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Die Stufe zeigt Kunden, was du schon geliefert hast. Sie ändert nichts an deinen Plätzen und Konditionen.
      </p>
    </div>
  );
}
