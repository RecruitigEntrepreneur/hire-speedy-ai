import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANTEIL_SPEZIALIST, spezialistenTagessatz } from '../../supabase/functions/_shared/contracting-konditionen';
import { spezialistenSatz, verdienstImMonat, verdienstJeTag } from './recruiterContracting';

// So liefert recruiter_jobs_view eine Contracting-Stelle mit Budget 400–1.000 € aus.
const ausView = {
  employment_type: 'freelance', day_rate_min: 310, day_rate_max: 780,
  recruiter_day_earning_min: 44, recruiter_day_earning_max: 110, utilization_days_per_week: 3,
};

describe('Contracting für Recruiter', () => {
  it('zeigt den Satz des Spezialisten und den Verdienst je Einsatztag', () => {
    expect(spezialistenSatz(ausView)).toBe('310–780 €');
    expect(verdienstJeTag(ausView)).toBe('44–110 €');
  });

  it('rechnet den Monat aus der Auslastung, gerundet auf 10 €', () => {
    expect(verdienstImMonat(ausView)).toBe('570–1.430 €');
    expect(verdienstImMonat({ ...ausView, utilization_days_per_week: null })).toBeNull();
  });

  it('lässt Festanstellungen in Ruhe', () => {
    const fest = { employment_type: 'full-time', day_rate_min: 400, recruiter_day_earning_min: 44 };
    expect(spezialistenSatz(fest)).toBeNull();
    expect(verdienstJeTag(fest)).toBeNull();
  });

  it('rundet den Satz des Spezialisten ab, nie auf', () => {
    expect(spezialistenTagessatz(400)).toBe(310);
    expect(spezialistenTagessatz(1000)).toBe(780);
    expect(spezialistenTagessatz(555)).toBe(430);
  });

  it('rechnet im View mit demselben Anteil wie der Code', () => {
    const sql = readFileSync('supabase/migrations/20260929100000_recruiter_tagessatz_spezialist.sql', 'utf8');
    expect(sql).toContain(`'specialistPct')::numeric, ${ANTEIL_SPEZIALIST})`);
    expect(sql).toContain('/ 1000) * 10)::integer');
  });
});
