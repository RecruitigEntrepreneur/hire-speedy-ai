import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { contractsDueForSync, refreshDueContracts, LIST_SYNC_LIMIT } from '../functions/_shared/recruiter-contract-refresh.ts';
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
