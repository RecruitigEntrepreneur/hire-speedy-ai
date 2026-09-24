/**
 * Der Aufbau der Abteilung -- als Treppe aus Folgefragen (24.09.2026).
 *
 * Vorher stand unter "Wie strukturiert sich die Abteilung von der Position?"
 * ein einziges Zahlenfeld "Teamgroesse" ueber die volle Breite. Es nahm viel
 * Platz und sagte wenig: ob die Person ein Team FUEHRT oder IN einem Team
 * arbeitet, wer noch drin ist, wie gross die Abteilung ist und mit wem sie
 * eng zusammenarbeitet, blieb offen. Der Parser las `department_structure`
 * sogar aus der Anzeige -- der Katalog hatte nur keinen Platz dafuer, und der
 * Wert fiel auf den Boden (Bilanzbuchhalter-Test: "12 Personen, 2
 * Finanzbuchhalter, 1 Lohnbuchhalterin, 1 Azubi" -> Spalte leer).
 *
 * Jetzt: eine erste Frage (Wie ist die Position eingebunden?), und je nach
 * Antwort oeffnet sich die naechste. Beantwortete Stufen stehen als Zeile
 * mit "aendern" da.
 *
 * Diese Datei ist die EINE Stelle fuer die Logik -- Frontend (Formular,
 * Anzeige-Mapping) und Edge Functions (Spaltenschreiben) lesen sie beide.
 * Deno kann nicht aus src/ importieren, das Frontend aber aus hier.
 *
 * Teamgroesse und Abteilungsgroesse sind ZAHLEN, keine Spannen: Befund vom
 * 09.09.2026 -- Spannen wurden als Mittelwert gespeichert, der Headhunter las
 * "10" als Tatsache.
 */

export type Einbindung = 'team' | 'leitung' | 'bereich' | 'allein' | 'aufbau';
export type Fuehrung = 'fachlich' | 'disziplinarisch' | 'beides';

export interface Rollenzahl {
  rolle: string;
  anzahl: number;
}

export interface Abteilungsaufbau {
  einbindung?: Einbindung;
  /** Kolleg:innen im direkten Team (ohne die Position selbst). */
  team?: number;
  /** Direkt gefuehrte Personen. */
  fuehrt?: number;
  fuehrung?: Fuehrung;
  /** Anzahl gefuehrter Teams. */
  teams?: number;
  /** Zielgroesse eines neu aufgebauten Teams. */
  ziel?: number;
  /** Leere Liste = bewusst uebersprungen; fehlend = noch nicht gefragt. */
  rollen?: Rollenzahl[];
  abteilung?: { name?: string; groesse?: number };
  /** Leere Liste = bewusst uebersprungen; fehlend = noch nicht gefragt. */
  schnittstellen?: string[];
}

export type AufbauSchritt =
  | 'einbindung' | 'team' | 'fuehrt' | 'fuehrung' | 'teams' | 'ziel'
  | 'rollen' | 'abteilung' | 'schnittstellen';

export const EINBINDUNGEN: { wert: Einbindung; label: string }[] = [
  { wert: 'team', label: 'Arbeitet im Team mit' },
  { wert: 'leitung', label: 'Führt ein Team' },
  { wert: 'bereich', label: 'Führt mehrere Teams' },
  { wert: 'allein', label: 'Arbeitet allein' },
  { wert: 'aufbau', label: 'Baut ein Team neu auf' },
];

export const FUEHRUNGEN: { wert: Fuehrung; label: string }[] = [
  { wert: 'fachlich', label: 'fachlich' },
  { wert: 'disziplinarisch', label: 'disziplinarisch' },
  { wert: 'beides', label: 'fachlich und disziplinarisch' },
];

/** Welche Folgefragen zu welcher ersten Antwort gehoeren -- in dieser Reihenfolge. */
const ZWEIGE: Record<Einbindung, AufbauSchritt[]> = {
  team: ['team', 'rollen', 'abteilung', 'schnittstellen'],
  leitung: ['fuehrt', 'fuehrung', 'rollen', 'abteilung', 'schnittstellen'],
  bereich: ['teams', 'fuehrung', 'abteilung', 'schnittstellen'],
  allein: ['schnittstellen', 'abteilung'],
  aufbau: ['ziel', 'rollen', 'abteilung', 'schnittstellen'],
};

const positiv = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function istAufbau(v: unknown): v is Abteilungsaufbau {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'einbindung' in (v as object);
}

export function aufbauSchritte(a: Abteilungsaufbau | null | undefined): AufbauSchritt[] {
  const e = a?.einbindung;
  return ['einbindung', ...(e && ZWEIGE[e] ? ZWEIGE[e] : [])];
}

