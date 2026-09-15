import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { recruiterCountersigner } from '../functions/_shared/recruiter-countersigner.ts';
import { recruiterConnect } from '../functions/_shared/recruiter-connect.ts';
const assert=(v:unknown)=>{if(!v)throw Error('Assertion failed');};
function setup(options: {email?:string; confirmed?:boolean; admin?:boolean; banned?:string; override?:string} = {}) {
  const vars:Record<string,string>={DOCUSIGN_COUNTERSIGNER_NAME:'Matchunt Signer',DOCUSIGN_COUNTERSIGNER_EMAIL:'signer@example.test', ...(options.override?{RECRUITER_COUNTERSIGNER_USER_ID:options.override}:{})};
  const query={select:()=>query,eq:()=>query,then:(resolve: (v:unknown)=>unknown)=>Promise.resolve({data:options.admin===false?[]:[{user_id:'admin-id'}],error:null}).then(resolve)};
  const db={from:()=>query,auth:{admin:{getUserById:async()=>({data:{user:{id:'admin-id',email:options.email??'signer@example.test',email_confirmed_at:options.confirmed===false?null:'2026-01-01',banned_until:options.banned}},error:null})}}} as unknown as SupabaseClient;
  return {db,env:(key:string)=>vars[key]};
}
Deno.test('reuses the existing customer countersigner only with a verified admin identity',async()=>{
 const f=setup();const result=await recruiterCountersigner(f.db,f.env);assert(result.id==='admin-id'&&result.name==='Matchunt Signer');
});
Deno.test('rejects an unmatched, unconfirmed, banned or non-admin signer',async()=>{
 for(const options of [{email:'other@example.test'},{confirmed:false},{admin:false},{banned:'2999-01-01T00:00:00Z'}]) {
  const f=setup(options);let rejected=false;try{await recruiterCountersigner(f.db,f.env);}catch{rejected=true;}assert(rejected);
 }
});
Deno.test('an explicit recruiter signer override still requires confirmed admin identity',async()=>{
 const f=setup({override:'admin-id',email:'recruiter-counter@example.test'});const result=await recruiterCountersigner(f.db,f.env);assert(result.email==='recruiter-counter@example.test');
 const invalid=setup({override:'admin-id',confirmed:false});let rejected=false;try{await recruiterCountersigner(invalid.db,invalid.env);}catch{rejected=true;}assert(rejected);
});
Deno.test('Connect uses the recruiter listener and HMAC without replacing customer configuration',()=>{
 const vars:Record<string,string>={DOCUSIGN_HMAC_KEY:'test-only',SUPABASE_URL:'https://project.supabase.co/'};
 const config=recruiterConnect(key=>vars[key]);assert(config?.url==='https://project.supabase.co/functions/v1/recruiter-docusign-webhook');assert(config?.includeHMAC==='true'&&config?.eventData.format==='json');assert(config?.events.includes('recipient-completed'));
 assert(!recruiterConnect(()=>undefined));
 let rejected=false;try{recruiterConnect(key=>key==='DOCUSIGN_HMAC_KEY'?'test-only':'http://bad.invalid');}catch{rejected=true;}assert(rejected);
});
