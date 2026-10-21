import { describe, expect, it } from 'vitest';
import { buildArbeitsBriefing } from './arbeitsBriefing';
import { umlaute } from './recruiterBriefing';

const taxManager = {
  id: 'd047f5db', title: 'Tax Manager (m/w/d) – Konzernsteuern', employment_type: 'full-time', experience_level: 'senior',
  industry: 'Großhandel für Industriebedarf', location: 'Frankfurt am Main', remote_type: 'hybrid',
  salary_min: 80000, salary_max: 95000, salary_months: 13, bonus_structure: 'Nein', onsite_days_required: 3,
  core_hours: 'Gleitzeit ohne Kernzeit', contract_limitation: 'unbefristet', team_size: 4, hiring_urgency: 'urgent',
  candidates_in_pipeline: 0, company_headcount: 900, company_size_band: '250–1.000',
  required_languages: [{ code: 'en', minLevel: 'B2' }], required_certifications: ['Steuerberaterexamen'],
  must_have_criteria: ['Ertragsteuern', 'Umsatzsteuer', 'Englisch mindestens B2'],
  trainable_skills: ['SAP', 'DATEV'], nice_to_have_criteria: ['Steuerberaterexamen von Vorteil'],
  success_profile: 'Eigenverantwortliche Arbeitsweise · Pragmatischer Ansatz', failure_profile: 'Wartet auf Anweisungen · Suchte Konzernstrukturen',
  vacancy_reason: 'Wachstum / neu geschaffen', task_focus: 'Operativ / hands-on',
  negative_impact_if_unfilled: 'Bestehendes Team ueberlastet · Externe Beraterkosten steigen · Betriebspruefungen verzoegern sich',
  daily_routine: 'Steuererklärungen erstellen und prüfen.',
  position_advantages: ['Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung · Perspektive Head of Tax in drei Jahren · Gleitzeit ohne Kernzeit und 2 Tage Homeoffice'],
  career_path: 'Unsere heutige Steuerreferentin hat als Werkstudentin angefangen.', career_example: 'Unsere heutige Steuerreferentin hat als Werkstudentin angefangen.',
  benefits: ['30 Urlaubstage', 'Gleitzeit ohne Kernzeit', 'Übernahme der Kosten für das Steuerberaterexamen', 'Deutschlandticket'],
  unique_selling_points: ['Neugeschaffene Position durch Wachstum · Möglichkeit zur Entwicklung zum Head of Tax · Unterstützung beim Steuerberaterexamen'], company_culture: 'Inhabergeführt, kurze Entscheidungswege.',
  department_structure: 'Arbeitet im Team mit 4 Kolleg:innen. Eng mit Einkauf und Vertrieb.',
  reports_to: 'Abteilungsleitung', decision_makers: ['Geschäftsführung', 'HR'], contract_creation_days: 7, contract_sent_digitally: true,
  contract_sensitive_topics: 'Rückzahlungsklausel (Weiterbildung)', overtime_policy: 'ausgeglichen (Freizeit)', time_tracking_method: 'digital',
  formatted_content: { role_summary: 'KI-Text, der im Briefing nicht erscheint.' },
};

