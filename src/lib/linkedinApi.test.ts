import { describe, expect, it } from 'vitest';
import { linkedinKommentar, mitStatus, sichererPfad } from '../../supabase/functions/_shared/linkedin-api';

describe('LinkedIn-Schnittstelle', () => {
  it('maskiert reservierte Zeichen und macht Hashtags klickbar', () => {
    expect(linkedinKommentar('Tax Manager (m/w/d) – 80.000 € #TaxManager #RheinMain'))
      .toBe('Tax Manager \\(m/w/d\\) – 80.000 € {hashtag|\\#|TaxManager} {hashtag|\\#|RheinMain}');
    expect(linkedinKommentar('→ https://matchunt.ai/t/marko-benko/tax-manager-d047f5')).toBe('→ https://matchunt.ai/t/marko-benko/tax-manager-d047f5');
    expect(linkedinKommentar('a_b *c* [x] @y')).toBe('a\\_b \\*c\\* \\[x\\] \\@y');
  });

  it('springt nur auf interne Pfade zurück, mit Status vor dem Anker', () => {
    expect(sichererPfad('https://evil.example')).toBe('/recruiter/profile/ueber-dich');
    expect(sichererPfad('//evil.example')).toBe('/recruiter/profile/ueber-dich');
    expect(sichererPfad('/recruiter/jobs/123?beitrag=1')).toBe('/recruiter/jobs/123?beitrag=1');
    expect(mitStatus('https://matchunt.ai', '/recruiter/jobs/123?beitrag=1', 'verbunden')).toBe('https://matchunt.ai/recruiter/jobs/123?beitrag=1&linkedin=verbunden');
    expect(mitStatus('https://matchunt.ai', '/recruiter/profile/ueber-dich#linkedin', 'fehler')).toBe('https://matchunt.ai/recruiter/profile/ueber-dich?linkedin=fehler#linkedin');
  });
});
