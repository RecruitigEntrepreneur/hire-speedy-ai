/**
 * Beispielkandidat für den Kunden-Rundgang (Fassung 3, Entscheidung Marko 16.11.2026).
 *
 * Der Rundgang zeigt die EIGENE Stelle des Kunden. Kandidaten, Termine und Angebote gibt es
 * dort beim ersten Besuch noch nicht; deshalb spielt ein Beispielkandidat den Weg bis zur
 * Einstellung durch, gebaut aus den Angaben dieser Stelle: Titel, Ort, Arbeitsmodell,
 * Erfahrungsstufe, Gehaltsband und Muss-Kriterien. Nichts davon wird gespeichert.
 *
 * Hier stehen nur Daten und Regeln, keine Texte: Die Wörter liest die Bühne in der
 * Sprache der Oberfläche (Namespace `clientGuide`, Abschnitt `demo`).
 */

/** Die Felder einer Stelle, die der Rundgang braucht (Tabelle `jobs`). */
export interface TourJobSource {
  id: string;
  title: string | null;
  status: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  employment_type: string | null;
  experience_level: string | null;
  remote_type: string | null;
  must_haves: string[] | null;
}

/** Wo die Stelle steht: live mit Stellenseite, in Prüfung, oder es gibt (noch) keine. */
export type TourJobState = 'live' | 'review' | 'none';
export type TourRemote = 'onsite' | 'hybrid' | 'remote';
export interface Band { min: number; max: number }

/** Ersatzwerte, wenn der Kunde noch keine Stelle hat -- in der Sprache der Oberfläche. */
export interface TourFallback {
  title: string;
  location: string;
  band: Band;
  level: string;
  remote: TourRemote;
  criteria: string[];
}

export interface TourData {
  /** Kennung der echten Stelle; ohne sie läuft alles auf der Beispiel-Bühne. */
  jobId: string | null;
  state: TourJobState;
  /** Es gibt keine echte Stelle: Titel und Angaben kommen aus dem Beispiel (oder der Aufnahme). */
  example: boolean;
  title: string;
  /** Der Titel ohne „(m/w/d)“, so heißt der Beispielkandidat. */
  role: string;
  location: string | null;
  /** Für „Raum …“; leer bei Remote oder unklarer Angabe. */
  region: string | null;
  remote: TourRemote | null;
  contracting: boolean;
  band: Band | null;
  /** Gehaltswunsch des Beispielkandidaten, mitten im Band. */
  wish: Band | null;
  /** Angebot im Beispiel: die Mitte des Bands. */
  offer: number | null;
  /** Erfahrung in Jahren, etwa „3–5“. */
  years: string;
  /** Bis zu zwei Muss-Kriterien der Stelle, auf die sich die Einschätzung bezieht. */
  criteria: string[];
  /** Interview am nächsten Werktag um 14 Uhr. */
  interviewAt: Date;
  /** Erster Arbeitstag: in drei Monaten, zum Monatsersten. */
  startAt: Date;
}

/** Feste Beispielwerte, überall gleich, damit die Bilder zusammenpassen. */
export const DEMO = {
  code: 'PR-3F8A21',
  name: 'Daniel Roth',
  initials: 'DR',
  headhunter: 'Julia Hartmann',
} as const;

/**
 * Feste Kennungen des Beispiels. Der Kandidat beginnt mit 3f8a21, daraus wird überall
 * dasselbe Kürzel PR-3F8A21 (lib/anonymization.ts). Daten dazu: lib/clientDemoData.ts.
 */
export const DEMO_IDS = {
  submission: 'de300000-0000-4000-8000-00000000a001',
  candidate: '3f8a21d0-5b7c-4e2a-9c1d-7a6b5c4d3e2f',
  interview: 'de300000-0000-4000-8000-00000000a002',
  offer: 'de300000-0000-4000-8000-00000000a003',
  contract: 'de300000-0000-4000-8000-00000000a004',
  placement: 'de300000-0000-4000-8000-00000000a005',
  recruiter: 'de300000-0000-4000-8000-00000000a006',
  /** Nur ohne eigene Stelle. */
  job: 'de300000-0000-4000-8000-00000000a007',
  recommendation: 'de300000-0000-4000-8000-00000000a008',
  /** Weitere Kandidaten und Suchende auf der vollen Stellenkarte („Meine Stellen“). */
  candidate2: 'a7c4e2b9-1d3f-4b6a-8e5c-2f9d0b1a3c4e',
  candidate3: 'b5d9f1c3-7e2a-4c8b-9d6f-3a1e5c7b9d2f',
  submission2: 'de300000-0000-4000-8000-00000000a009',
  submission3: 'de300000-0000-4000-8000-00000000a00a',
  recruiter2: 'de300000-0000-4000-8000-00000000a00b',
  recruiter3: 'de300000-0000-4000-8000-00000000a00f',
  /** Nur ohne eigenes Team: die Firma, damit „Team“ das Einladen zeigt. */
  organization: 'de300000-0000-4000-8000-00000000a00c',
  /** Zwei weitere laufende Stellen im Hintergrund von „Meine Stellen“ (Marko 17.11.: „lebhaftes Beispiel“). */
  exampleJob1: 'de300000-0000-4000-8000-00000000a00d',
  exampleJob2: 'de300000-0000-4000-8000-00000000a00e',
} as const;

const GENDER = /\s*\((?:[mwdfx]\s*\/\s*){1,3}[mwdfx]\)|\s*\((?:all genders|alle geschlechter)\)/gi;