export function schrittBeantwortet(a: Abteilungsaufbau | null | undefined, s: AufbauSchritt): boolean {
  if (!a) return false;
  switch (s) {
    case 'einbindung': return !!a.einbindung && a.einbindung in ZWEIGE;
    case 'team': return positiv(a.team);
    case 'fuehrt': return positiv(a.fuehrt);
    case 'teams': return positiv(a.teams);
    case 'ziel': return positiv(a.ziel);
    case 'fuehrung': return !!a.fuehrung;
    case 'rollen': return Array.isArray(a.rollen);
    case 'schnittstellen': return Array.isArray(a.schnittstellen);
    case 'abteilung': return positiv(a.abteilung?.groesse);
  }
}

/** Die erste offene Stufe -- oder null, wenn die Treppe durch ist. */
export const naechsterSchritt = (a: Abteilungsaufbau | null | undefined): AufbauSchritt | null =>
  aufbauSchritte(a).find((s) => !schrittBeantwortet(a, s)) ?? null;

export const aufbauFertig = (a: unknown): boolean =>
  istAufbau(a) && naechsterSchritt(a) === null;

/**
 * Nur, was zum gewaehlten Zweig gehoert.
 *
 * Wer von "Arbeitet im Team mit" auf "Fuehrt ein Team" umstellt, behaelt
 * Abteilung, Rollen und Schnittstellen -- die gibt es in beiden Zweigen.
 * Die Zahl der Kolleg:innen faellt weg; sie ist keine Fuehrungsspanne.
 */
export function aufbauBereinigt(a: Abteilungsaufbau): Abteilungsaufbau {
  const behalten = new Set<string>(aufbauSchritte(a));
  const out: Abteilungsaufbau = { einbindung: a.einbindung };
  for (const s of behalten) {
    if (s === 'einbindung') continue;
    const k = s as keyof Abteilungsaufbau;
    if (a[k] !== undefined) (out as Record<string, unknown>)[k] = a[k];
  }
  return out;
}

/**
 * Die Zahl fuer die Spalte `team_size`.
 *
 * Wer mitarbeitet: die Kolleg:innen im direkten Team. Wer fuehrt: die
 * Fuehrungsspanne. Wer aufbaut: die Zielgroesse. Allein und "mehrere Teams"
 * haben keine sinnvolle Einzelzahl -- dann bleibt die Spalte leer, statt eine
 * Zahl zu behaupten.
 */
export function teamgroesseAus(a: Abteilungsaufbau | null | undefined): number | null {
  if (!a) return null;
  const n = a.einbindung === 'team' ? a.team
    : a.einbindung === 'leitung' ? a.fuehrt
    : a.einbindung === 'aufbau' ? a.ziel
    : undefined;
  return positiv(n) ? Math.round(n) : null;
}

const liste = (l: string[]) =>
  l.length > 1 ? `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}` : (l[0] ?? '');

export const rollenText = (r: Rollenzahl[] | undefined) =>
  (r ?? []).filter((x) => x.rolle?.trim() && x.anzahl > 0).map((x) => `${x.anzahl} ${x.rolle.trim()}`).join(', ');

export const fuehrungText = (f: Fuehrung | undefined) =>
  FUEHRUNGEN.find((x) => x.wert === f)?.label ?? '';

/**
 * Der Aufbau als Klartext -- so steht er beim Headhunter unter "Aufbau der
 * Abteilung" (jobs.department_structure ist eine Textspalte).
 * Auch halb beantwortet lesbar: es steht nur da, was gesagt wurde.
 */
export function aufbauAlsText(a: Abteilungsaufbau | null | undefined): string {
  if (!istAufbau(a) || !a.einbindung) return '';
  const rollen = rollenText(a.rollen);
  const klammer = rollen ? ` (${rollen})` : '';
  const f = fuehrungText(a.fuehrung);
  const saetze: string[] = [];

  switch (a.einbindung) {
    case 'team':
      saetze.push(positiv(a.team)
        ? `Arbeitet im Team mit ${a.team} ${a.team === 1 ? 'Kolleg:in' : 'Kolleg:innen'}${klammer}.`
        : `Arbeitet im Team mit${klammer}.`);
      break;
    case 'leitung':
      saetze.push(`Führt ein Team${positiv(a.fuehrt) ? ` von ${a.fuehrt} ${a.fuehrt === 1 ? 'Person' : 'Personen'}` : ''}${f ? `, ${f}` : ''}${klammer}.`);
      break;
    case 'bereich':
      saetze.push(`Führt ${positiv(a.teams) ? `${a.teams} Teams` : 'mehrere Teams'}${f ? `, ${f}` : ''}.`);
      break;
    case 'allein':
      saetze.push('Arbeitet allein, ohne eigenes Team.');
      break;
    case 'aufbau':
      saetze.push(`Baut ein Team neu auf${positiv(a.ziel) ? `, Ziel: ${a.ziel} Personen` : ''}${klammer}.`);
      break;
  }

  const ab = a.abteilung;
  if (positiv(ab?.groesse)) {
    saetze.push(`Abteilung${ab?.name?.trim() ? ` ${ab.name.trim()}` : ''} mit ${ab!.groesse} Personen.`);
  }
  const sch = (a.schnittstellen ?? []).map((x) => x.trim()).filter(Boolean);
  if (sch.length) saetze.push(`Eng mit ${liste(sch)}.`);
  return saetze.join(' ');
}

