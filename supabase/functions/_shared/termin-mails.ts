// Mails der Terminseite (21.10.2026): Bestätigung an den Kandidaten, neue
// Buchung an den Headhunter, Verschieben und Absagen. Der Lebenslauf hängt
// nie an einer Mail, er liegt nur in der Akte.
//
// Mehrsprachig (13.11.2026): jede Funktion nimmt `lang` (Sprache des Empfängers,
// ohne Angabe Deutsch wie bisher). Kandidaten bekommen die Sprache ihres
// Headhunters; Links auf öffentliche Seiten tragen dann `?lang=`.
import { esc, layout } from './intake-mail.ts';
import { formatBerlinDateLong, formatBerlinTime } from './interview-time.ts';
import type { MailContent } from './interview-mails.ts';
import { terminText, type Gespraechsart } from './termin-seite.ts';
import { lang as langOf, m, withLang, type Lang } from './mail-i18n.ts';

const wann = (iso: string, dauer: number, lang?: Lang | null) => {
  const von = formatBerlinTime(iso, lang);
  const bis = formatBerlinTime(Date.parse(iso) + dauer * 60000, lang);
  return langOf(lang)({
    de: m`${formatBerlinDateLong(iso, lang)}, ${von}–${bis} Uhr`,
    en: m`${formatBerlinDateLong(iso, lang)}, ${von}–${bis}`,
    sv: m`${formatBerlinDateLong(iso, lang)}, kl. ${von}–${bis}`,
    nb: m`${formatBerlinDateLong(iso, lang)}, kl. ${von}–${bis}`,
  });
};
const artText = (mode: Gespraechsart, hhName: string, lang?: Lang | null) => (mode === 'teams'
  ? langOf(lang)({ de: 'per Microsoft Teams', en: 'on Microsoft Teams', sv: 'via Microsoft Teams', nb: 'via Microsoft Teams' })
  : langOf(lang)({ de: m`per Telefon, ${hhName} ruft dich an`, en: m`by phone, ${hhName} will call you`, sv: m`per telefon, ${hhName} ringer dig`, nb: m`på telefon, ${hhName} ringer deg` }));
const absatz = (t: string) => `<p style="margin:0 0 12px 0;">${t}</p>`;

