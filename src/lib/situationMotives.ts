// „Was gefällt, was stört“ im Interview: Knöpfe je Rollenfamilie und daraus eine
// Auswertung nur für den Headhunter (Sätze, was die neue Stelle bieten muss,
// Such-Tipp, Fragen an den Kunden, Hinweise). Feste Satzbausteine, keine KI, nie
// für den Kunden. Gespeichert wird wie bisher kommagetrennt in current_positive /
// current_negative; die Klick-Reihenfolge ist die Wichtigkeit (die ersten 3 zählen).
// Geprüft über alle Kombinationen bis 3 Knöpfe je Seite (situationMotives.test.ts).

import type { RoleFamily } from '@/lib/roleFamily';
import { ALL_GOALS, goalClientText, goalTheme } from '@/lib/careerGoals';

export type MotiveSide = 'pos' | 'neg';
export type MotiveFlow = 'pendeln' | 'arbeitsmodell' | 'gehalt' | 'kundenschutz' | 'leaver';

export interface MotiveEntry {
  /** Nominativ mit Artikel für „Am meisten gefällt/stört …“, ohne Komma. */
  nom: string;
  /** Akkusativ für „Die neue Stelle muss bieten:“, ohne „wie heute“. */
  need: string;
  /** Thema; gleiches Thema auf beiden Seiten ist ein Widerspruch oder ein Verlust. */
  pair: string;
  pl?: boolean;
  group?: 'gehalt' | 'team' | 'chef';
  /** Stör-Knopf beschreibt eine Veränderung: was dazu gefällt, fällt gerade weg. */
  change?: boolean;
  /** Weitere Themen, die durch die Veränderung wegfallen. */
  loses?: string[];
  offer?: string;
  client?: string;
  ask?: string;
  search?: string;
  tag?: string;
  trigger?: string;
  flow?: MotiveFlow;
  needBy?: Partial<Record<RoleFamily, string>>;
  clientBy?: Partial<Record<RoleFamily, string>>;
  /** Alter Knopf, der zwei Dinge vermischt: diese genauen Knöpfe stehen zur Wahl. Nie im Kundentext. */
  ambiguous?: string[];
  /** Ungenauer Knopf: nach dem Klick „Wie genau?“ mit diesen genauen Knöpfen. */
  details?: string[];
  /** Genauer Knopf zu einem ungenauen (ersetzt ihn an derselben Stelle). */
  detailOf?: string;
}

const GELD_KUNDE = 'Welche Gehaltsspanne ist für die Stelle freigegeben, und gibt es Spielraum nach oben?';
const GELD_SUCHE = 'Nur Stellen vorschlagen, deren Budget spürbar über dem heutigen Gehalt liegt.';
const CHEF_KUNDE = 'Wie führt die künftige Führungskraft? Ist ein Kennenlernen vor dem Vertrag möglich?';
const GESTALT_KUNDE = 'Was darf die Rolle allein entscheiden, was muss abgestimmt werden?';
const TECH_KUNDE = 'Mit welchem Stack arbeitet das Team, und wie alt ist der Code?';
const REMOTE_KUNDE = 'Wie viele Bürotage sind Pflicht, und ist das vertraglich geregelt?';
const UMBAU_KUNDE = 'Steht im Unternehmen gerade ein Umbau oder Verkauf an?';
const GEBIET_KUNDE = 'Welches Gebiet und welche Bestandskunden gehören zur Rolle?';
const DIENST_KUNDE = 'Wie lange im Voraus steht der Dienstplan, und wie oft muss eingesprungen werden?';
const PENDEL_SUCHE = 'Nur Stellen in Pendelnähe vorschlagen.';

export const MOTIVE_POS: Record<string, MotiveEntry> = {
  'Team': { nom: 'das Team', need: 'ein Team mit guter Zusammenarbeit', pair: 'team', group: 'team', offer: 'Gutes Team', client: 'Wie ist das Team aufgestellt, und wie lange sind die Leute schon dabei?' },
  'Mein Team': { nom: 'das eigene Team', need: 'ein gutes Team', pair: 'team', group: 'team', offer: 'Gutes Team', client: 'Wie groß ist das Team, und sind Stellen offen?' },
  'Selbst aufgebautes Team': { nom: 'das selbst aufgebaute Team', need: 'ein Team mit Entwicklungspotenzial', pair: 'team', group: 'team', offer: 'Gutes Team', client: 'Wie ist die zweite Führungsebene besetzt?' },
  'Aufgaben': { pl: true, nom: 'die Aufgaben', need: 'inhaltlich spannende Aufgaben', pair: 'aufgaben', offer: 'Fachliche Herausforderung', client: 'Womit verbringt die Rolle den Großteil der Woche?' },
  'Gute Führungskraft': { nom: 'die direkte Führungskraft', need: 'eine gute Führungskraft', pair: 'chef', group: 'chef', client: CHEF_KUNDE },
  'Flexibilität': { nom: 'die Flexibilität bei Zeit und Ort', need: 'Flexibilität bei Zeit und Ort', pair: 'flex', offer: 'Flexible Zeiten', client: 'Wie viele Homeoffice-Tage sind möglich, und gibt es Kernzeiten?', flow: 'arbeitsmodell' },
  'Gehalt': { nom: 'das Gehalt', need: 'ein mindestens gleich hohes Gehalt', pair: 'gehalt', group: 'gehalt' },
  'Bezahlung': { nom: 'die Bezahlung', need: 'eine mindestens gleich hohe Bezahlung', pair: 'gehalt', group: 'gehalt' },
  'Verdienst': { nom: 'der Verdienst', need: 'einen mindestens gleich hohen Verdienst', pair: 'gehalt', group: 'gehalt' },
  'Vergütung': { nom: 'die Vergütung', need: 'eine mindestens gleich hohe Vergütung', pair: 'gehalt', group: 'gehalt' },
  'Arbeitsweg': { nom: 'der kurze Arbeitsweg', need: 'einen kurzen Arbeitsweg', pair: 'weg', offer: 'Kurzer Arbeitsweg', search: PENDEL_SUCHE, flow: 'pendeln' },
  'Nähe zum Wohnort': { nom: 'die Nähe zum Wohnort', need: 'einen kurzen Arbeitsweg', pair: 'weg', offer: 'Kurzer Arbeitsweg', search: PENDEL_SUCHE, flow: 'pendeln' },
  'Stabilität': { nom: 'die Stabilität des Unternehmens', need: 'ein wirtschaftlich stabiles Unternehmen', pair: 'stabil', offer: 'Stabiles Unternehmen', search: 'Eher etablierte Unternehmen, keine Sanierungsfälle und keine frühen Start-ups.', client: 'Wie hat sich das Unternehmen in den letzten zwei Jahren entwickelt?' },
  'Tarifvertrag': { nom: 'der Tarifvertrag', need: 'einen Arbeitgeber mit Tarifvertrag', pair: 'tarif', offer: 'Stabiles Unternehmen', search: 'Tarifgebundene Arbeitgeber zuerst vorschlagen.', client: 'Gibt es einen Tarifvertrag, und welche Eingruppierung ist geplant?' },
  'Weiterbildung': { pl: true, nom: 'die Weiterbildungsmöglichkeiten', need: 'echte Weiterbildungsmöglichkeiten', pair: 'weiterbildung', offer: 'Weiterbildung', client: 'Gibt es ein Weiterbildungsbudget pro Person?' },
  'Gestaltungsspielraum': { nom: 'der Gestaltungsspielraum', need: 'viel Gestaltungsspielraum', pair: 'gestaltung', offer: 'Gestaltungsspielraum', client: GESTALT_KUNDE },
  'Unternehmenskultur': { nom: 'die Unternehmenskultur', need: 'eine gute Unternehmenskultur', pair: 'kultur', offer: 'Unternehmenskultur', client: 'Wie würden die Mitarbeitenden die Kultur beschreiben?' },
  'Technik': { nom: 'die eingesetzte Technik', need: 'einen modernen Technikstack', pair: 'technik', offer: 'Moderne Arbeitsmittel', client: TECH_KUNDE },
  'Remote': { nom: 'das Remote-Arbeiten', need: 'mindestens so viel Remote', pair: 'remote', offer: 'Remote oder hybrid', search: 'Nur Stellen mit klarer Remote-Regel vorschlagen.', client: REMOTE_KUNDE, flow: 'arbeitsmodell' },
  'Freiheit bei Lösungen': { nom: 'die Freiheit bei technischen Lösungen', need: 'Mitsprache bei technischen Lösungen', pair: 'techfrei', offer: 'Gestaltungsspielraum', client: 'Wer entscheidet im Team über Technik und Architektur?' },
  'Produkt': { nom: 'das Produkt', need: 'ein Produkt mit Substanz', pair: 'produkt', offer: 'Fachliche Herausforderung', client: 'Wie steht das Produkt im Wettbewerb da?' },
  'Kundenbeziehungen': { pl: true, nom: 'die gewachsenen Kundenbeziehungen', need: 'vergleichbare Kunden', pair: 'kunden', client: GEBIET_KUNDE, flow: 'kundenschutz' },
  'Freie Tagesplanung': { nom: 'die freie Tagesplanung', need: 'eine freie Tagesplanung', pair: 'freiheit' },
  'Firmenwagen': { nom: 'der Firmenwagen', need: 'einen vergleichbaren Firmenwagen', pair: 'wagen', offer: 'Firmenwagen', client: 'Gibt es einen Firmenwagen, und welche Klasse?' },
  'Arbeit mit Menschen': { nom: 'die Arbeit mit Menschen', need: 'direkten Kontakt zu Menschen', pair: 'menschen' },
  'Feste Arbeitszeiten': { pl: true, nom: 'die festen Arbeitszeiten', need: 'feste und planbare Arbeitszeiten', pair: 'schicht', client: DIENST_KUNDE },
  'Gestaltungsfreiheit': { nom: 'die unternehmerische Freiheit', need: 'echte unternehmerische Freiheit', pair: 'gestaltung', offer: 'Gestaltungsspielraum', client: 'Wie viel Freiheit lassen die Gesellschafter der Geschäftsführung?' },
  'Ergebnisverantwortung': { nom: 'die volle Ergebnisverantwortung', need: 'volle Ergebnisverantwortung', pair: 'ergebnis', offer: 'Führungsverantwortung', client: 'Trägt die Rolle die volle Ergebnisverantwortung, oder entscheidet eine Holding mit?' },
  'Unabhängigkeit': { nom: 'die Unabhängigkeit von einer Konzernzentrale', need: 'kurze Entscheidungswege ohne Konzernzentrale', pair: 'unab', search: 'Eher inhaber- oder investorengeführte Häuser als Konzerntöchter.' },
  'Beteiligung': { nom: 'die eigene Beteiligung', need: 'eine echte Beteiligung am Erfolg', pair: 'beteiligung', offer: 'Bonus', client: 'Ist eine Beteiligung für die Geschäftsführung vorgesehen?', flow: 'leaver' },
};

