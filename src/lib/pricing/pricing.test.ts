import { describe, expect, it } from 'vitest';
import {
  PACKAGES, PACKAGE_ORDER, clientFacingPackage, snapshotForKey, snapshotOf,
  computeFees, computeClaimOutcome, estimateForClient, midpointOfBand,
  isEligibleClaim, retentionReleaseDate, continuityEndDate, claimDeadline,
  eurosToCents, centsToEuros, applyPercent, splitExact, formatEuros,
} from './index';

const eur = (cents: number) => centsToEuros(cents);

/**
 * Die Paket-Invarianten. Sie sind der Grund, warum die einbehaltene Tranche
 * bei einem Claim nicht verschwindet, sondern Teil der Bounty wird.
 */
describe('Paket-Invarianten', () => {
  it('es gibt genau drei Pakete — keine vierte Option', () => {
    expect(Object.keys(PACKAGES).sort()).toEqual(['continuity_180', 'continuity_90', 'core']);
    expect(PACKAGE_ORDER).toEqual(['core', 'continuity_90', 'continuity_180']);
  });

  it.each(PACKAGE_ORDER)('%s: ohne Claim geht die Verteilung exakt auf', (key) => {
    const p = PACKAGES[key];
    expect(p.recruiterInitialPct + p.recruiterRetentionPct + p.matchuntPct).toBe(p.clientFeePct);
  });

  it.each(PACKAGE_ORDER)('%s: mit Claim geht die Verteilung exakt auf', (key) => {
    const p = PACKAGES[key];
    expect(p.recruiterInitialPct + p.researchBountyPct + p.matchuntOnClaimPct).toBe(p.clientFeePct);
  });

  it('die Bounty ist die verfallene Tranche plus der Continuity-Aufpreis', () => {
    const core = PACKAGES.core.clientFeePct;
    for (const key of ['continuity_90', 'continuity_180'] as const) {
      const p = PACKAGES[key];
      const aufpreis = p.clientFeePct - core;
      expect(p.researchBountyPct, key).toBe(p.recruiterRetentionPct + aufpreis);
    }
  });

  it('der Recruiter bekommt ohne Claim in jedem Paket dieselben 15 Punkte', () => {
    for (const key of PACKAGE_ORDER) {
      const p = PACKAGES[key];
      expect(p.recruiterInitialPct + p.recruiterRetentionPct, key).toBe(15);
    }
  });

  it('Matchunt verbleiben bei erfolgreicher Ersatzvermittlung immer 5 Punkte', () => {
    for (const key of PACKAGE_ORDER) expect(PACKAGES[key].matchuntOnClaimPct, key).toBe(5);
  });

  it('Core hat keine Continuity und keine Bounty', () => {
    expect(PACKAGES.core.continuityDays).toBeNull();
    expect(PACKAGES.core.researchBountyPct).toBe(0);
    expect(PACKAGES.core.recruiterRetentionPct).toBe(0);
    expect(PACKAGES.core.eligibleClaimCategories).toEqual([]);
  });
});

/** Die vom Auftraggeber vorgegebenen Rechenbeispiele. */
describe('Wirtschaftliche Tests bei 100.000 € Bruttojahreszielgehalt', () => {
  const GROSS = 100_000;

  it('Core: 20.000 Kunde · 15.000 Recruiter · 5.000 Matchunt', () => {
    const f = computeFees(GROSS, snapshotForKey('core'));
    expect(eur(f.clientFeeCents)).toBe(20_000);
    expect(eur(f.recruiterInitialCents)).toBe(15_000);
    expect(eur(f.recruiterRetentionCents)).toBe(0);
    expect(eur(f.recruiterTotalCents)).toBe(15_000);
    expect(eur(f.matchuntCents)).toBe(5_000);
  });

  it('Continuity 90 ohne Claim: 23.000 · 10.000 initial · 5.000 Retention · 8.000 Matchunt', () => {
    const f = computeFees(GROSS, snapshotForKey('continuity_90'));
    expect(eur(f.clientFeeCents)).toBe(23_000);
    expect(eur(f.recruiterInitialCents)).toBe(10_000);
    expect(eur(f.recruiterRetentionCents)).toBe(5_000);
    expect(eur(f.recruiterTotalCents)).toBe(15_000);
    expect(eur(f.matchuntCents)).toBe(8_000);
  });

  it('Continuity 90 mit Claim: 10.000 behalten · 8.000 Bounty · 5.000 Matchunt · 0 Nachberechnung', () => {
    const c = computeClaimOutcome(GROSS, snapshotForKey('continuity_90'));
    expect(eur(c.originalRecruiterKeepsCents)).toBe(10_000);
    expect(eur(c.forfeitedRetentionCents)).toBe(5_000);
    expect(eur(c.researchBountyCents)).toBe(8_000);
    expect(eur(c.matchuntCents)).toBe(5_000);
    expect(c.additionalClientInvoiceCents).toBe(0);
  });

  it('Continuity 180 ohne Claim: 26.000 · 10.000 initial · 5.000 Retention · 11.000 Matchunt', () => {
    const f = computeFees(GROSS, snapshotForKey('continuity_180'));
    expect(eur(f.clientFeeCents)).toBe(26_000);
    expect(eur(f.recruiterInitialCents)).toBe(10_000);
    expect(eur(f.recruiterRetentionCents)).toBe(5_000);
    expect(eur(f.matchuntCents)).toBe(11_000);
  });

  it('Continuity 180 mit Claim: 10.000 behalten · 11.000 Bounty · 5.000 Matchunt · 0 Nachberechnung', () => {
    const c = computeClaimOutcome(GROSS, snapshotForKey('continuity_180'));
    expect(eur(c.originalRecruiterKeepsCents)).toBe(10_000);
    expect(eur(c.forfeitedRetentionCents)).toBe(5_000);
    expect(eur(c.researchBountyCents)).toBe(11_000);
    expect(eur(c.matchuntCents)).toBe(5_000);
    expect(c.additionalClientInvoiceCents).toBe(0);
  });

  it('der Kunde zahlt bei einem Claim kein zweites Honorar', () => {
    for (const key of PACKAGE_ORDER) {
      const ohne = computeFees(GROSS, snapshotForKey(key));
      const mit = computeClaimOutcome(GROSS, snapshotForKey(key));
      expect(mit.additionalClientInvoiceCents, key).toBe(0);
      // Was ausgeschüttet wird, übersteigt nie das eine Kundenhonorar.
      const ausgeschuettet = mit.originalRecruiterKeepsCents + mit.researchBountyCents + mit.matchuntCents;
      expect(ausgeschuettet, key).toBe(ohne.clientFeeCents);
    }
  });
});

