import { describe, expect, it } from 'vitest';
import { hardNegativeLeakAtK, macroAverage, ndcgAtK, recallAtK, reciprocalRank } from './ranking';

describe('recallAtK', () => {
  it('zählt Treffer in den Top-K', () => {
    expect(recallAtK(['a', 'b', 'c', 'd'], new Set(['a', 'd']), 2)).toBe(0.5);
    expect(recallAtK(['a', 'b', 'c', 'd'], new Set(['a', 'd']), 4)).toBe(1);
  });
  it('null ohne Positives', () => {
    expect(recallAtK(['a'], new Set(), 10)).toBeNull();
  });
});

describe('ndcgAtK', () => {
  it('perfektes Ranking ergibt 1', () => {
    const grades = new Map([
      ['a', 3],
      ['b', 2],
    ]);
    expect(ndcgAtK(['a', 'b', 'x'], grades, 10)).toBeCloseTo(1, 10);
  });
  it('vertauschtes Ranking ist kleiner als 1 (handgerechnet)', () => {
    const grades = new Map([
      ['a', 3],
      ['b', 2],
    ]);
    // DCG = 3/log2(2) + 7/log2(3) = 3 + 4.41649...; IDCG = 7 + 3/log2(3) = 8.89279...
    const expected = (3 / Math.log2(2) + 7 / Math.log2(3)) / (7 / Math.log2(2) + 3 / Math.log2(3));
    expect(ndcgAtK(['b', 'a'], grades, 10)).toBeCloseTo(expected, 10);
  });
  it('rejected (Grade 0) trägt nichts bei', () => {
    const grades = new Map([
      ['pos', 2],
      ['neg', 0],
    ]);
    expect(ndcgAtK(['neg', 'pos'], grades, 10)).toBeCloseTo(1 / Math.log2(3) / 1, 10);
  });
  it('null ohne positive Grades', () => {
    expect(ndcgAtK(['a'], new Map([['a', 0]]), 10)).toBeNull();
  });
});

describe('reciprocalRank', () => {
  it('1 bei Treffer auf Platz 1, 1/3 auf Platz 3', () => {
    expect(reciprocalRank(['p', 'x', 'y'], new Set(['p']))).toBe(1);
    expect(reciprocalRank(['x', 'y', 'p'], new Set(['p']))).toBeCloseTo(1 / 3);
  });
  it('0 wenn kein Positive im Ranking, null ohne Positives', () => {
    expect(reciprocalRank(['x'], new Set(['p']))).toBe(0);
    expect(reciprocalRank(['x'], new Set())).toBeNull();
  });
});

describe('hardNegativeLeakAtK', () => {
  it('zählt Anteil der geleakten Hard-Negatives', () => {
    expect(hardNegativeLeakAtK(['h1', 'x', 'h2', 'y'], new Set(['h1', 'h2']), 2)).toBe(0.5);
    expect(hardNegativeLeakAtK(['x', 'y'], new Set(['h1']), 2)).toBe(0);
  });
  it('null ohne Hard-Negatives', () => {
    expect(hardNegativeLeakAtK(['x'], new Set(), 10)).toBeNull();
  });
});

describe('macroAverage', () => {
  it('lässt nulls aus', () => {
    expect(macroAverage([1, null, 0])).toBe(0.5);
    expect(macroAverage([null])).toBeNull();
  });
});
