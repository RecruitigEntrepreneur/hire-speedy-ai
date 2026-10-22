// Mailtexte rund um Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026). Reine
// Funktionen: liefern Betreff, HTML und Text. Den digitalen Umschlag schickt
// DocuSign selbst an die Unterzeichner; von Matchunt bekommt der Kandidat nichts.
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

/** Headhunter oder Matchunt meldet: Stimmt das? */
export function clientConfirmRequest(o: { name: string | null; candidateName: string; reporterName: string; facts: ContractFacts; profileUrl: string }): MailContent {
  const heading = `${o.reporterName} meldet: ${o.candidateName} hat unterschrieben`;
  const body = [
    hallo(o.name),
    p(`${esc(o.reporterName)} meldet die Unterschrift des Arbeitsvertrags mit <strong>${esc(o.candidateName)}</strong>. Stimmt das?`),
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

// --- An Matchunt ---------------------------------------------------------------

export function adminCase(o: { candidateName: string; companyName: string; recruiterName: string; reason: string; adminUrl: string }): MailContent {
  const heading = `Unterschrift klären: ${o.candidateName} · ${o.companyName}`;
  const body = [p(`${esc(o.reason)}`), p(muted(`Headhunter: ${esc(o.recruiterName)}`))].join('');
  return { subject: heading, html: layout({ preheader: 'Fall für Matchunt', heading, body, cta: { label: 'Fall öffnen', url: o.adminUrl } }), text: plain(heading, o.reason, o.adminUrl) };
}
