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
    p(`${esc(o.recruiterName)} hat die Antwort von <strong>${esc(o.candidateName)}</strong> (${esc(o.jobTitle)}) eingetragen.`),
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
