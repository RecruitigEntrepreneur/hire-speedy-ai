// Mailtexte rund um Empfehlung und Angebot (22.10.2026). Reine Funktionen:
// liefern Betreff, HTML und Text. Das Angebot überbringt der Headhunter, der
// Kandidat bekommt es danach schriftlich und antwortet selbst.
import { esc, layout } from './intake-mail.ts';

export interface MailContent { subject: string; html: string; text: string }

const p = (s: string) => `<p style="margin:0 0 12px 0;">${s}</p>`;
const muted = (s: string) => `<span style="color:#6b7280;">${s}</span>`;
const quote = (s: string) => `<div style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px;color:#374151;">„${esc(s)}“</div>`;
const plain = (...lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join('\n');
const euro = (n: number | null | undefined) => (n == null ? '' : `${new Intl.NumberFormat('de-DE').format(n)} €`);
/** „Mo., 09.11.“; in einem anderen Jahr mit Jahr: „Mo., 01.02.2027“ */
const day = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const other = d.getUTCFullYear() !== new Date().getUTCFullYear();
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', ...(other ? { year: 'numeric' as const } : {}), timeZone: 'Europe/Berlin' });
};

export interface OfferFacts {
  salary: number;
  variable: number | null;
  startDate: string | null;
  responseDue: string | null;
  contractType: string | null;
  probationMonths: number | null;
  workModel: string | null;
  extras: string[];
}

/** Zeilen für Mail und Text: „Fixgehalt 140.000 €“ usw. */
export function offerLines(o: OfferFacts): string[] {
  return [
    `Fixgehalt: ${euro(o.salary)} pro Jahr`,
    o.variable ? `Variabel bei 100 %: ${euro(o.variable)}` : null,
    o.startDate ? `Erster Arbeitstag: ${day(o.startDate)}` : null,
    [o.contractType === 'fixed_term' ? 'befristet' : 'unbefristet', o.probationMonths ? `${o.probationMonths} Monate Probezeit` : null].filter(Boolean).join(' · '),
    o.workModel ? `Ort und Modell: ${o.workModel}` : null,
    o.extras.length ? `Extras: ${o.extras.join(', ')}` : null,
  ].filter(Boolean) as string[];
}

const linesHtml = (lines: string[]) => p(lines.map((l) => esc(l)).join('<br>'));

// --- An den Headhunter ---------------------------------------------------------

/**
 * Angebot beim Headhunter. mailAt: wann der Kandidat es von selbst bekommt („um 17:05“, „morgen um 08:00“).
 * wishAccepted: der Kunde hat den Gegenwunsch angenommen, der Kandidat hat Version 2 schon per Mail.
 */
export function recruiterOfferReceived(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; jobTitle: string; offer: OfferFacts; message: string | null; adjusted: boolean; mailAt: string | null; wishAccepted?: boolean; offerUrl: string }): MailContent {
  const first = o.candidateName.split(' ')[0];
  if (o.wishAccepted) {
    const heading = `${o.companyName} nimmt den Wunsch von ${first} an`;
    const body = [
      p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`),
      p(`${esc(o.companyName)} nimmt den Wunsch von <strong>${esc(o.candidateName)}</strong> an. ${esc(first)} hat die neue Version gerade per Mail bekommen und kann direkt zusagen. Sag ${esc(first)} kurz Bescheid.`),
      linesHtml(offerLines(o.offer)),
    ].join('');
    return { subject: heading, html: layout({ preheader: o.jobTitle, heading, body, cta: { label: 'Angebot öffnen', url: o.offerUrl } }), text: plain(heading, ...offerLines(o.offer), o.offerUrl) };
  }
  const heading = o.adjusted ? `Angepasstes Angebot für ${o.candidateName}` : `Angebot für ${o.candidateName}`;
  const due = o.offer.responseDue ? ` bis ${day(o.offer.responseDue)}` : '';
  const body = [
    p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`),
    p(`${esc(o.companyName)} macht <strong>${esc(o.candidateName)}</strong> ${o.adjusted ? 'ein angepasstes Angebot' : 'ein Angebot'} für <strong>${esc(o.jobTitle)}</strong>. Bitte ruf ${esc(first)} jetzt an.${o.mailAt ? ` Spätestens ${esc(o.mailAt)} bekommt ${esc(first)} das Angebot von selbst per Mail und antwortet dann selbst${esc(due) || '.'}` : ''}`),
    linesHtml(offerLines(o.offer)),
    o.message ? p(`${muted(`Nachricht von ${esc(o.companyName)}:`)}`) + quote(o.message) : '',
  ].join('');
  return {
    subject: `${heading} – bitte ${o.mailAt ? `${o.mailAt.replace(/^um /, 'bis ').replace(/^morgen um /, 'bis morgen ')} ` : ''}anrufen`,
    html: layout({ preheader: o.jobTitle, heading, body, cta: { label: 'Angebot öffnen', url: o.offerUrl } }),
    text: plain(heading, ...offerLines(o.offer), o.message && `Nachricht: „${o.message}“`, o.offerUrl),
  };
}

