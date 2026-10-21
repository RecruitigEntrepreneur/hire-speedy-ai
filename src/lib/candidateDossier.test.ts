import { describe, expect, it } from 'vitest';
import {
  buildClientSummary,
  buildExposeDraft,
  exposeSummaryIssues,
  computeReadiness,
  changeEvidence,
  fromRecords,
  interviewCompleted,
  interviewGaps,
  rahmenGaps,
  abschlussGaps,
  isMissingColumnError,
  mapNoticeText,
  mergeNoteRows,
  parseMoney,
  parseSalary,
  parseDigits,
  stripNewColumns,
  suggestionsFromExtraction,
  toCandidatePayload,
  toNotesPayload,
} from './candidateDossier';

// Lena wie am 28.09. über den alten Dialog angelegt
const lena = {
  full_name: 'Lena Testfrau',
  email: 'marko.benko@bluewater-bridge.de',
  phone: '+49 170 0000000',
  city: 'München',
  job_title: 'Patientenservice-Mitarbeiterin',
  company: 'Telemedizin Beispiel GmbH',
  experience_years: 5,
  seniority: 'mid',
  skills: ['Zendesk', 'Patientenkommunikation', 'Terminmanagement'],
  specializations: ['Terminmanagement', 'Beschwerdemanagement'],
  soft_skills: null,
  salary_fix: 42000,
  expected_salary: null,
  current_salary: 38000,
  notice_period: '1_month',
  remote_preference: 'flexible',
  max_commute_minutes: 30,
  work_model: 'fulltime',
  residence_status: null,
  visa_required: false,
};

describe('Kandidatenakte: alte Daten übernehmen', () => {
  it('nimmt das Wunschgehalt aus salary_fix, wenn expected_salary leer ist', () => {
    const f = fromRecords(lena, null);
    expect(f.expected_salary).toBe(42000);
    expect(f.current_salary).toBe(38000);
  });

  it('führt Skills, Spezialisierungen und Soft Skills ohne Dubletten zusammen', () => {
    const f = fromRecords(lena, null);
    expect(f.skills).toEqual(['Zendesk', 'Patientenkommunikation', 'Terminmanagement', 'Beschwerdemanagement']);
  });

  it('übernimmt Gehalt und Kündigung aus alten Interview-Freitexten, wenn das Profil leer ist', () => {
    const f = fromRecords({ full_name: 'X', email: 'x@y.de' }, { salary_desired: '45k', salary_minimum: '40.000 €', notice_period: '3 Monate' });
    expect(f.expected_salary).toBe(45000);
    expect(f.salary_minimum).toBe(40000);
    expect(f.notice_period).toBe('3_months');
  });

  it('liest die Empfehlung aus der neuen Stufe und sonst aus dem alten Schalter', () => {
    expect(fromRecords(lena, { recommendation_level: 'rather_yes', would_recommend: true }).recommendation).toBe('rather_yes');
    expect(fromRecords(lena, { would_recommend: false }).recommendation).toBe('no');
    expect(fromRecords(lena, {}).recommendation).toBeNull();
  });

  it('ordnet alte Aufenthaltsstatus der Arbeitserlaubnis zu', () => {
    expect(fromRecords({ residence_status: 'work_visa' }, null).work_permit).toBe('permit');
    expect(fromRecords({ residence_status: null, visa_required: true }, null).work_permit).toBe('needs_visa');
  });
});

