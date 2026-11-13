// Mailtexte der Interview-Terminierung. Reine Funktionen: liefern Betreff,
// HTML und Text. Alle Zeiten in deutscher Zeit mit Zonen-Hinweis.
//
// Mehrsprachig (13.11.2026): jede Funktion nimmt `lang`, die Sprache des
// Empfängers. Ohne Angabe Deutsch, wortgleich wie bisher. Kandidaten werden auf
// Deutsch gesiezt (wie bisher), Kunden gesiezt, Headhunter geduzt; Englisch „you“,
// Schwedisch und Norwegisch „du“. Links auf öffentliche Seiten (Antwortseite des
// Kandidaten, Bestätigen-Link des Kunden) tragen `?lang=`.
import { esc, layout } from './intake-mail.ts';
import { berlinZoneLabel, formatBerlinDateLong, formatBerlinRange, formatBerlinTime } from './interview-time.ts';
import type { Lang } from './i18n.ts';
import { lang as langOf, m, quoteMarks, withLang } from './mail-i18n.ts';

export interface MailContent { subject: string; html: string; text: string }

type Lx = Lang | null | undefined;

const p = (s: string) => `<p style="margin:0 0 12px 0;">${s}</p>`;
const muted = (s: string) => `<span style="color:#6b7280;">${s}</span>`;
/** Zitat mit den Anführungszeichen der Sprache. */
const marks = quoteMarks;
const quoted = (s: string, lang: Lx) => { const [a, b] = marks(lang); return `${a}${s}${b}`; };
const quote = (s: string, lang?: Lx) => `<div style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px;color:#374151;">${quoted(esc(s), lang)}</div>`;
const plain = (...lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join('\n');
const zone = (iso: string, lang?: Lx) => langOf(lang)({
  de: m`deutsche Zeit (${berlinZoneLabel(iso, lang)})`,
  en: m`Central European Time (${berlinZoneLabel(iso, lang)})`,
  sv: m`centraleuropeisk tid (${berlinZoneLabel(iso, lang)})`,
  nb: m`sentraleuropeisk tid (${berlinZoneLabel(iso, lang)})`,
});
/** Anrede: „Hallo Anna,“ bzw. „Hallo,“ ohne Namen. */
const hallo = (n: string | null | undefined, lang: Lx) => {
  const x = n ? ` ${n}` : '';
  return langOf(lang)({ de: m`Hallo${x},`, en: m`Hello${x},`, sv: m`Hej${x},`, nb: m`Hei${x},` });
};
/** „Dienstag, 6. Oktober 2026, 10:00 Uhr“ */
const longAt = (iso: string, lang: Lx) => langOf(lang)({
  de: m`${formatBerlinDateLong(iso, lang)}, ${formatBerlinTime(iso, lang)} Uhr`,
  en: m`${formatBerlinDateLong(iso, lang)}, ${formatBerlinTime(iso, lang)}`,
  sv: m`${formatBerlinDateLong(iso, lang)} kl. ${formatBerlinTime(iso, lang)}`,
  nb: m`${formatBerlinDateLong(iso, lang)} kl. ${formatBerlinTime(iso, lang)}`,
});
/** „10:00–11:00 Uhr“ */
const clockSpan = (iso: string, minutes: number, lang: Lx) => {
  const a = formatBerlinTime(iso, lang);
  const b = formatBerlinTime(Date.parse(iso) + minutes * 60000, lang);
  return langOf(lang)({ de: m`${a}–${b} Uhr`, en: m`${a}–${b}`, sv: m`kl. ${a}–${b}`, nb: m`kl. ${a}–${b}` });
};
const L_QUESTIONS = { de: 'Fragen', en: 'Questions', sv: 'Frågor', nb: 'Spørsmål' };
const L_CONTACT_ONSITE = { de: 'Ansprechpartner vor Ort', en: 'Contact on site', sv: 'Kontaktperson på plats', nb: 'Kontaktperson på stedet' };
const L_INTERVIEWERS = { de: 'Gesprächspartner', en: 'Interviewers', sv: 'Du träffar', nb: 'Du møter' };
const L_REASON = { de: 'Grund', en: 'Reason', sv: 'Anledning', nb: 'Grunn' };
const L_MESSAGE = { de: 'Nachricht', en: 'Message', sv: 'Meddelande', nb: 'Melding' };
const L_ADDRESS = { de: 'Adresse', en: 'Address', sv: 'Adress', nb: 'Adresse' };
const L_PLACE = { de: 'Ort', en: 'Location', sv: 'Plats', nb: 'Sted' };
const L_INVITE_ATTACHED = { de: 'Die Kalendereinladung hängt an dieser Mail.', en: 'The calendar invitation is attached to this email.', sv: 'Kalenderinbjudan finns bifogad i det här mejlet.', nb: 'Kalenderinvitasjonen ligger vedlagt denne e-posten.' };
const L_TEAMS_OPEN = { de: 'Teams-Besprechung öffnen', en: 'Open Teams meeting', sv: 'Öppna Teams-mötet', nb: 'Åpne Teams-møtet' };
const L_OPEN_SUBMISSION = { de: 'Einreichung öffnen', en: 'Open submission', sv: 'Öppna kandidatförslaget', nb: 'Åpne kandidatforslaget' };

export interface PersonRef { name: string; title?: string | null }

/** Wie das Gespräch stattfindet. */
export interface MeetingInfo {
  format: 'teams' | 'phone' | 'onsite';
  companyName: string;
  joinUrl?: string | null;
  address?: string | null;
  note?: string | null;
  callPhone?: string | null;
  /** Vor Ort: Ansprechpartner am Empfang */
  contactName?: string | null;
  contactPhone?: string | null;
}

/** „Sandra Weiß, 089 …“ – leer, wenn nichts angegeben ist. */
export function contactLine(m: MeetingInfo): string {
  return [m.contactName?.trim(), m.contactPhone?.trim()].filter(Boolean).join(', ');
}

export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\s*\n\s*/g, ', '))}`;

/** Ein Satz für die Einladung: „60 Minuten über Microsoft Teams.“ usw. */
/** „60 Minuten“, ab 2 Stunden „3 Stunden“. */
export const durationWords = (minutes: number, lang?: Lx) => {
  const hours = minutes >= 120 && minutes % 60 === 0;
  const n = hours ? minutes / 60 : minutes;
  return hours
    ? langOf(lang)({ de: m`${n} Stunden`, en: m`${n} hours`, sv: m`${n} timmar`, nb: m`${n} timer` })
    : langOf(lang)({ de: m`${n} Minuten`, en: m`${n} minutes`, sv: m`${n} minuter`, nb: m`${n} minutter` });
};

export function formatSentence(mt: MeetingInfo, minutes: number, withAddress = true, lang?: Lx): string {
  const L = langOf(lang);
  const d = durationWords(minutes, lang);
  if (mt.format === 'phone') return L({ de: m`${d} am Telefon, ${mt.companyName} ruft Sie an.`, en: m`${d} by phone, ${mt.companyName} will call you.`, sv: m`${d} per telefon, ${mt.companyName} ringer dig.`, nb: m`${d} på telefon, ${mt.companyName} ringer deg.` });
  if (mt.format === 'onsite') {
    const a = withAddress && mt.address ? `: ${mt.address.replace(/\s*\n\s*/g, ', ')}` : '';
    return L({ de: m`${d} vor Ort${a}.`, en: m`${d} in person${a}.`, sv: m`${d} på plats${a}.`, nb: m`${d} på stedet${a}.` });
  }
  return L({ de: m`${d} über Microsoft Teams.`, en: m`${d} on Microsoft Teams.`, sv: m`${d} via Microsoft Teams.`, nb: m`${d} via Microsoft Teams.` });
}

/** Kurzes Etikett: „Microsoft Teams“, „Telefon“, „Vor Ort“. */
export const formatLabel = (f: MeetingInfo['format'], lang?: Lx) => (f === 'phone'
  ? langOf(lang)({ de: 'Telefon', en: 'Phone', sv: 'Telefon', nb: 'Telefon' })
  : f === 'onsite' ? langOf(lang)({ de: 'Vor Ort', en: 'In person', sv: 'På plats', nb: 'På stedet' }) : 'Microsoft Teams');

function locationHtml(mt: MeetingInfo, lang?: Lx) {
  const L = langOf(lang);
  if (mt.format === 'onsite' && mt.address) {
    const contact = contactLine(mt);
    return p(`<strong>${L(L_ADDRESS)}:</strong> ${esc(mt.address).replace(/\n/g, '<br>')} · <a href="${esc(mapsUrl(mt.address))}">${L({ de: 'Karte öffnen', en: 'Open map', sv: 'Öppna karta', nb: 'Åpne kart' })}</a>${mt.note ? `<br>${muted(esc(mt.note))}` : ''}${contact ? `<br>${muted(`${L(L_CONTACT_ONSITE)}:`)} ${esc(contact)}` : ''}`);
  }
  return '';
}

/** Überschrift je Runde: Runde 1 ist ein Kennenlernen, ab Runde 2 ein weiteres Gespräch. */
const roundTitle = (round: number, lang?: Lx) => (round > 1
  ? langOf(lang)({ de: m`${round}. Gespräch`, en: m`Round ${round} interview`, sv: m`Intervju omgång ${round}`, nb: m`Intervju runde ${round}` })
  : langOf(lang)({ de: 'Interview', en: 'Interview', sv: 'Intervju', nb: 'Intervju' }));
/** Zusatz hinter „interview / intervju“ ab Runde 2. */
const roundSuffix = (round: number, lang: Lx) => (round > 1
  ? langOf(lang)({ de: m` (${round}. Gespräch)`, en: m` (round ${round})`, sv: m` (omgång ${round})`, nb: m` (runde ${round})` }) : '');

function interviewerLine(people: PersonRef[]) {
  if (!people.length) return '';
  return people.map((x) => [x.name?.trim(), x.title?.trim()].filter(Boolean).join(', ')).filter(Boolean).join(' · ');
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
  meeting?: MeetingInfo;
  /** Verschieben: der gebuchte Termin, der bis zur neuen Wahl bestehen bleibt */
  reschedule?: { previousStart: string } | null;
  lang?: Lx;
}): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const link = withLang(o.link, lang);
  const meeting: MeetingInfo = o.meeting ?? { format: 'teams', companyName: o.companyName };
  const r = o.round;
  const moved = o.reschedule ? longAt(o.reschedule.previousStart, lang) : null;
  const co = o.companyName;
  const job = o.jobTitle;
  const subject = moved
    ? L({ de: m`Neuer Terminvorschlag: ${job} bei ${co}`, en: m`New time proposed: ${job} at ${co}`, sv: m`Nytt tidsförslag: ${job} hos ${co}`, nb: m`Nytt tidsforslag: ${job} hos ${co}` })
    : r > 1
      ? L({ de: m`Einladung zum ${r}. Gespräch: ${job} bei ${co}`, en: m`Invitation to a round ${r} interview: ${job} at ${co}`, sv: m`Inbjudan till intervju omgång ${r}: ${job} hos ${co}`, nb: m`Invitasjon til intervju runde ${r}: ${job} hos ${co}` })
      : L({ de: m`Interview-Einladung: ${job} bei ${co}`, en: m`Interview invitation: ${job} at ${co}`, sv: m`Inbjudan till intervju: ${job} hos ${co}`, nb: m`Invitasjon til intervju: ${job} hos ${co}` });
  const heading = moved
    ? L({ de: m`${co} möchte Ihren Termin verschieben`, en: m`${co} would like to reschedule your interview`, sv: m`${co} vill flytta din intervju`, nb: m`${co} ønsker å flytte intervjuet ditt` })
    : r > 1
      ? L({ de: m`${co} lädt Sie zum ${r}. Gespräch ein`, en: m`${co} invites you to a round ${r} interview`, sv: m`${co} bjuder in dig till intervju omgång ${r}`, nb: m`${co} inviterer deg til intervju runde ${r}` })
      : L({ de: m`${co} möchte Sie kennenlernen`, en: m`${co} would like to meet you`, sv: m`${co} vill träffa dig`, nb: m`${co} vil gjerne møte deg` });
  // Verschiebung mit genau einer neuen Zeit: bestätigen statt wählen (Live-Test 23.10.2026)
  const single = !!moved && o.slots.length === 1;
  const choose = L({ de: 'wählen', en: 'choose', sv: 'välj', nb: 'velg' });
  const slotRows = o.slots.map((s) =>
    `<tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;">${esc(formatBerlinRange(s, o.durationMinutes, lang))}</td>` +
    `<td style="padding:8px 0;border-top:1px solid #e5e7eb;text-align:right;"><a href="${esc(withLang(`${o.link}?slot=${encodeURIComponent(s)}`, lang))}" style="color:#111827;font-weight:600;">${choose}</a></td></tr>`).join('');
  const fsShort = esc(formatSentence(meeting, o.durationMinutes, false, lang));
  const fsLong = formatSentence(meeting, o.durationMinutes, true, lang);
  const eCo = esc(co);
  const eJob = esc(job);
  const intro = (c: string, j: string, mv: string, fs: string, html: boolean) => {
    if (moved && html) {
      return L({
        de: m`${c} muss Ihren Termin für die Stelle ${j} am ${mv} leider verschieben. Bitte ${single ? 'bestätigen Sie die neue Zeit' : 'wählen Sie eine neue Zeit'} – bis dahin bleibt der bisherige Termin bestehen. ${fs}`,
        en: m`Unfortunately ${c} needs to reschedule your interview for the ${j} role on ${mv}. Please ${single ? 'confirm the new time' : 'choose a new time'} – until then your current appointment stays in place. ${fs}`,
        sv: m`${c} behöver tyvärr flytta din intervju (${mv}) för tjänsten ${j}. ${single ? 'Bekräfta den nya tiden' : 'Välj en ny tid'} – fram till dess gäller den nuvarande tiden. ${fs}`,
        nb: m`${c} må dessverre flytte intervjuet ditt (${mv}) for stillingen ${j}. ${single ? 'Bekreft det nye tidspunktet' : 'Velg et nytt tidspunkt'} – frem til da gjelder det nåværende tidspunktet. ${fs}`,
      });
    }
    if (moved) {
      return L({
        de: m`${c} muss Ihren Termin am ${mv} verschieben. Bis Sie ${single ? 'die neue Zeit bestätigen' : 'eine neue Zeit wählen'}, bleibt er bestehen. ${fs}`,
        en: m`${c} needs to reschedule your interview on ${mv}. It stays in place until you ${single ? 'confirm the new time' : 'choose a new time'}. ${fs}`,
        sv: m`${c} behöver flytta din intervju (${mv}). Den gäller tills du ${single ? 'bekräftar den nya tiden' : 'väljer en ny tid'}. ${fs}`,
        nb: m`${c} må flytte intervjuet ditt (${mv}). Det gjelder til du ${single ? 'bekrefter det nye tidspunktet' : 'velger et nytt tidspunkt'}. ${fs}`,
      });
    }
    return r > 1
      ? L({
        de: m`${c} möchte Sie zu einem ${r}. Gespräch für die Stelle ${j} einladen. ${fs}`,
        en: m`${c} would like to invite you to a round ${r} interview for the ${j} role. ${fs}`,
        sv: m`${c} vill bjuda in dig till intervju omgång ${r} för tjänsten ${j}. ${fs}`,
        nb: m`${c} vil invitere deg til intervju runde ${r} for stillingen ${j}. ${fs}`,
      })
      : L({
        de: m`${c} möchte Sie für die Stelle ${j} kennenlernen. ${fs}`,
        en: m`${c} would like to meet you about the ${j} role. ${fs}`,
        sv: m`${c} vill träffa dig om tjänsten ${j}. ${fs}`,
        nb: m`${c} vil gjerne møte deg om stillingen ${j}. ${fs}`,
      });
  };
  const body = [
    p(hallo(o.firstName ? esc(o.firstName) : null, lang)),
    p(intro(eCo, `<strong>${eJob}</strong>`, moved ? `<strong>${esc(moved)}</strong>` : '', fsShort, true)),
    locationHtml(meeting, lang),
    o.interviewers.length ? p(`${muted(`${L(L_INTERVIEWERS)}:`)} ${esc(interviewerLine(o.interviewers))}`) : '',
    o.message ? quote(o.message, lang) : '',
    `<div style="font-weight:600;margin:16px 0 4px 0;">${single
      ? L({ de: 'Bestätigen Sie die neue Zeit', en: 'Confirm the new time', sv: 'Bekräfta den nya tiden', nb: 'Bekreft det nye tidspunktet' })
      : moved ? L({ de: 'Wählen Sie eine neue Zeit', en: 'Choose a new time', sv: 'Välj en ny tid', nb: 'Velg et nytt tidspunkt' })
        : L({ de: 'Wählen Sie einen Termin', en: 'Choose a time', sv: 'Välj en tid', nb: 'Velg et tidspunkt' })}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">${slotRows}</table>`,
    p(muted(L({ de: m`Alle Zeiten in ${zone(o.slots[0] ?? new Date().toISOString(), lang)}.`, en: m`All times in ${zone(o.slots[0] ?? new Date().toISOString(), lang)}.`, sv: m`Alla tider i ${zone(o.slots[0] ?? new Date().toISOString(), lang)}.`, nb: m`Alle tider i ${zone(o.slots[0] ?? new Date().toISOString(), lang)}.` }))),
  ].join('');
  const recruiterTail = o.recruiter ? `${esc(o.recruiter.name)}${o.recruiter.phone ? `, ${esc(o.recruiter.phone)}` : ''}` : '';
  const after = [
    moved
      ? (o.allowAlternative
        ? L({ de: 'Keine passt? Über den Knopf können Sie eine andere Zeit wählen oder beim bisherigen Termin bleiben.', en: 'None of them work? Use the button to pick another time or keep your current appointment.', sv: 'Passar ingen? Via knappen kan du välja en annan tid eller behålla den nuvarande.', nb: 'Passer ingen? Via knappen kan du velge et annet tidspunkt eller beholde det nåværende.' })
        : L({ de: 'Passt keine? Über den Knopf können Sie beim bisherigen Termin bleiben.', en: 'None of them work? Use the button to keep your current appointment.', sv: 'Passar ingen? Via knappen kan du behålla den nuvarande tiden.', nb: 'Passer ingen? Via knappen kan du beholde det nåværende tidspunktet.' }))
      : o.allowAlternative
        ? L({ de: 'Keiner passt? Über den Knopf können Sie eine andere Zeit wählen oder das Interview ablehnen.', en: 'None of them work? Use the button to suggest another time or decline the interview.', sv: 'Passar ingen? Via knappen kan du föreslå en annan tid eller tacka nej till intervjun.', nb: 'Passer ingen? Via knappen kan du foreslå et annet tidspunkt eller takke nei til intervjuet.' })
        : L({ de: 'Über den Knopf können Sie auch absagen.', en: 'You can also decline using the button.', sv: 'Via knappen kan du också tacka nej.', nb: 'Via knappen kan du også takke nei.' }),
    o.recruiter ? L({ de: m`<br><br>Fragen? Ihr Headhunter ${recruiterTail}.`, en: m`<br><br>Questions? Your headhunter ${recruiterTail}.`, sv: m`<br><br>Frågor? Din headhunter ${recruiterTail}.`, nb: m`<br><br>Spørsmål? Headhunteren din ${recruiterTail}.` }) : '',
  ].join('');
  const footnote = o.consentRequired
    ? L({ de: 'Ihr Name, Ihre Kontaktdaten und Ihr Lebenslauf gehen erst an das Unternehmen, wenn Sie das Interview bestätigen.', en: 'Your name, contact details and CV are only shared with the company once you confirm the interview.', sv: 'Ditt namn, dina kontaktuppgifter och ditt CV delas med företaget först när du bekräftar intervjun.', nb: 'Navnet ditt, kontaktopplysningene og CV-en deles med selskapet først når du bekrefter intervjuet.' })
    : L({ de: 'Diese Einladung kommt über Matchunt.', en: 'This invitation was sent via Matchunt.', sv: 'Den här inbjudan skickas via Matchunt.', nb: 'Denne invitasjonen sendes via Matchunt.' });
  const ctaLabel = single
    ? L({ de: 'Neue Zeit bestätigen', en: 'Confirm new time', sv: 'Bekräfta ny tid', nb: 'Bekreft nytt tidspunkt' })
    : moved ? L({ de: 'Neue Zeit wählen', en: 'Choose new time', sv: 'Välj ny tid', nb: 'Velg nytt tidspunkt' })
      : L({ de: 'Termin wählen und bestätigen', en: 'Choose and confirm a time', sv: 'Välj och bekräfta en tid', nb: 'Velg og bekreft et tidspunkt' });
  const [qa, qb] = marks(lang);
  return {
    subject,
    html: layout({ lang, preheader: heading, heading, body, cta: { label: ctaLabel, url: link }, after, footnote }),
    text: plain(
      hallo(o.firstName, lang), '',
      intro(co, job, moved ?? '', fsLong, false),
      meeting.format === 'onsite' && meeting.note && `${L({ de: 'Hinweis', en: 'Note', sv: 'Obs', nb: 'Merk' })}: ${meeting.note}`,
      meeting.format === 'onsite' && contactLine(meeting) && `${L(L_CONTACT_ONSITE)}: ${contactLine(meeting)}`,
      o.interviewers.length > 0 && `${L(L_INTERVIEWERS)}: ${interviewerLine(o.interviewers)}`,
      o.message && `${L(L_MESSAGE)}: ${qa}${o.message}${qb}`, '',
      `${L({ de: 'Terminvorschläge', en: 'Proposed times', sv: 'Föreslagna tider', nb: 'Foreslåtte tidspunkter' })}:`, ...o.slots.map((s) => `- ${formatBerlinRange(s, o.durationMinutes, lang)}`), '',
      `${L({ de: 'Termin wählen und bestätigen', en: 'Choose and confirm a time', sv: 'Välj och bekräfta en tid', nb: 'Velg og bekreft et tidspunkt' })}: ${link}`,
      o.recruiter && `${L(L_QUESTIONS)}? ${o.recruiter.name}${o.recruiter.phone ? `, ${o.recruiter.phone}` : ''}`,
    ),
  };
}