/** Die Preistabelle aus der Kundenansicht. */
describe('Preistabelle für die Paketkarten', () => {
  const tabelle: [number, number, number, number][] = [
    // Gehalt,  Core,    Continuity 90, Continuity 180
    [50_000, 10_000, 11_500, 13_000],
    [75_000, 15_000, 17_250, 19_500],
    [100_000, 20_000, 23_000, 26_000],
    [150_000, 30_000, 34_500, 39_000],
  ];

  it.each(tabelle)('%i € → Core %i · C90 %i · C180 %i', (gross, core, c90, c180) => {
    expect(eur(estimateForClient(gross, PACKAGES.core).feeCents!)).toBe(core);
    expect(eur(estimateForClient(gross, PACKAGES.continuity_90).feeCents!)).toBe(c90);
    expect(eur(estimateForClient(gross, PACKAGES.continuity_180).feeCents!)).toBe(c180);
  });

  it('ohne Gehaltsangabe gibt es keine Schätzung statt einer erfundenen Null', () => {
    expect(estimateForClient(null, PACKAGES.core).feeCents).toBeNull();
    expect(estimateForClient(0, PACKAGES.core).feeCents).toBeNull();
  });

  it('nimmt die Mitte des Gehaltsbands aus der Aufnahme', () => {
    expect(midpointOfBand(75_000, 95_000)).toBe(85_000);
    expect(midpointOfBand(80_000, null)).toBe(80_000);
    expect(midpointOfBand(null, null)).toBeNull();
  });
});

/** Der Kunde darf die Innenrechnung nicht sehen. */
describe('clientFacingPackage', () => {
  it.each(PACKAGE_ORDER)('%s trägt keine einzige interne Kennzahl', (key) => {
    // Über die Feldnamen, nicht über den Text: der öffentliche Paketname ist
    // "Matchunt Core", die Marke darf also vorkommen — die Innenrechnung nicht.
    const felder = Object.keys(clientFacingPackage(PACKAGES[key]));
    expect(felder.sort()).toEqual([
      'bullets', 'claimNoticeDays', 'continuityDays', 'feePercent',
      'key', 'name', 'summary', 'version',
    ]);
    for (const feld of felder) {
      expect(feld, `${key}.${feld}`).not.toMatch(
        /recruiter|matchunt|retention|bounty|initial|margin|payout/i,
      );
    }
  });

  it.each(PACKAGE_ORDER)('%s nennt keine interne Zahl im Text', (key) => {
    const p = PACKAGES[key];
    const text = JSON.stringify(clientFacingPackage(p));
    // Die Innenaufteilung darf auch nicht aus den Formulierungen ableitbar sein.
    for (const zahl of [p.recruiterInitialPct, p.matchuntPct, p.researchBountyPct]) {
      if (zahl === 0 || zahl === p.clientFeePct) continue;
      expect(text, `${key}: ${zahl} %`).not.toContain(`${zahl} %`);
    }
  });

  it('zeigt Honorar, Dauer und Meldefrist', () => {
    const k = clientFacingPackage(PACKAGES.continuity_90);
    expect(k.feePercent).toBe(23);
    expect(k.continuityDays).toBe(90);
    expect(k.claimNoticeDays).toBe(14);
  });
});

