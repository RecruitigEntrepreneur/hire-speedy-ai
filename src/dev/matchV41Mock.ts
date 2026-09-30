/**
 * Nur Entwicklung: Beispielantwort von match-v41, solange die Function nicht
 * deployt ist. Aktiv nur mit `npm run dev` UND localStorage.matchV41Mock = '1'
 * (im Build ist import.meta.env.DEV false, der Code fällt weg).
 */

import type { MatchV41Response } from '@/lib/matchV41';

export function matchV41Mock(candidateId: string, jobIds: string[]): MatchV41Response {
  const base = { version: 'v4.1.0', override: null, caps: [] as string[], reasons: [] as string[], gaps: [] as string[] };
  const [a, b, c, d, e] = jobIds;
  const results: MatchV41Response['results'] = [];
  if (a) results.push({
    ...base, job_id: a, tier: 'sehr_passend', label: 'Sehr passend', sort_score: 94, confidence: 0.86, exclusion: null,
    requirements: [
      { id: 'r1', text: 'Python und Machine Learning', class: 'must', status: 'met', evidence: 'Churn-Modelle mit scikit-learn', note: '' },
      { id: 'r2', text: 'SQL', class: 'must', status: 'met', evidence: 'SQL', note: '' },
      { id: 'r3', text: 'Statistik', class: 'must', status: 'met', evidence: 'A/B-Testing', note: '' },
      { id: 'r4', text: 'Deep Learning', class: 'nice', status: 'unknown', evidence: '', note: '' },
    ],
    frame: [
      { key: 'work_model', status: 'ok', text: 'Arbeitsmodell passt' },
      { key: 'location', status: 'ok', text: 'Gleicher Ort' },
      { key: 'language', status: 'ok', text: 'EN C1 erfüllt' },
      { key: 'salary', status: 'ok', text: 'Gehalt im Rahmen' },
      { key: 'start', status: 'ok', text: 'Start passt' },
    ],
    summary: 'Starke ML-Praxis in Python mit belegten Churn-Modellen; genau der Kern der Stelle. Offen ist Erfahrung mit Deep Learning.',
    talking_points: ['Deep-Learning-Projekte erfragen', 'Starttermin klären'],
  });
  if (b) results.push({
    ...base, job_id: b, tier: 'pruefen', label: 'Prüfen', sort_score: 61, confidence: 0.62, exclusion: null,
    caps: ['Ein Muss-Kriterium (Vorschlag der KI, nicht vom Kunden bestätigt) ist nicht erfüllt'],
    requirements: [
      { id: 'r1', text: 'Python', class: 'must', status: 'met', evidence: 'Python', note: '' },
      { id: 'r2', text: 'C++ oder Rust', class: 'must', status: 'not_met', evidence: '', note: 'Keine systemnahe Sprache im Profil.' },
    ],
    frame: [
      { key: 'work_model', status: 'ok', text: 'Arbeitsmodell passt' },
      { key: 'location', status: 'unknown', text: 'Anderer Ort (Berlin → München) – Pendelweg klären' },
      { key: 'salary', status: 'ok', text: 'Gehalt im Rahmen' },
      { key: 'start', status: 'unknown', text: 'Kündigungsfrist nicht erfasst' },
    ],
    summary: 'ML-Erfahrung passt, aber C++/Rust fehlt im Profil.',
    talking_points: ['Erfahrung mit C++ oder Rust erfragen', 'Umzug nach München?'],
  });
  if (c) results.push({
    ...base, job_id: c, tier: 'passend', label: 'Passend', sort_score: 78, confidence: 0.7, exclusion: null,
    requirements: [
      { id: 'r1', text: 'SQL', class: 'must', status: 'met', evidence: 'SQL', note: '' },
      { id: 'r2', text: 'BI-Werkzeuge (Power BI oder Tableau)', class: 'must', status: 'partial', evidence: 'Dashboards', note: 'Werkzeug nicht genannt.' },
    ],
    frame: [
      { key: 'work_model', status: 'ok', text: 'Arbeitsmodell passt' },
      { key: 'salary', status: 'check', text: 'Wunsch leicht über Budget, Untergrenze im Rahmen – verhandelbar' },
    ],
    summary: 'Datenprofil passt, BI-Werkzeug im Gespräch klären.',
    talking_points: ['Welches BI-Werkzeug genau?'],
  });
  if (d) results.push({
    ...base, job_id: d, tier: 'ausgeschlossen', label: 'Ausgeschlossen', sort_score: 20, confidence: 0.5,
    exclusion: { code: 'work_model', text: 'Stelle verlangt 5 Präsenztage, Kandidat arbeitet nur remote', overridable: true },
    requirements: [], frame: [{ key: 'work_model', status: 'exclude', text: 'Stelle verlangt 5 Präsenztage, Kandidat arbeitet nur remote' }],
    summary: '', talking_points: [],
  });
  if (e) results.push({
    ...base, job_id: e, tier: 'ausgeschlossen', label: 'Ausgeschlossen', sort_score: 5, confidence: 0.4,
    exclusion: { code: 'family', text: 'Andere Berufsfamilie', overridable: true },
    requirements: [], frame: [], summary: '', talking_points: [],
  });
  return {
    version: 'v4.1.0', candidate_id: candidateId, results, pending: [],
    stats: { jobs: results.length, cached: 0, judged_now: 3, without_ai: 2, pending: 0, candidate_understood_by_ai: true, ms: 0 },
  };
}
