/**
 * Aufgaben vor der Einreichung (01.11.2026): Was der Headhunter mit einem angelegten Kandidaten
 * als Nächstes tun muss, bevor er ihn einreichen kann. Je Kandidat höchstens eine Aufgabe. Sie
 * entsteht aus dem Zustand und verschwindet, wenn er sich ändert. Sobald es eine Einreichung
 * gibt, übernehmen deren Aufgaben.
 */

const DAY_MS = 86_400_000;
/** Ältere Kandidaten bleiben still, sonst stünden am ersten Tag alle Bestandskandidaten auf der Liste. */
export const VORBEREITEN_AB = Date.parse('2026-11-01T00:00:00+01:00');
/** So kurz vor dem Beginn rückt ein Termin nach ganz oben. */
export const ALS_NAECHSTES_MIN = 30;
const ENTWURF_OFFEN_TAGE = 2;
const NACHFASSEN_TAGE = 3;
const NEU_HOECHSTENS_TAGE = 14;
const NEU_FRISCH_TAGE = 2;
/** Ein am Telefon ausgemachter Termin hat kein Ende im Kalender. */
const ABSPRACHE_MIN = 30;

export type VorbereitenArt = 'termin' | 'war' | 'entwurf' | 'eingeladen' | 'bereit' | 'neu';

/** Reihenfolge unter allem, was schon Honorar im Spiel hat (Stufen dort ab 1). */
export const VORBEREITEN_RANG: Record<VorbereitenArt, number> = { termin: 0.6, war: 0.5, entwurf: 0.4, eingeladen: 0.3, bereit: 0.2, neu: 0.1 };
export const VORBEREITEN_TON: Partial<Record<VorbereitenArt, string>> = {
  termin: 'bg-primary/10 text-primary',
  war: 'bg-warning/10 text-warning',
  entwurf: 'bg-warning/10 text-warning',
  bereit: 'bg-success/10 text-success',
};

export interface VKandidat {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  job_title: string | null;
  created_at: string;
  cv_url?: string | null;
  cv_parsed_at?: string | null;
  candidate_status?: string | null;
  import_source?: string | null;
  prep_dismissed_at?: string | null;
}
export interface VEinladung {
  candidate_id: string;
  arten: string[];
  weg: string;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  expires_at: string;
  booked_at: string | null;
  revoked_at: string | null;
}
export interface VBuchung {
  candidate_id: string | null;
  starts_at: string;
  ends_at: string;
  mode: 'teams' | 'phone';
  status: string;
  join_url: string | null;
  note: string | null;
}
export interface VNotiz {
  candidate_id: string;
  status: string | null;
  updated_at: string | null;
  interview_date: string | null;
}
export interface VLog {
  candidate_id: string | null;
  activity_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}
export interface VEingabe {
  kandidaten: VKandidat[];
  einladungen: VEinladung[];
  buchungen: VBuchung[];
  notizen: VNotiz[];
  logs: VLog[];
  mitEinreichung: Set<string>;
  /** Was zum Abschließen des Interviews noch fehlt, je Kandidat. */
  luecken?: Map<string, string[]>;
  /** Offene Stellen, die laut gespeichertem Matching passen, je Kandidat. */
  stellen?: Map<string, number>;
}

export interface VTermin {
  start: string;
  ende: string;
  mode: 'teams' | 'phone';
  joinUrl: string | null;
  notiz: string | null;
  selbstGebucht: boolean;
}
export interface Vorbereitung {
  art: VorbereitenArt;
  candidateId: string;
  name: string;
  rolle: string | null;
  telefon: string | null;
  email: string | null;
  lebenslauf: boolean;
  /** Seit wann der Zustand besteht. */
  seit: string;
  /** Neu und jünger als zwei Tage: steht unter „Diese Woche“, noch nicht unter den Handgriffen. */
  frisch: boolean;
  termin: VTermin | null;
  einladung: { am: string; arten: string[]; perMail: boolean; geoeffnetAm: string | null } | null;
  luecken: string[];
  stellen: number;
}

const berlinTag = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
/** Kalendertage in Berlin, nicht 24-Stunden-Blöcke: „gestern“ heißt gestern. */
const tageHer = (iso: string, now: number) =>
  Math.round((Date.parse(`${berlinTag(now)}T12:00:00Z`) - Date.parse(`${berlinTag(Date.parse(iso))}T12:00:00Z`)) / DAY_MS);
