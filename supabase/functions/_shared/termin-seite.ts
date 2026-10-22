// Terminseite des Headhunters (21.10.2026): reine Funktionen ohne Datenbank.
//
// Freie Zeiten = Buchungszeiten des Headhunters minus belegte Zeiten aus seinem
// Outlook minus schon gebuchte Erstgespräche (mit Puffer, Vorlauf, Feiertagen).
// Dazu die Prüfung der Buchungsangaben und der anonyme Steckbrief der Stelle.
import {
  DEFAULT_INTERVIEW_HOURS, isSlotStillFree, normalizeRules, scheduleSlots,
  type Interval, type InterviewHoursRules, type ScheduleParticipant,
} from './interview-availability.ts';
import { berlinDateKey } from './interview-time.ts';
import { anonymFunde, ersetzeFunde, kundenBegriffe, regionAus } from './linkedin-anonym.ts';

/** Vorschlag für Headhunter: Mo–Fr vormittags und nachmittags, 4 Std Vorlauf, 10 Min Puffer. */
export const TERMIN_STANDARD: InterviewHoursRules = {
  ...DEFAULT_INTERVIEW_HOURS,
  bufferMinutes: 10,
  minNoticeHours: 4,
  horizonDays: 14,
};

export type Gespraechsart = 'teams' | 'phone';

export interface TerminEinstellungen {
  rules: InterviewHoursRules;
  dauer: number;
  arten: Gespraechsart[];
}

export function einstellungenAus(row: { rules?: unknown; duration_minutes?: number | null; allow_teams?: boolean | null; allow_phone?: boolean | null }): TerminEinstellungen {
  const roh = row.rules && typeof row.rules === 'object' && Object.keys(row.rules as object).length ? row.rules : TERMIN_STANDARD;
  const arten: Gespraechsart[] = [];
  if (row.allow_teams !== false) arten.push('teams');
  if (row.allow_phone !== false) arten.push('phone');
  return { rules: normalizeRules(roh), dauer: [15, 30, 45, 60].includes(Number(row.duration_minutes)) ? Number(row.duration_minutes) : 15, arten: arten.length ? arten : ['teams'] };
}

/** Kurze Gespräche im 15-Minuten-Raster, längere halbstündlich. */
export const rasterFuer = (dauer: number) => (dauer <= 30 ? 15 : 30);

function anfrage(e: TerminEinstellungen, nowMs: number, busy: Interval[] | null, gebucht: Interval[], fromMs?: number, toMs?: number) {
  const person: ScheduleParticipant = { key: 'hh', name: 'Headhunter', required: true, busy, booked: gebucht };
  return {
    rules: e.rules,
    durationMinutes: e.dauer,
    fromMs: fromMs ?? nowMs,
    toMs: toMs ?? nowMs + e.rules.horizonDays * 86400000,
    nowMs,
    participants: [person],
    stepMinutes: rasterFuer(e.dauer),
  };
}

/**
 * Freie Startzeiten (ISO). Ohne sichtbaren Kalender (busy = null) gibt es
 * keine: die Seite zeigt nur Zeiten, die wirklich frei sind.
 */
export function freieZeiten(e: TerminEinstellungen, nowMs: number, busy: Interval[] | null, gebucht: Interval[]): string[] {
  if (busy === null) return [];
  return scheduleSlots(anfrage(e, nowMs, busy, gebucht)).filter(s => s.status === 'all').map(s => s.start);
}

/** Vor dem Buchen noch einmal: ist genau diese Zeit frei? */
export function zeitNochFrei(e: TerminEinstellungen, nowMs: number, busy: Interval[] | null, gebucht: Interval[], startIso: string): boolean {
  if (busy === null) return false;
  return isSlotStillFree(anfrage(e, nowMs, busy, gebucht), startIso);
}

/** Startzeiten nach Tag (Berlin), für die Tagesleiste der Seite. */
export function nachTagen(starts: string[]): { tag: string; zeiten: string[] }[] {
  const tage = new Map<string, string[]>();
  for (const s of starts) {
    const tag = berlinDateKey(Date.parse(s));
    tage.set(tag, [...(tage.get(tag) ?? []), s]);
  }
  return [...tage.entries()].map(([tag, zeiten]) => ({ tag, zeiten }));
}

