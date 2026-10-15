import { describe, expect, it } from 'vitest';
import { canon, compareWithImpressum, registerKey, vatFormatOk } from './companyCheck';

const base = {
  name: 'FITSEVENELEVEN GmbH',
  legal_name: 'FITSEVENELEVEN GmbH',
  street: 'Leopoldstraße 5',
  postal_code: '80802',
  city: 'München',
  registration_number: 'HRB 98765 · AG München',
  vat_id: 'DE123456789',
  website: 'fitseveneleven.de',
};

describe('companyCheck', () => {
  it('vergleicht Register nach Art und Nummer', () => {
    expect(registerKey('HRB 98765 · AG München')).toBe('hrb98765');
    expect(registerKey('Amtsgericht München, HRB98765')).toBe('hrb98765');
  });

  it('Straße und Strasse sind gleich', () => {
    expect(canon('Leopoldstraße 5')).toBe(canon('Leopoldstr. 5'));
  });

  it('prüft das Format der USt-IdNr.', () => {
    expect(vatFormatOk('DE123456789')).toBe(true);
    expect(vatFormatOk('DE12345')).toBe(false);
    expect(vatFormatOk('ATU12345678')).toBe(true);
  });

  it('alles passt', () => {
    const r = compareWithImpressum(base, {
      legal_name: 'FITSEVENELEVEN GmbH', street: 'Leopoldstr. 5', postal_code: '80802', city: 'München',
      registration_number: 'HRB 98765', vat_id: 'DE 123 456 789',
    }, 'https://fitseveneleven.de/impressum');
    expect(r.fields.legal_name?.status).toBe('ok');
    expect(r.fields.registration_number?.status).toBe('ok');
    expect(r.fields.vat_id?.status).toBe('ok');
    expect(r.fields.address?.status).toBe('ok');
  });

  it('meldet abweichende Anschrift mit dem Wert aus dem Impressum', () => {
    const r = compareWithImpressum(base, { street: 'Leopoldstr. 7', postal_code: '80802', city: 'München' }, 'https://x.de/impressum');
    expect(r.fields.address?.status).toBe('diff');
    expect(r.fields.address?.text).toContain('Leopoldstr. 7');
    expect(r.fields.registration_number?.status).toBe('missing');
  });

  it('ohne Impressum kein Abgleich', () => {
    expect(compareWithImpressum(base, {}, null).checked_via).toBe('none');
  });

  it('ungültiges USt-Format fällt auf, auch wenn das Impressum schweigt', () => {
    const r = compareWithImpressum({ ...base, vat_id: 'DE12' }, { legal_name: 'FITSEVENELEVEN GmbH' }, 'https://x.de/impressum');
    expect(r.fields.vat_id?.status).toBe('diff');
  });
});
