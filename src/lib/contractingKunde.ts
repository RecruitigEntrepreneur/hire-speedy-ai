/**
 * Contracting aus Sicht des Kunden (Etappe 1, Entscheidung 04.11.2026).
 *
 * Der Kunde sieht nie den Satz oder Wunsch des Spezialisten, sondern nur seinen
 * Preis mit Matchunt (Satz ÷ 0,78). Solange es dafür kein Feld gibt (Etappe 2),
 * steht an der Stelle des Gehaltswunschs dieser Satz. Sonst läse der Kunde
 * „Wunschgehalt um 780 € im Jahr“ -- falsch und mit dem Satz des Spezialisten.
 */
export const TAGESSATZ_ABSTIMMUNG = 'stimmt Matchunt vor dem Einsatz mit Ihnen ab';

/** Die Geld-Angabe im Kandidatenprofil des Kunden: Gehaltswunsch, bei Contracting der Hinweis. */
export function kundenGeld(employmentType: string | null | undefined, gehalt: string | null | undefined): { label: string; value: string | null | undefined } {
  return employmentType === 'freelance'
    ? { label: 'Tagessatz', value: TAGESSATZ_ABSTIMMUNG }
    : { label: 'Gehaltswunsch', value: gehalt };
}
