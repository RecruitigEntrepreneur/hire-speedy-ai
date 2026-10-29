// Mailtexte rund um Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026). Reine
// Funktionen: liefern Betreff, HTML und Text. Seit 23.10.2026 (Unterschrift über
// Matchunt) bekommen Unterzeichner ohne Konto und der Kandidat ihren persönlichen
// Link von Matchunt; DocuSign mailt eingebetteten Unterzeichnern nichts. Alte
// Umschläge (signing_mode 'email') verschickt DocuSign weiter selbst.
import { esc, layout } from './intake-mail.ts';
import type { MailContent } from './offer-mails.ts';

const p = (s: string) => `<p style="margin:0 0 12px 0;">${s}</p>`;
const muted = (s: string) => `<span style="color:#6b7280;">${s}</span>`;
const quote = (s: string) => `<div style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px;color:#374151;">„${esc(s)}“</div>`;
const plain = (...lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join('\n');
const euro = (n: number | null | undefined) => (n == null ? '' : `${new Intl.NumberFormat('de-DE').format(n)} €`);
export const dateDe = (iso: string | null | undefined) =>
  (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }) : '');
const hallo = (name: string | null | undefined) => p(`Hallo${name ? ` ${esc(name)}` : ''},`);

export interface ContractFacts { signedOn: string | null; salary: number | null; variable: number | null; startDate: string | null }

export function factLines(f: ContractFacts): string[] {
  return [
    f.signedOn ? `Unterschrieben am: ${dateDe(f.signedOn)}` : null,
    f.salary ? `Gehalt laut Vertrag: ${euro(f.salary)}${f.variable ? ` + ${euro(f.variable)} variabel` : ''}` : null,
    f.startDate ? `Erster Arbeitstag: ${dateDe(f.startDate)}` : null,
  ].filter(Boolean) as string[];
}
const factsHtml = (f: ContractFacts) => p(factLines(f).map(esc).join('<br>'));

// --- An den Headhunter ---------------------------------------------------------

/** Stand des Vertrags: verschickt, Firma hat unterschrieben, abgelehnt, zurückgenommen … */
export function recruiterContractUpdate(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; text: string; detail?: string | null; akteUrl: string }): MailContent {
  const heading = `${o.candidateName}: ${o.text}`;
  const body = [hallo(o.recruiterFirstName), p(`${esc(o.companyName)}: ${esc(o.text)}`), o.detail ? quote(o.detail) : ''].join('');
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, cta: { label: 'Akte öffnen', url: o.akteUrl } }), text: plain(heading, o.detail, o.akteUrl) };
}

/** Kunde meldet die Unterschrift: Gegenprobe beim Kandidaten. */
export function recruiterCheckRequest(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; facts: ContractFacts; akteUrl: string }): MailContent {
  const first = o.candidateName.split(' ')[0];
  const heading = `${o.companyName} meldet: ${o.candidateName} hat unterschrieben`;
  const body = [
    hallo(o.recruiterFirstName),
    p(`${esc(o.companyName)} meldet die Unterschrift des Arbeitsvertrags. Passt das zu dem, was ${esc(first)} sagt?`),
    factsHtml(o.facts),
    p(muted('Bitte in der Akte „Stimmt“ oder „Weicht ab“ wählen.')),
  ].join('');
  return { subject: heading, html: layout({ preheader: 'Gegenprobe', heading, body, cta: { label: 'Gegenprobe machen', url: o.akteUrl } }), text: plain(heading, ...factLines(o.facts), o.akteUrl) };
}

/** Tag 10 nach der Zusage ohne Meldung. */
export function recruiterFollowup(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; days: number; akteUrl: string }): MailContent {
  const first = o.candidateName.split(' ')[0];
  const heading = `Vertrag mit ${o.candidateName}: seit ${o.days} Tagen keine Meldung`;
  const body = [
    hallo(o.recruiterFirstName),
    p(`Die Zusage an ${esc(o.companyName)} ist ${o.days} Tage her, eine Unterschrift ist noch nicht gemeldet. Frag bitte bei ${esc(first)} nach und trag den Stand in der Akte ein: unterschrieben oder abgesprungen.`),
  ].join('');
  return { subject: heading, html: layout({ preheader: 'Vertrag nachfassen', heading, body, cta: { label: 'Akte öffnen', url: o.akteUrl } }), text: plain(heading, o.akteUrl) };
}

// --- An den Kunden -------------------------------------------------------------

