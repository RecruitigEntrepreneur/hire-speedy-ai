// Interview-Leitfaden für den Kunden: Fragen aus den Muss-Kriterien der Stelle
// und der Headhunter-Notiz. Die KI bekommt keine Namen oder Kontaktdaten des
// Kandidaten, nur Rolle, Erfahrung und Skills. Ohne KI (oder bei Fehlern)
// entsteht ein einfacher Leitfaden direkt aus den Muss-Kriterien.

export interface GuideItem { id: string; text: string; hint: string | null; done: boolean }
export interface GuideSection { title: string; items: GuideItem[] }
export interface Guide { sections: GuideSection[] }

export interface GuideInput {
  jobTitle: string;
  round: number;
  durationMinutes: number;
  mustHaves: string[];
  niceToHaves: string[];
  skills: string[];
  requirements: string | null;
  onsiteDays: number | null;
  recruiterNote: string | null;
  candidate: { role: string | null; experienceYears: number | null; seniority: string | null; skills: string[] };
}

const MAX_SECTIONS = 6;
const MAX_ITEMS = 12;
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const newId = () => crypto.randomUUID().slice(0, 8);

/** Werkzeug-Schema für die KI: Abschnitte mit Fragen und kurzem Hinweis. */
export const GUIDE_TOOL = {
  name: 'leitfaden',
  description: 'Interview-Leitfaden für den Interviewer auf Unternehmensseite',
  parameters: {
    type: 'object',
    properties: {
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: { text: { type: 'string', description: 'Frage in Sie-Form' }, hint: { type: 'string', description: 'Worauf achten, max. 1 Satz' } },
                required: ['text'],
              },
            },
          },
          required: ['title', 'items'],
        },
      },
    },
    required: ['sections'],
  },
};

export const GUIDE_SYSTEM = [
  'Du bereitest Interviewer eines Unternehmens auf ein Bewerbungsgespräch vor. Antworte auf Deutsch.',
  'Erstelle drei Abschnitte in dieser Reihenfolge: „Muss-Kriterien der Stelle“, „Offen aus der Headhunter-Notiz“, „Rahmen“.',
  'Je Abschnitt 2–4 konkrete, offene Fragen in Sie-Form, verhaltensbasiert („Erzählen Sie von einer Situation …“), passend zur Stelle.',
  'Zu jeder Frage ein kurzer Hinweis, worauf der Interviewer achten sollte.',
  '„Rahmen“: Arbeitsort/Vor-Ort-Tage, Start und Kündigungsfrist, Gehaltsrahmen nur allgemein – keine Zahlen erfinden.',
  'Keine Fragen zu Alter, Herkunft, Religion, Familienplanung, Schwangerschaft, Gesundheit, Behinderung oder sexueller Identität (AGG).',
  'Erfinde keine Fakten über den Kandidaten. Ist ein Abschnitt ohne Grundlage, stelle allgemeine, gute Fragen dazu.',
].join('\n');

export function guidePrompt(i: GuideInput): string {
  const lines = [
    `Stelle: ${i.jobTitle}`,
    `Gespräch: Runde ${i.round}, ${i.durationMinutes} Minuten`,
    i.mustHaves.length ? `Muss-Kriterien: ${i.mustHaves.join('; ')}` : 'Muss-Kriterien: keine angegeben',
    i.niceToHaves.length ? `Wünschenswert: ${i.niceToHaves.join('; ')}` : '',
    i.skills.length ? `Skills der Stelle: ${i.skills.join(', ')}` : '',
    i.requirements ? `Anforderungen (Auszug): ${i.requirements.slice(0, 1200)}` : '',
    i.onsiteDays != null ? `Vor-Ort-Tage pro Woche: ${i.onsiteDays}` : '',
    i.recruiterNote ? `Headhunter-Notiz: ${i.recruiterNote.slice(0, 1200)}` : 'Headhunter-Notiz: keine',
    `Kandidat (anonym): ${[i.candidate.role, i.candidate.seniority, i.candidate.experienceYears != null ? `${i.candidate.experienceYears} Jahre Erfahrung` : null].filter(Boolean).join(', ') || 'keine Angaben'}`,
    i.candidate.skills.length ? `Skills des Kandidaten: ${i.candidate.skills.slice(0, 20).join(', ')}` : '',
    i.round > 1 ? 'Es ist ein Folgegespräch: tiefer nachfragen, Fallbeispiele, Zusammenarbeit im Team.' : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Antwort der KI oder gespeicherte/bearbeitete Fassung in eine saubere Form bringen. */
export function normalizeGuide(raw: unknown, keepIds = false): Guide | null {
  const sections = Array.isArray((raw as any)?.sections) ? (raw as any).sections : null;
  if (!sections) return null;
  const out: GuideSection[] = [];
  for (const s of sections.slice(0, MAX_SECTIONS)) {
    const title = clean(s?.title, 80);
    const items: GuideItem[] = [];
    for (const it of (Array.isArray(s?.items) ? s.items : []).slice(0, MAX_ITEMS)) {
      const text = clean(it?.text, 300);
      if (!text) continue;
      const id = keepIds && typeof it?.id === 'string' && /^[\w-]{4,40}$/.test(it.id) ? it.id : newId();
      items.push({ id, text, hint: clean(it?.hint, 200) || null, done: keepIds ? it?.done === true : false });
    }
    if (title && items.length) out.push({ title, items });
  }
  return out.length ? { sections: out } : null;
}

/** Ohne KI: aus den Muss-Kriterien und dem Rahmen der Stelle. */
export function fallbackGuide(i: GuideInput): Guide {
  const item = (text: string, hint: string | null = null): GuideItem => ({ id: newId(), text, hint, done: false });
  const must = (i.mustHaves.length ? i.mustHaves : i.skills).slice(0, 4).map((k) =>
    item(`Erzählen Sie von einer Situation, in der Sie „${k}“ konkret eingesetzt haben. Was war Ihr Beitrag?`, 'Konkretes Beispiel, eigene Rolle, Ergebnis'));
  const sections: GuideSection[] = [];
  if (must.length) sections.push({ title: 'Muss-Kriterien der Stelle', items: must });
  sections.push({
    title: i.recruiterNote ? 'Offen aus der Headhunter-Notiz' : 'Motivation',
    items: [
      item('Was reizt Sie an dieser Stelle – und was müsste passen, damit Sie wechseln?', 'Wechselmotiv, Erwartungen'),
      item('Woran möchten Sie in den nächsten zwei Jahren wachsen?', null),
    ],
  });
  sections.push({
    title: 'Rahmen',
    items: [
      i.onsiteDays != null ? item(`Die Stelle sieht ${i.onsiteDays} Tage pro Woche vor Ort vor. Passt das für Sie?`) : item('Wie stellen Sie sich Arbeitsort und Homeoffice vor?'),
      item('Ab wann könnten Sie starten, und welche Kündigungsfrist haben Sie?'),
    ],
  });
  return { sections };
}
