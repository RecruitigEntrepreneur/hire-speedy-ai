// Echte Kalendereinladungen (iCalendar/iTIP, RFC 5545/5546) für Interviews.
// Jede Person bekommt ihre eigene Einladung mit eigener UID und nur sich selbst
// als Teilnehmer, damit niemand die Mailadressen der anderen Seite sieht.
// Gleiche UID + höhere SEQUENCE = Änderung, METHOD:CANCEL = Absage.

export interface IcsInvite {
  method: 'REQUEST' | 'CANCEL';
  uid: string;
  sequence: number;
  startIso: string;
  durationMinutes: number;
  summary: string;
  description: string;
  location?: string;
  url?: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName?: string;
  nowMs?: number;
}

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Text-Escaping nach RFC 5545 (Backslash, Semikolon, Komma, Zeilenumbruch). */
export function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const paramValue = (value: string) => `"${value.replace(/"/g, "'")}"`;

/** Zeilen auf 75 Bytes falten (Fortsetzung beginnt mit einem Leerzeichen), UTF-8-sicher. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let limit = 75;
  for (const ch of line) {
    if (enc.encode(current + ch).length > limit) {
      parts.push(current);
      current = ch;
      limit = 74; // Folgezeilen tragen ein führendes Leerzeichen
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(invite: IcsInvite): string {
  const start = Date.parse(invite.startIso);
  const end = start + invite.durationMinutes * 60000;
  const cancel = invite.method === 'CANCEL';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Matchunt//Interviews//DE',
    'CALSCALE:GREGORIAN',
    `METHOD:${invite.method}`,
    'BEGIN:VEVENT',
    `UID:${invite.uid}`,
    `SEQUENCE:${invite.sequence}`,
    `DTSTAMP:${utcStamp(invite.nowMs ?? Date.now())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsEscape(cancel ? `Abgesagt: ${invite.summary}` : invite.summary)}`,
    `DESCRIPTION:${icsEscape(invite.description)}`,
    ...(invite.location ? [`LOCATION:${icsEscape(invite.location)}`] : []),
    ...(invite.url ? [`URL:${invite.url}`] : []),
    `ORGANIZER;CN=${paramValue(invite.organizerName)}:mailto:${invite.organizerEmail}`,
    `ATTENDEE;CN=${paramValue(invite.attendeeName || invite.attendeeEmail)};ROLE=REQ-PARTICIPANT;PARTSTAT=${cancel ? 'DECLINED' : 'NEEDS-ACTION'};RSVP=FALSE:mailto:${invite.attendeeEmail}`,
    `STATUS:${cancel ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    ...(cancel ? [] : ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Interview in 15 Minuten', 'TRIGGER:-PT15M', 'END:VALARM']),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Stabile UID je Interview und Empfängerseite, damit Änderungen denselben Eintrag treffen. */
export function inviteUid(interviewId: string, recipientKey: string): string {
  return `interview-${interviewId}-${recipientKey}@matchunt.ai`;
}