export function kandidatBestaetigt(o: {
  vorname: string; hhName: string; stelle: string | null; startIso: string; dauer: number; mode: Gespraechsart;
  joinUrl: string | null; verwaltenUrl: string; mitLebenslauf: boolean; verschoben?: boolean;
  /** Lebenslauf angefragt und noch nicht da (05.11.2026): Link zum Nachreichen. */
  lebenslaufUrl?: string | null;
  lang?: Lang | null;
}): MailContent {
  const L = langOf(o.lang);
  const verwaltenUrl = withLang(o.verwaltenUrl, o.lang);
  const lebenslaufUrl = o.lebenslaufUrl ? withLang(o.lebenslaufUrl, o.lang) : o.lebenslaufUrl;
  const zeit = wann(o.startIso, o.dauer, o.lang);
  const ueberHtml = o.stelle ? L({ de: m` über die Stelle ${esc(o.stelle)}`, en: m` about the role ${esc(o.stelle)}`, sv: m` om tjänsten ${esc(o.stelle)}`, nb: m` om stillingen ${esc(o.stelle)}` }) : '';
  const ueberText = o.stelle ? L({ de: m` über die Stelle ${o.stelle}`, en: m` about the role ${o.stelle}`, sv: m` om tjänsten ${o.stelle}`, nb: m` om stillingen ${o.stelle}` }) : '';
  const termin = terminText(o.startIso, true, o.lang);
  const subject = o.verschoben
    ? L({ de: m`Verschoben: Dein Gespräch mit ${o.hhName} am ${termin}`, en: m`Rescheduled: your call with ${o.hhName} on ${termin}`, sv: m`Flyttat: ditt samtal med ${o.hhName} ${termin}`, nb: m`Flyttet: samtalen din med ${o.hhName} ${termin}` })
    : L({ de: m`Dein Gespräch mit ${o.hhName} am ${termin}`, en: m`Your call with ${o.hhName} on ${termin}`, sv: m`Ditt samtal med ${o.hhName} ${termin}`, nb: m`Samtalen din med ${o.hhName} ${termin}` });
  const anfang = o.verschoben
    ? L({ de: 'dein Gespräch ist verschoben', en: 'Your call has been rescheduled', sv: 'Ditt samtal har flyttats', nb: 'Samtalen din er flyttet' })
    : L({ de: 'danke für deine Buchung', en: 'Thank you for booking', sv: 'Tack för din bokning', nb: 'Takk for bookingen' });
  const hallo = (n: string) => L({ de: m`Hallo ${n},`, en: m`Hi ${n},`, sv: m`Hej ${n},`, nb: m`Hei ${n},` });
  const satz = (z: string, ueber: string, art: string) => L({
    de: m`${anfang}. Wir sprechen am ${z}${ueber}, ${art}.`,
    en: m`${anfang}. We will talk on ${z}${ueber}, ${art}.`,
    sv: m`${anfang}. Vi hörs ${z}${ueber}, ${art}.`,
    nb: m`${anfang}. Vi snakkes ${z}${ueber}, ${art}.`,
  });
  const firmaSpaeter = L({ de: 'Den Namen des Unternehmens erfährst du im Gespräch.', en: 'You will learn the name of the company during the call.', sv: 'Namnet på företaget får du veta under samtalet.', nb: 'Navnet på selskapet får du vite i samtalen.' });
  const body = [
    absatz(hallo(esc(o.vorname))),
    absatz(satz(`<b>${esc(zeit)}</b>`, ueberHtml, esc(artText(o.mode, o.hhName, o.lang)))),
    o.mitLebenslauf
      ? absatz(L({ de: 'Dein Lebenslauf ist angekommen. Den Namen des Unternehmens erfährst du im Gespräch.', en: 'Your CV has arrived. You will learn the name of the company during the call.', sv: 'Ditt CV har kommit fram. Namnet på företaget får du veta under samtalet.', nb: 'CV-en din har kommet fram. Navnet på selskapet får du vite i samtalen.' }))
      : absatz(firmaSpaeter),
    !o.mitLebenslauf && lebenslaufUrl ? absatz(L({
      de: m`${esc(o.hhName)} freut sich über deinen Lebenslauf, dann kann ${esc(o.hhName.split(' ')[0])} sich gut vorbereiten. <a href="${esc(lebenslaufUrl)}">Lebenslauf hochladen</a>`,
      en: m`${esc(o.hhName)} would appreciate your CV so ${esc(o.hhName.split(' ')[0])} can prepare well. <a href="${esc(lebenslaufUrl)}">Upload your CV</a>`,
      sv: m`${esc(o.hhName)} tar gärna emot ditt CV, så kan ${esc(o.hhName.split(' ')[0])} förbereda sig väl. <a href="${esc(lebenslaufUrl)}">Ladda upp CV</a>`,
      nb: m`${esc(o.hhName)} setter pris på CV-en din, så kan ${esc(o.hhName.split(' ')[0])} forberede seg godt. <a href="${esc(lebenslaufUrl)}">Last opp CV</a>`,
    })) : '',
  ].join('');
  const html = layout({
    lang: o.lang,
    preheader: L({ de: m`${zeit} mit ${o.hhName}`, en: m`${zeit} with ${o.hhName}`, sv: m`${zeit} med ${o.hhName}`, nb: m`${zeit} med ${o.hhName}` }),
    heading: o.verschoben
      ? L({ de: 'Neuer Termin steht', en: 'Your new time is set', sv: 'Den nya tiden är bokad', nb: 'Det nye tidspunktet er avtalt' })
      : L({ de: 'Dein Gespräch steht', en: 'Your call is booked', sv: 'Ditt samtal är bokat', nb: 'Samtalen din er booket' }),
    body,
    cta: o.mode === 'teams' && o.joinUrl ? { label: L({ de: 'Teams-Besprechung beitreten', en: 'Join Teams meeting', sv: 'Anslut till Teams-mötet', nb: 'Bli med i Teams-møtet' }), url: o.joinUrl } : undefined,
    after: L({ de: m`Bis dann<br>${esc(o.hhName)}`, en: m`Talk soon<br>${esc(o.hhName)}`, sv: m`Hörs snart<br>${esc(o.hhName)}`, nb: m`Snakkes<br>${esc(o.hhName)}` }),
    footnote: L({
      de: m`Passt die Zeit nicht mehr? <a href="${esc(verwaltenUrl)}">Termin verschieben oder absagen</a>. Die Einladung liegt als Kalenderdatei bei.`,
      en: m`Time no longer works? <a href="${esc(verwaltenUrl)}">Reschedule or cancel</a>. The invitation is attached as a calendar file.`,
      sv: m`Passar tiden inte längre? <a href="${esc(verwaltenUrl)}">Flytta eller avboka</a>. Inbjudan finns bifogad som kalenderfil.`,
      nb: m`Passer ikke tiden lenger? <a href="${esc(verwaltenUrl)}">Flytt eller avlys</a>. Invitasjonen ligger ved som kalenderfil.`,
    }),
  });
  const text = [
    hallo(o.vorname), '',
    satz(zeit, ueberText, artText(o.mode, o.hhName, o.lang)),
    o.mode === 'teams' && o.joinUrl ? `Teams: ${o.joinUrl}` : '',
    firmaSpaeter, '',
    !o.mitLebenslauf && lebenslaufUrl ? `${L({ de: 'Lebenslauf hochladen', en: 'Upload your CV', sv: 'Ladda upp CV', nb: 'Last opp CV' })}: ${lebenslaufUrl}` : '',
    `${L({ de: 'Verschieben oder absagen', en: 'Reschedule or cancel', sv: 'Flytta eller avboka', nb: 'Flytt eller avlys' })}: ${verwaltenUrl}`, '',
    L({ de: 'Bis dann', en: 'Talk soon', sv: 'Hörs snart', nb: 'Snakkes' }), o.hhName,
  ].filter((z, i, a) => z !== '' || a[i - 1] !== '').join('\n');
  return { subject, html, text };
}

