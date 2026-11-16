import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { contractsDueForSync, refreshDueContracts, refreshOpenRecruiterContracts, syncDue, LIST_SYNC_LIMIT } from '../functions/_shared/recruiter-contract-refresh.ts';
import type { RecruiterEnvelope } from '../functions/_shared/recruiter-onboarding-service.ts';
import type { DocuSignConfig } from '../functions/_shared/docusign.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m);};
const NOW=Date.parse('2026-09-21T10:00:00Z');
const ago=(minutes:number)=>new Date(NOW-minutes*60000).toISOString();
const row=(id:string,over:Partial<RecruiterEnvelope>={})=>({id,state:'sent',envelope_id:`env-${id}`,countersigned_at:null,recruiter_signed_at:null,last_synced_at:ago(60),...over}) as RecruiterEnvelope;
Deno.test('only sent envelopes without countersignature and a check at least 15 minutes old are due, oldest first',()=>{
 const due=contractsDueForSync([
  row('fresh',{last_synced_at:ago(14)}),row('old',{last_synced_at:ago(16)}),row('never',{last_synced_at:null}),row('edge',{last_synced_at:ago(15)}),
  row('signed',{recruiter_signed_at:ago(30),last_synced_at:ago(20)}),row('countersigned',{countersigned_at:ago(5)}),
  row('done',{state:'completed'}),row('prepared',{state:'prepared',envelope_id:null}),row('noid',{envelope_id:null}),
 ],NOW);
 assert(due.map(c=>c.id).join()==='never,signed,old,edge',due.map(c=>c.id).join());
 const many=Array.from({length:8},(_,i)=>row(`c${i}`,{last_synced_at:ago(100-i)}));
 assert(contractsDueForSync(many,NOW).length===LIST_SYNC_LIMIT&&contractsDueForSync(many,NOW)[0].id==='c0');
});
Deno.test('the list shows the fresh DocuSign state and keeps the stored one when a check fails',async()=>{
 const contracts=[row('a'),row('b'),row('c',{state:'completed'})];const calls:string[]=[];
 const result=await refreshDueContracts({} as SupabaseClient,contracts,{} as DocuSignConfig,{now:()=>NOW,sync:async(_db,e)=>{
  calls.push(e.id);if(e.id==='b')throw Error('DocuSign down');return {...e,recruiter_signed_at:ago(1),last_synced_at:new Date(NOW).toISOString()};}});
 assert(calls.sort().join()==='a,b');
 assert(result.length===3&&result[0].recruiter_signed_at===ago(1)&&result[1]===contracts[1]&&result[2]===contracts[2]);
});
Deno.test('nothing due means no DocuSign call',async()=>{
 let called=false;const contracts=[row('a',{last_synced_at:ago(1)})];
 const result=await refreshDueContracts({} as SupabaseClient,contracts,{} as DocuSignConfig,{now:()=>NOW,sync:async(_db,e)=>{called=true;return e;}});
 assert(!called&&result===contracts);
});
Deno.test('after the own countersignature one check comes right away, otherwise every 15 minutes',()=>{
 const signed=row('x',{recruiter_signed_at:ago(120),counter_user_id:'admin',last_synced_at:ago(2)} as Partial<RecruiterEnvelope>);
 assert(!syncDue(signed,NOW),'regular: 2 minutes are too early');
 assert(syncDue(signed,NOW,{event:'signing_complete',userId:'admin'}),'back from signing: now');
 assert(!syncDue(signed,NOW,{event:'cancel',userId:'admin'}),'cancelled: no shortcut');
 assert(!syncDue(signed,NOW,{event:'signing_complete',userId:'someone-else'}),'only the countersigner');
 assert(!syncDue({...signed,recruiter_signed_at:null},NOW,{event:'signing_complete',userId:'admin'}),'headhunter has not signed');
 assert(!syncDue({...signed,last_synced_at:new Date(NOW-10_000).toISOString()},NOW,{event:'signing_complete',userId:'admin'}),'at most every 20 seconds');
 assert(syncDue({...signed,last_synced_at:null},NOW),'never checked');
 assert(syncDue({...signed,last_synced_at:ago(15)},NOW),'15 minutes passed');
});
Deno.test('back from the own signature the headhunter gets a check every 3 seconds until it is recognised',()=>{
 const open=row('y',{recruiter_client_user_id:'luca',counter_user_id:'admin',last_synced_at:ago(3)} as Partial<RecruiterEnvelope>);
 assert(!syncDue(open,NOW),'regular: 3 minutes are too early');
 assert(syncDue(open,NOW,{event:'signing_complete',userId:'luca'}),'back from signing: now');
 assert(!syncDue(open,NOW,{event:'cancel',userId:'luca'}),'cancelled: no shortcut');
 assert(!syncDue(open,NOW,{event:'signing_complete',userId:'someone-else'}),'only the headhunter who signs');
 assert(!syncDue(open,NOW,{event:'signing_complete',userId:'admin'}),'countersigner cannot jump ahead of the headhunter');
 assert(!syncDue({...open,recruiter_signed_at:ago(1)},NOW,{event:'signing_complete',userId:'luca'}),'already recognised: back to 15 minutes');
 assert(!syncDue({...open,state:'completed'},NOW,{event:'signing_complete',userId:'luca'}),'closed envelope');
 assert(!syncDue({...open,last_synced_at:new Date(NOW-2_000).toISOString()},NOW,{event:'signing_complete',userId:'luca'}),'at most every 3 seconds');
 assert(syncDue({...open,last_synced_at:new Date(NOW-3_000).toISOString()},NOW,{event:'signing_complete',userId:'luca'}),'3 seconds passed');
 assert(syncDue(open,NOW,{event:'viewing_complete',userId:'luca'}),'reopened after signing: check too');
 assert(!syncDue({...open,recruiter_signed_at:ago(120),last_synced_at:new Date(NOW-10_000).toISOString()},NOW,{event:'viewing_complete',userId:'admin'}),'viewing is no shortcut for the countersigner');
});
Deno.test('the cron checks open headhunter contracts of the last 60 days and tells how many',async()=>{
 const filters:Record<string,unknown>={};const contracts=[row('due'),row('fresh',{last_synced_at:ago(1)})];const calls:string[]=[];
 const q={select:()=>q,eq:(c:string,v:unknown)=>{filters[`eq.${c}`]=v;return q;},not:(c:string,o:string,v:unknown)=>{filters[`not.${c}`]=[o,v];return q;},is:(c:string,v:unknown)=>{filters[`is.${c}`]=v;return q;},
  gte:(c:string,v:unknown)=>{filters[`gte.${c}`]=v;return Promise.resolve({data:contracts,error:null});}};
 const db={from:(t:string)=>{assert(t==='recruiter_contract_envelopes',t);return q;}} as unknown as SupabaseClient;
 const result=await refreshOpenRecruiterContracts(db,{} as DocuSignConfig,{now:()=>NOW,sync:async(_db,e)=>{calls.push(e.id);return e;}});
 assert(result.checked===1&&calls.join()==='due',JSON.stringify({result,calls}));
 assert(filters['eq.state']==='sent'&&filters['is.countersigned_at']===null);
 assert(filters['gte.created_at']===new Date(NOW-60*86_400_000).toISOString());
});
