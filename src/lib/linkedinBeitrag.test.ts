import { describe, expect, it } from 'vitest';
import { baueBeitrag, buchungsLink, jobSlug } from './linkedinBeitrag';
import { anonymFunde, brancheAllgemein, ersetzeFunde, groesseWort, regionAus } from '../../supabase/functions/_shared/linkedin-anonym';

const taxManager = {
  id: 'd047f5db-3cf5-4e84-bae9-e316582b0d95', title: 'Tax Manager (m/w/d) – Konzernsteuern', company_name: 'Bluewater & Bridge GmbH',
  company_website: 'https://www.bluewater-bridge.de', industry: 'Großhandel für Industriebedarf', location: 'Frankfurt am Main',
  remote_type: 'hybrid', onsite_days_required: 3, employment_type: 'full-time', experience_level: 'senior',
  salary_min: 80000, salary_max: 95000, salary_months: 13, company_headcount: 900, company_size_band: '250–1.000',
  must_have_criteria: ['Ertragsteuern', 'Umsatzsteuer', 'Englisch mindestens B2', 'Mindestens 4 Jahre Erfahrung in der Steuerabteilung eines Unternehmens oder in einer Steuerberatung'],
  position_advantages: ['Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung · Perspektive Head of Tax in drei Jahren · Gleitzeit ohne Kernzeit und 2 Tage Homeoffice'],
  benefits: ['30 Urlaubstage', 'Gleitzeit ohne Kernzeit', 'Deutschlandticket'],
};

describe('Anonym für LinkedIn', () => {
  it('macht aus der Stadt eine Region und erkennt unbekannte Orte', () => {
    expect(regionAus('Frankfurt am Main')).toEqual({ text: 'Rhein-Main', sicher: true, stadt: 'Frankfurt' });
    expect(regionAus('München').text).toBe('Großraum München');
    expect(regionAus('Region Süd (Bayern, Baden-Württemberg) – Home-Office-basiert').text).toBe('Region Süd');
    expect(regionAus('Valley')).toMatchObject({ text: 'Deutschland', sicher: false });
    expect(regionAus('', 'remote').text).toBe('Remote');
  });

  it('fasst Branche und Größe allgemein', () => {
    expect(brancheAllgemein('Großhandel für Industriebedarf')).toEqual({ name: 'Handel', aus: 'aus dem Handel' });
    expect(brancheAllgemein('Digitale Gesundheit')?.name).toBe('Software & IT');
    expect(groesseWort(900, null)).toBe('mittelständisches');
    expect(groesseWort(null, '1.000–5.000')).toBe('großes');
    expect(groesseWort(null, null)).toBe('');
  });

  it('findet Firmenname, erstes Wort, genaue Stadt und Mitarbeiterzahl', () => {
    const region = regionAus('Frankfurt am Main');
    const ctx = { firma: 'Bluewater & Bridge GmbH', domains: ['bluewater-bridge.de'], region, mitarbeitende: 900 };
    const text = '… suche ich für Bluewater in Frankfurt am Main mit 900 Mitarbeitenden jemanden …';
    const funde = anonymFunde(text, ctx);
    expect(funde.map(f => [f.grund, f.treffer])).toEqual([['firma', 'Bluewater'], ['ort', 'Frankfurt am Main'], ['groesse', ' mit 900 Mitarbeitenden']]);
    expect(ersetzeFunde(text, funde)).toBe('… suche ich in Rhein-Main jemanden …');
    expect(ersetzeFunde('Bluewater sucht', funde)).toBe('das Unternehmen sucht');
    expect(anonymFunde('Für ein mittelständisches Unternehmen in Rhein-Main', ctx)).toEqual([]);
  });
});

describe('Beitragstext', () => {
  const sachlich = baueBeitrag(taxManager as never, { ton: 'sachlich', gehalt: true, slug: 'marko-benko' });

  it('baut den sachlichen Beitrag nur aus Angaben des Kunden, anonym', () => {
    expect(sachlich.text.split('\n\n').slice(0, 2)).toEqual([
      'Vertrauliche Suche: Tax Manager (m/w/d) – Konzernsteuern, Rhein-Main',
      'Für ein mittelständisches Unternehmen aus dem Handel besetze ich diese Position vertraulich.',
    ]);
    expect(sachlich.text).toContain('✓ Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung');
    expect(sachlich.text).toContain('✓ 80.000 – 95.000 € × 13');
    expect(sachlich.text).toContain('Du bringst Ertragsteuern, Umsatzsteuer und Englisch mindestens B2 mit?');
    expect(sachlich.text).toContain('→ https://matchunt.ai/t/marko-benko/tax-manager-d047f5');
    expect(sachlich.text).not.toMatch(/bluewater|frankfurt|900/i);
  });

  it('lässt das Gehalt weg, wenn abgewählt, und hat ohne Terminseite keinen Link', () => {
    const ohne = baueBeitrag(taxManager as never, { ton: 'sachlich', gehalt: false, slug: null });
    expect(ohne.text).not.toContain('€');
    expect(ohne.link).toBeNull();
    expect(ohne.text).toContain('Schreib mir hier auf LinkedIn');
  });

  it('hat drei Töne und passende Hashtags', () => {
    const kurz = baueBeitrag(taxManager as never, { ton: 'kurz', gehalt: true, slug: 'marko-benko' });
    expect(kurz.text.split('\n')[0]).toBe('Tax Manager – Konzernsteuern · Rhein-Main · 80.000 – 95.000 € × 13');
    const persoenlich = baueBeitrag(taxManager as never, { ton: 'persoenlich', gehalt: true, slug: 'marko-benko' });
    expect(persoenlich.text.startsWith('Für ein mittelständisches Unternehmen aus dem Handel (Rhein-Main) suche ich gerade vertraulich: Tax Manager (m/w/d) – Konzernsteuern.')).toBe(true);
    expect(sachlich.hashtags).toEqual(['#TaxManager', '#Konzernsteuern', '#Handel', '#RheinMain']);
  });

  it('übernimmt eine geänderte Region', () => {
    expect(baueBeitrag(taxManager as never, { ton: 'kurz', gehalt: false, slug: null, region: 'Hessen' }).text.split('\n')[0]).toBe('Tax Manager – Konzernsteuern · Hessen');
  });

  it('baut stabile Links je Stelle', () => {
    expect(jobSlug({ id: 'd047f5db-3cf5', title: 'Ärztin / Arzt (m/w/d) für Cannabinoidmedizin' })).toBe('aerztin-arzt-fuer-cannabinoidmedizin-d047f5');
    expect(buchungsLink('marko-benko', taxManager as never)).toBe('https://matchunt.ai/t/marko-benko/tax-manager-d047f5');
  });
});
