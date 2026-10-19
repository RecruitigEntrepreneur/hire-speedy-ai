import { describe, expect, it } from 'vitest';
import { CAREER_GOALS, GOAL_RECOGNIZE, ALL_GOALS, PERSONAL_GOALS, careerGoalSuggestions, goalClientText, goalsAsRoles, isRoleGoal, sameRole, understandGoalWords, type GoalInput } from './careerGoals';
import { clientMotivation } from './situationMotives';

const base: GoalInput = { job_title: '', experience_years: null, leadership_scope: null, leadership_team_size: null, negative: [], incidents: [] };
const top = (s: ReturnType<typeof careerGoalSuggestions>, row: 'beruflich' | 'persoenlich') => s[row].filter((g) => g.top).map((g) => `${g.label} · ${g.reason}`);
const labels = (s: ReturnType<typeof careerGoalSuggestions>, row: 'beruflich' | 'persoenlich') => s[row].map((g) => g.label);

describe('Karriereziel: Vorschläge je Person', () => {
  it('Scrum Master mit 24 Jahren, führt fachlich: Führung, Architektur, Titel', () => {
    const s = careerGoalSuggestions({ ...base, job_title: 'Scrum Master und Entwickler', experience_years: 24, leadership_scope: 'functional', leadership_team_size: 5, negative: ['Kein Einfluss auf Technik', 'Bereitschaftsdienst'] });
    expect(top(s, 'beruflich')).toEqual(['Engineering Manager · führt fachlich', 'Software-Architektur · stört: kein Einfluss auf Technik', 'Agile Coach · Titel']);
    expect(labels(s, 'beruflich')).not.toContain('Senior-Rolle');
    expect(top(s, 'persoenlich')).toEqual(['Langfristig ankommen · 24 J.', 'Weniger Stress · stört: Bereitschaftsdienst']);
    expect(s.persoenlichZuerst).toBe(false);
  });
  it('Sachbearbeiterin nach Übernahme: persönliche Reihe zuerst, keine Geschäftsführung', () => {
    const s = careerGoalSuggestions({ ...base, job_title: 'Sachbearbeiterin', experience_years: 28, leadership_scope: 'none', negative: ['Übernahme', 'Arbeitslast'] });
    expect(s.persoenlichZuerst).toBe(true);
    expect(top(s, 'persoenlich')[0]).toBe('Sicherer Arbeitgeber · stört: Übernahme');
    expect(labels(s, 'beruflich')).not.toContain('Geschäftsführung');
    expect(labels(s, 'beruflich')).toContain('Teamleitung');
  });
  it('nie die heutige Rolle und nie darunter', () => {
    const v = careerGoalSuggestions({ ...base, job_title: 'Vertriebsleiter', experience_years: 15, leadership_scope: 'disciplinary', leadership_team_size: 12 });
    expect(labels(v, 'beruflich')).not.toContain('Vertriebsleitung');
    expect(top(v, 'beruflich')[0]).toBe('Vertriebsdirektor · führt 12');
    const gf = careerGoalSuggestions({ ...base, family: 'clevel', job_title: 'Geschäftsführer', experience_years: 22, leadership_scope: 'disciplinary', leadership_team_size: 80 });
    expect(labels(gf, 'beruflich')).not.toContain('Geschäftsführung');
    expect(labels(gf, 'beruflich')).not.toContain('Bereichsleitung');
    expect(top(gf, 'beruflich')[0]).toBe('Größeres Unternehmen führen · führt 80');
    expect(sameRole('Vertriebsleitung', 'Vertriebsleiter')).toBe(true);
    expect(sameRole('Vertriebsdirektor', 'Vertriebsleiter')).toBe(false);
  });
  it('Berufseinstieg: vertiefen und Verantwortung, Pflege: Dienstplan → planbare Zeiten', () => {
    const j = careerGoalSuggestions({ ...base, job_title: 'Junior Controllerin', experience_years: 3, leadership_scope: 'none', negative: ['Keine Entwicklung'] });
    expect(top(j, 'beruflich')).toEqual(['Mehr Verantwortung · stört: keine Entwicklung', 'Leitung Controlling · Titel']);
    expect(labels(j, 'beruflich')).toContain('Senior-Rolle');
    const p = careerGoalSuggestions({ ...base, job_title: 'Pflegefachkraft', experience_years: 8, negative: ['Schlechte Dienstplanung', 'Ständiges Einspringen'] });
    expect(top(p, 'persoenlich')).toEqual(['Weniger Stress · stört: Ständiges Einspringen', 'Planbare Arbeitszeiten · stört: Schlechte Dienstplanung']);
    expect(labels(p, 'beruflich')[0]).toBe('Stationsleitung');
  });
  it('Knöpfe ohne Komma und ohne „oder/und“', () => {
    for (const l of [...Object.keys(CAREER_GOALS), ...Object.keys(PERSONAL_GOALS)]) {
      expect(l.includes(','), l).toBe(false);
      expect(/\s(oder|und)\s/.test(l), l).toBe(false);
    }
  });
});