describe('Kandidatenakte: speichern', () => {
  it('schreibt das Wunschgehalt in expected_salary und spiegelt salary_fix', () => {
    const p = toCandidatePayload(fromRecords(lena, null));
    expect(p.expected_salary).toBe(42000);
    expect(p.salary_fix).toBe(42000);
    expect(p.specializations).toBeNull();
    expect((p.skills as string[]).length).toBe(4);
  });

  it('trennt neue Interview-Spalten von bestehenden und bildet die Stufen auf die alten Schalter ab', () => {
    const f = { ...fromRecords(lena, null), recommendation: 'rather_no', would_stay: 'maybe' };
    const { base, extra } = toNotesPayload(f);
    expect(base.would_recommend).toBe(false);
    expect(base.would_stay_if_matched).toBeNull();
    expect(extra.recommendation_level).toBe('rather_no');
    expect(extra.would_stay_answer).toBe('maybe');
    expect(base.notice_period).toBe('1 Monat');
    expect('recommendation_level' in base).toBe(false);
  });

  it('erkennt fehlende Spalten und entfernt nur die neuen', () => {
    expect(isMissingColumnError({ code: 'PGRST204', message: "Could not find the 'interview_type' column" })).toBe(true);
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false);
    const stripped = stripNewColumns({ interview_type: 'phone', why_now: 'x', recommendation_level: 'yes' });
    expect(stripped).toEqual({ why_now: 'x' });
  });
});

describe('Bereit zum Einreichen', () => {
  it('Lena steht nach dem alten Dialog bei 7 von 11, ohne dass ein CV nötig ist', () => {
    const r = computeReadiness(fromRecords(lena, null));
    expect(r.done).toBe(7);
    expect(r.total).toBe(11);
    expect(r.missing.map((m) => m.key)).toEqual(['motivation', 'sprachen', 'einschaetzung', 'interview']);
  });

  const deutsch = [{ language: 'Deutsch', proficiency: 'C2' }];

  const gefuehrt = {
    change_motivation: 'Feste Arbeitszeiten', recommendation: 'yes', interview_date: '2026-10-12',
    interview_type: 'phone', why_now: 'Neuer Dienstplan ab Januar',
  };

  it('ist erst mit abgeschlossenem Interview vollständig', () => {
    const entwurf = computeReadiness({ ...fromRecords(lena, null, deutsch), ...gefuehrt, interview_status: 'draft' });
    expect(entwurf.isReady).toBe(false);
    expect(entwurf.missing.map((m) => m.key)).toEqual(['interview']);
    const fertig = computeReadiness({ ...fromRecords(lena, null, deutsch), ...gefuehrt, interview_status: 'completed' });
    expect(fertig.isReady).toBe(true);
  });

  it('zählt ein abgeschlossenes Interview ohne Mindestangaben nicht', () => {
    const f = { ...fromRecords(lena, null), ...gefuehrt, why_now: '', interview_type: null, interview_status: 'completed' };
    expect(interviewCompleted(f)).toBe(false);
    expect(interviewGaps(f).map((g) => g.key)).toEqual(['interview_type', 'why_now']);
  });

  it('liest den Status aus den Notizen, ein Abschluss bleibt auch bei neuerem Entwurf', () => {
    const merged = mergeNoteRows([
      { id: 'neu', status: 'draft', why_now: null, updated_at: '2026-10-12' },
      { id: 'alt', status: 'completed', why_now: 'x', updated_at: '2026-10-01' },
    ]);
    expect(fromRecords(lena, merged).interview_status).toBe('completed');
  });

  it('verlangt Arbeitsmodell, Wohnort mit Pendelzeit und Sprachen fürs Matching (19.10.2026)', () => {
    const stefan = { ...fromRecords(lena, null, deutsch), ...gefuehrt, interview_status: 'completed', city: 'Bamberg', remote_preference: null, max_commute_minutes: null };
    expect(rahmenGaps(stefan).map((g) => g.key)).toEqual(['arbeitsmodell', 'pendeln']);
    const r = computeReadiness(stefan);
    expect(r.items.find((i) => i.key === 'interview')?.ok).toBe(true);
    expect(r.missing.map((m) => m.key)).toEqual(['arbeitsmodell', 'pendeln']);
    expect(r.missing.find((m) => m.key === 'pendeln')?.field).toBe('max_commute_minutes');
    // Ohne Wohnort springt der Punkt zum Wohnort.
    expect(computeReadiness({ ...stefan, city: '' }).missing.find((m) => m.key === 'pendeln')?.field).toBe('city');
    // Abschließen verlangt beides: Mindestangaben und Rahmen.
    expect(abschlussGaps(stefan).map((g) => g.key)).toEqual(['arbeitsmodell', 'pendeln']);
  });

  it('braucht keine Pendelzeit bei „nur remote“ oder Umzugsbereitschaft', () => {
    const basis = { ...fromRecords(lena, null, deutsch), max_commute_minutes: null };
    expect(rahmenGaps({ ...basis, remote_preference: 'remote' }).map((g) => g.key)).toEqual([]);
    expect(rahmenGaps({ ...basis, relocation_willing: true }).map((g) => g.key)).toEqual([]);
    expect(rahmenGaps(basis).map((g) => g.key)).toEqual(['pendeln']);
  });

  it('verlangt eine gültige E-Mail oder ein Telefon', () => {
    const r = computeReadiness({ ...fromRecords(lena, null), email: 'keine-mail', phone: '' });
    expect(r.items.find((i) => i.key === 'kontakt')?.ok).toBe(false);
  });
});

