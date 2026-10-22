// Mails der Terminseite (21.10.2026): Bestätigung an den Kandidaten, neue
// Buchung an den Headhunter, Verschieben und Absagen. Der Lebenslauf hängt
// nie an einer Mail, er liegt nur in der Akte.
import { esc, layout } from './intake-mail.ts';
import { formatBerlinDateLong, formatBerlinTime } from './interview-time.ts';
import type { MailContent } from './interview-mails.ts';
import { terminText, type Gespraechsart } from './termin-seite.ts';

const wann = (iso: string, dauer: number) => `${formatBerlinDateLong(iso)}, ${formatBerlinTime(iso)}–${formatBerlinTime(Date.parse(iso) + dauer * 60000)} Uhr`;
const artText = (mode: Gespraechsart, hhName: string) => (mode === 'teams' ? 'per Microsoft Teams' : `per Telefon, ${hhName} ruft dich an`);
const absatz = (t: string) => `<p style="margin:0 0 12px 0;">${t}</p>`;

export function kandidatBestaetigt(o: {
  vorname: string; hhName: string; stelle: string | null; startIso: string; dauer: number; mode: Gespraechsart;
  joinUrl: string | null; verwaltenUrl: string; mitLebenslauf: boolean; verschoben?: boolean;
}): MailContent {
  const zeit = wann(o.startIso, o.dauer);
  const ueber = o.stelle ? ` über die Stelle ${esc(o.stelle)}` : '';
  const subject = `${o.verschoben ? 'Verschoben: ' : ''}Dein Gespräch mit ${o.hhName} am ${terminText(o.startIso)}`;
  const body = [
    absatz(`Hallo ${esc(o.vorname)},`),
    absatz(`${o.verschoben ? 'dein Gespräch ist verschoben' : 'danke für deine Buchung'}. Wir sprechen am <b>${esc(zeit)}</b>${ueber}, ${esc(artText(o.mode, o.hhName))}.`),
    o.mitLebenslauf ? absatz('Dein Lebenslauf ist angekommen. Den Namen des Unternehmens erfährst du im Gespräch.') : absatz('Den Namen des Unternehmens erfährst du im Gespräch.'),
  ].join('');
  const html = layout({
    preheader: `${zeit} mit ${o.hhName}`,
    heading: o.verschoben ? 'Neuer Termin steht' : 'Dein Gespräch steht',
    body,
    cta: o.mode === 'teams' && o.joinUrl ? { label: 'Teams-Besprechung beitreten', url: o.joinUrl } : undefined,
    after: `Bis dann<br>${esc(o.hhName)}`,
    footnote: `Passt die Zeit nicht mehr? <a href="${esc(o.verwaltenUrl)}">Termin verschieben oder absagen</a>. Die Einladung liegt als Kalenderdatei bei.`,
  });
  const text = [
    `Hallo ${o.vorname},`, '',
    `${o.verschoben ? 'dein Gespräch ist verschoben' : 'danke für deine Buchung'}. Wir sprechen am ${zeit}${o.stelle ? ` über die Stelle ${o.stelle}` : ''}, ${artText(o.mode, o.hhName)}.`,
    o.mode === 'teams' && o.joinUrl ? `Teams: ${o.joinUrl}` : '',
    'Den Namen des Unternehmens erfährst du im Gespräch.', '',
    `Verschieben oder absagen: ${o.verwaltenUrl}`, '', `Bis dann`, o.hhName,
  ].filter((z, i, a) => z !== '' || a[i - 1] !== '').join('\n');
  return { subject, html, text };
}

export function kandidatAbgesagt(o: { vorname: string; hhName: string; startIso: string; dauer: number; neuBuchenUrl: string | null }): MailContent {
  const zeit = wann(o.startIso, o.dauer);
  const html = layout({
    preheader: `Abgesagt: ${zeit}`,
    heading: 'Termin abgesagt',
    body: absatz(`Hallo ${esc(o.vorname)},`) + absatz(`dein Gespräch mit ${esc(o.hhName)} am ${esc(zeit)} ist abgesagt. ${esc(o.hhName)} ist informiert.`),
    cta: o.neuBuchenUrl ? { label: 'Neuen Termin wählen', url: o.neuBuchenUrl } : undefined,
  });
  return { subject: `Abgesagt: dein Gespräch am ${terminText(o.startIso)}`, html, text: `Hallo ${o.vorname},\n\ndein Gespräch mit ${o.hhName} am ${zeit} ist abgesagt.${o.neuBuchenUrl ? `\n\nNeuen Termin wählen: ${o.neuBuchenUrl}` : ''}` };
}