/** Headhunter, Matchunt oder der Kandidat selbst meldet: Stimmt das? */
export function clientConfirmRequest(o: { name: string | null; candidateName: string; reporterName: string; facts: ContractFacts; profileUrl: string }): MailContent {
  const self = o.reporterName === o.candidateName;
  const heading = self ? `${o.candidateName} meldet: Arbeitsvertrag unterschrieben` : `${o.reporterName} meldet: ${o.candidateName} hat unterschrieben`;
  const body = [
    hallo(o.name),
    p(self
      ? `<strong>${esc(o.candidateName)}</strong> meldet uns selbst: Der Arbeitsvertrag ist unterschrieben. Stimmt das?`
      : `${esc(o.reporterName)} meldet die Unterschrift des Arbeitsvertrags mit <strong>${esc(o.candidateName)}</strong>. Stimmt das?`),
    factsHtml(o.facts),
    p(muted('Erst nach Ihrer Bestätigung wird die Einstellung verbindlich.')),
  ].join('');
  return { subject: `${heading} – stimmt das?`, html: layout({ preheader: 'Bitte bestätigen', heading, body, cta: { label: 'Bestätigen', url: o.profileUrl } }), text: plain(heading, ...factLines(o.facts), o.profileUrl) };
}

/** Beide haben unterschrieben (DocuSign) bzw. die Meldung ist verbindlich. */
export function clientContractDone(o: { name: string | null; candidateName: string; facts: ContractFacts; digital: boolean; profileUrl: string }): MailContent {
  const heading = `Arbeitsvertrag mit ${o.candidateName} unterschrieben`;
  const body = [
    hallo(o.name),
    p(o.digital ? `Beide Seiten haben den Arbeitsvertrag über DocuSign unterschrieben. Das unterschriebene PDF liegt im Bewerberprofil.` : `Die Unterschrift des Arbeitsvertrags ist bestätigt.`),
    factsHtml(o.facts),
  ].join('');
  return { subject: heading, html: layout({ preheader: o.candidateName, heading, body, cta: { label: 'Profil öffnen', url: o.profileUrl } }), text: plain(heading, ...factLines(o.facts), o.profileUrl) };
}

/** Digitaler Weg: Stand an den Kunden (abgelehnt). */
export function clientContractUpdate(o: { name: string | null; candidateName: string; text: string; detail?: string | null; profileUrl: string }): MailContent {
  const heading = `${o.candidateName}: ${o.text}`;
  const body = [hallo(o.name), p(esc(o.text)), o.detail ? quote(o.detail) : ''].join('');
  return { subject: heading, html: layout({ preheader: o.candidateName, heading, body, cta: { label: 'Profil öffnen', url: o.profileUrl } }), text: plain(heading, o.detail, o.profileUrl) };
}

/** Tag 7 nach der Zusage ohne Meldung: drei Knöpfe führen ins Profil. */
export function clientReminder(o: { name: string | null; candidateName: string; recruiterName: string; profileUrl: string }): MailContent {
  const first = o.candidateName.split(' ')[0];
  const heading = `Ist der Vertrag mit ${o.candidateName} unterschrieben?`;
  const link = (label: string, open: string) => `<a href="${esc(`${o.profileUrl}?vertrag=${open}`)}" style="display:inline-block;margin:0 8px 8px 0;padding:8px 14px;border:1px solid #d1d5db;border-radius:8px;color:#111827;text-decoration:none;">${esc(label)}</a>`;
  const body = [
    hallo(o.name),
    p(`Damit ${esc(o.recruiterName)} und wir ${esc(first)} bis zum Start begleiten können: Wie ist der Stand beim Arbeitsvertrag?`),
    p(`${link('Ja, melden', 'melden')}${link('Noch nicht, verschickt am …', 'verschickt')}${link(`${first} ist abgesprungen`, 'abgesprungen')}`),
  ].join('');
  return { subject: heading, html: layout({ preheader: 'Kurz melden', heading, body }), text: plain(heading, `Melden: ${o.profileUrl}?vertrag=melden`) };
}

// --- An die Unterzeichner (Unterschrift über Matchunt) ---------------------------

const demoNote = (demo: boolean | undefined) => (demo ? p(muted('Testbetrieb: Diese Unterschrift ist noch nicht rechtsverbindlich.')) : '');
const validity = (days: number) => `Der Link gilt ${days} Tage und ist nur für Sie bestimmt.`;

