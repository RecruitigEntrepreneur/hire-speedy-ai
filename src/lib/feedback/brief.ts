/**
 * KI-Briefing eines Tickets lesen und als Auftrag für Claude Code ausgeben.
 * Form wie in supabase/functions/_shared/feedback-brief.ts.
 */
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Json } from '@/integrations/supabase/types';
import {
  AREA_LABEL,
  KIND_LABEL,
  ROLE_LABEL,
  SEVERITY_LABEL,
  shortBrowser,
  ticketLabel,
  type FeedbackArea,
  type FeedbackKind,
  type FeedbackSeverity,
} from './labels';
import { describeShort, type MarkElement } from './elements';

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

export interface StoredMark {
  n?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  element?: MarkElement | null;
}
export interface StoredTrail { t: string | null; type: string | null; label: string | null }
export interface StoredNetwork { t: string | null; method: string | null; url: string | null; status: number | null; ms: number | null }
export interface StoredConsole { t: string | null; m: string | null }

const arr = <T,>(v: Json | null | undefined) => (Array.isArray(v) ? (v as unknown as T[]) : []);

export const briefOf = (v: Json | null | undefined) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as unknown as FeedbackBrief) : null;
export const marksOf = (v: Json | null | undefined) => arr<StoredMark>(v);
export const trailOf = (v: Json | null | undefined) => arr<StoredTrail>(v);
export const networkOf = (v: Json | null | undefined) => arr<StoredNetwork>(v);
export const consoleOf = (v: Json | null | undefined) => arr<StoredConsole>(v);

export const timeOf = (iso: string | null | undefined, pattern = 'HH:mm:ss') => (iso ? format(new Date(iso), pattern, { locale: de }) : '');

interface MarkdownInput {
  ticket_no: number;
  title: string | null;
  priority: string | null;
  area: string | null;
  kind: string | null;
  severity: string | null;
  reporter_role: string | null;
  page_path: string | null;
  route_pattern: string | null;
  source_file: string | null;
  message: string;
  created_at: string;
  user_agent: string | null;
  viewport: Json | null;
  app_version: string | null;
  ai_brief: Json | null;
  marks: Json;
  breadcrumbs: Json;
  network_errors: Json;
  console_errors: Json;
  criteria_done: number[];
}

/** Fertiger Auftrag für Claude Code, alles in einem Block. */
export function ticketMarkdown(row: MarkdownInput, reports: number, origin: string): string {
  const brief = briefOf(row.ai_brief);
  const ticket = ticketLabel(row.ticket_no);
  const prio = (row.priority ?? brief?.priority ?? '').toUpperCase();
  const vp = (row.viewport ?? {}) as { w?: number; h?: number };
  const out: string[] = [];
  const section = (title: string, lines: string[]) => {
    const body = lines.filter(Boolean);
    if (body.length) out.push('', `### ${title}`, ...body);
  };

  out.push(`## ${ticket}${prio ? ` (${prio})` : ''}: ${row.title ?? brief?.title ?? row.message.split('\n')[0].slice(0, 80)}`);
  out.push('');
  out.push(
    `- Bereich: ${AREA_LABEL[(row.area ?? 'other') as FeedbackArea] ?? '—'} · Seite: ${row.page_path ?? '—'}${row.route_pattern ? ` · Route: ${row.route_pattern}` : ''}`,
  );
  if (row.source_file) out.push(`- Datei: ${row.source_file}`);
  out.push(
    `- Gemeldet: ${format(new Date(row.created_at), 'dd.MM.yyyy HH:mm', { locale: de })} von ${ROLE_LABEL[row.reporter_role ?? ''] ?? '—'}${reports > 1 ? ` · ${reports} Meldungen` : ''}${
      row.kind ? ` · ${KIND_LABEL[row.kind as FeedbackKind]}` : ''
    }${row.severity ? ` · ${SEVERITY_LABEL[row.severity as FeedbackSeverity]}` : ''}`,
  );

  if (brief) {
    section('Zusammenfassung', [brief.summary]);
    section('Wirkung', [brief.impact, brief.priority_reason ? `Priorität ${brief.priority.toUpperCase()}: ${brief.priority_reason}` : '']);
    section('Ist', [brief.actual]);
    section('Soll', [brief.expected]);
    section('Schritte zum Nachstellen', brief.steps.map((s, i) => `${i + 1}. ${s}`));
  }
  section('Betroffene Stelle', [
    brief?.element ? `- Element: ${brief.element}` : '',
    ...marksOf(row.marks).map((m, i) => {
      const found = describeShort(m.element);
      const inside = m.element?.inside?.length ? ` (darin: ${m.element.inside.join(', ')})` : '';
      return found ? `- Markierung ${i + 1}: ${found}${inside}` : '';
    }),
  ]);
  if (brief) {
    section('Vermutete Ursache', [brief.suspected_cause]);
    section('Lösungsvorschlag', [brief.fix_suggestion]);
    section('Akzeptanzkriterien', brief.acceptance_criteria.map((c, i) => `- [${row.criteria_done.includes(i) ? 'x' : ' '}] ${c}`));
    section('So prüfen', brief.test_steps.map((s, i) => `${i + 1}. ${s}`));
    section('Offene Fragen', brief.open_questions.map((q) => `- ${q}`));
  }

  const network = networkOf(row.network_errors);
  const consoleErrors = consoleOf(row.console_errors);
  const trail = trailOf(row.breadcrumbs);
  section('Technik', [
    `- Browser: ${shortBrowser(row.user_agent)}${vp.w ? ` · Fenster ${vp.w}×${vp.h}` : ''} · App-Stand ${row.app_version ?? '—'}`,
    ...(network.length ? ['- Netzwerkfehler:', ...network.map((n) => `  - ${timeOf(n.t)} ${n.method} ${n.url} → ${n.status || 'keine Verbindung'} (${n.ms} ms)`)] : []),
    ...(consoleErrors.length ? ['- Konsolenfehler:', ...consoleErrors.map((c) => `  - ${timeOf(c.t)} ${c.m}`)] : []),
    ...(trail.length ? ['- Klickpfad:', ...trail.map((t, i) => `  ${i + 1}. ${timeOf(t.t)} ${t.label}`)] : []),
  ]);

  section('Original vom Nutzer', [...row.message.split('\n').map((l) => `> ${l}`), '', `Bild und Markierungen: ${origin}/admin/feedback/${ticket}`]);
  out.push(
    '',
    '---',
    'Vorgehen: Ursache erst im Code bestätigen (Datei oben), dann ändern. Datenbank-Änderung → Migration plus Eintrag in LOVABLE_DB_PROMPTS.md. Danach das Ticket auf „Gebaut, wartet auf Deploy“ setzen.',
  );
  return out.join('\n');
}
