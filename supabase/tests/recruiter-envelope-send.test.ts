import { sendRecruiterEnvelope } from '../functions/_shared/recruiter-envelope-send.ts';
import { sha256, type RecruiterEnvelope } from '../functions/_shared/recruiter-onboarding-service.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { DocuSignConfig } from '../functions/_shared/docusign.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m);};
async function fixture() {
 const bytes=new TextEncoder().encode('%PDF-test');
 let stored={id:'packet',case_id:'case',revision:0,state:'prepared',envelope_id:null,transaction_id:'tx',create_started_at:null,snapshot:{signer:'Mila',signerEmail:'mila@example.test'},documents:[{role:'framework',name:'contract.pdf',path:'path',sha256:await sha256(bytes)}],recruiter_client_user_id:'recruiter-user',counter_user_id:'admin-user',counter_name:'Admin',counter_email:'admin@example.test'} as RecruiterEnvelope;
 const calls:{path:string;body:Record<string,unknown>}[]=[];
 let loseResponse=false;
 const db={storage:{from:()=>({download:()=>({data:new Blob([bytes]),error:null})})}} as unknown as SupabaseClient;
 const deps={
   patchEnvelope: async(_db:SupabaseClient,e:RecruiterEnvelope,patch:Record<string,unknown>)=>{if(e.revision!==stored.revision)throw Error('Concurrent update');stored={...stored,...patch,revision:e.revision+1};return stored;},
   providerRequest: async(_cfg:DocuSignConfig,path:string,init?:RequestInit)=>{
     const body=JSON.parse(String(init?.body||'{}'));calls.push({path,body});
     if(path==='/envelopes'&&init?.method==='POST'){if(loseResponse)throw Error('timeout');return Response.json({envelopeId:'remote'});}
     if(path.startsWith('/envelopes/status?'))return Response.json({envelopes:[{envelopeId:'remote'}]});
     return Response.json({status:init?.method==='PUT'?'sent':'created'});
   },
   syncEnvelope: async(_db:SupabaseClient,e:RecruiterEnvelope)=>{stored={...e,state:'sent'};return stored;},
 };
 return {db,deps,calls,cfg:{} as DocuSignConfig,get:()=>stored,lose:()=>{loseResponse=true;}};
}
Deno.test('creates one draft with ordered separate signers and persists ID before sending',async()=>{
 const f=await fixture();await sendRecruiterEnvelope(f.db,f.get(),f.cfg,f.deps);
 const payload=f.calls.find(c=>c.path==='/envelopes')!.body;
 const recipients=(payload.recipients as {signers:Record<string,unknown>[]}).signers;
 assert(payload.status==='created');assert(recipients[0].clientUserId==='recruiter-user');assert(recipients[0].embeddedRecipientStartURL==='SIGN_AT_DOCUSIGN');
 assert(recipients[1].clientUserId==='admin-user'&&!recipients[1].embeddedRecipientStartURL);assert(recipients[1].routingOrder==='2');
 assert(f.get().envelope_id==='remote'&&f.get().state==='sent');
});
Deno.test('repeated start uses the stored envelope instead of creating another',async()=>{
 const f=await fixture();await sendRecruiterEnvelope(f.db,f.get(),f.cfg,f.deps);await sendRecruiterEnvelope(f.db,f.get(),f.cfg,f.deps);
 assert(f.calls.filter(c=>c.path==='/envelopes').length===1);
});
Deno.test('lost create response is recovered through the transaction ID',async()=>{
 const f=await fixture();f.lose();await sendRecruiterEnvelope(f.db,f.get(),f.cfg,f.deps).catch(()=>{});
 assert(f.get().state==='creating');await sendRecruiterEnvelope(f.db,f.get(),f.cfg,f.deps);
 assert(f.calls.filter(c=>c.path==='/envelopes').length===1);assert(f.calls.some(c=>c.path.includes('transaction_ids=tx')));
});
Deno.test('two simultaneous starts have only one provider creation',async()=>{
 const f=await fixture();const initial=f.get();await Promise.allSettled([sendRecruiterEnvelope(f.db,initial,f.cfg,f.deps),sendRecruiterEnvelope(f.db,initial,f.cfg,f.deps)]);
 assert(f.calls.filter(c=>c.path==='/envelopes').length===1);
});
Deno.test('changed document bytes block sending before marking creation uncertain',async()=>{
 const f=await fixture();f.get().documents[0].sha256='wrong';let failed=false;
 try{await sendRecruiterEnvelope(f.db,f.get(),f.cfg,f.deps);}catch{failed=true;}
 assert(failed&&f.calls.length===0&&f.get().state==='prepared');
});