// ---------------------------------------------------------------------------
// Buchungsangaben
// ---------------------------------------------------------------------------

export interface BuchungsEingabe {
  start?: unknown; mode?: unknown; first_name?: unknown; last_name?: unknown; email?: unknown; phone?: unknown;
  linkedin_url?: unknown; note?: unknown; consent?: unknown; website?: unknown; upload_id?: unknown;
}
export interface Buchung {
  start: string; mode: Gespraechsart; first_name: string; last_name: string; email: string; phone: string | null;
  linkedin_url: string | null; note: string | null; upload_id: string | null;
}
export type Pruefung = { ok: true; buchung: Buchung } | { ok: false; feld: string; meldung: string; bot?: boolean };

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function pruefeBuchung(b: BuchungsEingabe, e: TerminEinstellungen): Pruefung {
  // Bot-Falle: ein für Menschen unsichtbares Feld bleibt leer.
  if (txt(b.website, 200)) return { ok: false, feld: 'website', meldung: 'Die Buchung konnte nicht abgeschickt werden.', bot: true };
  const start = txt(b.start, 40);
  if (!start || Number.isNaN(Date.parse(start))) return { ok: false, feld: 'start', meldung: 'Bitte wähle eine Zeit.' };
  const mode = (b.mode === 'phone' || b.mode === 'teams') ? b.mode : e.arten[0];
  if (!e.arten.includes(mode)) return { ok: false, feld: 'mode', meldung: 'Diese Gesprächsart bietet der Headhunter nicht an.' };
  const first_name = txt(b.first_name, 80);
  const last_name = txt(b.last_name, 80);
  if (!first_name) return { ok: false, feld: 'first_name', meldung: 'Bitte gib deinen Vornamen an.' };
  if (!last_name) return { ok: false, feld: 'last_name', meldung: 'Bitte gib deinen Nachnamen an.' };
  const email = txt(b.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, feld: 'email', meldung: 'Bitte prüf deine E-Mail-Adresse.' };
  const phone = txt(b.phone, 40) || null;
  if (mode === 'phone' && (!phone || (phone.match(/\d/g) ?? []).length < 6)) return { ok: false, feld: 'phone', meldung: 'Für ein Telefonat brauchen wir deine Nummer.' };
  if (phone && (phone.match(/\d/g) ?? []).length < 6) return { ok: false, feld: 'phone', meldung: 'Bitte prüf deine Telefonnummer.' };
  let linkedin_url = txt(b.linkedin_url, 300) || null;
  if (linkedin_url) {
    linkedin_url = linkedin_url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    if (!/^([a-z]{2}\.)?linkedin\.com\/in\/[^\s/]+/i.test(linkedin_url)) return { ok: false, feld: 'linkedin_url', meldung: 'Bitte gib dein LinkedIn-Profil als linkedin.com/in/… an.' };
    linkedin_url = `https://www.${linkedin_url.replace(/^[a-z]{2}\./i, '')}`;
  }
  if (b.consent !== true) return { ok: false, feld: 'consent', meldung: 'Bitte stimm der Verarbeitung deiner Angaben zu.' };
  const upload = txt(b.upload_id, 40);
  return {
    ok: true,
    buchung: { start: new Date(Date.parse(start)).toISOString(), mode, first_name, last_name, email, phone, linkedin_url, note: txt(b.note, 1000) || null, upload_id: UUID.test(upload) ? upload : null },
  };
}

// ---------------------------------------------------------------------------
// Steckbrief der Stelle (anonym, wie im Beitrag)
// ---------------------------------------------------------------------------

export interface Steckbrief { titel: string; region: string; gehalt: string | null; fakten: string[]; vorteile: string[]; muss: string[] }

const liste = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])
  .flatMap(x => (typeof x === 'string' ? x.split(/\s·\s|\n/) : []))
  .map(x => x.trim().replace(/[.;:,]+$/, ''))
  .filter(Boolean);