describe('Wechselbereitschaft', () => {
  it('liefert nur Belege aus den Antworten, keine berechnete Stufe', () => {
    const e = changeEvidence({ ...fromRecords(lena, null), specific_incident: 'Neuer Dienstplan', discussed_internally: 'Ja, ohne Ergebnis', would_stay: 'no' });
    expect(e).toEqual(['Auslöser: Neuer Dienstplan', 'Intern angesprochen: Ja, ohne Ergebnis', 'Bleibt bei Nachbesserung: Nein']);
  });

  it('wird vom Headhunter gesetzt und in der neuen Spalte gespeichert', () => {
    const f = { ...fromRecords(lena, { change_readiness: 'active' }) };
    expect(f.change_readiness).toBe('active');
    expect(toNotesPayload(f).extra.change_readiness).toBe('active');
    expect(fromRecords(lena, { change_readiness: 'unsinn' }).change_readiness).toBeNull();
  });
});

describe('Kurzprofil gegen die Akte prüfen', () => {
  const base = { ...fromRecords(lena, null), salary_minimum: 41000, current_salary: 38000, expected_salary: 45000, notice_period: '3_months_eoq' };

  it('meldet veraltetes Gehalt und veraltete Kündigungsfrist', () => {
    const f = { ...base, expose_summary: 'Patientenservice mit 5 Jahren Erfahrung. 1 Monat Kündigungsfrist. Gehaltsrahmen: 42.000 € Jahresgehalt.' };
    expect(exposeSummaryIssues(f).map((i) => i.level)).toEqual(['warn', 'warn']);
  });

  it('warnt rot, wenn Schmerzgrenze oder aktuelles Gehalt drinstehen', () => {
    const f = { ...base, expose_summary: 'Wunsch 45k, ginge ab 41.000 €, verdient heute 38.000 €.' };
    expect(exposeSummaryIssues(f).filter((i) => i.level === 'danger')).toHaveLength(2);
  });

  it('ist still beim frischen Entwurf aus der Akte', () => {
    const f = { ...base, expose_summary: '' };
    expect(exposeSummaryIssues({ ...f, expose_summary: buildExposeDraft(f) })).toEqual([]);
    expect(buildExposeDraft(f)).toContain('Kündigungsfrist 3 Monate zum Quartalsende, frühestens ab ');
    expect(buildExposeDraft(f)).toContain('Wunschgehalt um 45.000 € im Jahr.');
  });
});

