import { describe, it, expect } from 'vitest';
import { bountyFor, splitFor, amountsFor } from '../../supabase/functions/_shared/konditionen';
describe('Deckel Auslobung', () => {
  const gross = 10_000_000; // 100.000 €
  it('F2 Kündigung, eigener HH: 10.000', () => {
    const s = splitFor('continuity_90', 2); const a = amountsFor('continuity_90', 2, gross);
    expect(bountyFor({ bountyCents: a.bountyCents, sameRecruiter: true, keptByOriginalCents: a.initialCents, split: s })).toBe(1_000_000);
  });
  it('F2 Nichtantritt, eigener HH: 15.000', () => {
    const s = splitFor('continuity_90', 2); const a = amountsFor('continuity_90', 2, gross);
    expect(bountyFor({ bountyCents: a.bountyCents, sameRecruiter: true, keptByOriginalCents: 0, split: s })).toBe(1_500_000);
  });
  it('F1 Kündigung, eigener HH: 5.000', () => {
    const s = splitFor('continuity_90', 1); const a = amountsFor('continuity_90', 1, gross);
    expect(bountyFor({ bountyCents: a.bountyCents, sameRecruiter: true, keptByOriginalCents: a.initialCents, split: s })).toBe(500_000);
  });
  it('fremder HH + Mehrgehalt 20.000 → 15.000 + 3.000', () => {
    const s = splitFor('continuity_90', 2);
    expect(bountyFor({ bountyCents: 1_500_000, sameRecruiter: false, keptByOriginalCents: 500_000, differenceFeeCents: 460_000, split: s })).toBe(1_800_000);
  });
});
