import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CLIENT_DASHBOARD_TEMPLATE, clientDashboardMail, noticeClientDashboardReady, type DashboardMailDeps } from '../functions/_shared/client-dashboard-mail.ts';
import { checkSessionTicket, issueSessionTicket } from '../functions/_shared/client-session-ticket.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m);};
Deno.env.set('INTAKE_TOKEN_PEPPER','test-pepper-mit-genug-laenge-fuer-den-test');
Deno.test('the mail speaks of the framework agreement, the position only as the first one',()=>{
 const {subject,html}=clientDashboardMail({name:'Dragutin',title:'Servicetechniker (m/w/d)',signerName:null},'https://matchunt.ai','schluessel');
 assert(subject==='Ihr Rahmenvertrag ist unterschrieben – Ihr Dashboard ist bereit',subject);
 assert(html.includes('Guten Tag Dragutin,'));
 assert(html.includes('Ihr Rahmenvertrag mit Matchunt ist unterschrieben.'));
 assert(html.includes('Er gilt für alle Positionen, die Sie künftig über Matchunt beauftragen.'));
 assert(html.includes('Ihre erste Position <strong>Servicetechniker (m/w/d)</strong>'));
 assert(!html.includes('Der Vertrag für'),'nicht nur für die Stelle');
 assert(html.includes('https://matchunt.ai/anmelden#schluessel'));
});
Deno.test('another signer is named, unknown titles and names stay out, data is escaped',()=>{
 const anders=clientDashboardMail({name:null,title:null,signerName:'Max <Muster>'},'https://matchunt.ai',null).html;
 assert(anders.includes('ist von Max &lt;Muster&gt; unterschrieben'),anders);
 assert(anders.includes('Guten Tag,')&&anders.includes('Danach prüfen wir Ihre erste Position und'));
 assert(anders.includes('Auf der Seite geben Sie Ihre Adresse ein'));
});
function fixture(o:{sent?:boolean;draft?:Record<string,unknown>|null;profile?:{user_id:string}|null;roles?:string[]}={}) {
 const mails:Parameters<DashboardMailDeps['mail']>[1][]=[];const links:string[]=[];
 const draft=o.draft===undefined?{id:'d1',contact_email:'kontakt@firma.test',contact_name:'Kim Beispiel',title:'Controller',identity_state:'email_verified',company_name:'Firma'}:o.draft;
 const db={from:(table:string)=>{
  const result=()=>table==='email_events'?{data:o.sent?[{id:'x'}]:[],error:null}:table==='user_roles'?{data:(o.roles??['client']).map(role=>({role})),error:null}:{data:null,error:null};
  const q:Record<string,unknown>={select:()=>q,eq:()=>q,ilike:()=>q,not:()=>q,order:()=>q,is:()=>q,limit:()=>q,update:()=>q,insert:async()=>({data:null,error:null}),
   maybeSingle:async()=>({data:table==='intake_drafts'?draft:table==='profiles'?(o.profile===undefined?{user_id:'u1'}:o.profile):null,error:null}),
   then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};
  return q;},
  auth:{admin:{createUser:async()=>({data:{user:{id:'neu'}},error:null})}}} as unknown as SupabaseClient;
 const deps:DashboardMailDeps={mail:async(_d,args)=>{mails.push(args);return {sent:true};},appUrl:()=>'https://matchunt.ai',issueLink:async(_d,userId)=>{links.push(userId);return 'schluessel';}};
 return {db,deps,mails,links};
}
const ARGS={mandateId:'m1',draftId:'d1',signerEmail:'kontakt@firma.test',signerName:'Kim Beispiel'};
Deno.test('sends once to the contact person with a personal link',async()=>{
 const f=fixture();await noticeClientDashboardReady(f.db,ARGS,f.deps);
 assert(f.mails.length===1&&f.links[0]==='u1');const m=f.mails[0];
 assert(m.to==='kontakt@firma.test'&&m.template===CLIENT_DASHBOARD_TEMPLATE&&m.idempotencyKey==='client-dashboard/m1');
 assert(m.meta?.mandate_id==='m1'&&!m.html.includes('von Kim'),'selbst unterschrieben: kein Name');
});
Deno.test('names the signer when someone else signed, and the mail goes to the contact person',async()=>{
 const f=fixture();await noticeClientDashboardReady(f.db,{...ARGS,signerEmail:'chefin@firma.test',signerName:'Eva Chefin'},f.deps);
 assert(f.mails[0].to==='kontakt@firma.test'&&f.mails[0].html.includes('von Eva Chefin'));
});
Deno.test('creates the account when there is none yet',async()=>{
 const f=fixture({profile:null});await noticeClientDashboardReady(f.db,ARGS,f.deps);
 assert(f.links[0]==='neu'&&f.mails.length===1);
});
Deno.test('stays quiet when already sent, unverified, without draft or for a headhunter or admin address',async()=>{
 for(const o of [{sent:true},{draft:null},{draft:{id:'d1',contact_email:'k@f.test',identity_state:'contact_provided'}},{roles:['recruiter']},{roles:['admin']}]){
  const f=fixture(o);await noticeClientDashboardReady(f.db,ARGS,f.deps);assert(f.mails.length===0,JSON.stringify(o));
 }
 const f=fixture();await noticeClientDashboardReady(f.db,{...ARGS,draftId:null},f.deps);assert(f.mails.length===0);
});
Deno.test('the session ticket fits only this draft and address and runs out',async()=>{
 const now=Date.parse('2026-10-30T15:00:00Z');const t=await issueSessionTicket('d1','Kim@Firma.test',now);
 assert(await checkSessionTicket('d1','kim@firma.test',t,now+3_600_000),'same draft, same address');
 assert(!await checkSessionTicket('d2','kim@firma.test',t,now),'other draft');
 assert(!await checkSessionTicket('d1','andere@firma.test',t,now),'other address');
 assert(!await checkSessionTicket('d1','kim@firma.test',t,now+25*3_600_000),'expired');
 for(const bad of [undefined,null,'','abc','123.',`${now+1000}.falsch`]) assert(!await checkSessionTicket('d1','kim@firma.test',bad,now),String(bad));
});