export const MOTIVE_NEG: Record<string, MotiveEntry> = {
  'Keine Entwicklung': { nom: 'die stockende Entwicklung', need: 'eine klare nächste Stufe', pair: 'entwicklung', offer: 'Entwicklungsperspektive', tag: 'Karriere', ask: 'Was wäre Ihr nächster Schritt, und warum geht er intern nicht?', client: 'Welche Entwicklung ist in der Rolle in zwei bis drei Jahren möglich?' },
  'Wenig Gestaltungsspielraum': { nom: 'der geringe Gestaltungsspielraum', need: 'mehr Gestaltungsspielraum', pair: 'gestaltung', offer: 'Gestaltungsspielraum', tag: 'Verantwortung', ask: 'Woran ist zuletzt eine Idee von Ihnen gescheitert?', client: GESTALT_KUNDE },
  'Kein eigenes Budget': { nom: 'das fehlende eigene Budget', need: 'ein eigenes Budget', pair: 'budget', offer: 'Gestaltungsspielraum', tag: 'Verantwortung', ask: 'Über welches Budget würden Sie gern selbst entscheiden?', client: 'Hat die Rolle ein eigenes Budget, und in welcher Höhe?' },
  'Kaum Entscheidungsrecht': { nom: 'das fehlende Entscheidungsrecht', need: 'echte Entscheidungsbefugnis', pair: 'entscheidung', offer: 'Gestaltungsspielraum', tag: 'Verantwortung', ask: 'Was dürfen Sie heute nicht selbst entscheiden, obwohl Sie es gern würden?', client: GESTALT_KUNDE },
  'Kein Budget oder Entscheidungsrecht': { nom: 'die fehlende Freiheit bei Budget oder Entscheidungen', need: 'mehr Freiheit bei Budget oder Entscheidungen', pair: 'budget', tag: 'Verantwortung', ambiguous: ['Kein eigenes Budget', 'Kaum Entscheidungsrecht'], ask: 'Fehlt das eigene Budget, das Entscheidungsrecht oder beides?' },
  'Probleme mit der Führungskraft': { nom: 'das Verhältnis zur Führungskraft', need: 'eine unterstützende Führungskraft', pair: 'chef', group: 'chef', ask: 'Was müsste Ihre nächste Führungskraft anders machen?', client: CHEF_KUNDE, details: ['Führungskraft entscheidet allein', 'Führungskraft mischt sich überall ein', 'Wenig Rückendeckung', 'Führungskraft kaum erreichbar'] },
  'Führungskraft entscheidet allein': { nom: 'die Alleingänge der Führungskraft', need: 'Mitsprache bei Entscheidungen', pair: 'chef', group: 'chef', detailOf: 'Probleme mit der Führungskraft', ask: 'Bei welcher Entscheidung hätten Sie zuletzt gern mitgeredet?', client: CHEF_KUNDE },
  'Führungskraft mischt sich überall ein': { nom: 'das Mikromanagement der Führungskraft', need: 'Vertrauen und Freiraum im Alltag', pair: 'chef', group: 'chef', detailOf: 'Probleme mit der Führungskraft', ask: 'Woran merken Sie das im Alltag am deutlichsten?', client: CHEF_KUNDE },
  'Wenig Rückendeckung': { nom: 'die fehlende Rückendeckung von oben', need: 'Rückendeckung durch die Führung', pair: 'chef', group: 'chef', detailOf: 'Probleme mit der Führungskraft', ask: 'In welcher Situation hätten Sie zuletzt Rückendeckung gebraucht?', client: CHEF_KUNDE },
  'Führungskraft kaum erreichbar': { nom: 'die schlechte Erreichbarkeit der Führungskraft', need: 'eine erreichbare Führungskraft', pair: 'chef', group: 'chef', detailOf: 'Probleme mit der Führungskraft', ask: 'Wie oft haben Sie heute wirklich Kontakt zu Ihrer Führungskraft?', client: CHEF_KUNDE },
  'Neue Führungskraft': { nom: 'die neue Führungskraft', need: 'eine unterstützende Führungskraft', pair: 'chef', group: 'chef', change: true, trigger: 'Neue Führungskraft', ask: 'Was hat sich mit der neuen Führungskraft konkret geändert?', client: CHEF_KUNDE },
  'Arbeitslast': {
    nom: 'die hohe Arbeitslast', need: 'eine realistische Arbeitslast', pair: 'last', tag: 'Work-Life-Balance', ask: 'Wie viele Stunden hat eine normale Woche bei Ihnen?',
    client: 'Wie viele Überstunden sind in der Rolle üblich, und ist das Team voll besetzt?',
    clientBy: { clevel: 'Welche Wochenarbeitszeit erwarten die Gesellschafter realistisch, und wer entlastet die Geschäftsführung?' },
  },
  'Gehalt': { nom: 'das Gehalt', need: 'ein spürbar besseres Gehalt', pair: 'gehalt', group: 'gehalt', offer: 'Gehaltssprung', tag: 'Gehalt', ask: 'Ab welchem Betrag würden Sie ernsthaft wechseln?', client: GELD_KUNDE, search: GELD_SUCHE, flow: 'gehalt' },
  'Gehalt unter Markt': { nom: 'das Gehalt unter Marktniveau', need: 'ein Gehalt auf Marktniveau', pair: 'gehalt', group: 'gehalt', offer: 'Gehaltssprung', tag: 'Gehalt', ask: 'Welche Zahl haben Sie als Marktwert im Kopf, und woher?', client: GELD_KUNDE, search: GELD_SUCHE, flow: 'gehalt' },
  'Bezahlung': { nom: 'die Bezahlung', need: 'eine bessere Bezahlung', pair: 'gehalt', group: 'gehalt', offer: 'Gehaltssprung', tag: 'Gehalt', ask: 'Welche Zulagen bekommen Sie heute?', client: 'Welche Zulagen gibt es für Nacht, Wochenende und Feiertag?', search: GELD_SUCHE, flow: 'gehalt' },
  'Vergütung': { nom: 'die Vergütung', need: 'eine bessere Vergütung', pair: 'gehalt', group: 'gehalt', offer: 'Gehaltssprung', tag: 'Gehalt', ask: 'Welcher Teil passt nicht: fix, variabel oder Beteiligung?', client: 'Wie ist die Vergütung aufgeteilt in fix, variabel und Beteiligung?', search: GELD_SUCHE, flow: 'gehalt' },
  'Fixum zu niedrig': { nom: 'das niedrige Fixum', need: 'ein höheres Fixum', pair: 'gehalt', group: 'gehalt', offer: 'Gehaltssprung', tag: 'Gehalt', ask: 'Wie hoch ist Ihr Fixum, und wie viel kommt im Schnitt über Provision dazu?', client: GELD_KUNDE, search: GELD_SUCHE, flow: 'gehalt' },
  'Provision gekürzt': { nom: 'die gekürzte Provision', need: 'ein faires und verlässliches Provisionsmodell', pair: 'gehalt', group: 'gehalt', change: true, offer: 'Bonus', tag: 'Gehalt', trigger: 'Provision gekürzt', ask: 'Um wie viel ist die Provision gesunken?', client: 'Wie ist das Provisionsmodell aufgebaut, und was verdienen gute Leute im Schnitt?', search: GELD_SUCHE, flow: 'gehalt' },
  'Übernahme': { nom: 'die Übernahme', need: 'ein stabiles Umfeld ohne laufenden Umbau', pair: 'stabil', change: true, offer: 'Stabiles Unternehmen', tag: 'Sicherheit', trigger: 'Übernahme', ask: 'Was ändert die Übernahme konkret an Ihrer Rolle?', client: UMBAU_KUNDE },
  'Umstrukturierung': { nom: 'die Umstrukturierung', need: 'ein stabiles Umfeld ohne laufenden Umbau', pair: 'stabil', change: true, offer: 'Stabiles Unternehmen', tag: 'Sicherheit', trigger: 'Neuorganisation', ask: 'Was ändert die Umstrukturierung konkret an Ihrer Rolle?', client: UMBAU_KUNDE },
  'Übernahme oder Umstrukturierung': { nom: 'der Umbruch im Unternehmen', need: 'ein stabiles Umfeld ohne laufenden Umbau', pair: 'stabil', change: true, offer: 'Stabiles Unternehmen', tag: 'Sicherheit', ambiguous: ['Übernahme', 'Umstrukturierung'], ask: 'War es eine Übernahme, eine Umstrukturierung oder beides?', client: UMBAU_KUNDE },
  'Zu viel Verwaltung': { nom: 'der hohe Verwaltungsanteil', need: 'weniger Verwaltungsaufwand', pair: 'verwaltung', ask: 'Wie viel Ihrer Woche geht heute für Verwaltung drauf?', client: 'Wie viel Reporting und Verwaltung gehört zur Rolle?' },
  'Arbeitsweg': {
    nom: 'der lange Arbeitsweg', need: 'einen kürzeren Arbeitsweg oder mehr Homeoffice', pair: 'weg', offer: 'Kurzer Arbeitsweg', tag: 'Standort',
    ask: 'Wie lange brauchen Sie heute, und was wäre in Ordnung?', search: PENDEL_SUCHE, flow: 'pendeln', needBy: { gewerblich: 'einen kürzeren Arbeitsweg' },
  },
  'Unternehmenskultur': { nom: 'die Unternehmenskultur', need: 'eine passende Unternehmenskultur', pair: 'kultur', offer: 'Unternehmenskultur', tag: 'Unternehmenskultur', ask: 'Was genau stört Sie an der Kultur, an einem Beispiel?', client: 'Wie würden die Mitarbeitenden die Kultur beschreiben?' },
  'Wenig Wertschätzung': { nom: 'die geringe Wertschätzung', need: 'sichtbare Anerkennung der eigenen Arbeit', pair: 'wert', tag: 'Unternehmenskultur', ask: 'Woran würden Sie Wertschätzung merken?' },
  'Eintönige Aufgaben': { pl: true, nom: 'die eintönigen Aufgaben', need: 'abwechslungsreiche Aufgaben', pair: 'aufgaben', offer: 'Fachliche Herausforderung', tag: 'Projekte', ask: 'Was haben Sie im letzten halben Jahr Neues gelernt?', client: 'Womit verbringt die Rolle den Großteil der Woche?' },
  'Veraltete Technik': { nom: 'die veraltete Technik', need: 'einen modernen Technikstack', pair: 'technik', offer: 'Moderne Arbeitsmittel', tag: 'Technologie', ask: 'Mit welcher Technik arbeiten Sie heute, und womit möchten Sie arbeiten?', client: TECH_KUNDE },
  'Remote gestrichen': { nom: 'die gestrichene Remote-Regel', need: 'eine verlässliche Remote-Regel', pair: 'remote', change: true, loses: ['flex'], offer: 'Remote oder hybrid', tag: 'Remote', trigger: 'Pflicht zur Rückkehr ins Büro', ask: 'Wie viele Bürotage wären für Sie noch in Ordnung?', client: REMOTE_KUNDE, flow: 'arbeitsmodell' },
  'Mehr Termine als Arbeit': { pl: true, nom: 'die vielen Termine', need: 'Zeit für konzentriertes Arbeiten', pair: 'verwaltung', ask: 'Wie viele Stunden am Tag verbringen Sie in Terminen?', client: 'Wie viele feste Termine hat das Team pro Woche?' },
  'Kein Einfluss auf Technik': { nom: 'der fehlende Einfluss auf Technikentscheidungen', need: 'Mitsprache bei Technikentscheidungen', pair: 'techfrei', offer: 'Gestaltungsspielraum', tag: 'Technologie', ask: 'Welche Technikentscheidung hätten Sie zuletzt anders getroffen?', client: 'Wer entscheidet im Team über Technik und Architektur?' },
  'Bereitschaftsdienst': { nom: 'der Bereitschaftsdienst', need: 'weniger Bereitschaftsdienst', pair: 'bereitschaft', tag: 'Work-Life-Balance', ask: 'Wie oft haben Sie Bereitschaft, und wie oft werden Sie gerufen?', client: 'Gibt es Bereitschaftsdienst, und wie wird er bezahlt?' },
  'Unrealistische Ziele': { pl: true, nom: 'die unrealistischen Vertriebsziele', need: 'erreichbare Ziele', pair: 'ziele', ask: 'Wie viel Prozent vom Ziel haben Sie im letzten Jahr erreicht?', client: 'Wie hoch ist das Ziel, und wie viele im Team erreichen es?' },
  'Gebiet verkleinert': { nom: 'das verkleinerte Gebiet', need: 'ein Gebiet mit echtem Potenzial', pair: 'gebiet', change: true, loses: ['kunden', 'gehalt'], trigger: 'Gebiet neu verteilt', ask: 'Was wurde Ihnen weggenommen, und was hat es Sie gekostet?', client: GEBIET_KUNDE },
  'Schwaches Produkt': { nom: 'das schwache Produkt im Wettbewerb', need: 'ein wettbewerbsfähiges Produkt', pair: 'produkt', ask: 'Gegen welchen Wettbewerber verlieren Sie am häufigsten?', client: 'Wie steht das Produkt im Wettbewerb da?' },
  'Zu viel Innendienst': { nom: 'der hohe Anteil an Innendienst und Reports', need: 'mehr Zeit beim Kunden', pair: 'innendienst', ask: 'Wie viele Tage pro Woche sind Sie wirklich beim Kunden?', client: 'Wie viel Innendienst und Reporting gehört zur Rolle?' },
  'Viel Reisen': { nom: 'der hohe Reiseanteil', need: 'weniger Reisetage', pair: 'reisen', offer: 'Wenig Reisen', ask: 'Wie viele Tage pro Woche sind Sie unterwegs, und was wäre in Ordnung?', client: 'Wie viele Reisetage hat die Rolle pro Woche?' },
  'Ständiges Einspringen': { nom: 'das ständige Einspringen', need: 'weniger Einspringen', pair: 'einspringen', tag: 'Arbeitszeiten', ask: 'Wie oft mussten Sie im letzten Monat einspringen?', client: 'Wie oft muss im Team eingesprungen werden, und gibt es einen Springerpool?' },
  'Schlechte Dienstplanung': { nom: 'die schlechte Dienstplanung', need: 'einen verlässlichen Dienstplan', pair: 'dienstplan', tag: 'Arbeitszeiten', ask: 'Wie kurzfristig erfahren Sie Ihren Dienstplan?', client: 'Wie lange im Voraus steht der Dienstplan?' },
  'Dienstplan und Einspringen': { nom: 'Dienstplan und Einspringen', need: 'einen verlässlichen Dienstplan', pair: 'einspringen', tag: 'Arbeitszeiten', ambiguous: ['Ständiges Einspringen', 'Schlechte Dienstplanung'], ask: 'Stört das Einspringen, der Dienstplan oder beides?', client: DIENST_KUNDE },
  'Nachtdienste': { pl: true, nom: 'die vielen Nachtdienste', need: 'weniger Nachtdienste', pair: 'nacht', tag: 'Arbeitszeiten', ask: 'Wie viele Nachtdienste haben Sie im Monat?', client: 'Wie viele Nachtdienste hat die Stelle im Monat?' },
  'Wochenenddienste': { pl: true, nom: 'die vielen Wochenenddienste', need: 'weniger Wochenenddienste', pair: 'wochenende', tag: 'Arbeitszeiten', ask: 'Wie viele Wochenenden arbeiten Sie im Monat?', client: 'Wie viele Wochenenddienste hat die Stelle im Monat?' },
  'Nacht und Wochenende': { pl: true, nom: 'die vielen Nacht- und Wochenenddienste', need: 'weniger Nacht- und Wochenenddienste', pair: 'nacht', tag: 'Arbeitszeiten', ambiguous: ['Nachtdienste', 'Wochenenddienste'], ask: 'Stören die Nachtdienste, die Wochenenden oder beides?' },
  'Personalmangel': { nom: 'der Personalmangel', need: 'eine gute Personalbesetzung', pair: 'last', tag: 'Work-Life-Balance', ask: 'Wie viele Stellen sind in Ihrem Team gerade unbesetzt?', client: 'Wie ist der Personalschlüssel, und wie viele Stellen sind offen?' },
  'Zu viel Dokumentation': { nom: 'der hohe Anteil an Dokumentation', need: 'weniger Dokumentationsaufwand', pair: 'doku', ask: 'Wie viel Zeit pro Schicht geht für Dokumentation drauf?', client: 'Wie wird dokumentiert, und gibt es dafür digitale Hilfen?' },
  'Konflikt mit den Gesellschaftern': { nom: 'der Konflikt mit den Gesellschaftern', need: 'Gesellschafter mit gleichem Blick auf Strategie und Tempo', pair: 'gesellschafter', ask: 'Worum geht der Konflikt: Strategie, Tempo oder Geld?', client: 'Wie arbeiten Gesellschafter und Geschäftsführung zusammen, und warum ist die Stelle frei?' },
  'Zu viel operative Detailarbeit': { nom: 'der hohe Anteil an Tagesgeschäft', need: 'eine Rolle mit strategischem Schwerpunkt', pair: 'operativ', ask: 'Wer fehlt Ihnen, damit Sie strategisch arbeiten können?', client: 'Gibt es eine zweite Führungsebene, die das Tagesgeschäft trägt?' },
  'Verkauf geplant': { nom: 'der geplante Verkauf', need: 'eine Perspektive über mehrere Jahre', pair: 'stabil', change: true, offer: 'Stabiles Unternehmen', tag: 'Sicherheit', trigger: 'Verkauf geplant', ask: 'Wann ist der Verkauf geplant, und hängt eine Prämie daran?', client: 'Gibt es Pläne für einen Verkauf in den nächsten Jahren?' },
  'Strategiewechsel': { nom: 'der Strategiewechsel', need: 'eine überzeugende Strategie', pair: 'strategie', change: true, trigger: 'Strategie nicht mitgetragen', ask: 'Was genau tragen Sie an der neuen Strategie nicht mit?', client: 'Wofür steht die Strategie der nächsten drei Jahre?' },
  'Kein Gestaltungsraum mehr': { nom: 'der verlorene Gestaltungsraum', need: 'echte unternehmerische Freiheit', pair: 'gestaltung', change: true, offer: 'Gestaltungsspielraum', tag: 'Verantwortung', trigger: 'Neue Gesellschafter', ask: 'Seit wann und wodurch ist der Gestaltungsraum weg?', client: 'Wie viel Freiheit lassen die Gesellschafter der Geschäftsführung?' },
  'Konzernvorgaben': { pl: true, nom: 'die Vorgaben der Konzernzentrale', need: 'kurze Entscheidungswege ohne Konzernzentrale', pair: 'unab', ask: 'Welche Entscheidung mussten Sie zuletzt nach oben abgeben?', client: 'Wie viel entscheidet die Geschäftsführung selbst, und was die Zentrale?' },
};