/** Der Text kommt vom Headhunter; [Link] markiert die Stelle des Knopfs. */
const absaetze = (t: string) => t.trim().split(/\n{2,}/).filter(Boolean).map((x) => absatz(esc(x).replace(/\n/g, '<br>'))).join('');

/** Der Text kommt vom Headhunter und steht schon in seiner Sprache; übersetzt wird nur der Rahmen. */
export function kandidatEinladung(o: { hhName: string; text: string; url: string; erinnerung?: boolean; lang?: Lang | null }): MailContent {
  const L = langOf(o.lang);
  const url = withLang(o.url, o.lang);
  const [vor, nach = ''] = o.text.includes('[Link]') ? o.text.split('[Link]') : [o.text, ''];
  const html = layout({
    lang: o.lang,
    preheader: L({ de: m`${o.hhName} würde gern mit dir sprechen`, en: m`${o.hhName} would like to talk to you`, sv: m`${o.hhName} vill gärna prata med dig`, nb: m`${o.hhName} vil gjerne snakke med deg` }),
    heading: o.erinnerung
      ? L({ de: 'Kurze Erinnerung', en: 'A quick reminder', sv: 'En kort påminnelse', nb: 'En kort påminnelse' })
      : L({ de: 'Einladung zum Gespräch', en: 'Invitation to a call', sv: 'Inbjudan till ett samtal', nb: 'Invitasjon til en samtale' }),
    body: absaetze(vor),
    cta: { label: L({ de: 'Zeit aussuchen', en: 'Choose a time', sv: 'Välj en tid', nb: 'Velg et tidspunkt' }), url },
    after: absaetze(nach),
    footnote: L({ de: 'Dieser Link ist nur für dich. Antworte einfach auf diese Mail, wenn du Fragen hast.', en: 'This link is just for you. If you have any questions, simply reply to this email.', sv: 'Länken är bara till dig. Har du frågor är det bara att svara på det här mejlet.', nb: 'Lenken er bare til deg. Har du spørsmål, er det bare å svare på denne e-posten.' }),
  });
  return {
    subject: o.erinnerung
      ? L({ de: m`Erinnerung: Gespräch mit ${o.hhName}`, en: m`Reminder: call with ${o.hhName}`, sv: m`Påminnelse: samtal med ${o.hhName}`, nb: m`Påminnelse: samtale med ${o.hhName}` })
      : L({ de: m`${o.hhName}: kurzes Gespräch?`, en: m`${o.hhName}: a quick call?`, sv: m`${o.hhName}: ett kort samtal?`, nb: m`${o.hhName}: en kort samtale?` }),
    html,
    text: `${o.text.includes('[Link]') ? o.text.replace('[Link]', url) : `${o.text}\n\n${url}`}\n`,
  };
}

