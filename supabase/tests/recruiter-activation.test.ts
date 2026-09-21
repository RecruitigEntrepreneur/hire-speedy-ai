import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { autoActivateRecruiter, profilePatch, welcomeMail } from '../functions/_shared/recruiter-activation.ts';
import type { RecruiterEnvelope } from '../functions/_shared/recruiter-onboarding-service.ts';
import type { sendIntakeMail } from '../functions/_shared/intake-mail.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m);};
type MailArgs=Parameters<typeof sendIntakeMail>[1];
const envelope=(over:Partial<RecruiterEnvelope>={})=>({id:'contract-1',case_id:'case-1',state:'completed',counter_email:'marko.benko@bluewater-bridge.de',...over}) as unknown as RecruiterEnvelope;
const approvedCase={id:'case-1',state:'approved',revoked_at:null,claimed_by:'user-1',email:'danny@example.test',profile:{name:'Danny Beispiel',company:'Beispiel Personal GmbH'}};
function fixture(options:{caseRow?:Record<string,unknown>|null;role?:Record<string,unknown>|null;profile?:Record<string,unknown>|null;granted?:boolean;failCase?:boolean}={}) {
 const mails:MailArgs[]=[];const writes:{table:string;patch:Record<string,unknown>}[]=[];
 const db={from:(table:string)=>{
  let patch:Record<string,unknown>|null=null;
  const result=()=>{
   if(table==='recruiter_onboarding_cases')return options.failCase?{data:null,error:{message:'down'}}:{data:options.caseRow===undefined?approvedCase:options.caseRow,error:null};
   if(table==='user_roles')return patch?{data:options.granted===false?null:{user_id:'user-1'},error:null}:{data:options.role===undefined?{verified:false}:options.role,error:null};
   if(table==='profiles')return patch?{data:null,error:null}:{data:options.profile===undefined?{full_name:'Danny',company_name:''}:options.profile,error:null};
   return {data:null,error:null};
  };
  const q={select:()=>q,eq:()=>q,update:(p:Record<string,unknown>)=>{patch=p;writes.push({table,patch:p});return q;},
   maybeSingle:async()=>result(),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};
  return q;}} as unknown as SupabaseClient;
 const deps={mail:(async(_db:SupabaseClient,args:MailArgs)=>{mails.push(args);return {sent:true};}) as typeof sendIntakeMail,appUrl:()=>'https://matchunt.ai'};
 return {db,deps,mails,writes};
}
Deno.test('only empty fields are filled; a first name from the code login becomes the full name',()=>{
 assert(JSON.stringify(profilePatch({full_name:'Danny',company_name:''},{name:'Danny Beispiel',company:'Beispiel GmbH'}))===JSON.stringify({full_name:'Danny Beispiel',company_name:'Beispiel GmbH'}));
 assert(JSON.stringify(profilePatch({full_name:'',company_name:null},{name:'Danny Beispiel',company:''}))===JSON.stringify({full_name:'Danny Beispiel'}));
 assert(JSON.stringify(profilePatch({full_name:'D. Beispiel',company_name:'Eigene Firma'},{name:'Danny Beispiel',company:'Beispiel GmbH'}))==='{}','self-maintained values stay');
 assert(JSON.stringify(profilePatch({full_name:'Dan',company_name:'x'},{name:'Danny Beispiel'}))==='{}','a different first name stays');
});
Deno.test('the welcome mail greets by first name, explains the way in and escapes',()=>{
 const {subject,html}=welcomeMail({profile:{name:'Danny <b>Beispiel</b>'}} as never,'https://matchunt.ai');
 assert(subject==='Dein Vertrag ist komplett – willkommen bei Matchunt');
 assert(html.includes('Hallo Danny,')&&html.includes('gegengezeichnet')&&html.includes('Leg dein Passwort fest')&&html.includes('Rundgang')&&html.includes('Jetzt anmelden')&&html.includes('https://matchunt.ai/recruiter/login')&&html.includes('Vertrag ansehen'));
 assert(!html.includes('<b>Beispiel</b>'));
});
Deno.test('countersigning activates, completes the profile and welcomes once',async()=>{
 const f=fixture();await autoActivateRecruiter(f.db,envelope(),f.deps);
 const role=f.writes.find(w=>w.table==='user_roles');assert(role?.patch.verified===true&&role.patch.status==='active','role verified');
 const profile=f.writes.find(w=>w.table==='profiles');assert(profile?.patch.full_name==='Danny Beispiel'&&profile.patch.company_name==='Beispiel Personal GmbH','profile filled');
 assert(f.mails.length===1);const m=f.mails[0];
 assert(m.to==='danny@example.test'&&m.template==='recruiter_onboarding_activation'&&m.replyTo==='marko.benko@bluewater-bridge.de');
 assert(m.idempotencyKey==='recruiter-activation/case-1'&&m.meta?.case_id==='case-1');
});
Deno.test('no activation before completion, without approval, for revoked or unclaimed cases, or when already active',async()=>{
 const cases:[Partial<RecruiterEnvelope>,Parameters<typeof fixture>[0]][]=[
  [{state:'sent'},{}],[{},{caseRow:{...approvedCase,state:'review'}}],[{},{caseRow:{...approvedCase,revoked_at:'2026-09-21T10:00:00Z'}}],
  [{},{caseRow:{...approvedCase,claimed_by:null}}],[{},{caseRow:null}],[{},{role:{verified:true}}],[{},{role:null}],
 ];
 for(const [over,options] of cases){const f=fixture(options);await autoActivateRecruiter(f.db,envelope(over),f.deps);assert(f.mails.length===0&&!f.writes.length,JSON.stringify([over,options]));}
});
Deno.test('a vanished role sends no mail, and errors never break the DocuSign sync',async()=>{
 const f=fixture({granted:false});await autoActivateRecruiter(f.db,envelope(),f.deps);assert(f.mails.length===0);
 const g=fixture({failCase:true});await autoActivateRecruiter(g.db,envelope(),g.deps);assert(g.mails.length===0);
 const h=fixture();await autoActivateRecruiter(h.db,envelope(),{...h.deps,mail:async()=>{throw Error('boom');}});
});