/* ------------------------------------------------------------------ */

/** Was der Parser zum Aufbau liefert (parse-job-url, `team_structure`). */
export interface TeamStructureParsed {
  einbindung?: string | null;
  direct_team?: number | null;
  leads?: number | null;
  leadership?: string | null;
  teams?: number | null;
  target_size?: number | null;
  roles?: { role?: string | null; count?: number | null }[] | null;
  department_name?: string | null;
  department_size?: number | null;
  interfaces?: string[] | null;
}

const ganz = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

/**
 * Aus der Anzeige -- nur, was dort steht.
 *
 * Fehlt `team_structure` (aelterer Parser, PDF-Weg), bleibt der Rueckfall auf
 * die Teamzahl: bei einer Leitungsrolle ist sie die Fuehrungsspanne, sonst
 * die Zahl der Kolleg:innen. Die Einbindung ist dann nur ein Vorschlag, und
 * genau so steht sie auch da ("aus der Anzeige -- stimmt?").
 */
export function aufbauAusAnzeige(
  ts: TeamStructureParsed | null | undefined,
  rueckfall: { teamSize?: unknown; leitung?: boolean } = {},
): Abteilungsaufbau | null {
  const e = String(ts?.einbindung ?? '').trim() as Einbindung;
  if (ts && e in ZWEIGE) {
    const a: Abteilungsaufbau = { einbindung: e };
    const setz = <K extends keyof Abteilungsaufbau>(k: K, v: Abteilungsaufbau[K] | undefined) => {
      if (v !== undefined) a[k] = v;
    };
    setz('team', ganz(ts.direct_team));
    setz('fuehrt', ganz(ts.leads));
    setz('teams', ganz(ts.teams));
    setz('ziel', ganz(ts.target_size));
    const f = String(ts.leadership ?? '').trim();
    if (f === 'fachlich' || f === 'disziplinarisch' || f === 'beides') a.fuehrung = f;
    const rollen = (ts.roles ?? [])
      .map((r) => ({ rolle: String(r?.role ?? '').trim(), anzahl: ganz(r?.count) ?? 1 }))
      .filter((r) => r.rolle);
    if (rollen.length) a.rollen = rollen;
    const groesse = ganz(ts.department_size);
    const name = String(ts.department_name ?? '').trim();
    if (groesse || name) a.abteilung = { ...(name ? { name } : {}), ...(groesse ? { groesse } : {}) };
    const sch = (ts.interfaces ?? []).map((x) => String(x ?? '').trim()).filter(Boolean);
    if (sch.length) a.schnittstellen = [...new Set(sch)];
    return aufbauBereinigt(a);
  }

  const n = ganz(rueckfall.teamSize);
  if (!n) return null;
  return rueckfall.leitung ? { einbindung: 'leitung', fuehrt: n } : { einbindung: 'team', team: n };
}

const ZAHLWORT = /^(?:\d+\s*(?:x|×)?\s+|(?:ein|eine|einen|einer|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|mehrere|einige|weitere)\s+)/i;

/**
 * KI-Vorschlaege als EINZELNE Bezeichnungen.
 *
 * Befund (Durchklicken 24.09.2026): Auf "Wer ist im Team?" kamen ganze
 * Teams zurueck -- "Zwei Finanzbuchhalter und ein Debitorenbuchhalter" --
 * obwohl jede Rolle ein eigener Chip mit Zaehler ist. Hier werden sie
 * zerlegt: an Komma, "und", "sowie"; Zahlwoerter vorn fallen weg (die Zahl
 * setzt der Kunde mit +/-). "Debitoren- und Kreditorenbuchhalter" bleibt
 * zusammen -- der Bindestrich sagt, dass das eine Rolle ist.
 */
export function einzelneBezeichnungen(liste: string[] | null | undefined, max = 8): string[] {
  const out: string[] = [];
  const gesehen = new Set<string>();
  for (const roh of liste ?? []) {
    const teile = String(roh ?? '').split(/\s*(?:,|;|\+|\bsowie\b|\bund\b)\s*/i).filter((t) => t !== undefined);
    const zusammen: string[] = [];
    for (let i = 0; i < teile.length; i++) {
      const t = teile[i].trim();
      if (t.endsWith('-') && i + 1 < teile.length) {
        zusammen.push(`${t} und ${teile[++i].trim()}`);
      } else if (t) {
        zusammen.push(t);
      }
    }
    for (const z of zusammen) {
      const name = z.replace(ZAHLWORT, '').replace(/\s*\((?:m\/w\/d|w\/m\/d|m\/w|d)\)\s*$/i, '').trim();
      if (name.length < 2 || name.length > 40) continue;
      const k = name.toLowerCase();
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      out.push(name);
      if (out.length >= max) return out;
    }
  }
  return out;
}
