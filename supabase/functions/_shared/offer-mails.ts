// Mailtexte rund um Empfehlung und Angebot (22.10.2026). Reine Funktionen:
// liefern Betreff, HTML und Text. Der Kandidat bekommt von Matchunt keine Mail;
// das Angebot überbringt der Headhunter.
import { esc, layout } from './intake-mail.ts';

export interface MailContent { subject: string; html: string; text: string }

const p = (s: string) => `<p style="margin:0 0 12px 0;">${s}</p>`;
const muted = (s: string) => `<span style="color:#6b7280;">${s}</span>`;
const quote = (s: string) => `<div style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px;color:#374151;">„${esc(s)}“</div>`;
const plain = (...lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join('\n');
const euro = (n: number | null | undefined) => (n == null ? '' : `${new Intl.NumberFormat('de-DE').format(n)} €`);
const day = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }) : '');

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
    `Fixgehalt: ${euro(o.salary)}`,
    o.variable ? `Variabel bei 100 %: ${euro(o.variable)}` : null,
    o.startDate ? `Erster Arbeitstag: ${day(o.startDate)}` : null,
    [o.contractType === 'fixed_term' ? 'befristet' : 'unbefristet', o.probationMonths ? `${o.probationMonths} Monate Probezeit` : null].filter(Boolean).join(' · '),
    o.workModel ? `Ort und Modell: ${o.workModel}` : null,
    o.extras.length ? `Extras: ${o.extras.join(', ')}` : null,
  ].filter(Boolean) as string[];
}

const linesHtml = (lines: string[]) => p(lines.map((l) => esc(l)).join('<br>'));

// --- An den Headhunter ---------------------------------------------------------

export function recruiterOfferReceived(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; jobTitle: string; offer: OfferFacts; message: string | null; adjusted: boolean; akteUrl: string }): MailContent {
  const first = o.candidateName.split(' ')[0];
  const heading = o.adjusted ? `Angepasstes Angebot für ${o.candidateName}` : `Angebot für ${o.candidateName}`;
  const due = o.offer.responseDue ? ` bis ${day(o.offer.responseDue)}` : '';
  const body = [
    p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`),
    p(`${esc(o.companyName)} macht <strong>${esc(o.candidateName)}</strong> ${o.adjusted ? 'ein angepasstes Angebot' : 'ein Angebot'} für <strong>${esc(o.jobTitle)}</strong>. Bitte besprich es mit ${esc(first)} und trag die Antwort${esc(due)} in der Akte ein.`),
    linesHtml(offerLines(o.offer)),
    o.message ? p(`${muted(`Nachricht von ${esc(o.companyName)}:`)}`) + quote(o.message) : '',
  ].join('');
  return {
    subject: `${heading} – bitte${due} besprechen`,
    html: layout({ preheader: o.jobTitle, heading, body, cta: { label: 'Akte öffnen', url: o.akteUrl } }),
    text: plain(heading, ...offerLines(o.offer), o.message && `Nachricht: „${o.message}“`, o.akteUrl),
  };
}

export function recruiterOfferUpdate(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; text: string; akteUrl: string }): MailContent {
  const heading = `${o.companyName}: ${o.text}`;
  const body = [p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`), p(`${esc(o.text)} (${esc(o.candidateName)}).`)].join('');
  return { subject: heading, html: layout({ preheader: o.candidateName, heading, body, cta: { label: 'Akte öffnen', url: o.akteUrl } }), text: plain(heading, o.akteUrl) };
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
      ? 'Im Bewerberprofil passen Sie das Angebot an, bleiben bei Ihrem Angebot oder sagen ab.'
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
    o.message && !confirm ? quote(o.message) : '',
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

/** Headhunter: der Kandidat möchte sprechen (Rückruf binnen 2 Std.) */
export function recruiterCallback(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; topic: string | null; until: string; akteUrl: string }): MailContent {
  const heading = `${o.candidateName} möchte mit Ihnen sprechen`;
  const body = [
    p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`),
    p(`${esc(o.candidateName)} möchte das Angebot von ${esc(o.companyName)} mit Ihnen besprechen. Bitte rufen Sie bis <strong>${esc(o.until)}</strong> zurück.`),
    o.topic ? quote(o.topic) : '',
    p('Einen Gegenwunsch schicken Sie danach in der Akte an den Kunden, mit dem Haken „sagt bei diesen Werten zu“.'),
  ].join('');
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, cta: { label: 'Akte öffnen', url: o.akteUrl } }), text: plain(heading, o.topic && `„${o.topic}“`, `Rückruf bis ${o.until}`, o.akteUrl) };
}
