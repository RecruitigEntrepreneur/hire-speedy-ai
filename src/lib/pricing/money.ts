/**
 * Geldrechnung in ganzen Cent.
 *
 * Warum nicht `number` mit Euro-Beträgen: 0.1 + 0.2 ergibt in IEEE-754
 * 0.30000000000000004, und 23 % von 84.900 € landet über mehrere Rechenschritte
 * zuverlässig neben dem Betrag, der später auf einer Rechnung steht. Bei
 * Honoraren im fünfstelligen Bereich, die zwischen drei Parteien aufgeteilt
 * werden, ist das kein akademisches Problem.
 *
 * Deshalb: alles ist ein `Cents` — eine ganze Zahl. Prozentsätze werden als
 * Basispunkte (1 % = 100 bp) geführt, damit auch 23,5 % exakt darstellbar
 * bleiben, falls je ein Paket mit Nachkommastelle entsteht.
 *
 * Bewusst ohne Bibliothek: der benötigte Ausschnitt sind vier Funktionen, und
 * eine Abhängigkeit weniger im Bundle der Kundenseite ist mehr wert als die
 * Allgemeingültigkeit von decimal.js.
 */

/** Ganze Cent. Niemals gebrochen. */
export type Cents = number;

/** Prozent in Basispunkten: 20 % = 2000 bp. */
export type BasisPoints = number;

export const pctToBasisPoints = (pct: number): BasisPoints => Math.round(pct * 100);

/** Euro-Betrag (wie in jobs.salary_min) in Cent. */
export function eurosToCents(euros: number | string | null | undefined): Cents {
  if (euros === null || euros === undefined || euros === '') return 0;
  const value = typeof euros === 'string' ? Number(euros.replace(',', '.')) : euros;
  if (!Number.isFinite(value)) return 0;
  // Der Umweg über den gerundeten String vermeidet, dass 1234.565 als
  // 1234.5649999 ankommt und auf 123456 statt 123457 gerundet wird.
  return Math.round(Number(value.toFixed(2)) * 100);
}

export const centsToEuros = (cents: Cents): number => cents / 100;

/**
 * Anteil eines Betrags in Basispunkten, kaufmännisch gerundet.
 *
 * Math.round rundet bei negativen Werten zur Null hin (-0.5 -> -0). Honorare
 * sind nie negativ, aber die Funktion soll sich nicht überraschend verhalten,
 * falls sie je für eine Gutschrift benutzt wird.
 */
export function applyBasisPoints(amount: Cents, bp: BasisPoints): Cents {
  const raw = (amount * bp) / 10_000;
  return raw >= 0 ? Math.round(raw) : -Math.round(-raw);
}

/** Anteil in ganzen Prozent — die übliche Form in diesem Projekt. */
export const applyPercent = (amount: Cents, pct: number): Cents =>
  applyBasisPoints(amount, pctToBasisPoints(pct));

/** Deutsche Darstellung: 20.000 €. */
export function formatEuros(cents: Cents, opts: { decimals?: boolean } = {}): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(centsToEuros(cents));
}

/**
 * Verteilt einen Betrag so auf Anteile, dass die Summe exakt aufgeht.
 *
 * Einzeln gerundete Anteile ergeben in Summe fast nie den Ausgangsbetrag —
 * bei drei Parteien fehlt oder entsteht regelmäßig ein Cent. Der bleibt hier
 * nicht liegen: die Reste werden nach der größten Nachkommastelle vergeben
 * (Hare-Niemeyer). Der Cent geht also an den, dem er rechnerisch am nächsten
 * zusteht, und nicht an den, der zufällig zuerst in der Liste steht.
 */
export function splitExact(total: Cents, weights: BasisPoints[]): Cents[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const floored = exact.map((v) => Math.floor(v));
  let rest = total - floored.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const out = [...floored];
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k].i] += 1;
  return out;
}