/** Lebenslauf anfragen (05.11.2026): Text vom Headhunter, [Link] wird zum Knopf. */
export function lebenslaufAnfrage(o: { hhName: string; text: string; url: string; erinnerung?: boolean; lang?: Lang | null }): MailContent {
  const L = langOf(o.lang);
  const url = withLang(o.url, o.lang);
  const [vor, nach = ''] = o.text.includes('[Link]') ? o.text.split('[Link]') : [o.text, ''];
  const html = layout({
    lang: o.lang,
    preheader: L({ de: m`${o.hhName} bittet um deinen Lebenslauf`, en: m`${o.hhName} is asking for your CV`, sv: m`${o.hhName} ber om ditt CV`, nb: m`${o.hhName} ber om CV-en din` }),
    heading: o.erinnerung
      ? L({ de: 'Kurze Erinnerung', en: 'A quick reminder', sv: 'En kort påminnelse', nb: 'En kort påminnelse' })
      : L({ de: 'Dein Lebenslauf', en: 'Your CV', sv: 'Ditt CV', nb: 'CV-en din' }),
    body: absaetze(vor),
    cta: { label: L({ de: 'Lebenslauf hochladen', en: 'Upload your CV', sv: 'Ladda upp CV', nb: 'Last opp CV' }), url },
    after: absaetze(nach),
    footnote: L({ de: 'Dieser Link ist nur für dich und funktioniert auch auf dem Handy. Antworte einfach auf diese Mail, wenn du Fragen hast.', en: 'This link is just for you and also works on your phone. If you have any questions, simply reply to this email.', sv: 'Länken är bara till dig och fungerar även i mobilen. Har du frågor är det bara att svara på det här mejlet.', nb: 'Lenken er bare til deg og fungerer også på mobilen. Har du spørsmål, er det bare å svare på denne e-posten.' }),
  });
  return {
    subject: o.erinnerung
      ? L({ de: m`Kurze Erinnerung: dein Lebenslauf für ${o.hhName}`, en: m`A quick reminder: your CV for ${o.hhName}`, sv: m`En kort påminnelse: ditt CV till ${o.hhName}`, nb: m`En kort påminnelse: CV-en din til ${o.hhName}` })
      : L({ de: m`${o.hhName}: dein Lebenslauf`, en: m`${o.hhName}: your CV`, sv: m`${o.hhName}: ditt CV`, nb: m`${o.hhName}: CV-en din` }),
    html,
    text: `${o.text.includes('[Link]') ? o.text.replace('[Link]', url) : `${o.text}\n\n${url}`}\n`,
  };
}

