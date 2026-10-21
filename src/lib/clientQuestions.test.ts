import { describe, expect, it } from 'vitest';
import { gapTopic, noticeMonths, Q_INTERVIEW, Q_MOTIVATION, Q_NOTICE, Q_SALARY, questionSuggestions, readGaps, salaryWishMin } from './clientQuestions';

const base = {
  changeMotivation: 'Sucht den Schritt zur Manager-Rolle.',
  noticePeriod: '3_months_eoq',
  salaryWish: '85–95 T€',
  budgetMax: 95000,
  gaps: [] as unknown[],
  asked: [] as string[],
};

describe('Frage an den Headhunter: Vorschläge', () => {
  it('PR-BD0E8C: Gehalt im Budget, Wechselgrund da, 3 Monate Frist', () => {
    const s = questionSuggestions(base);
    expect(s.common.map((q) => q.text)).toEqual([Q_NOTICE, Q_INTERVIEW]);
  });

  it('Gehalt über Budget bringt die Gehaltsfrage', () => {
    const s = questionSuggestions({ ...base, salaryWish: '100–110 T€' });
    expect(s.common[0].text).toBe(Q_SALARY);
  });

  it('ohne Wechselgrund (Altfall) bringt die Wechselfrage', () => {
    const s = questionSuggestions({ ...base, changeMotivation: '  ' });
    expect(s.common.map((q) => q.text)).toContain(Q_MOTIVATION);
  });

  it('kurze Frist bringt keine Fristfrage', () => {
    const s = questionSuggestions({ ...base, noticePeriod: '1_month_eom' });
    expect(s.common.map((q) => q.text)).not.toContain(Q_NOTICE);
  });

  it('schon gefragte Vorschläge verschwinden', () => {
    const s = questionSuggestions({ ...base, asked: ['lässt sich die Kündigungsfrist verkürzen'] });
    expect(s.common.map((q) => q.text)).toEqual([Q_INTERVIEW]);
  });

  it('offene Punkte der Einschätzung: kritische zuerst, höchstens zwei', () => {
    const s = questionSuggestions({
      ...base,
      gaps: [
        { gap: 'Erfahrung mit SAP', severity: 'minor', mitigation: '' },
        { gap: 'Erfahrung mit Verrechnungspreisen', severity: 'critical', mitigation: '' },
        { requirement: 'Führungserfahrung', gap_severity: 'significant', mitigation_suggestion: '' },
      ],
    });
    expect(s.fromAssessment.map((q) => q.label)).toEqual(['Erfahrung mit Verrechnungspreisen?', 'Führungserfahrung?']);
    expect(s.fromAssessment[0].text).toBe('Können Sie dazu mehr sagen: Erfahrung mit Verrechnungspreisen?');
  });
});

describe('Hilfen', () => {
  it('Gehaltsspanne', () => {
    expect(salaryWishMin('85–95 T€')).toBe(85000);
    expect(salaryWishMin('90 T€')).toBe(90000);
    expect(salaryWishMin(null)).toBeNull();
  });

  it('Kündigungsfrist in Monaten', () => {
    expect(noticeMonths('3_months_eoq')).toBe(3);
    expect(noticeMonths('6_weeks')).toBe(1.5);
    expect(noticeMonths('immediate')).toBe(0);
    expect(noticeMonths('3 Monate zum Quartalsende')).toBe(3);
    expect(noticeMonths('Kündigungsfrist 3 Monate zum Quartalsende')).toBe(3);
    expect(noticeMonths('6 Monate Kündigungsfrist')).toBe(6);
    expect(noticeMonths('quatsch')).toBeNull();
  });

  it('leere Lücken werden verworfen', () => {
    expect(readGaps([{ gap: '' }, null, { gap: 'X', severity: 'critical' }])).toEqual([{ text: 'X', severity: 'critical' }]);
  });
});

describe('Thema einer Lücke', () => {
  it('nimmt das Thema vor der Begründung', () => {
    expect(gapTopic('Verrechnungspreisdokumentation (Transfer Pricing) für die Gruppe wird in der Stellenbeschreibung gefordert, ist im Profil jedoch nicht belegt.'))
      .toBe('Verrechnungspreisdokumentation (Transfer Pricing) für die Gruppe');
    expect(gapTopic("Seniority-Stufe: Stelle sucht Senior-Level, Kandidat ist formell als 'mid' eingestuft")).toBe('Seniority-Stufe');
    expect(gapTopic('Erfahrung mit Power BI')).toBe('Erfahrung mit Power BI');
  });
});