/** Unterzeichner der Firma ohne Matchunt-Konto (z. B. Geschäftsführung). */
export function companySignLink(o: {
  name: string | null; companyName: string; candidateName: string; jobTitle: string; uploaderName: string | null; uploaderEmail: string | null;
  url: string; days: number; reminder?: boolean; demo?: boolean;
}): MailContent {
  const heading = o.reminder ? `Erinnerung: Arbeitsvertrag ${o.candidateName} unterschreiben` : `Bitte unterschreiben: Arbeitsvertrag ${o.candidateName}`;
  const body = [
    p(`Guten Tag${o.name ? ` ${esc(o.name)}` : ''},`),
    p(`${o.uploaderName ? `${esc(o.uploaderName)} hat` : 'Ihr Team hat'} bei Matchunt den Arbeitsvertrag für <strong>${esc(o.candidateName)}</strong> (${esc(o.jobTitle)}) hochgeladen. Sie unterschreiben für die ${esc(o.companyName)}; danach ist ${esc(o.candidateName.split(' ')[0])} dran.`),
    demoNote(o.demo),
  ].join('');
  const after = [validity(o.days), o.uploaderName ? `Fragen: ${o.uploaderName}${o.uploaderEmail ? `, ${o.uploaderEmail}` : ''}` : null].filter(Boolean).join(' ');
  return {
    subject: heading,
    html: layout({ preheader: o.companyName, heading, body, cta: { label: 'Vertrag ansehen und unterschreiben', url: o.url }, after: esc(after) }),
    text: plain(heading, `${o.uploaderName ?? 'Ihr Team'} hat den Arbeitsvertrag für ${o.candidateName} hochgeladen. Sie unterschreiben für die ${o.companyName}.`, o.url, after),
  };
}

/** Kandidat, sobald die Firma unterschrieben hat. */
export function candidateSignLink(o: {
  firstName: string; companyName: string; jobTitle: string; startDate: string | null; salary: number | null; variable: number | null;
  recruiterName: string | null; url: string; days: number; reminder?: boolean; demo?: boolean;
}): MailContent {
  const heading = o.reminder ? `Erinnerung: Ihr Arbeitsvertrag mit ${o.companyName}` : `Ihr Arbeitsvertrag mit ${o.companyName} ist da`;
  const facts = [
    `Stelle: ${o.jobTitle}`,
    o.startDate ? `Beginn: ${dateDe(o.startDate)}` : null,
    o.salary ? `Gehalt: ${euro(o.salary)}${o.variable ? ` + ${euro(o.variable)} variabel` : ''}` : null,
  ].filter(Boolean) as string[];
  const body = [
    hallo(o.firstName),
    p(o.reminder ? `Ihr Arbeitsvertrag mit ${esc(o.companyName)} wartet noch auf Ihre Unterschrift.` : `${esc(o.companyName)} hat Ihren Arbeitsvertrag unterschrieben. Jetzt fehlt nur noch Ihre Unterschrift.`),
    p(facts.map(esc).join('<br>')),
    demoNote(o.demo),
  ].join('');
  const after = [validity(o.days), o.recruiterName ? `Fragen zum Vertrag? Antworten Sie einfach auf diese Mail, sie geht an ${o.recruiterName}.` : null].filter(Boolean).join(' ');
  return {
    subject: heading,
    html: layout({ preheader: o.companyName, heading, body, cta: { label: 'Vertrag ansehen und unterschreiben', url: o.url }, after: esc(after) }),
    text: plain(heading, ...facts, o.url, after),
  };
}

/** Kandidat: beide haben unterschrieben, Kopie über denselben Weg. */
export function candidateSignedCopy(o: { firstName: string; companyName: string; startDate: string | null; url: string; days: number }): MailContent {
  const heading = `Geschafft: Ihr Arbeitsvertrag mit ${o.companyName} ist unterschrieben`;
  const body = [
    hallo(o.firstName),
    p(`Beide Seiten haben unterschrieben${o.startDate ? `. Ihr erster Arbeitstag: ${esc(dateDe(o.startDate))}` : ''}. Ihre Kopie des Vertrags können Sie hier herunterladen.`),
  ].join('');
  const after = `Der Link gilt ${o.days} Tage. Speichern Sie die Kopie bitte bei sich.`;
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, cta: { label: 'Kopie herunterladen', url: o.url }, after: esc(after) }), text: plain(heading, o.url, after) };
}

// --- An den Kandidaten, wenn die Firma selbst verschickt (29.10.2026) -----------
// „<Headhunter> über Matchunt“, Antworten gehen an den Headhunter. Die Knöpfe öffnen
// die Seite /vertrag/:token mit vorgewählter Antwort; gespeichert wird erst dort.

