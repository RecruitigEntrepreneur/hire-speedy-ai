// ─── Geteilter Kern der Fit-Bewertung ───────────────────────────────────────
// Prompt-Aufbau, System-Prompt und Tool-Schema an EINER Stelle, damit die Edge
// Function (assess-candidate-fit) und das Golden-Eval-Skript exakt denselben
// Prompt verwenden (sonst wäre der Qualitätsvergleich wertlos).

import type { LLMView } from "./pii-redaction.ts";

export const FIT_MODEL = "google/gemini-2.5-flash";

export const SYSTEM_PROMPT = `Du bist ein erfahrener Recruiting-Analyst. Analysiere die Passung zwischen Kandidat und Stelle evidenzbasiert.

REGELN:
- Bewerte NUR anhand der vorliegenden Daten. Keine Vermutungen.
- Jede Bewertung MUSS mit konkreten Belegen aus dem Kandidatenprofil untermauert sein.
- Fehlende Daten sind KEINE negativen Signale — kennzeichne sie als "insufficient_data".
- Sei direkt und ehrlich. Kein Marketing-Sprech.
- Platzhalter wie [KANDIDAT], [Arbeitgeber A] oder [Region] sind anonymisierte, aber vollwertige Angaben — bewerte normal weiter und kennzeichne sie NICHT als "insufficient_data".
- Antworte auf Deutsch.`;

export function buildJobSection(job: any): string {
  return `## STELLE
Titel: ${job.title}
Beschreibung: ${job.description || 'N/A'}
Must-Haves: ${Array.isArray(job.must_haves) ? job.must_haves.join(', ') : job.must_haves || 'N/A'}
Nice-to-Haves: ${Array.isArray(job.nice_to_haves) ? job.nice_to_haves.join(', ') : job.nice_to_haves || 'N/A'}
Erfahrungslevel: ${job.experience_level || 'N/A'}
Gehalt: ${job.salary_min ? `${job.salary_min}–${job.salary_max} EUR` : 'N/A'}
Standort: ${job.location || 'N/A'}
Remote: ${job.remote_policy || 'N/A'}`;
}

// Baut den User-Prompt aus einer normalisierten Sicht (redigiert ODER roh).
export function buildUserPrompt(view: LLMView, jobSection: string): string {
  return `Analysiere die Passung zwischen diesem Kandidaten und der Stelle.

## KANDIDAT
Name: ${view.nameLabel}
Aktuelle Position: ${view.job_title || 'N/A'} bei ${view.employer_alias || 'einem Unternehmen'}
Seniority: ${view.seniority || 'N/A'}
Erfahrung: ${view.experience_years ?? 'N/A'} Jahre
Region: ${view.region}
Standort-Bezug zur Stelle: ${view.location_relation}
Gehaltserwartung: ${view.salary_min ? `${view.salary_min}–${view.salary_max} EUR` : 'N/A'}
Remote-Präferenz: ${view.remote_preference || 'N/A'}
Skills: ${view.skills?.join(', ') || 'N/A'}
Zertifizierungen: ${view.certifications?.join(', ') || 'N/A'}

### Berufserfahrung
${view.experiences.length > 0 ? view.experiences.map((e) => `- ${e.job_title} bei ${e.employer_alias || 'einem Unternehmen'} (${e.start_date || '?'} – ${e.end_date || 'heute'}, Region: ${e.region}): ${e.description || 'Keine Beschreibung'}`).join('\n') : 'Keine Daten'}

### Skills (detailliert)
${view.skillsDetailed.length > 0 ? view.skillsDetailed.map((s) => `- ${s.name} (Level: ${s.level || '?'}, ${s.years ? s.years + ' Jahre' : '?'}, Kategorie: ${s.category || '?'})`).join('\n') : 'Keine detaillierten Skills'}

### Sprachen
${view.languages.length > 0 ? view.languages.map((l) => `- ${l.language}: ${l.proficiency || '?'}`).join('\n') : 'Keine Daten'}

### CV-Zusammenfassung
${view.cvSummary || 'Keine Zusammenfassung verfügbar'}

### Interview-Notizen
${view.interview ? `Wechselmotivation: ${view.interview.change_motivation || 'N/A'}
Aktuelles Gehalt: ${view.interview.salary_current || 'N/A'}
Wunschgehalt: ${view.interview.salary_desired || 'N/A'}
Karriereziel: ${view.interview.career_ultimate_goal || 'N/A'}
Empfehlung: ${view.interview.would_recommend ? 'Ja' : 'Nein'}` : 'Keine Interview-Daten'}

${view.priorAssessment ? `### Bisherige AI-Einschätzung
Overall Score: ${view.priorAssessment.overall_score}/100
Risiko-Level: ${view.priorAssessment.risk_level}
Empfehlung: ${view.priorAssessment.recommendation}` : ''}

---

${jobSection}

---

Erstelle ein vollständiges Fit Assessment.`;
}

