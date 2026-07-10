import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react';

export type JobType = 'full-time' | 'freelance';
export type Answer = { value?: string | string[]; unknown?: boolean };
export type Answers = Record<string, Answer>;

/** Job-Kontext, den die KI bereits erkannt hat – zum Vorbefüllen/Überspringen. */
export interface BriefBuilt {
  remote_type?: string;
  must_haves?: string[];
  vacancyReason?: string | null;
  reportsTo?: string | null;
  hiringUrgency?: string | null;
  remoteDays?: number | null;
  usps?: string[];
}

/** Aus den bereits extrahierten Anzeige-Daten Antworten vorbefüllen, damit das
 *  Briefing nur die echten Lücken fragt ("je besser die Anzeige, desto weniger Fragen"). */
export function prefillFromBuilt(b: BriefBuilt): Answers {
  const a: Answers = {};
  const txt = (b.must_haves || []).join(' ').toLowerCase();
  const de = /deutsch|german/.test(txt);
  const en = /englisch|english/.test(txt);
  if (de && en) a.language = { value: ['Deutsch + Englisch'] };
  else if (en) a.language = { value: ['Nur Englisch'] };
  else if (de) a.language = { value: ['Deutsch C1'] };
  if (b.vacancyReason) a.why_open = { value: b.vacancyReason };
  if (b.reportsTo) a.manager = { value: b.reportsTo };
  if (b.hiringUrgency === 'urgent' || b.hiringUrgency === 'hot') a.start = { value: 'ASAP' };
  if (typeof b.remoteDays === 'number') {
    const onsite = Math.max(0, 5 - b.remoteDays);
    a.onsite_days = { value: onsite === 0 ? '0 (Remote)' : onsite === 1 ? '1 Tag' : onsite >= 4 ? '4–5 Tage' : `${onsite} Tage` };
  }
  if (b.usps && b.usps.length) a.x_factor = { value: b.usps[0] };
  return a;
}

interface Question {
  id: string;
  chapter: string;
  text: string;
  why?: string;
  chips: string[];
  multi?: boolean;
  freeText?: boolean;
  weight: number;
  appliesTo?: JobType | 'all';
  showIf?: (a: Answers) => boolean;
}

const WN = 'Weiß ich nicht';

const CHAPTERS = ['Kontext', 'Aufgaben', 'Profil', 'Harte K.O.', 'Geld & Flex', 'Arbeitsmodell', 'Sell', 'Prozess', 'Sourcing', 'Sichtbarkeit'];

