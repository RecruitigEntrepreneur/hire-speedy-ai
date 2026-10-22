// Vorgefertigte Sätze je Aufgabentyp: der Headhunter klickt, das System schickt.
// Kunde: Bitte + Hinweise. Kandidat: Was er wissen soll. Alles ohne Firmenname
// (vor Reveal) und ohne Kandidatenname an den Kunden (vor Opt-In) — die Texte
// nennen den Kandidaten nicht, der Server setzt das Bewerber-Kürzel in den Kopf.

export interface Chip {
  key: string;
  label: string;
  /** Satz, der in den Text übernommen wird */
  text: string;
}

export interface MessageSet {
  /** Bitte an den Kunden: genau eine */
  clientIntents: Chip[];
  /** Hinweise an den Kunden: beliebig viele */
  clientHints: Chip[];
  /** Sätze an den Kandidaten: beliebig viele */
  candidate: Chip[];
  candidateSubject: string;
}

// Frist in n Werktagen, nie am Wochenende; als Wochentag oder, wenn weiter
// als sechs Tage weg, als Datum.
export const inDays = (n: number) => {
  const d = new Date();
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  const diff = (d.getTime() - Date.now()) / 86_400_000;
  return diff < 6 ? d.toLocaleDateString('de-DE', { weekday: 'long' }) : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
};

export function messageSetFor(category: string, ctx: { jobTitle: string | null; days?: number; hours?: number; firstName: string; reason?: string | null }): MessageSet {
  const job = ctx.jobTitle || 'die Stelle';
  switch (category) {
    case 'client_review_stalled':
      return {
        clientIntents: [
          { key: 'decision', label: `Entscheidung bis ${inDays(2)}`, text: `Gibt es schon eine Einschätzung? Eine Entscheidung bis ${inDays(2)} würde uns beiden helfen.` },
          { key: 'question', label: 'Rückfrage: mehr Infos?', text: 'Fehlen Ihnen noch Informationen für die Einschätzung? Ich liefere gern nach.' },
          { key: 'remind', label: 'Nur erinnern', text: 'Ich wollte die Einreichung kurz in Erinnerung bringen.' },
        ],
        clientHints: [
          { key: 'parallel', label: 'Kandidat führt parallel ein Gespräch', text: 'Der Kandidat führt parallel ein weiteres Gespräch.' },
          { key: 'interested', label: 'Kandidat weiterhin interessiert', text: 'Der Kandidat ist weiterhin sehr interessiert.' },
          { key: 'available', label: 'Kandidat kurzfristig verfügbar', text: 'Der Kandidat ist kurzfristig verfügbar.' },
        ],
        candidate: [
          { key: 'nudged', label: 'Ich habe beim Kunden nachgefasst', text: `ich habe heute beim Kunden zu ${job} nachgefasst.` },
          { key: 'until', label: `Entscheidung bis ${inDays(2)}`, text: `Ich rechne bis ${inDays(2)} mit einer Rückmeldung.` },
          { key: 'available', label: 'Bist du noch verfügbar?', text: 'Bist du weiterhin verfügbar und interessiert?' },
          { key: 'other', label: 'Wie steht dein anderes Gespräch?', text: 'Wie steht es bei dir mit dem anderen Prozess?' },
        ],
        candidateSubject: `Stand zu ${job}`,
      };
    case 'opt_in_pending':
    case 'opt_in_pending_24h':
    case 'opt_in_pending_48h':
      return {
        clientIntents: [
          { key: 'reached', label: 'Kandidat erreicht, wählt bis morgen', text: 'Ich habe den Kandidaten erreicht, er wählt bis morgen eine Ihrer Zeiten.' },
          { key: 'busy', label: 'Kandidat verhindert, meldet sich', text: 'Der Kandidat ist gerade verhindert und meldet sich in Kürze.' },
          { key: 'newslots', label: 'Braucht andere Zeiten', text: 'Keine der vorgeschlagenen Zeiten passt. Könnten Sie zwei bis drei weitere anbieten?' },
          { key: 'withdraw', label: 'Kandidat zieht zurück', text: 'Der Kandidat steht für dieses Gespräch leider nicht mehr zur Verfügung.' },
        ],
        clientHints: [],
        candidate: [
          { key: 'remind', label: 'Erinnerung an die Einladung', text: `die Einladung zum Gespräch für ${job} wartet noch auf deine Antwort. Ein Klick in der Mail genügt.` },
          { key: 'notfit', label: 'Passt keine Zeit? Sag mir zwei Vorschläge', text: 'Falls keine der Zeiten passt, schick mir bitte zwei Alternativen, ich kläre das mit dem Kunden.' },
          { key: 'call', label: 'Ruf mich kurz an', text: 'Ruf mich bitte kurz an, dann klären wir alles in zwei Minuten.' },
        ],
        candidateSubject: `Deine Einladung zum Gespräch: ${job}`,
      };
    case 'rejected_inform':
      return {
        clientIntents: [
          { key: 'thanks', label: 'Danke, Alternative folgt', text: 'Danke für die Rückmeldung. Ich schlage Ihnen in Kürze einen passenderen Kandidaten vor.' },
          { key: 'why', label: 'Rückfrage zum Grund', text: 'Könnten Sie mir kurz sagen, was genau nicht gepasst hat? Das hilft mir bei der weiteren Suche.' },
        ],
        clientHints: [],
        candidate: [
          { key: 'inform', label: 'Absage, wertschätzend', text: `leider hat sich der Kunde bei ${job} gegen ein Gespräch entschieden.` },
          { key: 'reason_salary', label: 'Grund: Gehalt', text: 'Es lag am Budget, nicht an deiner Qualifikation.' },
          { key: 'reason_fit', label: 'Grund: Profil passt nicht ganz', text: 'Das Profil passte nicht in allen Punkten zu dem, was der Kunde sich vorstellt.' },
          { key: 'next', label: 'Ich habe andere Stellen', text: 'Ich habe ein bis zwei andere Stellen im Blick, die besser passen könnten, und melde mich dazu.' },
          { key: 'pool', label: 'Ich behalte dich im Blick', text: 'Ich behalte dich im Blick und melde mich, sobald etwas Passendes kommt.' },
        ],
        candidateSubject: `Rückmeldung zu ${job}`,
      };
    case 'offer_counter_stalled':
      // Gegenwunsch liegt beim Kunden (22.10.2026)
      return {
        clientIntents: [
          { key: 'decision', label: `Entscheidung bis ${inDays(2)}`, text: `Wie stehen Sie zum Gegenwunsch des Kandidaten? Eine Entscheidung bis ${inDays(2)} wäre gut: anpassen, beim Angebot bleiben oder absagen.` },
          { key: 'call', label: 'Kurz telefonieren?', text: 'Sollen wir den Gegenwunsch kurz am Telefon besprechen? Ich kann Ihnen einordnen, wie fest er ist.' },
          { key: 'remind', label: 'Nur erinnern', text: 'Ich wollte den Gegenwunsch des Kandidaten kurz in Erinnerung bringen.' },
        ],
        clientHints: [
          { key: 'waiting', label: 'Kandidat wartet auf Antwort', text: 'Der Kandidat wartet auf Ihre Antwort.' },
          { key: 'parallel', label: 'Kandidat hat weiteres Angebot', text: 'Der Kandidat hat noch einen weiteren Prozess laufen.' },
          { key: 'flexible', label: 'Kandidat ist gesprächsbereit', text: 'Der Kandidat ist beim Gegenwunsch gesprächsbereit.' },
        ],
        candidate: [
          { key: 'nudged', label: 'Ich habe nachgefasst', text: `ich habe heute beim Kunden zu deinem Gegenwunsch für ${job} nachgefasst.` },
          { key: 'until', label: `Antwort bis ${inDays(2)}`, text: `Ich rechne bis ${inDays(2)} mit einer Antwort.` },
        ],
        candidateSubject: `Stand zu deinem Angebot`,
      };
    default:
      return {
        clientIntents: [{ key: 'remind', label: 'Nur erinnern', text: 'Ich wollte die Einreichung kurz in Erinnerung bringen.' }],
        clientHints: [],
        candidate: [{ key: 'status', label: 'Kurzer Stand', text: `kurzer Stand zu ${job}: ich bin dran und melde mich, sobald es Neues gibt.` }],
        candidateSubject: `Stand zu ${job}`,
      };
  }
}