// Rohe (NICHT redigierte) Sicht im selben LLMView-Format — für den 'off'-Pfad
// und als Baseline im Golden-Eval.
export function buildRawView(
  candidate: any,
  experiences: any[],
  skills: any[],
  languages: any[],
  interviewNotes: any | null,
  job: any,
): LLMView {
  return {
    nameLabel: candidate.full_name || 'N/A',
    job_title: candidate.job_title ?? null,
    employer_alias: candidate.company ?? null,
    seniority: candidate.seniority ?? null,
    experience_years: candidate.experience_years ?? null,
    region: candidate.city || 'N/A',
    location_relation: `${candidate.city || 'N/A'} (Stelle: ${job.location || 'N/A'})`,
    salary_min: candidate.salary_expectation_min ?? null,
    salary_max: candidate.salary_expectation_max ?? null,
    remote_preference: candidate.remote_preference ?? null,
    skills: candidate.skills ?? [],
    certifications: candidate.certifications ?? [],
    skillsDetailed: (skills ?? []).map((s) => ({
      name: s.skill_name, level: s.level ?? null, years: s.years_experience ?? null, category: s.category ?? null,
    })),
    languages: (languages ?? []).map((l) => ({ language: l.language, proficiency: l.proficiency ?? null })),
    cvSummary: candidate.cv_ai_summary ?? candidate.summary ?? null,
    experiences: (experiences ?? []).map((e) => ({
      job_title: e.job_title ?? null,
      employer_alias: e.company_name ?? null,
      region: e.location ?? 'N/A',
      start_date: e.start_date ?? null,
      end_date: e.end_date ?? null,
      description: e.description ?? null,
    })),
    interview: interviewNotes
      ? {
          change_motivation: interviewNotes.change_motivation ?? null,
          salary_current: interviewNotes.salary_current ?? null,
          salary_desired: interviewNotes.salary_desired ?? null,
          career_ultimate_goal: interviewNotes.career_ultimate_goal ?? null,
          would_recommend: interviewNotes.would_recommend ?? null,
        }
      : null,
    priorAssessment: null,
  };
}

// Tool-/Function-Schema für die strukturierte Ausgabe (unverändert übernommen).
export const FIT_TOOL = {
  name: "submit_fit_assessment",
  description: "Submit the structured fit assessment result.",
  parameters: {
    type: "object",
    properties: {
      overall_verdict: { type: "string", enum: ["strong_fit", "good_fit", "partial_fit", "weak_fit", "no_fit"] },
      overall_score: { type: "integer", minimum: 0, maximum: 100 },
      executive_summary: { type: "string", description: "2-4 Sätze Gesamtbewertung auf Deutsch" },
      verdict_confidence: { type: "string", enum: ["high", "medium", "low"] },
      requirement_assessments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement: { type: "string" },
            status: { type: "string", enum: ["met", "partially_met", "not_met", "insufficient_data"] },
            evidence: { type: "string" },
            score: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["requirement", "status", "evidence", "score"],
        },
      },
      bonus_qualifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            qualification: { type: "string" },
            present: { type: "boolean" },
            evidence: { type: "string" },
          },
          required: ["qualification", "present", "evidence"],
        },
      },
      gap_analysis: {
        type: "array",
        items: {
          type: "object",
          properties: {
            gap: { type: "string" },
            severity: { type: "string", enum: ["critical", "moderate", "minor"] },
            mitigation: { type: "string" },
          },
          required: ["gap", "severity", "mitigation"],
        },
      },
      career_trajectory: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["upward", "lateral", "pivoting", "unclear"] },
          consistency: { type: "string", enum: ["high", "medium", "low"] },
          explanation: { type: "string" },
        },
        required: ["direction", "consistency", "explanation"],
      },
      implicit_competencies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            competency: { type: "string" },
            evidence: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["competency", "evidence", "confidence"],
        },
      },
      motivation_fit: {
        type: "object",
        properties: {
          score: { type: "integer", minimum: 0, maximum: 100 },
          assessment: { type: "string" },
          key_drivers: { type: "array", items: { type: "string" } },
          concerns: { type: "array", items: { type: "string" } },
        },
        required: ["score", "assessment"],
      },
      dimension_scores: {
        type: "object",
        properties: {
          technical_fit: { type: "integer", minimum: 0, maximum: 100 },
          experience_fit: { type: "integer", minimum: 0, maximum: 100 },
          seniority_fit: { type: "integer", minimum: 0, maximum: 100 },
          location_fit: { type: "integer", minimum: 0, maximum: 100 },
          salary_fit: { type: "integer", minimum: 0, maximum: 100 },
          culture_fit: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["technical_fit", "experience_fit", "seniority_fit"],
      },
      rejection_reasoning: { type: "string", description: "Nur ausfüllen wenn overall_verdict 'weak_fit' oder 'no_fit'" },
    },
    required: [
      "overall_verdict", "overall_score", "executive_summary", "verdict_confidence",
      "requirement_assessments", "bonus_qualifications", "gap_analysis",
      "career_trajectory", "implicit_competencies", "dimension_scores",
    ],
    additionalProperties: false,
  },
};