describe('Karriereziel im Kundentext', () => {
  it('Geld, eigene Firma und Selbstständigkeit gehen nie zum Kunden', () => {
    expect(goalClientText('Mehr verdienen')).toBeNull();
    expect(goalClientText('Eigene Firma')).toBeNull();
    expect(goalClientText('Selbstständig beraten')).toBeNull();
    expect(goalClientText('Beteiligung am Unternehmen')).toBeNull();
    expect(goalClientText('Bereichsleitung')).toBe('Bereichsleitung');
    expect(goalClientText('Head of Data')).toBe('Head of Data');
  });
  it('beruflich und persönlich in einem Satz', () => {
    const r = clientMotivation('it', '', 'Mehr Termine als Arbeit', '', { goals: ['Engineering Manager', 'Sicherer Arbeitgeber', 'Mehr verdienen'] });
    expect(r.text).toBe('Sucht mehr Zeit für konzentrierte Arbeit. Langfristiges Ziel: Engineering Manager, dazu ein sicherer Arbeitgeber.');
  });
  it('gleiches Thema nur einmal: „Sucht“ vor dem Ziel, das Ziel vor „Wichtig bleibt“', () => {
    const a = clientMotivation('spezialist', '', 'Übernahme', '', { goals: ['Sicherer Arbeitgeber'] });
    expect(a.text).toBe('Sucht ein stabiles Umfeld mit klarer Perspektive. Anlass ist eine Übernahme.');
    const b = clientMotivation('spezialist', 'Stabilität, Team', 'Arbeitslast', '', { goals: ['Sicherer Arbeitgeber'] });
    expect(b.text).toBe('Sucht eine realistische Arbeitsbelastung. Langfristiges Ziel: ein sicherer Arbeitgeber. Wichtig bleibt außerdem ein gutes Team.');
  });
  it('gewählte Ziele werden als Wunschrollen vorgeschlagen, wenn sie eine Rolle sind', () => {
    expect(goalsAsRoles(['Engineering Manager', 'Sicherer Arbeitgeber', 'Wissen weitergeben', 'Bereichsleitung'])).toEqual(['Engineering Manager', 'Bereichsleitung']);
  });
});

describe('Karriereziel: eigene Worte verstehen', () => {
  const u = (t: string, chosen: string[] = []) => understandGoalWords(t, chosen).map((h) => `${h.label}${h.isNew ? ' (neu)' : ''} ← ${h.quote}`);
  it('Wünsche werden zu Knöpfen, mit dem Satzteil als Beleg', () => {
    expect(u('will irgendwann eine Abteilung leiten und mehr Zeit für die Familie')).toEqual(['Abteilungsleitung ← eine Abteilung leiten', 'Mehr Zeit fürs Privatleben ← mehr Zeit für die Familie']);
    expect(u('etwas Sinnvolles machen, homeoffice wäre toll')).toEqual(['Sinnvolle Arbeit ← etwas Sinnvolles machen', 'Flexibel arbeiten ← homeoffice wäre toll']);
    expect(u('bis zur Rente bei einem sicheren Arbeitgeber')).toContain('Langfristig ankommen ← bis zur Rente bei einem sicheren Arbeitgeber');
  });
  it('getippte Rollen werden ein eigener Knopf, bekannte Rollen der Katalog-Knopf', () => {
    expect(u('Head of Data werden, gerne im Ausland')).toEqual(['Head of Data (neu) ← Head of Data', 'International arbeiten ← gerne im Ausland']);
    expect(u('Leiter Einkauf')).toEqual(['Leiter Einkauf (neu) ← Leiter Einkauf']);
    expect(u('ich will Engineering Manager werden')).toEqual(['Engineering Manager ← Engineering Manager']);
    expect(isRoleGoal('Head of Data')).toBe(true);
    expect(isRoleGoal('Mehr Zeit')).toBe(false);
    expect(isRoleGoal('Head of Data werden')).toBe(false);
    expect(goalsAsRoles(['Head of Data', 'Weniger Stress'])).toEqual(['Head of Data']);
  });
  it('„kein Chef werden“ ist keine Teamleitung, sondern Fachkarriere', () => {
    expect(u('kein Chef werden, lieber Experte bleiben')).toEqual(['Fachkarriere ohne Führung ← kein Chef werden']);
  });
  it('schon Angetipptes wird nicht noch einmal vorgeschlagen', () => {
    expect(u('mehr Verantwortung', ['Mehr Verantwortung'])).toEqual([]);
  });
  it('erkannte Ziele sind echte Knöpfe, ohne Komma und ohne „oder/und“', () => {
    for (const [, l] of GOAL_RECOGNIZE) expect(ALL_GOALS[l], l).toBeTruthy();
    expect(goalClientText('Flexibel arbeiten')).toBe('flexibles Arbeiten');
    expect(goalClientText('Etwas aufbauen')).toBe('eine Aufbaurolle');
    expect(goalClientText('Head of Data')).toBe('Head of Data');
  });
});
