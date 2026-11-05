import { describe, expect, it } from 'vitest';
import { angebotArten, einladungsText, textMitLink } from './einladungTexte';

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
