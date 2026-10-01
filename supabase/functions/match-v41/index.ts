/**
 * match-v41 – KI-Matching für den Headhunter: welche Stellen passen zu diesem Kandidaten?
 *
 * Ablauf je Aufruf (Body: { candidateId, jobIds?, force? }):
 *  1. Wer fragt? Nutzer aus dem Token; der Kandidat muss ihm gehören (oder Admin).
 *  2. Kandidat verstehen (KI, geschwärzt, assertNoLeak fail closed) – gespeichert je Eingabestand.
 *  3. Live-Stellen verstehen (KI, Kundenname vorher durch [Kunde] ersetzt) – gespeichert, geteilt.
 *  4. Je Paar: Vorauswahl ohne KI. Belegter Ausschluss oder fremde Berufsfamilie → ohne KI fertig.
 *     Sonst KI-Urteil je Kriterium mit wörtlichem Beleg → feste Stufenregeln.
 *  5. Ergebnis gespeichert; unverändert = kein neuer KI-Aufruf.
 *
 * Kostenbremse: höchstens MAX_NEW_JOB_PROFILES neue Stellenprofile und MAX_JUDGE_CALLS
 * Urteile je Aufruf, Zeitlimit DEADLINE_MS. Der Rest kommt als `pending` zurück, das
 * Frontend fragt dann erneut. `force` wirkt höchstens alle FORCE_COOLDOWN_MS.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiChat } from '../_shared/ai.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { assertNoLeak, redactCandidateForLLM } from '../_shared/pii-redaction.ts';
import { candidateInputFromRows, companyMaskTokens, jobInputFromRow, maskCompany } from '../_shared/match-v41/db-inputs.ts';
import { evaluateFrame } from '../_shared/match-v41/frame.ts';
import { buildCandidateSection, JUDGE_V41_PROMPT_VERSION, verifyJudgement } from '../_shared/match-v41/judge.ts';
import { judgePair, understandCandidate, understandJob, type AiCaller } from '../_shared/match-v41/pipeline.ts';
import { decideTier, type MatchV41Result } from '../_shared/match-v41/policy.ts';
import { familyRelation, MATCH_V41_VERSION, type CandidateProfile, type JobProfile, type PrivateMatchContext } from '../_shared/match-v41/profiles.ts';
import { buildCandidateSource, UNDERSTAND_PROMPT_VERSION } from '../_shared/match-v41/understand.ts';

const MAX_JOBS = 200;
const MAX_NEW_JOB_PROFILES = 15;
const MAX_JUDGE_CALLS = 30;
const PARALLEL = 5;
const DEADLINE_MS = 100_000;
const FORCE_COOLDOWN_MS = 10 * 60_000;
const RESULT_TTL_MS = 14 * 86_400_000;

const JOB_COLUMNS = [
  'id', 'status', 'title', 'description', 'requirements', 'company_name', 'must_haves', 'nice_to_haves',
  'must_have_criteria', 'nice_to_have_criteria', 'trainable_skills', 'experience_level', 'required_languages',
  // jobs hat (anders als candidates) KEINE Spalte work_model – live geprüft 01.10.2026.
  'salary_min', 'salary_max', 'day_rate_min', 'day_rate_max', 'location', 'remote_type',
  'onsite_days_required', 'employment_type', 'visa_sponsorship', 'urgency', 'hiring_urgency', 'deadline',
  'hiring_deadline', 'nogo_companies',
].join(', ');

type Row = Record<string, unknown>;

async function sha(value: unknown): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Führt Aufgaben mit begrenzter Parallelität aus, startet nach Ablauf der Frist keine neuen. */
async function pool<T>(items: T[], worker: (t: T) => Promise<void>, deadline: number): Promise<T[]> {
  const skipped: T[] = [];
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const item = items[i++];
      if (Date.now() > deadline) { skipped.push(item); continue; }
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, run));
  return skipped;
}

