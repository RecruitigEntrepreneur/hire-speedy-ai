import { describe, expect, it } from 'vitest';
import { buildMandatsBriefing, fehlendeAngaben, fragenAnKunden } from './mandatsBriefing';

// Gekürzt nach der echten Stelle „Tax Manager“ (Bluewater & Bridge), wie recruiter_jobs_view sie liefert.
const taxManager = {
  id: 'd047f5db', title: 'Tax Manager (m/w/d) – Konzernsteuern', employment_type: 'full-time', experience_level: 'senior',
  industry: 'Großhandel für Industriebedarf', location: 'Frankfurt am Main', remote_type: 'hybrid',
  salary_min: 80000, salary_max: 95000, salary_months: 13, bonus_structure: 'Nein', onsite_days_required: 3,
  core_hours: 'Gleitzeit ohne Kernzeit', contract_limitation: 'unbefristet', team_size: 4, hiring_urgency: 'urgent', urgency: 'standard',
  candidates_in_pipeline: 0, company_headcount: 900, company_size_band: '250–1.000',
  required_languages: [{ code: 'en', minLevel: 'B2' }], required_certifications: ['Steuerberaterexamen'],
  must_have_criteria: ['Ertragsteuern', 'Umsatzsteuer', 'Studium mit Schwerpunkt Steuern oder Steuerfachwirt', 'Mindestens 4 Jahre Erfahrung in der Steuerabteilung', 'Englisch mindestens B2'],
  trainable_skills: ['SAP', 'DATEV'], nice_to_have_criteria: ['Steuerberaterexamen von Vorteil'],
  success_profile: 'Eigenverantwortliche Arbeitsweise · Pragmatischer Ansatz', failure_profile: 'Wartet auf Anweisungen · Suchte Konzernstrukturen',
  vacancy_reason: 'Wachstum / neu geschaffen', task_focus: 'Operativ / hands-on',
  negative_impact_if_unfilled: 'Bestehendes Team ueberlastet · Externe Beraterkosten steigen · Betriebspruefungen verzoegern sich',
  daily_routine: 'Steuererklärungen erstellen und prüfen.',
  position_advantages: ['Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung · Perspektive Head of Tax in drei Jahren · Gleitzeit ohne Kernzeit und 2 Tage Homeoffice'],
  career_path: 'Unsere heutige Steuerreferentin hat als Werkstudentin angefangen.', career_example: 'Unsere heutige Steuerreferentin hat als Werkstudentin angefangen.',
  benefits: ['30 Urlaubstage', 'Deutschlandticket', '30 Urlaubstage'], unique_selling_points: ['Neugeschaffene Position durch Wachstum'],
  company_culture: 'Inhabergeführt, kurze Entscheidungswege.', reports_to: 'Abteilungsleitung', decision_makers: ['Geschäftsführung', 'HR'],
  contract_creation_days: 7, contract_sent_digitally: true, contract_sensitive_topics: 'Rückzahlungsklausel (Weiterbildung)',
  overtime_policy: 'ausgeglichen (Freizeit)', time_tracking_method: 'digital',
  formatted_content: {
    role_summary: 'Du verantwortest die steuerlichen Belange eines international agierenden Großhändlers.',
    urgency_note: 'Die Position ist ab sofort vakant.',
    ideal_candidate: 'Du bist ein proaktiver Steuerexperte mit Hands-on-Mentalität.',
    selling_points: ['Sicherer Arbeitsplatz in einem krisenfesten Wachstumsmarkt'],
    anonymous_company_pitch: 'Mit rund 500 Mitarbeitern und kurzen Entscheidungswegen.',
    quick_facts: { culture_keywords: ['Inhabergeführt', 'Du-Kultur'] },
    anzeige: { aufgaben: ['Steuererklärungen KSt, GewSt, USt für fünf Gesellschaften'], ablauf: ['Erstgespräch mit HR', 'Zweitgespräch mit der Geschäftsführung'] },
    ansprache: { telefon: { einstieg: 'Ich rufe an, weil ich eine exklusive Vakanz als Tax Manager in Frankfurt betreue.', fragen: ['Wie sicher fühlst Du Dich im Bereich der Umsatzsteuer?'] } },
  },
  job_summary: { ai_insights: { hiring_recommendation: 'Fokus auf Kandidaten mit Konzernsteuererfahrung.' } },
};

