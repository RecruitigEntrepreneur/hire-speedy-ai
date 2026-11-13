// Lebenslauf eines Kandidaten: was als Lebenslauf zählt, wie alt er ist, ob
// Akte und Lebenslauf zusammenpassen, und Fundstellen als Belege.
//
// Regeln (Entscheidung 12.10.2026):
// - Nur eine hochgeladene Datei (PDF oder Word) zählt. Kein Link, kein
//   eingefügter Text. Die Datenbank prüft das beim Einreichen ebenfalls
//   (require_candidate_cv, Hint 'cv_missing').
// - Älter als 6 Monate: Rückfrage „noch aktuell?“, sperrt nicht.
// - Abweichungen zwischen Akte und Lebenslauf sind nur ein Hinweis.
// - Belege sind Fundstellen im Lebenslauf, keine Bewertung. Ob ein
//   Muss-Kriterium erfüllt ist, schätzt weiter nur der Headhunter ein.

import type { DossierForm } from './candidateDossier';
import { CvExtraction, dossierFromCv } from './cvImport';
import i18n from '@/i18n';

// Meldungen beim Aufruf übersetzt (Namespace candidateLogic).
const tl = (key: string, options?: Record<string, unknown>): string => i18n.t(`candidateLogic:${key}`, options) as string;

export const CV_FILE_RE = /\.(pdf|docx?)$/i;
export const CV_ACCEPT = '.pdf,.doc,.docx';
export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const CV_STALE_MONTHS = 6;
/** Meldung ohne Lebenslauf, in der Sprache der Oberfläche. */
export const cvMissingMessage = () => tl('cv.missing');

export const isCvFileName = (name: string | null | undefined) => !!name && CV_FILE_RE.test(name.trim());

export function cvFileProblem(file: { name: string; size: number }): string | null {
  if (!isCvFileName(file.name)) return tl('cv.fileType');
  if (file.size > CV_MAX_BYTES) return tl('cv.fileSize');
  return null;
}

/** Was im Lebenslauf stand, als er hochgeladen wurde (candidate_documents.extracted). */
export interface CvSnapshot {
  job_title: string | null;
  company: string | null;
  experience_years: number | null;
  degrees: string[];
}

export interface CurrentCv {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
  confirmed_current_at: string | null;
  extracted: CvSnapshot | null;
}

export function snapshotFromCv(cv: CvExtraction): CvSnapshot {
  const { form } = dossierFromCv(cv);
  return {
    job_title: form.job_title.trim() || null,
    company: form.company.trim() || null,
    experience_years: typeof form.experience_years === 'number' ? form.experience_years : null,
    degrees: [...new Set(cv.educations.map((e) => e.degree.trim()).filter(Boolean))],
  };
}

export function parseSnapshot(raw: unknown): CvSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    job_title: str(r.job_title),
    company: str(r.company),
    experience_years: typeof r.experience_years === 'number' ? r.experience_years : null,
    degrees: Array.isArray(r.degrees) ? r.degrees.filter((d): d is string => typeof d === 'string' && !!d.trim()) : [],
  };
}

// ---------------------------------------------------------------------------
// Aktualität
// ---------------------------------------------------------------------------

/** Stand des Lebenslaufs: hochgeladen oder zuletzt als „noch aktuell“ bestätigt. */
export function cvStandDate(cv: Pick<CurrentCv, 'created_at' | 'confirmed_current_at'>): Date {
  const uploaded = new Date(cv.created_at);
  const confirmed = cv.confirmed_current_at ? new Date(cv.confirmed_current_at) : null;
  return confirmed && confirmed > uploaded ? confirmed : uploaded;
}

/** Volle Monate zwischen zwei Daten. */
export function fullMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

export function cvAgeMonths(cv: Pick<CurrentCv, 'created_at' | 'confirmed_current_at'>, today: Date = new Date()): number {
  return fullMonthsBetween(cvStandDate(cv), today);
}

export function isCvStale(cv: Pick<CurrentCv, 'created_at' | 'confirmed_current_at'>, today: Date = new Date()): boolean {
  return cvAgeMonths(cv, today) >= CV_STALE_MONTHS;
}