export function kandidatAbgesagt(o: { vorname: string; hhName: string; startIso: string; dauer: number; neuBuchenUrl: string | null; lang?: Lang | null }): MailContent {
  const L = langOf(o.lang);
  const neu = o.neuBuchenUrl ? withLang(o.neuBuchenUrl, o.lang) : null;
  const zeit = wann(o.startIso, o.dauer, o.lang);
  const hallo = (n: string) => L({ de: m`Hallo ${n},`, en: m`Hi ${n},`, sv: m`Hej ${n},`, nb: m`Hei ${n},` });
  const satz = (hh: string, z: string) => L({
    de: m`dein Gespräch mit ${hh} am ${z} ist abgesagt.`,
    en: m`Your call with ${hh} on ${z} has been cancelled.`,
    sv: m`Ditt samtal med ${hh} ${z} är avbokat.`,
    nb: m`Samtalen din med ${hh} ${z} er avlyst.`,
  });
  const html = layout({
    lang: o.lang,
    preheader: L({ de: m`Abgesagt: ${zeit}`, en: m`Cancelled: ${zeit}`, sv: m`Avbokat: ${zeit}`, nb: m`Avlyst: ${zeit}` }),
    heading: L({ de: 'Termin abgesagt', en: 'Call cancelled', sv: 'Samtalet är avbokat', nb: 'Samtalen er avlyst' }),
    body: absatz(hallo(esc(o.vorname))) + absatz(`${satz(esc(o.hhName), esc(zeit))} ${L({ de: m`${esc(o.hhName)} ist informiert.`, en: m`${esc(o.hhName)} has been informed.`, sv: m`${esc(o.hhName)} har fått besked.`, nb: m`${esc(o.hhName)} har fått beskjed.` })}`),
    cta: neu ? { label: L({ de: 'Neuen Termin wählen', en: 'Choose a new time', sv: 'Välj en ny tid', nb: 'Velg et nytt tidspunkt' }), url: neu } : undefined,
  });
  const termin = terminText(o.startIso, true, o.lang);
  return {
    subject: L({ de: m`Abgesagt: dein Gespräch am ${termin}`, en: m`Cancelled: your call on ${termin}`, sv: m`Avbokat: ditt samtal ${termin}`, nb: m`Avlyst: samtalen din ${termin}` }),
    html,
    text: `${hallo(o.vorname)}\n\n${satz(o.hhName, zeit)}${neu ? `\n\n${L({ de: 'Neuen Termin wählen', en: 'Choose a new time', sv: 'Välj en ny tid', nb: 'Velg et nytt tidspunkt' })}: ${neu}` : ''}`,
  };
}

