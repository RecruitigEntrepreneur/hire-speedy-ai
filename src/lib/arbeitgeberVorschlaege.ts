/**
 * Vorschläge fürs Arbeitgeberprofil aus der ersten Stelle (Variante B,
 * Entscheidung 26.09.2026).
 *
 * Was je nach Stelle anders sein kann -- Arbeitsweise, Arbeitgeberargumente,
 * Benefits, Ziel- und No-Go-Firmen -- wandert NICHT still ins Profil. Die
 * Einstellungsseite schlägt es vor, der Kunde übernimmt mit einem Klick. So
 * muss er es für die nächste Stelle nicht wieder eintippen.
 */

export type ArbeitgeberFeld =
  | 'culture_values' | 'employer_selling_points' | 'benefits' | 'target_companies' | 'excluded_companies';

export const ARBEITGEBER_FELDER: { feld: ArbeitgeberFeld; label: string; hilfe: string }[] = [
  { feld: 'culture_values', label: 'Wie arbeitet man bei Ihnen zusammen?', hilfe: 'Kultur, Hierarchien, Werkzeuge' },
  { feld: 'employer_selling_points', label: 'Was macht Sie als Arbeitgeber attraktiv?', hilfe: 'Die Argumente, mit denen Recruiter Sie vorstellen' },
  { feld: 'benefits', label: 'Benefits', hilfe: 'Gilt für Festanstellungen' },
  { feld: 'target_companies', label: 'Ziel-Unternehmen', hilfe: 'Wo Recruiter gezielt suchen sollen' },
  { feld: 'excluded_companies', label: 'No-Go-Unternehmen', hilfe: 'Wo Recruiter nicht abwerben sollen' },
];

/** Die Stelle, aus der vorgeschlagen wird (jobs, jüngste aus einer Aufnahme). */
export interface VorschlagStelle {
  id: string;
  title: string | null;
  employment_type: string | null;
  company_culture: string | null;
  unique_selling_points: string[] | null;
  benefits: string[] | null;
  target_companies: string[] | null;
  nogo_companies: string[] | null;
}

/** Liste aus Json-Array, Textarray oder Freitext ("a · b", Zeilen, Semikolon). */
export function listeAus(v: unknown): string[] {
  const roh = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\s*(?:·|\n|;)\s*/) : [];
  const out: string[] = [];
  for (const x of roh) {
    const s = String(x ?? '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export interface Vorschlag {
  feld: ArbeitgeberFeld;
  werte: string[];
}

/** Nur für Felder, die im Profil noch leer sind und zu denen die Stelle etwas weiß. */
export function arbeitgeberVorschlaege(
  stelle: VorschlagStelle | null | undefined,
  profil: Partial<Record<ArbeitgeberFeld, unknown>> | null | undefined,
): Vorschlag[] {
  if (!stelle) return [];
  const aus: Record<ArbeitgeberFeld, string[]> = {
    culture_values: listeAus(stelle.company_culture),
    employer_selling_points: listeAus(stelle.unique_selling_points),
    // Contracting-Chips ("Reisekosten werden erstattet") sind Projektbedingungen,
    // keine Arbeitgeber-Benefits.
    benefits: stelle.employment_type === 'freelance' ? [] : listeAus(stelle.benefits),
    target_companies: listeAus(stelle.target_companies),
    excluded_companies: listeAus(stelle.nogo_companies),
  };
  return ARBEITGEBER_FELDER
    .map(({ feld }) => ({ feld, werte: aus[feld] }))
    .filter(({ feld, werte }) => werte.length > 0 && listeAus(profil?.[feld]).length === 0);
}