/** Knöpfe je Rollenfamilie, häufigste zuerst, keine zwei Knöpfe zum selben Thema auf einer Seite. */
export const MOTIVE_CHIPS: Record<RoleFamily, Record<MotiveSide, string[]>> = {
  fuehrung: {
    pos: ['Mein Team', 'Gestaltungsspielraum', 'Stabilität', 'Gute Führungskraft', 'Aufgaben', 'Flexibilität', 'Gehalt', 'Unternehmenskultur'],
    neg: ['Kein eigenes Budget', 'Kaum Entscheidungsrecht', 'Umstrukturierung', 'Übernahme', 'Neue Führungskraft', 'Zu viel Verwaltung', 'Keine Entwicklung', 'Probleme mit der Führungskraft', 'Arbeitslast', 'Gehalt', 'Unternehmenskultur', 'Wenig Wertschätzung'],
  },
  spezialist: {
    pos: ['Team', 'Aufgaben', 'Flexibilität', 'Arbeitsweg', 'Stabilität', 'Gute Führungskraft', 'Gehalt', 'Weiterbildung'],
    neg: ['Keine Entwicklung', 'Arbeitslast', 'Gehalt', 'Eintönige Aufgaben', 'Probleme mit der Führungskraft', 'Wenig Wertschätzung', 'Wenig Gestaltungsspielraum', 'Umstrukturierung', 'Übernahme', 'Arbeitsweg', 'Unternehmenskultur'],
  },
  it: {
    pos: ['Technik', 'Team', 'Remote', 'Freiheit bei Lösungen', 'Produkt', 'Flexibilität', 'Gehalt', 'Weiterbildung'],
    neg: ['Veraltete Technik', 'Remote gestrichen', 'Mehr Termine als Arbeit', 'Kein Einfluss auf Technik', 'Gehalt unter Markt', 'Bereitschaftsdienst', 'Keine Entwicklung', 'Probleme mit der Führungskraft', 'Arbeitslast', 'Umstrukturierung', 'Übernahme'],
  },
  vertrieb: {
    pos: ['Kundenbeziehungen', 'Produkt', 'Verdienst', 'Freie Tagesplanung', 'Firmenwagen', 'Team', 'Gute Führungskraft', 'Stabilität'],
    neg: ['Unrealistische Ziele', 'Provision gekürzt', 'Fixum zu niedrig', 'Gebiet verkleinert', 'Schwaches Produkt', 'Zu viel Innendienst', 'Viel Reisen', 'Neue Führungskraft', 'Keine Entwicklung', 'Umstrukturierung', 'Übernahme'],
  },
  gewerblich: {
    pos: ['Team', 'Arbeit mit Menschen', 'Tarifvertrag', 'Nähe zum Wohnort', 'Feste Arbeitszeiten', 'Gute Führungskraft', 'Aufgaben', 'Bezahlung'],
    neg: ['Ständiges Einspringen', 'Schlechte Dienstplanung', 'Personalmangel', 'Nachtdienste', 'Wochenenddienste', 'Bezahlung', 'Zu viel Dokumentation', 'Wenig Wertschätzung', 'Arbeitsweg', 'Probleme mit der Führungskraft', 'Keine Entwicklung', 'Umstrukturierung'],
  },
  clevel: {
    pos: ['Gestaltungsfreiheit', 'Ergebnisverantwortung', 'Selbst aufgebautes Team', 'Unabhängigkeit', 'Beteiligung', 'Vergütung', 'Stabilität'],
    neg: ['Konflikt mit den Gesellschaftern', 'Zu viel operative Detailarbeit', 'Verkauf geplant', 'Strategiewechsel', 'Kein Gestaltungsraum mehr', 'Konzernvorgaben', 'Vergütung', 'Arbeitslast'],
  },
};

/** Alte Knopfnamen aus früheren Interviews zählen als die neuen. */
const ALIASES: Record<MotiveSide, Record<string, string>> = {
  pos: { 'Führungskraft': 'Gute Führungskraft', 'Feste Schichten': 'Feste Arbeitszeiten', 'Freiheit': 'Freie Tagesplanung', 'Tarif und Sicherheit': 'Tarifvertrag', 'Patienten oder Kunden': 'Arbeit mit Menschen' },
  neg: { 'Neue Vorgesetzte': 'Neue Führungskraft', 'Führungskraft': 'Probleme mit der Führungskraft', 'Kaum Wertschätzung': 'Wenig Wertschätzung', 'Verkauf oder Exit geplant': 'Verkauf geplant' },
};

/** Was bei Widerspruch (gleiches Thema, keine Veränderung) gefragt wird. */
const PAIR_QUESTION: Record<string, Partial<Record<RoleFamily | 'default', string>>> = {
  gehalt: { default: 'Zum Beispiel Fixgehalt gut, Bonus schwach.', gewerblich: 'Zum Beispiel Grundgehalt gut, Zulagen schwach.', vertrieb: 'Zum Beispiel Fixum gut, Provision schwach.', clevel: 'Zum Beispiel fix gut, Beteiligung schwach.' },
  chef: { default: 'Gilt das für dieselbe Person? Sonst „Neue Führungskraft“ nehmen.' },
  gestaltung: { default: 'Wo ist der Spielraum groß, wo fehlt er? Zum Beispiel fachlich frei, beim Budget nicht.' },
  weg: { default: 'Kurzer Weg, aber trotzdem störend? Vielleicht Verkehr oder fehlendes Homeoffice.', gewerblich: 'Kurzer Weg, aber trotzdem störend? Vielleicht kein Bus zum Schichtbeginn oder keine Parkplätze.' },
  kultur: { default: 'Was genau ist gut, was nicht? Zum Beispiel Team gut, Geschäftsleitung schwierig.' },
  technik: { default: 'Welche Technik gefällt, welche ist veraltet?' },
  techfrei: { default: 'Wo darf mitentschieden werden, wo nicht?' },
  produkt: { default: 'Produkt gut, aber schwer zu verkaufen? Dann ist es eher ein Preis- oder Marktthema.' },
  aufgaben: { default: 'Welche Aufgaben gefallen, welche sind eintönig?' },
  unab: { default: 'Unabhängig, aber trotzdem Vorgaben? Welche Entscheidungen liegen bei der Zentrale?' },
};

export const MOTIVE_FLOW_LABEL: Record<MotiveFlow, string> = {
  pendeln: 'Pendelzeit',
  arbeitsmodell: 'Arbeitsmodell',
  gehalt: 'Gehalt genau erfragen',
  kundenschutz: 'Kundenschutzklausel',
  leaver: 'Rückkaufregeln der Beteiligung',
};

// ---------------------------------------------------------------------------
// Feld lesen und schreiben (kommagetrennt wie bisher, Reihenfolge = Wichtigkeit)
// ---------------------------------------------------------------------------

const catalog = (side: MotiveSide) => (side === 'pos' ? MOTIVE_POS : MOTIVE_NEG);
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
const splitPhrases = (text: string) => text.split(/\s*[,;·\n]\s*/).map((p) => p.trim()).filter(Boolean);

/** Knopfname zu einer Phrase im Feld (auch alte Namen), sonst null. */
export function motiveLabelOf(phrase: string, side: MotiveSide): string | null {
  const n = norm(phrase);
  const direct = Object.keys(catalog(side)).find((l) => norm(l) === n);
  if (direct) return direct;
  const alias = Object.entries(ALIASES[side]).find(([old]) => norm(old) === n);
  return alias ? alias[1] : null;
}