export type CandidateAnswerKey = 'arrived' | 'missing' | 'signed' | 'ok' | 'differs';

const buttons = (url: string, items: { label: string; a?: CandidateAnswerKey }[]) => p(items.map((it, i) => {
  const href = it.a ? `${url}?a=${it.a}` : url;
  const style = i === 0
    ? 'display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;'
    : 'display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border:1px solid #d1d5db;border-radius:8px;color:#111827;text-decoration:none;';
  return `<a href="${esc(href)}" style="${style}">${esc(it.label)}</a>`;
}).join(''));
const buttonLines = (url: string, items: { label: string; a?: CandidateAnswerKey }[]) => items.map((it) => `${it.label}: ${it.a ? `${url}?a=${it.a}` : url}`);
const replyTo = (recruiterName: string | null) => (recruiterName ? `Fragen zum Vertrag? Antworten Sie einfach auf diese Mail, sie geht an ${recruiterName}.` : null);
const STATUS_BUTTONS: { label: string; a: CandidateAnswerKey }[] = [
  { label: 'Ist angekommen', a: 'arrived' }, { label: 'Noch nicht da', a: 'missing' }, { label: 'Schon unterschrieben', a: 'signed' },
];

/** M1: Die Firma meldet „selbst verschickt am …“ (auch erneut nach „Noch nicht da“). */
export function candidateContractUnderway(o: {
  firstName: string; companyName: string; jobTitle: string; sentOn: string; startDate: string | null; salary: number | null; variable: number | null;
  recruiterName: string | null; url: string; again?: boolean;
}): MailContent {
  const heading = `Ihr Arbeitsvertrag mit ${o.companyName} ist ${o.again ? 'erneut ' : ''}unterwegs`;
  const facts = [
    `Stelle: ${o.jobTitle}`,
    o.startDate ? `Beginn: ${dateDe(o.startDate)}` : null,
    o.salary ? `Gehalt: ${euro(o.salary)}${o.variable ? ` + ${euro(o.variable)} variabel` : ''}` : null,
  ].filter(Boolean) as string[];
  const body = [
    hallo(o.firstName),
    p(`${esc(o.companyName)} hat Ihnen den Arbeitsvertrag am ${esc(dateDe(o.sentOn))} ${o.again ? 'erneut ' : ''}geschickt, direkt von der Firma, per Post oder Mail.`),
    p(facts.map(esc).join('<br>')),
    p('Sagen Sie uns kurz Bescheid:'),
    buttons(o.url, STATUS_BUTTONS),
  ].join('');
  const after = replyTo(o.recruiterName);
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, ...facts, ...buttonLines(o.url, STATUS_BUTTONS), after) };
}

/** M2: einmal nach 7 Tagen ohne Unterschrift; hat er „angekommen“ gesagt, nur noch „schon unterschrieben?“. */
export function candidateContractAsk(o: { firstName: string; companyName: string; arrived: boolean; recruiterName: string | null; url: string }): MailContent {
  const heading = o.arrived ? 'Haben Sie Ihren Arbeitsvertrag schon unterschrieben?' : 'Ist Ihr Arbeitsvertrag angekommen?';
  const items = o.arrived ? [{ label: 'Ja, unterschrieben', a: 'signed' as const }] : STATUS_BUTTONS;
  const body = [
    hallo(o.firstName),
    p(`Ihr Vertrag mit ${esc(o.companyName)} ist bei uns noch nicht als unterschrieben gemeldet. Wie ist der Stand bei Ihnen?`),
    buttons(o.url, items),
    o.arrived ? p(muted('Noch nicht unterschrieben? Dann müssen Sie nichts tun.')) : '',
  ].join('');
  const after = replyTo(o.recruiterName);
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, ...buttonLines(o.url, items), after) };
}

/** M3: Die Firma zieht den digitalen Vertrag zurück und schickt selbst; der Kandidat hatte schon einen Link. */
export function candidateLinkVoid(o: { firstName: string; companyName: string; recruiterName: string | null }): MailContent {
  const heading = 'Ihr Unterschrifts-Link gilt nicht mehr';
  const body = [
    hallo(o.firstName),
    p(`${esc(o.companyName)} schickt Ihnen den Arbeitsvertrag jetzt direkt. Den Link aus unserer letzten Mail brauchen Sie nicht mehr. Sobald der Vertrag unterwegs ist, sagen wir Bescheid.`),
  ].join('');
  const after = o.recruiterName ? `Fragen? Antworten Sie einfach auf diese Mail, sie geht an ${o.recruiterName}.` : null;
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, `${o.companyName} schickt Ihnen den Arbeitsvertrag jetzt direkt.`, after) };
}

