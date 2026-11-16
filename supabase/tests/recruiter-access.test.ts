import { caseAccess } from '../functions/_shared/recruiter-access.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m);};
const SIGNED='2026-10-30T14:50:47Z';const NOW=Date.parse('2026-10-30T15:00:00Z');
const sent=[{state:'sent',recruiter_signed_at:SIGNED}];
const same=(a:unknown,b:unknown)=>assert(JSON.stringify(a)===JSON.stringify(b),`${JSON.stringify(a)} statt ${JSON.stringify(b)}`);
Deno.test('with the own signature the dashboard is open, view only, also during the review',()=>{
 same(caseAccess({verified:false,caseState:'review',contracts:sent,now:NOW}),{allowed:true,pending:true});
 same(caseAccess({verified:false,caseState:'approved',contracts:sent,now:NOW}),{allowed:true,pending:true});
});
Deno.test('without a recognised signature it stays closed',()=>{
 same(caseAccess({verified:false,caseState:'review',contracts:[{state:'sent',recruiter_signed_at:null}],now:NOW}),{allowed:false,pending:false});
 same(caseAccess({verified:false,caseState:'review',contracts:[],now:NOW}),{allowed:false,pending:false});
 same(caseAccess({verified:false,caseState:'draft',contracts:[{state:'prepared',recruiter_signed_at:null}],now:NOW}),{allowed:false,pending:false});
});
Deno.test('a question from Matchunt, a closed contract or a passed deadline take him back to the contract page',()=>{
 same(caseAccess({verified:false,caseState:'draft',contracts:sent,now:NOW}),{allowed:false,pending:false});
 for(const state of ['declined','voided','manual_review']) same(caseAccess({verified:false,caseState:'review',contracts:[{state,recruiter_signed_at:SIGNED}],now:NOW}),{allowed:false,pending:false});
 same(caseAccess({verified:false,caseState:'review',contracts:sent,now:Date.parse('2026-12-15T00:00:00Z')}),{allowed:false,pending:false});
});
Deno.test('countersigned and activated means everything is free',()=>{
 same(caseAccess({verified:true,caseState:'approved',contracts:[{state:'completed',recruiter_signed_at:SIGNED}],now:NOW}),{allowed:true,pending:false});
 same(caseAccess({verified:false,caseState:'approved',contracts:[{state:'completed',recruiter_signed_at:SIGNED}],now:NOW}),{allowed:true,pending:true});
});
Deno.test('an account that is already free keeps acting while it signs a new contract',()=>{
 same(caseAccess({verified:true,caseState:'review',contracts:sent,now:NOW}),{allowed:true,pending:false});
});