/** Angetippte Knöpfe in Klickreihenfolge (ohne Doppelte). */
export function motiveLabels(text: string, side: MotiveSide): string[] {
  const out: string[] = [];
  for (const p of splitPhrases(text)) {
    const l = motiveLabelOf(p, side);
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

/** Was im Feld steht, aber kein Knopf ist („In eigenen Worten“). */
export function motiveOwnWords(text: string, side: MotiveSide): string {
  return splitPhrases(text).filter((p) => !motiveLabelOf(p, side)).join(', ');
}

/** Knopf an oder aus. Alte Namen desselben Knopfs werden mit entfernt; eigene Worte bleiben am Ende. */
export function toggleMotive(text: string, label: string, side: MotiveSide): string {
  const labels = motiveLabels(text, side);
  const next = labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label];
  const own = motiveOwnWords(text, side);
  return [...next, ...(own ? [own] : [])].join(', ');
}

/** Eigene Worte ersetzen, Knöpfe bleiben in ihrer Reihenfolge. */
export function withOwnWords(text: string, side: MotiveSide, words: string): string {
  const labels = motiveLabels(text, side);
  return [...labels, ...(words ? [words] : [])].join(', ');
}

/** Knopf durch einen anderen ersetzen (gleiche Stelle, z. B. ungenau → genau). */
export function replaceMotive(text: string, from: string, to: string, side: MotiveSide): string {
  const labels = motiveLabels(text, side);
  const next = labels.includes(from) ? labels.map((l) => (l === from ? to : l)).filter((l, i, a) => a.indexOf(l) === i) : labels.includes(to) ? labels : [...labels, to];
  const own = motiveOwnWords(text, side);
  return [...next, ...(own ? [own] : [])].join(', ');
}

/** Angetippte ungenaue Knöpfe mit ihren genauen Varianten („Wie genau?“). */
export function motiveDetailChoices(text: string, side: MotiveSide): Array<{ label: string; options: string[] }> {
  const cat = catalog(side);
  return motiveLabels(text, side).filter((l) => cat[l]?.details?.length).map((l) => ({ label: l, options: cat[l].details! }));
}

/** Knöpfe für die Familie plus angetippte aus anderen Familien (sonst wären sie unsichtbar). */
export function motiveChipsFor(family: RoleFamily, side: MotiveSide, text: string): string[] {
  const base = MOTIVE_CHIPS[family][side];
  return [...base, ...motiveLabels(text, side).filter((l) => !base.includes(l))];
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

export interface MotiveHint {
  key: string;
  level: 'gelb' | 'blau';
  text: string;
  /** Widerspruch: welcher Knopf auf welcher Seite steht (für „entfernen“). */
  conflict?: { pos: string; neg: string };
}

export interface MotiveEvaluation {
  saetze: string[];
  /** Dieselben Sätze nach Seite, für die Anzeige direkt unter den Knöpfen. */
  satzPos: string[];
  satzNeg: string[];
  braucht: string[];
  wieHeute: string[];
  suche: string[];
  kunde: string[];
  nachhaken: string[];
  hinweise: MotiveHint[];
  mehrHinweise: number;
  zuViele: boolean;
  weiter: { top3: string[]; ausloeser: string[]; themen: string[]; phase3: MotiveFlow[] };
}

type Item = MotiveEntry & { label: string };

const joinDe = (a: string[]) => (a.length < 2 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} und ${a[a.length - 1]}`);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const uniq = <T,>(a: (T | null | undefined | false)[]) => [...new Set(a.filter(Boolean) as T[])];
const q = (l: string) => `„${l}“`;
const verb = (items: Item[], one: string, many: string) => (items.length > 1 || items[0]?.pl ? many : one);
const shortList = (items: Item[]) =>
  joinDe(items.length > 4 ? [...items.slice(0, 3).map((x) => x.nom), `${items.length - 3} weitere Punkte`] : items.map((x) => x.nom));
const needOf = (x: Item, f: RoleFamily) => x.needBy?.[f] ?? x.need;
const clientOf = (x: Item, f: RoleFamily) => x.clientBy?.[f] ?? x.client;

/** Auswertung aus den angetippten Knöpfen (Klickreihenfolge, die ersten 3 sind die wichtigsten). */
export function evaluateMotives(family: RoleFamily, pos: string[], neg: string[]): MotiveEvaluation {
  // Je Thema zählt bei gefällt nur der erste Knopf (alte Interviews haben „Team“ und „Mein Team“).
  const posPairs = new Set<string>();
  const P: Item[] = pos
    .filter((l) => MOTIVE_POS[l] && !posPairs.has(MOTIVE_POS[l].pair) && posPairs.add(MOTIVE_POS[l].pair))
    .map((l) => ({ label: l, ...MOTIVE_POS[l] }));
  const N: Item[] = neg.filter((l) => MOTIVE_NEG[l]).map((l) => ({ label: l, ...MOTIVE_NEG[l] }));

  // Was bisher gefallen hat und gerade wegfällt (Stör-Knopf beschreibt eine Veränderung).
  const losesP = (p: Item) => N.some((n) => n.change && (n.pair === p.pair || n.loses?.includes(p.pair)));
  const lost = P.filter(losesP);
  const stillP = P.filter((p) => !losesP(p));
  const topP = stillP.slice(0, 3);
  const topN = N.slice(0, 3);

  const restP = stillP.slice(3);
  const restN = N.slice(3);
  const gefaellt = topP.length ? `Am meisten ${verb(topP, 'gefällt', 'gefallen')} heute ${joinDe(topP.map((x) => x.nom))}.` : '';
  const stoert = topN.length ? `Am meisten ${verb(topN, 'stört', 'stören')} ${joinDe(topN.map((x) => x.nom))}.` : '';
  const verlust = lost.length ? `Was bisher gefallen hat, fällt gerade weg oder ändert sich: ${joinDe(lost.map((x) => x.nom))}. Das ist ein starker Wechselgrund.` : '';
  const auchP = restP.length ? `Außerdem ${verb(restP, 'gefällt', 'gefallen')} ${shortList(restP)}.` : '';
  const auchN = restN.length ? `Außerdem ${verb(restN, 'stört', 'stören')} ${shortList(restN)}.` : '';
  const satzPos = [gefaellt, auchP].filter(Boolean);
  const satzNeg = [stoert, verlust, auchN].filter(Boolean);
  const saetze = [gefaellt, stoert, verlust, auchP, auchN].filter(Boolean);

  // Erst lösen (stört), dann wie heute (gefällt und nicht betroffen).
  const braucht = uniq<string>(topN.map((x) => needOf(x, family)));
  const keepP = topP.filter((p) => !N.some((n) => n.pair === p.pair));
  const wieHeute = uniq<string>(keepP.map((x) => needOf(x, family))).filter((x) => !braucht.includes(x)).slice(0, 3);

  // Suche: Stör-Knöpfe und die ersten 3 Gefällt-Knöpfe, je Thema ein Satz, Stör-Knopf gewinnt.
  const suche: string[] = [];
  const suchePairs = new Set<string>();
  for (const x of [...N, ...topP]) {
    if (!x.search || suchePairs.has(x.pair)) continue;
    suchePairs.add(x.pair);
    if (!suche.includes(x.search)) suche.push(x.search);
  }
  // Kunde: je Thema eine Frage; stört Geld, bekommt die Geldfrage immer einen Platz.
  const kundeAll: string[] = [];
  const kundePairs = new Set<string>();
  for (const x of [...topN, ...topP]) {
    const c = clientOf(x, family);
    if (!c || kundePairs.has(x.pair)) continue;
    kundePairs.add(x.pair);
    if (!kundeAll.includes(c)) kundeAll.push(c);
  }
  let kunde = kundeAll.slice(0, 3);
  const geld = N.find((n) => n.group === 'gehalt');
  const geldFrage = geld ? clientOf(geld, family) : undefined;
  if (geldFrage && !kunde.includes(geldFrage)) kunde = [...kunde.slice(0, 2), geldFrage];
  const nachhaken = uniq<string>(topN.map((x) => x.ask)).slice(0, 2);

  // Hinweise: gelb = klären, blau = gut zu wissen. Höchstens 3, gelb zuerst.
  const H: MotiveHint[] = [];
  const gelb = (key: string, text: string, conflict?: MotiveHint['conflict']) => H.push({ key, level: 'gelb', text, conflict });
  const blau = (key: string, text: string) => H.push({ key, level: 'blau', text });
  const has = (side: Item[], label: string) => side.some((x) => x.label === label);

  for (const p of P) for (const n of N) {
    if (p.pair !== n.pair || n.change || losesP(p)) continue;
    const wo = p.label === n.label ? `${q(p.label)} steht bei gefällt und bei stört.` : `${q(p.label)} steht bei gefällt, ${q(n.label)} bei stört.`;
    const frage = PAIR_QUESTION[p.pair]?.[family] ?? PAIR_QUESTION[p.pair]?.default ?? 'Was genau gefällt, was stört?';
    gelb(`widerspruch:${p.label}:${n.label}`, `${wo} ${frage}`, { pos: p.label, neg: n.label });
  }
  if (has(P, 'Tarifvertrag') && N.some((n) => n.pair === 'stabil' && n.change)) {
    gelb('tarif', 'Bei Übernahme oder Umbau kann die Tarifbindung wegfallen. Frag: „Bleibt der Tarifvertrag bestehen, und was hat man Ihnen schriftlich zugesagt?“');
  }
  if (N.length && N.every((n) => n.group === 'gehalt')) {
    if (N.length === 1 && N[0].change) gelb('nur-geld', `Nur ${q(N[0].label)} stört. Frag: „Wenn die Kürzung zurückgenommen wird, bleiben Sie dann?“`);
    else gelb('nur-geld', 'Nur das Geld stört. Dann ist das Risiko eines Gegenangebots hoch. Frag: „Wenn Ihr Arbeitgeber 10 % drauflegt, bleiben Sie dann?“');
  }
  if (N.some((n) => n.pair === 'stabil' && n.change && n.label !== 'Verkauf geplant')) gelb('umbau', 'Bei Umbau warten viele auf eine Abfindung oder Halteprämie. Frag: „Steht ein Abfindungsangebot oder eine Halteprämie im Raum?“');
  const exitMitBeteiligung = has(P, 'Beteiligung') && has(N, 'Verkauf geplant');
  if (exitMitBeteiligung) gelb('exit', 'Beteiligung und geplanter Verkauf: Ein Wechsel vor dem Verkauf kann viel Geld kosten. Zeitplan klären, bevor du vorstellst.');
  if (P.length && !N.length) gelb('kein-grund', 'Noch kein Wechselgrund. Frag: „Was müsste sich ändern, damit Sie wechseln?“');
  else if (P.length >= 3 && N.length === 1) {
    if (N[0].change) gelb('nur-veraenderung', 'Einziger Grund ist eine Veränderung. Frag: „Was, wenn sich die Lage in drei Monaten beruhigt hat?“');
    else gelb('wechselwille', 'Vieles gefällt, nur ein Punkt stört. Wechselwille prüfen: „Wie ernst ist es Ihnen mit dem Wechsel?“');
  }
  if (!P.length && N.length >= 3) gelb('frust', 'Nichts gefällt, vieles stört. Prüfen, ob es um den Arbeitgeber geht oder um den Beruf. Frag: „Wollen Sie in Ihrem Beruf bleiben?“');

  if (has(P, 'Feste Arbeitszeiten') && (has(N, 'Ständiges Einspringen') || has(N, 'Dienstplan und Einspringen'))) blau('verlaesslich', 'Feste Arbeitszeiten gefallen, das Einspringen stört. Kern ist Verlässlichkeit. Beim Kunden nach Ausfallkonzept und Springerpool fragen.');
  const geldGut = P.find((p) => p.group === 'gehalt');
  if (geldGut && !N.some((n) => n.group === 'gehalt' && !n.change) && !losesP(geldGut)) {
    blau('geld-gut', `${cap(geldGut.nom)} ist heute gut. Wunschgehalt früh erfragen und mit dem Budget des Kunden abgleichen, bevor du vorstellst.`);
  }
  if (has(topN, 'Probleme mit der Führungskraft')) blau('chef-konflikt', 'Konflikt mit der Führungskraft nicht als Wechselgrund ins Kundenprofil schreiben. Positiv formulieren, zum Beispiel: Wunsch nach mehr Eigenverantwortung.');
  if (has(P, 'Gute Führungskraft') && has(N, 'Neue Führungskraft')) blau('chef-frueher', 'Die frühere Führungskraft war gut. Frag: „Wo arbeitet Ihre frühere Führungskraft heute?“ Oft ein Türöffner oder eine Referenz.');
  const team = stillP.some((p) => p.group === 'team');
  const chef = stillP.some((p) => p.group === 'chef') && !N.some((n) => n.group === 'chef');
  if (team || chef) {
    blau('bindung', `Starke Bindung an ${team && chef ? 'Team und Führungskraft' : team ? 'das Team' : 'die Führungskraft'}. Daran scheitern viele Wechsel am Ende. Frag früh: „Was könnte Sie am Ende doch halten?“`);
  }
  if (has(P, 'Beteiligung') && !exitMitBeteiligung) blau('beteiligung', 'Beteiligung: Beim Ausstieg können Rückkaufregeln Geld kosten. Früh klären, ab wann ein Wechsel ohne Verlust geht.');
  if (has(P, 'Kundenbeziehungen')) blau('kundenschutz', 'Kundenbeziehungen: In Phase 3 nach einer Kundenschutzklausel im heutigen Vertrag fragen.');

  H.sort((a, b) => (a.level === b.level ? 0 : a.level === 'gelb' ? -1 : 1));

  return {
    saetze,
    satzPos,
    satzNeg,
    braucht,
    wieHeute,
    suche,
    kunde,
    nachhaken,
    hinweise: H.slice(0, 3),
    mehrHinweise: Math.max(0, H.length - 3),
    zuViele: P.length > 3 || N.length > 3,
    weiter: {
      top3: uniq<string>([...topN, ...topP].map((x) => x.offer)).slice(0, 3),
      ausloeser: uniq<string>(N.map((x) => x.trigger)),
      themen: uniq<string>(N.map((x) => x.tag)),
      phase3: uniq<MotiveFlow>([...N, ...P].map((x) => x.flow)),
    },
  };
}

/** Auswertung direkt aus den beiden Feldern. */
export function evaluateMotiveFields(family: RoleFamily, positive: string, negative: string): MotiveEvaluation {
  return evaluateMotives(family, motiveLabels(positive, 'pos'), motiveLabels(negative, 'neg'));
}

// ---------------------------------------------------------------------------
// Wechselmotivation für den Kunden („Warum wechseln“)
// ---------------------------------------------------------------------------
// Aus denselben Klicks, aber kundentauglich: positiv („Sucht …“, Satz ohne Subjekt,
// also ohne Er/Sie), Anlass nur als sachliches Ereignis, nie Gehalt und nie Kritik an
// Personen. Geprüft über alle Kombinationen (situationMotives.test.ts).

/** Was gesucht wird (Akkusativ nach „Sucht“), kundentauglich. null = nie zum Kunden. */
const CLIENT_NEED: Record<string, string | null> = {
  'Probleme mit der Führungskraft': null,
  'Führungskraft entscheidet allein': null,
  'Führungskraft mischt sich überall ein': null,
  'Wenig Rückendeckung': null,
  'Führungskraft kaum erreichbar': null,
  'Neue Führungskraft': null,
  'Gehalt': null,
  'Gehalt unter Markt': null,
  'Bezahlung': null,
  'Vergütung': null,
  'Fixum zu niedrig': null,
  'Provision gekürzt': null,
  'Kein Budget oder Entscheidungsrecht': null,
  'Übernahme oder Umstrukturierung': null,
  'Dienstplan und Einspringen': null,
  'Nacht und Wochenende': null,
  'Übernahme': 'ein stabiles Umfeld mit klarer Perspektive',
  'Umstrukturierung': 'ein stabiles Umfeld mit klarer Perspektive',
  'Wenig Wertschätzung': 'ein Umfeld mit sichtbarer Anerkennung',
  'Konflikt mit den Gesellschaftern': 'ein klares Mandat der Gesellschafter',
  'Kein Gestaltungsraum mehr': 'wieder echte unternehmerische Freiheit',
  'Mehr Termine als Arbeit': 'mehr Zeit für konzentrierte Arbeit',
  'Arbeitslast': 'eine realistische Arbeitsbelastung',
};

/** Anlass (Nominativ nach „Anlass ist“), nur sachliche Ereignisse. */
const ANLASS: Record<string, string> = {
  'Übernahme': 'eine Übernahme',
  'Umstrukturierung': 'eine Umstrukturierung',
  'Remote gestrichen': 'die Rückkehr zur Präsenzpflicht',
  'Gebiet verkleinert': 'eine Neuaufteilung der Vertriebsgebiete',
  'Verkauf geplant': 'der geplante Verkauf des Unternehmens',
  'Strategiewechsel': 'eine strategische Neuausrichtung',
};
/** Antworten bei „Gab es einen konkreten Auslöser?“, die sachlich genug für den Kunden sind. */
const ANLASS_AUSLOESER: Record<string, string> = {
  'Neuorganisation': 'eine Neuorganisation',
  'Neue Gesellschafter': 'ein Wechsel im Gesellschafterkreis',
  'Neuer Investor': 'ein neuer Investor',
  'Stellenabbau': 'ein Stellenabbau',
  'Station zusammengelegt': 'die Zusammenlegung von Stationen',
  'Systemwechsel': 'ein Systemwechsel',
  'Übernahme': 'eine Übernahme',
  'Verkauf geplant': 'der geplante Verkauf des Unternehmens',
  'Pflicht zur Rückkehr ins Büro': 'die Rückkehr zur Präsenzpflicht',
  'Gebiet neu verteilt': 'eine Neuaufteilung der Vertriebsgebiete',
  'Projekt gestoppt': 'ein gestopptes Projekt',
  'Dienstplan geändert': 'ein geänderter Dienstplan',
  'Budget gekürzt': 'eine Budgetkürzung',
  'Vertrag läuft aus': 'das Auslaufen des Vertrags',
};

/** Was wichtig bleibt (Nominativ nach „Wichtig bleibt/bleiben“). null = nie zum Kunden. */
const KEEP: Record<string, { text: string; pl?: boolean } | null> = {
  'Team': { text: 'ein gutes Team' },
  'Mein Team': { text: 'ein gutes Team' },
  'Selbst aufgebautes Team': { text: 'die Gestaltung des eigenen Teams' },
  'Aufgaben': { text: 'interessante Aufgaben', pl: true },
  'Gute Führungskraft': { text: 'eine gute Führungskraft' },
  'Flexibilität': { text: 'Flexibilität bei Zeit und Ort' },
  'Gehalt': null,
  'Bezahlung': null,
  'Verdienst': null,
  'Vergütung': null,
  'Firmenwagen': null,
  'Arbeitsweg': { text: 'ein kurzer Arbeitsweg' },
  'Nähe zum Wohnort': { text: 'ein kurzer Arbeitsweg' },
  'Stabilität': { text: 'ein wirtschaftlich stabiles Umfeld' },
  'Tarifvertrag': { text: 'ein Arbeitgeber mit Tarifvertrag' },
  'Weiterbildung': { text: 'gute Weiterbildungsmöglichkeiten', pl: true },
  'Gestaltungsspielraum': { text: 'Gestaltungsspielraum' },
  'Unternehmenskultur': { text: 'eine gute Unternehmenskultur' },
  'Technik': { text: 'ein moderner Technikstack' },
  'Remote': { text: 'Remote-Arbeit' },
  'Freiheit bei Lösungen': { text: 'Freiheit bei technischen Lösungen' },
  'Produkt': { text: 'ein überzeugendes Produkt' },
  'Kundenbeziehungen': { text: 'enger Kundenkontakt' },
  'Freie Tagesplanung': { text: 'eine freie Tagesplanung' },
  'Arbeit mit Menschen': { text: 'die direkte Arbeit mit Menschen' },
  'Feste Arbeitszeiten': { text: 'planbare feste Arbeitszeiten', pl: true },
  'Gestaltungsfreiheit': { text: 'unternehmerische Freiheit' },
  'Ergebnisverantwortung': { text: 'volle Ergebnisverantwortung' },
  'Unabhängigkeit': { text: 'kurze Entscheidungswege' },
  'Beteiligung': { text: 'eine Beteiligung am Erfolg' },
};

const SEASON = ['Winter', 'Winter', 'Frühjahr', 'Frühjahr', 'Frühjahr', 'Sommer', 'Sommer', 'Sommer', 'Herbst', 'Herbst', 'Herbst', 'Winter'];

export interface ClientMotivation {
  text: string;
  /** Die Sätze einzeln mit Herkunft (nur für den Headhunter, „Belege“). */
  parts: Array<{ text: string; src: string }>;
  /** Angetippte Stör-Knöpfe, die bewusst nicht im Kundentext stehen. */
  weggelassen: string[];
  /** Es gibt Stör-Knöpfe, aber kein Wechselgrund kommt in den Kundentext. */
  ohneGrund: boolean;
  /** Noch kein Wechselgrund (weder aus „stört“ noch aus dem Auslöser): dann kein Kundentext. */
  fehltGrund: boolean;
  /** Alte, ungenaue Knöpfe: stehen nicht im Kundentext, bis sie geklärt sind. */
  ungenau: string[];
}

/** Antworten aus „Ziele“, die in den Kundentext fließen. */
export interface MotivationEnv {
  /** corporate | midsize | startup | any */
  companySize?: string | null;
  /** same | open */
  industryChange?: string | null;
  /** yes | no */
  international?: string | null;
  relocation?: boolean | null;
  /** Angetippte Ziel-Knöpfe (Phase 2), in Klickreihenfolge. */
  goals?: string[];
}

const SIZE_AKK: Record<string, string> = { corporate: 'einen Konzern', midsize: 'den Mittelstand', startup: 'ein Start-up' };

/** „Bevorzugt den Mittelstand und ist offen für einen Branchenwechsel …“ (ohne Subjekt). */
export function environmentSentence(env: MotivationEnv): string {
  const open = [
    env.industryChange === 'open' ? 'einen Branchenwechsel' : null,
    env.relocation === true ? 'einen Umzug' : null,
    env.international === 'yes' ? 'internationale Aufgaben' : null,
  ].filter((x): x is string => !!x);
  const verbs = [
    env.companySize && SIZE_AKK[env.companySize] ? `bevorzugt ${SIZE_AKK[env.companySize]}` : null,
    env.industryChange === 'same' ? 'möchte in der bisherigen Branche bleiben' : null,
    open.length ? `ist offen für ${joinDe(open)}` : null,
  ].filter((x): x is string => !!x);
  if (!verbs.length) return '';
  const s = joinDe(verbs);
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

/**
 * „Langfristiges Ziel: Engineering Manager, dazu ein sicherer Arbeitgeber.“ aus den
 * Ziel-Knöpfen: höchstens zwei berufliche, ein persönliches. Nie zum Kunden: Geld,
 * eigene Firma, Selbstständigkeit. Ein Thema, das „Sucht …“ schon nennt, fällt weg.
 */
export function goalSentence(goals: string[] = [], env: MotivationEnv = {}, usedThemes: Set<string> = new Set()): string {
  const g = goals
    .filter((x) => !(env.companySize && /mittelstand|konzern|start-?up/i.test(x)))
    .filter((x) => goalClientText(x) !== null)
    .filter((x) => { const t = goalTheme(x); return !t || !usedThemes.has(t); });
  const prof = g.filter((x) => ALL_GOALS[x]?.kind !== 'persoenlich').slice(0, 2).map((x) => goalClientText(x)!);
  const pers = g.filter((x) => ALL_GOALS[x]?.kind === 'persoenlich').slice(0, 1).map((x) => goalClientText(x)!);
  if (!prof.length && !pers.length) return '';
  const p = prof.join(' oder ');
  return `Langfristiges Ziel: ${p && pers.length ? `${p}, dazu ${pers[0]}` : p || pers[0]}.`;
}

/** Kundentext „Warum wechseln“ aus gefällt, stört, dem konkreten Auslöser und den Zielen. */
export function clientMotivation(family: RoleFamily, positive: string, negative: string, incident = '', env: MotivationEnv = {}): ClientMotivation {
  const N = motiveLabels(negative, 'neg');
  const posPairs = new Set<string>();
  const P = motiveLabels(positive, 'pos').filter((l) => !posPairs.has(MOTIVE_POS[l].pair) && posPairs.add(MOTIVE_POS[l].pair));
  const topN = N.slice(0, 3);
  const lostPairs = new Set(N.filter((l) => MOTIVE_NEG[l].change).flatMap((l) => [MOTIVE_NEG[l].pair, ...(MOTIVE_NEG[l].loses ?? [])]));

  const needs = uniq<string>(topN.map((l) => (l in CLIENT_NEED ? CLIENT_NEED[l] : MOTIVE_NEG[l].needBy?.[family] ?? MOTIVE_NEG[l].need)));
  const ungenau = N.filter((l) => MOTIVE_NEG[l].ambiguous);
  const weggelassen = topN.filter((l) => CLIENT_NEED[l] === null && !MOTIVE_NEG[l].ambiguous);
  const keepLabels = P
    .filter((l) => !lostPairs.has(MOTIVE_POS[l].pair) && !N.some((n) => MOTIVE_NEG[n].pair === MOTIVE_POS[l].pair))
    .filter((l) => !!KEEP[l])
    .slice(0, 3);
  const keepItems = keepLabels.map((l) => KEEP[l]!);
  const keep = uniq<string>(keepItems.map((k) => k.text));
  const keepPl = keepItems.length > 1 || !!keepItems[0]?.pl;

  const incidents = splitPhrases(incident);
  const fromNeg = N.map((l) => ANLASS[l]).find(Boolean);
  const fromIncident = incidents.map((i) => ANLASS_AUSLOESER[i]).find(Boolean);
  const anlass = fromNeg ?? fromIncident;
  const zeit = incidents.map((i) => /(\d{2})\/(\d{4})/.exec(i)).find(Boolean);
  const wann = zeit ? ` im ${SEASON[Number(zeit[1]) - 1]} ${zeit[2]}` : '';

  const hasReason = needs.length > 0 || !!anlass;
  const parts: Array<{ text: string; src: string }> = [];
  if (hasReason) {
    if (needs.length) parts.push({ text: `Sucht ${joinDe(needs)}.`, src: 'stört' });
    if (anlass) parts.push({ text: `Anlass ist ${anlass}${wann}.`, src: fromNeg ? 'stört' : 'Auslöser' });
    // Gleiches Thema nur einmal: „Sucht …“ vor dem Ziel, das Ziel vor „Wichtig bleibt“.
    const needThemes = new Set(topN.filter((l) => CLIENT_NEED[l] !== null && !MOTIVE_NEG[l].ambiguous).map((l) => MOTIVE_NEG[l].pair));
    const goal = goalSentence(env.goals, env, needThemes);
    if (goal) parts.push({ text: goal, src: 'Ziel' });
    const umfeld = environmentSentence(env);
    if (umfeld) parts.push({ text: umfeld, src: 'Wunschstelle · Unternehmen' });
    const goalThemes = new Set((env.goals ?? []).filter((x) => goal && goalClientText(x) && goal.includes(goalClientText(x)!)).map(goalTheme).filter((t): t is string => !!t));
    const keepShown = goalThemes.size ? uniq<string>(keepItems.filter((_, i) => !goalThemes.has(MOTIVE_POS[keepLabels[i]]?.pair)).map((k) => k.text)) : keep;
    const keepShownPl = keepShown.length > 1 || (keepShown.length === 1 && !!keepItems.find((k) => k.text === keepShown[0])?.pl);
    if (keepShown.length) parts.push({ text: `Wichtig ${keepShownPl ? 'bleiben' : 'bleibt'} ${needs.length ? 'außerdem ' : ''}${joinDe(keepShown)}.`, src: 'gefällt' });
  }
  return {
    text: parts.map((x) => x.text).join(' '),
    parts,
    weggelassen,
    ohneGrund: N.length > 0 && !hasReason,
    fehltGrund: !hasReason,
    ungenau,
  };
}

/** Text vom früheren Automatik-Satz („Stört vor allem: …“), darf ersetzt werden. */
export function isOldAutoMotivation(text: string): boolean {
  return /^(Stört vor allem:|Wechselgrund:)/.test(text.trim());
}

// ---------------------------------------------------------------------------
// Ergänzung zur Wechselmotivation
// ---------------------------------------------------------------------------
// Der Satz aus den Klicks steht vorn und zieht mit; eigene Ergänzungen werden
// hinten angehängt und bleiben dabei erhalten.

/** Häufige Ergänzungen zum Antippen, kundentauglich. */
export const MOTIVATION_ADDONS = ['Gerne im Mittelstand', 'Gerne im Konzern', 'Offen für Branchenwechsel', 'Offen für Umzug', 'Gerne international', 'Langfristige Perspektive wichtig'];

const asSentence = (t: string) => {
  const s = t.trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? '' : '.'}`;
};

/** Satz aus den Klicks plus Ergänzung. */
export function joinMotivation(generated: string, addition: string): string {
  return [generated.trim(), addition.trim()].filter(Boolean).join(' ');
}

/** Ist der Text der Satz aus den Klicks (mit oder ohne Ergänzung)? Dann: welche Ergänzung. */
export function splitMotivation(text: string, generated: string): { auto: boolean; addition: string } {
  const t = text.trim();
  const g = generated.trim();
  if (!g) return { auto: false, addition: t };
  if (t === g) return { auto: true, addition: '' };
  if (t.startsWith(`${g} `)) return { auto: true, addition: t.slice(g.length).trim() };
  return { auto: false, addition: '' };
}

/** Ergänzungen, von denen nur eine gehen kann. */
const ADDON_EXCLUSIVE = [['Gerne im Mittelstand', 'Gerne im Konzern']];

/** Ergänzungen, die sich widersprechen und beide drinstehen (z. B. aus früheren Klicks). */
export function additionConflicts(addition: string): string[][] {
  return ADDON_EXCLUSIVE.filter((g) => g.every((x) => addition.includes(asSentence(x))));
}

/** Ergänzung an oder aus (als eigener Satz); das Gegenstück fliegt dabei raus. */
export function toggleAddition(addition: string, phrase: string): string {
  const sentence = asSentence(phrase);
  const cut = (t: string, x: string) => t.replace(asSentence(x), '').replace(/\s+/g, ' ').trim();
  let a = addition.trim();
  if (a.includes(sentence)) return cut(a, phrase);
  for (const group of ADDON_EXCLUSIVE) if (group.includes(phrase)) for (const other of group) if (other !== phrase) a = cut(a, other);
  return joinMotivation(a, sentence);
}

/**
 * Frühere Zusatzknöpfe („Gerne im Mittelstand.“ …) aus der Ergänzung in echte Antworten
 * übersetzen: Seit 19.10. sind das Fragen in „Ziele“. Was keine Frage hat, bleibt stehen.
 */
export function legacyAddonFields(addition: string): { env: MotivationEnv; rest: string } {
  const has = (x: string) => addition.includes(asSentence(x));
  const env: MotivationEnv = {};
  if (has('Gerne im Mittelstand') !== has('Gerne im Konzern')) env.companySize = has('Gerne im Mittelstand') ? 'midsize' : 'corporate';
  if (has('Offen für Branchenwechsel')) env.industryChange = 'open';
  if (has('Offen für Umzug')) env.relocation = true;
  if (has('Gerne international')) env.international = 'yes';
  let rest = addition;
  for (const x of ['Gerne im Mittelstand', 'Gerne im Konzern', 'Offen für Branchenwechsel', 'Offen für Umzug', 'Gerne international']) {
    if (x === 'Gerne im Mittelstand' || x === 'Gerne im Konzern') { if (!env.companySize) continue; }
    rest = rest.replace(asSentence(x), '');
  }
  return { env, rest: rest.replace(/\s+/g, ' ').trim() };
}

/** Wörter, die im Zitat für den Kunden nichts verloren haben (Personen, Geld). */
const QUOTE_BLOCK = /\b(chef\w*|vorgesetzt\w*|führungskraft|boss|kolleg\w*|gehalt|geld|verdien\w*|bezahl\w*|herr|frau)\b|\d/i;

/** Notiz „In eigenen Worten“ bei „stört“ als Zitat-Satz: nur ein ganzer Satz ab 4 Wörtern, ohne Personen und Geld. */
export function motivationQuote(negative: string): string {
  const own = motiveOwnWords(negative, 'neg').trim();
  if (own.split(/\s+/).filter(Boolean).length < 4 || QUOTE_BLOCK.test(own)) return '';
  return asSentence(own);
}

// ---------------------------------------------------------------------------
// Konkreter Auslöser
// ---------------------------------------------------------------------------
// Knöpfe „Was ist passiert?“ und „Wann?“ und daraus ein Satz nur für den Headhunter,
// der auch „Wie oft kommt das vor?“ aufnimmt. Gespeichert wie bisher kommagetrennt
// in specific_incident: Ereignisse, Zeitpunkt („seit ca. 04/2026“), eigene Worte.

interface IncidentEntry {
  /** Nominativ für „Im Frühjahr 2026 kam(en) …“. */
  nom: string;
  /** Akkusativ für „Ausgelöst durch …“ (fehlt = wie nom). */
  akk?: string;
  pl?: boolean;
  /** Zustand statt Ereignis: eigener Satz. */
  state?: string;
  ask?: string;
  /** Alter Knopf, der zwei Dinge vermischt. */
  ambiguous?: string[];
}

const INCIDENTS: Record<string, IncidentEntry> = {
  'Neue Führungskraft': { nom: 'eine neue Führungskraft', ask: 'Was hat sich mit der neuen Führungskraft konkret geändert?' },
  'Neuorganisation': { nom: 'eine Neuorganisation', ask: 'Was hat die Neuorganisation an Ihrer Rolle geändert?' },
  'Beförderung ging an andere': { nom: 'eine verpasste Beförderung', ask: 'Was hat aus Ihrer Sicht bei der Beförderung gefehlt?' },
  'Budget gekürzt': { nom: 'eine Budgetkürzung', ask: 'Was können Sie seit der Kürzung nicht mehr umsetzen?' },
  'Übernahme': { nom: 'eine Übernahme', ask: 'Was ändert die Übernahme konkret für Sie?' },
  'Übernahme oder Umbau': { nom: 'eine Übernahme oder ein Umbau', akk: 'eine Übernahme oder einen Umbau', ambiguous: ['Übernahme', 'Neuorganisation'], ask: 'War es eine Übernahme, eine Neuorganisation oder beides?' },
  'Gehaltsrunde enttäuschend': { nom: 'eine enttäuschende Gehaltsrunde', ask: 'Was hatten Sie erwartet, und was kam?' },
  'Mehrarbeit nach Abgang im Team': { nom: 'Mehrarbeit nach einem Abgang im Team', ask: 'Wird die Stelle nachbesetzt?' },
  'Systemwechsel': { nom: 'ein Systemwechsel', akk: 'einen Systemwechsel', ask: 'Was hat der Systemwechsel für Ihre Arbeit bedeutet?' },
  'Projekt gestoppt': { nom: 'ein gestopptes Projekt', ask: 'Woran haben Sie danach gearbeitet?' },
  'Pflicht zur Rückkehr ins Büro': { nom: 'die Pflicht zur Rückkehr ins Büro', ask: 'Wie viele Bürotage wären für Sie noch in Ordnung?' },
  'Stellenabbau': { nom: 'ein Stellenabbau', akk: 'einen Stellenabbau', ask: 'Ist Ihre Stelle selbst betroffen?' },
  'Provision gekürzt': { nom: 'eine Kürzung der Provision', ask: 'Um wie viel ist die Provision gesunken?' },
  'Gebiet neu verteilt': { nom: 'eine Neuverteilung der Gebiete', ask: 'Was wurde Ihnen weggenommen?' },
  'Dienstplan geändert': { nom: 'ein geänderter Dienstplan', akk: 'einen geänderten Dienstplan', ask: 'Was hat sich am Dienstplan für Sie geändert?' },
  'Station zusammengelegt': { nom: 'die Zusammenlegung der Station', ask: 'Was hat sich seitdem im Alltag geändert?' },
  'Weiterbildung abgelehnt': { nom: 'eine abgelehnte Weiterbildung', ask: 'Welche Weiterbildung wollten Sie machen?' },
  'Neuer Investor': { nom: 'ein neuer Investor', akk: 'einen neuen Investor', ask: 'Was will der neue Investor anders?' },
  'Neue Gesellschafter': { nom: 'neue Gesellschafter', pl: true, ask: 'Was wollen die neuen Gesellschafter anders?' },
  'Strategie nicht mitgetragen': { nom: 'eine nicht mitgetragene Strategie', ask: 'Was genau tragen Sie an der Strategie nicht mit?' },
  'Verkauf geplant': { nom: 'der geplante Verkauf', akk: 'den geplanten Verkauf', ask: 'Wann ist der Verkauf geplant, und hängt eine Prämie daran?' },
  'Vertrag läuft aus': { nom: '', state: 'Der Vertrag läuft aus.', ask: 'Wann genau läuft der Vertrag aus?' },
  'Stelle anders als versprochen': { nom: '', state: 'Die Stelle ist anders als versprochen.', ask: 'Was war versprochen, und was ist es geworden?' },
  'Kein einzelner Anlass': { nom: '', state: 'Kein einzelner Anlass, es hat sich schleichend entwickelt.' },
  // Suchstatus statt „Warum gerade jetzt?“: aktiv auf der Suche oder angesprochen.
  'Wurde angesprochen': { nom: '', state: 'Wurde angesprochen und ist offen für einen Wechsel.', ask: 'Was müsste passieren, damit Sie wirklich wechseln?' },
  'Sucht aktiv': { nom: '', state: 'Sucht bereits aktiv nach einer neuen Stelle.', ask: 'Seit wann suchen Sie aktiv?' },
};

/** „Was ist passiert?“ je Rollenfamilie (ohne Vorschläge, die kommen davor). */
export const INCIDENT_CHIPS: Record<RoleFamily, string[]> = {
  fuehrung: ['Neue Führungskraft', 'Neuorganisation', 'Beförderung ging an andere', 'Budget gekürzt', 'Übernahme'],
  spezialist: ['Neue Führungskraft', 'Neuorganisation', 'Gehaltsrunde enttäuschend', 'Mehrarbeit nach Abgang im Team', 'Systemwechsel'],
  it: ['Neue Führungskraft', 'Projekt gestoppt', 'Pflicht zur Rückkehr ins Büro', 'Stellenabbau', 'Neuorganisation'],
  vertrieb: ['Neue Führungskraft', 'Provision gekürzt', 'Gebiet neu verteilt', 'Neuorganisation', 'Übernahme'],
  gewerblich: ['Neue Führungskraft', 'Dienstplan geändert', 'Station zusammengelegt', 'Weiterbildung abgelehnt', 'Neuorganisation'],
  clevel: ['Neuer Investor', 'Neue Gesellschafter', 'Strategie nicht mitgetragen', 'Vertrag läuft aus', 'Verkauf geplant'],
};
export const INCIDENT_SLOW = 'Kein einzelner Anlass';
/** Suchstatus, stehen hinter „Kein einzelner Anlass“ in derselben Reihe. */
export const INCIDENT_STATUS = ['Wurde angesprochen', 'Sucht aktiv'];

const INCIDENT_ALIASES: Record<string, string> = { 'Neuer Chef': 'Neue Führungskraft', 'Neue Führung': 'Neue Führungskraft', 'Neuer Vertriebsleiter': 'Neue Führungskraft', 'Kollege weg und Mehrarbeit': 'Mehrarbeit nach Abgang im Team' };
const TENURE_RE = /^Nach (\d+) Jahren keine nächste Stufe$/;
const TIME_RE = /^seit ca\. (\d{2})\/(\d{4})$/;
export const INCIDENT_LONG_AGO = 'länger her';

/** Knopf zu einer Phrase im Feld (auch alte Namen und der Werdegang-Vorschlag), sonst null. */
function incidentLabelOf(phrase: string): string | null {
  const n = norm(phrase);
  const direct = Object.keys(INCIDENTS).find((l) => norm(l) === n);
  if (direct) return direct;
  const alias = Object.entries(INCIDENT_ALIASES).find(([old]) => norm(old) === n);
  if (alias) return alias[1];
  return TENURE_RE.test(phrase.trim()) ? phrase.trim() : null;
}
const isTimePhrase = (p: string) => TIME_RE.test(p.trim()) || norm(p) === norm(INCIDENT_LONG_AGO);

export interface IncidentParts { events: string[]; time: string | null; own: string }

/** Feld zerlegen: Ereignisse (Klickreihenfolge), Zeitpunkt, eigene Worte. */
export function incidentParts(text: string): IncidentParts {
  const events: string[] = [];
  let time: string | null = null;
  const own: string[] = [];
  for (const p of splitPhrases(text)) {
    const l = incidentLabelOf(p);
    if (l) { if (!events.includes(l)) events.push(l); continue; }
    if (isTimePhrase(p)) { time = p.trim(); continue; }
    own.push(p);
  }
  return { events, time, own: own.join(', ') };
}

const incidentText = (p: IncidentParts) => [...p.events, ...(p.time ? [p.time] : []), ...(p.own ? [p.own] : [])].join(', ');

/** Ereignis an oder aus. */
export function toggleIncident(text: string, label: string): string {
  const p = incidentParts(text);
  return incidentText({ ...p, events: p.events.includes(label) ? p.events.filter((e) => e !== label) : [...p.events, label] });
}
/** Zeitpunkt setzen oder (gleicher Klick) entfernen. */
export function setIncidentTime(text: string, time: string): string {
  const p = incidentParts(text);
  return incidentText({ ...p, time: p.time === time ? null : time });
}
/** Eigene Worte ersetzen. */
export function setIncidentOwn(text: string, own: string): string {
  return incidentText({ ...incidentParts(text), own });
}

/** „Wann?“: vor 1–3 Monaten, einem halben Jahr, einem Jahr (als „seit ca. MM/JJJJ“), länger her. */
export function incidentTimeOptions(today: Date = new Date()): { value: string; label: string; month: string | null }[] {
  const at = (m: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return { value: `seit ca. ${mm}/${d.getFullYear()}`, month: `${mm}/${d.getFullYear()}` };
  };
  return [
    { ...at(3), label: 'vor 1–3 Monaten' },
    { ...at(6), label: 'vor einem halben Jahr' },
    { ...at(12), label: 'vor einem Jahr' },
    { value: INCIDENT_LONG_AGO, label: 'länger her', month: null },
  ];
}

/** Vorschläge aus den Stör-Knöpfen und dem Werdegang (gestrichelt, nie vorgewählt). */
export function incidentSuggestions(negative: string, career: { tenureYears: number | null; newJob: boolean }): string[] {
  const fromMotives = evaluateMotives('spezialist', [], motiveLabels(negative, 'neg')).weiter.ausloeser.filter((t) => INCIDENTS[t]);
  const fromCareer = [
    ...(career.tenureYears != null && career.tenureYears >= 5 ? [`Nach ${career.tenureYears} Jahren keine nächste Stufe`] : []),
    ...(career.newJob ? ['Stelle anders als versprochen'] : []),
  ];
  return uniq<string>([...fromMotives, ...fromCareer]);
}

const FREQUENCY_SENTENCE: Record<string, string> = {
  Einmalig: 'Bisher war es ein einmaliger Vorfall.',
  Gelegentlich: 'Seitdem ist es gelegentlich ein Thema.',
  Regelmäßig: 'Seitdem ist es regelmäßig ein Thema.',
  Dauerhaft: 'Seitdem ist es dauerhaft ein Thema.',
};

/** Satz zum Auslöser (nur für den Headhunter). */
export function incidentSentence(text: string, frequency: string | null): string {
  const { events, time } = incidentParts(text);
  const tenure = events.map((e) => TENURE_RE.exec(e)).find(Boolean);
  const real = events.filter((e) => INCIDENTS[e] && !INCIDENTS[e].state);
  const states = events.filter((e) => INCIDENTS[e]?.state && (e !== INCIDENT_SLOW || (!real.length && !tenure))).map((e) => INCIDENTS[e].state!);
  const out: string[] = [];
  if (real.length) {
    const many = real.length > 1 || !!INCIDENTS[real[0]].pl;
    const m = time ? TIME_RE.exec(time) : null;
    if (m) out.push(`Im ${SEASON[Number(m[1]) - 1]} ${m[2]} ${many ? 'kamen' : 'kam'} ${joinDe(real.map((e) => INCIDENTS[e].nom))}.`);
    else if (time) out.push(`Vor längerer Zeit ${many ? 'kamen' : 'kam'} ${joinDe(real.map((e) => INCIDENTS[e].nom))}.`);
    else out.push(`Ausgelöst durch ${joinDe(real.map((e) => INCIDENTS[e].akk ?? INCIDENTS[e].nom))}.`);
  }
  // „Seitdem …“ gehört direkt hinter das Ereignis, sonst ans Ende.
  const freq = frequency ? FREQUENCY_SENTENCE[frequency] : undefined;
  if (out.length && freq) out.push(freq);
  if (tenure) out.push(`Nach ${tenure[1]} Jahren ist keine nächste Stufe in Sicht.`);
  // „Wie oft“ gehört nur zu einem echten Anlass; ohne Anlass wird es nicht gefragt.
  if (!real.length && tenure && freq) out.push(freq.replace('Seitdem ist es', 'Es ist'));
  out.push(...states);
  return out.join(' ');
}

/** Gibt es einen echten Anlass (Ereignis oder Werdegang)? Nur dann fragt das Interview „Wann?“ und „Wie oft?“. */
export function incidentHasEvent(text: string): boolean {
  return incidentParts(text).events.some((e) => TENURE_RE.test(e) || (INCIDENTS[e] && !INCIDENTS[e].state));
}

/** Anfänge der Auslöser-Sätze: so erkennt das Interview ein automatisch gefülltes „Warum jetzt“. */
const WHY_NOW_AUTO = /^(Im (Winter|Frühjahr|Sommer|Herbst) \d{4} kam|Vor längerer Zeit kam|Ausgelöst durch|Kein einzelner Anlass|Wurde angesprochen|Sucht bereits aktiv|Nach \d+ Jahren ist|Der Vertrag läuft|Die Stelle ist anders|Bisher war es|Seitdem ist es|Es ist (gelegentlich|regelmäßig|dauerhaft|einmalig))/;

/** „Warum gerade jetzt?“ aus dem Auslöser; ein früher erfasster eigener Text bleibt (false). */
export function isAutoWhyNow(text: string): boolean {
  const sentences = text.trim().match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) ?? [];
  return !text.trim() || (sentences.length > 0 && sentences.join(' ').length >= text.trim().length - 1 && sentences.every((x) => WHY_NOW_AUTO.test(x)));
}