export function headhunterNeu(o: {
  hhVorname: string; kandidat: { name: string; email: string; phone: string | null; linkedin: string | null; note: string | null };
  stelle: string | null; startIso: string; dauer: number; mode: Gespraechsart; joinUrl: string | null; imOutlook: boolean;
  akteUrl: string; herkunft: 'linkedin_beitrag' | 'terminseite'; lebenslauf: boolean; verschoben?: { vonIso: string };
  lang?: Lang | null;
}): MailContent {
  const L = langOf(o.lang);
  const zeit = wann(o.startIso, o.dauer, o.lang);
  const k = o.kandidat;
  const kopf = o.verschoben
    ? L({ de: m`Verschoben: ${k.name}`, en: m`Rescheduled: ${k.name}`, sv: m`Flyttat: ${k.name}`, nb: m`Flyttet: ${k.name}` })
    : L({ de: m`Neuer Termin: ${k.name}`, en: m`New booking: ${k.name}`, sv: m`Ny bokning: ${k.name}`, nb: m`Ny booking: ${k.name}` });
  const subject = `${kopf} · ${terminText(o.startIso, true, o.lang)}${o.stelle ? ` · ${o.stelle}` : ''}`;
  const zeile = (l: string, w: string) => `<tr><td style="padding:3px 12px 3px 0;color:#6b7280;vertical-align:top;">${esc(l)}</td><td style="padding:3px 0;">${w}</td></tr>`;
  const telefonDu = L({ de: 'Telefon, du rufst an', en: 'Phone, you call', sv: 'Telefon, du ringer', nb: 'Telefon, du ringer' });
  const wie = o.mode === 'teams' ? 'Microsoft Teams' : telefonDu;
  const lWann = L({ de: 'Wann', en: 'When', sv: 'När', nb: 'Når' });
  const lWie = L({ de: 'Wie', en: 'How', sv: 'Hur', nb: 'Hvordan' });
  const lTelefon = L({ de: 'Telefon', en: 'Phone', sv: 'Telefon', nb: 'Telefon' });
  const lMail = L({ de: 'E-Mail', en: 'Email', sv: 'E-post', nb: 'E-post' });
  const lNotiz = L({ de: 'Notiz', en: 'Note', sv: 'Anteckning', nb: 'Notat' });
  const tabelle = `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;margin:4px 0 14px 0;">${[
    zeile(lWann, `<b>${esc(zeit)}</b>${o.verschoben ? ` <span style="color:#6b7280;">(${L({ de: m`vorher ${esc(wann(o.verschoben.vonIso, o.dauer, o.lang))}`, en: m`previously ${esc(wann(o.verschoben.vonIso, o.dauer, o.lang))}`, sv: m`tidigare ${esc(wann(o.verschoben.vonIso, o.dauer, o.lang))}`, nb: m`tidligere ${esc(wann(o.verschoben.vonIso, o.dauer, o.lang))}` })})</span>` : ''}`),
    zeile(lWie, `${wie} ${L({ de: m`(von ${esc(k.name.split(' ')[0])} gewählt)`, en: m`(chosen by ${esc(k.name.split(' ')[0])})`, sv: m`(valt av ${esc(k.name.split(' ')[0])})`, nb: m`(valgt av ${esc(k.name.split(' ')[0])})` })}${o.imOutlook ? L({ de: ' · steht in deinem Outlook', en: ' · in your Outlook', sv: ' · finns i din Outlook', nb: ' · ligger i Outlook' }) : ''}`),
    k.phone ? zeile(lTelefon, esc(k.phone)) : '',
    zeile(lMail, esc(k.email)),
    k.linkedin ? zeile('LinkedIn', `<a href="${esc(k.linkedin)}">${L({ de: 'Profil ansehen', en: 'View profile', sv: 'Visa profil', nb: 'Se profil' })}</a>`) : '',
  ].join('')}</table>`;
  const gebucht = (n: string) => o.verschoben
    ? L({ de: m`${n} hat das Gespräch verschoben`, en: m`${n} has rescheduled the call`, sv: m`${n} har flyttat samtalet`, nb: m`${n} har flyttet samtalen` })
    : L({ de: m`${n} hat ein Gespräch mit dir gebucht`, en: m`${n} has booked a call with you`, sv: m`${n} har bokat ett samtal med dig`, nb: m`${n} har booket en samtale med deg` });
  const woher = o.herkunft === 'linkedin_beitrag' && o.stelle
    ? L({ de: m`, über deinen LinkedIn-Beitrag zu <b>${esc(o.stelle)}</b>`, en: m`, via your LinkedIn post about <b>${esc(o.stelle)}</b>`, sv: m`, via ditt LinkedIn-inlägg om <b>${esc(o.stelle)}</b>`, nb: m`, via LinkedIn-innlegget ditt om <b>${esc(o.stelle)}</b>` })
    : o.stelle ? L({ de: m` zur Stelle <b>${esc(o.stelle)}</b>`, en: m` for the role <b>${esc(o.stelle)}</b>`, sv: m` för tjänsten <b>${esc(o.stelle)}</b>`, nb: m` for stillingen <b>${esc(o.stelle)}</b>` }) : '';
  const hallo = (n: string) => L({ de: m`Hallo ${n},`, en: m`Hi ${n},`, sv: m`Hej ${n},`, nb: m`Hei ${n},` });
  const body = [
    absatz(hallo(esc(o.hhVorname))),
    absatz(`${gebucht(esc(k.name))}${woher}.`),
    tabelle,
    o.lebenslauf ? absatz(L({ de: 'Der Lebenslauf liegt in der Akte; Werdegang und Skills werden gerade daraus vorbefüllt. Bitte prüfen.', en: 'The CV is in the candidate file; career history and skills are being pre-filled from it right now. Please check them.', sv: 'CV:t ligger i kandidatakten; karriär och kompetenser fylls i från det just nu. Kontrollera gärna.', nb: 'CV-en ligger i kandidatmappen; karriere og ferdigheter fylles ut fra den akkurat nå. Sjekk dem gjerne.' })) : '',
    k.note ? absatz(`<span style="color:#6b7280;">${lNotiz}:</span> <i>„${esc(k.note)}“</i>`) : '',
  ].join('');
  const html = layout({
    lang: o.lang,
    preheader: `${k.name} · ${zeit}`,
    heading: o.verschoben
      ? L({ de: 'Termin verschoben', en: 'Call rescheduled', sv: 'Samtalet har flyttats', nb: 'Samtalen er flyttet' })
      : L({ de: 'Neuer Termin über deine Terminseite', en: 'New booking via your booking page', sv: 'Ny bokning via din bokningssida', nb: 'Ny booking via bookingsiden din' }),
    body,
    cta: { label: L({ de: 'Akte öffnen', en: 'Open candidate file', sv: 'Öppna kandidatakten', nb: 'Åpne kandidatmappen' }), url: o.akteUrl },
    footnote: o.mode === 'teams' && o.joinUrl ? `Teams: <a href="${esc(o.joinUrl)}">${L({ de: 'Besprechung beitreten', en: 'Join meeting', sv: 'Anslut till mötet', nb: 'Bli med i møtet' })}</a>` : undefined,
  });
  const text = [
    hallo(o.hhVorname), '',
    `${gebucht(k.name)}${o.stelle ? ` (${o.stelle})` : ''}.`,
    `${lWann}: ${zeit}`, `${lWie}: ${wie}`,
    k.phone ? `${lTelefon}: ${k.phone}` : '', `${lMail}: ${k.email}`, k.linkedin ? `LinkedIn: ${k.linkedin}` : '',
    k.note ? `${lNotiz}: ${k.note}` : '', '', `${L({ de: 'Akte', en: 'Candidate file', sv: 'Kandidatakt', nb: 'Kandidatmappe' })}: ${o.akteUrl}`,
  ].filter(Boolean).join('\n');
  return { subject, html, text };
}

