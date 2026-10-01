import { describe, expect, it } from 'vitest';
import { emptyDossier } from './cvImport';
import { actionsTaken, blockedSuggestions, careerDirections, hasPhrase, offerSuggestions, togglePhrase } from './interviewSuggestions';
import { autoClientSummary, buildClientSummary, composeNotice, earliestStart, mapNoticeText, noticeParts, NOTICE_OPTIONS } from './candidateDossier';

const base = { ...emptyDossier(), full_name: 'Katharina Brenner', job_title: 'Teamleiterin Rechnungswesen und Controlling', company: 'Isar Maschinenbau AG', seniority: 'senior', certificates: ['Bilanzbuchhalterin (IHK)'], leadership_scope: 'disciplinary', leadership_team_size: 4, target_roles: ['Finance Manager'] };

describe('Chips schreiben in Freitext', () => {
  it('an und aus, Rest bleibt', () => {
    let t = 'eigene Notiz';
    t = togglePhrase(t, 'Team');
    expect(t).toBe('eigene Notiz, Team');
    expect(hasPhrase(t, 'team')).toBe(true);
    expect(togglePhrase(t, 'Team')).toBe('eigene Notiz');
  });
});

describe('Vorschläge aus der Akte', () => {
  it('Richtungen: Lebenslauf-Ziel zuerst, dann nächste Schritte', () => {
    const d = careerDirections(base);
    expect(d[0]).toBe('Finance Manager');
    expect(d).toContain('Leitung Controlling');
    expect(d).toContain('Abteilungsleitung'); // führt schon disziplinarisch → nächste Ebene
    expect(d).not.toContain('Teamleitung');
  });
  it('„Schon getan" nutzt Weiterbildung und Führung aus dem Lebenslauf', () => {
    expect(actionsTaken(base).slice(0, 2)).toEqual(['Weiterbildung: Bilanzbuchhalterin (IHK)', 'Team von 4 geführt']);
  });
  it('Angebot: Vorschläge aus der Motivation, ohne Mindestgehalt', () => {
    const s = offerSuggestions({ ...base, change_motivation: 'Nach der Übernahme fehlt mir die Entwicklungsperspektive, ich will mehr Gestaltungsspielraum.' });
    expect(s).toEqual(expect.arrayContaining(['Gestaltungsspielraum', 'Entwicklungsperspektive', 'Stabiles Unternehmen']));
    expect(s).not.toContain('Mindestgehalt');
  });
  it('Sperrliste: aktueller Arbeitgeber, dann frühere', () => {
    expect(blockedSuggestions(base, ['PersonalPlus Zeitarbeit GmbH', 'Isar Maschinenbau AG'])).toEqual([
      { name: 'Isar Maschinenbau AG', hint: 'aktueller Arbeitgeber' },
      { name: 'PersonalPlus Zeitarbeit GmbH', hint: 'früherer Arbeitgeber' },
    ]);
    expect(blockedSuggestions({ ...base, blocked_companies: ['Isar Maschinenbau AG'] }, [])).toEqual([]);
  });
});

describe('Kündigungsfrist mit Stichtag', () => {
  const today = new Date(2026, 9, 1); // 1. Oktober 2026
  it('zerlegt und setzt zusammen, alte Werte bleiben gültig', () => {
    expect(noticeParts('3_months_eoq')).toEqual({ duration: '3_months', anchor: 'eoq' });
    expect(noticeParts('4_weeks_15_eom')).toEqual({ duration: '4_weeks', anchor: '15_eom' });
    expect(noticeParts('6_weeks')).toEqual({ duration: '6_weeks', anchor: null });
    expect(composeNotice('1_month', 'eom')).toBe('1_month_eom');
    expect(NOTICE_OPTIONS.find((o) => o.value === '3_months_eom')?.label).toBe('3 Monate zum Monatsende');
  });
  it('frühester Start', () => {
    expect(earliestStart('3_months_eoq', today)).toBe('2027-04-01');
    expect(earliestStart('3_months_eom', today)).toBe('2027-02-01');
    expect(earliestStart('1_month', today)).toBe('2026-11-01');
    expect(earliestStart('4_weeks_15_eom', today)).toBe('2026-11-01');
    expect(earliestStart('immediate', today)).toBe('2026-10-01');
  });
  it('Freitext wird erkannt', () => {
    expect(mapNoticeText('3 Monate zum Monatsende')).toBe('3_months_eom');
    expect(mapNoticeText('6 Wochen zum Quartalsende')).toBe('6_weeks_eoq');
    expect(mapNoticeText('gesetzliche Kündigungsfrist')).toBe('4_weeks_15_eom');
    expect(mapNoticeText('KüF 3M z. QE')).toBe('3_months_eoq');
  });
});

describe('Kundenprofil schreibt sich mit', () => {
  const today = new Date(2026, 9, 1);
  it('Entwürfe folgen den Antworten, selbst geänderte Felder bleiben', () => {
    const f1 = { ...base, change_motivation: 'Will mehr Verantwortung', notice_period: '3_months_eoq' };
    const g1 = buildClientSummary(f1, today);
    const filled = { ...f1, ...g1 };
    expect(g1.summary_notice).toBe('Kündigungsfrist 3 Monate zum Quartalsende, frühestens ab 1.4.2027');
    // Headhunter ändert die Motivation selbst, danach ändern sich die Antworten
    const edited = { ...filled, summary_motivation: 'Mein eigener Text', expected_salary: 85000 };
    const r = autoClientSummary(edited, g1, today);
    expect(r.patch.summary_motivation).toBeUndefined();
    expect(r.edited.has('summary_motivation')).toBe(true);
    expect(r.patch.summary_salary).toBe('Wunschgehalt um 85.000 € im Jahr');
  });
});
