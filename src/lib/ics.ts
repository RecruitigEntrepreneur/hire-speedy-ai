/** Minimaler ICS-Export (VCALENDAR/VEVENT) für "Zum Kalender hinzufügen".
 *  Zeiten werden als UTC (Z-Suffix) geschrieben – Kalender-Apps rechnen lokal um. */

interface IcsEvent {
  title: string;
  description?: string;
  location?: string;
  url?: string;
  start: Date;
  durationMinutes: number;
}

const toIcsUtc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function buildIcs(ev: IcsEvent): string {
  const end = new Date(ev.start.getTime() + ev.durationMinutes * 60_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Matchunt//Interview//DE',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@matchunt`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(ev.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(ev.title)}`,
    ev.description ? `DESCRIPTION:${escapeText(ev.description)}` : null,
    ev.location ? `LOCATION:${escapeText(ev.location)}` : null,
    ev.url ? `URL:${ev.url}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
