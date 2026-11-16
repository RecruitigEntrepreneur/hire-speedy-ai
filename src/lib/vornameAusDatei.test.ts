import { describe, expect, it } from 'vitest';
import { vornameAusDatei } from './vornameAusDatei';

describe('Vorname aus dem Dateinamen', () => {
  it('nimmt den ersten Namensteil, wenn Vor- und Nachname im Namen stehen', () => {
    expect(vornameAusDatei('Lebenslauf_Ben_Koch.pdf')).toBe('Ben');
    expect(vornameAusDatei('CV Paula Schulz.docx')).toBe('Paula');
    expect(vornameAusDatei('Test_Lebenslauf_Clara_Neumann.pdf')).toBe('Clara');
    expect(vornameAusDatei('Test_Lebenslauf_Emre_Yildiz_ohne_Mail.pdf')).toBe('Emre');
    expect(vornameAusDatei('jörg-müller-lebenslauf-2026.pdf')).toBe('Jörg');
  });

  it('lässt den Namen weg, wenn nicht klar ist, was Vorname ist', () => {
    expect(vornameAusDatei('Test_Lebenslauf_neumann.pdf')).toBeNull();
    expect(vornameAusDatei('Lebenslauf.pdf')).toBeNull();
    expect(vornameAusDatei('scan_0042.pdf')).toBeNull();
    expect(vornameAusDatei('BenKoch_CV.pdf')).toBeNull();
  });
});
