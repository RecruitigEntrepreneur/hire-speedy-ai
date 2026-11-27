import { describe, expect, it } from 'vitest';
import { applyOps, diffOps, kuerzel, opSchluessel, ueberschneidung } from '../../supabase/functions/_shared/aufnahme-ops';

describe('Gleichzeitiges Arbeiten: Änderungen je Antwort', () => {
  const basis = {
    built: { title: 'Test Controller (m/w/d)', location: 'München', must_haves: ['A', 'B'] },
    dyn: { catalog: { known: { vakanz_grund: { value: 'Nachbesetzung', from: 'answer' } } }, wer: { 'built.title': { k: 'SB' } } },
  };

  it('findet nur geänderte Antworten, nicht die ganze Stelle', () => {
    const neu = { ...basis, built: { ...basis.built, location: 'Stuttgart' } };
    expect(diffOps(basis, neu)).toEqual([{ feld: 'built', pfad: ['location'], wert: 'Stuttgart' }]);
  });

  it('zwei Personen, zwei Antworten: beide bleiben erhalten', () => {
    const a = diffOps(basis, { ...basis, built: { ...basis.built, location: 'Stuttgart' } });
    const b = diffOps(basis, {
      ...basis,
      dyn: { ...basis.dyn, catalog: { known: { ...basis.dyn.catalog.known, besetzt_bis: { value: '1-3', from: 'answer' } } } },
    });
    const stand = applyOps(applyOps(basis, a), b);
    expect((stand.built as { location: string }).location).toBe('Stuttgart');
    expect((stand.dyn as typeof basis.dyn & { catalog: { known: Record<string, unknown> } }).catalog.known.besetzt_bis).toEqual({ value: '1-3', from: 'answer' });
    expect(ueberschneidung(a, b)).toEqual([]);
  });

  it('dieselbe Antwort: die letzte Änderung gilt, und die Überschneidung wird erkannt', () => {
    const a = diffOps(basis, { ...basis, built: { ...basis.built, title: 'Test A' } });
    const b = diffOps(basis, { ...basis, built: { ...basis.built, title: 'Test B' } });
    expect((applyOps(applyOps(basis, a), b).built as { title: string }).title).toBe('Test B');
    expect(ueberschneidung(a, b)).toEqual(['built.title']);
  });

  it('Listen zählen als eine Antwort, gelöschte Schlüssel werden gelöscht', () => {
    const ops = diffOps(basis, { ...basis, built: { title: 'Test Controller (m/w/d)', must_haves: ['A'] } });
    expect(ops).toContainEqual({ feld: 'built', pfad: ['must_haves'], wert: ['A'] });
    expect(ops).toContainEqual({ feld: 'built', pfad: ['location'], weg: true });
    const stand = applyOps(basis, ops);
    expect('location' in (stand.built as object)).toBe(false);
  });

  it('dyn.wer schreibt nur der Server', () => {
    const neu = { ...basis, dyn: { ...basis.dyn, wer: {} } };
    expect(diffOps(basis, neu)).toEqual([]);
  });

  it('Schlüssel einer Katalog-Antwort ist die Antwort, nicht ihr Teil', () => {
    expect(opSchluessel({ feld: 'dyn', pfad: ['catalog', 'known', 'vakanz_grund', 'value'] })).toBe('dyn.catalog.known.vakanz_grund');
    expect(kuerzel('Test Ansprechpartner')).toBe('TA');
    expect(kuerzel('test.kollegin@firma.de')).toBe('TK');
  });
});
