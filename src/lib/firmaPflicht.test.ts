import { describe, expect, it } from 'vitest';
import { fehlendeFirmenangaben, firmierungAus, hatRechtsform } from '../../supabase/functions/_shared/firma-pflicht';

describe('Firmierung erkennen', () => {
  it('erkennt gängige Rechtsformen im Firmennamen', () => {
    for (const name of ['ASMPT GmbH & Co. KG', 'Muster GmbH', 'Bluewater & Bridge GmbH', 'Siemens AG', 'Start UG (haftungsbeschränkt)',
      'Allianz SE', 'Meier e.K.', 'Acme Ltd.', 'Acme Inc', 'Holding B.V.', 'Bau OHG', 'Kanzlei PartG mbB']) {
      expect(hatRechtsform(name), name).toBe(true);
    }
  });

  it('hält Wörter ohne Rechtsform nicht dafür', () => {
    for (const name of ['ASMPT', 'Agrarhandel Nord', 'Seeblick', 'Kagel Consulting', 'Bluewater & Bridge']) {
      expect(hatRechtsform(name), name).toBe(false);
    }
  });

  it('nimmt die ausdrückliche Firmierung, sonst den Firmennamen mit Rechtsform', () => {
    expect(firmierungAus({ company_legal_name: 'ASMPT GmbH & Co. KG', company_name: 'ASMPT' })).toBe('ASMPT GmbH & Co. KG');
    expect(firmierungAus({ company_legal_name: '', company_name: 'ASMPT GmbH & Co. KG' })).toBe('ASMPT GmbH & Co. KG');
    expect(firmierungAus({ company_legal_name: null, company_name: 'ASMPT' })).toBe('');
  });
});

describe('Pflichtangaben für die Vereinbarung', () => {
  it('meldet beim Live-Test-Fall nur die Anschrift, nicht die Firmierung', () => {
    // Johannes Arnold, 24.09.2026: Firmenname mit Rechtsform, Anschrift "DE".
    expect(fehlendeFirmenangaben({ company_name: 'ASMPT GmbH & Co. KG', company_street: '', company_postal_code: '', company_city: '' }))
      .toEqual(['company_street', 'company_postal_code', 'company_city']);
  });

  it('verlangt die Firmierung, wenn der Name keine Rechtsform trägt', () => {
    expect(fehlendeFirmenangaben({ company_name: 'ASMPT', company_street: 'Straße 1', company_postal_code: '81379', company_city: 'München' }))
      .toEqual(['company_legal_name']);
  });

  it('ist zufrieden, wenn alles da ist', () => {
    expect(fehlendeFirmenangaben({ company_name: 'Muster GmbH', company_street: 'Musterstraße 12', company_postal_code: '81379', company_city: 'München' }))
      .toEqual([]);
  });
});
