import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { fromRecords, mergeNoteRows } from '@/lib/candidateDossier';
import { kandidatenStand, type KandidatenStand, type StandEinstellung, type StandStelle, type StandVorstellung } from '@/lib/kandidatenStand';
import { STELLEN_SPALTEN, offeneStellenAbgleichen, type KandidatAngaben, type StelleInfo } from '@/lib/offeneStellen';
import { vorname } from '@/lib/vorstellen';

type Rec = Record<string, unknown>;

export interface KandidatUebersicht {
  stand: KandidatenStand;
  /** Offene Stellen, die laut Abgleich passen (wie „Offene Stellen, die vielleicht passen“ im Profil). */
  passend: string[];
  /** Stellen, bei denen der Kandidat schon vorgestellt ist. */
  vorgestellt: string[];
}

const BLOCK = 200;
async function inBloecken<T>(ids: string[], laden: (teil: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += BLOCK) out.push(...(await laden(ids.slice(i, i + BLOCK))));
  return out;
}

/**
 * Stand und passende Stellen für alle Kandidaten der Liste auf einmal (24.11.2026).
 * Gleiche Quellen wie im Profil: Stufe der Vorstellungen, Einstellungen (Start, Garantie),
 * Akte (Kandidat + Interviewnotizen + Sprachen) gegen die offenen Stellen.
 */
export function useKandidatenStand(kandidaten: Rec[]) {
  const { user } = useAuth();
  const ids = useMemo(() => kandidaten.map((k) => String(k.id)), [kandidaten]);

  const daten = useQuery({
    queryKey: ['kandidaten-stand', user?.id, ids.join(',')],
    enabled: !!user && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [vorstellungen, notizen, sprachen, offen] = await Promise.all([
        inBloecken(ids, async (teil) => ((await supabase.from('submissions')
          .select('id, candidate_id, job_id, stage, status, submitted_at, updated_at')
          .in('candidate_id', teil)).data ?? []) as Array<StandVorstellung & { candidate_id: string }>),
        inBloecken(ids, async (teil) => ((await supabase.from('candidate_interview_notes')
          .select('*').in('candidate_id', teil)
          .order('updated_at', { ascending: false, nullsFirst: false })).data ?? []) as Rec[]),
        inBloecken(ids, async (teil) => ((await supabase.from('candidate_languages')
          .select('candidate_id, language, proficiency').in('candidate_id', teil)).data ?? []) as Rec[]),
        supabase.from('recruiter_jobs_view').select(STELLEN_SPALTEN).eq('status', 'published')
          .order('created_at', { ascending: false })
          .then(({ data }) => ((data ?? []) as unknown as StelleInfo[]).filter((s) => s.id)),
      ]);

      const jobIds = [...new Set(vorstellungen.map((v) => v.job_id).filter(Boolean))] as string[];
      const subIds = vorstellungen.filter((v) => normalisiertEingestellt(v)).map((v) => v.id);
      const [stellenRows, einstellungRows] = await Promise.all([
        jobIds.length ? inBloecken(jobIds, async (teil) => ((await supabase.from('recruiter_jobs_view')
          .select('id, title, company_name').in('id', teil)).data ?? []) as Rec[]) : Promise.resolve([] as Rec[]),
        // Die Sicht steht nicht in den erzeugten Typen; wie in useRecruiterPipeline ohne Typprüfung lesen.
        subIds.length ? inBloecken(subIds, async (teil) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any).from('recruiter_placements_view').select('submission_id, start_date, retention_release_date').in('submission_id', teil);
          return (data ?? []) as Rec[];
        }) : Promise.resolve([] as Rec[]),
      ]);

      return { vorstellungen, notizen, sprachen, offen, stellenRows, einstellungRows };
    },
  });

  const ergebnis = useMemo(() => {
    const map = new Map<string, KandidatUebersicht>();
    const d = daten.data;
    if (!d) return map;
    const stellen = new Map<string, StandStelle>(d.stellenRows.map((r) => [String(r.id), { title: (r.title as string) ?? null, company_name: (r.company_name as string) ?? null }]));
    const einstellungen = new Map<string, StandEinstellung>(d.einstellungRows.map((r) => [String(r.submission_id), {
      start_date: (r.start_date as string) ?? null,
      retention_release_date: (r.retention_release_date as string) ?? null,
    }]));
    const gruppe = <T extends Rec>(rows: T[]) => {
      const g = new Map<string, T[]>();
      for (const r of rows) { const k = String(r.candidate_id); g.set(k, [...(g.get(k) ?? []), r]); }
      return g;
    };
    const subsJe = gruppe(d.vorstellungen as unknown as Rec[]) as unknown as Map<string, Array<StandVorstellung & { candidate_id: string }>>;
    const notizenJe = gruppe(d.notizen);
    const sprachenJe = gruppe(d.sprachen);
    const heute = new Date();

    for (const k of kandidaten) {
      const id = String(k.id);
      const subs = subsJe.get(id) ?? [];
      const form = fromRecords(k, mergeNoteRows(notizenJe.get(id) ?? []), (sprachenJe.get(id) ?? []) as Array<{ language: string | null; proficiency: string | null }>);
      const angaben: KandidatAngaben = {
        vorname: vorname(form.full_name),
        job_title: form.job_title,
        target_roles: form.target_roles,
        city: form.city,
        remote_preference: form.remote_preference,
        expected_salary: form.expected_salary,
        salary_minimum: form.salary_minimum,
        relocation_willing: form.relocation_willing,
        languages: form.languages.filter((l): l is { language: string; proficiency: string | null } => !!l.language),
      };
      const abgleich = offeneStellenAbgleichen(angaben, d.offen);
      map.set(id, {
        stand: kandidatenStand(subs, stellen, einstellungen, heute),
        passend: [...abgleich.zurRolle, ...abgleich.weitere].map((a) => a.stelle.id),
        vorgestellt: subs.map((s) => s.job_id).filter(Boolean) as string[],
      });
    }
    return map;
  }, [daten.data, kandidaten]);

  /** Für den Filter „Stelle“: offene Stellen plus Stellen, bei denen jemand vorgestellt ist. */
  const stellenAuswahl = useMemo(() => {
    const d = daten.data;
    if (!d) return [] as { id: string; title: string }[];
    const m = new Map<string, string>();
    for (const s of d.offen) m.set(s.id, s.title);
    for (const r of d.stellenRows) if (r.title) m.set(String(r.id), String(r.title));
    return [...m].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [daten.data]);

  return { uebersicht: ergebnis, stellenAuswahl, laedt: daten.isLoading };
}

function normalisiertEingestellt(v: StandVorstellung): boolean {
  return v.stage === 'placed' || v.stage === 'hired' || v.status === 'hired';
}