export function candidateBooked(o: { firstName: string | null; companyName: string; jobTitle: string; startIso: string; durationMinutes: number; joinUrl: string | null; recruiter: { name: string; phone: string | null } | null; link: string; meeting?: MeetingInfo; round?: number; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const link = withLang(o.link, lang);
  const round = o.round ?? 1;
  const meeting: MeetingInfo = o.meeting ?? { format: 'teams', companyName: o.companyName, joinUrl: o.joinUrl };
  const when = `${formatBerlinDateLong(o.startIso, lang)}, ${clockSpan(o.startIso, o.durationMinutes, lang)}`;
  const eCo = esc(o.companyName);
  const ph = meeting.callPhone ? esc(meeting.callPhone) : '';
  const how = meeting.format === 'phone'
    ? L({
      de: m`${eCo} ruft Sie zum Termin an${ph ? ` unter ${ph}` : ''}. Die Kalendereinladung hängt an dieser Mail.`,
      en: m`${eCo} will call you at the scheduled time${ph ? ` on ${ph}` : ''}. The calendar invitation is attached to this email.`,
      sv: m`${eCo} ringer dig vid den bokade tiden${ph ? ` på ${ph}` : ''}. Kalenderinbjudan finns bifogad i det här mejlet.`,
      nb: m`${eCo} ringer deg til avtalt tid${ph ? ` på ${ph}` : ''}. Kalenderinvitasjonen ligger vedlagt denne e-posten.`,
    })
    : meeting.format === 'onsite'
      ? L({ de: 'Die Kalendereinladung mit der Adresse hängt an dieser Mail.', en: 'The calendar invitation with the address is attached to this email.', sv: 'Kalenderinbjudan med adressen finns bifogad i det här mejlet.', nb: 'Kalenderinvitasjonen med adressen ligger vedlagt denne e-posten.' })
      : o.joinUrl
        ? L({ de: 'Die Kalendereinladung mit dem Teams-Link hängt an dieser Mail. Sie können mit der Teams-App oder im Browser teilnehmen, ein Konto brauchen Sie nicht.', en: 'The calendar invitation with the Teams link is attached to this email. You can join with the Teams app or in your browser; no account needed.', sv: 'Kalenderinbjudan med Teams-länken finns bifogad i det här mejlet. Du kan delta via Teams-appen eller i webbläsaren, inget konto behövs.', nb: 'Kalenderinvitasjonen med Teams-lenken ligger vedlagt denne e-posten. Du kan delta med Teams-appen eller i nettleseren, du trenger ingen konto.' })
        : L({ de: 'Den Link zum Gespräch bekommen Sie per Mail, sobald er feststeht. Die Kalendereinladung hängt schon an.', en: 'You will receive the link to the interview by email as soon as it is available. The calendar invitation is already attached.', sv: 'Länken till intervjun får du via mejl så snart den är klar. Kalenderinbjudan finns redan bifogad.', nb: 'Lenken til intervjuet får du på e-post så snart den er klar. Kalenderinvitasjonen ligger allerede ved.' });
  const eJob = `<strong>${esc(o.jobTitle)}</strong>`;
  const rs = roundSuffix(round, lang);
  const body = [
    p(hallo(o.firstName ? esc(o.firstName) : null, lang)),
    p(L({
      de: m`Ihr ${round > 1 ? `${round}. Gespräch` : 'Interview'} mit ${eCo} für ${eJob} steht:`,
      en: m`Your ${round > 1 ? `round ${round} ` : ''}interview with ${eCo} for ${eJob} is confirmed:`,
      sv: m`Din intervju${rs} med ${eCo} för ${eJob} är bokad:`,
      nb: m`Intervjuet ditt${rs} med ${eCo} for ${eJob} er avtalt:`,
    })),
    p(`<strong>${esc(when)}</strong><br>${muted(`${formatLabel(meeting.format, lang)} · ${zone(o.startIso, lang)}`)}`),
    locationHtml(meeting, lang),
    p(how),
  ].join('');
  const cta = meeting.format === 'teams' && o.joinUrl ? { label: L(L_TEAMS_OPEN), url: o.joinUrl }
    : meeting.format === 'onsite' && meeting.address ? { label: L({ de: 'Anfahrt in Karte öffnen', en: 'Open directions in map', sv: 'Visa vägbeskrivning på kartan', nb: 'Vis veibeskrivelse i kart' }), url: mapsUrl(meeting.address) } : undefined;
  const rt = roundTitle(round, lang);
  const rec = o.recruiter ? `${esc(o.recruiter.name)}${o.recruiter.phone ? `, ${esc(o.recruiter.phone)}` : ''}` : '';
  return {
    subject: L({ de: m`${rt} bestätigt: ${o.jobTitle} bei ${o.companyName}`, en: m`${rt} confirmed: ${o.jobTitle} at ${o.companyName}`, sv: m`${rt} bekräftad: ${o.jobTitle} hos ${o.companyName}`, nb: m`${rt} bekreftet: ${o.jobTitle} hos ${o.companyName}` }),
    html: layout({
      lang,
      preheader: when,
      heading: L({ de: m`${round > 1 ? `Ihr ${round}. Gespräch steht` : 'Ihr Interview steht'}`, en: m`Your ${round > 1 ? `round ${round} ` : ''}interview is confirmed`, sv: m`Din intervju${rs} är bokad`, nb: m`Intervjuet ditt${rs} er avtalt` }),
      body, cta,
      after: o.recruiter ? L({ de: m`Umbuchen oder absagen? Melden Sie sich bei ${rec}.`, en: m`Need to reschedule or cancel? Contact ${rec}.`, sv: m`Behöver du boka om eller avboka? Kontakta ${rec}.`, nb: m`Må du flytte eller avlyse? Kontakt ${rec}.` }) : undefined,
      footnote: link ? `${L({ de: 'Ihre Übersicht', en: 'Your overview', sv: 'Din översikt', nb: 'Din oversikt' })}: <a href="${esc(link)}">${esc(link)}</a>` : undefined,
    }),
    text: plain(
      L({ de: m`Ihr Interview mit ${o.companyName} für ${o.jobTitle} steht:`, en: m`Your interview with ${o.companyName} for ${o.jobTitle} is confirmed:`, sv: m`Din intervju med ${o.companyName} för ${o.jobTitle} är bokad:`, nb: m`Intervjuet ditt med ${o.companyName} for ${o.jobTitle} er avtalt:` }),
      when, formatLabel(meeting.format, lang),
      meeting.format === 'teams' && o.joinUrl && `Teams: ${o.joinUrl}`,
      meeting.format === 'onsite' && meeting.address && `${L(L_ADDRESS)}: ${meeting.address}`,
      meeting.format === 'onsite' && contactLine(meeting) && `${L(L_CONTACT_ONSITE)}: ${contactLine(meeting)}`,
      o.recruiter && `${L(L_QUESTIONS)}: ${o.recruiter.name}${o.recruiter.phone ? `, ${o.recruiter.phone}` : ''}`,
    ),
  };
}

export function candidateRequestReceived(o: { firstName: string | null; companyName: string; startIso: string; durationMinutes: number; recruiterName: string | null; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const when = formatBerlinRange(o.startIso, o.durationMinutes, lang);
  const line = (w: string, c: string) => L({
    de: m`Ihre Anfrage für ${w} ist bei ${c}.`,
    en: m`Your request for ${w} has been sent to ${c}.`,
    sv: m`Din förfrågan om ${w} har skickats till ${c}.`,
    nb: m`Forespørselen din om ${w} er sendt til ${c}.`,
  });
  const body = [
    p(hallo(o.firstName ? esc(o.firstName) : null, lang)),
    p(`${line(`<strong>${esc(when)}</strong>`, esc(o.companyName))} ${L({ de: 'Sie bekommen eine Mail, sobald das Unternehmen bestätigt, meist innerhalb eines Werktags.', en: 'You will get an email as soon as the company confirms, usually within one working day.', sv: 'Du får ett mejl så snart företaget bekräftar, oftast inom en arbetsdag.', nb: 'Du får en e-post så snart selskapet bekrefter, som regel innen én arbeidsdag.' })}`),
    o.recruiterName ? p(L({ de: m`${esc(o.recruiterName)} ist informiert.`, en: m`${esc(o.recruiterName)} has been informed.`, sv: m`${esc(o.recruiterName)} har fått besked.`, nb: m`${esc(o.recruiterName)} har fått beskjed.` })) : '',
  ].join('');
  return {
    subject: L({ de: m`Ihre Terminanfrage bei ${o.companyName}`, en: m`Your interview request to ${o.companyName}`, sv: m`Din tidsförfrågan till ${o.companyName}`, nb: m`Din tidsforespørsel til ${o.companyName}` }),
    html: layout({ lang, preheader: when, heading: L({ de: 'Ihre Anfrage ist beim Unternehmen', en: 'Your request is with the company', sv: 'Din förfrågan ligger hos företaget', nb: 'Forespørselen din ligger hos selskapet' }), body }),
    text: plain(line(when, o.companyName)),
  };
}

export function candidateWithdrawn(o: { firstName: string | null; companyName: string; jobTitle: string; recruiterName: string | null; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const line = (c: string, j: string) => L({
    de: m`${c} hat die Interview-Anfrage für ${j} zurückgezogen.`,
    en: m`${c} has withdrawn the interview request for ${j}.`,
    sv: m`${c} har dragit tillbaka intervjuförfrågan för ${j}.`,
    nb: m`${c} har trukket tilbake intervjuforespørselen for ${j}.`,
  });
  const body = [
    p(hallo(o.firstName ? esc(o.firstName) : null, lang)),
    p(line(esc(o.companyName), `<strong>${esc(o.jobTitle)}</strong>`)),
    o.recruiterName ? p(L({ de: m`${esc(o.recruiterName)} meldet sich bei Ihnen, falls es neue Informationen gibt.`, en: m`${esc(o.recruiterName)} will get in touch if there is any news.`, sv: m`${esc(o.recruiterName)} hör av sig om det finns något nytt.`, nb: m`${esc(o.recruiterName)} tar kontakt hvis det er noe nytt.` })) : '',
  ].join('');
  const head = L({ de: 'Anfrage zurückgezogen', en: 'Request withdrawn', sv: 'Förfrågan återkallad', nb: 'Forespørsel trukket tilbake' });
  return {
    subject: L({ de: m`Interview-Anfrage zurückgezogen: ${o.jobTitle}`, en: m`Interview request withdrawn: ${o.jobTitle}`, sv: m`Intervjuförfrågan återkallad: ${o.jobTitle}`, nb: m`Intervjuforespørsel trukket tilbake: ${o.jobTitle}` }),
    html: layout({ lang, preheader: head, heading: head, body }),
    text: plain(line(o.companyName, o.jobTitle)),
  };
}

// --- Headhunter ---------------------------------------------------------------

export function recruiterRequested(o: { recruiterFirstName: string | null; candidateName: string; candidatePhone: string | null; companyName: string; jobTitle: string; slots: string[]; durationMinutes: number; round: number; detailUrl: string; format?: MeetingInfo['format']; previousStart?: string | null; meeting?: MeetingInfo | null; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const first = o.slots[0];
  const moved = o.previousStart ? longAt(o.previousStart, lang) : null;
  const co = o.companyName;
  const cand = o.candidateName;
  const heading = moved
    ? L({ de: m`${co} möchte den Termin mit ${cand} verschieben`, en: m`${co} wants to reschedule the interview with ${cand}`, sv: m`${co} vill flytta intervjun med ${cand}`, nb: m`${co} vil flytte intervjuet med ${cand}` })
    : L({ de: m`${co} möchte ${cand} sprechen`, en: m`${co} wants to talk to ${cand}`, sv: m`${co} vill prata med ${cand}`, nb: m`${co} vil snakke med ${cand}` });
  const eCo = esc(co);
  const eCand = `<strong>${esc(cand)}</strong>`;
  const eJob = `<strong>${esc(o.jobTitle)}</strong>`;
  const eFirst = esc(cand.split(' ')[0]);
  const r = o.round;
  const count = o.slots.length;
  const range = first ? esc(formatBerlinRange(first, o.durationMinutes, lang)) : '';
  const phoneHtml = o.candidatePhone ? `<a href="tel:${esc(o.candidatePhone)}">${esc(o.candidatePhone)}</a>` : '';
  const body = [
    p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)),
    moved
      ? p(L({
        de: m`${eCo} möchte den Termin mit ${eCand} für ${eJob} am <strong>${esc(moved)}</strong> verschieben. Neue Vorschläge sind an ${eFirst} gegangen; der bisherige Termin bleibt bis zur Wahl bestehen.`,
        en: m`${eCo} wants to reschedule the interview with ${eCand} for ${eJob} on <strong>${esc(moved)}</strong>. New proposals have gone to ${eFirst}; the current appointment stays until a new time is chosen.`,
        sv: m`${eCo} vill flytta intervjun med ${eCand} för ${eJob} (<strong>${esc(moved)}</strong>). Nya förslag har gått till ${eFirst}; den nuvarande tiden gäller tills en ny har valts.`,
        nb: m`${eCo} vil flytte intervjuet med ${eCand} for ${eJob} (<strong>${esc(moved)}</strong>). Nye forslag er sendt til ${eFirst}; det nåværende tidspunktet gjelder til et nytt er valgt.`,
      }))
      : p(L({
        de: m`${eCo} möchte ${eCand} ${r > 1 ? `zu einem ${r}. Gespräch ` : ''}für ${eJob} sprechen. Die Einladung ist gerade an ${eFirst} gegangen.`,
        en: m`${eCo} wants to talk to ${eCand} ${r > 1 ? `in a round ${r} interview ` : ''}about ${eJob}. The invitation has just gone to ${eFirst}.`,
        sv: m`${eCo} vill prata med ${eCand} ${r > 1 ? `i intervju omgång ${r} ` : ''}om ${eJob}. Inbjudan har just skickats till ${eFirst}.`,
        nb: m`${eCo} vil snakke med ${eCand} ${r > 1 ? `i intervju runde ${r} ` : ''}om ${eJob}. Invitasjonen er nettopp sendt til ${eFirst}.`,
      })),
    p(`${muted(`${formatLabel(o.format ?? 'teams', lang)} · `)}${o.durationMinutes} Min${first ? L({ de: m` · ${count} Vorschläge ab ${range}`, en: m` · ${count} proposals from ${range}`, sv: m` · ${count} förslag från ${range}`, nb: m` · ${count} forslag fra ${range}` }) : ''}`),
    o.meeting ? locationHtml(o.meeting, lang) : '',
    p(L({
      de: m`Ein kurzer Anruf hilft: ${phoneHtml || 'Telefonnummer steht in der Kandidatenakte'}. Bestätigen kann nur ${eFirst} selbst.`,
      en: m`A quick call helps: ${phoneHtml || 'the phone number is in the candidate file'}. Only ${eFirst} can confirm.`,
      sv: m`Ett kort samtal hjälper: ${phoneHtml || 'telefonnumret finns i kandidatakten'}. Bara ${eFirst} själv kan bekräfta.`,
      nb: m`En kort telefon hjelper: ${phoneHtml || 'telefonnummeret står i kandidatmappen'}. Bare ${eFirst} selv kan bekrefte.`,
    })),
  ].join('');
  return {
    subject: heading,
    html: layout({
      lang,
      preheader: moved
        ? L({ de: m`Verschiebung für ${o.jobTitle}`, en: m`Rescheduling for ${o.jobTitle}`, sv: m`Ny tid för ${o.jobTitle}`, nb: m`Nytt tidspunkt for ${o.jobTitle}` })
        : L({ de: m`Interview-Anfrage für ${o.jobTitle}`, en: m`Interview request for ${o.jobTitle}`, sv: m`Intervjuförfrågan för ${o.jobTitle}`, nb: m`Intervjuforespørsel for ${o.jobTitle}` }),
      heading, body, cta: { label: L(L_OPEN_SUBMISSION), url: o.detailUrl },
    }),
    text: plain(
      moved
        ? L({ de: m`${heading} (bisher ${moved}).`, en: m`${heading} (currently ${moved}).`, sv: m`${heading} (nu ${moved}).`, nb: m`${heading} (nå ${moved}).` })
        : L({ de: m`${co} möchte ${cand} für ${o.jobTitle} sprechen.`, en: m`${co} wants to talk to ${cand} about ${o.jobTitle}.`, sv: m`${co} vill prata med ${cand} om ${o.jobTitle}.`, nb: m`${co} vil snakke med ${cand} om ${o.jobTitle}.` }),
      ...o.slots.map((s) => `- ${formatBerlinRange(s, o.durationMinutes, lang)}`),
      `${L({ de: 'Einreichung', en: 'Submission', sv: 'Kandidatförslag', nb: 'Kandidatforslag' })}: ${o.detailUrl}`,
    ),
  };
}

export function recruiterUpdate(o: { kind: 'booked' | 'alternative' | 'declined'; candidateName: string; companyName: string; jobTitle: string; startIso?: string; durationMinutes?: number; reason?: string | null; detailUrl: string; format?: MeetingInfo['format']; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const when = o.startIso ? `${formatBerlinRange(o.startIso, o.durationMinutes ?? 60, lang)}${o.format ? ` · ${formatLabel(o.format, lang)}` : ''}` : '';
  const cand = o.candidateName;
  const heading = o.kind === 'booked'
    ? L({ de: m`Interview steht: ${cand}`, en: m`Interview confirmed: ${cand}`, sv: m`Intervju bokad: ${cand}`, nb: m`Intervju avtalt: ${cand}` })
    : o.kind === 'alternative'
      ? L({ de: m`${cand} fragt eine andere Zeit an`, en: m`${cand} is asking for a different time`, sv: m`${cand} ber om en annan tid`, nb: m`${cand} ber om et annet tidspunkt` })
      : L({ de: m`${cand} hat das Interview abgelehnt`, en: m`${cand} has declined the interview`, sv: m`${cand} har tackat nej till intervjun`, nb: m`${cand} har takket nei til intervjuet` });
  const c = esc(cand);
  const co = esc(o.companyName);
  const j = `<strong>${esc(o.jobTitle)}</strong>`;
  const w = `<strong>${esc(when)}</strong>`;
  const reasonHtml = o.reason ? `<br>${muted(`${L(L_REASON)}:`)} ${esc(o.reason)}` : '';
  const line = o.kind === 'booked'
    ? L({
      de: m`${c} hat das Interview mit ${co} für ${j} bestätigt: ${w}. Die Kalendereinladung hängt an.`,
      en: m`${c} has confirmed the interview with ${co} for ${j}: ${w}. The calendar invitation is attached.`,
      sv: m`${c} har bekräftat intervjun med ${co} för ${j}: ${w}. Kalenderinbjudan finns bifogad.`,
      nb: m`${c} har bekreftet intervjuet med ${co} for ${j}: ${w}. Kalenderinvitasjonen ligger ved.`,
    })
    : o.kind === 'alternative'
      ? L({ de: m`${c} fragt ${w} an. ${co} bestätigt.`, en: m`${c} is asking for ${w}. ${co} will confirm.`, sv: m`${c} ber om ${w}. ${co} bekräftar.`, nb: m`${c} ber om ${w}. ${co} bekrefter.` })
      : L({
        de: m`${c} hat das Interview mit ${co} für ${j} abgelehnt.${reasonHtml}`,
        en: m`${c} has declined the interview with ${co} for ${j}.${reasonHtml}`,
        sv: m`${c} har tackat nej till intervjun med ${co} för ${j}.${reasonHtml}`,
        nb: m`${c} har takket nei til intervjuet med ${co} for ${j}.${reasonHtml}`,
      });
  return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body: p(line), cta: { label: L(L_OPEN_SUBMISSION), url: o.detailUrl } }), text: plain(heading, when, o.reason && `${L(L_REASON)}: ${o.reason}`, o.detailUrl) };
}