describe('Briefing nach Arbeitsschritten', () => {
  const schritte = buildArbeitsBriefing(taxManager as never, true);
  const zeilen = (id: string) => schritte.find(s => s.id === id)!.zeilen;
  const wert = (id: string, label: string) => zeilen(id).find(z => z.label === label)?.wert;

  it('hat fünf Schritte in der Reihenfolge der Arbeit', () => {
    expect(schritte.map(s => s.frage)).toEqual(['Lohnt sich der Auftrag?', 'Wen suche ich, und wo?', 'Womit überzeuge ich?', 'Was kläre ich im ersten Gespräch?', 'Wie bringe ich es ins Ziel?']);
  });

  it('beantwortet „Lohnt sich das?“ mit Gehalt, Ort, Dringlichkeit', () => {
    expect(wert('lohnt', 'Gehalt')).toBe('80.000 – 95.000 € fix × 13, kein Bonus');
    expect(wert('lohnt', 'Arbeitsort')).toBe('Frankfurt am Main · 3 Tage vor Ort');
    expect(wert('lohnt', 'Dringlichkeit')).toBe('dringend · beim Kunden noch keine Kandidaten im Prozess');
    expect(zeilen('lohnt').find(z => z.label === 'Dringlichkeit')?.vertraulich).toBe(true);
    expect(wert('lohnt', 'Wenn sie offen bleibt')).toBe('Bestehendes Team überlastet · Externe Beraterkosten steigen · Betriebsprüfungen verzögern sich');
  });

  it('stellt das Examen unter Von Vorteil und markiert „Nicht schicken“', () => {
    expect(zeilen('suche')[0]).toEqual({ label: 'Muss', chips: ['Ertragsteuern', 'Umsatzsteuer', 'Englisch mindestens B2'] });
    expect(wert('suche', 'Von Vorteil')).toBe('Steuerberaterexamen');
    expect(zeilen('suche').find(z => z.label === 'Nicht schicken')).toMatchObject({ wert: 'wartet auf Anweisungen · suchte Konzernstrukturen', vertraulich: true });
  });

  it('sammelt alle Benefits an einer Stelle, ohne Doppelungen', () => {
    const b = schritte.find(s => s.id === 'ueberzeugen')!;
    expect(b.benefits).toEqual([
      'Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung', 'Perspektive Head of Tax in drei Jahren',
      'Gleitzeit ohne Kernzeit und 2 Tage Homeoffice', '30 Urlaubstage', 'Deutschlandticket',
    ]);
    expect(b.beleg).toBe('Unsere heutige Steuerreferentin hat als Werkstudentin angefangen.');
    expect(wert('ueberzeugen', 'Entwicklung')).toBeUndefined();
    expect(wert('ueberzeugen', 'Unternehmen')).toBe('900 Mitarbeitende · Neugeschaffene Position durch Wachstum');
  });

  it('zeigt keine KI-Texte und jede Angabe nur einmal', () => {
    const alles = JSON.stringify(schritte);
    expect(alles).not.toContain('KI-Text');
    expect(alles.match(/Rückzahlungsklausel/g)).toHaveLength(1);
  });

  it('wiederholt bei Unternehmen, Team und Arbeitszeit nichts', () => {
    expect(wert('ueberzeugen', 'Unternehmen')).toBe('900 Mitarbeitende · Neugeschaffene Position durch Wachstum');
    expect(wert('ueberzeugen', 'Team')).toBe('Arbeitet im Team mit 4 Kolleg:innen. Eng mit Einkauf und Vertrieb · berichtet an: Abteilungsleitung');
    expect(wert('ueberzeugen', 'Arbeitszeit')).toBe('Überstunden: ausgeglichen (Freizeit) · Zeiterfassung: digital');
  });

  it('ordnet die Lücken dem Schritt zu, in dem man sie braucht', () => {
    const offen = (id: string) => schritte.find(s => s.id === id)!.offen.map(f => f.id);
    expect(offen('lohnt')).toEqual(['salary_flex']);
    expect(offen('suche')).toEqual(['target_companies', 'nogo_companies']);
    expect(offen('gespraech')).toEqual(expect.arrayContaining(['max_notice_period', 'visa_sponsorship', 'candidate_concerns']));
    expect(offen('abschluss')).toEqual(['interview_process']);
  });
});

describe('Umlaute der Aufnahme-KI', () => {
  it('repariert bekannte Wörter und lässt andere stehen', () => {
    expect(umlaute('Bestehendes Team ueberlastet · Betriebspruefungen verzoegern sich')).toBe('Bestehendes Team überlastet · Betriebsprüfungen verzögern sich');
    expect(umlaute('Ueber 20 Jahre fuer Steuer und neue Kunden, aktuell teuer')).toBe('Über 20 Jahre für Steuer und neue Kunden, aktuell teuer');
    expect(umlaute('Geboten werden {VERGUETUNG} und eine faire Verguetung')).toBe('Geboten werden {VERGUETUNG} und eine faire Vergütung');
  });
});
