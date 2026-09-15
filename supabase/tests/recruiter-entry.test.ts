import { beginRecruiterCase, resumeRecruiterCase } from '../functions/_shared/recruiter-entry.ts';
import { recruiterAccess } from '../functions/_shared/recruiter-access.ts';
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
const assert=(v:unknown)=>{if(!v)throw Error('Assertion failed');};
const user={id:'user',email:'recruiter@example.test',email_confirmed_at:'2026-01-01',user_metadata:{full_name:'Alex'}} as User;
function fixture(seed:Record<string,Record<string,unknown>[]>={}) {
 const tables:Record<string,Record<string,unknown>[]>={user_roles:[{user_id:'user',role:'recruiter',verified:false,status:'active'}],recruiter_onboarding_cases:[],recruiter_contract_envelopes:[],recruiter_verifications:[],...seed};
 const db={from:(table:string)=>{
  let filters:((row:Record<string,unknown>)=>boolean)[]=[];let insert:Record<string,unknown>|null=null;let update:Record<string,unknown>|null=null;let single=false;
  const q={select:()=>q,eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q;},is:(k:string,v:unknown)=>{filters.push(r=>(r[k]??null)===v);return q;},gt:(k:string,v:string)=>{filters.push(r=>String(r[k])>v);return q;},order:()=>q,limit:()=>q,maybeSingle:()=>{single=true;return q;},single:()=>{single=true;return q;},insert:(v:Record<string,unknown>)=>{insert=v;return q;},update:(v:Record<string,unknown>)=>{update=v;return q;},then:(resolve:(x:unknown)=>unknown)=>{
   let rows=tables[table].filter(r=>filters.every(f=>f(r)));
   if(insert){const row={id:'case',revision:0,revoked_at:null,...insert};tables[table].push(row);rows=[row];}
   if(update)rows.forEach(r=>Object.assign(r,update));
   return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve);
  }};return q;
 }} as unknown as SupabaseClient;return {db,tables};
}
Deno.test('website entry creates an owned draft, without admin approval, and resumes the same case',async()=>{
 const f=fixture();assert(await resumeRecruiterCase(f.db,user)===null);
 const c=await beginRecruiterCase(f.db,user,'individual');assert(c.claimed_by===user.id&&c.created_by===null&&c.state==='draft');assert(c.profile.signerEmail===user.email&&c.profile.name==='Alex');
 assert((await beginRecruiterCase(f.db,user,'agency')).id===c.id);assert(f.tables.recruiter_onboarding_cases.length===1);
});
Deno.test('confirmed account on another device claims its existing invitation and preserves prepared data',async()=>{
 const f=fixture({recruiter_onboarding_cases:[{id:'invite',revision:0,email:user.email,claimed_by:null,revoked_at:null,expires_at:'2999-01-01',profile:{company:'Prepared GmbH'},kind:'agency'}]});
 const c=await beginRecruiterCase(f.db,user,'individual');assert(c.id==='invite'&&c.kind==='agency'&&c.profile.company==='Prepared GmbH');assert(f.tables.recruiter_onboarding_cases.length===1);
});
Deno.test('does not claim expired or unrelated invitations; rejects unconfirmed and non-recruiter accounts',async()=>{
 const f=fixture({recruiter_onboarding_cases:[{id:'old',email:user.email,expires_at:'2000-01-01'},{id:'other',email:'other@example.test',expires_at:'2999-01-01'}]});assert((await beginRecruiterCase(f.db,user,'individual')).id==='case');
 for(const [db,u] of [[fixture({user_roles:[]}).db,user],[fixture().db,{...user,email_confirmed_at:null}]] as [SupabaseClient,User][]) {
  let rejected=false;try{await beginRecruiterCase(db,u,'individual');}catch{rejected=true;}assert(rejected);
 }
});
Deno.test('new account needs completed contract and separate admin activation; existing approved accounts retain access',async()=>{
 const f=fixture();assert(!(await recruiterAccess(f.db,user)).allowed);
 f.tables.user_roles[0].verified=true;assert((await recruiterAccess(f.db,user)).allowed);
 await beginRecruiterCase(f.db,user,'individual');assert(!(await recruiterAccess(f.db,user)).allowed);
 f.tables.recruiter_onboarding_cases[0].state='approved';f.tables.recruiter_contract_envelopes.push({id:'contract',case_id:'case',state:'sent'});assert(!(await recruiterAccess(f.db,user)).allowed);
 f.tables.recruiter_contract_envelopes[0].state='completed';assert((await recruiterAccess(f.db,user)).allowed);
 f.tables.user_roles[0].verified=false;assert(!(await recruiterAccess(f.db,user)).allowed);
 f.tables.user_roles[0].verified=true;f.tables.user_roles[0].status='suspended';assert(!(await recruiterAccess(f.db,user)).allowed);
});