describe('Geldrechnung', () => {
  it('rechnet in ganzen Cent statt in Fließkomma', () => {
    expect(eurosToCents(1234.565)).toBe(123457);
    expect(eurosToCents('84900,50')).toBe(8490050);
    expect(eurosToCents(null)).toBe(0);
  });

  it('rundet Anteile kaufmännisch', () => {
    // 23 % von 84.900 € = 19.527 € exakt
    expect(eur(applyPercent(eurosToCents(84_900), 23))).toBe(19_527);
    // 26 % von 33.333 € = 8.666,58
    expect(applyPercent(eurosToCents(33_333), 26)).toBe(866658);
  });

  it('verteilt ohne verlorene Cent', () => {
    const teile = splitExact(100_001, [1000, 500, 800]);
    expect(teile.reduce((a, b) => a + b, 0)).toBe(100_001);
  });

  it('die Summe der Anteile ist immer exakt das Kundenhonorar', () => {
    for (const gross of [33_333, 84_900, 47_777, 61_234]) {
      for (const key of PACKAGE_ORDER) {
        const f = computeFees(gross, snapshotForKey(key));
        expect(
          f.recruiterInitialCents + f.recruiterRetentionCents + f.matchuntCents,
          `${key} bei ${gross}`,
        ).toBe(f.clientFeeCents);
      }
    }
  });

  it('formatiert deutsch', () => {
    expect(formatEuros(2_000_000).replace(/ /g, ' ')).toBe('20.000 €');
  });
});

describe('Fristen', () => {
  const start = new Date('2026-03-01T00:00:00Z');

  it('der Anspruchszeitraum läuft ab dem ersten Arbeitstag', () => {
    expect(continuityEndDate(start, snapshotForKey('continuity_90'))!.toISOString().slice(0, 10))
      .toBe('2026-05-30');
    expect(continuityEndDate(start, snapshotForKey('core'))).toBeNull();
  });

  it('die Retention wird erst nach Ablauf der Meldefrist frei, nicht am Tag 90', () => {
    // Wer am Tag 90 ausscheidet, hat danach noch 14 Tage Meldefrist. Würde am
    // Tag 90 ausgezahlt, stünde die Tranche für diesen Fall nicht mehr bereit.
    const frei = retentionReleaseDate(start, snapshotForKey('continuity_90'))!;
    const ende = continuityEndDate(start, snapshotForKey('continuity_90'))!;
    expect(frei.getTime()).toBeGreaterThan(ende.getTime());
    expect(frei.toISOString().slice(0, 10)).toBe('2026-06-13');
  });

  it('Core hat keine Retention und damit kein Freigabedatum', () => {
    expect(retentionReleaseDate(start, snapshotForKey('core'))).toBeNull();
  });

  it('die Meldefrist läuft ab Kenntnis des Ausscheidens', () => {
    expect(claimDeadline(new Date('2026-05-20T00:00:00Z'), snapshotForKey('continuity_90'))
      .toISOString().slice(0, 10)).toBe('2026-06-03');
  });
});

describe('Claim-Kategorien', () => {
  const c90 = snapshotForKey('continuity_90');

  it.each(['no_show', 'candidate_resigned', 'employer_performance', 'employer_fit'])(
    '%s löst einen Fall aus', (grund) => expect(isEligibleClaim(grund, c90)).toBe(true));

  it.each(['redundancy', 'restructuring', 'position_eliminated', 'economic_dismissal',
           'role_materially_changed', 'client_breach', 'payment_default', 'client_non_cooperation'])(
    '%s ist ausgeschlossen', (grund) => expect(isEligibleClaim(grund, c90)).toBe(false));

  it('Core kennt überhaupt keinen gültigen Grund', () => {
    for (const grund of ['no_show', 'candidate_resigned']) {
      expect(isEligibleClaim(grund, snapshotForKey('core'))).toBe(false);
    }
  });

  it('unbekannte Gründe lösen nichts aus', () => {
    expect(isEligibleClaim('irgendwas', c90)).toBe(false);
  });
});

describe('Pricing Snapshot', () => {
  it('friert alle abrechnungsrelevanten Werte ein', () => {
    const s = snapshotOf(PACKAGES.continuity_180);
    expect(s).toMatchObject({
      packageKey: 'continuity_180', packageVersion: 1, clientFeePct: 26,
      continuityDays: 180, recruiterInitialPct: 10, recruiterRetentionPct: 5,
      matchuntPct: 11, researchBountyPct: 11, matchuntOnClaimPct: 5,
      researchMaxActiveDays: 90, claimNoticeDays: 14,
    });
    expect(s.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rechnet aus dem Snapshot, nicht aus der heutigen Definition', () => {
    // Ein alter Auftrag mit 18 % muss weiter mit 18 % rechnen, auch wenn das
    // offizielle Paket längst bei 20 % steht.
    const alt = { ...snapshotForKey('core'), clientFeePct: 18, recruiterInitialPct: 14, matchuntPct: 4 };
    const f = computeFees(100_000, alt);
    expect(eur(f.clientFeeCents)).toBe(18_000);
    expect(eur(f.recruiterInitialCents)).toBe(14_000);
    expect(eur(f.matchuntCents)).toBe(4_000);
  });
});
