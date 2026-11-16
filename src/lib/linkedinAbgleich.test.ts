import { describe, expect, it } from 'vitest';
import { monat, profilAusSnapshot, vorschlagAus } from '../../supabase/functions/_shared/linkedin-profil';
import { emptyExpertise } from '../../supabase/functions/_shared/recruiter-expertise';
import { abgleichZeilen, bandFuer, uebernahme, type Aktuell } from './linkedinAbgleich';
import type { LinkedinAbgleich } from './terminApi';

// Spaltennamen wie im LinkedIn-Datenexport bzw. in der Member Snapshot API.
const SNAPSHOT = {
  PROFILE: [{ 'First Name': 'Julia', 'Last Name': 'Hartmann', Headline: 'Senior Talent Acquisition Partner | Tech & Sales | MedTech', Summary: '' }],
  POSITIONS: [
    { 'Company Name': 'Hartmann Recruiting', Title: 'Senior Talent Acquisition Partner', Description: 'Besetze Vertriebs- und Software-Rollen in der Medizintechnik.', 'Started On': 'Mar 2021', 'Finished On': '' },
    { 'Company Name': 'Kontor Personalberatung GmbH', Title: 'Recruiter', Description: 'Active Sourcing für Key Account Manager.', 'Started On': 'Jan 2016', 'Finished On': 'Feb 2021' },
    { 'Company Name': 'Stadtwerke', Title: 'Sachbearbeiterin', Description: '', 'Started On': '2012', 'Finished On': 'Dec 2015' },
  ],
  LANGUAGES: [{ Name: 'Deutsch', Proficiency: 'Native or bilingual proficiency' }, { Name: 'English', Proficiency: 'Full professional proficiency' }, { Name: 'Türkisch' }],
  SKILLS: [{ Name: 'Active Sourcing' }, { Name: 'Medical Devices' }],
};

const abgleich = (v = vorschlagAus(profilAusSnapshot(SNAPSHOT), new Date('2026-11-16'))): LinkedinAbgleich =>
  ({ name: 'Julia Hartmann', bild: 'https://media.licdn.com/dms/image/x/profile.jpg', dma: 'bereit', vorschlag: v });

const leer: Aktuell = { name: 'Julia Hartmann', position: '', jahre: null, hatFoto: false, expertise: emptyExpertise() };

describe('LinkedIn-Profil lesen', () => {
  it('liest Monate in den üblichen Schreibweisen', () => {
    expect(monat('Mar 2015')).toBe(2015 * 12 + 2);
    expect(monat('März 2015')).toBe(2015 * 12 + 2);
    expect(monat('2015-03')).toBe(2015 * 12 + 2);
    expect(monat('03/2015')).toBe(2015 * 12 + 2);
    expect(monat('2015')).toBe(2015 * 12);
    expect(monat('')).toBeNull();
  });

  it('schlägt Rolle, Jahre im Recruiting, Sprachen und Schwerpunkte aus den Listen vor', () => {
    const v = vorschlagAus(profilAusSnapshot(SNAPSHOT), new Date('2026-11-16'));
    expect(v.position).toBe('Senior Talent Acquisition Partner');
    expect(v.erfahrungJahre).toBe(10); // Recruiter seit Jan 2016, die Station davor zählt nicht
    expect(v.sprachen).toEqual(['Deutsch', 'Englisch']); // Türkisch steht nicht im Katalog
    expect(v.unterbereiche).toEqual(['Softwareentwicklung', 'Vertrieb', 'Key Account', 'Medizintechnik']);
    expect(v.bereiche).toEqual(['IT & Software', 'Sales & Marketing', 'Healthcare & Pharma']);
  });

  it('nimmt ohne laufende Station die Überschrift bis zum ersten Trenner', () => {
    const v = vorschlagAus(profilAusSnapshot({ PROFILE: [{ Headline: 'Headhunterin bei Nordlicht Search | IT' }] }));
    expect(v.position).toBe('Headhunterin');
    expect(v.erfahrungJahre).toBeNull();
  });
});

describe('Fenster „Das haben wir auf LinkedIn gefunden“', () => {
  it('wählt bei leerem Profil alles vor', () => {
    const z = abgleichZeilen(abgleich(), leer);
    expect(z.map((x) => x.art)).toEqual(['foto', 'position', 'erfahrung', 'sprachen', 'schwerpunkte']);
    expect(z.every((x) => x.vorausgewaehlt)).toBe(true);
  });

  it('überschreibt Eingetragenes nur per Häkchen und zeigt Gleiches gar nicht', () => {
    const akt: Aktuell = { ...leer, position: 'Talent Acquisition Manager', jahre: 10, hatFoto: true, expertise: { ...emptyExpertise(), languages: ['Deutsch'], areas: ['IT & Software'] } };
    const z = abgleichZeilen(abgleich(), akt);
    expect(z.find((x) => x.art === 'erfahrung')).toBeUndefined();
    expect(z.find((x) => x.art === 'position')).toMatchObject({ bisher: 'Talent Acquisition Manager', vorausgewaehlt: false });
    expect(z.find((x) => x.art === 'foto')?.vorausgewaehlt).toBe(false);
    expect(z.find((x) => x.art === 'sprachen')).toMatchObject({ neu: 'Englisch', vorausgewaehlt: false });
    expect(z.find((x) => x.art === 'schwerpunkte')).toMatchObject({
      neu: 'IT & Software: Softwareentwicklung · Sales & Marketing: Vertrieb, Key Account · Healthcare & Pharma: Medizintechnik', vorausgewaehlt: false,
    });
  });

  it('ohne Datenfreigabe bleibt nur das Foto', () => {
    const z = abgleichZeilen({ ...abgleich(), dma: 'aus', vorschlag: null }, leer);
    expect(z.map((x) => x.art)).toEqual(['foto']);
    expect(abgleichZeilen({ ...abgleich(), dma: 'aus', vorschlag: null }, { ...leer, hatFoto: true, fotoVonLinkedin: true })).toEqual([]);
  });

  it('ergänzt Listen, kürzt nie, und setzt das Erfahrungsband nur, wenn es leer ist', () => {
    const akt: Aktuell = { ...leer, expertise: { ...emptyExpertise(), languages: ['Polnisch'], areas: ['Finance & Controlling'], subareas: ['Controlling'] } };
    const u = uebernahme(new Set(['foto', 'position', 'erfahrung', 'sprachen', 'schwerpunkte']), abgleich(), akt);
    expect(u.foto).toBe(true);
    expect(u.profil).toEqual({ role_title: 'Senior Talent Acquisition Partner', years_experience: 10 });
    expect(u.expertise?.languages).toEqual(['Polnisch', 'Deutsch', 'Englisch']);
    expect(u.expertise?.areas).toEqual(['Finance & Controlling', 'IT & Software', 'Sales & Marketing', 'Healthcare & Pharma']);
    expect(u.expertise?.subareas).toContain('Controlling');
    expect(u.expertise?.experience).toBe(bandFuer(10));
    expect(uebernahme(new Set(), abgleich(), akt)).toEqual({ foto: false, profil: {}, expertise: null });
  });
});