export function headhunterAbgesagt(o: { hhVorname: string; kandidat: string; stelle: string | null; startIso: string; dauer: number; grund: string | null; akteUrl: string; lang?: Lang | null }): MailContent {
  const L = langOf(o.lang);
  const zeit = wann(o.startIso, o.dauer, o.lang);
  const lGrund = L({ de: 'Grund', en: 'Reason', sv: 'Anledning', nb: 'Grunn' });
  const satz = (k: string, z: string, s: string) => L({
    de: m`${k} hat das Gespräch am ${z}${s} abgesagt.`,
    en: m`${k} has cancelled the call on ${z}${s}.`,
    sv: m`${k} har avbokat samtalet ${z}${s}.`,
    nb: m`${k} har avlyst samtalen ${z}${s}.`,
  });
  const html = layout({
    lang: o.lang,
    preheader: L({ de: m`${o.kandidat} hat abgesagt`, en: m`${o.kandidat} has cancelled`, sv: m`${o.kandidat} har avbokat`, nb: m`${o.kandidat} har avlyst` }),
    heading: L({ de: 'Termin abgesagt', en: 'Call cancelled', sv: 'Samtalet är avbokat', nb: 'Samtalen er avlyst' }),
    body: absatz(L({ de: m`Hallo ${esc(o.hhVorname)},`, en: m`Hi ${esc(o.hhVorname)},`, sv: m`Hej ${esc(o.hhVorname)},`, nb: m`Hei ${esc(o.hhVorname)},` }))
      + absatz(`${satz(`<b>${esc(o.kandidat)}</b>`, esc(zeit), o.stelle ? ` (${esc(o.stelle)})` : '')} ${L({ de: 'Der Termin ist aus deinem Outlook entfernt.', en: 'The appointment has been removed from your Outlook.', sv: 'Mötet har tagits bort från din Outlook.', nb: 'Avtalen er fjernet fra Outlook.' })}`)
      + (o.grund ? absatz(`<span style="color:#6b7280;">${lGrund}:</span> <i>„${esc(o.grund)}“</i>`) : '')
      + absatz(L({ de: 'Der Kandidat bleibt in deinem Talent Pool.', en: 'The candidate stays in your talent pool.', sv: 'Kandidaten finns kvar i din talangpool.', nb: 'Kandidaten blir værende i talentpoolen din.' })),
    cta: { label: L({ de: 'Akte öffnen', en: 'Open candidate file', sv: 'Öppna kandidatakten', nb: 'Åpne kandidatmappen' }), url: o.akteUrl },
  });
  return {
    subject: L({ de: m`Abgesagt: ${o.kandidat} · ${terminText(o.startIso, true, o.lang)}`, en: m`Cancelled: ${o.kandidat} · ${terminText(o.startIso, true, o.lang)}`, sv: m`Avbokat: ${o.kandidat} · ${terminText(o.startIso, true, o.lang)}`, nb: m`Avlyst: ${o.kandidat} · ${terminText(o.startIso, true, o.lang)}` }),
    html,
    text: `${satz(o.kandidat, zeit, '')}${o.grund ? `\n${lGrund}: ${o.grund}` : ''}\n\n${L({ de: 'Akte', en: 'Candidate file', sv: 'Kandidatakt', nb: 'Kandidatmappe' })}: ${o.akteUrl}`,
  };
}
