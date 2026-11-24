/**
 * Stand eines Kandidaten für „Meine Kandidaten“ (24.11.2026, Vorschlag 1 „Karten, aufgeräumt“).
 *
 * Gelesen wird die Stufe (submissions.stage, normalisiert), nicht der alte Status: vorher zeigten
 * eingestellte Kandidaten „Vorgestellt“. Reihenfolge: läuft ein Vorgang, ist der Kandidat „im Prozess“
 * (auch wenn er früher schon einmal eingestellt wurde); sonst „eingestellt“, wenn eine Einstellung
 * besteht; sonst „frei“.
 */
import { isClosedStage, normalizeStage, type CanonicalStage } from './submissionStage';

export interface StandVorstellung {
  id: string;
  job_id: string | null;
  stage: string | null;
  status: string | null;
  submitted_at: string | null;
  updated_at?: string | null;
}

export interface StandStelle {
  title: string | null;
  company_name: string | null;
}

export interface StandEinstellung {
  start_date: string | null;
  retention_release_date: string | null;
}

export interface Vorgang {
  submissionId: string;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  stage: CanonicalStage;
}

export type KandidatenStand =
  | { art: 'prozess'; haupt: Vorgang; weitere: Vorgang[] }
  | { art: 'eingestellt'; vorgang: Vorgang; start: string | null; garantieBis: string | null; garantieVorbei: boolean; startKommt: boolean }
  | { art: 'frei' };

/** Wie weit ein laufender Vorgang ist; der weiteste steht oben auf der Karte. */
const FORTSCHRITT: Partial<Record<CanonicalStage, number>> = {
  submitted: 1,
  in_review: 2,
  interview_requested: 3,
  interview_counter_proposed: 4,
  candidate_opted_in: 5,
  interview_scheduled: 6,
  interview_completed: 7,
  offer: 8,
};

const zeit = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

export function kandidatenStand(
  vorstellungen: StandVorstellung[],
  stellen: Map<string, StandStelle>,
  einstellungen: Map<string, StandEinstellung>,
  heute: Date = new Date(),
): KandidatenStand {
  const vorgaenge = vorstellungen.map((v) => {
    const stelle = v.job_id ? stellen.get(v.job_id) : undefined;
    const vorgang: Vorgang = {
      submissionId: v.id,
      jobId: v.job_id,
      jobTitle: stelle?.title ?? null,
      company: stelle?.company_name ?? null,
      stage: normalizeStage(v.stage, v.status),
    };
    return { vorgang, quelle: v };
  });

  const laufend = vorgaenge
    .filter(({ vorgang }) => !isClosedStage(vorgang.stage) && vorgang.stage !== 'placed')
    .sort((a, b) =>
      (FORTSCHRITT[b.vorgang.stage] ?? 0) - (FORTSCHRITT[a.vorgang.stage] ?? 0)
      || zeit(b.quelle.updated_at ?? b.quelle.submitted_at) - zeit(a.quelle.updated_at ?? a.quelle.submitted_at));
  if (laufend.length) {
    return { art: 'prozess', haupt: laufend[0].vorgang, weitere: laufend.slice(1).map((x) => x.vorgang) };
  }

  const eingestellt = vorgaenge
    .filter(({ vorgang }) => vorgang.stage === 'placed')
    .sort((a, b) => zeit(b.quelle.updated_at ?? b.quelle.submitted_at) - zeit(a.quelle.updated_at ?? a.quelle.submitted_at));
  if (eingestellt.length) {
    const vorgang = eingestellt[0].vorgang;
    const e = einstellungen.get(vorgang.submissionId);
    const jetzt = heute.getTime();
    const start = e?.start_date ?? null;
    const garantieBis = e?.retention_release_date ?? null;
    return {
      art: 'eingestellt',
      vorgang,
      start,
      garantieBis,
      startKommt: !!start && zeit(start) > jetzt,
      garantieVorbei: !!garantieBis && zeit(garantieBis) < jetzt,
    };
  }

  return { art: 'frei' };
}

/** Kürzel „EY“ statt „TEY“ oder „NL(“: Vor- und Nachname, Zusätze wie „Test“ oder „(Test)“ zählen nicht. */
export function kandidatKuerzel(name: string | null | undefined): string {
  const woerter = (name ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w) && w.toLowerCase() !== 'test');
  if (!woerter.length) return '?';
  const erstes = woerter[0][0];
  const letztes = woerter.length > 1 ? woerter[woerter.length - 1][0] : '';
  return (erstes + letztes).toUpperCase();
}