export function recruiterOfferUpdate(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; text: string; akteUrl: string }): MailContent {
  const heading = `${o.companyName}: ${o.text}`;
  const body = [p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`), p(`${esc(o.text)} (${esc(o.candidateName)}).`)].join('');
  return { subject: heading, html: layout({ preheader: o.candidateName, heading, body, cta: { label: 'Akte öffnen', url: o.akteUrl } }), text: plain(heading, o.akteUrl) };
}

// --- Contracting: Einsatz angefragt (Etappe 1, 11.11.2026) ------------------------
// Bis Projektauftrag und Leistungsschein in der Plattform laufen, stimmt Matchunt
// Tagessatz und Vertrag von Hand ab. Kein Angebot, kein Arbeitsvertrag.

export interface EinsatzFacts { startDate: string; months: number; daysPerWeek: number }

const einsatzZeile = (e: EinsatzFacts) => `Beginn ${day(e.startDate)} · ${e.months} Monate · ${e.daysPerWeek} Tage je Woche`;

export function recruiterEinsatzAngefragt(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; jobTitle: string; einsatz: EinsatzFacts; akteUrl: string }): MailContent {
  const first = o.candidateName.trim().split(/\s+/)[0];
  const heading = `${o.companyName} will ${o.candidateName} einsetzen`;
  const body = [
    p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`),
    p(`${esc(o.companyName)} möchte <b style="font-weight:600">${esc(o.candidateName)}</b> als Spezialisten für ${esc(o.jobTitle)} einsetzen: ${esc(einsatzZeile(o.einsatz))}.`),
    p(`Sag ${esc(first)} Bescheid. Matchunt meldet sich bei dir wegen seines Tagessatzes und des Vertrags. Ein Angebot über ein Gehalt gibt es bei Contracting nicht.`),
  ].join('');
  return {
    subject: heading,
    html: layout({ preheader: einsatzZeile(o.einsatz), heading, body, cta: { label: 'Akte öffnen', url: o.akteUrl } }),
    text: plain(heading, einsatzZeile(o.einsatz), `Sag ${first} Bescheid. Matchunt meldet sich bei dir wegen seines Tagessatzes und des Vertrags.`, o.akteUrl),
  };
}

export function adminEinsatzAngefragt(o: { candidateName: string; companyName: string; jobTitle: string; recruiterName: string; budget: string | null; einsatz: EinsatzFacts; url: string }): MailContent {
  const heading = `Einsatz angefragt: ${o.candidateName} bei ${o.companyName}`;
  const zeilen = [
    `${o.jobTitle} · ${einsatzZeile(o.einsatz)}`,
    o.budget ?? 'Kunde ohne Budget: Tagessatz je Einsatz abstimmen',
    `Headhunter: ${o.recruiterName}`,
  ];
  const todo = 'Von Hand: Tagessatz mit dem Headhunter abstimmen, Projektauftrag an den Kunden, Freelancer-Vertrag und Leistungsschein an den Spezialisten.';
  const body = [...zeilen.map((z) => p(esc(z))), p(muted(esc(todo)))].join('');
  return { subject: heading, html: layout({ preheader: zeilen[0], heading, body, cta: { label: 'Bewerbung öffnen', url: o.url } }), text: plain(heading, ...zeilen, todo, o.url) };
}

// --- An den Kunden ---------------------------------------------------------------

export type AnswerWay = 'accepted' | 'considering' | 'countered' | 'declined';

