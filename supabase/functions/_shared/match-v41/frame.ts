/**
 * Match V4.1 – Stufe 2: Vorauswahl und Rahmen (ohne KI).
 *
 * Grundsätze:
 * - Ausgeschlossen wird nur mit Beleg auf beiden Seiten. Fehlt eine Angabe,
 *   ist sie „unbekannt" und wird zur Klärfrage, nie zum Minus.
 * - Jeder Ausschluss ist für den Headhunter sichtbar und übersteuerbar
 *   (DSGVO Art. 22) – `overridable` ist deshalb immer true.
 * - Nicht verwendet: Alter, Geschlecht, Herkunft, Gesundheit, Familie,
 *   Ist-Gehalt, Wechselbereitschaft, andere Bewerbungen.
 * - Teilzeit/Vollzeit ist nie ein Ausschluss, nur ein Prüfpunkt (§ 7 TzBfG,
 *   mittelbare Benachteiligung).
 */

import type { CandidateProfile, JobProfile, PrivateMatchContext } from './profiles.ts';
import { distanceKm, roughCommuteMinutes } from './geo.ts';
import { noticePeriodToDays } from './rules.ts';

export type FrameStatus = 'ok' | 'check' | 'unknown' | 'exclude';

export interface FrameItem {
  key: 'blocked' | 'work_model' | 'location' | 'visa' | 'language' | 'salary' | 'start' | 'employment';
  status: FrameStatus;
  /** Text für den Headhunter. Enthält nie einen Firmennamen. */
  text: string;
}

export interface FrameResult {
  items: FrameItem[];
  exclusion: { key: FrameItem['key']; text: string; overridable: true } | null;
}

const LEVEL_RANK: Record<string, number> = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6, native: 7 };