/** Nachfrage zum zuletzt angetippten Ereignis. */
export function incidentAsk(label: string | null): string | null {
  if (!label) return null;
  if (TENURE_RE.test(label)) return 'Was wäre Ihr nächster Schritt, und warum geht er intern nicht?';
  return INCIDENTS[label]?.ask ?? null;
}

/** Knöpfe in Anzeige-Reihenfolge: Vorschläge, Familie, schleichend, dann angetippte aus anderen Familien. */
export function incidentChipsFor(family: RoleFamily, suggestions: string[], text: string): string[] {
  const base = uniq<string>([...suggestions, ...INCIDENT_CHIPS[family], INCIDENT_SLOW, ...INCIDENT_STATUS]);
  return [...base, ...incidentParts(text).events.filter((e) => !base.includes(e))];
}

// ---------------------------------------------------------------------------
// Eigene Worte: als Satz anzeigen und darin Themen erkennen
// ---------------------------------------------------------------------------

/** Eigene Worte als Satz (erster Buchstabe groß, Punkt am Ende); Schreibweise sonst wie getippt. */
export function ownWordsSentence(own: string): string {
  return asSentence(own);
}

/**
 * Wörterbuch: Wendungen, wie Kandidaten sie am Telefon sagen, je Knopf. Gilt pro
 * Satzteil (getrennt an Komma, Punkt, „und“, „aber“, „weil“). Lieber ein Vorschlag
 * zu wenig als einer, der nicht passt: Der Headhunter bestätigt jeden mit einem Klick.
 */
