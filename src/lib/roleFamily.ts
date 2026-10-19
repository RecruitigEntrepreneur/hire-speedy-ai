// Rollenfamilie: welche Antwortvorschläge im Interview zur Person passen.
// Ein CEO bekam bisher dieselben Vorschläge wie ein Buchhalter, darunter
// „Bereichsleitung“ (Durchklicken 15.10.2026). Die Familie kommt aus Titel,
// Stufe und Führung – nie aus Alter, Geschlecht oder Herkunft. Sie steuert nur
// Vorschläge, nie eine Bewertung. Keine Phrase enthält ein Komma, weil Chips
// ihre Phrase kommagetrennt ins Freitextfeld schreiben (togglePhrase).

import type { DossierForm } from '@/lib/candidateDossier';

export type RoleFamily = 'clevel' | 'fuehrung' | 'spezialist' | 'it' | 'vertrieb' | 'gewerblich';

export const FAMILY_LABEL: Record<RoleFamily, string> = {
  clevel: 'Geschäftsführung',
  fuehrung: 'Führungskraft',
  spezialist: 'Spezialist',
  it: 'IT und Technik',
  vertrieb: 'Vertrieb',
  gewerblich: 'Gewerblich und Pflege',
};

const CLEVEL = /\b(ceo|cfo|coo|cto|cio|cmo|chro|chief|vorstand|vorständin|geschäftsführ\w*|managing director|general manager|country manager|inhaber\w*)\b/i;
const GEWERBLICH = /pflege|krankenschwester|krankenpfleg|\bmfa\b|hebamme|erzieher|elektroniker|mechatroniker|monteur|schlosser|schweißer|lager|fahrer|maschinen(führer|bediener)|produktion|meister\b|fachkraft für/i;
const IT = /entwickl|developer|engineer|software|devops|administrat|architekt|\bdata\b|cloud|\bsap\b|security|scrum|product owner/i;
const VERTRIEB = /vertrieb|sales|key account|account (manager|executive)|business development|außendienst|gebietsleit|verkauf/i;
/** Titel mit Personalverantwortung („Manager“ allein zählt nicht). */
export const LEADER_TITLE = /\b(geschäftsführ\w*|ceo|cfo|coo|cto|cio|vorstand|managing director|director|leiter\w*|leitung|head of|teamlead\w*|team lead|abteilungsleit\w*|bereichsleit\w*|meister)\b/i;

export function isLeaderTitle(title: string | null | undefined): boolean {
  return LEADER_TITLE.test(title ?? '');
}

export function detectRoleFamily(f: Pick<DossierForm, 'job_title' | 'seniority' | 'leadership_scope'>): RoleFamily {
  const t = f.job_title ?? '';
  if (CLEVEL.test(t)) return 'clevel';
  if (GEWERBLICH.test(t)) return 'gewerblich';
  if (IT.test(t)) return 'it';
  if (VERTRIEB.test(t)) return 'vertrieb';
  if (LEADER_TITLE.test(t) || f.leadership_scope === 'disciplinary' || f.seniority === 'lead' || f.seniority === 'director') return 'fuehrung';
  return 'spezialist';
}

/** „Was gefällt, was stört“ und „Auslöser“ haben eigene Knöpfe mit Satzbausteinen: situationMotives.ts. */
export interface FamilyChips {
  ziel: string[];
  jetzt: string[];
  funktioniert: string[];
  weniger: string[];
  getan: string[];
  staerken: string[];
  risiken: string[];
}

/** „Warum gerade jetzt?“ für alle Familien; die Familie ergänzt vorn. */
const JETZT_ALLGEMEIN = ['Neue Führung oder Eigentümer', 'Umstrukturierung', 'Aufgabe abgeschlossen', 'Wurde angesprochen', 'Läuft schon länger'];