export const formatCvDate = (d: Date | string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function cvAgeLabel(months: number): string {
  if (months < 1) return 'weniger als einen Monat alt';
  if (months === 1) return '1 Monat alt';
  return `${months} Monate alt`;
}

// ---------------------------------------------------------------------------
// Stimmigkeit Akte ↔ Lebenslauf (nur Hinweis)
// ---------------------------------------------------------------------------

export interface CvMismatch {
  key: 'position' | 'arbeitgeber' | 'jahre' | 'abschluss';
  label: string;
  akte: string;
  cv: string;
}

const LEGAL_FORMS = /\b(gmbh|mbh|ag|se|kg|kgaa|co|ohg|ug|haftungsbeschrankt|ltd|inc|llc|plc|sa|bv|nv|ev|holding|group|gruppe)\b/g;

export const normText = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const normCompany = (s: string) => normText(s).replace(LEGAL_FORMS, ' ').replace(/\s+/g, ' ').trim();

function similar(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const ta = new Set(a.split(' ').filter((t) => t.length > 2));
  const tb = new Set(b.split(' ').filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return false;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / Math.min(ta.size, tb.size) >= 0.5;
}

/**
 * Widersprüche zwischen Akte und dem Lebenslauf-Abdruck. Nur wo beide Seiten
 * etwas sagen; fehlende Angaben sind kein Widerspruch.
 */
export function compareCvWithDossier(
  snap: CvSnapshot | null,
  f: Pick<DossierForm, 'job_title' | 'company' | 'experience_years'>,
  akteDegrees: string[],
  cvDate: Date,
  today: Date = new Date(),
): CvMismatch[] {
  if (!snap) return [];
  const out: CvMismatch[] = [];
  if (snap.job_title && f.job_title.trim() && !similar(normText(snap.job_title), normText(f.job_title))) {
    out.push({ key: 'position', label: 'Position', akte: f.job_title.trim(), cv: snap.job_title });
  }
  if (snap.company && f.company.trim() && !similar(normCompany(snap.company), normCompany(f.company))) {
    out.push({ key: 'arbeitgeber', label: 'Arbeitgeber', akte: f.company.trim(), cv: snap.company });
  }
  if (snap.experience_years != null && f.experience_years != null) {
    // Seit dem Lebenslauf sind Jahre dazugekommen; eine Toleranz von einem Jahr
    const since = Math.floor(fullMonthsBetween(cvDate, today) / 12);
    if (f.experience_years < snap.experience_years - 1 || f.experience_years > snap.experience_years + since + 1) {
      out.push({ key: 'jahre', label: 'Berufsjahre', akte: `${f.experience_years} Jahre`, cv: `${snap.experience_years} Jahre` });
    }
  }
  const akte = akteDegrees.map((d) => d.trim()).filter(Boolean);
  if (snap.degrees.length && akte.length && !snap.degrees.some((d) => akte.some((a) => similar(normText(d), normText(a))))) {
    out.push({ key: 'abschluss', label: 'Abschluss', akte: akte.join(', '), cv: snap.degrees.join(', ') });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Belege: Fundstellen im Lebenslauf zu einem Muss-Kriterium
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'und', 'oder', 'mit', 'ohne', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'im', 'in', 'am', 'an',
  'auf', 'aus', 'bei', 'fur', 'von', 'vom', 'zum', 'zur', 'als', 'sowie', 'bzw', 'idealerweise', 'mindestens', 'mind', 'min',
  'jahre', 'jahren', 'jahr', 'erfahrung', 'erfahrungen', 'berufserfahrung', 'kenntnisse', 'kenntnis', 'gute', 'guter', 'gutes',
  'sehr', 'sicher', 'sicherer', 'sichere', 'umgang', 'bereich', 'bereichen', 'abgeschlossene', 'abgeschlossenes', 'vergleichbare',
  'vergleichbar', 'qualifikation', 'ausbildung', 'fundierte', 'fundiertes', 'mehrjahrige', 'mehrjahriger', 'nachweisbare', 'wort',
  'schrift', 'fliessend', 'verhandlungssicher', 'the', 'and', 'with', 'years', 'experience', 'of', 'in', 'least',
]);

function keywords(criterion: string): string[] {
  return [...new Set(normText(criterion).split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOPWORDS.has(t)))];
}

const CONTACT_LIKE = /@|https?:|www\.|(\+?\d[\d\s/-]{6,}\d)/i;

/** Ersetzt Arbeitgebernamen, damit der Beleg anonym bleibt (geht an den Kunden). */
export function redactCompanies(text: string, companies: string[]): string {
  let out = text;
  for (const c of companies.map((x) => x.trim()).filter((x) => x.length >= 3).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'früherer Arbeitgeber');
  }
  return out;
}

/**
 * Beste Fundstelle im Lebenslauf-Text zu einem Kriterium, ohne Kontaktdaten
 * und mit verdeckten Arbeitgebern. Null, wenn nichts passt.
 */
export function evidenceFromCv(criterion: string, rawText: string | null | undefined, companies: string[] = []): string | null {
  if (!rawText?.trim()) return null;
  const keys = keywords(criterion);
  if (!keys.length) return null;
  const stems = keys.map((k) => k.slice(0, Math.max(4, k.length - 2)));
  const needed = Math.min(2, keys.length);
  const lines = rawText
    .split(/\n+|(?<=[.;•·])\s+/)
    .map((l) => l.replace(/^[\s•·\-–*]+/, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 15 && l.length <= 400 && !CONTACT_LIKE.test(l));
  let best: { line: string; score: number } | null = null;
  for (const line of lines) {
    const n = normText(line);
    const score = stems.filter((s) => n.includes(s)).length;
    if (score >= needed && (!best || score > best.score || (score === best.score && line.length < best.line.length))) best = { line, score };
  }
  if (!best) return null;
  const text = redactCompanies(best.line, companies);
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()} …` : text;
}

// ---------------------------------------------------------------------------
// Sonstiges
// ---------------------------------------------------------------------------

/** Pfad im Speicher cv-documents aus der gespeicherten Adresse. */
export function cvStoragePath(fileUrl: string): string | null {
  const part = fileUrl.split('/cv-documents/')[1];
  return part ? decodeURIComponent(part.split('?')[0]) : null;
}

/** Verständliche Meldung für Fehler beim Einreichen (Regeln aus der Datenbank). */
export function submissionErrorText(error: unknown, fallback?: string): string {
  const e = error as { message?: string; hint?: string; code?: string } | null;
  if (e?.hint === 'cv_missing') return cvMissingMessage();
  if (e?.code === 'P0001' && e.message) return e.message;
  return fallback ?? tl('cv.submitFailed');
}
