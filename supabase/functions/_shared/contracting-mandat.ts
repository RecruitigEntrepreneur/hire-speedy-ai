/**
 * Auftrag und Rahmenvertrag nach dem Vertragswerk v4 -- EINE Regel für
 * intake-submit (welcher Auftrag entsteht) und docusign-send (welcher Vertrag
 * in den Umschlag gehört).
 *
 * Entscheidungen 25.09.2026:
 *  - Ein Rahmenvertrag für Festanstellung (Modul A) und Contracting (Modul B),
 *    ab Fassung 2 beide ab Vertragsschluss gültig. Fassung 1 kennt nur
 *    Festanstellung.
 *  - Wer mit Fassung 1 zum ersten Mal Contracting beauftragt, unterschreibt
 *    Fassung 2 einmal (Ablösung über supersedes_id).
 *  - Contracting ist ein Auftrag ohne Paket: Tagessatz all-in, 22 % Marge,
 *    davon 50 % an den Recruiter (Innenseite, nie für den Kunden).
 *  - Beginnt ein Kunde mit Contracting, gilt für Festanstellung Core, bis er
 *    bei seiner ersten Festanstellung ein Paket wählt (§ 8 Abs. 2) -- ohne
 *    neue Unterschrift.
 */
import { ANTEIL_MATCHUNT, ANTEIL_SPEZIALIST, CONTRACTING_FASSUNG } from './contracting-konditionen.ts';

/** Ab dieser Fassung regelt der Rahmenvertrag auch Contracting. */
export const FASSUNG_MIT_CONTRACTING = 2;

/** INNENSEITE: Anteil des Recruiters an der Marge, in Prozent der Marge. */
export const RECRUITER_ANTEIL_AN_MARGE = 50;

/** Die Spalten eines Contracting-Auftrags in commercial_mandates. */
export const CONTRACTING_AUFTRAG = {
  fee_basis: 'day_rate_all_in',
  fee_percentage: ANTEIL_MATCHUNT,
  recruiter_fee_percentage: (ANTEIL_MATCHUNT * RECRUITER_ANTEIL_AN_MARGE) / 100,
  payment_terms_days: 14,
} as const;

type Json = Record<string, any>;

const zahl = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Der Preis-Snapshot eines Contracting-Auftrags. Abgerechnet wird hieraus. */
export function contractingPreisSnapshot(freelance: Json | null | undefined, jetzt: string) {
  const f = freelance ?? {};
  return {
    model: 'contracting',
    fassung: CONTRACTING_FASSUNG,
    marginPct: ANTEIL_MATCHUNT,
    specialistPct: ANTEIL_SPEZIALIST,
    recruiterShareOfMarginPct: RECRUITER_ANTEIL_AN_MARGE,
    dayRateMin: zahl(f.dayRateMin),
    dayRateMax: zahl(f.dayRateMax),
    paymentTermsDays: CONTRACTING_AUFTRAG.payment_terms_days,
    capturedAt: jetzt,
  };
}

/** Was der Kunde für die Position angegeben hat -- für Auftragsbestätigung und Datenblatt. */
export function contractingPosition(draft: Json) {
  const built = (draft.built ?? {}) as Json;
  const f = (draft.freelance ?? {}) as Json;
  return {
    title: built.title ?? draft.title ?? null,
    location: built.location ?? null,
    remote_type: built.remote_type ?? null,
    employment_type: 'freelance',
    seniority: built.experience_level ?? null,
    day_rate_min: zahl(f.dayRateMin),
    day_rate_max: zahl(f.dayRateMax),
    duration_months: zahl(f.durationMonths),
    days_per_week: zahl(f.utilizationDaysPerWeek),
    extension_possible: typeof f.extensionPossible === 'boolean' ? f.extensionPossible : null,
  };
}

export type Vertragsart = 'full-time' | 'freelance';

/** Die Felder eines Rahmenvertrags (client_framework_agreements), die hier zählen. */
interface Rahmen {
  status?: unknown;
  template_version?: unknown;
  package_key?: unknown;
  pricing_snapshot?: unknown;
}

const fassung = (rv: Rahmen) => Number(rv.template_version ?? 1) || 1;

/**
 * Läuft die Position unter einem bestehenden, WIRKSAMEN Rahmenvertrag -- also
 * ohne neue Unterschrift?
 *
 * Festanstellung: ab Fassung 2 immer (fehlt das Paket, wählt der Kunde es jetzt,
 * § 8 Abs. 2); unter Fassung 1 nur, wenn der Vertrag seine Kondition trägt.
 * Contracting: nur ab Fassung 2.
 */
export function unterRahmenvertrag(rv: Rahmen | null | undefined, art: Vertragsart): boolean {
  if (!rv || rv.status !== 'active') return false;
  if (fassung(rv) >= FASSUNG_MIT_CONTRACTING) return true;
  return art === 'full-time' && Boolean(rv.package_key && rv.pricing_snapshot);
}

/**
 * Welche Auftragsvorlage passt: der Einzelauftrag v1 gehört zu Rahmenverträgen
 * der Fassung 1 (er verweist auf deren Paragrafen), die Auftragsbestätigung v2
 * zu allem anderen.
 */
export function auftragsvorlageFassung(rv: Rahmen | null | undefined, art: Vertragsart): 1 | 2 {
  if (art === 'full-time' && rv && rv.status === 'active' && fassung(rv) < FASSUNG_MIT_CONTRACTING) return 1;
  return 2;
}

export type RahmenSchritt =
  | { art: 'neu' }                 // keiner da: aus der aktiven Vorlage anlegen
  | { art: 'verwenden' }           // passt: laufenden oder wirksamen Vertrag nehmen
  | { art: 'abloesen' }            // Fassung 1 wirksam, Contracting: Fassung 2 mit supersedes_id
  | { art: 'verwerfen_und_neu' }   // Fassung 1 noch nicht versandt: verwerfen, Fassung 2 anlegen
  | { art: 'konflikt'; grund: string };

/** Was docusign-send mit dem gefundenen Rahmenvertrag tut. */
export function rahmenSchritt(rv: Rahmen | null | undefined, art: Vertragsart): RahmenSchritt {
  if (!rv) return { art: 'neu' };
  if (fassung(rv) >= FASSUNG_MIT_CONTRACTING) return { art: 'verwenden' };
  // Fassung 1. Noch nicht versandt: durch Fassung 2 ersetzen -- Neukunden
  // bekommen ab dem 25.09.2026 nur noch das Vertragswerk v4.
  if (rv.status === 'draft' || rv.status === 'pending_release') return { art: 'verwerfen_und_neu' };
  // Wirksam oder unterwegs: Festanstellung laeuft darunter weiter (§ 21 Abs. 8),
  // Contracting braucht Fassung 2.
  if (art === 'full-time') return { art: 'verwenden' };
  if (rv.status === 'active') return { art: 'abloesen' };
  return {
    art: 'konflikt',
    grund: 'Ein Rahmenvertrag der Fassung 1 liegt gerade zur Unterschrift. Er regelt kein Contracting; '
      + 'bitte zuerst abschließen oder verwerfen.',
  };
}