const tausend = (n: number) => n.toLocaleString('de-DE');
const LEVEL: Record<string, string> = { junior: 'Junior', mid: 'Mid-Level', 'mid-level': 'Mid-Level', senior: 'Senior', lead: 'Lead', principal: 'Principal', executive: 'Executive' };

export function steckbrief(job: Record<string, unknown>, gehaltZeigen: boolean): Steckbrief {
  const region = regionAus(job.location, job.remote_type);
  const min = Number(job.salary_min) || null;
  const max = Number(job.salary_max) || null;
  const monate = Number(job.salary_months) || null;
  const freelance = job.employment_type === 'freelance';
  const spanne = min && max && min !== max ? `${tausend(min)} – ${tausend(max)} €` : (min || max) ? `${tausend((min ?? max)!)} €` : null;
  const gehalt = gehaltZeigen && !freelance && spanne ? `${spanne}${monate && monate !== 12 ? ` × ${monate}` : ''}` : null;
  const tage = Number(job.onsite_days_required);
  const fakten = [
    job.remote_type === 'remote' || tage === 0 ? 'Remote' : tage > 0 ? `${tage} ${tage === 1 ? 'Tag' : 'Tage'} vor Ort` : job.remote_type === 'hybrid' ? 'Hybrid' : null,
    job.employment_type === 'full-time' ? 'Vollzeit' : job.employment_type === 'part-time' ? 'Teilzeit' : freelance ? 'Projekt' : null,
    typeof job.experience_level === 'string' ? LEVEL[job.experience_level.toLowerCase()] ?? null : null,
    typeof job.contract_limitation === 'string' && job.contract_limitation.trim() ? job.contract_limitation.trim().replace(/^./, c => c.toLowerCase()) : null,
  ].filter((x): x is string => !!x);
  const vorteileRoh = liste(job.position_advantages);
  const benefits = liste(job.benefits).filter(b => !vorteileRoh.some(v => v.toLowerCase().includes(b.toLowerCase())));
  const ctx = { firma: job.company_name as string | null, redList: job.red_list, domains: [job.company_website as string | null], region, mitarbeitende: Number(job.company_headcount) || null };
  const sauber = (t: string) => { const f = anonymFunde(t, ctx); return f.length ? ersetzeFunde(t, f) : t; };
  return {
    titel: sauber(String(job.title ?? '')),
    region: region.text,
    gehalt,
    fakten,
    vorteile: [...vorteileRoh, ...benefits].filter(v => v.length <= 100).slice(0, 4).map(sauber),
    muss: liste(job.must_have_criteria).filter(m => m.length <= 60).slice(0, 4).map(sauber),
  };
}

/** Steht der Firmenname noch irgendwo im Steckbrief? (Sicherheitsnetz für Tests und Logs) */
export function steckbriefVerraet(s: Steckbrief, job: Record<string, unknown>): string[] {
  const alles = [s.titel, ...s.vorteile, ...s.muss].join('\n').toLowerCase();
  return kundenBegriffe({ firma: job.company_name as string | null, redList: job.red_list, domains: [job.company_website as string | null], region: regionAus(job.location) })
    .filter(b => alles.includes(b.toLowerCase()));
}

/** Der Stellen-Teil im Link endet auf die ersten 6 Zeichen der Job-ID. */
export function passtZurStelle(jobId: string, slugTeil: string): boolean {
  const m = slugTeil.match(/-([0-9a-f]{6})$/i);
  return !!m && jobId.replace(/-/g, '').toLowerCase().startsWith(m[1].toLowerCase());
}

export const initialen = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(t => t[0]?.toUpperCase() ?? '').join('') || '·';

/** „Do 22.10., 9:30“ in deutscher Zeit. */
export function terminText(iso: string, mitDatum = true): string {
  const d = new Date(iso);
  const tag = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(d).replace('.', '');
  const datum = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' }).format(d);
  const zeit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', minute: '2-digit' }).format(d);
  return mitDatum ? `${tag} ${datum.replace(/\.$/, '')}., ${zeit}` : zeit;
}