describe('Mandatsbriefing auf einer Seite', () => {
  const b = buildMandatsBriefing(taxManager as never, true);

  it('zeigt die Fakten nach Angabe des Kunden, bei Widerspruch gewinnt der Kunde', () => {
    expect(b.fakten.map(f => [f.id, f.wert, f.zusatz ?? null])).toEqual([
      ['gehalt', '80–95k €', '× 13 · kein Bonus'],
      ['vorort', '3 von 5 Tagen', null],
      ['level', 'Senior', '4+ Jahre'],
      ['sprache', 'Englisch B2', null],
      ['zeit', 'Gleitzeit', 'ohne Kernzeit'],
      ['vertrag', 'unbefristet', null],
      ['team', '4 Personen', null],
      ['besetzung', 'dringend', '0 Kandidaten bei Aufnahme'],
    ]);
    expect(b.fakten.find(f => f.id === 'besetzung')?.dringend).toBe(true);
  });

  it('baut den Anruf: Einstieg, Knock-out mit fehlender Kündigungsfrist, Fachfragen', () => {
    expect(b.anruf.einstieg).toMatch(/^Ich rufe an/);
    expect(b.anruf.knockout.map(k => k.text)).toEqual([
      '3 Tage pro Woche in Frankfurt am Main', 'Englisch mindestens B2', '80–95k € × 13 · kein Bonus',
      'Rückzahlungsklausel (Weiterbildung)', 'Kündigungsfrist: Grenze des Kunden fehlt',
    ]);
    expect(b.anruf.knockout.at(-1)?.fehlt).toBe(true);
    expect(b.anruf.fragen[0].bezug).toBe('Umsatzsteuer');
  });

  it('stellt das Examen unter Plus, nie unter Muss', () => {
    expect(b.profil.muss).not.toContain('Steuerberaterexamen');
    expect(b.profil.verhandelbar).toEqual(['Steuerberaterexamen']);
    expect(b.profil.erlernbar).toEqual(['SAP', 'DATEV']);
    expect(b.profil.nichtSchicken).toEqual(['Wartet auf Anweisungen', 'Suchte Konzernstrukturen']);
  });

  it('zeigt KI-Texte nur ohne Behauptungen, die der Kunde nicht gemacht hat', () => {
    expect(b.rolle.kurz).toBe('Du verantwortest die steuerlichen Belange eines Großhändlers.');
    expect(b.rolle.warumJetzt).toBe('Die Position ist ab sofort vakant.');
    expect(b.profil.empfehlungKi).toBe('Fokus auf Kandidaten mit Konzernsteuererfahrung.');
    expect(b.unternehmen.beschreibung).toBe('Großhandel für Industriebedarf · Frankfurt am Main · 900 Mitarbeitende · 250–1.000');
  });

  it('nennt Karrierebeispiel und Benefits nur einmal, Ablauf und Aufgaben mit Herkunft', () => {
    expect(b.angebot.beleg).toBe('Unsere heutige Steuerreferentin hat als Werkstudentin angefangen.');
    expect(b.angebot.benefits).toEqual(['30 Urlaubstage', 'Deutschlandticket']);
    expect(b.angebot.pitch).toHaveLength(3);
    expect(b.auswahl.schritte).toEqual(['Gespräch mit dir', 'Erstgespräch mit HR', 'Zweitgespräch mit der Geschäftsführung']);
    expect(b.auswahl.schritteHerkunft).toBe('ki');
    expect(b.aufgaben.herkunft).toBe('ki');
  });

  it('listet, was beim Kunden fehlt, mit dem Wortlaut der Aufnahme', () => {
    const ids = fehlendeAngaben(taxManager as never, true).map(f => f.id);
    expect(ids).toEqual(expect.arrayContaining(['max_notice_period', 'visa_sponsorship', 'target_companies', 'nogo_companies', 'salary_flex', 'candidate_concerns', 'interview_process', 'task_breakdown']));
    expect(ids).not.toContain('works_council');
    expect(ids).not.toContain('core_hours_detail');
    expect(ids).not.toContain('contract_duration_months');
    // Vor „Ich suche“ liefert die View Zielfirmen, Abwerbeschutz und Einwände nicht: dann nicht als fehlend zählen.
    // Je Wortlaut eine Frage: Chancen und Herausforderungen der Branche gehen als eine raus.
    const fragen = fragenAnKunden(fehlendeAngaben(taxManager as never, true));
    expect(fragen.find(f => f.ids.includes('industry_opportunities'))?.ids).toEqual(['industry_opportunities', 'industry_challenges']);
    expect(fragen.find(f => f.ids.includes('max_notice_period'))?.frage).toMatch(/\?$/);
    const vorher = fehlendeAngaben(taxManager as never, false).map(f => f.id);
    expect(vorher).not.toContain('target_companies');
    expect(vorher).not.toContain('candidate_concerns');
  });
});