const CHEF = /\b(chef|chefin|chefs|vorgesetzte?[rn]?|führungskraft|führung|boss|teamleit\w*|abteilungsleit\w*|bereichsleit\w*|geschäftsführ\w*|gf|leitung|manager(in)?|direktor\w*|ceo|cto|cfo|coo)\b/i;

export const MOTIVE_RECOGNIZE: Record<MotiveSide, [RegExp, string][]> = {
  pos: [
    [/selbst aufgebaut|aufgebaut habe|von null auf|von grund auf aufgebaut/i, 'Selbst aufgebautes Team'],
    [/mein(e|em)? (team|leute|mitarbeiter\w*|truppe|mannschaft)\b/i, 'Mein Team'],
    [/\bteams?\b|kolleg|zusammenarbeit|miteinander|die leute|zusammenhalt/i, 'Team'],
    [/aufgabe|tätigkeit|abwechslung|abwechslungsreich|spannend|vielseitig|themen|projekte|inhaltlich|fachlich/i, 'Aufgaben'],
    [CHEF, 'Gute Führungskraft'],
    [/remote|home ?office|von zu hause|von daheim|mobile[sn]? arbeit|mobil arbeiten/i, 'Remote'],
    [/flexib|gleitzeit|zeiteinteilung|vertrauensarbeitszeit|keine kernzeit|freie zeit/i, 'Flexibilität'],
    [/gehalt|geld|verdien|bezahl|vergütung|lohn|einkommen/i, 'Gehalt'],
    [/arbeitsweg|weg zur arbeit|pendel|anfahrt|fahrzeit|nah(e)? (am|zum|bei)|um die ecke|zu fuß|mit dem (rad|fahrrad)|kurzer weg|in der nähe|nicht weit/i, 'Arbeitsweg'],
    [/stabil|sicher(er|heit)?\b|krisenfest|solide|unbefristet/i, 'Stabilität'],
    [/tarif/i, 'Tarifvertrag'],
    [/weiterbild|fortbild|schulung|lernen|zertifi|seminar|kurse/i, 'Weiterbildung'],
    [/unternehmerisch/i, 'Gestaltungsfreiheit'],
    [/freiheit bei (der |den )?(lösung|technik)|technik selbst (wählen|aussuchen|entscheiden)/i, 'Freiheit bei Lösungen'],
    [/gestalt|freiheit|selbst entscheid|eigenverantwort|freiraum|vertrauen|eigene ideen/i, 'Gestaltungsspielraum'],
    [/kultur|klima|atmosph|familiär|stimmung|wertschätz/i, 'Unternehmenskultur'],
    [/technik|technolog|stack|tools|moderne (systeme|software|ausstattung)/i, 'Technik'],
    [/produkt/i, 'Produkt'],
    [/kunden/i, 'Kundenbeziehungen'],
    [/tagesplanung|tag selbst (planen|einteilen)|eigener herr|selbst einteilen/i, 'Freie Tagesplanung'],
    [/dienstwagen|firmenwagen|\bauto\b/i, 'Firmenwagen'],
    [/patient|menschen|bewohner|klient/i, 'Arbeit mit Menschen'],
    [/feste (arbeits)?zeiten|planbar|geregelte arbeitszeit|pünktlich feierabend|keine schicht|feierabend ist feierabend/i, 'Feste Arbeitszeiten'],
    [/ergebnisverantwortung|p&l|gesamtverantwortung|volle verantwortung/i, 'Ergebnisverantwortung'],
    [/unabhängig|keine konzernzentrale|kurze (entscheidungs)?wege|inhabergeführt/i, 'Unabhängigkeit'],
    [/beteiligung|anteile|equity|gewinnbeteil|virtual shares|vsop|esop/i, 'Beteiligung'],
  ],
  neg: [
    [/neue[rn]?\s+(chef|chefin|vorgesetzte?n?|führung|führungskraft|leiter(in)?|teamleit\w*|abteilungsleit\w*|bereichsleit\w*|geschäftsführ\w*|gf|boss|manager(in)?)|seit (der|die|dem) neue/i, 'Neue Führungskraft'],
    [CHEF, 'Probleme mit der Führungskraft'],
    [/entwickl|aufstieg|aufsteig|beförder|karriere|perspektiv|weiterkommen|komme nicht weiter|nächste[nr]? (stufe|schritt|level)|sackgasse|stillstand|stagnier|komm\w* .{0,20}nicht weiter|kein weiterkommen|seit jahren (das gleiche|dasselbe|auf der gleichen)/i, 'Keine Entwicklung'],
    [/stress|überstund|überarbeit|arbeitslast|zu viel arbeit|viel zu viel|belast|ausgebrannt|burn ?out|erschöpf|keine pause|kein feierabend|nie feierabend|\b[5-8]\d\s*(std|stunden)|land unter|am limit/i, 'Arbeitslast'],
    [/unter (dem )?markt|marktüblich|unter wert|andere verdienen mehr|zu wenig für (die|meine) (stelle|rolle|position)/i, 'Gehalt unter Markt'],
    [/fixum|fixgehalt|grundgehalt/i, 'Fixum zu niedrig'],
    [/provision/i, 'Provision gekürzt'],
    [/gehalt|geld|bezahl|verdien|unterbezahlt|vergütung|lohn|kohle|gehaltserhöhung|keine erhöhung|inflationsausgleich/i, 'Gehalt'],
    [/budget|jede ausgabe|kein geld für/i, 'Kein eigenes Budget'],
    [/entscheid|darf nichts|absegnen|genehmig|freigabe|keine befugnis|keine kompetenz/i, 'Kaum Entscheidungsrecht'],
    [/dokumentation|dokumentieren|\bdoku\b|schreibkram/i, 'Zu viel Dokumentation'],
    [/verwaltung|bürokrat|reporting|\breports?\b|papierkram|formular|administrat|excel-listen/i, 'Zu viel Verwaltung'],
    [/kultur|klima|atmosph|mobbing|toxisch|seilschaft|ellenbogen|lästern|angstkultur|stimmung/i, 'Unternehmenskultur'],
    [/wertschätz|anerkenn|nicht gesehen|undank|kein lob|nie lob|nicht gewürdigt|selbstverständlich/i, 'Wenig Wertschätzung'],
    [/pendel|arbeitsweg|weg zur arbeit|fahrzeit|anfahrt|\bstau\b|zu weit weg|weit entfernt|\d+\s*(km|kilometer)\b/i, 'Arbeitsweg'],
    [/übernahm|übernommen|aufgekauft|gekauft worden|neue[rn]? eigentümer|private equity|fusion|fusioniert|merger/i, 'Übernahme'],
    [/umstruktur|umbau|reorganis|neuorganis|restruktur|neu aufgestellt|abteilung aufgelöst|zusammengelegt/i, 'Umstrukturierung'],
    [/langweil|eintönig|monoton|unterfordert|immer das gleiche|immer dasselbe|nichts neues|keine herausforderung/i, 'Eintönige Aufgaben'],
    [/gestaltungsraum|nicht mehr gestalten|früher durfte/i, 'Kein Gestaltungsraum mehr'],
    [/mitsprache|mitred|gestalt|freiheit|eigene ideen|nichts bewegen|darf nichts verändern|keine freiräume|eingeschränkt/i, 'Wenig Gestaltungsspielraum'],
    [/termin|meeting|besprechung|nur noch in calls|calls den ganzen tag|abstimmungsrunde|jour fixe/i, 'Mehr Termine als Arbeit'],
    [/veraltet|alte technik|legacy|altsystem|steinzeit|alte software|uralt/i, 'Veraltete Technik'],
    [/technikentscheid|architektur.*(vorgegeben|entscheid)|stack.*vorgegeben|kein einfluss auf (die )?technik|tools werden vorgegeben/i, 'Kein Einfluss auf Technik'],
    [/bereitschaft|on-?call|pikett|nachts angerufen/i, 'Bereitschaftsdienst'],
    [/büropflicht|präsenzpflicht|zurück ins büro|home ?office.{0,20}(gestrichen|abgeschafft|weg|gekippt)|kein home ?office mehr|remote.{0,20}(gestrichen|abgeschafft|weg|gekippt)|return to office|jeden tag ins büro/i, 'Remote gestrichen'],
    [/unrealistisch|unerreichbar|nicht zu schaffen|zielvorgabe|planzahl/i, 'Unrealistische Ziele'],
    [/gebiet.*(kleiner|verkleinert|weggenommen|neu verteilt)|kunden weggenommen|bestandskunden abgeben/i, 'Gebiet verkleinert'],
    [/produkt.*(schlecht|schwach|nicht konkurrenzfähig|veraltet)|verlieren gegen|wettbewerb ist besser/i, 'Schwaches Produkt'],
    [/innendienst|zu wenig beim kunden|nur am schreibtisch|crm pflegen/i, 'Zu viel Innendienst'],
    [/reise|unterwegs|hotel|nicht zu hause|dienstreise/i, 'Viel Reisen'],
    [/einspring|aus dem frei geholt|frei gestrichen/i, 'Ständiges Einspringen'],
    [/dienstplan|schichtplan/i, 'Schlechte Dienstplanung'],
    [/nachtdienst|nachtschicht/i, 'Nachtdienste'],
    [/wochenenddienst|jedes wochenende|am wochenende arbeiten/i, 'Wochenenddienste'],
    [/personalmangel|unterbesetzt|zu wenig (leute|personal|kollegen)|stellen (sind )?(nicht |un)besetzt/i, 'Personalmangel'],
    [/gesellschafter|beirat|aufsichtsrat/i, 'Konflikt mit den Gesellschaftern'],
    [/operativ|tagesgeschäft|klein-?klein|feuerwehr|keine zeit für strategie/i, 'Zu viel operative Detailarbeit'],
    [/verkauft werden|wird verkauft|soll verkauft|verkauf (des|der) (firma|unternehmens)|verkauf geplant|(wollen|will) verkaufen|\bexit\b/i, 'Verkauf geplant'],
    [/strategiewechsel|neue strategie|strategie (geändert|gewechselt)|strategie nicht mit|neue richtung|kurswechsel|neu ausgerichtet/i, 'Strategiewechsel'],
    [/konzern|zentrale|holding|headquarter|vorgaben von oben/i, 'Konzernvorgaben'],
  ],
};

