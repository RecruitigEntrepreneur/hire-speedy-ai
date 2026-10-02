import { buildIcs, foldLine, icsEscape, inviteUid } from '../functions/_shared/interview-ics.ts';
import { base64Utf8, buildMime, dotStuff, encodeHeader, sendInterviewMail } from '../functions/_shared/interview-mailer.ts';
const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };

const invite = {
  method: 'REQUEST' as const,
  uid: inviteUid('iv-1', 'candidate'),
  sequence: 0,
  startIso: '2026-10-06T08:00:00.000Z',
  durationMinutes: 60,
  summary: 'Interview: Data Scientist bei Bluewater & Bridge',
  description: 'Teams-Link: https://teams.microsoft.com/l/meetup-join/abc\nFragen? Tim Weber, 0151 123',
  location: 'Microsoft Teams-Besprechung',
  organizerEmail: 'termine@matchunt.ai',
  organizerName: 'Matchunt Termine',
  attendeeEmail: 'kandidat@example.test',
  attendeeName: 'Katharina Brenner',
  nowMs: Date.parse('2026-10-03T07:12:00Z'),
};

Deno.test('ICS: Einladung mit UTC-Zeiten, Organisator, nur eigener Teilnehmer, CRLF', () => {
  const ics = buildIcs(invite);
  assert(ics.includes('METHOD:REQUEST\r\n'));
  assert(ics.includes('DTSTART:20261006T080000Z'));
  assert(ics.includes('DTEND:20261006T090000Z'));
  assert(ics.includes('UID:interview-iv-1-candidate@matchunt.ai'));
  assert(ics.includes('ORGANIZER;CN="Matchunt Termine":mailto:termine@matchunt.ai'));
  assert((ics.match(/ATTENDEE/g) ?? []).length === 1, 'nur ein Teilnehmer');
  assert(!ics.replace(/\r\n/g, '').includes('\n'), 'nur CRLF');
  assert(ics.includes('BEGIN:VALARM'));
});

Deno.test('ICS: Absage nutzt dieselbe UID, höhere Sequenz und METHOD:CANCEL', () => {
  const ics = buildIcs({ ...invite, method: 'CANCEL', sequence: 2 });
  assert(ics.includes('METHOD:CANCEL'));
  assert(ics.includes('SEQUENCE:2'));
  assert(ics.includes('STATUS:CANCELLED'));
  assert(ics.includes('SUMMARY:Abgesagt: Interview'));
  assert(!ics.includes('VALARM'));
});

Deno.test('ICS: Escaping und Zeilenfaltung', () => {
  assert(icsEscape('a,b;c\\d\ne') === 'a\\,b\\;c\\\\d\\ne');
  const long = 'DESCRIPTION:' + 'ä'.repeat(80);
  const folded = foldLine(long);
  assert(folded.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
  assert(folded.split('\r\n').slice(1).every((l) => l.startsWith(' ')));
});

Deno.test('MIME: Kalender-Teil mit method=REQUEST in alternative, plus Anhang, Betreff kodiert', () => {
  const raw = buildMime({ fromEmail: 'termine@matchunt.ai', fromName: 'Tim Weber über Matchunt', to: 'k@example.test', subject: 'Interview bestätigt', html: '<p>Hallo</p>', text: 'Hallo', ics: { content: buildIcs(invite), method: 'REQUEST' } }, 'seed1');
  assert(raw.includes('Content-Type: multipart/mixed; boundary="mix-seed1"'));
  assert(raw.includes('Content-Type: text/calendar; charset=UTF-8; method=REQUEST'));
  assert(raw.includes('filename="einladung.ics"'));
  assert(raw.includes(`Subject: =?UTF-8?B?${base64Utf8('Interview bestätigt')}?=`));
  assert(raw.includes('From: =?UTF-8?B?'), 'Name mit Umlaut kodiert');
  assert(encodeHeader('Plain') === 'Plain');
});

Deno.test('SMTP: Punkte am Zeilenanfang werden verdoppelt', () => {
  assert(dotStuff('a\r\n.b\r\nc') === 'a\r\n..b\r\nc');
});

Deno.test('Versand: SMTP zuerst, bei Fehler API-Ersatz', async () => {
  const calls: string[] = [];
  const env = (k: string) => (k === 'RESEND_API_KEY' ? 'key' : undefined);
  const ok = await sendInterviewMail({ fromEmail: 'termine@matchunt.ai', fromName: 'M', to: 'a@b.de', subject: 's', html: 'h', text: 't', ics: { content: 'x', method: 'REQUEST' } }, { env, smtp: async () => { calls.push('smtp'); } });
  assert(ok.sent && ok.via === 'smtp');
  const fallback = await sendInterviewMail({ fromEmail: 'termine@matchunt.ai', fromName: 'M', to: 'a@b.de', subject: 's', html: 'h', text: 't', ics: { content: 'x', method: 'REQUEST' } }, { env, smtp: async () => { throw new Error('down'); }, fetchApi: async () => { calls.push('api'); return { sent: true, via: 'api', id: '1' }; } });
  assert(fallback.sent && fallback.via === 'api');
  const noIcs = await sendInterviewMail({ fromEmail: 'termine@matchunt.ai', fromName: 'M', to: 'a@b.de', subject: 's', html: 'h', text: 't' }, { env, smtp: async () => { calls.push('smtp2'); }, fetchApi: async () => { calls.push('api2'); return { sent: true, via: 'api' }; } });
  assert(noIcs.via === 'api' && !calls.includes('smtp2'), 'ohne Einladung direkt über die API');
  const bad = await sendInterviewMail({ fromEmail: 'termine@matchunt.ai', fromName: 'M', to: 'kaputt', subject: 's', html: 'h', text: 't' }, { env });
  assert(!bad.sent);
});
