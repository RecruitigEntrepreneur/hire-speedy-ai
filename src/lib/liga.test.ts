import { describe, expect, it } from 'vitest';
import {
  awardLine, awardSentence, breakdown, ligaName, ligaTips, nextQuarter, rescore, signed, weeklyContent,
  type LigaMe,
} from './liga';

const season = {
  id: 's4', label: 'Q4 2026', starts_on: '2026-10-01', ends_on: '2026-12-31', grace_days: 10, closed: false,
  top_n: 10, min_placements: 1, newcomer_months: 6, rules: {}, days_left: 70,
};

const me = (patch: Partial<NonNullable<LigaMe['me']>> = {}, rest: Partial<LigaMe> = {}): LigaMe => ({
  participant: true, name: null, season, exclusion: null, events: [], pending_holds: [], awards: [], prefs: null,
  me: { rank: 3, participants: 12, points: 20, placements: 1, interviews: 2, submissions: 3, quote: 0.4, excluded: false, awards: [], gap_above: 4, gap_top: null, ...patch },
  ...rest,
});

describe('Matchunt Liga', () => {
  it('nennt Auszeichnungen immer mit Saison, nach außen mit Platz', () => {
    expect(awardLine({ award: 'top_performer', season_label: 'Q3 2026' })).toBe('✦ Top Performer Q3 2026');
    expect(awardSentence({ award: 'season_winner', season_label: 'Q3 2026', rank: 1, participants: 38 }))
      .toBe('Headhunter der Saison Q3 2026: Platz 1 von 38 der Matchunt Liga.');
  });

  it('zeigt ohne Einwilligung keinen Namen', () => {
    expect(ligaName(null, 'Köln')).toBe('Headhunter aus Köln');
    expect(ligaName('', null)).toBe('Headhunter');
    expect(ligaName('Julia Hartmann · Hartmann Executive Search', 'Hamburg')).toBe('Julia Hartmann · Hartmann Executive Search');
  });

  it('schreibt Punkte mit echtem Minus', () => {
    expect([signed(15), signed(-3), signed(0)]).toEqual(['+15', '−3', '0']);
  });

  it('fasst Punkte je Art in Regelreihenfolge zusammen', () => {
    const lines = breakdown([
      { kind: 'placement', points: 15 }, { kind: 'interview_first', points: 3 }, { kind: 'interview_first', points: 3 },
      { kind: 'no_show', points: -3 },
    ]);
    expect(lines).toEqual([
      { kind: 'interview_first', count: 2, points: 6 },
      { kind: 'placement', count: 1, points: 15 },
      { kind: 'no_show', count: 1, points: -3 },
    ]);
  });

  it('nennt Einstellungen, die in der Saison die Garantiezeit bestehen, und den erreichbaren Bonus', () => {
    const tips = ligaTips(me({}, { pending_holds: [{ label: 'Tax Manager', until: '2026-12-03' }, { label: 'Controller', until: '2027-03-01' }] }));
    expect(tips.map((t) => t.points)).toEqual([10, 10]);
    expect(tips[0].text).toContain('Tax Manager');
    expect(tips.some((t) => t.text.includes('Controller'))).toBe(false);
    expect(tips[1].text).toMatch(/^Noch 2 Einreichungen/);
  });

  it('nennt keinen Bonus, wenn er schon da ist, und nichts nach Saisonende', () => {
    expect(ligaTips(me({}, { events: [{ id: 'e', kind: 'accuracy_bonus', points: 10, original: 10, corrected: false, reason: null, occurred_at: '2026-10-20', label: null }] }))).toEqual([]);
    expect(ligaTips(me({}, { season: { ...season, closed: true } }))).toEqual([]);
  });

  it('schlägt das nächste Quartal vor', () => {
    expect(nextQuarter(new Date('2026-10-21'))).toEqual({ label: 'Q1 2027', starts_on: '2027-01-01', ends_on: '2027-03-31' });
    expect(nextQuarter(new Date('2026-02-10'))).toEqual({ label: 'Q2 2026', starts_on: '2026-04-01', ends_on: '2026-06-30' });
  });

  it('rechnet die Vorschau mit neuen Punkten, Korrekturen bleiben', () => {
    const events = [
      { kind: 'placement' as const, points: 15, corrected_points: null },
      { kind: 'no_show' as const, points: -3, corrected_points: 0 },
    ];
    expect(rescore(events, { placement: 20 })).toBe(20);
  });

  it('schreibt die Wochenmail nur mit Stand und Fakten', () => {
    const c = weeklyContent({
      recruiter_id: 'r', email: 'x@y.de', full_name: 'Julia Hartmann', season_label: 'Q4 2026', days_left: 42,
      rank: 5, participants: 42, points: 34, previous_rank: 7, gap_above: 4, top_n: 10, next_hold: '2027-03-03', hold_points: 10,
    });
    expect(c.subject).toBe('Matchunt Liga: Du bist auf Platz 5 gestiegen (▲ 2)');
    expect(c.lines).toContain('Bis Platz 4 fehlen 4 Punkte.');
    expect(c.lines.some((l) => l.includes('03.03.2027') && l.includes('+10'))).toBe(true);
    expect(c.lines.join(' ')).not.toMatch(/mehr arbeiten|jetzt einreichen/i);
  });
});

describe('Liga im Partnerstatus', async () => {
  const { signatureHtml, signatureText, publicView } = await import('../../supabase/functions/_shared/recruiter-partner');
  const award = { award: 'top_performer' as const, season_label: 'Q3 2026', rank: 4, participants: 38 };

  it('setzt die Auszeichnung als Text mit Saison unter das Abzeichen', () => {
    expect(signatureHtml({ number: 'MP-4BGQ-RJYP', tier: 'gold', award })).toContain('✦ Top Performer Q3 2026');
    expect(signatureHtml({ number: 'MP-4BGQ-RJYP', tier: 'gold' })).not.toContain('✦');
    expect(signatureText({ number: 'MP-4BGQ-RJYP', tier: 'gold', award })).toBe('Matchunt Gold Partner · ✦ Top Performer Q3 2026 (Matchunt Liga) · Nr. MP-4BGQ-RJYP · matchunt.ai/partner/MP-4BGQ-RJYP');
  });

  it('zeigt die Auszeichnung auf der Prüfseite nur bei aktivem Status', () => {
    const row = { partner_number: 'MP-4BGQ-RJYP', tier: 'gold' as const, granted_at: '2025-08-01T00:00:00Z', ended_at: null, show_expertise_at: null };
    const view = publicView(row, { name: 'Julia', company: 'H', suspended: false, expertise: null, award }, Date.parse('2026-10-21'));
    expect(view.state === 'active' && view.award).toEqual(award);
    expect(publicView(row, { name: 'Julia', company: 'H', suspended: true, expertise: null, award }, Date.parse('2026-10-21')).state).toBe('paused');
  });
});