const QUESTIONS: Question[] = [
  // ── Kontext ───────────────────────────────────────────────
  {
    id: 'why_open', chapter: 'Kontext', weight: 3,
    text: 'Warum ist die Stelle offen?',
    why: 'Bestimmt Story, Dringlichkeit und Risiko-Profil.',
    chips: ['Wachstum / neu', 'Nachbesetzung', 'Ablösung', 'Neue Funktion', 'Elternzeit-Vertretung'],
  },
  {
    id: 'predecessor', chapter: 'Kontext', weight: 2,
    text: 'Was ist mit dem/der Vorgänger:in passiert?',
    why: 'Das stärkste Signal dafür, was den perfekten Nachfolger ausmacht.',
    chips: ['Intern befördert', 'Zum Wettbewerber', 'Performance', 'Rolle ist gewachsen', 'Ausgebrannt'],
    freeText: true,
    showIf: (a) => ['Nachbesetzung', 'Ablösung'].includes(a.why_open?.value as string),
  },
  {
    id: 'team_setup', chapter: 'Kontext', weight: 2,
    text: 'Wie sieht das direkte Team aus (Größe, Seniorität)?',
    why: 'Einzelkämpfer-Rolle vs. großes Team = zwei völlig verschiedene Kandidatenprofile.',
    chips: ['Einzelkämpfer:in', '2–5 Kolleg:innen', 'Größeres Team (6+)', 'Baut eigenes Team auf'],
    freeText: true,
  },
  // ── Aufgaben ──────────────────────────────────────────────
  {
    id: 'core_tasks', chapter: 'Aufgaben', weight: 3,
    text: 'Welche 3 Aufgaben füllen den Großteil der Arbeitswoche?',
    why: 'Titel sagen nichts — die tatsächlichen Aufgaben definieren das Suchprofil.',
    chips: ['Operative Umsetzung', 'Projekte leiten', 'Konzeption & Strategie', 'Stakeholder & Beratung', 'Team führen', 'Analyse & Reporting'],
    multi: true, freeText: true,
  },
  {
    id: 'first_project', chapter: 'Aufgaben', weight: 3,
    text: 'Woran arbeitet die Person in den ersten 3 Monaten konkret?',
    why: 'Das konkrete Einstiegsprojekt ist das stärkste Screening- und Pitch-Material.',
    chips: ['Laufendes Geschäft übernehmen', 'Konkretes Projekt (beschreiben)', 'Etwas von Grund auf aufbauen', 'Aufräumen & konsolidieren'],
    freeText: true,
  },
  {
    id: 'hands_on_split', chapter: 'Aufgaben', weight: 2,
    text: 'Wie viel macht die Person selbst vs. steuert andere?',
    why: 'Der häufigste Fehlgriff: Macher eingestellt, Steuerer gebraucht — oder umgekehrt.',
    chips: ['100 % hands-on', '~70 % selbst / 30 % steuern', '~50/50', 'Überwiegend führen & steuern'],
  },
  {
    id: 'success_30d', chapter: 'Aufgaben', weight: 1,
    text: 'Erste 30 Tage: Was muss die Person verstanden oder stabilisiert haben?',
    why: 'Definiert die Einarbeitung — und was ein Kandidat sofort können muss vs. lernen darf.',
    chips: ['Prozesse & Systeme verstehen', 'Stakeholder kennenlernen', 'Akutes Problem stabilisieren', 'Direkt produktiv liefern'],
    freeText: true,
  },
  {
    id: 'deliverable_90d', chapter: 'Aufgaben', weight: 2,
    text: 'Nach 90 Tagen: Was muss konkret geliefert oder übernommen sein?',
    why: 'Das messbare 90-Tage-Deliverable trennt Kandidaten, die reden, von denen, die liefern.',
    chips: ['Laufendes Geschäft voll übernommen', 'Erstes Projekt geliefert', 'Erste Verbesserung messbar', 'Team eingespielt'],
    freeText: true,
  },
  {
    id: 'success_12m', chapter: 'Aufgaben', weight: 3,
    text: 'Woran messen Sie nach 12 Monaten, dass die Besetzung ein Erfolg war?',
    why: 'Die Erfolgsdefinition ist das präziseste Anforderungsprofil, das es gibt.',
    chips: ['Konkrete Kennzahl erreicht', 'Projekt live & stabil', 'Team steht & liefert', 'Führung spürbar entlastet'],
    freeText: true,
  },
  // ── Profil ────────────────────────────────────────────────
  {
    id: 'skill_depth', chapter: 'Profil', weight: 3,
    text: 'Zum wichtigsten Muss-Skill: Wie tief muss er sitzen — was muss die Person damit nachweislich gemacht haben?',
    why: '„Kennt X" und „hat X eingeführt" sind zwei komplett verschiedene Suchen.',
    chips: ['Täglich produktiv genutzt', 'Projekte damit verantwortet', 'Selbst eingeführt / aufgebaut', 'Solide Grundkenntnisse reichen'],
    freeText: true,
  },
  {
    id: 'top_criterion', chapter: 'Profil', weight: 3,
    text: 'Das #1-Kriterium: Woran scheitert ein:e Kandidat:in trotz Top-CV am ehesten?',
    why: 'Anker für Screening und Pitch.',
    chips: ['Fachliche Tiefe', 'Führungserfahrung', 'Branchenkenntnis', 'Kulturfit', 'Sprachniveau'],
    freeText: true,
  },
  {
    id: 'anti_persona', chapter: 'Profil', weight: 2,
    text: 'Wer würde hier trotz starkem Lebenslauf scheitern?',
    why: 'Negativ-Kriterien sind oft schärfer als positive.',
    chips: ['Braucht viel Struktur', 'Reiner Konzern-Hintergrund', 'Kann nicht eigenständig liefern', 'Zu spezialisiert'],
    freeText: true,
  },
  // ── Harte K.O. ────────────────────────────────────────────
  {
    id: 'language', chapter: 'Harte K.O.', weight: 2,
    text: 'Welche Sprache(n) auf welchem Niveau sind Pflicht?',
    why: 'Häufig unterspezifiziert — verbrennt sonst jede Shortlist.',
    chips: ['Deutsch C1', 'Deutsch B2', 'Englisch fließend', 'Deutsch + Englisch', 'Nur Englisch'],
    multi: true,
  },
  {
    id: 'work_permit', chapter: 'Harte K.O.', weight: 2,
    text: 'Muss eine Arbeitserlaubnis bereits vorliegen?',
    chips: ['Ja, muss vorhanden sein', 'EU-Bürger:innen', 'Visum-Sponsoring möglich', 'Remote / egal'],
  },
  {
    id: 'exclusion_criteria', chapter: 'Harte K.O.', weight: 2,
    text: 'Gibt es echte Ausschlusskriterien — was disqualifiziert einen Kandidaten sofort?',
    why: 'Nur berufsbezogene Kriterien: Alters-, Geschlechts- oder Herkunftsbezug ist unzulässig und wird nicht weitergegeben.',
    chips: ['Gehalt über Budget', 'Wettbewerber-Konflikt', 'Reisebereitschaft fehlt', 'Zertifizierung fehlt', 'Keine'],
    multi: true, freeText: true,
  },
  // ── Geld & Flex ───────────────────────────────────────────
  {
    id: 'salary_ceiling', chapter: 'Geld & Flex', weight: 3, appliesTo: 'full-time',
    text: 'Für eine:n Top-Kandidat:in — wie weit geht das Gehalt nach oben?',
    why: 'Die echte Decke ist das Closing-Budget des Recruiters.',
    chips: ['Fix beim Maximum', '+5–10 % möglich', 'Verhandelbar', 'Marktrate (beraten Sie uns)'],
  },
  {
    id: 'day_rate', chapter: 'Geld & Flex', weight: 3, appliesTo: 'freelance',
    text: 'In welcher Tagessatz-Spanne bewegen wir uns?',
    chips: ['bis 600 €', '600–800 €', '800–1000 €', '> 1000 €', 'Marktrate'],
  },
  {
    id: 'flex', chapter: 'Geld & Flex', weight: 2,
    text: 'Was ist über das Gehalt hinaus verhandelbar?',
    chips: ['Sign-on-Bonus', 'Titel / Level', 'Mehr Remote-Tage', 'Früherer Start', 'Equity', 'Nichts'],
    multi: true,
  },
  // ── Arbeitsmodell ─────────────────────────────────────────
  {
    id: 'onsite_days', chapter: 'Arbeitsmodell', weight: 2, appliesTo: 'full-time',
    text: 'Wie viele Tage pro Woche vor Ort (fix)?',
    chips: ['0 (Remote)', '1 Tag', '2 Tage', '3 Tage', '4–5 Tage', 'Flexibel'],
  },
  {
    id: 'start', chapter: 'Arbeitsmodell', weight: 2,
    text: 'Wann soll die Person starten?',
    chips: ['ASAP', 'in 1 Monat', 'in 1–3 Monaten', 'Flexibel (richtige Person)'],
  },
  {
    id: 'notice', chapter: 'Arbeitsmodell', weight: 1, appliesTo: 'full-time',
    text: 'Welche Kündigungsfrist können Sie für den/die Richtige:n abwarten?',
    chips: ['Nur sofort', 'bis 1 Monat', 'bis 3 Monate', 'bis 6 Monate'],
  },
  {
    id: 'duration', chapter: 'Arbeitsmodell', weight: 2, appliesTo: 'freelance',
    text: 'Wie lang ist das Projekt?',
    chips: ['3 Monate', '6 Monate', '12 Monate', 'Open-ended'],
  },
  {
    id: 'utilization', chapter: 'Arbeitsmodell', weight: 2, appliesTo: 'freelance',
    text: 'Welche Auslastung benötigen Sie?',
    chips: ['Vollzeit (5 Tg/Wo)', '3 Tage/Woche', '~10 Tage/Monat', 'Flexibel'],
  },
  {
    id: 'extension', chapter: 'Arbeitsmodell', weight: 1, appliesTo: 'freelance',
    text: 'Wie wahrscheinlich ist eine Verlängerung?',
    chips: ['Wahrscheinlich', 'Möglich', 'Fix keine', 'Könnte in Festanstellung übergehen'],
  },
  // ── Sell ──────────────────────────────────────────────────
  {
    id: 'x_factor', chapter: 'Sell', weight: 3,
    text: 'Was macht diese Rolle besonders — der eine überzeugende Grund?',
    why: 'Wird zur (anonymen) Outreach-Story.',
    chips: ['Greenfield / Autonomie', 'Wachstum / Equity', 'Mission / Impact', 'Top-Team zum Lernen', 'Einmaliger Scope'],
    freeText: true,
  },
  {
    id: 'manager', chapter: 'Sell', weight: 2,
    text: 'An wen berichtet die Rolle — Hintergrund und Stil?',
    why: 'Kandidaten wählen Manager, nicht Org-Charts (anonym pitchbar).',
    chips: ['An Gründer / C-Level', 'Erfahrene:r Lead (ex-Top-Firma)', 'Coaching-orientiert', 'Hands-off'],
    freeText: true,
  },
  {
    id: 'honest_downside', chapter: 'Sell', weight: 2,
    text: 'Ehrlich: Was ist die Schattenseite der Rolle, die Kandidat:innen früh wissen sollten?',
    why: 'Ehrlichkeit im Pitch verhindert Absprünge nach dem ersten Gespräch — bleibt recruiter-intern.',
    chips: ['Viel Legacy / Altsysteme', 'Hohe Taktung', 'Wenig Struktur (Aufbau)', 'Politik / viele Stakeholder', 'Gibt keine nennenswerte'],
    freeText: true,
  },
  // ── Prozess ───────────────────────────────────────────────
  {
    id: 'interview_process', chapter: 'Prozess', weight: 2,
    text: 'Wie sieht Ihr Interview-Prozess aus (Runden, Beteiligte, Dauer)?',
    why: 'Schnelle, klare Prozesse gewinnen Kandidaten — langsame verlieren sie an den Wettbewerb.',
    chips: ['2 Runden, unter 2 Wochen', '2 Runden + Case/Aufgabe', '3+ Runden', 'Noch nicht definiert'],
    freeText: true,
  },
  {
    id: 'decision_maker', chapter: 'Prozess', weight: 1,
    text: 'Wer trifft am Ende die Einstellungsentscheidung?',
    chips: ['Fachbereich allein', 'Fachbereich + HR', 'Geschäftsführung', 'Gremium'],
  },
  // ── Sourcing ──────────────────────────────────────────────
  {
    id: 'source_roles', chapter: 'Sourcing', weight: 2,
    text: 'Aus welcher Rolle heraus wechselt der Ideal-Kandidat zu Ihnen?',
    why: 'Definiert die Suchanfrage der Recruiter wortwörtlich.',
    chips: ['Gleiche Rolle woanders', 'Nummer 2 will Nummer 1 werden', 'Aus Beratung in die Industrie', 'Ambitionierte:r Aufsteiger:in'],
    freeText: true,
  },
  {
    id: 'target_companies', chapter: 'Sourcing', weight: 2,
    text: 'Wo arbeiten genau diese Leute heute? (Ziel-Firmen)',
    why: 'Schnellster Weg zur Shortlist.',
    chips: ['Direkte Wettbewerber', 'Branchenführer', 'Bestimmte Firmen (eintragen)'],
    freeText: true,
  },
  {
    id: 'nogo_companies', chapter: 'Sourcing', weight: 2,
    text: 'Welche Firmen sind tabu (Kunden / Partner / No-Poach)?',
    chips: ['Keine', 'Kunden & Partner', 'Bestimmte Firmen (eintragen)'],
    freeText: true,
  },
  // ── Sichtbarkeit (Triple-Blind) ───────────────────────────
  {
    id: 'reveal_envelope', chapter: 'Sichtbarkeit', weight: 3,
    text: 'Was dürfen wir anonym verraten — ohne Sie zu nennen?',
    why: 'Macht den anonymen Pitch attraktiv, ohne Sie zu enttarnen.',
    chips: ['Branche', 'Unternehmensgröße', 'Funding-Stage', 'Region', 'Gehaltsband'],
    multi: true,
  },
  {
    id: 'reveal_timing', chapter: 'Sichtbarkeit', weight: 2,
    text: 'Wann darf Ihre Identität freigegeben werden?',
    chips: ['Nach 1. Interview', 'Nach NDA', 'Bei gegenseitigem Interesse', 'Erst beim Angebot'],
  },
];

