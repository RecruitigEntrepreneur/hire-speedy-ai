import { supabase } from '@/integrations/supabase/client';
import { abschlussGaps, fromRecords, mergeNoteRows } from '@/lib/candidateDossier';
import { betroffeneKandidaten, interviewBegonnen, leiteVorbereitungAb, type VEingabe, type Vorbereitung } from '@/lib/kandidatVorbereiten';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabase as unknown as { from: (t: string) => any };

const KANDIDAT = 'id, full_name, phone, email, job_title, created_at, cv_url, cv_parsed_at, candidate_status, import_source';
const LOG_TAGE = 45;

/** Was zum Abschließen des Interviews fehlt: dieselbe Regel wie auf der Karte im Profil. */
async function ladeLuecken(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  const [c, n, l] = await Promise.all([
    db().from('candidates').select('*').in('id', ids),
    db().from('candidate_interview_notes').select('*').in('candidate_id', ids).order('updated_at', { ascending: false, nullsFirst: false }),
    db().from('candidate_languages').select('candidate_id, language, proficiency').in('candidate_id', ids),
  ]);
  for (const cand of (c.data ?? []) as any[]) {
    const form = fromRecords(
      cand,
      mergeNoteRows(((n.data ?? []) as any[]).filter(r => r.candidate_id === cand.id)),
      ((l.data ?? []) as any[]).filter(r => r.candidate_id === cand.id),
    );
    out.set(cand.id, abschlussGaps(form).map(g => g.label));
  }
  return out;
}

/**
 * Passende offene Stellen aus dem gespeicherten Matching. Die Aufgabenliste rechnet nichts neu:
 * Ist für einen Kandidaten noch nichts gerechnet, steht in der Zeile keine Zahl.
 */
async function ladeStellen(userId: string, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const [r, o] = await Promise.all([
    db().from('match_v41_results').select('candidate_id, job_id, tier').eq('recruiter_id', userId).in('candidate_id', ids),
    db().from('match_v41_overrides').select('candidate_id, job_id, decision').in('candidate_id', ids),
  ]);
  const zeilen = (r.data ?? []) as { candidate_id: string; job_id: string; tier: string }[];
  const jobIds = [...new Set(zeilen.map(z => z.job_id))];
  if (!jobIds.length) return out;
  const { data: jobs } = await db().from('recruiter_jobs_view').select('id').in('id', jobIds);
  const offen = new Set(((jobs ?? []) as { id: string }[]).map(j => j.id));
  const entscheid = new Map(((o.data ?? []) as any[]).map(x => [`${x.candidate_id}|${x.job_id}`, x.decision as string]));
  for (const z of zeilen) {
    const d = entscheid.get(`${z.candidate_id}|${z.job_id}`);
    const passt = d === 'show' || (d !== 'hide' && z.tier !== 'ausgeschlossen');
    if (offen.has(z.job_id) && passt) out.set(z.candidate_id, (out.get(z.candidate_id) ?? 0) + 1);
  }
  return out;
}

/** Alle Aufgaben vor der Einreichung des Headhunters. */
export async function ladeVorbereitung(userId: string, nowMs: number): Promise<Vorbereitung[]> {
  const kandidatenMit = await db().from('candidates').select(`${KANDIDAT}, prep_dismissed_at`).eq('recruiter_id', userId);
  // Spalte noch nicht da (Migration nicht gelaufen): ohne „Nicht relevant“ weiter
  const kandidaten = kandidatenMit.error ? await db().from('candidates').select(KANDIDAT).eq('recruiter_id', userId) : kandidatenMit;
  const [einladungen, buchungen, notizen, einreichungen, logs] = await Promise.all([
    db().from('candidate_invites').select('candidate_id, arten, weg, created_at, sent_at, opened_at, last_opened_at, expires_at, booked_at, revoked_at').eq('recruiter_id', userId),
    db().from('recruiter_bookings').select('candidate_id, starts_at, ends_at, mode, status, join_url, note').eq('recruiter_id', userId).not('candidate_id', 'is', null),
    db().from('candidate_interview_notes').select('candidate_id, status, updated_at, interview_date').eq('recruiter_id', userId),
    db().from('submissions').select('candidate_id').eq('recruiter_id', userId),
    db().from('candidate_activity_log').select('candidate_id, activity_type, created_at, metadata').eq('recruiter_id', userId)
      .is('related_submission_id', null).in('activity_type', ['call', 'email', 'note'])
      .gte('created_at', new Date(nowMs - LOG_TAGE * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(500),
  ]);
  const eingabe: VEingabe = {
    kandidaten: kandidaten.data ?? [],
    // Fehlen die Tabellen noch, bleiben die Listen leer
    einladungen: einladungen.data ?? [],
    buchungen: buchungen.data ?? [],
    notizen: notizen.data ?? [],
    logs: logs.data ?? [],
    mitEinreichung: new Set(((einreichungen.data ?? []) as { candidate_id: string }[]).map(s => s.candidate_id)),
  };
  const betroffen = betroffeneKandidaten(eingabe).map(k => k.id);
  const mitInterview = betroffen.filter(id => eingabe.notizen.some(n => n.candidate_id === id && n.status !== 'superseded' && interviewBegonnen(n)));
  const [luecken, stellen] = await Promise.all([ladeLuecken(mitInterview), ladeStellen(userId, betroffen)]);
  return leiteVorbereitungAb({ ...eingabe, luecken, stellen }, nowMs);
}