export function clientOfferAnswer(o: {
  name: string | null; candidateName: string; recruiterName: string; jobTitle: string; way: AnswerWay;
  until?: string | null; note?: string | null; wish?: { salary?: number | null; variable?: number | null; startDate?: string | null; other?: string | null } | null;
  reason?: string | null; profileUrl: string;
  /** Hat der Kandidat selbst geantwortet (Antwortseite, 25.10.2026)? */
  byCandidate?: boolean;
}): MailContent {
  const first = o.candidateName.split(' ')[0];
  const heading = o.way === 'accepted' ? `${o.candidateName} hat zugesagt`
    : o.way === 'considering' ? `${first} überlegt noch${o.until ? ` bis ${day(o.until)}` : ''}`
      : o.way === 'countered' ? `${first} hat einen Gegenwunsch`
        : `${o.candidateName} hat abgesagt`;
  const wishLines = o.wish ? [
    o.wish.salary ? `Fixgehalt gewünscht: ${euro(o.wish.salary)}` : null,
    o.wish.variable ? `Variabel gewünscht: ${euro(o.wish.variable)}` : null,
    o.wish.startDate ? `Start gewünscht: ${day(o.wish.startDate)}` : null,
    o.wish.other ? `Sonst noch: ${o.wish.other}` : null,
  ].filter(Boolean) as string[] : [];
  const next = o.way === 'accepted'
    ? 'Schicken Sie jetzt den Arbeitsvertrag. Im Bewerberprofil finden Sie alle Vertragsdaten.'
    : o.way === 'countered'
      ? 'Im Bewerberprofil nehmen Sie den Wunsch an, machen einen eigenen Vorschlag, bleiben bei Ihrem Angebot oder sagen ab.'
      : o.way === 'considering' ? `${esc(o.recruiterName)} meldet sich, sobald ${esc(first)} entschieden hat.` : 'Ihre anderen Bewerber finden Sie in der Bewerberliste.';
  const body = [
    p(`Hallo${o.name ? ` ${esc(o.name.split(' ')[0])}` : ''},`),
    p(o.byCandidate
      ? `<strong>${esc(o.candidateName)}</strong> hat selbst auf Ihr Angebot geantwortet (${esc(o.jobTitle)}).`
      : `${esc(o.recruiterName)} hat die Antwort von <strong>${esc(o.candidateName)}</strong> (${esc(o.jobTitle)}) eingetragen.`),
    wishLines.length ? linesHtml(wishLines) : '',
    o.reason ? p(`${muted('Grund:')} ${esc(o.reason)}`) : '',
    o.note ? quote(o.note) : '',
    p(next),
  ].join('');
  return { subject: heading, html: layout({ preheader: o.jobTitle, heading, body, cta: { label: 'Bewerberprofil öffnen', url: o.profileUrl } }), text: plain(heading, ...wishLines, o.reason && `Grund: ${o.reason}`, o.note && `„${o.note}“`, o.profileUrl) };
}

export function clientRecommendation(o: { name: string | null; candidateName: string; recruiterName: string; jobTitle: string; intro: string | null; items: { label: string; value: string }[]; profileUrl: string }): MailContent {
  const heading = `Empfehlung von ${o.recruiterName} zu ${o.candidateName}`;
  const body = [
    p(`Hallo${o.name ? ` ${esc(o.name.split(' ')[0])}` : ''},`),
    o.intro ? quote(o.intro) : '',
    p(o.items.map((i) => `${muted(`${esc(i.label)}:`)} ${esc(i.value)}`).join('<br>')),
    p('Im Bewerberprofil steht die Empfehlung neben Ihrem Angebot.'),
  ].join('');
  return { subject: heading, html: layout({ preheader: o.jobTitle, heading, body, cta: { label: 'Angebot machen', url: o.profileUrl } }), text: plain(heading, o.intro, ...o.items.map((i) => `${i.label}: ${i.value}`), o.profileUrl) };
}


// --- An den Kandidaten (G + H, 25.10.2026) -----------------------------------------

export type CandidateMailKind = 'offer' | 'reminder' | 'confirm' | 'confirm_reminder';

/** Klaras persönliche Zeile mit Absender: die Mail selbst kommt vom Headhunter. */
const messageBlock = (companyName: string, message: string | null) =>
  (message ? p(muted(`Nachricht von ${esc(companyName)}:`)) + quote(message) : '');

/**
 * Eckdaten des Angebots an den Kandidaten, Absender „<Headhunter> über Matchunt“.
 * offer = erste Mail, reminder = einmalige Erinnerung nach 24 Std.,
 * confirm = „Haben Sie zugesagt?“ nach einer Meldung des Headhunters.
 */