describe('Kundenprofil und Exposé bleiben anonym', () => {
  const f = { ...fromRecords(lena, null), salary_minimum: 40000, change_motivation: 'Bei Telemedizin Beispiel GmbH nur Schichtdienst', offer_requirements: ['Feste Arbeitszeiten'] };

  it('baut Gehaltsrahmen und Kündigung aus der Akte', () => {
    const s = buildClientSummary(f);
    expect(s.summary_salary).toBe('Wunschgehalt um 42.000 € im Jahr');
    expect(s.summary_salary).not.toContain('40.000');
    expect(s.summary_notice).toMatch(/^Kündigungsfrist 1 Monat, frühestens ab \d{1,2}\.\d{1,2}\.\d{4}$/);
    expect(s.summary_key_requirements).toBe('Feste Arbeitszeiten · Arbeitsmodell: Flexibel, bis 30 Min. Arbeitsweg · Vollzeit');
  });

  it('ersetzt Arbeitgeber und Namen', () => {
    const s = buildClientSummary(f);
    expect(s.summary_motivation).not.toContain('Telemedizin Beispiel GmbH');
    const draft = buildExposeDraft({ ...f, expose_summary: '' });
    expect(draft).not.toContain('Lena');
    expect(draft).not.toContain('Telemedizin Beispiel GmbH');
    expect(draft).toContain('Patientenservice-Mitarbeiterin mit 5 Jahren Berufserfahrung.');
  });
});

describe('Notiz auswerten', () => {
  it('macht aus der KI-Antwort Vorschläge und markiert, was schon so im Profil steht', () => {
    const s = suggestionsFromExtraction({ salary_desired: '42000', salary_minimum: 40000, notice_period: '1 Monat', motivation_tags: ['Arbeitszeiten', 'unbekannt'] }, null, fromRecords(lena, null));
    expect(s.find((x) => x.key === 'expected_salary')?.same).toBe(true);
    expect(s.find((x) => x.key === 'salary_minimum')?.same).toBe(false);
    expect(s.find((x) => x.key === 'notice_period')?.same).toBe(true);
    expect(s.find((x) => x.key === 'change_motivation_tags')?.display).toBe('Arbeitszeiten');
  });

  it('liest Geldbeträge und Kündigungsfristen aus Freitext', () => {
    expect(parseMoney('42k')).toBe(42000);
    expect(parseMoney('38.500 €')).toBe(38500);
    expect(mapNoticeText('einen Monat zum Monatsende')).toBe('1_month_eom');
    expect(mapNoticeText('sofort')).toBe('immediate');
    expect(mapNoticeText('6 Wochen')).toBe('6_weeks');
    expect(mapNoticeText('KüF 3M z. QE')).toBe('3_months_eoq');
    expect(mapNoticeText('3 Monate zum Quartalsende')).toBe('3_months_eoq');
    expect(mapNoticeText('Kündigung 3M')).toBe('3_months');
  });

  it('liest Spannen, Tausenderpunkte und Monatsgehälter richtig', () => {
    expect(parseSalary('40-45k')).toEqual({ low: 40000, high: 45000, monthly: false });
    expect(parseSalary('42.000–45.000 €')).toEqual({ low: 42000, high: 45000, monthly: false });
    expect(parseSalary('3.500 € monatlich')).toEqual({ low: 42000, high: 42000, monthly: true });
    expect(parseSalary('52 T€')?.high).toBe(52000);
    expect(parseSalary('42,5k')?.high).toBe(42500);
    expect(parseMoney('40 bis 45k')).toBe(45000);
    expect(parseDigits('42.000')).toBe(42000);
  });
});

describe('Mehrere alte Interview-Datensätze', () => {
  it('nimmt je Feld den neuesten gefüllten Wert und ignoriert ersetzte Datensätze', () => {
    const merged = mergeNoteRows([
      { id: 'neu', additional_notes: 'Telefonat', career_ultimate_goal: null, change_motivation: '' },
      { id: 'alt', additional_notes: null, career_ultimate_goal: 'Teamleitung', change_motivation: 'Schichtdienst' },
      { id: 'weg', status: 'superseded', why_now: 'soll nicht auftauchen' },
    ]);
    expect(merged?.id).toBe('neu');
    expect(merged?.career_ultimate_goal).toBe('Teamleitung');
    expect(merged?.change_motivation).toBe('Schichtdienst');
    expect(merged?.why_now).toBeUndefined();
    expect(mergeNoteRows([])).toBeNull();
  });
});
