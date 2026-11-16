import { describe, expect, it } from 'vitest';
import { emptyDossier } from '@/lib/cvImport';
import { computeFitCheck } from '@/lib/fitCheck';
import type { MatchRequirementRow } from '@/lib/matchV41';
import { bescheidText, genitiv, passungsZahl, passungsZeilen, vorname } from './vorstellen';

describe('Vorstellen: Helfer', () => {
  it('nimmt bei Testkandidaten den echten Vornamen', () => {
    expect(vorname('Test Lena Hoffmann')).toBe('Lena');
    expect(vorname('Lena Hoffmann')).toBe('Lena');
    expect(vorname('Test')).toBe('Test');
    expect(vorname('')).toBe('Kandidat');
  });

  it('bildet den Genitiv', () => {
    expect(genitiv('Lena')).toBe('Lenas');
    expect(genitiv('Jonas')).toBe('Jonas’');
  });

  it('stellt Kandidat und Stelle Zeile für Zeile gegenüber', () => {
    const f = { ...emptyDossier(), full_name: 'Lena Hoffmann', expected_salary: 85000, remote_preference: 'hybrid', city: 'München', work_permit: 'citizen', notice_period: '3_months_eoq' };
    const job = { salary_min: 130000, salary_max: 160000, remote_type: 'hybrid', onsite_days_required: 5, location: 'München' };
    const fit = computeFitCheck({ expected_salary: 85000, salary_minimum: null, remote_preference: 'hybrid', city: 'München', relocation_willing: null, languages: [], work_permit: 'citizen' }, job, []);
    const musts: MatchRequirementRow[] = [{ id: 'm1', text: 'Führung von 15+ Vertrieblern', class: 'must', status: 'not_met', evidence: '', note: '' }];
    const zeilen = passungsZeilen(f, job, fit.items, musts, new Date('2026-11-09'));
    const z = (key: string) => zeilen.find((x) => x.key === key)!;
    expect(z('muss:m1')).toMatchObject({ kandidat: 'kein Beleg', stelle: 'Führung von 15+ Vertrieblern', urteil: 'nicht belegt', status: 'weicht' });
    expect(z('gehalt')).toMatchObject({ kandidat: '85.000 €', stelle: '130–160k', urteil: 'weit darunter', status: 'weicht' });
    expect(z('arbeitsmodell')).toMatchObject({ kandidat: 'hybrid', stelle: '5 Tage vor Ort', urteil: 'weicht ab' });
    expect(z('ort')).toMatchObject({ urteil: 'passt', status: 'passt' });
    expect(zeilen.some((x) => x.key === 'arbeitserlaubnis')).toBe(false); // passt, also keine eigene Zeile
    expect(z('start')).toMatchObject({ status: 'info', kandidat: 'ab 01.04.2027' });
    expect(passungsZahl(zeilen)).toEqual({ passt: 1, gesamt: 4 });
  });

  it('nennt im Bescheid an den Kandidaten keine Firma', () => {
    const t = bescheidText('Head of Sales DACH (m/w/d)', 'München');
    expect(t).toContain('„Head of Sales DACH (m/w/d)“ in München');
    expect(t).not.toMatch(/MedTec/);
    // Die Einladung des Unternehmens kommt von selbst: kein Versprechen, selbst Bescheid zu sagen.
    expect(t).not.toMatch(/sage ich dir Bescheid/);
    expect(t).toMatch(/Einladung mit Terminvorschlägen/);
  });

  it('zeigt Muss-Kriterien der Stelle auch ohne Matching, zum selbst Prüfen', () => {
    const f = { ...emptyDossier(), full_name: 'Lena Hoffmann' };
    const zeilen = passungsZeilen(f, {}, [], [], new Date('2026-11-09'), ['Führung von 15+ Vertrieblern']);
    expect(zeilen[0]).toMatchObject({ label: 'Muss', stelle: 'Führung von 15+ Vertrieblern', urteil: 'selbst prüfen', status: 'info' });
    expect(passungsZahl(zeilen).gesamt).toBe(0);
  });
});
