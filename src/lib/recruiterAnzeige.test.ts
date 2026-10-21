import { describe, expect, it } from 'vitest';
import {
  betragFunde, namensFunde, setzePlatzhalter, textDerAnzeige, verboteneBegriffe,
} from '../../supabase/functions/_shared/recruiter-anzeige';

describe('Prüfung der Anzeige', () => {
  it('kennt Firmenname mit und ohne Rechtsform, red_list und Domain', () => {
    expect(verboteneBegriffe('Kanna Medics GmbH', ['Kanna'], ['https://www.kanna-medics.de/team']))
      .toEqual(['Kanna Medics GmbH', 'Kanna Medics', 'Kanna', 'kanna-medics.de', 'kanna-medics']);
    expect(verboteneBegriffe('ASMPT GmbH & Co. KG', null)).toEqual(['ASMPT GmbH & Co. KG', 'ASMPT']);
  });

  it('findet den Firmennamen in jeder Schreibweise', () => {
    const texte = textDerAnzeige({ anzeige: { einleitung: 'Bei kanna medics arbeitest du remote.' }, ansprache: { linkedin: 'Hallo {VORNAME}' } });
    expect(namensFunde(texte, ['Kanna Medics GmbH', 'Kanna Medics'])).toEqual(['Kanna Medics']);
  });

  it('meldet Geldbeträge, die nicht vom System kommen', () => {
    expect(betragFunde(['Tagessatz bis 1.000 €', 'Vergütung: {VERGUETUNG}', '85k Fixum', '3 Tage pro Woche']))
      .toEqual(['Tagessatz bis 1.000 €', '85k Fixum']);
  });

  it('ersetzt Platzhalter, ohne Vornamen ohne Lücke', () => {
    expect(setzePlatzhalter('Hallo {VORNAME}, {VERGUETUNG}.', { vorname: 'Lena', verguetung: '310 – 780 € pro Tag' }))
      .toBe('Hallo Lena, 310 – 780 € pro Tag.');
    expect(setzePlatzhalter('Hallo {VORNAME}, {VERGUETUNG}.', {})).toBe('Hallo, nach Absprache.');
  });
});

describe('Regelprüfung gegen die Angaben des Kunden (Tax Manager, 21.10.2026)', async () => {
  const { bereinigeInhalt, bereinigeText, faktenText, regelFunde, vorteilBegriffe } = await import('../../supabase/functions/_shared/recruiter-anzeige');
  const job = {
    title: 'Tax Manager (m/w/d) – Konzernsteuern', industry: 'Großhandel für Industriebedarf', company_headcount: 900,
    company_size_band: '250–1.000', team_size: 4, salary_min: 80000, salary_max: 95000, salary_months: 13, onsite_days_required: 3,
    contract_creation_days: 7, company_culture: 'Inhabergeführt, kurze Entscheidungswege. Viele sind seit über zehn Jahren dabei.',
    must_have_criteria: ['Ertragsteuern', 'Umsatzsteuer', 'Mindestens 4 Jahre Erfahrung in der Steuerabteilung', 'Englisch mindestens B2'],
    trainable_skills: ['SAP', 'DATEV'], nice_to_have_criteria: ['Steuerberaterexamen von Vorteil'],
    benefits: ['30 Urlaubstage', 'Deutschlandticket', 'betriebliche Altersvorsorge mit 50 % Arbeitgeberzuschuss'],
    position_advantages: ['Gleitzeit ohne Kernzeit und 2 Tage Homeoffice', '3 Monate Freistellung'],
  };
  const fakten = faktenText(job);
  const vorteile = vorteilBegriffe(job);

  it('kennt, was der Kunde von Vorteil nennt', () => {
    expect(vorteile).toEqual(expect.arrayContaining(['sap', 'datev', 'steuerberaterexamen']));
    expect(vorteile).not.toContain('kenntnisse');
  });

  it('findet Marktstellung, falsche Zahlen und Vorteil als Pflicht', () => {
    const funde = regelFunde([
      'Unser Mandant ist ein führender, inhabergeführter Großhändler für Industriebedarf.',
      'Mit rund 500 Mitarbeitern und kurzen Entscheidungswegen.',
      'Sicherer Arbeitsplatz in einem krisenfesten Wachstumsmarkt',
      'Erfolgreich absolviertes Steuerberaterexamen (oder Ambition dazu)',
      'Eingespieltes 4-köpfiges Team, 2 Tage Homeoffice, 30 Urlaubstage, 50 % Zuschuss, Angebot in 7 Tagen.',
    ], fakten, vorteile);
    expect(funde.map(f => [f.art, f.treffer])).toEqual([
      ['behauptung', 'führender'],
      ['zahl', '500'],
      ['behauptung', 'krisenfesten'],
      ['behauptung', 'Sicherer Arbeitsplatz'],
      ['vorteil', 'steuerberaterexamen'],
    ]);
  });

  it('streicht Adjektive, Sätze mit falschen Zahlen und Listenpunkte mit Behauptungen', () => {
    expect(bereinigeText('Unser Mandant ist ein führender, inhabergeführter Großhändler für Industriebedarf mit Sitz in Frankfurt.', fakten, vorteile))
      .toBe('Unser Mandant ist ein inhabergeführter Großhändler für Industriebedarf mit Sitz in Frankfurt.');
    expect(bereinigeText('Ein inhabergeführtes Unternehmen im Großhandel. Mit rund 500 Mitarbeitern besticht es durch kurze Wege.', fakten, vorteile))
      .toBe('Ein inhabergeführtes Unternehmen im Großhandel.');
    const { content, entfernt } = bereinigeInhalt({
      selling_points: ['Komplette Examensförderung', 'Sicherer Arbeitsplatz in einem krisenfesten Wachstumsmarkt'],
      role_summary: 'Du verantwortest die steuerlichen Belange eines international agierenden Großhändlers.',
      anzeige: { profil_vorteil: ['Erfolgreich absolviertes Steuerberaterexamen (oder Ambition dazu)', 'Kenntnisse in SAP und DATEV sind willkommen'] },
    }, fakten, vorteile);
    expect(content.selling_points).toEqual(['Komplette Examensförderung']);
    expect(content.role_summary).toBe('Du verantwortest die steuerlichen Belange eines Großhändlers.');
    expect(content.anzeige?.profil_vorteil).toEqual(['Kenntnisse in SAP und DATEV sind willkommen']);
    expect(entfernt.length).toBe(4);
    // Ob ein Mandat exklusiv ist, sagt nur der Kunde.
    expect(bereinigeText('Ich rufe an, weil ich eine exklusive Vakanz als Tax Manager in Frankfurt betreue.', fakten, vorteile))
      .toBe('Ich rufe an, weil ich eine Vakanz als Tax Manager in Frankfurt betreue.');
  });

  it('lässt saubere Texte und Angaben des Kunden unverändert', () => {
    const sauber = { highlights: ['Head of Tax in drei Jahren', '13 Monatsgehälter, 3 Tage vor Ort'] };
    expect(bereinigeInhalt(sauber, fakten, vorteile).content).toBe(sauber);
    // Sagt der Kunde selbst „international“, bleibt es stehen.
    expect(bereinigeText('Ein international tätiger Händler.', faktenText({ ...job, company_culture: 'international tätig' }), vorteile)).toBe('Ein international tätiger Händler.');
  });
});
