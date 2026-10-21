import { useEffect, useRef, type ReactNode } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CandidateFitAssessment, useCandidateFitAssessment } from '@/hooks/useCandidateFitAssessment';
import { readGaps } from '@/lib/clientQuestions';
import { fmtDatum, fuehrung, GESPRAECH, verfuegbarAus, type EducationEntry, type InterviewInsights } from './useCandidateInsights';

// Ersetzte Namen („der Kandidat“) stehen oft am Satzanfang.
const satz = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Kopf({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{children}</h3>
      {aside}
    </div>
  );
}

function Zeile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs leading-6 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm leading-6">{children}</dd>
    </div>
  );
}

/**
 * „Aus dem Gespräch mit dem Headhunter“: feste Angaben aus dem Kandidateninterview,
 * anonymisiert über client_candidate_interview_view. Heutiges Gehalt, Mindestgehalt,
 * gesperrte Firmen und interne Einschätzungen bleiben beim Headhunter.
 */
export function InterviewInsightsCard({ interview, recruiterNotes, recruiterName = null }: { interview: InterviewInsights | null; recruiterNotes: string | null; recruiterName?: string | null }) {
  const i = interview;
  const verfuegbar = verfuegbarAus(i);
  const wichtig = (i?.offer_requirements ?? []).filter(Boolean);
  const rows = i ? [
    i.change_motivation?.trim() && { label: 'Warum wechseln', value: satz(i.change_motivation.trim()) },
    i.why_now?.trim() && { label: 'Warum jetzt', value: satz(i.why_now.trim()) },
    wichtig.length > 0 && { label: 'Wichtig ist', value: <span className="flex flex-wrap gap-1.5">{wichtig.map((w) => <Badge key={w} variant="secondary" className="font-normal">{w}</Badge>)}</span> },
    i.salary_wish && { label: 'Gehaltswunsch', value: i.salary_wish },
    verfuegbar && { label: 'Verfügbar', value: verfuegbar },
    fuehrung(i) && { label: 'Führung', value: fuehrung(i) },
  ].filter(Boolean) as { label: string; value: ReactNode }[] : [];

  return (
    <Card>
      <CardContent className="p-5">
        <Kopf aside={i?.interview_date && <span className="text-xs text-muted-foreground">{[i.interview_type && GESPRAECH[i.interview_type], fmtDatum(i.interview_date)].filter(Boolean).join(', ')}</span>}>
          Aus dem Gespräch mit {recruiterName || 'dem Headhunter'}
        </Kopf>
        {rows.length === 0 && !recruiterNotes ? (
          <p className="text-sm text-muted-foreground">Zu diesem Kandidaten liegen noch keine Angaben aus dem Gespräch vor. Fragen Sie gern über „Frage an {recruiterName || 'den Headhunter'}“ nach.</p>
        ) : (
          <dl className="divide-y divide-border/60">
            {rows.map((r) => <Zeile key={r.label} label={r.label}>{r.value}</Zeile>)}
            {recruiterNotes && <Zeile label="Notiz"><span className="text-muted-foreground">„{recruiterNotes}“</span></Zeile>}
          </dl>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Der Kandidat hat der Vorstellung zugestimmt. Namen und Firmen sind entfernt, bis Sie ein Interview vereinbaren.</p>
      </CardContent>
    </Card>
  );
}

/**
 * „Einschätzung zur Stelle“: KI-Text ohne Zahl und ohne Urteil (EU AI Act), immer offen.
 * Fehlt er, wird er still erstellt -- der Kunde muss nichts anklicken.
 */
export function FitTextCard({ fit }: { fit: ReturnType<typeof useCandidateFitAssessment> }) {
  const { assessment, loading, generating, generateAssessment, refetch } = fit;
  const tried = useRef(false);

  // Sicherheitsnetz: fehlt die Einschätzung (Auslöser beim Einreichen nicht durchgekommen), einmal still anstoßen.
  useEffect(() => {
    if (loading || assessment || generating || tried.current) return;
    tried.current = true;
    void generateAssessment({ silent: true });
  }, [loading, assessment, generating, generateAssessment]);

  // Entsteht sie gerade im Hintergrund, alle 15 Sekunden nachsehen (höchstens 2 Minuten).
  useEffect(() => {
    if (assessment || loading) return;
    let n = 0;
    const t = window.setInterval(() => { n += 1; if (n > 8) window.clearInterval(t); void refetch(); }, 15_000);
    return () => window.clearInterval(t);
  }, [assessment, loading, refetch]);

  const fuer = (assessment?.bonus_qualifications ?? []).map((q) => q.qualification).filter(Boolean).slice(0, 3);
  // Gespeichert wird {gap, severity, mitigation}; ältere Einträge haben {requirement, …}. Der Kunde sieht das Thema, nicht den KI-Rat.
  const klaeren = readGaps(assessment?.gap_analysis ?? []).map((g) => g.text).slice(0, 3);

  return (
    <Card>
      <CardContent className="p-5">
        <Kopf aside={<Badge variant="outline" className="text-[10px] font-normal">KI-Text</Badge>}>Einschätzung zur Stelle</Kopf>
        {!assessment ? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <p>Die Einschätzung wird erstellt. Das dauert meist unter einer Minute, die Seite aktualisiert sich von selbst.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm leading-6">
            {assessment.executive_summary && <p>{satz(assessment.executive_summary)}</p>}
            {fuer.length > 0 && <p><span className="font-medium">Für die Stelle spricht:</span> {fuer.join(' · ')}</p>}
            {klaeren.length > 0 && (
              <div>
                <p className="font-medium">Im Interview klären:</p>
                <ul className="mt-1 space-y-1">{klaeren.map((k) => <li key={k} className="flex gap-2"><span className="text-muted-foreground">·</span><span className="min-w-0">{k}</span></li>)}</ul>
              </div>
            )}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Von einer KI aus Lebenslauf und Gespräch mit dem Headhunter erstellt, ohne Gehalt. Keine Bewertung der Person. Die Entscheidung liegt bei Ihnen.</p>
      </CardContent>
    </Card>
  );
}

/** „Ihre Muss-Kriterien · was dazu vorliegt“: je Kriterium ein Satz, ohne Haken oder Zahl. */
export function MussKriterienCard({ assessment }: { assessment: CandidateFitAssessment | null }) {
  const alle = assessment?.requirement_assessments ?? [];
  const muss = alle.some((r) => r.requirement_type) ? alle.filter((r) => r.requirement_type === 'must_have') : alle;
  if (muss.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-5">
        <Kopf>Ihre Muss-Kriterien · was dazu vorliegt</Kopf>
        <ul className="divide-y divide-border/60">
          {muss.map((r) => (
            <li key={r.requirement} className="py-2 first:pt-0">
              <p className="text-sm font-medium">{r.requirement}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{satz(r.evidence?.[0] || r.reasoning || '')}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">Zusammengefasst aus Lebenslauf und Gespräch. Die Bewertung treffen Sie.</p>
      </CardContent>
    </Card>
  );
}

export function EducationCard({ education }: { education: EducationEntry[] }) {
  if (education.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-5">
        <Kopf>Ausbildung</Kopf>
        <ul className="space-y-3">
          {education.map((e) => (
            <li key={e.id} className="flex gap-3">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{[e.degree, e.field_of_study].filter(Boolean).join(' · ') || 'Abschluss'}</p>
                <p className="text-xs text-muted-foreground">{[e.institution || 'Hochschule nach Interview-Zusage', e.graduation_year].filter(Boolean).join(' · ')}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