// --- Kunde --------------------------------------------------------------------

/** Kandidat bleibt beim bisherigen Termin (keine der neuen Zeiten passt). */
export function clientRescheduleDeclined(o: { candidateLabel: string; jobTitle: string; previousStart: string; durationMinutes: number; reason: string | null; agendaUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const when = formatBerlinRange(o.previousStart, o.durationMinutes, lang);
  const heading = L({ de: m`${o.candidateLabel} bleibt beim bisherigen Termin`, en: m`${o.candidateLabel} is keeping the current appointment`, sv: m`${o.candidateLabel} behåller den nuvarande tiden`, nb: m`${o.candidateLabel} beholder det nåværende tidspunktet` });
  const c = esc(o.candidateLabel);
  const j = `<strong>${esc(o.jobTitle)}</strong>`;
  const w = `<strong>${esc(when)}</strong>`;
  const body = [
    p(L({
      de: m`Keine der neuen Zeiten passt ${c}. Der bisherige Termin für ${j} bleibt bestehen: ${w}.`,
      en: m`None of the new times work for ${c}. The current appointment for ${j} stays in place: ${w}.`,
      sv: m`Ingen av de nya tiderna passar ${c}. Den nuvarande tiden för ${j} gäller: ${w}.`,
      nb: m`Ingen av de nye tidspunktene passer for ${c}. Det nåværende tidspunktet for ${j} gjelder: ${w}.`,
    })),
    o.reason ? p(`${muted(`${L(L_MESSAGE)}:`)} ${esc(o.reason)}`) : '',
    p(L({ de: 'Möchten Sie trotzdem verschieben, schlagen Sie im Interview-Fenster neue Zeiten vor.', en: 'If you still want to reschedule, propose new times in the interview window.', sv: 'Vill du ändå flytta kan du föreslå nya tider i intervjufönstret.', nb: 'Vil du likevel flytte, kan du foreslå nye tidspunkter i intervjuvinduet.' })),
  ].join('');
  return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body, cta: { label: L({ de: 'Interviews öffnen', en: 'Open interviews', sv: 'Öppna intervjuer', nb: 'Åpne intervjuer' }), url: o.agendaUrl } }), text: plain(heading, when, o.reason && `${L(L_MESSAGE)}: ${o.reason}`, o.agendaUrl) };
}

