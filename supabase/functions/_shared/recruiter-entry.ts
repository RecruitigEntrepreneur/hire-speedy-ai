import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanProfile, normalizeEmail } from './recruiter-contract-policy.ts';
import { TEMPLATE_HASH } from './recruiter-contract-templates.ts';
import { generateToken, hashToken } from './tokens.ts';
import { must, dbError, patchCase, type OnboardingCase } from './recruiter-onboarding-service.ts';
import { normLang } from './i18n.ts';
import { rememberProfileLanguage, setCaseLanguage, sourceKey } from './recruiter-language.ts';

/** Sprache aus dem Menü (`lang`) und Kennung des öffentlichen Links (`via`), beide optional. */
export interface EntryOptions { lang?: unknown; via?: unknown }

export async function resumeRecruiterCase(db: SupabaseClient, user: User): Promise<OnboardingCase | null> {
  const {data,error}=await db.from('recruiter_onboarding_cases').select('*')
    .eq('claimed_by',user.id).eq('email',normalizeEmail(user.email!)).is('revoked_at',null)
    .order('created_at',{ascending:false}).limit(1).maybeSingle();
  dbError(error); return data;
}
/**
 * Mehrsprachigkeit (12.11.2026): Ein neuer Vorgang bekommt die Sprache und, wenn
 * der öffentliche Link gilt, dessen Kennung. Ein bestehender Vorgang übernimmt
 * nur eine gewählte Sprache; die Kennung wird nie überschrieben. Fehlen die
 * Spalten noch (Migration nicht angewandt), läuft alles wie vorher.
 */
export async function beginRecruiterCase(db: SupabaseClient, user: User, kind: unknown, opts: EntryOptions = {}): Promise<OnboardingCase> {
  const lang = normLang(opts.lang);
  must(user.email && user.email_confirmed_at, 'Bitte die E-Mail-Adresse bestätigen.', 'not_allowed');
  must(['individual','agency'].includes(String(kind)), 'Bitte Einzelrecruiter oder Agentur auswählen.');
  const {data:role,error:roleError}=await db.from('user_roles').select('user_id').eq('user_id',user.id).eq('role','recruiter').maybeSingle();
  dbError(roleError); must(role,'Für diesen Einstieg benötigen Sie ein Recruiter-Konto.','not_allowed');
  await rememberProfileLanguage(db, user.id, lang);
  const existing=await resumeRecruiterCase(db,user); if(existing) return await setCaseLanguage(db, existing, lang);
  // Confirmed email ownership also lets an invitee resume on a different device.
  // Only valid invitations for that same address may be claimed without the link.
  const {data:invite,error}=await db.from('recruiter_onboarding_cases').select('*')
    .eq('email',normalizeEmail(user.email!)).is('claimed_by',null).is('revoked_at',null)
    .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
  dbError(error);
  if(invite) return await setCaseLanguage(db, await patchCase(db,invite,{claimed_by:user.id,claimed_at:new Date().toISOString(),state:'draft'}), lang);
  const row={
    entry_source:'website',created_by:null,kind, email:normalizeEmail(user.email!),
    claimed_by:user.id,claimed_at:new Date().toISOString(),state:'draft',
    token_hash:await hashToken(generateToken()),expires_at:new Date().toISOString(),
    contract_template_hash:TEMPLATE_HASH,
    profile:cleanProfile({name:user.user_metadata?.full_name??'',signer:user.user_metadata?.full_name??'',signerEmail:user.email}),
  };
  const via=await sourceKey(db,opts.via);
  const extras={...(lang?{language:lang}:{}),...(via?{source_key:via}:{})};
  let {data:created,error:createError}=await db.from('recruiter_onboarding_cases').insert({...row,...extras}).select('*').single();
  // Spalten der Migration fehlen noch: ohne Sprache und Kennung anlegen, der Einstieg geht vor.
  if(createError&&createError.code!=='23505'&&Object.keys(extras).length) {
    console.warn('[recruiter-entry] Sprache/Kennung nicht gespeichert', createError.code??'');
    ({data:created,error:createError}=await db.from('recruiter_onboarding_cases').insert(row).select('*').single());
  }
  if(createError?.code==='23505') {
    const winner=await resumeRecruiterCase(db,user); if(winner) return winner;
  }
  dbError(createError); return created;
}
