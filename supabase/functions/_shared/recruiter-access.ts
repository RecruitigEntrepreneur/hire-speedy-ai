import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbError } from './recruiter-onboarding-service.ts';
import { resumeRecruiterCase } from './recruiter-entry.ts';

export async function recruiterAccess(db: SupabaseClient,user:User) {
  const {data:role,error}=await db.from('user_roles').select('verified,status').eq('user_id',user.id).eq('role','recruiter').maybeSingle();
  dbError(error); if(!role || role.status==='suspended') return {allowed:false};
  const c=await resumeRecruiterCase(db,user);
  if(c) {
    const {data:contract,error}=await db.from('recruiter_contract_envelopes').select('id').eq('case_id',c.id).eq('state','completed').limit(1).maybeSingle();
    dbError(error);
    return {allowed:!!contract && c.state==='approved' && role.verified===true};
  }
  // Keep existing approved accounts working; never copy legacy checkboxes into
  // a new DocuSign contract or mark the new workflow complete from them.
  if(role.verified===true)return {allowed:true};
  const {data:v,error:ve}=await db.from('recruiter_verifications').select('info_acknowledged,terms_accepted,nda_accepted,contract_signed,profile_complete,verification_status').eq('recruiter_id',user.id).maybeSingle();
  dbError(ve);
  return {allowed:!!v && v.verification_status==='verified' && (['info_acknowledged','terms_accepted','nda_accepted','contract_signed','profile_complete'] as const).every(k=>v[k]===true)};
}
