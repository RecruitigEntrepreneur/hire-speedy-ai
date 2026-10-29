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
  // Ton (29.10.2026): wie Julia selbst schreibt, freundlich, mit Bezug und Dank, ohne Behauptungen,
  // die sie nicht anklickt. An Kandidaten per du, an Kunden per Sie.
  const callMe: Chip = { key: 'call', label: 'Ruf mich gern an', text: 'Wenn du magst, ruf mich gern an, dann erzähle ich dir mehr.' };
  switch (category) {
    case 'client_review_stalled':
      return {
        clientIntents: [
          { key: 'decision', label: `Entscheidung bis ${inDays(2)}`, text: `Gibt es schon eine erste Einschätzung? Eine Entscheidung bis ${inDays(2)} würde uns beiden sehr helfen.` },
          { key: 'question', label: 'Rückfrage: mehr Infos?', text: 'Fehlen Ihnen noch Informationen für Ihre Einschätzung? Ich liefere gern nach.' },
          { key: 'remind', label: 'Nur erinnern', text: 'Ich wollte den Kandidaten noch einmal in Erinnerung bringen.' },
        ],
        clientHints: [
          { key: 'parallel', label: 'Kandidat führt parallel ein Gespräch', text: 'Der Kandidat führt parallel ein weiteres Gespräch.' },
          { key: 'interested', label: 'Kandidat weiterhin interessiert', text: 'Der Kandidat ist weiterhin sehr interessiert.' },
          { key: 'available', label: 'Kandidat kurzfristig verfügbar', text: 'Der Kandidat ist kurzfristig verfügbar.' },
        ],
        candidate: [
          { key: 'nudged', label: 'Ich habe beim Kunden nachgefasst', text: `kurzer Zwischenstand von mir: Ich habe heute beim Unternehmen zu ${job} nachgehakt.` },
          { key: 'until', label: `Entscheidung bis ${inDays(2)}`, text: `Ich rechne bis ${inDays(2)} mit einer Rückmeldung und melde mich sofort, sobald ich etwas höre.` },
          { key: 'available', label: 'Bist du noch verfügbar?', text: 'Bist du weiterhin verfügbar und interessiert? Sag mir gern kurz Bescheid.' },
          { key: 'other', label: 'Wie steht dein anderes Gespräch?', text: 'Wie steht es bei dir mit dem anderen Prozess? Dann kann ich das Tempo hier besser einschätzen.' },
        ],
        candidateSubject: `Kurzer Stand zu ${job}`,
      };
    case 'opt_in_pending':
    case 'opt_in_pending_24h':
    case 'opt_in_pending_48h':
      return {
        clientIntents: [
          { key: 'reached', label: 'Kandidat erreicht, wählt bis morgen', text: 'Ich habe gerade mit dem Kandidaten gesprochen. Bis morgen ist eine Ihrer Zeiten gewählt.' },
          { key: 'busy', label: 'Kandidat verhindert, meldet sich', text: 'Der Kandidat ist gerade verhindert und meldet sich in Kürze bei mir. Ich halte Sie auf dem Laufenden.' },
          { key: 'newslots', label: 'Braucht andere Zeiten', text: 'Leider passt keine der vorgeschlagenen Zeiten. Könnten Sie zwei, drei weitere anbieten? Dann geht es schnell weiter.' },
          // „Kandidat zieht zurück“ entfällt (29.10.2026): echte Absage über „Will nicht“ im Anruf-Schritt
        ],
        clientHints: [],
        candidate: [
          { key: 'remind', label: 'Erinnerung an die Einladung', text: `kurze Erinnerung von mir: Die Einladung zum Gespräch für ${job} wartet noch auf deine Antwort. In der Mail wählst du mit einem Klick eine der Zeiten.` },
          { key: 'notfit', label: 'Passt keine Zeit? Sag mir zwei Vorschläge', text: 'Falls keine der Zeiten passt, schick mir einfach zwei Alternativen. Ich kläre das mit dem Unternehmen.' },
          { key: 'alt', label: 'Andere Zeit selbst vorschlagen', text: 'In der Einladung kannst du unter „Andere Zeit“ auch selbst eine passende Zeit vorschlagen.' },
          { key: 'call', label: 'Ruf mich kurz an', text: 'Ruf mich gern kurz an, dann klären wir alles in zwei Minuten.' },
        ],
        candidateSubject: `Deine Einladung zum Gespräch: ${job}`,
      };
    case 'job_closed_inform':
      return {
        clientIntents: [],
        clientHints: [],
        candidate: [
          { key: 'inform', label: 'Stelle besetzt, wertschätzend', text: `kurze Nachricht von mir: Die Stelle ${job} ist inzwischen besetzt. Danke dir für dein Vertrauen und die Zeit, die du dir genommen hast.` },
          { key: 'next', label: 'Ich habe andere Stellen', text: 'Ich habe ein, zwei andere Stellen im Blick, die gut zu dir passen könnten, und melde mich dazu in den nächsten Tagen.' },
          { key: 'pool', label: 'Ich behalte dich im Blick', text: 'Ich behalte dich im Blick und melde mich, sobald etwas Passendes kommt.' },
          callMe,
        ],
        candidateSubject: `Kurzer Stand zur Stelle ${job}`,
      };
    case 'rejected_inform':
      return {
        clientIntents: [
          { key: 'thanks', label: 'Danke, Alternative folgt', text: 'Ich schlage Ihnen in Kürze einen Kandidaten vor, der besser passt.' },
          { key: 'why', label: 'Rückfrage zum Grund', text: 'Damit ich gezielter suchen kann: Was hat bei diesem Kandidaten nicht gepasst?' },
        ],
        clientHints: [],
        candidate: [
          { key: 'inform', label: 'Absage, wertschätzend', text: `danke dir noch einmal für dein Vertrauen und die Zeit, die du dir für die Bewerbung als ${job} genommen hast. Leider hat sich das Unternehmen gegen ein Gespräch entschieden. Mir ist wichtig, dass du das direkt von mir hörst.` },
          { key: 'reason_salary', label: 'Grund: Gehalt', text: 'Es lag am Budget, nicht an deiner Qualifikation.' },
          { key: 'reason_fit', label: 'Grund: Profil passt nicht ganz', text: 'Das Profil passte nicht in allen Punkten zu dem, was das Unternehmen sucht. Das sagt nichts über deine Qualität aus.' },
          { key: 'next', label: 'Ich habe andere Stellen', text: 'Ich habe ein, zwei andere Stellen im Blick, die gut zu dir passen könnten, und melde mich dazu in den nächsten Tagen.' },
          { key: 'pool', label: 'Ich behalte dich im Blick', text: 'Ich behalte dich im Blick und melde mich, sobald etwas Passendes kommt.' },
          callMe,
        ],
        candidateSubject: `Deine Bewerbung als ${job}`,
      };
    case 'offer_counter_stalled':
      // Gegenwunsch liegt beim Kunden (22.10.2026)
      return {
        clientIntents: [
          { key: 'decision', label: `Entscheidung bis ${inDays(2)}`, text: `Wie stehen Sie dazu? Ob Sie das Angebot anpassen, dabei bleiben oder absagen möchten: Eine kurze Rückmeldung bis ${inDays(2)} würde allen helfen.` },
          { key: 'call', label: 'Kurz telefonieren?', text: 'Wenn Sie mögen, besprechen wir den Gegenwunsch kurz am Telefon. Ich kann Ihnen gut einordnen, wie fest er ist.' },
          { key: 'remind', label: 'Nur erinnern', text: 'Ich wollte den Gegenwunsch noch einmal in Erinnerung bringen.' },
        ],
        clientHints: [
          { key: 'waiting', label: 'Kandidat wartet auf Antwort', text: 'Der Kandidat wartet gespannt auf Ihre Antwort.' },
          { key: 'parallel', label: 'Kandidat hat weiteres Angebot', text: 'Der Kandidat hat noch einen weiteren Prozess laufen.' },
          { key: 'flexible', label: 'Kandidat ist gesprächsbereit', text: 'Der Kandidat ist beim Gegenwunsch gesprächsbereit.' },
        ],
        candidate: [
          { key: 'nudged', label: 'Ich habe nachgefasst', text: `kurzer Zwischenstand von mir: Ich habe heute beim Unternehmen wegen deines Gegenwunsches für ${job} nachgehakt.` },
          { key: 'until', label: `Antwort bis ${inDays(2)}`, text: `Ich habe um eine Antwort bis ${inDays(2)} gebeten und melde mich sofort, sobald ich etwas höre.` },
          { key: 'change', label: 'Sag Bescheid, wenn sich was tut', text: 'Falls sich bei dir in der Zwischenzeit etwas tut, sag mir gern kurz Bescheid.' },
        ],
        candidateSubject: 'Kurzer Stand zu deinem Gegenwunsch',
      };
    default:
      return {
        clientIntents: [{ key: 'remind', label: 'Nur erinnern', text: 'Ich wollte den Kandidaten noch einmal in Erinnerung bringen.' }],
        clientHints: [],
        candidate: [{ key: 'status', label: 'Kurzer Stand', text: `kurzer Stand von mir zu ${job}: Ich bin dran und melde mich, sobald es Neues gibt.` }],
        candidateSubject: `Kurzer Stand zu ${job}`,
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
      { key: 'decision', label: `Entscheidung bis ${inDays(2)}`, text: `Gibt es schon eine erste Einschätzung${viele ? ' zu den Kandidaten' : ''}? Eine Entscheidung bis ${inDays(2)} würde uns beiden sehr helfen.` },
      { key: 'question', label: 'Rückfrage: mehr Infos?', text: 'Fehlen Ihnen noch Informationen für Ihre Einschätzung? Ich liefere gern nach.' },
      { key: 'remind', label: 'Nur erinnern', text: viele ? 'Ich wollte die Kandidaten noch einmal in Erinnerung bringen.' : 'Ich wollte den Kandidaten noch einmal in Erinnerung bringen.' },
    ],
    clientHints: [
      { key: 'interested', label: viele ? 'Kandidaten weiterhin interessiert' : 'Kandidat weiterhin interessiert', text: viele ? 'Die Kandidaten sind weiterhin sehr interessiert.' : 'Der Kandidat ist weiterhin sehr interessiert.' },
      { key: 'parallel', label: viele ? 'Mindestens einer führt parallel Gespräche' : 'Kandidat führt parallel ein Gespräch', text: viele ? 'Mindestens einer der Kandidaten führt parallel weitere Gespräche.' : 'Der Kandidat führt parallel ein weiteres Gespräch.' },
      { key: 'available', label: viele ? 'Kurzfristig verfügbar' : 'Kandidat kurzfristig verfügbar', text: viele ? 'Die Kandidaten sind kurzfristig verfügbar.' : 'Der Kandidat ist kurzfristig verfügbar.' },
    ],
  };
}

