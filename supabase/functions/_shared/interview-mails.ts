// Mailtexte der Interview-Terminierung. Reine Funktionen: liefern Betreff,
// HTML und Text. Alle Zeiten in deutscher Zeit mit Zonen-Hinweis.
import { esc, layout } from './intake-mail.ts';
import { berlinZoneLabel, formatBerlinDateLong, formatBerlinRange, formatBerlinTime } from './interview-time.ts';

export interface MailContent { subject: string; html: string; text: string }

const p = (s: string) => `<p style="margin:0 0 12px 0;">${s}</p>`;
const muted = (s: string) => `<span style="color:#6b7280;">${s}</span>`;
const quote = (s: string) => `<div style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px;color:#374151;">„${esc(s)}“</div>`;
const plain = (...lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join('\n');
const zone = (iso: string) => `deutsche Zeit (${berlinZoneLabel(iso)})`;

export interface PersonRef { name: string; title?: string | null }

function interviewerLine(people: PersonRef[]) {
  if (!people.length) return '';
  return people.map((x) => (x.title ? `${x.name}, ${x.title}` : x.name)).join(' · ');
}

// --- Kandidat ---------------------------------------------------------------

export function candidateInvitation(o: {
  firstName: string | null;
  companyName: string;
  jobTitle: string;
  durationMinutes: number;
  slots: string[];
  link: string;
  message: string | null;
  interviewers: PersonRef[];
  recruiter: { name: string; phone: string | null } | null;
  round: number;
  allowAlternative: boolean;
  consentRequired: boolean;
}): MailContent {
  const roundWord = o.round > 1 ? `zu einem ${o.round}. Gespräch` : '';
  const subject = `Interview-Einladung: ${o.jobTitle} bei ${o.companyName}`;
  const slotRows = o.slots.map((s) =>
    `<tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;">${esc(formatBerlinRange(s, o.durationMinutes))}</td>` +
    `<td style="padding:8px 0;border-top:1px solid #e5e7eb;text-align:right;"><a href="${esc(`${o.link}?slot=${encodeURIComponent(s)}`)}" style="color:#111827;font-weight:600;">wählen</a></td></tr>`).join('');
  const body = [
    p(`Hallo${o.firstName ? ` ${esc(o.firstName)}` : ''},`),
    p(`${esc(o.companyName)} möchte Sie ${roundWord ? `${roundWord} ` : ''}für die Stelle <strong>${esc(o.jobTitle)}</strong> kennenlernen. ${o.durationMinutes} Minuten über Microsoft Teams.`),
    o.interviewers.length ? p(`${muted('Gesprächspartner:')} ${esc(interviewerLine(o.interviewers))}`) : '',
    o.message ? quote(o.message) : '',
    `<div style="font-weight:600;margin:16px 0 4px 0;">Wählen Sie einen Termin</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">${slotRows}</table>`,
    p(muted(`Alle Zeiten in ${zone(o.slots[0] ?? new Date().toISOString())}.`)),
  ].join('');
  const after = [
    o.allowAlternative ? `Keiner passt? Über den Knopf können Sie eine andere Zeit wählen oder das Interview ablehnen.` : 'Über den Knopf können Sie auch absagen.',
    o.recruiter ? `<br><br>Fragen? Ihr Headhunter ${esc(o.recruiter.name)}${o.recruiter.phone ? `, ${esc(o.recruiter.phone)}` : ''}.` : '',
  ].join('');
  const footnote = o.consentRequired
    ? 'Ihr Name, Ihre Kontaktdaten und Ihr Lebenslauf gehen erst an das Unternehmen, wenn Sie das Interview bestätigen.'
    : 'Diese Einladung kommt über Matchunt.';
  return {
    subject,
    html: layout({ preheader: `${o.companyName} möchte Sie kennenlernen`, heading: `${o.companyName} möchte Sie kennenlernen`, body, cta: { label: 'Termin wählen und bestätigen', url: o.link }, after, footnote }),
    text: plain(
      `Hallo${o.firstName ? ` ${o.firstName}` : ''},`, '',
      `${o.companyName} möchte Sie für die Stelle ${o.jobTitle} kennenlernen. ${o.durationMinutes} Minuten über Microsoft Teams.`,
      o.interviewers.length > 0 && `Gesprächspartner: ${interviewerLine(o.interviewers)}`,
      o.message && `Nachricht: „${o.message}“`, '',
      'Terminvorschläge:', ...o.slots.map((s) => `- ${formatBerlinRange(s, o.durationMinutes)}`), '',
      `Termin wählen und bestätigen: ${o.link}`,
      o.recruiter && `Fragen? ${o.recruiter.name}${o.recruiter.phone ? `, ${o.recruiter.phone}` : ''}`,
    ),
  };
}

export function candidateBooked(o: { firstName: string | null; companyName: string; jobTitle: string; startIso: string; durationMinutes: number; joinUrl: string | null; recruiter: { name: string; phone: string | null } | null; link: string }): MailContent {
  const when = `${formatBerlinDateLong(o.startIso)}, ${formatBerlinTime(o.startIso)}–${formatBerlinTime(Date.parse(o.startIso) + o.durationMinutes * 60000)} Uhr`;
  const body = [
    p(`Hallo${o.firstName ? ` ${esc(o.firstName)}` : ''},`),
    p(`Ihr Interview mit ${esc(o.companyName)} für <strong>${esc(o.jobTitle)}</strong> steht:`),
    p(`<strong>${esc(when)}</strong><br>${muted(`Microsoft Teams · ${zone(o.startIso)}`)}`),
    p(o.joinUrl ? 'Die Kalendereinladung mit dem Teams-Link hängt an dieser Mail. Sie können mit der Teams-App oder im Browser teilnehmen, ein Konto brauchen Sie nicht.' : 'Den Teams-Link schicken wir Ihnen rechtzeitig vor dem Termin.'),
  ].join('');
  return {
    subject: `Interview bestätigt: ${o.jobTitle} bei ${o.companyName}`,
    html: layout({ preheader: when, heading: 'Ihr Interview steht', body, cta: o.joinUrl ? { label: 'Teams-Besprechung öffnen', url: o.joinUrl } : undefined, after: o.recruiter ? `Umbuchen oder absagen? Melden Sie sich bei ${esc(o.recruiter.name)}${o.recruiter.phone ? `, ${esc(o.recruiter.phone)}` : ''}.` : undefined, footnote: o.link ? `Ihre Übersicht: <a href="${esc(o.link)}">${esc(o.link)}</a>` : undefined }),
    text: plain(`Ihr Interview mit ${o.companyName} für ${o.jobTitle} steht:`, when, o.joinUrl && `Teams: ${o.joinUrl}`, o.recruiter && `Fragen: ${o.recruiter.name}${o.recruiter.phone ? `, ${o.recruiter.phone}` : ''}`),
  };
}

export function candidateRequestReceived(o: { firstName: string | null; companyName: string; startIso: string; durationMinutes: number; recruiterName: string | null }): MailContent {
  const when = formatBerlinRange(o.startIso, o.durationMinutes);
  const body = [
    p(`Hallo${o.firstName ? ` ${esc(o.firstName)}` : ''},`),
    p(`Ihre Anfrage für <strong>${esc(when)}</strong> ist bei ${esc(o.companyName)}. Sie bekommen eine Mail, sobald das Unternehmen bestätigt, meist innerhalb eines Werktags.`),
    o.recruiterName ? p(`${esc(o.recruiterName)} ist informiert.`) : '',
  ].join('');
  return { subject: `Ihre Terminanfrage bei ${o.companyName}`, html: layout({ preheader: when, heading: 'Ihre Anfrage ist beim Unternehmen', body }), text: plain(`Ihre Anfrage für ${when} ist bei ${o.companyName}.`) };
}

export function candidateWithdrawn(o: { firstName: string | null; companyName: string; jobTitle: string; recruiterName: string | null }): MailContent {
  const body = [
    p(`Hallo${o.firstName ? ` ${esc(o.firstName)}` : ''},`),
    p(`${esc(o.companyName)} hat die Interview-Anfrage für <strong>${esc(o.jobTitle)}</strong> zurückgezogen.`),
    o.recruiterName ? p(`${esc(o.recruiterName)} meldet sich bei Ihnen, falls es neue Informationen gibt.`) : '',
  ].join('');
  return { subject: `Interview-Anfrage zurückgezogen: ${o.jobTitle}`, html: layout({ preheader: 'Anfrage zurückgezogen', heading: 'Anfrage zurückgezogen', body }), text: plain(`${o.companyName} hat die Interview-Anfrage für ${o.jobTitle} zurückgezogen.`) };
}

// --- Headhunter ---------------------------------------------------------------

export function recruiterRequested(o: { recruiterFirstName: string | null; candidateName: string; candidatePhone: string | null; companyName: string; jobTitle: string; slots: string[]; durationMinutes: number; round: number; detailUrl: string }): MailContent {
  const first = o.slots[0];
  const body = [
    p(`Hallo${o.recruiterFirstName ? ` ${esc(o.recruiterFirstName)}` : ''},`),
    p(`${esc(o.companyName)} möchte <strong>${esc(o.candidateName)}</strong> ${o.round > 1 ? `zu einem ${o.round}. Gespräch ` : ''}für <strong>${esc(o.jobTitle)}</strong> sprechen. Die Einladung ist gerade an ${esc(o.candidateName.split(' ')[0])} gegangen.`),
    p(`${muted('Teams · ')}${o.durationMinutes} Min${first ? ` · ${o.slots.length} Vorschläge ab ${esc(formatBerlinRange(first, o.durationMinutes))}` : ''}`),
    p(`Ein kurzer Anruf hilft: ${o.candidatePhone ? `<a href="tel:${esc(o.candidatePhone)}">${esc(o.candidatePhone)}</a>` : 'Telefonnummer steht in der Kandidatenakte'}. Bestätigen kann nur ${esc(o.candidateName.split(' ')[0])} selbst.`),
  ].join('');
  return {
    subject: `${o.companyName} möchte ${o.candidateName} sprechen`,
    html: layout({ preheader: `Interview-Anfrage für ${o.jobTitle}`, heading: `${o.companyName} möchte ${o.candidateName} sprechen`, body, cta: { label: 'Einreichung öffnen', url: o.detailUrl } }),
    text: plain(`${o.companyName} möchte ${o.candidateName} für ${o.jobTitle} sprechen.`, ...o.slots.map((s) => `- ${formatBerlinRange(s, o.durationMinutes)}`), `Einreichung: ${o.detailUrl}`),
  };
}

export function recruiterUpdate(o: { kind: 'booked' | 'alternative' | 'declined'; candidateName: string; companyName: string; jobTitle: string; startIso?: string; durationMinutes?: number; reason?: string | null; detailUrl: string }): MailContent {
  const when = o.startIso ? formatBerlinRange(o.startIso, o.durationMinutes ?? 60) : '';
  const heading = o.kind === 'booked' ? `Interview steht: ${o.candidateName}` : o.kind === 'alternative' ? `${o.candidateName} fragt eine andere Zeit an` : `${o.candidateName} hat das Interview abgelehnt`;
  const line = o.kind === 'booked'
    ? `${esc(o.candidateName)} hat das Interview mit ${esc(o.companyName)} für <strong>${esc(o.jobTitle)}</strong> bestätigt: <strong>${esc(when)}</strong>. Die Kalendereinladung hängt an.`
    : o.kind === 'alternative'
      ? `${esc(o.candidateName)} fragt <strong>${esc(when)}</strong> an. ${esc(o.companyName)} bestätigt.`
      : `${esc(o.candidateName)} hat das Interview mit ${esc(o.companyName)} für <strong>${esc(o.jobTitle)}</strong> abgelehnt.${o.reason ? `<br>${muted('Grund:')} ${esc(o.reason)}` : ''}`;
  return { subject: heading, html: layout({ preheader: o.jobTitle, heading, body: p(line), cta: { label: 'Einreichung öffnen', url: o.detailUrl } }), text: plain(heading, when, o.reason && `Grund: ${o.reason}`, o.detailUrl) };
}

// --- Kunde --------------------------------------------------------------------

export function clientBooked(o: { candidateName: string; jobTitle: string; startIso: string; durationMinutes: number; inOutlook: boolean; profileUrl: string }): MailContent {
  const when = formatBerlinRange(o.startIso, o.durationMinutes);
  const body = [
    p(`<strong>${esc(when)}</strong> · Microsoft Teams ${muted(`· ${zone(o.startIso)}`)}`),
    p(o.inOutlook ? 'Der Termin mit Teams-Link steht in Ihrem Outlook. Ihre Kollegen haben die Einladung von Ihnen bekommen.' : 'Die Kalendereinladung mit Teams-Link hängt an dieser Mail.'),
    p('Name, Kontakt und Lebenslauf sind jetzt in Matchunt freigegeben.'),
  ].join('');
  return { subject: `${o.candidateName} hat das Interview bestätigt`, html: layout({ preheader: when, heading: `${o.candidateName} hat das Interview bestätigt`, body, cta: { label: 'Profil öffnen', url: o.profileUrl } }), text: plain(`${o.candidateName} hat das Interview bestätigt: ${when}.`, o.profileUrl) };
}

export function clientAlternative(o: { candidateLabel: string; jobTitle: string; startIso: string; durationMinutes: number; message: string | null; confirmUrl: string; agendaUrl: string }): MailContent {
  const when = formatBerlinRange(o.startIso, o.durationMinutes);
  const body = [
    p(`${esc(o.candidateLabel)} · ${esc(o.jobTitle)}`),
    p(`<strong>${esc(when)}</strong> ${muted(`· ${zone(o.startIso)} · liegt in Ihren Interview-Zeiten`)}`),
    o.message ? quote(o.message) : '',
  ].join('');
  return {
    subject: `Der Kandidat fragt eine andere Zeit an: ${o.jobTitle}`,
    html: layout({ preheader: when, heading: 'Der Kandidat fragt eine andere Zeit an', body, cta: { label: 'Zeit bestätigen', url: o.confirmUrl }, after: `Passt nicht? <a href="${esc(o.agendaUrl)}">Neue Termine vorschlagen</a>`, footnote: 'Der Bestätigen-Link funktioniert ohne Anmeldung und ist 7 Tage gültig.' }),
    text: plain(`${o.candidateLabel} fragt ${when} an.`, o.message && `„${o.message}“`, `Zeit bestätigen: ${o.confirmUrl}`, `Neue Termine: ${o.agendaUrl}`),
  };
}

export function clientDeclined(o: { candidateLabel: string; jobTitle: string; reason: string | null; recruiterName: string | null; agendaUrl: string }): MailContent {
  const body = [
    p(`${esc(o.candidateLabel)} · ${esc(o.jobTitle)}`),
    o.reason ? quote(o.reason) : '',
    p(`Die Identität bleibt geschützt.${o.recruiterName ? ` ${esc(o.recruiterName)} ist informiert.` : ''}`),
  ].join('');
  return { subject: `${o.candidateLabel} hat das Interview abgelehnt`, html: layout({ preheader: o.jobTitle, heading: `${o.candidateLabel} hat das Interview abgelehnt`, body, cta: { label: 'Zu den Bewerbern', url: o.agendaUrl } }), text: plain(`${o.candidateLabel} hat das Interview abgelehnt.`, o.reason && `Grund: ${o.reason}`) };
}

export function attendeeBooked(o: { name: string; organizerName: string; candidateName: string; jobTitle: string; startIso: string; durationMinutes: number; joinUrl: string | null; agendaUrl: string }): MailContent {
  const when = formatBerlinRange(o.startIso, o.durationMinutes);
  const body = [
    p(`Hallo ${esc(o.name.split(' ')[0])},`),
    p(`${esc(o.organizerName)} hat Sie zum Interview mit <strong>${esc(o.candidateName)}</strong> (${esc(o.jobTitle)}) eingeladen: <strong>${esc(when)}</strong> ${muted(`· ${zone(o.startIso)}`)}.`),
    p('Die Kalendereinladung mit Teams-Link hängt an dieser Mail.'),
  ].join('');
  return { subject: `Interview: ${o.candidateName} · ${o.jobTitle}`, html: layout({ preheader: when, heading: `Interview mit ${o.candidateName}`, body, cta: o.joinUrl ? { label: 'Teams-Besprechung öffnen', url: o.joinUrl } : undefined }), text: plain(`Interview mit ${o.candidateName} (${o.jobTitle}): ${when}`, o.joinUrl && `Teams: ${o.joinUrl}`) };
}

// --- IT des Kunden --------------------------------------------------------------

export function itConsentRequest(o: { requesterName: string; companyName: string | null; consentUrl: string; datasheetUrl: string }): MailContent {
  const body = [
    p(`${esc(o.requesterName)}${o.companyName ? ` (${esc(o.companyName)})` : ''} möchte Interviews über Matchunt planen und bittet Sie, die Matchunt-Kalender-App einmal für Ihre Firma freizugeben.`),
    p(`<strong>Benötigt:</strong> frei/belegt lesen und Interview-Termine eintragen (Microsoft Graph, delegiert: Calendars.ReadWrite, offline_access). Nur für Nutzer, die selbst verbinden. Kein Zugriff auf Mails, Dateien oder Chats.`),
  ].join('');
  return {
    subject: 'Bitte um Freigabe: Matchunt-Kalenderzugriff',
    html: layout({ preheader: 'Einmalige Freigabe für Ihre Firma', heading: 'Bitte um Freigabe: Matchunt-Kalenderzugriff', body, cta: { label: 'In Microsoft freigeben', url: o.consentUrl }, after: `Details für IT und Betriebsrat: <a href="${esc(o.datasheetUrl)}">Datenblatt</a>`, footnote: 'Fragen zur Freigabe: datenschutz@matchunt.ai' }),
    text: plain(`${o.requesterName} bittet um Freigabe der Matchunt-Kalender-App.`, `Freigeben: ${o.consentUrl}`, `Datenblatt: ${o.datasheetUrl}`),
  };
}

export function itApproved(o: { name: string; connectUrl: string }): MailContent {
  const body = p(`Hallo ${esc(o.name.split(' ')[0] || '')}, Ihre IT hat die Matchunt-Kalender-App freigegeben. Sie können Outlook jetzt mit einem Klick verbinden.`);
  return { subject: 'Ihre IT hat zugestimmt', html: layout({ preheader: 'Outlook jetzt verbinden', heading: 'Ihre IT hat zugestimmt', body, cta: { label: 'Jetzt verbinden', url: o.connectUrl } }), text: plain('Ihre IT hat zugestimmt.', o.connectUrl) };
}
