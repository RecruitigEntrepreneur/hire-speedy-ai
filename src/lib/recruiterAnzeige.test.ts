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
