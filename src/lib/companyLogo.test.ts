import { describe, expect, it } from 'vitest';
import { firmenInitialen } from './companyLogo';

describe('firmenInitialen', () => {
  it('überspringt das Und-Zeichen und die Rechtsform', () => {
    expect(firmenInitialen('Bluewater & Bridge GmbH')).toBe('BB');
  });

  it('nimmt bei einem Wort die ersten zwei Buchstaben', () => {
    expect(firmenInitialen('ASMPT GmbH & Co. KG')).toBe('AS');
  });

  it('nimmt die ersten zwei Wörter', () => {
    expect(firmenInitialen('Right Search Personalberatung')).toBe('RS');
  });

  it('kommt ohne Namen aus', () => {
    expect(firmenInitialen('')).toBe('?');
    expect(firmenInitialen(null)).toBe('?');
  });

  it('kennt Umlaute', () => {
    expect(firmenInitialen('Österreichische Bau AG')).toBe('ÖB');
  });
});