export function clientBooked(o: { candidateName: string; jobTitle: string; startIso: string; durationMinutes: number; inOutlook: boolean; profileUrl: string; meeting?: MeetingInfo; round?: number; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const round = o.round ?? 1;
  const meeting: MeetingInfo = o.meeting ?? { format: 'teams', companyName: '' };
  const when = formatBerlinRange(o.startIso, o.durationMinutes, lang);
  const teams = meeting.format === 'teams';
  const c = esc(o.candidateName);
  const body = [
    p(`<strong>${esc(when)}</strong> · ${formatLabel(meeting.format, lang)} ${muted(`· ${zone(o.startIso, lang)}`)}`),
    meeting.format === 'phone' ? p(`<strong>${L({ de: m`Bitte rufen Sie ${c} an:`, en: m`Please call ${c}:`, sv: m`Ring ${c}:`, nb: m`Ring ${c}:` })}</strong> ${meeting.callPhone ? `<a href="tel:${esc(meeting.callPhone)}">${esc(meeting.callPhone)}</a>` : L({ de: 'die Nummer steht im Profil', en: 'the number is in the profile', sv: 'numret finns i profilen', nb: 'nummeret står i profilen' })}`) : '',
    meeting.format === 'onsite' && meeting.address ? p(L({ de: m`${c} kommt zu: ${esc(meeting.address).replace(/\n/g, ', ')}`, en: m`${c} will come to: ${esc(meeting.address).replace(/\n/g, ', ')}`, sv: m`${c} kommer till: ${esc(meeting.address).replace(/\n/g, ', ')}`, nb: m`${c} kommer til: ${esc(meeting.address).replace(/\n/g, ', ')}` })) : '',
    p(o.inOutlook
      ? L({
        de: m`${teams ? 'Der Termin mit Teams-Link' : 'Der Termin'} steht in Ihrem Outlook. Ihre Kollegen haben die Einladung von Ihnen bekommen.`,
        en: m`${teams ? 'The appointment with the Teams link' : 'The appointment'} is in your Outlook. Your colleagues have received the invitation from you.`,
        sv: m`${teams ? 'Mötet med Teams-länken' : 'Mötet'} finns i din Outlook. Dina kollegor har fått inbjudan från dig.`,
        nb: m`${teams ? 'Avtalen med Teams-lenken' : 'Avtalen'} ligger i Outlook. Kollegene dine har fått invitasjonen fra deg.`,
      })
      : L(L_INVITE_ATTACHED)),
    round === 1 ? p(L({ de: 'Name, Kontakt und Lebenslauf sind jetzt in Matchunt freigegeben.', en: 'Name, contact details and CV are now unlocked in Matchunt.', sv: 'Namn, kontaktuppgifter och CV är nu upplåsta i Matchunt.', nb: 'Navn, kontaktinformasjon og CV er nå låst opp i Matchunt.' })) : '',
    teams && !meeting.joinUrl ? p(L({ de: 'Ein Teams-Link ist nicht entstanden. Tragen Sie Ihren Link im Interview-Fenster ein, dann bekommen ihn alle per Mail.', en: 'No Teams link was created. Add your link in the interview window and everyone will receive it by email.', sv: 'Ingen Teams-länk skapades. Lägg in din länk i intervjufönstret, så får alla den via mejl.', nb: 'Det ble ikke opprettet noen Teams-lenke. Legg inn lenken din i intervjuvinduet, så får alle den på e-post.' })) : '',
  ].join('');
  const rs = roundSuffix(round, lang);
  const title = L({
    de: m`${o.candidateName} hat ${round > 1 ? `das ${round}. Gespräch` : 'das Interview'} bestätigt`,
    en: m`${o.candidateName} has confirmed the ${round > 1 ? `round ${round} ` : ''}interview`,
    sv: m`${o.candidateName} har bekräftat intervjun${rs}`,
    nb: m`${o.candidateName} har bekreftet intervjuet${rs}`,
  });
  return {
    subject: title,
    html: layout({ lang, preheader: when, heading: title, body, cta: { label: L({ de: 'Profil öffnen', en: 'Open profile', sv: 'Öppna profilen', nb: 'Åpne profilen' }), url: o.profileUrl } }),
    text: plain(
      L({ de: m`${o.candidateName} hat das Interview bestätigt: ${when}.`, en: m`${o.candidateName} has confirmed the interview: ${when}.`, sv: m`${o.candidateName} har bekräftat intervjun: ${when}.`, nb: m`${o.candidateName} har bekreftet intervjuet: ${when}.` }),
      meeting.format === 'phone' && meeting.callPhone && `${L({ de: 'Anrufen', en: 'Call', sv: 'Ring', nb: 'Ring' })}: ${meeting.callPhone}`,
      o.profileUrl,
    ),
  };
}

export function clientAlternative(o: { candidateLabel: string; jobTitle: string; startIso: string; durationMinutes: number; message: string | null; confirmUrl: string; agendaUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const confirmUrl = withLang(o.confirmUrl, lang);
  const when = formatBerlinRange(o.startIso, o.durationMinutes, lang);
  const body = [
    p(`${esc(o.candidateLabel)} · ${esc(o.jobTitle)}`),
    p(`<strong>${esc(when)}</strong> ${muted(`· ${zone(o.startIso, lang)} · ${L({ de: 'liegt in Ihren Interview-Zeiten', en: 'within your interview hours', sv: 'inom dina intervjutider', nb: 'innenfor intervjutidene dine' })}`)}`),
    o.message ? quote(o.message, lang) : '',
  ].join('');
  const head = L({ de: 'Der Kandidat fragt eine andere Zeit an', en: 'The candidate is asking for a different time', sv: 'Kandidaten ber om en annan tid', nb: 'Kandidaten ber om et annet tidspunkt' });
  const confirm = L({ de: 'Zeit bestätigen', en: 'Confirm time', sv: 'Bekräfta tiden', nb: 'Bekreft tidspunktet' });
  const [qa, qb] = marks(lang);
  return {
    subject: `${head}: ${o.jobTitle}`,
    html: layout({
      lang, preheader: when, heading: head, body, cta: { label: confirm, url: confirmUrl },
      after: L({ de: m`Passt nicht? <a href="${esc(o.agendaUrl)}">Neue Termine vorschlagen</a>`, en: m`Doesn't work? <a href="${esc(o.agendaUrl)}">Propose new times</a>`, sv: m`Passar det inte? <a href="${esc(o.agendaUrl)}">Föreslå nya tider</a>`, nb: m`Passer det ikke? <a href="${esc(o.agendaUrl)}">Foreslå nye tidspunkter</a>` }),
      footnote: L({ de: 'Der Bestätigen-Link funktioniert ohne Anmeldung und ist 7 Tage gültig.', en: 'The confirmation link works without signing in and is valid for 7 days.', sv: 'Bekräftelselänken fungerar utan inloggning och gäller i 7 dagar.', nb: 'Bekreftelseslenken fungerer uten innlogging og gjelder i 7 dager.' }),
    }),
    text: plain(
      L({ de: m`${o.candidateLabel} fragt ${when} an.`, en: m`${o.candidateLabel} is asking for ${when}.`, sv: m`${o.candidateLabel} ber om ${when}.`, nb: m`${o.candidateLabel} ber om ${when}.` }),
      o.message && `${qa}${o.message}${qb}`,
      `${confirm}: ${confirmUrl}`,
      `${L({ de: 'Neue Termine', en: 'New times', sv: 'Nya tider', nb: 'Nye tidspunkter' })}: ${o.agendaUrl}`,
    ),
  };
}

export function clientDeclined(o: { candidateLabel: string; jobTitle: string; reason: string | null; recruiterName: string | null; agendaUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const rn = o.recruiterName ? esc(o.recruiterName) : '';
  const body = [
    p(`${esc(o.candidateLabel)} · ${esc(o.jobTitle)}`),
    o.reason ? quote(o.reason, lang) : '',
    p(L({
      de: m`Die Identität bleibt geschützt.${rn ? ` ${rn} ist informiert.` : ''}`,
      en: m`The candidate's identity remains protected.${rn ? ` ${rn} has been informed.` : ''}`,
      sv: m`Kandidatens identitet förblir skyddad.${rn ? ` ${rn} har fått besked.` : ''}`,
      nb: m`Kandidatens identitet forblir beskyttet.${rn ? ` ${rn} har fått beskjed.` : ''}`,
    })),
  ].join('');
  const title = L({ de: m`${o.candidateLabel} hat das Interview abgelehnt`, en: m`${o.candidateLabel} has declined the interview`, sv: m`${o.candidateLabel} har tackat nej till intervjun`, nb: m`${o.candidateLabel} har takket nei til intervjuet` });
  return { subject: title, html: layout({ lang, preheader: o.jobTitle, heading: title, body, cta: { label: L({ de: 'Zu den Bewerbern', en: 'Go to candidates', sv: 'Till kandidaterna', nb: 'Til kandidatene' }), url: o.agendaUrl } }), text: plain(`${title}.`, o.reason && `${L(L_REASON)}: ${o.reason}`) };
}

export function attendeeBooked(o: { name: string; organizerName: string; candidateName: string; jobTitle: string; startIso: string; durationMinutes: number; joinUrl: string | null; agendaUrl: string; meeting?: MeetingInfo; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const meeting: MeetingInfo = o.meeting ?? { format: 'teams', companyName: '' };
  const when = formatBerlinRange(o.startIso, o.durationMinutes, lang);
  const org = esc(o.organizerName);
  const c = esc(o.candidateName);
  const tail = `<strong>${esc(when)}</strong> · ${formatLabel(meeting.format, lang)} ${muted(`· ${zone(o.startIso, lang)}`)}`;
  const cp = meeting.callPhone ? ` (${esc(meeting.callPhone)})` : '';
  const body = [
    p(hallo(esc(o.name.split(' ')[0]), lang)),
    p(L({
      de: m`${org} hat Sie zum Interview mit <strong>${c}</strong> (${esc(o.jobTitle)}) eingeladen: ${tail}.`,
      en: m`${org} has invited you to the interview with <strong>${c}</strong> (${esc(o.jobTitle)}): ${tail}.`,
      sv: m`${org} har bjudit in dig till intervjun med <strong>${c}</strong> (${esc(o.jobTitle)}): ${tail}.`,
      nb: m`${org} har invitert deg til intervjuet med <strong>${c}</strong> (${esc(o.jobTitle)}): ${tail}.`,
    })),
    meeting.format === 'onsite' && meeting.address ? p(`${L(L_PLACE)}: ${esc(meeting.address).replace(/\n/g, ', ')}`) : '',
    meeting.format === 'phone' ? p(L({ de: m`${org} ruft ${c} an${cp}.`, en: m`${org} will call ${c}${cp}.`, sv: m`${org} ringer ${c}${cp}.`, nb: m`${org} ringer ${c}${cp}.` })) : '',
    p(meeting.format === 'teams'
      ? L({ de: 'Die Kalendereinladung mit Teams-Link hängt an dieser Mail.', en: 'The calendar invitation with the Teams link is attached to this email.', sv: 'Kalenderinbjudan med Teams-länken finns bifogad i det här mejlet.', nb: 'Kalenderinvitasjonen med Teams-lenken ligger vedlagt denne e-posten.' })
      : L(L_INVITE_ATTACHED)),
  ].join('');
  const iv = L({ de: 'Interview', en: 'Interview', sv: 'Intervju', nb: 'Intervju' });
  return {
    subject: `${iv}: ${o.candidateName} · ${o.jobTitle}`,
    html: layout({ lang, preheader: when, heading: L({ de: m`Interview mit ${o.candidateName}`, en: m`Interview with ${o.candidateName}`, sv: m`Intervju med ${o.candidateName}`, nb: m`Intervju med ${o.candidateName}` }), body, cta: o.joinUrl ? { label: L(L_TEAMS_OPEN), url: o.joinUrl } : undefined }),
    text: plain(L({ de: m`Interview mit ${o.candidateName} (${o.jobTitle}): ${when}`, en: m`Interview with ${o.candidateName} (${o.jobTitle}): ${when}`, sv: m`Intervju med ${o.candidateName} (${o.jobTitle}): ${when}`, nb: m`Intervju med ${o.candidateName} (${o.jobTitle}): ${when}` }), o.joinUrl && `Teams: ${o.joinUrl}`),
  };
}

// --- Kollegen ins Team einladen (aus dem Anfrage-Fenster) ----------------------

/** Funktion im Team in der Sprache des Empfängers (Schlüssel wie FUNCTION_LABELS im Interview-Service). */
export function functionLabelIn(key: string | null | undefined, fallback: string, lang?: Lx): string {
  const labels: Record<string, { de: string; en: string; sv: string; nb: string }> = {
    fachbereich: { de: 'Fachbereich', en: 'Department', sv: 'Verksamhet', nb: 'Fagavdeling' },
    fuehrungskraft: { de: 'Führungskraft', en: 'Manager', sv: 'Chef', nb: 'Leder' },
    geschaeftsfuehrung: { de: 'Geschäftsführung', en: 'Management', sv: 'Företagsledning', nb: 'Ledelse' },
    hr: { de: 'HR', en: 'HR', sv: 'HR', nb: 'HR' },
    andere: { de: 'Andere', en: 'Other', sv: 'Annat', nb: 'Annet' },
  };
  return key && labels[key] ? langOf(lang)(labels[key]) : fallback;
}

export function teamInviteForInterview(o: { inviterName: string; orgName: string; functionLabel: string; jobTitle: string; access: 'job' | 'all'; inviteUrl: string; decisionMaker: boolean; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const inviteUrl = withLang(o.inviteUrl, lang);
  const eJob = esc(o.jobTitle);
  const qJob = quoted(eJob, lang);
  const body = [
    p(L({ de: 'Guten Tag,', en: 'Hello,', sv: 'Hej,', nb: 'Hei,' })),
    p(L({
      de: m`<strong>${esc(o.inviterName)}</strong> lädt Sie ins Team von <strong>${esc(o.orgName)}</strong> auf Matchunt ein.`,
      en: m`<strong>${esc(o.inviterName)}</strong> is inviting you to join the <strong>${esc(o.orgName)}</strong> team on Matchunt.`,
      sv: m`<strong>${esc(o.inviterName)}</strong> bjuder in dig till teamet på <strong>${esc(o.orgName)}</strong> i Matchunt.`,
      nb: m`<strong>${esc(o.inviterName)}</strong> inviterer deg til teamet til <strong>${esc(o.orgName)}</strong> på Matchunt.`,
    })),
    p(`${muted(L({ de: 'Ihre Funktion:', en: 'Your role:', sv: 'Din funktion:', nb: 'Din funksjon:' }))} ${esc(o.functionLabel)}${o.decisionMaker ? L({ de: ' · entscheidet über die Einstellung', en: ' · makes the hiring decision', sv: ' · fattar beslut om anställningen', nb: ' · tar beslutningen om ansettelse' }) : ''}<br>${muted(L({ de: 'Zugriff:', en: 'Access:', sv: 'Åtkomst:', nb: 'Tilgang:' }))} ${o.access === 'all'
      ? L({ de: 'alle Stellen und Bewerber', en: 'all roles and candidates', sv: 'alla tjänster och kandidater', nb: 'alle stillinger og kandidater' })
      : L({ de: m`die Stelle ${qJob}`, en: m`the role ${qJob}`, sv: m`tjänsten ${qJob}`, nb: m`stillingen ${qJob}` })}`),
    p(L({
      de: m`Sie sind beim Interview für ${qJob} dabei. Den Termin bekommen Sie als Kalendereinladung, sobald der Kandidat bestätigt hat.`,
      en: m`You will take part in the interview for ${qJob}. You will receive the appointment as a calendar invitation once the candidate has confirmed.`,
      sv: m`Du deltar i intervjun för ${qJob}. Du får tiden som kalenderinbjudan så snart kandidaten har bekräftat.`,
      nb: m`Du er med på intervjuet for ${qJob}. Du får tidspunktet som kalenderinvitasjon så snart kandidaten har bekreftet.`,
    })),
  ].join('');
  const accept = L({ de: 'Einladung annehmen', en: 'Accept invitation', sv: 'Tacka ja till inbjudan', nb: 'Godta invitasjonen' });
  return {
    subject: L({ de: m`${o.inviterName} lädt Sie zu ${o.orgName} auf Matchunt ein`, en: m`${o.inviterName} is inviting you to ${o.orgName} on Matchunt`, sv: m`${o.inviterName} bjuder in dig till ${o.orgName} i Matchunt`, nb: m`${o.inviterName} inviterer deg til ${o.orgName} på Matchunt` }),
    html: layout({
      lang,
      preheader: L({ de: m`Interview für ${o.jobTitle}`, en: m`Interview for ${o.jobTitle}`, sv: m`Intervju för ${o.jobTitle}`, nb: m`Intervju for ${o.jobTitle}` }),
      heading: L({ de: 'Einladung ins Team', en: 'Invitation to the team', sv: 'Inbjudan till teamet', nb: 'Invitasjon til teamet' }),
      body, cta: { label: accept, url: inviteUrl },
      footnote: L({ de: 'Der Link ist 7 Tage gültig und nur einmal verwendbar. Falls Sie diese Einladung nicht erwartet haben, können Sie die Mail ignorieren.', en: 'The link is valid for 7 days and can be used once. If you were not expecting this invitation, you can ignore this email.', sv: 'Länken gäller i 7 dagar och kan bara användas en gång. Om du inte väntade dig den här inbjudan kan du bortse från mejlet.', nb: 'Lenken gjelder i 7 dager og kan bare brukes én gang. Hvis du ikke ventet denne invitasjonen, kan du se bort fra e-posten.' }),
    }),
    text: plain(
      L({ de: m`${o.inviterName} lädt Sie ins Team von ${o.orgName} auf Matchunt ein.`, en: m`${o.inviterName} is inviting you to join the ${o.orgName} team on Matchunt.`, sv: m`${o.inviterName} bjuder in dig till teamet på ${o.orgName} i Matchunt.`, nb: m`${o.inviterName} inviterer deg til teamet til ${o.orgName} på Matchunt.` }),
      `${L({ de: 'Funktion', en: 'Role', sv: 'Funktion', nb: 'Funksjon' })}: ${o.functionLabel}`,
      `${L({ de: 'Interview', en: 'Interview', sv: 'Intervju', nb: 'Intervju' })}: ${o.jobTitle}`,
      `${accept}: ${inviteUrl}`,
    ),
  };
}

// --- IT des Kunden --------------------------------------------------------------

export function itConsentRequest(o: { requesterName: string; companyName: string | null; consentUrl: string; datasheetUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const who = `${esc(o.requesterName)}${o.companyName ? ` (${esc(o.companyName)})` : ''}`;
  const body = [
    p(L({
      de: m`${who} möchte Interviews über Matchunt planen und bittet Sie, die Matchunt-Kalender-App einmal für Ihre Firma freizugeben.`,
      en: m`${who} would like to schedule interviews via Matchunt and asks you to approve the Matchunt calendar app once for your organisation.`,
      sv: m`${who} vill planera intervjuer via Matchunt och ber dig att godkänna Matchunts kalenderapp en gång för ert företag.`,
      nb: m`${who} vil planlegge intervjuer via Matchunt og ber deg godkjenne Matchunts kalenderapp én gang for virksomheten deres.`,
    })),
    p(L({
      de: '<strong>Benötigt:</strong> frei/belegt lesen und Interview-Termine eintragen (Microsoft Graph, delegiert: Calendars.ReadWrite, offline_access). Nur für Nutzer, die selbst verbinden. Kein Zugriff auf Mails, Dateien oder Chats.',
      en: '<strong>Required:</strong> read free/busy and add interview appointments (Microsoft Graph, delegated: Calendars.ReadWrite, offline_access). Only for users who connect themselves. No access to emails, files or chats.',
      sv: '<strong>Behörighet:</strong> läsa ledig/upptagen och lägga in intervjutider (Microsoft Graph, delegerad: Calendars.ReadWrite, offline_access). Endast för användare som själva ansluter. Ingen åtkomst till mejl, filer eller chattar.',
      nb: '<strong>Tilgang som trengs:</strong> lese ledig/opptatt og legge inn intervjutider (Microsoft Graph, delegert: Calendars.ReadWrite, offline_access). Bare for brukere som kobler til selv. Ingen tilgang til e-post, filer eller chatter.',
    })),
  ].join('');
  const title = L({ de: 'Bitte um Freigabe: Matchunt-Kalenderzugriff', en: 'Approval request: Matchunt calendar access', sv: 'Begäran om godkännande: Matchunts kalenderåtkomst', nb: 'Forespørsel om godkjenning: Matchunts kalendertilgang' });
  const sheet = L({ de: 'Datenblatt', en: 'Data sheet', sv: 'Datablad', nb: 'Datablad' });
  return {
    subject: title,
    html: layout({
      lang,
      preheader: L({ de: 'Einmalige Freigabe für Ihre Firma', en: 'One-time approval for your organisation', sv: 'Engångsgodkännande för ert företag', nb: 'Engangsgodkjenning for virksomheten deres' }),
      heading: title, body,
      cta: { label: L({ de: 'In Microsoft freigeben', en: 'Approve in Microsoft', sv: 'Godkänn i Microsoft', nb: 'Godkjenn i Microsoft' }), url: o.consentUrl },
      after: `${L({ de: 'Details für IT und Betriebsrat', en: 'Details for IT and the works council', sv: 'Information för IT och facket', nb: 'Detaljer for IT og tillitsvalgte' })}: <a href="${esc(o.datasheetUrl)}">${sheet}</a>`,
      footnote: `${L({ de: 'Fragen zur Freigabe', en: 'Questions about the approval', sv: 'Frågor om godkännandet', nb: 'Spørsmål om godkjenningen' })}: datenschutz@matchunt.ai`,
    }),
    text: plain(
      L({ de: m`${o.requesterName} bittet um Freigabe der Matchunt-Kalender-App.`, en: m`${o.requesterName} is asking you to approve the Matchunt calendar app.`, sv: m`${o.requesterName} ber om godkännande av Matchunts kalenderapp.`, nb: m`${o.requesterName} ber om godkjenning av Matchunts kalenderapp.` }),
      `${L({ de: 'Freigeben', en: 'Approve', sv: 'Godkänn', nb: 'Godkjenn' })}: ${o.consentUrl}`,
      `${sheet}: ${o.datasheetUrl}`,
    ),
  };
}

export function itApproved(o: { name: string; connectUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const n = esc(o.name.split(' ')[0] || '');
  const body = p(L({
    de: m`Hallo ${n}, Ihre IT hat die Matchunt-Kalender-App freigegeben. Sie können Outlook jetzt mit einem Klick verbinden.`,
    en: m`Hello ${n}, your IT team has approved the Matchunt calendar app. You can now connect Outlook with one click.`,
    sv: m`Hej ${n}, er IT-avdelning har godkänt Matchunts kalenderapp. Du kan nu ansluta Outlook med ett klick.`,
    nb: m`Hei ${n}, IT-avdelingen deres har godkjent Matchunts kalenderapp. Du kan nå koble til Outlook med ett klikk.`,
  }));
  const title = L({ de: 'Ihre IT hat zugestimmt', en: 'Your IT team has approved', sv: 'Er IT-avdelning har godkänt', nb: 'IT-avdelingen deres har godkjent' });
  return {
    subject: title,
    html: layout({ lang, preheader: L({ de: 'Outlook jetzt verbinden', en: 'Connect Outlook now', sv: 'Anslut Outlook nu', nb: 'Koble til Outlook nå' }), heading: title, body, cta: { label: L({ de: 'Jetzt verbinden', en: 'Connect now', sv: 'Anslut nu', nb: 'Koble til nå' }), url: o.connectUrl } }),
    text: plain(`${title}.`, o.connectUrl),
  };
}

// --- Nachträglich eingetragener Link -------------------------------------------

export function linkAdded(o: { name: string | null; companyName: string; jobTitle: string; startIso: string; durationMinutes: number; joinUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const when = formatBerlinRange(o.startIso, o.durationMinutes, lang);
  const w = `<strong>${esc(when)}</strong>`;
  const ctx = `${esc(o.jobTitle)}, ${esc(o.companyName)}`;
  const body = [
    p(hallo(o.name ? esc(o.name) : null, lang)),
    p(L({
      de: m`für das Gespräch ${w} (${ctx}) steht jetzt der Link fest. Die aktualisierte Kalendereinladung hängt an.`,
      en: m`The link for the interview on ${w} (${ctx}) is now available. The updated calendar invitation is attached.`,
      sv: m`Länken till samtalet ${w} (${ctx}) är nu klar. Den uppdaterade kalenderinbjudan finns bifogad.`,
      nb: m`Lenken til samtalen ${w} (${ctx}) er nå klar. Den oppdaterte kalenderinvitasjonen ligger ved.`,
    })),
  ].join('');
  return {
    subject: L({ de: m`Link für Ihr Gespräch: ${o.jobTitle}`, en: m`Link for your interview: ${o.jobTitle}`, sv: m`Länk till ditt samtal: ${o.jobTitle}`, nb: m`Lenke til samtalen din: ${o.jobTitle}` }),
    html: layout({ lang, preheader: when, heading: L({ de: 'Der Link zum Gespräch', en: 'The link to the interview', sv: 'Länken till samtalet', nb: 'Lenken til samtalen' }), body, cta: { label: L({ de: 'Gespräch öffnen', en: 'Open meeting', sv: 'Öppna mötet', nb: 'Åpne møtet' }), url: o.joinUrl } }),
    text: plain(L({ de: m`Link für das Gespräch ${when}: ${o.joinUrl}`, en: m`Link for the interview on ${when}: ${o.joinUrl}`, sv: m`Länk till samtalet ${when}: ${o.joinUrl}`, nb: m`Lenke til samtalen ${when}: ${o.joinUrl}` })),
  };
}

// --- Feedback des Kunden an den Headhunter -------------------------------------

export type FeedbackWay = 'next_round' | 'offer' | 'unsure' | 'reject';
export const FEEDBACK_LABEL: Record<FeedbackWay, string> = {
  next_round: 'nächste Runde',
  offer: 'Angebot',
  unsure: 'noch unsicher',
  reject: 'Absage',
};
const FEEDBACK_LABEL_IN: Record<FeedbackWay, { de: string; en: string; sv: string; nb: string }> = {
  next_round: { de: 'nächste Runde', en: 'next round', sv: 'nästa omgång', nb: 'neste runde' },
  offer: { de: 'Angebot', en: 'offer', sv: 'erbjudande', nb: 'tilbud' },
  unsure: { de: 'noch unsicher', en: 'still unsure', sv: 'fortfarande osäker', nb: 'fortsatt usikker' },
  reject: { de: 'Absage', en: 'rejection', sv: 'avslag', nb: 'avslag' },
};
/** Ergebnis des Feedbacks in der Sprache des Empfängers. */
export const feedbackLabel = (way: FeedbackWay, lang?: Lx) => langOf(lang)(FEEDBACK_LABEL_IN[way]);

export function recruiterFeedback(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; jobTitle: string; round: number; way: FeedbackWay; impression: string | null; question?: string | null; akteUrl: string; submissionId: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const first = esc(o.candidateName.split(' ')[0]);
  const company = esc(o.companyName);
  const next = o.way === 'next_round'
    ? L({ de: m`${company} plant ein weiteres Gespräch. Sprich heute noch mit ${first}, wie es war.`, en: m`${company} is planning another interview. Talk to ${first} today about how it went.`, sv: m`${company} planerar ett nytt samtal. Prata med ${first} redan i dag om hur det gick.`, nb: m`${company} planlegger en ny samtale. Snakk med ${first} i dag om hvordan det gikk.` })
    : o.way === 'offer'
      ? L({ de: m`${company} möchte ${first} ein Angebot machen und wartet auf deine Empfehlung. Sprich mit ${first} und schick sie, bevor ${company} Zahlen schreibt.`, en: m`${company} wants to make ${first} an offer and is waiting for your recommendation. Talk to ${first} and send it before ${company} puts numbers on paper.`, sv: m`${company} vill ge ${first} ett erbjudande och väntar på din rekommendation. Prata med ${first} och skicka den innan ${company} sätter siffror på papper.`, nb: m`${company} vil gi ${first} et tilbud og venter på anbefalingen din. Snakk med ${first} og send den før ${company} setter tall på papiret.` })
      : o.way === 'unsure'
        ? (o.question
          ? L({ de: m`${company} ist noch unsicher und fragt:`, en: m`${company} is still unsure and asks:`, sv: m`${company} är fortfarande osäker och frågar:`, nb: m`${company} er fortsatt usikker og spør:` })
          : L({ de: m`${company} ist noch unsicher. Bitte kläre die offenen Punkte und antworte über Matchunt.`, en: m`${company} is still unsure. Please clarify the open points and reply via Matchunt.`, sv: m`${company} är fortfarande osäker. Reda ut de öppna frågorna och svara via Matchunt.`, nb: m`${company} er fortsatt usikker. Avklar de åpne punktene og svar via Matchunt.` }))
        : L({ de: m`${company} sagt ab. Die Absage mit Grund folgt; informiere ${first} persönlich.`, en: m`${company} is turning the candidate down. The rejection with reasons will follow; please tell ${first} personally.`, sv: m`${company} tackar nej. Avslaget med motivering kommer; meddela ${first} personligen.`, nb: m`${company} takker nei. Avslaget med begrunnelse kommer; gi ${first} beskjed personlig.` });
  const label = feedbackLabel(o.way, lang);
  const rs = roundSuffix(o.round, lang);
  const heading = L({
    de: m`${o.companyName} nach ${o.round > 1 ? `dem ${o.round}. Gespräch` : 'dem Interview'}: ${label}`,
    en: m`${o.companyName} after the ${o.round > 1 ? `round ${o.round} ` : ''}interview: ${label}`,
    sv: m`${o.companyName} efter intervjun${rs}: ${label}`,
    nb: m`${o.companyName} etter intervjuet${rs}: ${label}`,
  });
  const cta = o.way === 'offer' ? { label: L({ de: 'Empfehlung schreiben', en: 'Write recommendation', sv: 'Skriv rekommendation', nb: 'Skriv anbefaling' }), url: `${o.akteUrl}?empfehlung=${o.submissionId}` }
    : o.way === 'unsure' ? { label: L({ de: 'Frage beantworten', en: 'Answer question', sv: 'Svara på frågan', nb: 'Svar på spørsmålet' }), url: `${o.akteUrl}?frage=${o.submissionId}` }
      : { label: L({ de: 'Akte öffnen', en: 'Open candidate file', sv: 'Öppna kandidatakten', nb: 'Åpne kandidatmappen' }), url: o.akteUrl };
  const c = `<strong>${esc(o.candidateName)}</strong>`;
  const j = `<strong>${esc(o.jobTitle)}</strong>`;
  const body = [
    p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)),
    p(L({ de: m`Feedback zu ${c} für ${j}:`, en: m`Feedback on ${c} for ${j}:`, sv: m`Återkoppling om ${c} för ${j}:`, nb: m`Tilbakemelding om ${c} for ${j}:` })),
    o.impression ? quote(o.impression, lang) : '',
    p(next),
    o.way === 'unsure' && o.question ? quote(o.question, lang) : '',
  ].join('');
  const [qa, qb] = marks(lang);
  return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body, cta }), text: plain(heading, o.impression && `${qa}${o.impression}${qb}`, o.way === 'unsure' && o.question && `${L({ de: 'Frage', en: 'Question', sv: 'Fråga', nb: 'Spørsmål' })}: ${qa}${o.question}${qb}`, cta.url) };
}

/** Einmal nach einem Tag ohne Empfehlung (täglicher Lauf). */
export function recruiterRecommendationReminder(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; jobTitle: string; akteUrl: string; submissionId: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const first = esc(o.candidateName.split(' ')[0]);
  const heading = L({ de: m`${o.companyName} wartet auf deine Empfehlung zu ${o.candidateName}`, en: m`${o.companyName} is waiting for your recommendation on ${o.candidateName}`, sv: m`${o.companyName} väntar på din rekommendation om ${o.candidateName}`, nb: m`${o.companyName} venter på anbefalingen din om ${o.candidateName}` });
  const url = `${o.akteUrl}?empfehlung=${o.submissionId}`;
  const co = esc(o.companyName);
  const body = [
    p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)),
    p(L({
      de: m`${co} möchte ${first} ein Angebot machen und wartet noch auf deine Empfehlung, was es für die Zusage braucht.`,
      en: m`${co} wants to make ${first} an offer and is still waiting for your recommendation on what it will take to get a yes.`,
      sv: m`${co} vill ge ${first} ett erbjudande och väntar fortfarande på din rekommendation om vad som krävs för ett ja.`,
      nb: m`${co} vil gi ${first} et tilbud og venter fortsatt på anbefalingen din om hva som skal til for et ja.`,
    })),
  ].join('');
  return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body, cta: { label: L({ de: 'Empfehlung schreiben', en: 'Write recommendation', sv: 'Skriv rekommendation', nb: 'Skriv anbefaling' }), url } }), text: plain(heading, url) };
}