export function candidateOffer(o: {
  kind: CandidateMailKind; candidateName: string; recruiterName: string; companyName: string; jobTitle: string;
  offer: OfferFacts; version: number; message: string | null; url: string; reportedAt?: string | null;
}): MailContent {
  const confirm = o.kind === 'confirm' || o.kind === 'confirm_reminder';
  const reminder = o.kind === 'reminder' || o.kind === 'confirm_reminder';
  const recruiterFirst = o.recruiterName.split(' ')[0];
  const subject = confirm
    ? `${reminder ? 'Erinnerung: ' : ''}Haben Sie zugesagt? Ihr Angebot von ${o.companyName}`
    : `${reminder ? 'Erinnerung: ' : ''}Ihr Angebot von ${o.companyName}: ${o.jobTitle}`;
  const intro = confirm
    ? `${esc(o.recruiterName)} hat ${esc(o.companyName)} Ihre Zusage gemeldet. Bitte bestätigen Sie sie kurz, erst dann gilt sie und der Arbeitsvertrag folgt.`
    : reminder
      ? `Sie haben noch nicht auf Ihr Angebot von ${esc(o.companyName)} geantwortet. Hier noch einmal die Eckdaten.`
      : `wie mit ${esc(o.recruiterName)} besprochen, hier die Eckdaten Ihres Angebots von ${esc(o.companyName)}${o.version > 1 ? ` (Version ${o.version})` : ''}:`;
  const lines = offerLines(o.offer);
  const due = o.offer.responseDue ? `Antwort bis ${day(o.offer.responseDue)}` : null;
  const body = [
    p(`Guten Tag ${esc(o.candidateName)},`),
    p(intro),
    linesHtml([...lines, ...(due ? [due] : [])]),
    messageBlock(o.companyName, o.message),
    p(muted(`Das sind die Eckdaten, noch kein Arbeitsvertrag. Verbindlich ist erst der Arbeitsvertrag, den Sie mit ${esc(o.companyName)} unterschreiben.`)),
    p(`Fragen klären Sie mit ${esc(recruiterFirst)}: Antworten Sie einfach auf diese Mail.`),
  ].join('');
  const cta = { label: confirm ? 'Zusage bestätigen' : 'Angebot ansehen und antworten', url: o.url };
  return {
    subject,
    html: layout({ preheader: `${o.companyName} · ${o.jobTitle}`, heading: confirm ? 'Haben Sie zugesagt?' : `Ihr Angebot von ${o.companyName}`, body, cta }),
    text: plain(subject, ...lines, due, 'Das sind die Eckdaten, noch kein Arbeitsvertrag.', o.url),
  };
}

/** Kandidat: die Antwortfrist wurde verlängert, das Angebot gilt unverändert. */
export function candidateDueExtended(o: { candidateName: string; companyName: string; jobTitle: string; responseDue: string; url: string }): MailContent {
  const subject = `Neue Antwortfrist: Ihr Angebot von ${o.companyName}`;
  const body = [
    p(`Guten Tag ${esc(o.candidateName)},`),
    p(`${esc(o.companyName)} hat die Antwortfrist bis <strong>${esc(day(o.responseDue))}</strong> verlängert. Das Angebot gilt unverändert.`),
  ].join('');
  return { subject, html: layout({ preheader: `${o.companyName} · ${o.jobTitle}`, heading: 'Neue Antwortfrist', body, cta: { label: 'Angebot ansehen und antworten', url: o.url } }), text: plain(subject, `Antwort bis ${day(o.responseDue)}`, o.url) };
}

/** Kunde: der Headhunter bittet um mehr Zeit für den Kandidaten. */
export function clientExtensionAsked(o: { name: string | null; candidateName: string; recruiterName: string; jobTitle: string; responseDue: string | null; profileUrl: string }): MailContent {
  const heading = `${o.recruiterName} bittet um mehr Zeit für ${o.candidateName}`;
  const body = [
    p(`Hallo${o.name ? ` ${esc(o.name.split(' ')[0])}` : ''},`),
    p(`${esc(o.recruiterName)} bittet um eine längere Antwortfrist für Ihr Angebot an <strong>${esc(o.candidateName)}</strong> (${esc(o.jobTitle)}).${o.responseDue ? ` Bisher gilt: Antwort bis ${esc(day(o.responseDue))}.` : ''}`),
    p('Die Frist verlängern Sie im Bewerberprofil mit einem Klick.'),
  ].join('');
  return { subject: heading, html: layout({ preheader: o.jobTitle, heading, body, cta: { label: 'Bewerberprofil öffnen', url: o.profileUrl } }), text: plain(heading, o.profileUrl) };
}

/** Headhunter: der Kandidat möchte sprechen (Rückruf binnen 2 Std.) */
export function recruiterCallback(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; topic: string | null; until: string; akteUrl: string }): MailContent {
  const heading = `${o.candidateName} möchte mit dir sprechen`;
  const body = [
    p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`),
    p(`${esc(o.candidateName)} möchte das Angebot von ${esc(o.companyName)} mit dir besprechen. Bitte ruf bis <strong>${esc(o.until)}</strong> zurück.`),
    o.topic ? quote(o.topic) : '',
    p('Einen Gegenwunsch schickst du danach im Angebot an den Kunden, mit dem Haken „sagt bei diesen Werten zu“.'),
  ].join('');
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, cta: { label: 'Angebot öffnen', url: o.akteUrl } }), text: plain(heading, o.topic && `„${o.topic}“`, `Rückruf bis ${o.until}`, o.akteUrl) };
}
