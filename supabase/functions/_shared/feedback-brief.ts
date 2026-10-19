/**
 * KI-Briefing für ein Feedback-Ticket (Entscheidung 19.10.2026).
 *
 * Aus Text, Seite, Datei, Element im Rahmen, Klickpfad und Fehlern wird ein
 * Auftrag, den das Entwickler-Team ohne Rückfrage umsetzen kann. Die KI sieht
 * NUR die markierten Ausschnitte, nie das ganze Bild (bei Headhuntern stehen
 * dort oft Kandidatennamen). Personennamen gehören nicht ins Ticket.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiChat } from './ai.ts';

export interface FeedbackBrief {
  title: string;
  summary: string;
  impact: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  priority_reason: string;
  actual: string;
  expected: string;
  steps: string[];
  element: string;
  suspected_cause: string;
  fix_suggestion: string;
  acceptance_criteria: string[];
  test_steps: string[];
  open_questions: string[];
  similar: number[];
}

const SYSTEM = `Du bist Senior-Entwickler und Produktmanager bei Matchunt, einer Recruiting-Plattform
(Kunden = Unternehmen, Headhunter = Recruiter, Gäste = Unternehmen auf einem Aufnahme-Link ohne Login).
Stack: React + TypeScript + Vite + Tailwind/shadcn, Supabase (Postgres mit RLS, Edge Functions in Deno).

Aus einer Rückmeldung eines Nutzers schreibst du ein Ticket, das ein Entwickler ohne Rückfrage
umsetzen kann. Regeln:
- Deutsch, sachlich, kurz. Keine Floskeln.
- KEINE Personennamen, E-Mail-Adressen oder Firmennamen von Kandidaten, Kunden oder Headhuntern
  ins Ticket schreiben. Sprich von „der Kunde“, „der Headhunter“, „ein Kandidat“.
- Schritte zum Nachstellen aus dem Klickpfad ableiten (echte Klicks), nicht erfinden.
- Vermutete Ursache nur aus Fehlermeldungen, Netzwerkfehlern und Datei ableiten und als Vermutung
  formulieren. Wenn nichts darauf hindeutet: „Keine technischen Hinweise – erst nachstellen.“
- Akzeptanzkriterien prüfbar formulieren (3–6 Stück).
- Priorität: p0 = Kernprozess blockiert oder Datenverlust/Datenleck; p1 = wichtiger Ablauf stark
  gestört oder viele betroffen; p2 = störend, es gibt einen Umweg; p3 = Kosmetik, Idee, Lob.
- Bei Ideen und Lob: Ist = heutiger Stand, Soll = gewünschter Stand, Ursache = „Kein Fehler“.
- „similar“: nur Ticketnummern aus der mitgegebenen Liste, die sehr wahrscheinlich dasselbe Problem sind.`;

const TOOL = {
  name: 'ticket',
  description: 'Strukturiertes Entwickler-Ticket',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Ticket-Titel, max. 80 Zeichen, beschreibt das Problem' },
      summary: { type: 'string', description: '1–2 Sätze: was ist los' },
      impact: { type: 'string', description: 'Wer ist betroffen, wie schwer, welcher Ablauf' },
      priority: { type: 'string', enum: ['p0', 'p1', 'p2', 'p3'] },
      priority_reason: { type: 'string', description: 'Ein Satz Begründung' },
      actual: { type: 'string', description: 'Ist-Zustand' },
      expected: { type: 'string', description: 'Soll-Zustand' },
      steps: { type: 'array', items: { type: 'string' }, description: 'Schritte zum Nachstellen' },
      element: { type: 'string', description: 'Betroffenes Element auf der Seite' },
      suspected_cause: { type: 'string' },
      fix_suggestion: { type: 'string', description: 'Kurzer Lösungsvorschlag' },
      acceptance_criteria: { type: 'array', items: { type: 'string' } },
      test_steps: { type: 'array', items: { type: 'string' }, description: 'So prüfen' },
      open_questions: { type: 'array', items: { type: 'string' } },
      similar: { type: 'array', items: { type: 'integer' } },
    },
    required: [
      'title', 'summary', 'impact', 'priority', 'priority_reason', 'actual', 'expected', 'steps',
      'element', 'suspected_cause', 'fix_suggestion', 'acceptance_criteria', 'test_steps',
      'open_questions', 'similar',
    ],
  },
};

const KIND: Record<string, string> = { bug: 'Fehler', unclear: 'Unklar', idea: 'Idee', praise: 'Gefällt mir' };
const SEVERITY: Record<string, string> = { blocker: 'blockiert mich', annoying: 'nervt', minor: 'Kleinigkeit' };
const ROLE: Record<string, string> = { client: 'Kunde', recruiter: 'Headhunter', admin: 'Admin (intern)', guest: 'Gast auf Aufnahme-Link' };

const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.slice(0, max).trim() : '');
const list = (v: unknown, max = 8) =>
  Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, max) : [];

export async function generateBrief(
  supabase: SupabaseClient,
  row: Record<string, any>,
  crops: string[],
): Promise<{ brief: FeedbackBrief; model: string }> {
  const { data: recent } = await supabase
    .from('product_feedback')
    .select('ticket_no, title, message, page_path')
    .neq('id', row.id)
    .not('status', 'in', '(dismissed,duplicate)')
    .order('created_at', { ascending: false })
    .limit(40);
  const known = new Set((recent ?? []).map((r) => Number(r.ticket_no)));

  const marks = Array.isArray(row.marks) ? row.marks : [];
  const context = {
    rueckmeldung: row.message,
    art: row.kind ? KIND[row.kind] : null,
    wie_sehr_stoert_es: row.severity ? SEVERITY[row.severity] : null,
    absender_rolle: ROLE[row.reporter_role] ?? row.reporter_role,
    seite: row.page_path,
    seitentitel: row.page_title,
    route: row.route_pattern,
    datei: row.source_file,
    markierungen: marks.map((m: any) => ({ nr: m.n, element: m.element ?? null })),
    geschwaerzte_stellen: row.blackout_count ?? 0,
    klickpfad: row.breadcrumbs,
    netzwerkfehler: row.network_errors,
    konsolenfehler: row.console_errors,
    browser: row.user_agent,
    fenster: row.viewport,
    app_stand: row.app_version,
    bisherige_tickets: (recent ?? []).map((r) => ({
      nr: r.ticket_no,
      titel: r.title ?? String(r.message ?? '').slice(0, 80),
      seite: r.page_path,
    })),
  };

  const user = `Rückmeldung als JSON. ${crops.length
    ? `Angehängt: ${crops.length} Bildausschnitt(e) der markierten Stellen in der Reihenfolge der Markierungen.`
    : 'Keine Bildausschnitte (ganze Seite gemeldet oder kein Bild).'}

${JSON.stringify(context, null, 2)}`;

  const result = await aiChat({
    system: SYSTEM,
    user,
    images: crops.slice(0, 6),
    temperature: 0.2,
    tool: TOOL,
    signal: AbortSignal.timeout(90_000),
  });

  const a = result.toolArguments ?? {};
  const priority = ['p0', 'p1', 'p2', 'p3'].includes(a.priority as string) ? (a.priority as FeedbackBrief['priority']) : 'p2';
  const brief: FeedbackBrief = {
    title: str(a.title, 120) || String(row.message).slice(0, 80),
    summary: str(a.summary),
    impact: str(a.impact),
    priority,
    priority_reason: str(a.priority_reason, 300),
    actual: str(a.actual),
    expected: str(a.expected),
    steps: list(a.steps, 12),
    element: str(a.element, 300),
    suspected_cause: str(a.suspected_cause),
    fix_suggestion: str(a.fix_suggestion),
    acceptance_criteria: list(a.acceptance_criteria, 8),
    test_steps: list(a.test_steps, 8),
    open_questions: list(a.open_questions, 6),
    similar: Array.isArray(a.similar)
      ? [...new Set(a.similar.map(Number).filter((n) => known.has(n)))].slice(0, 5)
      : [],
  };
  return { brief, model: result.model };
}