// --- Erinnerung am Vortag --------------------------------------------------------

export function candidateReminder(o: { firstName: string | null; companyName: string; jobTitle: string; startIso: string; durationMinutes: number; round: number; meeting: MeetingInfo; interviewers: PersonRef[]; recruiter: { name: string; phone: string | null } | null; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const when = clockSpan(o.startIso, o.durationMinutes, lang);
  const mt = o.meeting;
  const t = formatBerlinTime(o.startIso, lang);
  const co = o.companyName;
  const rt = roundTitle(o.round, lang);
  const heading = mt.format === 'onsite'
    ? L({ de: m`Morgen ${t} Uhr bei ${co}`, en: m`Tomorrow at ${t} at ${co}`, sv: m`I morgon kl. ${t} hos ${co}`, nb: m`I morgen kl. ${t} hos ${co}` })
    : L({ de: m`Morgen ${t} Uhr: ${rt} mit ${co}`, en: m`Tomorrow at ${t}: ${rt} with ${co}`, sv: m`I morgon kl. ${t}: ${rt} med ${co}`, nb: m`I morgen kl. ${t}: ${rt} med ${co}` });
  const cp = mt.callPhone ? esc(mt.callPhone) : '';
  const how = mt.format === 'onsite'
    ? ''
    : mt.format === 'phone'
      ? p(L({ de: m`${esc(co)} ruft Sie an${cp ? ` unter ${cp}` : ''}.`, en: m`${esc(co)} will call you${cp ? ` on ${cp}` : ''}.`, sv: m`${esc(co)} ringer dig${cp ? ` på ${cp}` : ''}.`, nb: m`${esc(co)} ringer deg${cp ? ` på ${cp}` : ''}.` }))
      : p(mt.joinUrl
        ? `${L({ de: 'Teams-Link', en: 'Teams link', sv: 'Teams-länk', nb: 'Teams-lenke' })}: <a href="${esc(mt.joinUrl)}">${esc(mt.joinUrl)}</a>`
        : L({ de: 'Den Link bekommen Sie per Mail, sobald er feststeht.', en: 'You will receive the link by email as soon as it is available.', sv: 'Länken får du via mejl så snart den är klar.', nb: 'Lenken får du på e-post så snart den er klar.' }));
  const at = `<strong>${esc(formatBerlinDateLong(o.startIso, lang))}, ${esc(when)}</strong>`;
  const j = `<strong>${esc(o.jobTitle)}</strong>`;
  const rs = roundSuffix(o.round, lang);
  const body = [
    p(hallo(o.firstName ? esc(o.firstName) : null, lang)),
    p(L({
      de: m`kurze Erinnerung: morgen, ${at}, ${o.round > 1 ? `Ihr ${o.round}. Gespräch` : 'Ihr Interview'} für ${j}.`,
      en: m`A quick reminder: tomorrow, ${at}, your ${o.round > 1 ? `round ${o.round} ` : ''}interview for ${j}.`,
      sv: m`En kort påminnelse: i morgon, ${at}, din intervju${rs} för ${j}.`,
      nb: m`En kort påminnelse: i morgen, ${at}, intervjuet ditt${rs} for ${j}.`,
    })),
    locationHtml(mt, lang),
    how,
    o.interviewers.length ? p(`${muted(`${L(L_INTERVIEWERS)}:`)} ${esc(interviewerLine(o.interviewers))}`) : '',
  ].join('');
  const cta = mt.format === 'onsite' && mt.address ? { label: L({ de: 'Anfahrt', en: 'Directions', sv: 'Vägbeskrivning', nb: 'Veibeskrivelse' }), url: mapsUrl(mt.address) }
    : mt.format === 'teams' && mt.joinUrl ? { label: L({ de: 'Teams öffnen', en: 'Open Teams', sv: 'Öppna Teams', nb: 'Åpne Teams' }), url: mt.joinUrl } : undefined;
  const rec = o.recruiter ? `${esc(o.recruiter.name)}${o.recruiter.phone ? `, ${esc(o.recruiter.phone)}` : ''}` : '';
  return {
    subject: heading,
    html: layout({ lang, preheader: o.jobTitle, heading, body, cta, after: o.recruiter ? L({ de: m`Etwas kommt dazwischen? Melden Sie sich bei ${rec}.`, en: m`Something come up? Contact ${rec}.`, sv: m`Har något kommit emellan? Kontakta ${rec}.`, nb: m`Har noe kommet i veien? Kontakt ${rec}.` }) : undefined }),
    text: plain(
      heading, `${formatBerlinDateLong(o.startIso, lang)}, ${when}`,
      mt.format === 'onsite' && mt.address && `${L(L_ADDRESS)}: ${mt.address}`,
      mt.format === 'onsite' && contactLine(mt) && `${L({ de: 'Ansprechpartner', en: 'Contact', sv: 'Kontaktperson', nb: 'Kontaktperson' })}: ${contactLine(mt)}`,
      mt.format === 'teams' && mt.joinUrl && `Teams: ${mt.joinUrl}`,
      o.recruiter && `${L(L_QUESTIONS)}: ${o.recruiter.name}${o.recruiter.phone ? `, ${o.recruiter.phone}` : ''}`,
    ),
  };
}

export function clientReminder(o: { name: string | null; candidateName: string; jobTitle: string; startIso: string; durationMinutes: number; round: number; meeting: MeetingInfo; agendaUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const when = formatBerlinRange(o.startIso, o.durationMinutes, lang);
  const rt = roundTitle(o.round, lang);
  const heading = L({ de: m`Morgen: ${rt} mit ${o.candidateName}`, en: m`Tomorrow: ${rt} with ${o.candidateName}`, sv: m`I morgon: ${rt} med ${o.candidateName}`, nb: m`I morgen: ${rt} med ${o.candidateName}` });
  const mt = o.meeting;
  const w = `<strong>${esc(when)}</strong>`;
  const c = `<strong>${esc(o.candidateName)}</strong>`;
  const tail = `(${esc(o.jobTitle)}) · ${formatLabel(mt.format, lang)}`;
  const rs = roundSuffix(o.round, lang);
  const contact = contactLine(mt);
  const body = [
    p(hallo(o.name ? esc(o.name.split(' ')[0]) : null, lang)),
    p(L({
      de: m`morgen, ${w}, ${o.round > 1 ? `${o.round}. Gespräch` : 'Interview'} mit ${c} ${tail}.`,
      en: m`Tomorrow, ${w}, ${o.round > 1 ? `round ${o.round} interview` : 'interview'} with ${c} ${tail}.`,
      sv: m`I morgon, ${w}, intervju${rs} med ${c} ${tail}.`,
      nb: m`I morgen, ${w}, intervju${rs} med ${c} ${tail}.`,
    })),
    mt.format === 'onsite' && mt.address ? p(`${L(L_PLACE)}: ${esc(mt.address).replace(/\n/g, ', ')}${contact ? ` · ${L({ de: 'Empfang', en: 'Reception', sv: 'Reception', nb: 'Resepsjon' })}: ${esc(contact)}` : ''}`) : '',
    mt.format === 'teams' && !mt.joinUrl ? p(L({ de: 'Es gibt noch keinen Teams-Link. Bitte tragen Sie ihn im Interview-Fenster ein.', en: 'There is no Teams link yet. Please add it in the interview window.', sv: 'Det finns ingen Teams-länk ännu. Lägg in den i intervjufönstret.', nb: 'Det finnes ingen Teams-lenke ennå. Legg den inn i intervjuvinduet.' })) : '',
    p(L({ de: 'Leitfaden, Lebenslauf und Notizen finden Sie im Interview-Fenster.', en: 'You will find the interview guide, CV and notes in the interview window.', sv: 'Intervjuguide, CV och anteckningar hittar du i intervjufönstret.', nb: 'Intervjuguide, CV og notater finner du i intervjuvinduet.' })),
  ].join('');
  return { subject: heading, html: layout({ lang, preheader: when, heading, body, cta: { label: L({ de: 'Interview öffnen', en: 'Open interview', sv: 'Öppna intervjun', nb: 'Åpne intervjuet' }), url: o.agendaUrl } }), text: plain(heading, when, o.agendaUrl) };
}