export const FAMILY_CHIPS: Record<RoleFamily, FamilyChips> = {
  clevel: {
    ziel: ['Größere Geschäftsführung', 'Beirat oder Aufsichtsrat', 'Operating Partner', 'Interim-Mandate', 'Mit eigener Beteiligung', 'Internationale Gesamtverantwortung'],
    jetzt: ['Vertrag läuft aus', 'Exit abgeschlossen'],
    funktioniert: ['Ergebnis gedreht', 'Netzwerk', 'Beteiligung verhandelt', 'Team aufgebaut'],
    weniger: ['Gesellschafter wollten anders', 'Verkauf kam dazwischen', 'Branchenwechsel klappte nicht', 'Keine passende Rolle frei'],
    getan: ['Netzwerk aufgebaut', 'Mandate gesucht', 'Mit Gesellschaftern gesprochen'],
    staerken: ['Ergebnisse belegt', 'Glaubwürdige Wechselgeschichte', 'Starkes Netzwerk', 'Führung belegt'],
    risiken: ['Risiko: lange Kündigungsfrist', 'Risiko: Wettbewerbsverbot', 'Risiko: Gehaltsvorstellung hoch'],
  },
  fuehrung: {
    ziel: ['Nächste Führungsebene', 'Größeres Team', 'Ergebnisverantwortung', 'Geschäftsführung mittelfristig', 'Fachkarriere statt Führung'],
    jetzt: ['Keine Aufstiegsstelle frei'],
    funktioniert: ['Projekt übernommen', 'Interne Beförderung', 'Mentor', 'Team aufgebaut'],
    weniger: ['Externer vorgezogen', 'Umbau stoppte Beförderung', 'Kein Budget für das Team'],
    getan: ['Mehr Verantwortung übernommen', 'Führungsweiterbildung', 'Intern beworben'],
    staerken: ['Führung belegt', 'Stabiler Werdegang', 'Klare Wechselgründe'],
    risiken: ['Risiko: Gegenangebot', 'Risiko: lange Kündigungsfrist'],
  },
  spezialist: {
    ziel: ['Senior- oder Expertenrolle', 'Erste Führungsaufgabe', 'Projektverantwortung', 'Spezialisierung', 'Fachkarriere'],
    jetzt: ['Weiterbildung abgeschlossen'],
    funktioniert: ['Weiterbildung', 'Projekte übernommen', 'Unterstützung durch Vorgesetzte', 'Netzwerk'],
    weniger: ['Keine Stelle frei', 'Ohne Abschluss chancenlos', 'Budget fehlte', 'Kein Rückhalt'],
    getan: ['Weiterbildung begonnen', 'Mehr Verantwortung übernommen', 'Intern beworben', 'Mit Vorgesetzten gesprochen'],
    staerken: ['Fachlich sicher', 'Zuverlässig', 'Klare Wechselgründe'],
    risiken: ['Risiko: Gehaltsvorstellung', 'Risiko: Gegenangebot'],
  },
  it: {
    ziel: ['Senior Engineer', 'Staff Engineer', 'Architektur', 'Tech Lead', 'Engineering Manager', 'Näher am Produkt'],
    jetzt: ['Projekt abgeschlossen'],
    funktioniert: ['Thema selbst eingeführt', 'Zertifikat', 'Wechsel ins Team', 'Open Source'],
    weniger: ['Kein Aufstieg ohne Führung', 'Technikwechsel abgelehnt', 'Budget fehlte'],
    getan: ['Zertifikat gemacht', 'Eigene Projekte', 'Intern beworben'],
    staerken: ['Starke Technik', 'Klare Erwartung', 'Lernt schnell'],
    risiken: ['Risiko: mehrere Angebote', 'Risiko: Remote-Wunsch'],
  },
  vertrieb: {
    ziel: ['Größere Kunden', 'Teamleitung Vertrieb', 'Head of Sales', 'Neues Gebiet oder international', 'Anderes Produkt'],
    jetzt: ['Bonus ausgezahlt'],
    funktioniert: ['Ziel übertroffen', 'Großkunde gewonnen', 'Gebiet aufgebaut'],
    weniger: ['Ziele erhöht', 'Beförderung ging an andere', 'Produkt nicht konkurrenzfähig'],
    getan: ['Großkunden übernommen', 'Intern beworben', 'Weiterbildung'],
    staerken: ['Zahlen belegt', 'Branchennetzwerk', 'Klare Wechselgründe'],
    risiken: ['Risiko: Kundenschutzklausel', 'Risiko: Gegenangebot'],
  },
  gewerblich: {
    ziel: ['Schicht- oder Stationsleitung', 'Meister oder Techniker', 'Fachweiterbildung', 'Feste Tagschicht', 'Spezialbereich'],
    jetzt: ['Weiterbildung abgeschlossen'],
    funktioniert: ['Fachweiterbildung', 'Praxisanleitung', 'Leitung vertreten'],
    weniger: ['Kein Weiterbildungsplatz', 'Wegen Personalmangel nicht freigestellt'],
    getan: ['Fachweiterbildung', 'Leitung vertreten', 'Intern beworben'],
    staerken: ['Abschluss vorhanden', 'Zuverlässig', 'Erfahren im Bereich'],
    risiken: ['Risiko: Wunschdienste selten', 'Risiko: Arbeitsweg'],
  },
};

export function whyNowChips(family: RoleFamily): string[] {
  return [...new Set([...FAMILY_CHIPS[family].jetzt, ...JETZT_ALLGEMEIN])];
}

/** Übliche Kündigungsfrist als Vorschlag (nie gesetzt). Werte wie in NOTICE_DURATIONS/ANCHORS. */
export const NOTICE_HINT: Record<RoleFamily, { duration: string; anchor: string | null; label: string } | null> = {
  clevel: { duration: '6_months', anchor: 'eoq', label: 'Üblich bei Geschäftsführern: 6 Monate zum Quartalsende' },
  fuehrung: { duration: '3_months', anchor: 'eoq', label: 'Üblich bei Führungskräften: 3 Monate zum Quartalsende' },
  spezialist: { duration: '3_months', anchor: 'eom', label: 'Häufig: 3 Monate zum Monatsende' },
  it: { duration: '3_months', anchor: 'eom', label: 'Häufig: 3 Monate zum Monatsende' },
  vertrieb: { duration: '3_months', anchor: 'eoq', label: 'Häufig im Vertrieb: 3 Monate zum Quartalsende' },
  gewerblich: { duration: '4_weeks', anchor: '15_eom', label: 'Gesetzlich: 4 Wochen zum 15. oder Monatsende' },
};

/** Nachfrage zu Wettbewerbsverbot oder Freistellung nur, wo es üblich ist. */
export const ASK_NON_COMPETE: Record<RoleFamily, boolean> = {
  clevel: true, vertrieb: true, fuehrung: false, spezialist: false, it: false, gewerblich: false,
};

/** Wunschrollen und Ziele unterhalb der heutigen Ebene (für den Widerspruchs-Hinweis). */
export function belowLevel(family: RoleFamily, role: string): boolean {
  if (family !== 'clevel') return false;
  return /\b(bereichsleit\w*|abteilungsleit\w*|teamleit\w*|gruppenleit\w*)\b/i.test(role);
}
