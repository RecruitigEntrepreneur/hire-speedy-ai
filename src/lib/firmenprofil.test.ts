import { describe, expect, it } from 'vitest';
import { nurLeereFelder, stammdatenAusAufnahme } from '../../supabase/functions/_shared/firmenprofil';
import { arbeitgeberVorschlaege, listeAus, type VorschlagStelle } from './arbeitgeberVorschlaege';

const lucasAufnahme = {
  id: 'd1', company_name: 'Kanna Medics', company_legal_name: 'Kanna Medics GmbH',
  company_street: 'Gabelsbergerstr. 48b', company_postal_code: '80333', company_city: 'München',
  company_registration_number: 'HRB 276653', company_vat_id: '', company_website: null,
  company_domain: 'kanna-medics.de', company_industry: 'Telemedizin', billing_email: null,
  contact_email: 'luca.bartosch@kanna-medics.de',
};

describe('Firmenprofil aus der Aufnahme', () => {
  it('übernimmt Stammdaten und Kennzahlen, leere Angaben nicht', () => {
    expect(stammdatenAusAufnahme(lucasAufnahme, { company_headcount: 6 })).toEqual({
      company_name: 'Kanna Medics', legal_name: 'Kanna Medics GmbH',
      street: 'Gabelsbergerstr. 48b', postal_code: '80333', city: 'München',
      registration_number: 'HRB 276653', website: 'kanna-medics.de', industry: 'Telemedizin',
      billing_email: 'luca.bartosch@kanna-medics.de', headcount: 6,
    });
  });

  it('nimmt den Firmennamen als Firmierung nur mit Rechtsform', () => {
    expect(stammdatenAusAufnahme({ company_name: 'ASMPT GmbH & Co. KG' }).legal_name).toBe('ASMPT GmbH & Co. KG');
    expect(stammdatenAusAufnahme({ company_name: 'ASMPT' }).legal_name).toBeUndefined();
  });

  it('füllt nur leere Felder und überschreibt nichts', () => {
    const profil = { legal_name: 'Selbst gepflegt GmbH', website: 'https://eigen.de', street: '', city: null };
    expect(nurLeereFelder(profil, { legal_name: 'Aufnahme GmbH', website: 'x.de', street: 'Weg 1', city: 'Ulm' }))
      .toEqual({ street: 'Weg 1', city: 'Ulm' });
    expect(nurLeereFelder(null, { legal_name: 'Aufnahme GmbH' })).toEqual({ legal_name: 'Aufnahme GmbH' });
  });
});

const stelle = (extra: Partial<VorschlagStelle> = {}): VorschlagStelle => ({
  id: 'j1', title: 'Arzt / Ärztin', employment_type: 'freelance',
  company_culture: 'Flache Hierarchien · Digitaler Austausch via Teams · Flache Hierarchien',
  unique_selling_points: ['100 % Fokus Cannabinoidmedizin', 'Kurze Wege zur GF'],
  benefits: ['Reisekosten werden erstattet'],
  target_companies: null, nogo_companies: [],
  ...extra,
});

describe('Vorschläge fürs Arbeitgeberprofil', () => {
  it('zerlegt Freitext und Listen und entfernt Doppelte', () => {
    expect(listeAus('a · b\nc; a')).toEqual(['a', 'b', 'c']);
    expect(listeAus(['x', ' ', 'x'])).toEqual(['x']);
    expect(listeAus(null)).toEqual([]);
  });

  it('schlägt Arbeitsweise und Argumente vor, bei Contracting keine Benefits', () => {
    const v = arbeitgeberVorschlaege(stelle(), null);
    expect(v.map((x) => x.feld)).toEqual(['culture_values', 'employer_selling_points']);
    expect(v[0].werte).toEqual(['Flache Hierarchien', 'Digitaler Austausch via Teams']);
  });

  it('schlägt Benefits bei Festanstellung vor', () => {
    const v = arbeitgeberVorschlaege(stelle({ employment_type: 'full-time', benefits: ['Jobrad'] }), null);
    expect(v.find((x) => x.feld === 'benefits')?.werte).toEqual(['Jobrad']);
  });

  it('schlägt nichts vor, was im Profil schon steht', () => {
    expect(arbeitgeberVorschlaege(stelle(), { culture_values: ['Eigene Kultur'] }).map((x) => x.feld))
      .toEqual(['employer_selling_points']);
    expect(arbeitgeberVorschlaege(null, null)).toEqual([]);
  });
});