/**
 * M4: Glückwunsch. Meldet die Firma, fragt die Mail „Stimmt das so?“ (ersetzt die Gegenprobe
 * beim Headhunter); ist die Unterschrift schon von beiden Seiten bestätigt, ohne Frage.
 */
export function candidateContractSigned(o: {
  firstName: string; companyName: string; signedOn: string | null; startDate: string | null; recruiterName: string | null; url: string | null; ask: boolean;
}): MailContent {
  const heading = `Glückwunsch: Ihr Arbeitsvertrag mit ${o.companyName} ist unterschrieben`;
  const since = o.signedOn ? ` seit ${esc(dateDe(o.signedOn))}` : '';
  const start = o.startDate ? ` Ihr erster Arbeitstag: ${esc(dateDe(o.startDate))}.` : '';
  const items = [{ label: 'Stimmt', a: 'ok' as const }, { label: 'Stimmt so nicht', a: 'differs' as const }];
  const body = [
    hallo(o.firstName),
    o.ask && o.url
      ? p(`${esc(o.companyName)} meldet: Ihr Vertrag ist${since} unterschrieben.${start} Stimmt das so?`) + buttons(o.url, items)
      : p(`Ihr Vertrag ist${since} unterschrieben, ${esc(o.companyName)} hat es bestätigt.${start}`),
  ].join('');
  const after = o.recruiterName ? `${o.recruiterName} begleitet Sie bis zum ersten Tag. Fragen? Antworten Sie einfach auf diese Mail.` : null;
  return {
    subject: heading, html: layout({ preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }),
    text: plain(heading, o.signedOn ? `Unterschrieben am: ${dateDe(o.signedOn)}` : null, o.startDate ? `Erster Arbeitstag: ${dateDe(o.startDate)}` : null, ...(o.ask && o.url ? buttonLines(o.url, items) : []), after),
  };
}

/** M5: Die Firma nimmt ihre Meldung „unterschrieben“ innerhalb von 24 Stunden zurück. */
export function candidateReportUndone(o: { firstName: string; companyName: string; recruiterName: string | null; url: string }): MailContent {
  const heading = 'Kurze Korrektur zu Ihrem Arbeitsvertrag';
  const items = [{ label: 'Schon unterschrieben', a: 'signed' as const }, { label: 'Noch nicht' }];
  const body = [
    hallo(o.firstName),
    p(`${esc(o.companyName)} hat die Meldung „unterschrieben“ zurückgenommen. Wie ist der Stand bei Ihnen?`),
    buttons(o.url, items),
  ].join('');
  const after = replyTo(o.recruiterName);
  return { subject: heading, html: layout({ preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, ...buttonLines(o.url, items), after) };
}

/** An den Kunden: Der Kandidat sagt „Noch nicht da“. */
export function clientContractMissing(o: { name: string | null; candidateName: string; sentOn: string | null; profileUrl: string }): MailContent {
  const first = o.candidateName.split(' ')[0];
  const heading = `${o.candidateName} hat den Arbeitsvertrag noch nicht erhalten`;
  const body = [
    hallo(o.name),
    p(`${esc(first)} hat uns gerade gesagt: Der Arbeitsvertrag ist noch nicht angekommen.${o.sentOn ? ` Laut Ihrer Angabe ist er am ${esc(dateDe(o.sentOn))} verschickt.` : ''}`),
    p(muted('Bitte prüfen und erneut schicken, oder digital über Matchunt. Matchunt sagt dem Kandidaten Bescheid, sobald der Vertrag wieder unterwegs ist.')),
  ].join('');
  const url = `${o.profileUrl}?vertrag=verschickt`;
  return { subject: heading, html: layout({ preheader: 'Bitte erneut schicken', heading, body, cta: { label: 'Vertrag erneut schicken', url } }), text: plain(heading, url) };
}

// --- An Matchunt ---------------------------------------------------------------

export function adminCase(o: { candidateName: string; companyName: string; recruiterName: string; reason: string; adminUrl: string }): MailContent {
  const heading = `Unterschrift klären: ${o.candidateName} · ${o.companyName}`;
  const body = [p(`${esc(o.reason)}`), p(muted(`Headhunter: ${esc(o.recruiterName)}`))].join('');
  return { subject: heading, html: layout({ preheader: 'Fall für Matchunt', heading, body, cta: { label: 'Fall öffnen', url: o.adminUrl } }), text: plain(heading, o.reason, o.adminUrl) };
}
