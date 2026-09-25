import { describe, expect, it } from 'vitest';
import {
  ANTEIL_MATCHUNT, ANTEIL_SPEZIALIST, anteilSpezialist, aufteilungAusBudget,
} from '../../supabase/functions/_shared/contracting-konditionen';

describe('Konditionen Contracting', () => {
  it('teilt den Tagessatz vollständig auf', () => {
    expect(ANTEIL_SPEZIALIST + ANTEIL_MATCHUNT).toBe(100);
    expect(anteilSpezialist(1000)).toBe(780);
    expect(anteilSpezialist(1400)).toBe(1092);
  });

  it('rechnet die Spanne aus dem Budget der Aufnahme', () => {
    expect(aufteilungAusBudget(900, 1100))
      .toBe('Mit Ihrem Budget von 900–1.100 € je Tag erhält der Spezialist 702–858 € je Tag.');
  });

  it('kommt mit nur einer Grenze und vertauschten Werten zurecht', () => {
    expect(aufteilungAusBudget(1000, null))
      .toBe('Mit Ihrem Budget von 1.000 € je Tag erhält der Spezialist 780 € je Tag.');
    expect(aufteilungAusBudget(1100, 900))
      .toBe('Mit Ihrem Budget von 900–1.100 € je Tag erhält der Spezialist 702–858 € je Tag.');
  });

  it('erfindet ohne Budget keine Zahl', () => {
    expect(aufteilungAusBudget(null, null)).toBeNull();
    expect(aufteilungAusBudget(0, '')).toBeNull();
  });
});