/** Firmennamen vergleichbar machen: Rechtsform, Satzzeichen, Groß/klein weg. */
export function companyKey(name: string | null | undefined): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(gmbh|ag|se|kg|kgaa|ohg|ug|mbh|co|inc|ltd|llc|holding|group|gruppe|deutschland|germany)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sameCity(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null;
  const k = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z]+/g, ' ').trim();
  const x = k(a);
  const y = k(b);
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export function evaluateFrame(
  job: JobProfile,
  cand: CandidateProfile,
  priv: PrivateMatchContext,
  nowMs: number,
): FrameResult {
  const items: FrameItem[] = [];
  const add = (item: FrameItem) => items.push(item);

  // Sperrlisten in beide Richtungen: Kandidat sperrt den Arbeitgeber der Stelle, oder
  // der Kunde will niemanden von der aktuellen Firma des Kandidaten. Der Grund ist
  // immer gleich formuliert, damit er keine Firma verrät.
  const sameCompany = (a: string | null | undefined, b: string | null | undefined) => {
    const x = companyKey(a);
    const y = companyKey(b);
    return x.length >= 3 && y.length >= 3 && (x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `));
  };
  const blockedByCandidate = priv.candidate_blocked_companies.some((b) => sameCompany(b, priv.job_company_name));
  const blockedByClient = (priv.job_nogo_companies ?? []).some((n) => (priv.candidate_employers ?? []).slice(0, 1).some((e) => sameCompany(n, e)));
  if (blockedByCandidate || blockedByClient) {
    add({ key: 'blocked', status: 'exclude', text: 'Nicht vorschlagbar: Sperrgrund' });
  }

  // Arbeitsmodell: „hybrid" mit 5 Präsenztagen ist effektiv vor Ort.
  const onsiteDays = job.location.remote === 'onsite' ? (job.location.onsite_days ?? 5)
    : job.location.remote === 'hybrid' ? job.location.onsite_days
    : job.location.remote === 'field' ? null : 0;
  const remoteOnly = cand.logistics.remote_pref === 'remote';
  const citySame = sameCity(cand.logistics.city, job.location.city);
  const wantsThere = cand.logistics.target_locations.some((t) => sameCity(t, job.location.city));
  const canMove = cand.logistics.relocation === true || wantsThere;

  if (remoteOnly && onsiteDays !== null && onsiteDays >= 3) {
    if (citySame === true || canMove) {
      add({ key: 'work_model', status: 'check', text: `Kandidat möchte remote arbeiten, Stelle verlangt ${onsiteDays} Präsenztage` });
    } else {
      add({ key: 'work_model', status: 'exclude', text: `Stelle verlangt ${onsiteDays} Präsenztage, Kandidat arbeitet nur remote` });
    }
  } else if (remoteOnly && onsiteDays !== null && onsiteDays > 0) {
    add({ key: 'work_model', status: 'check', text: `Kandidat möchte remote arbeiten, Stelle hat ${onsiteDays} Präsenztage` });
  } else if (job.location.remote === 'field') {
    add({ key: 'work_model', status: 'check', text: 'Außendienst mit Reisetätigkeit – Reisebereitschaft klären' });
  } else if (cand.logistics.remote_pref === 'hybrid' && onsiteDays !== null && onsiteDays >= 4) {
    add({ key: 'work_model', status: 'check', text: `Wunsch hybrid, Stelle mit ${onsiteDays} Präsenztagen – ansprechen` });
  } else if (cand.logistics.remote_pref && job.location.remote) {
    add({ key: 'work_model', status: 'ok', text: 'Arbeitsmodell passt' });
  } else {
    add({ key: 'work_model', status: 'unknown', text: 'Arbeitsmodell nicht vollständig erfasst' });
  }

  // Ort: Entfernung aus Koordinaten oder Stadttabelle. Bis 30 km passt es; bis 70 km ist es eine
  // Klärfrage, wenn die Fahrzeit über der Angabe des Kandidaten liegt; darüber geht es nur mit
  // Umzug. Ausgeschlossen wird nur mit Beleg auf beiden Seiten: kein Umzug UND mind. 3 Präsenztage.
  // Unbekannter Ort bleibt offen, nie geraten.
  if (job.location.remote === 'remote') {
    add({ key: 'location', status: 'ok', text: 'Remote-Stelle, Ort egal' });
  } else if (citySame === true) {
    add({ key: 'location', status: 'ok', text: 'Gleicher Ort' });
  } else if (canMove) {
    add({ key: 'location', status: 'ok', text: wantsThere ? 'Zielort des Kandidaten' : 'Kandidat ist umzugsbereit' });
  } else if (!remoteOnly) {
    const km = distanceKm(
      { lat: cand.logistics.lat ?? null, lng: cand.logistics.lng ?? null, city: cand.logistics.city },
      { lat: job.location.lat ?? null, lng: job.location.lng ?? null, city: job.location.city },
    );
    const route = `${cand.logistics.city ?? 'Wohnort'} → ${job.location.city ?? 'Arbeitsort'}`;
    const maxMin = cand.logistics.max_commute_min;
    if (km === null) {
      add({ key: 'location', status: 'unknown', text: citySame === false ? `Anderer Ort (${route}) – Pendelweg klären` : 'Ort nicht vollständig erfasst' });
    } else if (km <= 30) {
      add({ key: 'location', status: 'ok', text: `Pendelbar (${route}, ca. ${km} km)` });
    } else if (km <= 70) {
      const mins = roughCommuteMinutes(km);
      if (maxMin && mins > maxMin) add({ key: 'location', status: 'check', text: `${route}: ca. ${km} km (~${mins} Min.), Kandidat max. ${maxMin} Min. – klären` });
      else add({ key: 'location', status: maxMin ? 'ok' : 'check', text: `${route}: ca. ${km} km${maxMin ? '' : ' – Pendelweg klären'}` });
    } else if (cand.logistics.relocation === false && (onsiteDays ?? 0) >= 3) {
      add({ key: 'location', status: 'exclude', text: `Zu weit (${route}, ca. ${km} km), kein Umzug, ${onsiteDays} Präsenztage` });
    } else {
      add({ key: 'location', status: 'check', text: `${route}: ca. ${km} km – Umzug klären` });
    }
  }

  // Visum: Ausschluss nur, wenn die Stelle ausdrücklich kein Sponsoring bietet.
  if (cand.needs_visa === true) {
    if (job.visa_sponsorship === false) add({ key: 'visa', status: 'exclude', text: 'Visum nötig, Stelle bietet kein Sponsoring' });
    else if (job.visa_sponsorship === true) add({ key: 'visa', status: 'ok', text: 'Visum nötig, Sponsoring möglich' });
    else add({ key: 'visa', status: 'check', text: 'Visum nötig, Sponsoring der Stelle unbekannt – beim Kunden klären' });
  }

  // Sprachen: nur GER-Stufen. „Muttersprache" zählt wie C2 und ist nie selbst ein Kriterium.
  for (const need of job.languages) {
    const have = cand.languages.find((l) => l.code === need.code);
    const label = `${need.code.toUpperCase()}${need.min_level ? ` ${need.min_level.toUpperCase()}` : ''}`;
    if (!need.min_level) continue;
    const req = LEVEL_RANK[need.min_level];
    if (cand.languages.length === 0) {
      add({ key: 'language', status: 'unknown', text: `Sprachkenntnisse nicht erfasst (${label} gefordert)` });
      continue;
    }
    if (!have) {
      add({ key: 'language', status: need.confirmed ? 'check' : 'unknown', text: `${label} gefordert, im Profil nicht angegeben` });
      continue;
    }
    if (!have.level) {
      add({ key: 'language', status: 'check', text: `${label} gefordert, Niveau im Profil offen` });
      continue;
    }
    const gap = req - Math.min(LEVEL_RANK[have.level], 6);
    if (gap <= 0) add({ key: 'language', status: 'ok', text: `${label} erfüllt` });
    else if (!need.confirmed) add({ key: 'language', status: 'check', text: `${label} laut Anzeige, Profil ${have.level.toUpperCase()} – Gesprächspunkt` });
    else if (gap >= 2 && need.customer_facing) add({ key: 'language', status: 'exclude', text: `${label} bei Kundenkontakt gefordert, Profil ${have.level.toUpperCase()}` });
    else add({ key: 'language', status: 'check', text: `${label} gefordert, Profil ${have.level.toUpperCase()} – Niveau prüfen` });
  }

  // Gehalt: gleiche Basis vergleichen; die Untergrenze entscheidet, nicht der Wunsch.
  const max = job.salary.max;
  const min = job.salary.min;
  // Tagessatz nie mit Jahresgehalt vergleichen, auch wenn eine Seite ihre Basis nicht angibt.
  const basisMismatch = (job.salary.basis === 'daily_rate') !== (cand.salary.basis === 'daily_rate')
    || (!!job.salary.basis && !!cand.salary.basis && job.salary.basis !== cand.salary.basis);
  const floor = cand.salary.minimum ?? cand.salary.wish;
  if (!max || !floor || basisMismatch) {
    add({ key: 'salary', status: 'unknown', text: basisMismatch ? 'Gehalt auf unterschiedlicher Basis (Fixum/OTE/Tagessatz) – im Gespräch abgleichen' : 'Gehalt nicht vollständig bekannt' });
  } else if (floor > max * 1.1) {
    add({ key: 'salary', status: 'exclude', text: `Untergrenze deutlich über Budget (${Math.round((floor / max - 1) * 100)} % über Maximum)` });
  } else if ((cand.salary.wish ?? floor) > max) {
    add({ key: 'salary', status: 'check', text: 'Wunsch leicht über Budget, Untergrenze im Rahmen – verhandelbar' });
  } else if (min && cand.employment !== 'parttime' && (cand.salary.wish ?? floor) < min * 0.75) {
    add({ key: 'salary', status: 'check', text: 'Wunsch deutlich unter Budget – Ebene/Seniorität prüfen' });
  } else {
    add({ key: 'salary', status: 'ok', text: 'Gehalt im Rahmen' });
  }

  // Start: 3 Monate Kündigungsfrist sind normal; nur bei dringender Besetzung ein Thema.
  const startDays = cand.notice ? noticePeriodToDays(cand.notice, nowMs) : null;
  if (startDays === null) {
    add({ key: 'start', status: 'unknown', text: 'Kündigungsfrist nicht erfasst' });
  } else if (job.urgent_within_days !== null && startDays > job.urgent_within_days + 30) {
    add({ key: 'start', status: 'check', text: 'Kündigungsfrist länger als die dringende Besetzung – Freistellung oder späteren Start klären' });
  } else {
    add({ key: 'start', status: 'ok', text: 'Start passt' });
  }

  // Anstellungsart: nie Ausschluss, nur Prüfpunkt.
  if (job.employment && cand.employment && job.employment !== cand.employment) {
    add({ key: 'employment', status: 'check', text: `Anstellungsart: Kandidat sucht ${label(cand.employment)}, Stelle ist ${label(job.employment)}` });
  }

  const ex = items.find((i) => i.status === 'exclude');
  return { items, exclusion: ex ? { key: ex.key, text: ex.text, overridable: true } : null };
}

function label(e: 'fulltime' | 'parttime' | 'freelance'): string {
  return e === 'fulltime' ? 'Vollzeit' : e === 'parttime' ? 'Teilzeit' : 'freie Mitarbeit';
}