function applicableFor(type: JobType, built: BriefBuilt | undefined, answers: Answers): Question[] {
  return QUESTIONS.filter((q) => {
    if (q.appliesTo && q.appliesTo !== 'all' && q.appliesTo !== type) return false;
    if (q.id === 'onsite_days' && built?.remote_type === 'remote') return false;
    if (q.showIf && !q.showIf(answers)) return false;
    return true;
  });
}

export function briefingProgress(type: JobType, built: BriefBuilt | undefined, answers: Answers) {
  const applicable = applicableFor(type, built, answers);
  const total = applicable.reduce((s, q) => s + q.weight, 0);
  const addressed = applicable.reduce((s, q) => {
    const a = answers[q.id];
    if (!a) return s;
    return s + (a.unknown ? q.weight * 0.5 : q.weight);
  }, 0);
  return {
    pct: total ? Math.round((addressed / total) * 100) : 0,
    open: applicable.filter((q) => !answers[q.id]).length,
    totalQ: applicable.length,
  };
}

/** Offene Fragen (für Qualitäts-Check: die wertvollsten Hebel zuerst). */
export function openBriefingQuestions(type: JobType, built: BriefBuilt | undefined, answers: Answers) {
  return applicableFor(type, built, answers)
    .filter((q) => !answers[q.id])
    .sort((a, b) => b.weight - a.weight)
    .map((q) => ({ id: q.id, text: q.text, chapter: q.chapter, weight: q.weight }));
}

