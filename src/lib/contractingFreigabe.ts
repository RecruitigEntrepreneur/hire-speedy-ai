/**
 * Freigabe einer Contracting-Stelle (Variante C, Entscheidung 29.09.2026).
 *
 * Befund (Luca Bartosch, Kanna Medics): Der Freigabedialog kannte nur
 * Festanstellung. Eine Contracting-Stelle zeigte Gehalt, "Gesamtgebühr % vom
 * Zieljahresgehalt" und Schieberegler -- und eine Stelle, deren Auftrag noch
 * über den alten Festanstellungs-Weg abgeschlossen war, ging ohne Hinweis live.
 *
 * Der Dialog zeigt deshalb nebeneinander, was der Kunde bestätigt hat und was
 * Recruiter sehen, und warnt, wenn Stelle und Auftrag verschiedene Modelle sind.
 */
import { CONTRACTING_AUFTRAG, RECRUITER_ANTEIL_AN_MARGE } from '../../supabase/functions/_shared/contracting-mandat.ts';
import { ANTEIL_SPEZIALIST, spezialistenTagessatz } from '../../supabase/functions/_shared/contracting-konditionen.ts';

export { CONTRACTING_AUFTRAG, RECRUITER_ANTEIL_AN_MARGE };

type Json = Record<string, any>;
export type Modell = 'contracting' | 'festanstellung';

export const modellDerStelle = (employmentType: string | null | undefined): Modell =>
  employmentType === 'freelance' ? 'contracting' : 'festanstellung';

/** Nach welchem Modell der Auftrag abrechnet; null ohne Auftrag. */
export const modellDesAuftrags = (m: Json | null | undefined): Modell | null =>
  !m ? null : m.fee_basis === 'day_rate_all_in' ? 'contracting' : 'festanstellung';

const zahl = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const prozent = (v: unknown) => `${Number(v ?? 0).toLocaleString('de-DE')} %`;

/** Warnung, wenn Stelle und Auftrag verschiedene Modelle sind; sonst null. */
export function vertragsabweichung(
  employmentType: string | null | undefined,
  m: Json | null | undefined,
): { titel: string; text: string } | null {
  const auftrag = modellDesAuftrags(m);
  if (!auftrag || auftrag === modellDerStelle(employmentType)) return null;
  const nr = m!.mandate_number ?? 'ohne Nummer';
  return auftrag === 'festanstellung'
    ? {
        titel: 'Contracting-Stelle mit Festanstellungs-Auftrag',
        text: `Auftrag ${nr} rechnet ${prozent(m!.fee_percentage)} vom Jahresgehalt ab, die Stelle ist aber Contracting. Vor der Freigabe den Vertrag prüfen.`,
      }
    : {
        titel: 'Festanstellung mit Contracting-Auftrag',
        text: `Auftrag ${nr} rechnet nach Einsatztagen ab, die Stelle ist aber eine Festanstellung. Vor der Freigabe den Vertrag prüfen.`,
      };
}

/** Geordnete Spanne aus zwei Beträgen, oder null ohne Angabe. */
export function spanne(min: unknown, max: unknown): [number, number] | null {
  const von = zahl(min);
  const bis = zahl(max);
  if (!von && !bis) return null;
  return [Math.min(von ?? bis!, bis ?? von!), Math.max(von ?? bis!, bis ?? von!)];
}

const betrag = (n: number) => Math.round(n).toLocaleString('de-DE');

export const euroSpanne = ([von, bis]: [number, number]) =>
  (Math.round(von) === Math.round(bis) ? `${betrag(von)} €` : `${betrag(von)}–${betrag(bis)} €`);

/**
 * Das Budget, das der Kunde bestätigt hat: aus dem Preis-Snapshot des Auftrags,
 * ohne Auftrag aus der Stelle. Steht im Snapshot keins, hat der Kunde ohne
 * Budget bestätigt -- dann auch keins erfinden.
 */
export function kundenBudget(m: Json | null | undefined, job: Json): [number, number] | null {
  const snap = m?.pricing_snapshot as Json | null | undefined;
  if (snap && ('dayRateMin' in snap || 'dayRateMax' in snap)) return spanne(snap.dayRateMin, snap.dayRateMax);
  return spanne(job.day_rate_min, job.day_rate_max);
}

/**
 * Der Tagessatz, den Recruiter sehen: der Anteil des Spezialisten, abgerundet
 * auf volle 10 € -- dieselbe Rechnung wie recruiter_jobs_view (20260929100000),
 * mit dem Anteil aus dem Auftrag, sonst der geltenden Kondition.
 */
export function recruiterTagessatz(budget: [number, number] | null, m: Json | null | undefined): [number, number] | null {
  if (!budget) return null;
  const anteil = m?.fee_basis === 'day_rate_all_in' ? zahl(m?.pricing_snapshot?.specialistPct) ?? ANTEIL_SPEZIALIST : ANTEIL_SPEZIALIST;
  return [spezialistenTagessatz(budget[0], anteil), spezialistenTagessatz(budget[1], anteil)];
}

/** Was der Recruiter je Einsatztag verdient: sein Anteil vom Tagessatz. */
export function recruiterJeTag(tagessatz: [number, number] | null, recruiterProzent: unknown): string | null {
  const p = zahl(recruiterProzent);
  if (!tagessatz || !p) return null;
  return euroSpanne([(tagessatz[0] * p) / 100, (tagessatz[1] * p) / 100]);
}

/** "3 Tage/Woche · 12 Monate · Verlängerung möglich" -- nur was bekannt ist. */
export function einsatzZeile(job: Json): string | null {
  const teile = [
    zahl(job.utilization_days_per_week) ? `${zahl(job.utilization_days_per_week)} Tage/Woche` : null,
    zahl(job.contract_duration_months) ? `${zahl(job.contract_duration_months)} Monate` : null,
    job.extension_possible === true ? 'Verlängerung möglich' : null,
  ].filter(Boolean);
  return teile.length ? teile.join(' · ') : null;
}

export const RAHMEN_STATUS: Record<string, string> = {
  draft: 'Entwurf',
  pending_release: 'wartet auf Freigabe',
  sent: 'zur Unterschrift versandt',
  customer_signed: 'vom Kunden unterschrieben',
  active: 'wirksam',
  declined: 'abgelehnt',
  expired: 'abgelaufen',
  voided: 'aufgehoben',
  superseded: 'abgelöst',
  terminated: 'gekündigt',
};
