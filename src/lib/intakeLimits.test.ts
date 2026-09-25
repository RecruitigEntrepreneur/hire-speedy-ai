import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLimits, LIMITS, type LimitRule } from '../../supabase/functions/_shared/intake-limits';

/**
 * Wächter für die Zähler der login-freien Aufnahme.
 *
 * BEFUND (Live, 25.09.2026, Kanna Medics): Autosave und Code-Eingabe zählten
 * im selben Topf ('draft', Aufnahme-ID). Wer die Position ausführlich
 * eintippte, war beim ersten Code gesperrt. Diese Tests werden rot, sobald
 * sich zwei Grenzen wieder einen Topf teilen.
 */

/** Jede Regelgruppe einmal mit festen Beispielwerten aufgerufen. */
const ALLE: Record<string, LimitRule[]> = {
  start: LIMITS.start('1.2.3.4', 'link-1'),
  draftPatch: LIMITS.draftPatch('draft-1'),
  ai: LIMITS.ai('draft-1', '1.2.3.4'),
  verifySend: LIMITS.verifySend('draft-1', 'a@b.de', '1.2.3.4'),
  verifyConfirm: LIMITS.verifyConfirm('draft-1', '1.2.3.4'),
  forward: LIMITS.forward('draft-1', '1.2.3.4'),
  resume: LIMITS.resume('a@b.de', '1.2.3.4'),
  recruiterCode: LIMITS.recruiterCode('a@b.de', '1.2.3.4'),
  recruiterVerify: LIMITS.recruiterVerify('a@b.de', '1.2.3.4'),
  recruiterEnrich: LIMITS.recruiterEnrich('draft-1', '1.2.3.4'),
  clientCode: LIMITS.clientCode('a@b.de', '1.2.3.4'),
  clientVerify: LIMITS.clientVerify('a@b.de', '1.2.3.4'),
};

describe('Zähler der Aufnahme', () => {
  it('deckt jede Regelgruppe ab', () => {
    expect(Object.keys(ALLE).sort()).toEqual(Object.keys(LIMITS).sort());
  });

  it('gibt jeder Regelgruppe einen eigenen Zweck', () => {
    const besitzer = new Map<string, string>();
    for (const [gruppe, regeln] of Object.entries(ALLE)) {
      for (const { zweck } of regeln) {
        expect(zweck, gruppe).toBeTruthy();
        const schon = besitzer.get(zweck);
        expect(schon === undefined || schon === gruppe, `${gruppe} teilt „${zweck}“ mit ${schon}`).toBe(true);
        besitzer.set(zweck, gruppe);
      }
    }
  });

  it('zählt innerhalb einer Gruppe jeden Bereich nur einmal', () => {
    for (const [gruppe, regeln] of Object.entries(ALLE)) {
      const bereiche = regeln.map((r) => r.scope);
      expect(new Set(bereiche).size, gruppe).toBe(bereiche.length);
    }
  });

  it('nutzt nur Bereiche, die die Datenbank annimmt', () => {
    // Die Weiterleiten-Grenze lief früher auf 'forward' -- die Datenbank lehnte
    // das ab, und die Grenze zählte nie.
    const sql = readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20260901100100_intake_drafts.sql'), 'utf8');
    const check = sql.match(/intake_rate_limits \([\s\S]*?scope\s+text[^\n]*CHECK \(scope IN \(([^)]*)\)\)/);
    expect(check).not.toBeNull();
    const erlaubt = check![1].split(',').map((s) => s.trim().replace(/'/g, ''));
    for (const [gruppe, regeln] of Object.entries(ALLE)) {
      for (const { scope } of regeln) expect(erlaubt, `${gruppe}: ${scope}`).toContain(scope);
    }
  });
});

describe('checkLimits', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: () => 'pfeffer' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stellt die Datenbank nach: ein Zähler je (Bereich, Schlüssel), Grenze wie übergeben. */
  const datenbank = () => {
    const zaehler = new Map<string, number>();
    return {
      zaehler,
      rpc: async (_fn: string, a: { _scope: string; _key: string; _limit: number }) => {
        const k = `${a._scope}|${a._key}`;
        const n = (zaehler.get(k) ?? 0) + 1;
        zaehler.set(k, n);
        return { data: n <= a._limit, error: null };
      },
    };
  };

  it('lässt die Code-Eingabe zu, auch wenn vorher 600-mal gespeichert wurde', async () => {
    const db = datenbank();
    for (let i = 0; i < 600; i++) {
      expect((await checkLimits(db as never, LIMITS.draftPatch('draft-1'))).allowed).toBe(true);
    }
    const eingabe = await checkLimits(db as never, LIMITS.verifyConfirm('draft-1', '1.2.3.4'));
    expect(eingabe.allowed).toBe(true);
  });

  it('bremst die Code-Eingabe weiterhin nach 50 Versuchen je Aufnahme', async () => {
    const db = datenbank();
    for (let i = 0; i < 50; i++) {
      expect((await checkLimits(db as never, LIMITS.verifyConfirm('draft-1', `ip-${i}`))).allowed).toBe(true);
    }
    const zuViel = await checkLimits(db as never, LIMITS.verifyConfirm('draft-1', 'ip-neu'));
    expect(zuViel.allowed).toBe(false);
    expect(zuViel.blockedBy).toBe('draft');
    expect(zuViel.retryAt).toBeInstanceOf(Date);
  });

  it('trennt gleiche IP und gleichen Bereich nach Zweck', async () => {
    const db = datenbank();
    await checkLimits(db as never, LIMITS.start('1.2.3.4', 'link-1'));
    await checkLimits(db as never, LIMITS.ai('draft-1', '1.2.3.4'));
    await checkLimits(db as never, LIMITS.verifyConfirm('draft-1', '1.2.3.4'));
    const ipZaehler = [...db.zaehler.entries()].filter(([k]) => k.startsWith('ip|'));
    expect(ipZaehler).toHaveLength(3);
    expect(ipZaehler.every(([, n]) => n === 1)).toBe(true);
  });
});