export function serializeBriefing(answers: Answers): string {
  const lines: string[] = [];
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (!a) continue;
    const val = a.unknown ? 'Weiß ich nicht' : Array.isArray(a.value) ? a.value.join(', ') : a.value;
    if (val) lines.push(`${q.text}\n→ ${val}`);
  }
  return lines.join('\n\n');
}

interface Props {
  type: JobType;
  built?: BriefBuilt;
  value: Answers;
  onChange: (a: Answers) => void;
  onDone: () => void;
}

export function IntakeBriefing({ type, built, value, onChange, onDone }: Props) {
  const applicable = useMemo(() => applicableFor(type, built, value), [type, built, value]);

  const [cursor, setCursor] = useState(0);
  const [freeText, setFreeText] = useState('');

  const total = applicable.reduce((s, q) => s + q.weight, 0);
  const addressed = applicable.reduce((s, q) => {
    const a = value[q.id];
    if (!a) return s;
    return s + (a.unknown ? q.weight * 0.5 : q.weight);
  }, 0);
  const completeness = total ? Math.round((addressed / total) * 100) : 0;

  const idx = Math.min(cursor, applicable.length);
  const done = idx >= applicable.length;
  const q = applicable[idx];

  const set = (a: Answer) => {
    onChange({ ...value, [q.id]: a });
    setFreeText('');
    setCursor((c) => c + 1);
  };

  const toggleMulti = (chip: string) => {
    const cur = (value[q.id]?.value as string[]) || [];
    const next = cur.includes(chip) ? cur.filter((c) => c !== chip) : [...cur, chip];
    onChange({ ...value, [q.id]: { value: next } });
  };

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <div>
          <p className="text-lg font-semibold">Jobaufnahme {completeness}% · Briefing steht</p>
          <p className="text-sm text-muted-foreground">
            Die Recruiter haben jetzt alles für gezieltes, blindes Sourcing.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCursor(0)}>Antworten ansehen</Button>
        <Button variant="hero" className="ml-2" onClick={onDone}>Weiter zur Übergabe</Button>
      </div>
    );
  }

  const chapterIdx = CHAPTERS.indexOf(q.chapter);
  const selected = value[q.id];
  const selectedMulti = (selected?.value as string[]) || [];

  return (
    <div className="space-y-4">
      {/* Kapitel-Rail + Completeness */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {CHAPTERS.map((c, i) => (
            <span
              key={c}
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] transition-colors',
                i === chapterIdx ? 'bg-primary text-primary-foreground' : i < chapterIdx ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{completeness}%</span>
        </div>
      </div>

      {/* Frage */}
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-0.5 text-xs uppercase tracking-wider text-muted-foreground">
          {q.chapter} · Frage {idx + 1} von {applicable.length}
        </p>
        <p className="text-base font-semibold">{q.text}</p>
        {q.why && <p className="mt-1 text-xs text-muted-foreground">{q.why}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {q.chips.map((chip) => {
            const active = q.multi ? selectedMulti.includes(chip) : selected?.value === chip;
            return (
              <button
                key={chip}
                onClick={() => (q.multi ? toggleMulti(chip) : set({ value: chip }))}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5',
                )}
              >
                {chip}
              </button>
            );
          })}
          <button
            onClick={() => set({ unknown: true })}
            className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <HelpCircle className="h-3.5 w-3.5" /> {WN}
          </button>
        </div>

        {q.freeText && (
          <div className="mt-3 flex gap-2">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && freeText.trim() && set({ value: freeText.trim() })}
              placeholder="oder frei eingeben …"
              className="text-sm"
            />
            {freeText.trim() && <Button size="sm" onClick={() => set({ value: freeText.trim() })}>OK</Button>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setCursor((c) => Math.max(0, c - 1))} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => set({ unknown: true })}>Überspringen</Button>
          {q.multi && (
            <Button size="sm" className="gap-1.5" onClick={() => setCursor((c) => c + 1)}>
              Weiter <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="text-center">
        <Badge variant="secondary" className="text-xs">Übergabe ist jederzeit möglich — nichts ist Pflicht</Badge>
      </div>
    </div>
  );
}
