import { describe, expect, it } from 'vitest';
import { LEBENSLAUF_SATZ, angebotArten, einladungsText, lebenslaufText, mitLebenslaufSatz, textMitLink } from './einladungTexte';

const basis = { vorname: 'Max', hhVorname: 'Julia', dauer: 15, anlass: 'kennenlernen' as const };

describe('Einladung zum Gespräch', () => {
  it('der Satz passt zu dem, was der Headhunter anbietet', () => {
    expect(einladungsText({ ...basis, angebot: 'teams' })).toContain('über Teams');
    expect(einladungsText({ ...basis, angebot: 'phone' })).toContain('Ich rufe dich');
    expect(einladungsText({ ...basis, angebot: 'phone' })).not.toContain('Teams');
    expect(einladungsText({ ...basis, angebot: 'beides' })).toContain('entscheidest du');
  });

  it('Anrede, Gruß und Linkstelle stehen im Text', () => {
    const t = einladungsText({ ...basis, angebot: 'teams' });
    expect(t.startsWith('Hallo Max,')).toBe(true);
    expect(t).toContain('[Link]');
    expect(t.endsWith('Viele Grüße\nJulia')).toBe(true);
  });

  it('Angebot wird zu den Gesprächsarten', () => {
    expect(angebotArten('teams')).toEqual(['teams']);
    expect(angebotArten('phone')).toEqual(['phone']);
    expect(angebotArten('beides')).toEqual(['teams', 'phone']);
  });

  it('der Link landet an der markierten Stelle, sonst am Ende', () => {
    expect(textMitLink('Hallo\n\n[Link]\n\nGruß', 'https://x/y')).toBe('Hallo\n\nhttps://x/y\n\nGruß');
    expect(textMitLink('Hallo', 'https://x/y')).toBe('Hallo\n\nhttps://x/y');
  });
});

describe('Lebenslauf anfragen (05.11.2026)', () => {
  const einladung = einladungsText({ ...basis, angebot: 'teams' });

  it('der Satz steht direkt nach dem Link und geht wieder raus', () => {
    const mit = mitLebenslaufSatz(einladung, true);
    expect(mit).toContain(`[Link]\n\n${LEBENSLAUF_SATZ}\n\nViele Grüße`);
    expect(mitLebenslaufSatz(mit, false)).toBe(einladung);
    expect(mitLebenslaufSatz(mit, true)).toBe(mit);
  });

  it('lässt eigenen Text stehen und ergänzt nur den Satz', () => {
    const eigen = 'Hallo Max,\n\nwie am Telefon besprochen.\n\nViele Grüße\nJulia';
    const mit = mitLebenslaufSatz(eigen, true);
    expect(mit).toBe(`Hallo Max,\n\nwie am Telefon besprochen.\n\n${LEBENSLAUF_SATZ}\n\nViele Grüße\nJulia`);
    expect(mitLebenslaufSatz(mit, false)).toBe(eigen);
  });

  it('Text für die Anfrage ohne Termin hat Anrede, Link und Gruß', () => {
    const t = lebenslaufText({ vorname: 'Lena', hhVorname: 'Julia', anlass: 'nachher' });
    expect(t.startsWith('Hallo Lena,\n\ndanke für das gute Gespräch.')).toBe(true);
    expect(t).toContain('[Link]');
    expect(t.endsWith('Viele Grüße\nJulia')).toBe(true);
    expect(lebenslaufText({ vorname: 'Lena', hhVorname: 'Julia', anlass: 'vorher' })).toContain('vorbereiten');
  });
});
