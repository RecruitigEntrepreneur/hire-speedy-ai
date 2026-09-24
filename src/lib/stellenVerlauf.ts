/**
 * Der Weg einer eingereichten Stelle -- EINE Fassung fuer alle Orte.
 *
 * Vorher gab es drei Wortlaute fuer denselben Stand: der Abschluss-Screen der
 * Aufnahme ("Pruefung durch Matchunt -> Auftragsbestaetigung per Mail -> Stelle
 * geht live -> Erste anonyme Kandidaten"), die Jobliste ("In Freigabe") und
 * das Job-Detail ("Entwurf -> In Freigabe -> Aktiv"). Und den Abschluss-Screen
 * sah der Kunde genau einmal -- zurueck kam er nie (Durchklicken 24.09.2026).
 *
 * Jetzt steht der Stand an der Stelle selbst, in Liste, Detail und Dashboard
 * gleich. "Auftragsbestaetigung per Mail" ist gestrichen: eine solche Mail
 * gibt es im Code nicht.
 */

export type SchrittKey = 'eingereicht' | 'team' | 'pruefung' | 'live' | 'kandidaten';
export type Zustand = 'erledigt' | 'aktuell' | 'offen';

export interface VerlaufSchritt {
  key: SchrittKey;
  label: string;
  zustand: Zustand;
  /** Wann erledigt -- nur, wenn es eine echte Zeitangabe gibt. */
  datum: string | null;
  /** Was gerade passiert, nur am aktuellen Schritt. */
  hinweis: string | null;
}

export interface Verlauf {
  schritte: VerlaufSchritt[];
  /** Der aktuelle Schritt -- null, wenn alles erledigt ist. */
  aktuell: VerlaufSchritt | null;
  /** Kurzform fuer Badges: "In Prüfung bei Matchunt", "Live · Headhunter suchen". */
  kurz: string;
}

export interface VerlaufJob {
  status: string;
  submitted_at?: string | null;
  updated_at?: string | null;
  client_approved_at?: string | null;
  approved_at?: string | null;
  paused_at?: string | null;
}

const LABEL: Record<SchrittKey, string> = {
  eingereicht: 'Eingereicht',
  team: 'Freigabe Ihres Teams',
  pruefung: 'Prüfung durch Matchunt',
  live: 'Live',
  kandidaten: 'Erste Kandidaten',
};

const HINWEIS: Record<SchrittKey, string> = {
  eingereicht: '',
  team: 'wartet auf Admin/HR Ihres Teams',
  pruefung: 'meist unter 24 Std.',
  live: 'Headhunter suchen',
  kandidaten: '',
};

const KURZ: Partial<Record<SchrittKey, string>> = {
  team: 'Freigabe Ihres Teams',
  pruefung: 'In Prüfung bei Matchunt',
  live: 'Live · Headhunter suchen',
};

/**
 * Der Verlauf einer Stelle -- oder null, wo er nichts zu sagen hat
 * (Entwurf, geschlossen, besetzt).
 */
export function stellenVerlauf(
  job: VerlaufJob,
  opts: { kandidaten?: number; ersterKandidatAm?: string | null } = {},
): Verlauf | null {
  const s = job.status;
  const wartet = s === 'pending_approval' || s === 'pending_client_approval';
  if (!wartet && s !== 'published') return null;

  const kandidaten = opts.kandidaten ?? 0;
  const mitTeam = s === 'pending_client_approval' || !!job.client_approved_at;
  const keys: SchrittKey[] = ['eingereicht', ...(mitTeam ? ['team' as const] : []), 'pruefung', 'live', 'kandidaten'];

  const aktuellKey: SchrittKey | null =
    s === 'pending_client_approval' ? 'team'
    : s === 'pending_approval' ? 'pruefung'
    : kandidaten > 0 ? null
    : 'live';

  /* Bis die Spalte live angelegt ist, bleibt fuer wartende Stellen der alte
     Rueckfall (updated_at) -- er verschiebt sich zwar bei Bearbeitungen, ist
     aber besser als nichts. Bei laengst live gegangenen Stellen stuende dort
     ein beliebiges spaeteres Datum; dann lieber keins. */
  const eingereichtAm = job.submitted_at ?? (wartet ? job.updated_at ?? null : null);
  const datum: Record<SchrittKey, string | null> = {
    eingereicht: eingereichtAm,
    team: job.client_approved_at ?? null,
    pruefung: job.approved_at ?? null,
    live: job.approved_at ?? null,
    kandidaten: opts.ersterKandidatAm ?? null,
  };

  const aktuellIdx = aktuellKey ? keys.indexOf(aktuellKey) : keys.length;
  const schritte = keys.map((key, i): VerlaufSchritt => {
    const zustand: Zustand = i < aktuellIdx ? 'erledigt' : i === aktuellIdx ? 'aktuell' : 'offen';
    let hinweis = zustand === 'aktuell' ? HINWEIS[key] || null : null;
    if (key === 'live' && zustand === 'aktuell' && job.paused_at) hinweis = 'pausiert';
    return { key, label: LABEL[key], zustand, datum: zustand === 'erledigt' ? datum[key] : null, hinweis };
  });

  const aktuell = schritte.find((x) => x.zustand === 'aktuell') ?? null;
  const kurz = aktuell
    ? (aktuell.key === 'live' && job.paused_at ? 'Live · pausiert' : KURZ[aktuell.key] ?? aktuell.label)
    : 'Live';
  return { schritte, aktuell, kurz };
}

/** "24.09., 15:52" */
export function verlaufDatum(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}