export function headhunterNeu(o: {
  hhVorname: string; kandidat: { name: string; email: string; phone: string | null; linkedin: string | null; note: string | null };
  stelle: string | null; startIso: string; dauer: number; mode: Gespraechsart; joinUrl: string | null; imOutlook: boolean;
  akteUrl: string; herkunft: 'linkedin_beitrag' | 'terminseite'; lebenslauf: boolean; verschoben?: { vonIso: string };
}): MailContent {
  const zeit = wann(o.startIso, o.dauer);
  const k = o.kandidat;
  const kopf = o.verschoben ? `Verschoben: ${k.name}` : `Neuer Termin: ${k.name}`;
  const subject = `${kopf} · ${terminText(o.startIso)}${o.stelle ? ` · ${o.stelle}` : ''}`;
  const zeile = (l: string, w: string) => `<tr><td style="padding:3px 12px 3px 0;color:#6b7280;vertical-align:top;">${esc(l)}</td><td style="padding:3px 0;">${w}</td></tr>`;
  const tabelle = `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;margin:4px 0 14px 0;">${[
    zeile('Wann', `<b>${esc(zeit)}</b>${o.verschoben ? ` <span style="color:#6b7280;">(vorher ${esc(wann(o.verschoben.vonIso, o.dauer))})</span>` : ''}`),
    zeile('Wie', `${o.mode === 'teams' ? 'Microsoft Teams' : 'Telefon, du rufst an'} (von ${esc(k.name.split(' ')[0])} gewählt)${o.imOutlook ? ' · steht in deinem Outlook' : ''}`),
    k.phone ? zeile('Telefon', esc(k.phone)) : '',
    zeile('E-Mail', esc(k.email)),
    k.linkedin ? zeile('LinkedIn', `<a href="${esc(k.linkedin)}">Profil ansehen</a>`) : '',
  ].join('')}</table>`;
  const body = [
    absatz(`Hallo ${esc(o.hhVorname)},`),
    absatz(`${o.verschoben ? `${esc(k.name)} hat das Gespräch verschoben` : `${esc(k.name)} hat ein Gespräch mit dir gebucht`}${o.herkunft === 'linkedin_beitrag' && o.stelle ? `, über deinen LinkedIn-Beitrag zu <b>${esc(o.stelle)}</b>` : o.stelle ? ` zur Stelle <b>${esc(o.stelle)}</b>` : ''}.`),
    tabelle,
    o.lebenslauf ? absatz('Der Lebenslauf liegt in der Akte; Werdegang und Skills werden gerade daraus vorbefüllt. Bitte prüfen.') : '',
    k.note ? absatz(`<span style="color:#6b7280;">Notiz:</span> <i>„${esc(k.note)}“</i>`) : '',
  ].join('');
  const html = layout({
    preheader: `${k.name} · ${zeit}`,
    heading: o.verschoben ? 'Termin verschoben' : 'Neuer Termin über deine Terminseite',
    body,
    cta: { label: 'Akte öffnen', url: o.akteUrl },
    footnote: o.mode === 'teams' && o.joinUrl ? `Teams: <a href="${esc(o.joinUrl)}">Besprechung beitreten</a>` : undefined,
  });
  const text = [
    `Hallo ${o.hhVorname},`, '',
    `${o.verschoben ? `${k.name} hat das Gespräch verschoben` : `${k.name} hat ein Gespräch mit dir gebucht`}${o.stelle ? ` (${o.stelle})` : ''}.`,
    `Wann: ${zeit}`, `Wie: ${o.mode === 'teams' ? 'Microsoft Teams' : 'Telefon, du rufst an'}`,
    k.phone ? `Telefon: ${k.phone}` : '', `E-Mail: ${k.email}`, k.linkedin ? `LinkedIn: ${k.linkedin}` : '',
    k.note ? `Notiz: ${k.note}` : '', '', `Akte: ${o.akteUrl}`,
  ].filter(Boolean).join('\n');
  return { subject, html, text };
}

export function headhunterAbgesagt(o: { hhVorname: string; kandidat: string; stelle: string | null; startIso: string; dauer: number; grund: string | null; akteUrl: string }): MailContent {
  const zeit = wann(o.startIso, o.dauer);
  const html = layout({
    preheader: `${o.kandidat} hat abgesagt`,
    heading: 'Termin abgesagt',
    body: absatz(`Hallo ${esc(o.hhVorname)},`)
      + absatz(`<b>${esc(o.kandidat)}</b> hat das Gespräch am ${esc(zeit)}${o.stelle ? ` (${esc(o.stelle)})` : ''} abgesagt. Der Termin ist aus deinem Outlook entfernt.`)
      + (o.grund ? absatz(`<span style="color:#6b7280;">Grund:</span> <i>„${esc(o.grund)}“</i>`) : '')
      + absatz('Der Kandidat bleibt in deinem Talent Pool.'),
    cta: { label: 'Akte öffnen', url: o.akteUrl },
  });
  return { subject: `Abgesagt: ${o.kandidat} · ${terminText(o.startIso)}`, html, text: `${o.kandidat} hat das Gespräch am ${zeit} abgesagt.${o.grund ? `\nGrund: ${o.grund}` : ''}\n\nAkte: ${o.akteUrl}` };
}
