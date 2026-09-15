import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanProfile, normalizeEmail } from './recruiter-contract-policy.ts';
import { TEMPLATE_HASH } from './recruiter-contract-templates.ts';
import { generateToken, hashToken } from './tokens.ts';
import { must, dbError, patchCase, type OnboardingCase } from './recruiter-onboarding-service.ts';

export async function resumeRecruiterCase(db: SupabaseClient, user: User): Promise<OnboardingCase | null> {
  const {data,error}=await db.from('recruiter_onboarding_cases').select('*')
    .eq('claimed_by',user.id).eq('email',normalizeEmail(user.email!)).is('revoked_at',null)
    .order('created_at',{ascending:false}).limit(1).maybeSingle();
  dbError(error); return data;
}
export async function beginRecruiterCase(db: SupabaseClient, user: User, kind: unknown): Promise<OnboardingCase> {
  must(user.email && user.email_confirmed_at, 'Bitte die E-Mail-Adresse bestätigen.', 'not_allowed');
  must(['individual','agency'].includes(String(kind)), 'Bitte Einzelrecruiter oder Agentur auswählen.');
  const {data:role,error:roleError}=await db.from('user_roles').select('user_id').eq('user_id',user.id).eq('role','recruiter').maybeSingle();
  dbError(roleError); must(role,'Für diesen Einstieg benötigen Sie ein Recruiter-Konto.','not_allowed');
  const existing=await resumeRecruiterCase(db,user); if(existing) return existing;
  // Confirmed email ownership also lets an invitee resume on a different device.
  // Only valid invitations for that same address may be claimed without the link.
  const {data:invite,error}=await db.from('recruiter_onboarding_cases').select('*')
    .eq('email',normalizeEmail(user.email!)).is('claimed_by',null).is('revoked_at',null)
    .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
  dbError(error);
  if(invite) return await patchCase(db,invite,{claimed_by:user.id,claimed_at:new Date().toISOString(),state:'draft'});
  const {data:created,error:createError}=await db.from('recruiter_onboarding_cases').insert({
    entry_source:'website',created_by:null,kind, email:normalizeEmail(user.email!),
    claimed_by:user.id,claimed_at:new Date().toISOString(),state:'draft',
    token_hash:await hashToken(generateToken()),expires_at:new Date().toISOString(),
    contract_template_hash:TEMPLATE_HASH,
    profile:cleanProfile({name:user.user_metadata?.full_name??'',signer:user.user_metadata?.full_name??'',signerEmail:user.email}),
  }).select('*').single();
  if(createError?.code==='23505') {
    const winner=await resumeRecruiterCase(db,user); if(winner) return winner;
  }
  dbError(createError); return created;
}
