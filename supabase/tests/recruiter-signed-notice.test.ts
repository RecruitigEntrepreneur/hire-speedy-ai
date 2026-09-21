import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { noticeRecipients, noticeRecruiterSigned, signedNoticeMail, SIGNED_NOTICE_TEMPLATE, type NoticeDeps } from '../functions/_shared/recruiter-signed-notice.ts';
import type { RecruiterEnvelope } from '../functions/_shared/recruiter-onboarding-service.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m);};
const SIGNED='2026-09-21T08:12:00.000Z'; // 10:12 Uhr in Berlin
const envelope=(over:Partial<RecruiterEnvelope>={})=>({id:'contract-1',case_id:'case-1',revision:3,state:'sent',envelope_id:'remote',package_version:'2.1',
 snapshot:{name:'Danny Beispiel',company:'Beispiel Personal GmbH',signer:'Danny Beispiel',signerEmail:'danny@example.test',signerRole:'Geschäftsführer'},
 counter_name:'Marko Benko',counter_email:'admin@example.test',recruiter_signed_at:SIGNED,countersigned_at:null,...over}) as unknown as RecruiterEnvelope;
type MailArgs=Parameters<NoticeDeps['mail']>[1];
function fixture(options:{sent?:string[];caseRow?:Record<string,unknown>|null;failQuery?:boolean;env?:Record<string,string>;now?:number}={}) {
 const mails:MailArgs[]=[];const filters:Record<string,unknown>={};
 const db={from:(table:string)=>{
  const q={select:()=>q,eq:(column:string,value:unknown)=>{filters[`${table}.${column}`]=value;return q;},
   maybeSingle:async()=>({data:options.caseRow===undefined?{state:'review',revoked_at:null}:options.caseRow,error:null}),
   then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(options.failQuery?{data:null,error:{message:'down'}}:{data:(options.sent??[]).map(to_email=>({to_email})),error:null}).then(resolve)};
  return q;}} as unknown as SupabaseClient;
 const deps:Partial<NoticeDeps>={mail:async(_db,args)=>{mails.push(args);return {sent:true};},env:key=>options.env?.[key],now:()=>options.now??Date.parse('2026-09-22T09:00:00Z'),appUrl:()=>'https://matchunt.ai'};
 return {db,deps,mails,filters};
}
const PROD={apiBase:'https://eu.docusign.net/restapi'};
Deno.test('asks Matchunt once to countersign, with link, time, deadline and without case_id',async()=>{
 const f=fixture();await noticeRecruiterSigned(f.db,envelope(),PROD,f.deps);
 assert(f.mails.length===1,'one mail');const m=f.mails[0];
 assert(m.to==='marko.benko@bluewater-bridge.de'&&m.template===SIGNED_NOTICE_TEMPLATE);
 assert(m.subject==='Danny Beispiel hat unterschrieben – bitte gegenzeichnen',m.subject);
 assert(m.html.includes('https://matchunt.ai/admin/recruiters?contract_return=contract-1'),'deep link');
 assert(m.html.includes('am 21.09.2026 um 10:12 Uhr'),'signing time in Berlin');
 assert(m.html.includes('<strong>21.10.2026</strong>'),'last countersign day');
 assert(m.html.includes('„Prüfung abschließen“')&&!m.html.includes('Demo'),'next steps, no demo note');
 assert(m.idempotencyKey==='recruiter-signed/contract-1/marko.benko@bluewater-bridge.de');
 assert(m.meta?.contract_id==='contract-1'&&!('case_id' in (m.meta??{})),'not listed as a headhunter mail');
 assert(f.filters['email_events.template_name']===SIGNED_NOTICE_TEMPLATE&&f.filters['email_events.status']==='sent'&&f.filters['email_events.metadata->>contract_id']==='contract-1');
});
Deno.test('does not ask twice once the notice reached that address',async()=>{
 const f=fixture({sent:['Marko.Benko@bluewater-bridge.de']});await noticeRecruiterSigned(f.db,envelope(),PROD,f.deps);assert(f.mails.length===0);
});
Deno.test('stays quiet without a confirmed signature, after countersigning, for a revoked case or once the deadline passed',async()=>{
 const cases:[Partial<RecruiterEnvelope>,Parameters<typeof fixture>[0]][]=[
  [{recruiter_signed_at:null},{}],[{countersigned_at:'2026-09-22T08:00:00Z'},{}],[{state:'completed'},{}],[{state:'manual_review'},{}],
  [{},{caseRow:{state:'review',revoked_at:'2026-09-21T09:00:00Z'}}],[{},{caseRow:null}],[{},{now:Date.parse('2026-10-21T22:00:00Z')}],
 ];
 for(const [over,options] of cases){const f=fixture(options);await noticeRecruiterSigned(f.db,envelope(over),PROD,f.deps);assert(f.mails.length===0,JSON.stringify([over,options]));}
 const last=fixture({now:Date.parse('2026-10-21T21:59:59Z')});await noticeRecruiterSigned(last.db,envelope(),PROD,last.deps);assert(last.mails.length===1,'last second still counts');
});
Deno.test('names what is left after the review and warns while DocuSign runs in the demo',async()=>{
 const f=fixture({caseRow:{state:'approved',revoked_at:null}});await noticeRecruiterSigned(f.db,envelope(),{apiBase:'https://demo.docusign.net/restapi'},f.deps);
 const html=f.mails[0].html;assert(html.includes('schon erledigt')&&!html.includes('„Prüfung abschließen“'));assert(html.includes('Demo-Umgebung'));
});
Deno.test('RECRUITER_NOTIFY_EMAIL replaces the default and each address is asked once',async()=>{
 assert(noticeRecipients(()=>undefined).join()==='marko.benko@bluewater-bridge.de');
 assert(noticeRecipients(k=>k==='RECRUITER_NOTIFY_EMAIL'?' A@x.de, b@y.de,kaputt, a@x.de':undefined).join()==='a@x.de,b@y.de');
 const f=fixture({env:{RECRUITER_NOTIFY_EMAIL:'a@x.de,b@y.de'},sent:['a@x.de']});await noticeRecruiterSigned(f.db,envelope(),PROD,f.deps);
 assert(f.mails.length===1&&f.mails[0].to==='b@y.de'&&f.mails[0].idempotencyKey==='recruiter-signed/contract-1/b@y.de');
});
Deno.test('a failing lookup or mail never breaks the DocuSign sync',async()=>{
 const f=fixture({failQuery:true});await noticeRecruiterSigned(f.db,envelope(),PROD,f.deps);assert(f.mails.length===0);
 const g=fixture();await noticeRecruiterSigned(g.db,envelope(),PROD,{...g.deps,mail:async()=>{throw Error('boom');}});
});
Deno.test('headhunter data is escaped and a different signer is named',()=>{
 const e=envelope({snapshot:{name:'<b>Eve</b>',company:'A & B',signer:'Max <script>',signerEmail:'x@y.de',signerRole:'GF'}} as unknown as Partial<RecruiterEnvelope>);
 const {html,subject}=signedNoticeMail(e,{approved:false,demo:false,appUrl:'https://matchunt.ai'});
 assert(!html.includes('<b>Eve</b>')&&html.includes('&lt;b&gt;Eve&lt;/b&gt; (A &amp; B)')&&!html.includes('<script>'));
 assert(html.includes('Unterschrieben hat Max &lt;script&gt;, GF.'));assert(subject==='<b>Eve</b> hat unterschrieben – bitte gegenzeichnen');
});