/** Genaue Führungs-Knöpfe: nur, wenn im selben Satzteil auch die Führungskraft vorkommt. */
const CHEF_DETAIL: [RegExp, string][] = [
  [/(entscheidet|bestimmt|macht) (alles |immer )?(allein|alleine|im alleingang)|über (meinen|unseren|meine) k[oö]pf|alleingang|ohne (mich|uns) zu fragen|keine mitsprache/i, 'Führungskraft entscheidet allein'],
  [/mischt (er |sie )?sich|mikromanag|micromanag|kontrollier|kontrollwahn|über die schulter|jeden schritt|kein vertrauen|misstrau/i, 'Führungskraft mischt sich überall ein'],
  [/rückendeckung|lässt (mich|uns) (im stich|hängen|allein)|steht nicht hinter|keine unterstützung|nicht unterstützt|stellt sich nicht vor/i, 'Wenig Rückendeckung'],
  [/nie da|kaum da|nicht erreichbar|kaum erreichbar|keine zeit für (mich|uns)|nie zeit|sehe (ihn|sie) (nie|kaum)/i, 'Führungskraft kaum erreichbar'],
];

/** Bei „stört“: Satzteil lobt nur („passt“, „super“) und verneint nichts → kein Stör-Vorschlag. */
const LOB = /\b(passt|super|toll|top|klasse|zufrieden|gut|prima|okay|ok)\b/i;
const VERNEINT = /\b(nicht|kein\w*|nie|zu wenig|schlecht\w*|mies\w*|unter|weniger|null)\b/i;