/** „Servicetechniker Medizintechnik (m/w/d)“ → „Servicetechniker Medizintechnik“. */
export const roleOf = (title: string) => title.replace(GENDER, '').replace(/\s{2,}/g, ' ').trim() || title.trim();

/** Erfahrungsstufe der Stelle als Jahresspanne. */
export function yearsOf(level: string | null | undefined): string {
  switch ((level ?? '').toLowerCase()) {
    case 'junior': case 'entry': return '1–3';
    case 'mid': case 'mid-level': case 'professional': return '3–5';
    case 'senior': return '5–10';
    case 'lead': case 'expert': case 'principal': case 'executive': return '10+';
    default: return '3–5';
  }
}

/** Erster Teil der Ortsangabe („Stuttgart-Feuerbach, BW“ → „Stuttgart-Feuerbach“); null bei Remote oder sehr langen Angaben. */
export function regionOf(location: string | null | undefined): string | null {
  const first = (location ?? '').split(/,|\s[–-]\s|\(|\//)[0]?.trim() ?? '';
  // „Region Süd“ oder „Raum München“ ergäbe „Raum Region Süd“: dann lieber ohne Ort.
  if (!first || first.length > 30 || /remote/i.test(first) || /^(region|raum|großraum|area)\b/i.test(first)) return null;
  return first;
}

export function remoteOf(value: string | null | undefined): TourRemote | null {
  const v = (value ?? '').toLowerCase();
  if (v === 'onsite' || v === 'on-site' || v === 'office') return 'onsite';
  if (v === 'hybrid') return 'hybrid';
  if (v === 'remote' || v === 'fully_remote') return 'remote';
  return null;
}

const round1000 = (n: number) => Math.round(n / 1000) * 1000;

/** Gehaltsband aus der Stelle; mit nur einer Grenze wird die andere geschätzt. */
export function bandOf(min: number | null | undefined, max: number | null | undefined): Band | null {
  const lo = min && min > 0 ? min : null;
  const hi = max && max > 0 ? max : null;
  if (lo && hi) return hi >= lo ? { min: lo, max: hi } : { min: hi, max: lo };
  if (hi) return { min: round1000(hi * 0.85), max: hi };
  if (lo) return { min: lo, max: round1000(lo * 1.15) };
  return null;
}

/** Wunsch im mittleren Teil des Bands: 48.000–56.000 € → 50.000–54.000 €. */
export const wishOf = (band: Band): Band => ({
  min: round1000(band.min + (band.max - band.min) * 0.25),
  max: round1000(band.min + (band.max - band.min) * 0.75),
});

/** Angebot in der Mitte des Bands. */
export const offerOf = (band: Band) => round1000((band.min + band.max) / 2);

/** Bis zu zwei Muss-Kriterien, sehr lange Sätze gekürzt. */
export function criteriaOf(list: string[] | null | undefined): string[] {
  return (list ?? [])
    .map((c) => String(c ?? '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((c) => (c.length > 60 ? `${c.slice(0, 58).trimEnd()}…` : c));
}

/** Contracting erkennt die App an `employment_type = 'freelance'`. */
export const isContracting = (type: string | null | undefined) => ['freelance', 'contracting', 'contract'].includes((type ?? '').toLowerCase());

export function stateOf(status: string | null | undefined): TourJobState {
  if (status === 'published') return 'live';
  if (status === 'pending_approval' || status === 'pending_client_approval') return 'review';
  return 'none';
}

/** Nächster Werktag (Mo–Fr) nach `from`, zur vollen Stunde. */
export function nextWorkday(from: Date, hour: number): Date {
  const d = new Date(from);
  do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** In drei Monaten, zum nächsten Monatsersten (16.11. → 01.03.). */
export function startDateOf(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth() + 3, from.getDate());
  return new Date(d.getFullYear(), d.getMonth() + (d.getDate() > 1 ? 1 : 0), 1);
}

/**
 * Alles, was die Bühne zeigt. Mit echter Stelle kommen die Angaben aus ihr; ohne
 * Stelle aus dem Beispiel, der Titel aber, wenn bekannt, aus der laufenden Aufnahme
 * (Wartezustand bis zur Gegenzeichnung).
 */
export function buildTourData(job: TourJobSource | null, fallback: TourFallback, opts: { waitingTitle?: string | null; now?: Date } = {}): TourData {
  const now = opts.now ?? new Date();
  const example = !job;
  const title = job?.title?.trim() || opts.waitingTitle?.trim() || fallback.title;
  const contracting = job ? isContracting(job.employment_type) : false;
  const band = contracting ? null : job ? bandOf(job.salary_min, job.salary_max) : fallback.band;
  const location = job ? job.location?.trim() || null : fallback.location;
  return {
    jobId: job?.id ?? null,
    state: job ? stateOf(job.status) : 'none',
    example,
    title,
    role: roleOf(title),
    location,
    region: regionOf(location),
    remote: job ? remoteOf(job.remote_type) : fallback.remote,
    contracting,
    band,
    wish: band ? wishOf(band) : null,
    offer: band ? offerOf(band) : null,
    years: yearsOf(job ? job.experience_level : fallback.level),
    criteria: job ? criteriaOf(job.must_haves) : criteriaOf(fallback.criteria),
    interviewAt: nextWorkday(now, 14),
    startAt: startDateOf(now),
  };
}
