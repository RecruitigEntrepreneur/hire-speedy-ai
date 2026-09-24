import { describe, expect, it } from 'vitest';
import { stellenVerlauf } from './stellenVerlauf';

const zustaende = (v: ReturnType<typeof stellenVerlauf>) => v?.schritte.map((s) => `${s.key}:${s.zustand}`);

describe('stellenVerlauf', () => {
  it('sagt bei Entwurf, geschlossener und besetzter Stelle nichts', () => {
    expect(stellenVerlauf({ status: 'draft' })).toBeNull();
    expect(stellenVerlauf({ status: 'closed' })).toBeNull();
    expect(stellenVerlauf({ status: 'filled' })).toBeNull();
  });

  it('steht nach dem Einreichen bei der Prüfung durch Matchunt', () => {
    const v = stellenVerlauf({ status: 'pending_approval', submitted_at: '2026-09-24T13:52:00Z' });
    expect(zustaende(v)).toEqual([
      'eingereicht:erledigt', 'pruefung:aktuell', 'live:offen', 'kandidaten:offen',
    ]);
    expect(v?.schritte[0].datum).toBe('2026-09-24T13:52:00Z');
    expect(v?.aktuell?.hinweis).toBe('meist unter 24 Std.');
    expect(v?.kurz).toBe('In Prüfung bei Matchunt');
  });

  it('schiebt die interne Freigabe davor', () => {
    const v = stellenVerlauf({ status: 'pending_client_approval', submitted_at: '2026-09-24T13:52:00Z' });
    expect(zustaende(v)).toEqual([
      'eingereicht:erledigt', 'team:aktuell', 'pruefung:offen', 'live:offen', 'kandidaten:offen',
    ]);
    expect(v?.kurz).toBe('Freigabe Ihres Teams');
  });

  it('behält die erledigte Team-Freigabe mit Datum', () => {
    const v = stellenVerlauf({ status: 'pending_approval', client_approved_at: '2026-09-25T06:30:00Z' });
    expect(v?.schritte.find((s) => s.key === 'team')).toMatchObject({ zustand: 'erledigt', datum: '2026-09-25T06:30:00Z' });
  });

  it('ist live und sucht, solange kein Kandidat da ist', () => {
    const v = stellenVerlauf({ status: 'published', approved_at: '2026-09-25T09:10:00Z' }, { kandidaten: 0 });
    expect(v?.aktuell?.key).toBe('live');
    expect(v?.kurz).toBe('Live · Headhunter suchen');
    expect(v?.schritte.find((s) => s.key === 'pruefung')?.datum).toBe('2026-09-25T09:10:00Z');
  });

  it('ist durch, sobald der erste Kandidat da ist', () => {
    const v = stellenVerlauf({ status: 'published' }, { kandidaten: 3, ersterKandidatAm: '2026-09-29T08:00:00Z' });
    expect(v?.aktuell).toBeNull();
    expect(v?.schritte.at(-1)).toMatchObject({ key: 'kandidaten', zustand: 'erledigt', datum: '2026-09-29T08:00:00Z' });
  });

  it('nennt kein erfundenes Einreichdatum für alte Live-Stellen', () => {
    const v = stellenVerlauf({ status: 'published', updated_at: '2026-09-20T10:00:00Z' });
    expect(v?.schritte[0].datum).toBeNull();
  });

  it('fällt bei wartenden Stellen ohne Spalte auf updated_at zurück', () => {
    const v = stellenVerlauf({ status: 'pending_approval', updated_at: '2026-09-24T13:52:00Z' });
    expect(v?.schritte[0].datum).toBe('2026-09-24T13:52:00Z');
  });
});