async function cachedProfile(db: SupabaseClient, type: 'job' | 'candidate', id: string, hash: string): Promise<Row | null> {
  const { data } = await db.from('match_v41_profiles').select('profile, input_hash, ai_ok').eq('entity_type', type).eq('entity_id', id).maybeSingle();
  return data && data.input_hash === hash && data.ai_ok ? (data.profile as Row) : null;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');
  const started = Date.now();
  const deadline = started + DEADLINE_MS;

  try {
    // 1. Wer fragt?
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return fail('not_allowed', 'Anmeldung fehlt.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: userData } = await anon.auth.getUser(token);
    const user = userData?.user;
    if (!user) return fail('not_allowed', 'Anmeldung ungültig.');

    const body = await req.json().catch(() => null) as { candidateId?: string; jobIds?: string[]; force?: boolean } | null;
    const candidateId = body?.candidateId;
    if (!candidateId || typeof candidateId !== 'string') return fail('invalid_request', 'candidateId fehlt.');
    const jobIds = Array.isArray(body?.jobIds) ? body!.jobIds!.filter((x) => typeof x === 'string').slice(0, MAX_JOBS) : null;

    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: candidate } = await db.from('candidates').select('*').eq('id', candidateId).maybeSingle();
    if (!candidate) return fail('not_found', 'Kandidat nicht gefunden.');
    if (candidate.recruiter_id !== user.id) {
      const { data: isAdmin } = await db.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return fail('not_allowed', 'Dieser Kandidat gehört nicht zu deinem Konto.');
    }

    // Kostenbremse für „neu berechnen".
    let force = body?.force === true;
    if (force) {
      const { data: last } = await db.from('match_v41_results').select('computed_at').eq('candidate_id', candidateId)
        .order('computed_at', { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - Date.parse(String(last.computed_at)) < FORCE_COOLDOWN_MS) force = false;
    }

    const ai: AiCaller = (call) => aiChat(call);

    // 2. Kandidat verstehen.
    const [{ data: experiences }, { data: skills }, { data: languages }, { data: notesRows }] = await Promise.all([
      db.from('candidate_experiences').select('*').eq('candidate_id', candidateId).order('start_date', { ascending: false }),
      db.from('candidate_skills').select('*').eq('candidate_id', candidateId),
      db.from('candidate_languages').select('*').eq('candidate_id', candidateId),
      db.from('candidate_interview_notes').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false }).limit(1),
    ]);
    const notes = (notesRows?.[0] ?? null) as Row | null;
    const { view, leakContext } = redactCandidateForLLM(candidate, experiences ?? [], skills ?? [], languages ?? [], null, null, 'match-v41');
    const candInput = candidateInputFromRows(candidate, view, languages ?? [], notes, started);
    const leaks = assertNoLeak(buildCandidateSource(candInput), leakContext);
    if (leaks.length) {
      return fail('internal_error', 'Schwärzung unvollständig – kein KI-Aufruf.', { leaks });
    }
    const candHash = await sha({ candInput, v: UNDERSTAND_PROMPT_VERSION, m: MATCH_V41_VERSION });
    let candProfile = (await cachedProfile(db, 'candidate', candidateId, candHash)) as unknown as CandidateProfile | null;
    if (!candProfile) {
      const t = await understandCandidate(candInput, ai);
      candProfile = t.value;
      await db.from('match_v41_profiles').upsert({
        entity_type: 'candidate', entity_id: candidateId, input_hash: candHash, profile: t.value,
        model: t.model, prompt_version: t.prompt_version, ai_ok: t.ai_ok, updated_at: new Date().toISOString(),
      });
    }
    const redacted = candInput.redacted_text ?? '';

    // 3. Live-Stellen verstehen.
    let q = db.from('jobs').select(JOB_COLUMNS).eq('status', 'published').limit(MAX_JOBS);
    if (jobIds?.length) q = q.in('id', jobIds);
    const { data: jobs, error: jobsErr } = await q;
    if (jobsErr) {
      console.error('match-v41: Stellen laden', jobsErr.message);
      return fail('internal_error', 'Stellen konnten nicht geladen werden.', { detail: jobsErr.message });
    }
    const jobRows = (jobs ?? []) as unknown as Row[];

    const jobProfiles = new Map<string, { profile: JobProfile; hash: string; row: Row }>();
    const needProfile: { row: Row; hash: string; input: ReturnType<typeof jobInputFromRow> }[] = [];
    const { data: storedJobProfiles } = await db.from('match_v41_profiles').select('entity_id, profile, input_hash, ai_ok')
      .eq('entity_type', 'job').in('entity_id', jobRows.map((j) => String(j.id)));
    const storedById = new Map((storedJobProfiles ?? []).map((p) => [String(p.entity_id), p]));
    for (const row of jobRows) {
      const input = jobInputFromRow(row, started);
      const hash = await sha({ input, v: UNDERSTAND_PROMPT_VERSION, m: MATCH_V41_VERSION });
      const stored = storedById.get(String(row.id));
      if (stored && stored.input_hash === hash && stored.ai_ok) jobProfiles.set(String(row.id), { profile: stored.profile as JobProfile, hash, row });
      else needProfile.push({ row, hash, input });
    }
    const pendingProfiles = await pool(needProfile.slice(0, MAX_NEW_JOB_PROFILES), async ({ row, hash, input }) => {
      const t = await understandJob(input, ai);
      // Doppelt hält besser: auch in den KI-Texten darf der Kunde nicht vorkommen.
      const tokens = companyMaskTokens(String(row.company_name ?? ''));
      for (const r of t.value.requirements) r.text = maskCompany(r.text, tokens) ?? r.text;
      t.value.dropped = t.value.dropped.map((d) => maskCompany(d, tokens) ?? d);
      jobProfiles.set(String(row.id), { profile: t.value, hash, row });
      await db.from('match_v41_profiles').upsert({
        entity_type: 'job', entity_id: String(row.id), input_hash: hash, profile: t.value,
        model: t.model, prompt_version: t.prompt_version, ai_ok: t.ai_ok, updated_at: new Date().toISOString(),
      });
    }, deadline);
    const pending = new Set<string>([
      ...needProfile.slice(MAX_NEW_JOB_PROFILES).map((n) => String(n.row.id)),
      ...pendingProfiles.map((n) => String(n.row.id)),
    ]);

    // 4. Urteile je Paar.
    const { data: storedResults } = await db.from('match_v41_results').select('job_id, input_hash, result, computed_at').eq('candidate_id', candidateId);
    const resultById = new Map((storedResults ?? []).map((r) => [String(r.job_id), r]));
    const results = new Map<string, MatchV41Result>();
    const toStore: Row[] = [];
    const toJudge: { jobId: string; job: JobProfile; priv: PrivateMatchContext; hash: string; rel: string }[] = [];
    const blocked = (notes?.blocked_companies as string[] | null) ?? [];
    const employers = [candidate.company, ...(experiences ?? []).map((e: Row) => e.company_name)].filter((x): x is string => typeof x === 'string' && !!x);
    let cached = 0;
    let withoutAi = 0;

    for (const [jobId, { profile: job, hash: jobHash, row }] of jobProfiles) {
      const priv: PrivateMatchContext = {
        candidate_blocked_companies: blocked,
        job_company_name: (row.company_name as string | null) ?? null,
        job_nogo_companies: (row.nogo_companies as string[] | null) ?? [],
        candidate_employers: employers,
      };
      const privHash = await sha(priv);
      const hash = await sha({ jobHash, candHash, privHash, j: JUDGE_V41_PROMPT_VERSION, day: Math.floor(started / 86_400_000) });
      const stored = resultById.get(jobId);
      if (!force && stored && stored.input_hash === hash && started - Date.parse(String(stored.computed_at)) < RESULT_TTL_MS) {
        results.set(jobId, stored.result as MatchV41Result);
        cached++;
        continue;
      }
      const frame = evaluateFrame(job, candProfile, priv, started);
      const rel = familyRelation(candProfile.families, job.families);
      if (frame.exclusion || rel === 'different') {
        const res = decideTier(job, candProfile, frame, verifyJudgement(null, job, buildCandidateSection(candProfile, redacted)));
        results.set(jobId, res);
        toStore.push(storeRow(candidateId, jobId, String(candidate.recruiter_id), res, hash, null, false));
        withoutAi++;
        continue;
      }
      toJudge.push({ jobId, job, priv, hash, rel });
    }

    // Gleiche Berufsfamilie zuerst, dann Nachbarn, dann unklare.
    const order = { same: 0, adjacent: 1, unknown: 2 } as Record<string, number>;
    toJudge.sort((a, b) => (order[a.rel] ?? 3) - (order[b.rel] ?? 3));
    let judgedNow = 0;
    const skippedJudge = await pool(toJudge.slice(0, MAX_JUDGE_CALLS), async (p) => {
      const t = await judgePair(p.job, candProfile!, p.priv, redacted, started, ai);
      results.set(p.jobId, t.value);
      if (t.ai_ok) {
        toStore.push(storeRow(candidateId, p.jobId, String(candidate.recruiter_id), t.value, p.hash, t.model, true));
        judgedNow++;
      }
    }, deadline);
    for (const p of [...toJudge.slice(MAX_JUDGE_CALLS), ...skippedJudge]) pending.add(p.jobId);

    if (toStore.length) {
      const { error } = await db.from('match_v41_results').upsert(toStore, { onConflict: 'candidate_id,job_id' });
      if (error) console.error('match-v41: Speichern fehlgeschlagen', error.message);
    }

    // Übersteuerungen des Headhunters.
    const { data: overrides } = await db.from('match_v41_overrides').select('job_id, decision, reason')
      .eq('candidate_id', candidateId).eq('recruiter_id', user.id);
    const overrideById = new Map((overrides ?? []).map((o) => [String(o.job_id), { decision: o.decision, reason: o.reason }]));

    const RANK = { sehr_passend: 0, passend: 1, pruefen: 2, ausgeschlossen: 3 } as const;
    const list = [...results.entries()]
      .map(([job_id, r]) => ({ job_id, ...r, override: overrideById.get(job_id) ?? null }))
      .sort((a, b) => RANK[a.tier] - RANK[b.tier] || b.sort_score - a.sort_score);

    return json({
      version: MATCH_V41_VERSION,
      candidate_id: candidateId,
      results: list,
      pending: [...pending],
      stats: {
        jobs: jobRows.length, cached, judged_now: judgedNow, without_ai: withoutAi, pending: pending.size,
        candidate_understood_by_ai: !!candProfile.families.length, ms: Date.now() - started,
      },
    });
  } catch (e) {
    console.error('match-v41', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Matching fehlgeschlagen.');
  }
});

function storeRow(candidateId: string, jobId: string, recruiterId: string, r: MatchV41Result, hash: string, model: string | null, aiJudged: boolean): Row {
  return {
    candidate_id: candidateId, job_id: jobId, recruiter_id: recruiterId, tier: r.tier, sort_score: r.sort_score,
    confidence: r.confidence, result: r, input_hash: hash, model, prompt_version: JUDGE_V41_PROMPT_VERSION,
    ai_judged: aiJudged, computed_at: new Date().toISOString(),
  };
}
