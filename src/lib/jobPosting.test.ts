import { describe, expect, it } from 'vitest';
import { buildJobPosting, postingAsText } from './jobPosting';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';

const job = (extra: Record<string, unknown> = {}) => ({
  id: 'x', title: 'Finance Manager', employment_type: 'full-time', ...extra,
} as unknown as WorkspaceJob);

describe('Die Stellenanzeige zeigt nur, was der Kandidat sehen darf', () => {
  it('nennt weder Honorar noch Konkurrenzlage noch Absprunggrund', () => {
    const text = postingAsText(buildJobPosting(job({
      recruiter_fee_percentage: 15, salary_min: 70000, salary_max: 85000,
      candidates_in_pipeline: 2,
      candidates_dropped_reason: 'Gegenangebot',
      failure_profile: 'Zwei Kollegen sind gescheitert.',
      company_name: 'Bluewater & Bridge GmbH',
    })));
    for (const verboten of ['Honorar', 'Gegenangebot', 'gescheitert', 'Bluewater']) {
      expect(text).not.toContain(verboten);
    }
    expect(text).toContain('70.000 – 85.000 €');
  });
});

describe('Benefit-Dubletten', () => {
  it('fasst Gross-/Kleinschreibung und Praefixe zusammen', () => {
    const posting = buildJobPosting(job({ benefits: [
      'betriebliche Altersvorsorge', 'Betriebliche Altersvorsorge',
      'Jobrad', 'Jobrad / Fahrradleasing',
      'Essenszuschuss', 'Essenszuschuss oder Kantine',
      '30 Tage Urlaub',
    ] }));
    const zeile = posting.blocks.find(b => b.id === 'angebot')!.bullets.find(b => b.includes('Urlaub'))!;
    expect(zeile.split(' · ').sort()).toEqual(
      ['30 Tage Urlaub', 'Betriebliche Altersvorsorge', 'Essenszuschuss oder Kantine', 'Jobrad / Fahrradleasing'].sort());
  });

  it('trennt nur an einer echten Wortgrenze', () => {
    const posting = buildJobPosting(job({ benefits: ['Bonus', 'Bonuszahlung'] }));
    const zeile = posting.blocks.find(b => b.id === 'angebot')!.bullets[0];
    expect(zeile).toBe('Bonus · Bonuszahlung');
  });
});

describe('Zertifikate', () => {
  it('erscheinen nicht zweimal, wenn sie schon Kriterium sind', () => {
    const posting = buildJobPosting(job({
      nice_to_have_criteria: ['Bilanzbuchhalter IHK'],
      required_certifications: ['Bilanzbuchhalter IHK'],
    }));
    const profil = posting.blocks.find(b => b.id === 'profil')!;
    expect(profil.bullets.filter(b => b.includes('Bilanzbuchhalter')).length).toBe(1);
  });
});

describe('Leere Bloecke', () => {
  it('erscheinen gar nicht, statt als Floskel', () => {
    const posting = buildJobPosting(job());
    expect(posting.blocks.map(b => b.id)).toEqual([]);
  });
});