/** Kunde gibt nach dem Interview keinen Eindruck (28.10.2026): Bitte um Feedback, eine Mail für alle Kandidaten. */
export function feedbackBundleSet(count: number, firstName: string | null): Pick<MessageSet, 'clientIntents' | 'clientHints'> {
  const viele = count > 1;
  const wen = viele ? 'aus den Interviews' : `von ${firstName || 'dem Kandidaten'}`;
  return {
    clientIntents: [
      { key: 'decision', label: `Eindruck bis ${inDays(2)}`, text: `Wie war Ihr Eindruck ${wen}? Ein kurzes Feedback bis ${inDays(2)} hilft uns beiden, den nächsten Schritt zu planen.` },
      { key: 'remind', label: 'Nur erinnern', text: `Ich wollte kurz an Ihr Feedback ${viele ? 'zu den Interviews' : 'zum Interview'} erinnern.` },
    ],
    clientHints: [
      { key: 'interested', label: viele ? 'Kandidaten sehr interessiert' : 'Kandidat sehr interessiert', text: viele ? 'Die Kandidaten sind sehr interessiert.' : 'Der Kandidat ist sehr interessiert.' },
      { key: 'parallel', label: viele ? 'Mindestens einer hat weitere Gespräche' : 'Kandidat hat weiteres Gespräch', text: viele ? 'Mindestens einer der Kandidaten führt weitere Gespräche.' : 'Der Kandidat führt noch ein weiteres Gespräch.' },
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
  // Je Baustein ein Absatz, so liest sich die Mail wie geschrieben (29.10.2026)
  return parts.join('\n\n');
}
