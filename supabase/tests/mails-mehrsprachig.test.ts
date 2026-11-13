// Mehrsprachige Mails (13.11.2026): Termine, Interviews, Angebote, Verträge.
// Je Datei eine Mail: ohne Sprache der bisherige deutsche Text, mit 'sv' ein
// schwedischer Betreff, de-CH ohne ß (Namen bleiben), Links mit ?lang=sv.
import { candidateInvitation } from '../functions/_shared/interview-mails.ts';
import { kandidatBestaetigt } from '../functions/_shared/termin-mails.ts';
import { candidateOffer } from '../functions/_shared/offer-mails.ts';
import { candidateContractUnderway } from '../functions/_shared/contract-mails.ts';
import { m, pick, withLang } from '../functions/_shared/mail-i18n.ts';
import { buildIcs } from '../functions/_shared/interview-ics.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw new Error(msg); };
const eq = (a: unknown, b: unknown, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };

const START = '2026-11-20T09:00:00.000Z'; // Freitag, 10:00 deutsche Zeit

const invitation = {
  firstName: 'Anna', companyName: 'Bluewater GmbH', jobTitle: 'Data Scientist', durationMinutes: 60, slots: [START],
  link: 'https://matchunt.ai/interview/respond/tok123', message: null, interviewers: [{ name: 'Sandra Weiß', title: 'HR' }],
  recruiter: { name: 'Tim Weber', phone: null }, round: 1, allowAlternative: true, consentRequired: true,
};
const termin = {
  vorname: 'Anna', hhName: 'Tim Weiß', stelle: 'Data Scientist', startIso: START, dauer: 30, mode: 'teams' as const,
  joinUrl: null, verwaltenUrl: 'https://matchunt.ai/t/termin/tok123', mitLebenslauf: true,
};
const offer = {
  kind: 'offer' as const, candidateName: 'Anna Berg', recruiterName: 'Tim Weber', companyName: 'Bluewater GmbH', jobTitle: 'Data Scientist',
  offer: { salary: 90000, variable: null, startDate: null, responseDue: null, contractType: null, probationMonths: null, workModel: null, extras: [] },
  version: 1, message: null, url: 'https://matchunt.ai/angebot/tok123',
};
const contract = {
  firstName: 'Anna', companyName: 'Bluewater GmbH', jobTitle: 'Data Scientist', sentOn: '2026-11-10', startDate: null, salary: null, variable: null,
  recruiterName: 'Tim Weber', url: 'https://matchunt.ai/vertrag/tok123',
};

Deno.test('Interview: ohne Sprache deutsch wie bisher, sv schwedisch, Link mit ?lang=sv', () => {
  const de = candidateInvitation(invitation);
  eq(de.subject, 'Interview-Einladung: Data Scientist bei Bluewater GmbH');
  assert(de.html.includes('<html lang="de">'), 'html lang de');
  assert(de.html.includes('Bluewater GmbH möchte Sie für die Stelle <strong>Data Scientist</strong> kennenlernen.'), 'deutscher Einstieg');
  assert(de.html.includes('deutsche Zeit (MEZ)'), 'Zeitzone deutsch');
  assert(de.html.includes('href="https://matchunt.ai/interview/respond/tok123"'), 'deutscher Link ohne lang');
  eq(JSON.stringify(candidateInvitation({ ...invitation, lang: 'de' })), JSON.stringify(de), 'lang de = ohne lang');

  const sv = candidateInvitation({ ...invitation, lang: 'sv' });
  eq(sv.subject, 'Inbjudan till intervju: Data Scientist hos Bluewater GmbH');
  assert(sv.html.includes('<html lang="sv">'), 'html lang sv');
  assert(sv.html.includes('Hej Anna,'), 'Anrede sv');
  assert(sv.html.includes('href="https://matchunt.ai/interview/respond/tok123?lang=sv"'), 'Knopf mit ?lang=sv');
  assert(sv.html.includes('?slot=2026-11-20T09%3A00%3A00.000Z&amp;lang=sv'), 'Termin-Link mit &lang=sv');
  assert(sv.text.includes('fre 20 nov'), 'Datum schwedisch');

  const ch = candidateInvitation({ ...invitation, lang: 'de-CH' });
  assert(ch.html.includes('Sandra Weiß'), 'Name bleibt mit ß');
  assert(!ch.html.replace(/Weiß/g, '').includes('ß'), 'Text ohne ß');
  assert(ch.html.includes('?lang=de-CH'), 'Link mit de-CH');
});