/**
 * Bitte an den Kunden für eine ganze Stelle (Zeile „Kunde prüft“, 20.10.2026): gleiche
 * Wahl wie bei einem Kandidaten, die Sätze passen sich an mehrere Kandidaten an. Die
 * Kandidaten selbst nennt der Server in der Mail (vor Opt-In nur als Kürzel).
 */
export function clientBundleSet(count: number): Pick<MessageSet, 'clientIntents' | 'clientHints'> {
  const viele = count > 1;
  return {
    clientIntents: [
      { key: 'decision', label: `Entscheidung bis ${inDays(2)}`, text: `Gibt es schon eine Einschätzung${viele ? ' zu den Kandidaten' : ''}? Eine Entscheidung bis ${inDays(2)} würde uns beiden helfen.` },
      { key: 'question', label: 'Rückfrage: mehr Infos?', text: 'Fehlen Ihnen noch Informationen für die Einschätzung? Ich liefere gern nach.' },
      { key: 'remind', label: 'Nur erinnern', text: viele ? 'Ich wollte die Einreichungen kurz in Erinnerung bringen.' : 'Ich wollte die Einreichung kurz in Erinnerung bringen.' },
    ],
    clientHints: [
      { key: 'interested', label: viele ? 'Kandidaten weiterhin interessiert' : 'Kandidat weiterhin interessiert', text: viele ? 'Die Kandidaten sind weiterhin sehr interessiert.' : 'Der Kandidat ist weiterhin sehr interessiert.' },
      { key: 'parallel', label: viele ? 'Mindestens einer führt parallel Gespräche' : 'Kandidat führt parallel ein Gespräch', text: viele ? 'Mindestens einer der Kandidaten führt parallel weitere Gespräche.' : 'Der Kandidat führt parallel ein weiteres Gespräch.' },
      { key: 'available', label: viele ? 'Kurzfristig verfügbar' : 'Kandidat kurzfristig verfügbar', text: viele ? 'Die Kandidaten sind kurzfristig verfügbar.' : 'Der Kandidat ist kurzfristig verfügbar.' },
    ],
  };
}

export function composeClientText(set: Pick<MessageSet, 'clientIntents' | 'clientHints'>, intentKey: string | null, hintKeys: string[]): string {
  const intent = set.clientIntents.find(c => c.key === intentKey);
  const hints = set.clientHints.filter(c => hintKeys.includes(c.key)).map(c => c.text);
  return [intent?.text ?? '', ...hints].filter(Boolean).join(' ');
}

export function composeCandidateText(set: MessageSet, keys: string[]): string {
  const parts = set.candidate.filter(c => keys.includes(c.key)).map(c => c.text);
  if (!parts.length) return '';
  const [first, ...rest] = parts;
  return [first, ...rest].join(' ');
}