/** Gleicher Sinn, anderer Knopf je Familie (Gehalt ↔ Bezahlung, Arbeitsweg ↔ Nähe zum Wohnort). */
const SAME_MEANING = [['Gehalt', 'Bezahlung', 'Vergütung', 'Verdienst'], ['Arbeitsweg', 'Nähe zum Wohnort']];

export type UnderstoodSource = 'wort' | 'gelernt' | 'ki';
export interface Understood {
  label: string;
  /** Satzteil aus den eigenen Worten, auf den sich der Vorschlag stützt. */
  quote: string;
  source: UnderstoodSource;
  /** Genauer Knopf zum ungenauen (z. B. „Führungskraft entscheidet allein“). */
  detail?: string;
}
/** Vom Headhunter bestätigtes Paar „Worte → Knopf“ (Tabelle interview_phrase_learnings). */
export interface LearnedPhrase { side: MotiveSide | 'goal'; phrase: string; label: string }

/** Satzteile der eigenen Worte, Schreibweise wie getippt. */
export function ownWordClauses(own: string): string[] {
  return own
    .split(/[,;.!?\n]+|\s+(?:und|aber|weil|sowie|außerdem|deshalb|trotzdem)\s+/i)
    .map((c) => c.trim().replace(/^(und|aber|weil|sowie|außerdem|deshalb|trotzdem)\s+/i, ''))
    .filter((c) => c.replace(/[^a-zäöüß]/gi, '').length >= 3);
}

const shortQuote = (c: string) => {
  const words = c.split(/\s+/);
  return words.length > 8 ? `${words.slice(0, 8).join(' ')} …` : c;
};

/** Für das lernende Wörterbuch: kurz, klein, ohne Zahlen, Mails, Links und Namen nach Herr/Frau. */
export function learnablePhrase(quote: string): string | null {
  let t = quote.toLowerCase().replace(/…/g, ' ');
  if (/@|https?:|www\.|\d/.test(t)) return null;
  t = t.replace(/\b(herr|frau|hr|fr)\.?\s+\S+/g, ' ').replace(/[^a-zäöüß\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter(Boolean).slice(0, 6);
  if (!words.some((w) => w.length >= 3)) return null;
  const out = words.join(' ');
  return out.length > 60 ? out.slice(0, 60).trim() : out;
}

/**
 * Was in den eigenen Worten steckt: je Satzteil die passenden Knöpfe, die noch nicht
 * angetippt sind. Erst das Wörterbuch, dann gelernte Wendungen; nie mehr als 4 Vorschläge.
 */
export function understandOwnWords(text: string, side: MotiveSide, family: RoleFamily | null = null, learned: LearnedPhrase[] = []): Understood[] {
  const own = motiveOwnWords(text, side);
  if (!own) return [];
  const cat = catalog(side);
  const chosen = new Set(motiveLabels(text, side));
  // Schon angetippt: der Knopf selbst, ein genauer Knopf dazu oder ein Geschwister-Detail.
  const isChosen = (label: string) => {
    if (chosen.has(label)) return true;
    const generic = cat[label]?.detailOf ?? label;
    return Object.keys(cat).some((l) => chosen.has(l) && cat[l].detailOf === generic);
  };
  const familyChips = family ? MOTIVE_CHIPS[family][side] : [];
  const swap = (label: string) => {
    const group = SAME_MEANING.find((g) => g.includes(label));
    if (!family || !group || familyChips.includes(label)) return label;
    return familyChips.find((l) => group.includes(l)) ?? label;
  };
  // Steht die Führungskraft irgendwo im Text, zählen „mischt sich überall ein“ & Co. auch ohne das Wort.
  const chefContext = CHEF.test(own);
  const hits: Understood[] = [];
  const add = (u: Understood) => {
    if (isChosen(u.label) || hits.some((h) => h.label === u.label)) return;
    hits.push(u);
  };
  for (const clause of ownWordClauses(own)) {
    if (side === 'neg' && LOB.test(clause) && !VERNEINT.test(clause)) continue;
    if (side === 'pos' && VERNEINT.test(clause)) continue;
    const quote = shortQuote(clause);
    const inClause: string[] = [];
    for (const [re, label] of MOTIVE_RECOGNIZE[side]) {
      if (!re.test(clause)) continue;
      // Neue Führungskraft schlägt das allgemeine Führungsthema; Gehalt unter Markt das allgemeine Gehalt.
      if (label === 'Probleme mit der Führungskraft' && inClause.includes('Neue Führungskraft')) continue;
      if (cat[label]?.group === 'gehalt' && inClause.some((l) => cat[l]?.group === 'gehalt')) continue;
      if (label === 'Wenig Gestaltungsspielraum' && inClause.includes('Kein Gestaltungsraum mehr')) continue;
      if (label === 'Team' && inClause.some((l) => l === 'Mein Team' || l === 'Selbst aufgebautes Team')) continue;
      inClause.push(label);
      const detail = label === 'Probleme mit der Führungskraft' ? CHEF_DETAIL.find(([d]) => d.test(clause))?.[1] : undefined;
      // Ist die Führungskraft schon angetippt, gleich den genauen Knopf vorschlagen.
      if (detail && chosen.has(label)) add({ label: detail, quote, source: 'wort' });
      else add({ label: swap(label), quote, source: 'wort', ...(detail ? { detail } : {}) });
    }
    if (side === 'neg' && chefContext && !inClause.includes('Probleme mit der Führungskraft')) {
      const detail = CHEF_DETAIL.find(([d]) => d.test(clause))?.[1];
      if (detail && chosen.has('Probleme mit der Führungskraft')) add({ label: detail, quote, source: 'wort' });
      else if (detail) add({ label: 'Probleme mit der Führungskraft', quote, source: 'wort', detail });
    }
    const n = clause.toLowerCase().replace(/[^a-zäöüß\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const l of learned) if (l.side === side && cat[l.label] && !cat[l.label].ambiguous && n.includes(l.phrase)) add({ label: l.label, quote, source: 'gelernt' });
  }
  return hits.slice(0, 4);
}

/** Themen in den eigenen Worten, die noch nicht angetippt sind (nur die Knopfnamen). */
export function recognizedMotives(text: string, side: MotiveSide): string[] {
  return understandOwnWords(text, side).map((u) => u.label).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Alte, ungenaue Knöpfe klären
// ---------------------------------------------------------------------------

export interface AmbiguousChoice { label: string; options: string[]; ask?: string }

/** Angetippte alte Knöpfe, die zwei Dinge vermischen (Stör-Knöpfe oder Auslöser). */
export function ambiguousMotives(text: string, side: MotiveSide): AmbiguousChoice[] {
  return motiveLabels(text, side)
    .map((l) => catalog(side)[l])
    .map((e, i) => ({ e, l: motiveLabels(text, side)[i] }))
    .filter(({ e }) => e.ambiguous)
    .map(({ e, l }) => ({ label: l, options: e.ambiguous!, ask: e.ask }));
}

/** Alten Knopf an seiner Stelle durch die gewählten genauen ersetzen; eigene Worte bleiben. */
export function resolveAmbiguous(text: string, side: MotiveSide, legacy: string, chosen: string[]): string {
  const labels = motiveLabels(text, side);
  const next = labels.flatMap((l) => (l === legacy ? chosen.filter((c) => !labels.includes(c)) : [l]));
  const own = motiveOwnWords(text, side);
  return [...next, ...(own ? [own] : [])].join(', ');
}

/** Dasselbe für den Auslöser. */
export function ambiguousIncidents(text: string): AmbiguousChoice[] {
  return incidentParts(text).events.filter((e) => INCIDENTS[e]?.ambiguous).map((e) => ({ label: e, options: INCIDENTS[e].ambiguous!, ask: INCIDENTS[e].ask }));
}
export function resolveAmbiguousIncident(text: string, legacy: string, chosen: string[]): string {
  const p = incidentParts(text);
  const events = p.events.flatMap((e) => (e === legacy ? chosen.filter((c) => !p.events.includes(c)) : [e]));
  return [...events, ...(p.time ? [p.time] : []), ...(p.own ? [p.own] : [])].join(', ');
}

// ---------------------------------------------------------------------------
// Früher erzeugte Kundentexte erkennen
// ---------------------------------------------------------------------------
// Ändern sich die Satzbausteine, passt ein früher erzeugter Text nicht mehr genau zum
// heutigen Ergebnis. Besteht er nur aus bekannten Bausteinen (heutigen oder früheren),
// zählt er trotzdem als „aus den Klicks“ und wird neu formuliert; eigene Sätze dahinter
// bleiben als Ergänzung. Selbst umformulierte Sätze passen nicht und bleiben stehen.

/** Bausteine früherer Fassungen (16.10.2026), damit ihre Texte erkannt werden. */
const FRUEHERE_BAUSTEINE = [
  'echte Entscheidungsbefugnis mit eigenem Budget', 'mehr Zeit für Führung und fachliche Themen', 'eine offene Unternehmenskultur',
  'mehr Zeit für die eigentliche Arbeit', 'Raum für eigene Ideen', 'Mitsprache bei Technik und Architektur', 'wenig oder gut bezahlte Bereitschaft',
  'ein gut besetztes Team', 'eine Führung auf Augenhöhe', 'inhaltlich anspruchsvolle Aufgaben', 'ein tarifgebundener Arbeitgeber',
];

function knownPhrases(): string[] {
  const list = [
    ...Object.values(CLIENT_NEED).filter((x): x is string => !!x),
    ...Object.values(MOTIVE_NEG).flatMap((e) => [e.need, ...Object.values(e.needBy ?? {})]),
    ...Object.values(KEEP).filter((k): k is { text: string; pl?: boolean } => !!k).map((k) => k.text),
    ...Object.values(ANLASS),
    ...Object.values(ANLASS_AUSLOESER),
    ...FRUEHERE_BAUSTEINE,
  ];
  return [...new Set(list)].sort((a, b) => b.length - a.length);
}

const ENV_PHRASES = ['möchte in der bisherigen branche bleiben', 'internationale aufgaben', 'einen branchenwechsel', 'den mittelstand', 'einen konzern', 'ein start-up', 'ist offen für', 'offen für', 'einen umzug', 'bevorzugt'];

const isBuiltFrom = (body: string, phrases: string[]) => {
  let rest = body;
  for (const p of phrases) rest = rest.split(p).join(' ');
  return rest.replace(/,|\bund\b|\s+/g, '').length === 0;
};

/** Ist der Text ein früher erzeugter Satz aus Klicks (plus Ergänzung)? */
export function earlierGeneratedMotivation(text: string): { auto: boolean; addition: string } {
  const sentences = text.trim().match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) ?? [];
  const phrases = knownPhrases();
  let i = 0;
  for (; i < sentences.length; i++) {
    const s = sentences[i].replace(/[.!?]+$/, '');
    let m: RegExpExecArray | null;
    if ((m = /^Sucht (.+)$/.exec(s)) && isBuiltFrom(m[1], phrases)) continue;
    if ((m = /^Anlass ist (.+?)(?: im (?:Winter|Frühjahr|Sommer|Herbst) \d{4})?$/.exec(s)) && isBuiltFrom(m[1], phrases)) continue;
    if ((m = /^Wichtig (?:bleibt|bleiben) (?:außerdem )?(.+)$/.exec(s)) && isBuiltFrom(m[1], phrases)) continue;
    if (/^(Nächster Schritt|Langfristiges Ziel): [^.!?]{2,120}$/.test(s)) continue;
    if (/^(Bevorzugt|Möchte|Ist offen|Offen)\b/.test(s) && isBuiltFrom(s.toLowerCase(), ENV_PHRASES)) continue;
    break;
  }
  return i > 0 ? { auto: true, addition: sentences.slice(i).join(' ') } : { auto: false, addition: '' };
}