Deno.test('Terminseite: Bestätigung an den Kandidaten', () => {
  const de = kandidatBestaetigt(termin);
  eq(de.subject, 'Dein Gespräch mit Tim Weiß am Fr 20.11., 10:00');
  assert(de.text.startsWith('Hallo Anna,\n\ndanke für deine Buchung. Wir sprechen am Freitag, 20. November 2026, 10:00–10:30 Uhr über die Stelle Data Scientist, per Microsoft Teams.'), 'deutscher Text');
  assert(de.text.includes('Verschieben oder absagen: https://matchunt.ai/t/termin/tok123\n'), 'deutscher Link ohne lang');

  const sv = kandidatBestaetigt({ ...termin, lang: 'sv' });
  assert(sv.subject.startsWith('Ditt samtal med Tim Weiß'), `sv Betreff: ${sv.subject}`);
  assert(sv.text.includes('Flytta eller avboka: https://matchunt.ai/t/termin/tok123?lang=sv'), 'Link mit ?lang=sv');

  const ch = kandidatBestaetigt({ ...termin, lang: 'de-CH' });
  assert(ch.subject.includes('Tim Weiß'), 'Name bleibt');
  assert(!ch.html.replace(/Weiß/g, '').includes('ß'), 'Text ohne ß');
});

Deno.test('Angebot: Eckdaten an den Kandidaten', () => {
  const de = candidateOffer(offer);
  eq(de.subject, 'Ihr Angebot von Bluewater GmbH: Data Scientist');
  assert(de.text.includes('Fixgehalt: 90.000 € pro Jahr'), 'Betrag deutsch');
  assert(de.text.endsWith('https://matchunt.ai/angebot/tok123'), 'deutscher Link ohne lang');

  const sv = candidateOffer({ ...offer, lang: 'sv' });
  eq(sv.subject, 'Ditt erbjudande från Bluewater GmbH: Data Scientist');
  assert(sv.text.includes('Fast lön: 90 000 € per år'), `Betrag schwedisch: ${sv.text}`);
  assert(sv.text.endsWith('https://matchunt.ai/angebot/tok123?lang=sv'), 'Link mit ?lang=sv');

  const ch = candidateOffer({ ...offer, lang: 'de-CH' });
  assert(!ch.html.includes('ß'), 'ohne ß');
});

Deno.test('Vertrag: Firma schickt selbst, Knöpfe mit Antwort und Sprache', () => {
  const de = candidateContractUnderway(contract);
  eq(de.subject, 'Ihr Arbeitsvertrag mit Bluewater GmbH ist unterwegs');
  assert(de.text.includes('Ist angekommen: https://matchunt.ai/vertrag/tok123?a=arrived'), 'deutscher Knopf');
  assert(!de.text.includes('lang='), 'deutsch ohne lang');

  const sv = candidateContractUnderway({ ...contract, lang: 'sv' });
  eq(sv.subject, 'Ditt anställningsavtal med Bluewater GmbH är på väg');
  assert(sv.text.includes('Det har kommit: https://matchunt.ai/vertrag/tok123?a=arrived&lang=sv'), 'Knopf mit &lang=sv');

  const ch = candidateContractUnderway({ ...contract, lang: 'de-CH' });
  assert(!ch.html.includes('ß'), 'ohne ß');
});

Deno.test('Bausteine: Schweizer Schreibweise nur im Text, Links, Kalender', () => {
  eq(pick('de-CH', { de: m`Grüße an ${'Herrn Weiß'}`, en: 'x', sv: 'x', nb: 'x' }), 'Grüsse an Herrn Weiß');
  eq(pick(null, { de: m`Grüße an ${'Herrn Weiß'}`, en: 'x', sv: 'x', nb: 'x' }), 'Grüße an Herrn Weiß');
  eq(pick('nb', { de: 'a', en: 'b', sv: 'c', nb: m`Hei ${'Kari'}` }), 'Hei Kari');
  eq(withLang('https://x/t/abc', 'de'), 'https://x/t/abc');
  eq(withLang('https://x/t/abc', null), 'https://x/t/abc');
  eq(withLang('https://x/t/abc', 'sv'), 'https://x/t/abc?lang=sv');
  eq(withLang('https://x/t/abc?a=1#oben', 'nb'), 'https://x/t/abc?a=1&lang=nb#oben');
  eq(withLang('https://x/t/abc?lang=en', 'sv'), 'https://x/t/abc?lang=en');

  const base = { method: 'CANCEL' as const, uid: 'u', sequence: 1, startIso: START, durationMinutes: 30, summary: 'Intervju', description: '', organizerEmail: 'a@b.c', organizerName: 'M', attendeeEmail: 'x@y.z', nowMs: 0 };
  assert(buildIcs(base).includes('SUMMARY:Abgesagt: Intervju'), 'Kalender deutsch');
  assert(buildIcs({ ...base, lang: 'sv' }).includes('SUMMARY:Inställt: Intervju'), 'Kalender schwedisch');
  assert(buildIcs({ ...base, method: 'REQUEST' }).includes('DESCRIPTION:Interview in 15 Minuten'), 'Erinnerung deutsch');
});
