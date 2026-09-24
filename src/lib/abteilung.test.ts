import { describe, expect, it } from 'vitest';
import {
  aufbauAlsText, aufbauAusAnzeige, aufbauBereinigt, aufbauFertig, aufbauSchritte,
  einzelneBezeichnungen, naechsterSchritt, teamgroesseAus, type Abteilungsaufbau,
} from '../../supabase/functions/_shared/abteilung';
import { catalogToJobRow } from '../../supabase/functions/_shared/brief-columns';
import { catalogFromParsed } from './intakeMapping';
import { completeness, hatWert, type Known } from './briefCatalog';

/** Der Bilanzbuchhalter aus dem Test vom 24.09.2026, so wie die Anzeige ihn beschreibt. */
const BILANZ: Abteilungsaufbau = {
  einbindung: 'team',
  team: 4,
  rollen: [
    { rolle: 'Finanzbuchhalter/in', anzahl: 2 },
    { rolle: 'Lohnbuchhalter/in', anzahl: 1 },
    { rolle: 'Auszubildende/r', anzahl: 1 },
  ],
  abteilung: { name: 'Rechnungswesen', groesse: 12 },
  schnittstellen: ['Controlling', 'Einkauf', 'Steuerberater', 'Wirtschaftsprüfer'],
};

describe('Treppe: welche Frage als nächste kommt', () => {
  it('fragt zuerst nach der Einbindung', () => {
    expect(naechsterSchritt({})).toBe('einbindung');
    expect(aufbauSchritte({})).toEqual(['einbindung']);
  });

  it('öffnet je Einbindung die passenden Folgefragen', () => {
    expect(aufbauSchritte({ einbindung: 'team' })).toEqual(['einbindung', 'team', 'rollen', 'abteilung', 'schnittstellen']);
    expect(aufbauSchritte({ einbindung: 'leitung' })).toEqual(['einbindung', 'fuehrt', 'fuehrung', 'rollen', 'abteilung', 'schnittstellen']);
    expect(aufbauSchritte({ einbindung: 'bereich' })).toEqual(['einbindung', 'teams', 'fuehrung', 'abteilung', 'schnittstellen']);
    expect(aufbauSchritte({ einbindung: 'allein' })).toEqual(['einbindung', 'schnittstellen', 'abteilung']);
    expect(aufbauSchritte({ einbindung: 'aufbau' })).toEqual(['einbindung', 'ziel', 'rollen', 'abteilung', 'schnittstellen']);
  });

  it('springt über, was schon beantwortet ist', () => {
    expect(naechsterSchritt({ einbindung: 'team', team: 4 })).toBe('rollen');
    expect(naechsterSchritt({ ...BILANZ, schnittstellen: undefined })).toBe('schnittstellen');
    expect(naechsterSchritt(BILANZ)).toBeNull();
  });

  it('zählt übersprungene Listen als beantwortet, fehlende nicht', () => {
    expect(aufbauFertig({ einbindung: 'allein', schnittstellen: [], abteilung: { groesse: 3 } })).toBe(true);
    expect(aufbauFertig({ einbindung: 'allein', abteilung: { groesse: 3 } })).toBe(false);
  });

  it('verlangt eine Abteilungsgröße, der Name ist frei', () => {
    expect(aufbauFertig({ ...BILANZ, abteilung: { name: 'Rechnungswesen' } })).toBe(false);
    expect(aufbauFertig({ ...BILANZ, abteilung: { groesse: 12 } })).toBe(true);
  });
});

describe('Treppe: Einbindung umstellen', () => {
  it('behält, was in beiden Zweigen vorkommt, und verwirft die Kolleg:innen-Zahl', () => {
    const neu = aufbauBereinigt({ ...BILANZ, einbindung: 'leitung' });
    expect(neu.team).toBeUndefined();
    expect(neu.rollen).toEqual(BILANZ.rollen);
    expect(neu.abteilung).toEqual(BILANZ.abteilung);
    expect(neu.schnittstellen).toEqual(BILANZ.schnittstellen);
    // Die neuen Folgefragen kommen dran, in ihrer Reihenfolge.
    expect(naechsterSchritt(neu)).toBe('fuehrt');
  });

  it('wirft bei "allein" die Rollen weg', () => {
    expect(aufbauBereinigt({ ...BILANZ, einbindung: 'allein' }).rollen).toBeUndefined();
  });
});

describe('Treppe: was beim Headhunter ankommt', () => {
  it('schreibt den Aufbau als lesbaren Text', () => {
    expect(aufbauAlsText(BILANZ)).toBe(
      'Arbeitet im Team mit 4 Kolleg:innen (2 Finanzbuchhalter/in, 1 Lohnbuchhalter/in, 1 Auszubildende/r). '
      + 'Abteilung Rechnungswesen mit 12 Personen. '
      + 'Eng mit Controlling, Einkauf, Steuerberater und Wirtschaftsprüfer.',
    );
  });

  it('schreibt Führung und Einzelposition', () => {
    expect(aufbauAlsText({ einbindung: 'leitung', fuehrt: 6, fuehrung: 'beides', rollen: [], abteilung: { groesse: 20 } }))
      .toBe('Führt ein Team von 6 Personen, fachlich und disziplinarisch. Abteilung mit 20 Personen.');
    expect(aufbauAlsText({ einbindung: 'allein', schnittstellen: [] })).toBe('Arbeitet allein, ohne eigenes Team.');
  });

  it('leitet die Teamgröße aus dem Zweig ab -- und behauptet keine, wo es keine gibt', () => {
    expect(teamgroesseAus(BILANZ)).toBe(4);
    expect(teamgroesseAus({ einbindung: 'leitung', fuehrt: 6 })).toBe(6);
    expect(teamgroesseAus({ einbindung: 'aufbau', ziel: 5 })).toBe(5);
    expect(teamgroesseAus({ einbindung: 'allein' })).toBeNull();
    expect(teamgroesseAus({ einbindung: 'bereich', teams: 3 })).toBeNull();
  });

  it('landet als Text in department_structure', () => {
    const r = catalogToJobRow({ department_structure: { value: BILANZ }, team_size: { value: 4 } }, 'full-time');
    expect(r.department_structure).toBe(aufbauAlsText(BILANZ));
    expect(r.team_size).toBe(4);
  });

  it('lässt älteren Freitext in department_structure stehen', () => {
    const r = catalogToJobRow({ department_structure: { value: 'Teil des Finance-Teams' } }, 'full-time');
    expect(r.department_structure).toBe('Teil des Finance-Teams');
  });
});