export const uhrzeit = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
export const tagMonat = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
export const wannWar = (iso: string, now = Date.now()) => {
  const d = tageHer(iso, now);
  return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`;
};

const lebt = (e: VEinladung, now: number) => !e.booked_at && !e.revoked_at && Date.parse(e.expires_at) > now;

/**
 * Das Interview läuft erst, wenn ein Gesprächsdatum dasteht oder es abgeschlossen ist. Der
 * Lebenslauf-Import legt schon beim Anlegen einen Datensatz an, das ist noch kein Gespräch.
 */
export const interviewBegonnen = (n: Pick<VNotiz, 'status' | 'interview_date'>) => n.status === 'completed' || !!n.interview_date;

/** Beginn- und Endzeiten aller Termine des Kandidaten: gebucht oder am Telefon ausgemacht. */
function termineVon(id: string, e: VEingabe): VTermin[] {
  const gebucht: VTermin[] = e.buchungen.filter(b => b.candidate_id === id && b.status === 'booked').map(b => ({
    start: b.starts_at, ende: b.ends_at, mode: b.mode, joinUrl: b.join_url, notiz: b.note, selbstGebucht: true,
  }));
  const abgesprochen: VTermin[] = e.logs.filter(l => l.candidate_id === id && typeof l.metadata?.termin_at === 'string').map(l => {
    const start = l.metadata!.termin_at as string;
    return { start, ende: new Date(Date.parse(start) + ABSPRACHE_MIN * 60_000).toISOString(), mode: 'phone', joinUrl: null, notiz: null, selbstGebucht: false };
  });
  return [...gebucht, ...abgesprochen].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** Betrifft der Kandidat die Aufgaben überhaupt? (Laden der Zusatzdaten nur für diese) */
export function betroffeneKandidaten(e: VEingabe): VKandidat[] {
  return e.kandidaten.filter(k => {
    if (e.mitEinreichung.has(k.id)) return false;
    if (k.candidate_status === 'placed' || k.candidate_status === 'rejected') return false;
    return Date.parse(k.created_at) >= VORBEREITEN_AB
      || e.einladungen.some(x => x.candidate_id === k.id)
      || e.buchungen.some(x => x.candidate_id === k.id)
      || e.notizen.some(x => x.candidate_id === k.id && !!x.updated_at && Date.parse(x.updated_at) >= VORBEREITEN_AB);
  });
}

/** Die eine Aufgabe je Kandidat, die jetzt dran ist. Reihenfolge der Regeln wie im Ablauf eines Gesprächs. */
export function leiteVorbereitungAb(e: VEingabe, now = Date.now()): Vorbereitung[] {
  const out: Vorbereitung[] = [];
  for (const k of betroffeneKandidaten(e)) {
    const basis = {
      candidateId: k.id,
      name: k.full_name?.trim() || 'Kandidat',
      rolle: k.job_title?.trim() || null,
      telefon: k.phone?.trim() || null,
      email: k.email?.trim() || null,
      lebenslauf: !!(k.cv_url || k.cv_parsed_at),
      frisch: false,
      termin: null,
      einladung: null,
      luecken: e.luecken?.get(k.id) ?? [],
      stellen: e.stellen?.get(k.id) ?? 0,
    };
    const termine = termineVon(k.id, e);

    // Termin heute steht immer da, auch wenn der Kandidat ausgeblendet wurde: Er kommt ja.
    const heute = termine.find(t => berlinTag(Date.parse(t.start)) === berlinTag(now) && Date.parse(t.ende) > now);
    if (heute) { out.push({ ...basis, art: 'termin', seit: heute.start, termin: heute }); continue; }
    if (k.prep_dismissed_at) continue;

    const notizen = e.notizen.filter(n => n.candidate_id === k.id && n.status !== 'superseded' && interviewBegonnen(n));
    const stand = notizen.map(n => n.updated_at ?? '').sort().pop() || k.created_at;
    if (notizen.some(n => n.status === 'completed') && !basis.luecken.length) { out.push({ ...basis, art: 'bereit', seit: stand }); continue; }

    const kommend = termine.some(t => Date.parse(t.ende) > now);
    let vorbei = [...termine].reverse().find(t => Date.parse(t.ende) <= now) ?? null;
    // „Nicht erschienen“ ist festgehalten: dieser Termin zählt nicht mehr
    const logs = e.logs.filter(l => l.candidate_id === k.id);
    if (vorbei && logs.some(l => l.metadata?.kind === 'no_show' && l.created_at >= vorbei!.start)) vorbei = null;

    if (notizen.length) {
      // Ein frischer Entwurf ist gerade in Arbeit; vor einem kommenden Termin ist er Vorbereitung.
      const liegt = now - Date.parse(stand) >= ENTWURF_OFFEN_TAGE * DAY_MS;
      if (vorbei || (liegt && !kommend)) out.push({ ...basis, art: 'entwurf', seit: stand });
      continue;
    }
    if (vorbei) { out.push({ ...basis, art: 'war', seit: vorbei.start, termin: vorbei }); continue; }
    if (kommend) continue;

    const offen = e.einladungen.filter(x => x.candidate_id === k.id && lebt(x, now));
    if (offen.length) {
      const zeiten = offen.map(x => Date.parse(x.sent_at ?? x.created_at));
      const erreicht = logs.filter(l => (l.activity_type === 'call' || l.activity_type === 'email') && l.metadata?.reached !== false).map(l => Date.parse(l.created_at));
      const verpasst = logs.filter(l => l.activity_type === 'call' && l.metadata?.reached === false).map(l => Date.parse(l.created_at));
      const faelligAb = Math.max(
        Math.max(...zeiten, ...erreicht) + NACHFASSEN_TAGE * DAY_MS,
        // Nicht erreicht: schon am nächsten Tag noch einmal
        verpasst.length ? Math.max(...verpasst) + DAY_MS : 0,
      );
      if (now >= faelligAb) {
        const erste = [...offen].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
        const geoeffnet = offen.map(x => x.last_opened_at ?? x.opened_at ?? '').sort().pop() || null;
        out.push({
          ...basis, art: 'eingeladen', seit: erste.created_at,
          einladung: { am: erste.sent_at ?? erste.created_at, arten: offen[0].arten, perMail: offen.some(x => x.weg === 'mail'), geoeffnetAm: geoeffnet },
        });
      }
      continue;
    }

    // Massen-Import aus HubSpot ist keine Liste, die man abarbeitet
    if (k.import_source === 'hubspot') continue;
    const alter = now - Date.parse(k.created_at);
    if (alter <= NEU_HOECHSTENS_TAGE * DAY_MS) out.push({ ...basis, art: 'neu', seit: k.created_at, frisch: alter < NEU_FRISCH_TAGE * DAY_MS });
  }
  return out;
}

/** Termin steht gleich an oder läuft schon. */
export const istGleichDran = (v: Vorbereitung, now = Date.now()) =>
  v.art === 'termin' && !!v.termin && Date.parse(v.termin.start) - now <= ALS_NAECHSTES_MIN * 60_000 && Date.parse(v.termin.ende) > now;

const aufzaehlung = (l: string[], n: number) => {
  if (l.length <= n) return l.length > 1 ? `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}` : l[0] ?? '';
  return `${l.slice(0, n).join(', ')} und ${l.length - n} weitere`;
};
const stellenText = (n: number) => (n === 1 ? '1 Stelle passt' : `${n} Stellen passen`);

/** Texte der Zeile: Pille, Satz, Kurzzeile fürs Dashboard, Knopf. */
export function vorbereitenTexte(v: Vorbereitung, now = Date.now()) {
  switch (v.art) {
    case 'termin': {
      const t = v.termin!;
      const min = Math.round((Date.parse(t.start) - now) / 60_000);
      const wie = t.mode === 'teams' ? 'über Teams' : 'am Telefon';
      return {
        pill: 'Termin',
        text: min <= 0
          ? `Euer Gespräch läuft seit ${uhrzeit(t.start)} ${wie}.`
          : min <= 90 ? `Euer Gespräch ist heute um ${uhrzeit(t.start)} ${wie}, in ${min} Minuten.` : `Euer Gespräch ist heute um ${uhrzeit(t.start)} ${wie}.`,
        kurz: `Heute ${uhrzeit(t.start)} · ${t.mode === 'teams' ? 'Teams' : 'Telefon'}`,
        knopf: 'Aufgabe öffnen',
      };
    }
    case 'war': {
      const frisch = tageHer(v.seit, now) <= 2;
      return {
        pill: 'Gespräch war',
        text: frisch ? `Gespräch war ${wannWar(v.seit, now)}. Halte es fest, solange es frisch ist.` : `Gespräch war am ${tagMonat(v.seit)} und ist noch nicht festgehalten.`,
        kurz: 'Interview noch nicht festgehalten',
        knopf: 'Interview erfassen',
      };
    }
    case 'entwurf': {
      const d = tageHer(v.seit, now);
      const seit = d <= 0 ? 'Seit heute offen.' : d === 1 ? 'Seit gestern offen.' : `Seit ${d} Tagen offen.`;
      return {
        pill: 'Entwurf',
        text: v.luecken.length ? `${seit} Es fehlen ${aufzaehlung(v.luecken, 2)}.` : `${seit} Alle Angaben sind da, nur noch abschließen.`,
        kurz: v.luecken.length ? `Es fehlen ${aufzaehlung(v.luecken, 1)}` : 'Nur noch abschließen',
        knopf: 'Fertigstellen',
      };
    }
    case 'eingeladen': {
      const d = tageHer(v.seit, now);
      return {
        pill: 'Eingeladen',
        text: `Seit ${d === 1 ? 'gestern' : `${d} Tagen`} eingeladen, ${v.einladung?.geoeffnetAm ? 'Link geöffnet' : 'Link nicht geöffnet'}, noch kein Termin. Ruf kurz an.`,
        kurz: `Seit ${d === 1 ? 'gestern' : `${d} Tagen`} eingeladen, kein Termin`,
        knopf: 'Aufgabe öffnen',
      };
    }
    case 'bereit':
      return {
        pill: 'Bereit',
        text: `Interview fertig, noch nirgends eingereicht.${v.stellen ? ` ${stellenText(v.stellen)}.` : ''}`,
        kurz: v.stellen ? `Noch nirgends eingereicht, ${stellenText(v.stellen)}` : 'Noch nirgends eingereicht',
        knopf: 'Stellen ansehen',
      };
    default: {
      const wann = wannWar(v.seit, now);
      return {
        pill: 'Neu',
        text: `${wann.charAt(0).toUpperCase()}${wann.slice(1)} angelegt, noch kein Gespräch.`,
        kurz: 'Noch kein Gespräch',
        knopf: 'Einladen',
      };
    }
  }
}
