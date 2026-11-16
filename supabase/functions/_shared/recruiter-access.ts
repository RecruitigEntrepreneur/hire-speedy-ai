import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbError } from './recruiter-onboarding-service.ts';
import { resumeRecruiterCase } from './recruiter-entry.ts';
import { recruiterCounterDeadline } from './recruiter-deadline.ts';

export interface RecruiterAccess { allowed: boolean; pending: boolean }

/**
 * Zugang mit Onboarding-Vorgang (Entscheidung 30.10.2026): Mit der eigenen Unterschrift
 * ist das Dashboard offen, auch während Matchunt prüft. `pending` heißt: nur Ansehen,
 * bis gegengezeichnet und freigeschaltet ist; suchen, Kandidaten anlegen und einreichen
 * sperren die Seite und die Datenbank (Migration 20261116130000). Abgelehnt, zurückgezogen,
 * Rückfrage oder Frist vorbei: zurück auf die Vertragsseite.
 */
export function caseAccess(input: { verified: boolean; caseState: string; contracts: { state: string; recruiter_signed_at: string | null }[]; now: number }): RecruiterAccess {
  const pending = !input.verified;
  if (input.caseState === 'approved' && input.contracts.some(c => c.state === 'completed')) return { allowed: true, pending };
  const signed = input.contracts.find(c => c.state === 'sent' && c.recruiter_signed_at);
  const open = !!signed && ['review', 'approved'].includes(input.caseState)
    && input.now < Date.parse(recruiterCounterDeadline(signed.recruiter_signed_at!));
  return open ? { allowed: true, pending } : { allowed: false, pending: false };
}

export async function recruiterAccess(db: SupabaseClient,user:User): Promise<RecruiterAccess> {
  const {data:role,error}=await db.from('user_roles').select('verified,status').eq('user_id',user.id).eq('role','recruiter').maybeSingle();
  dbError(error); if(!role || role.status==='suspended') return {allowed:false,pending:false};
  const c=await resumeRecruiterCase(db,user);
  if(c) {
    const {data:contracts,error}=await db.from('recruiter_contract_envelopes').select('state,recruiter_signed_at').eq('case_id',c.id);
    dbError(error);
    return caseAccess({verified:role.verified===true,caseState:c.state,contracts:contracts??[],now:Date.now()});
  }
  // Keep existing approved accounts working; never copy legacy checkboxes into
  // a new DocuSign contract or mark the new workflow complete from them.
  if(role.verified===true)return {allowed:true,pending:false};
  const {data:v,error:ve}=await db.from('recruiter_verifications').select('info_acknowledged,terms_accepted,nda_accepted,contract_signed,profile_complete,verification_status').eq('recruiter_id',user.id).maybeSingle();
  dbError(ve);
  return {allowed:!!v && v.verification_status==='verified' && (['info_acknowledged','terms_accepted','nda_accepted','contract_signed','profile_complete'] as const).every(k=>v[k]===true),pending:false};
}