describe('Treppe aus der Anzeige', () => {
  it('übernimmt den Aufbau, den der Parser liefert', () => {
    const a = aufbauAusAnzeige({
      einbindung: 'team', direct_team: 4, leads: null, leadership: null, teams: null, target_size: null,
      roles: [{ role: 'Finanzbuchhalter/in', count: 2 }, { role: 'Lohnbuchhalter/in', count: 1 }, { role: 'Auszubildende/r', count: 1 }],
      department_name: 'Rechnungswesen', department_size: 12,
      interfaces: ['Controlling', 'Einkauf', 'Steuerberater', 'Wirtschaftsprüfer'],
    });
    expect(a).toEqual(BILANZ);
  });

  it('erfindet nichts, wo die Anzeige schweigt', () => {
    const a = aufbauAusAnzeige({ einbindung: 'team', direct_team: 4, roles: [], interfaces: [] });
    expect(a).toEqual({ einbindung: 'team', team: 4 });
    expect(naechsterSchritt(a)).toBe('rollen');
  });

  it('fällt ohne team_structure auf die Teamzahl zurück', () => {
    expect(aufbauAusAnzeige(null, { teamSize: 8 })).toEqual({ einbindung: 'team', team: 8 });
    expect(aufbauAusAnzeige(null, { teamSize: 8, leitung: true })).toEqual({ einbindung: 'leitung', fuehrt: 8 });
    expect(aufbauAusAnzeige(null, { teamSize: 0 })).toBeNull();
  });

  it('setzt im Katalog Aufbau und Teamgröße aus derselben Quelle', () => {
    const k = catalogFromParsed({
      title: 'Bilanzbuchhalter (m/w/d)',
      team_size: 12,
      team_structure: {
        einbindung: 'team', direct_team: 4, leads: null, leadership: null, teams: null, target_size: null,
        roles: [], department_name: 'Rechnungswesen', department_size: 12, interfaces: [],
      },
    } as any);
    expect(k.department_structure.value).toMatchObject({ einbindung: 'team', team: 4 });
    // Die Treppe gewinnt -- sonst stuenden 4 und 12 nebeneinander.
    expect(k.team_size.value).toBe(4);
  });

  it('nimmt bei einer Leitungsrolle die Zahl als Führungsspanne', () => {
    const k = catalogFromParsed({ title: 'Teamleiter Kundenservice (m/w/d)', team_size: 9 } as any);
    expect(k.department_structure.value).toEqual({ einbindung: 'leitung', fuehrt: 9 });
    expect(k.team_size.value).toBe(9);
  });
});

describe('Treppe im Katalog', () => {
  const known = (v: unknown, from: 'ad' | 'answer' = 'answer'): Known => ({ department_structure: { value: v, from } });

  it('gilt erst als belegt, wenn jede Stufe des Zweigs beantwortet ist', () => {
    expect(hatWert(known({ einbindung: 'team', team: 4 }), 'department_structure')).toBe(false);
    expect(hatWert(known(BILANZ), 'department_structure')).toBe(true);
  });

  it('zählt den Aufbau als Pflichtangabe und die Teamgröße nicht mehr extra', () => {
    const offen = completeness({}, 'full-time').offen.map((s) => s.key);
    expect(offen).toContain('department_structure');
    expect(offen).not.toContain('team_size');
    const danach = completeness(known(BILANZ), 'full-time').offen.map((s) => s.key);
    expect(danach).not.toContain('department_structure');
  });
});

describe('KI-Vorschläge als einzelne Bezeichnungen', () => {
  it('zerlegt ganze Teams in Rollen ohne Zahlwort', () => {
    expect(einzelneBezeichnungen([
      'Zwei Finanzbuchhalter und ein Debitorenbuchhalter',
      'Drei Debitoren- und Kreditorenbuchhalter',
      'Zwei Bilanzbuchhalter und eine Assistenz',
    ])).toEqual(['Finanzbuchhalter', 'Debitorenbuchhalter', 'Debitoren- und Kreditorenbuchhalter', 'Bilanzbuchhalter', 'Assistenz']);
  });

  it('lässt saubere Vorschläge stehen und entfernt Doppelte', () => {
    expect(einzelneBezeichnungen(['Controlling', 'Einkauf, Steuerberater', 'controlling', '2 x Lohnbuchhalter/in']))
      .toEqual(['Controlling', 'Einkauf', 'Steuerberater', 'Lohnbuchhalter/in']);
  });
});
