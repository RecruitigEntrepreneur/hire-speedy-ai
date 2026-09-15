import { recruiterCountersigner } from './recruiter-countersigner.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TEMPLATE_HASH, TEMPLATE_VERSION } from './recruiter-contract-templates.ts';
import { generateRecruiterContract } from './recruiter-pdf.ts';
import { normalizeEmail, type ContractDocument } from './recruiter-contract-policy.ts';
import { must, dbError, sha256, type OnboardingCase, type RecruiterEnvelope } from './recruiter-onboarding-service.ts';

export async function ensureRecruiterPackage(db: SupabaseClient, c: OnboardingCase): Promise<RecruiterEnvelope> {
  must(['review','approved'].includes(c.state) && !c.revoked_at && c.claimed_by, 'Bitte zuerst die Vertragsdaten bestätigen.', 'conflict');
  const existing = async () => { const {data,error}=await db.from('recruiter_contract_envelopes').select('*').eq('case_id',c.id).not('state','in','(declined,voided)').maybeSingle(); dbError(error); return data as RecruiterEnvelope|null; };
  const previous=await existing(); if(previous) return previous;
  must(c.contract_template_hash === TEMPLATE_HASH, 'Die zugeordnete Vertragsfassung muss vom Matchunt-Team aktualisiert werden.', 'conflict');
  const {id:counterId,name:counterName,email:counterEmail}=await recruiterCountersigner(db);
  must(counterEmail!==c.profile.signerEmail,'Recruiter und Matchunt benötigen getrennte Unterzeichner.');
  const id=crypto.randomUUID();
  const rendered=await generateRecruiterContract(id,c.profile,c.email,c.kind);
  const documents:ContractDocument[]=[];
  for(const item of rendered) {
    const path=`${c.id}/${id}/${item.role}.pdf`;
    const {error}=await db.storage.from('recruiter-contracts').upload(path,item.bytes,{contentType:'application/pdf',upsert:false});dbError(error);
    documents.push({role:item.role,name:item.name,path,sha256:await sha256(item.bytes)});
  }
  const {data,error}=await db.from('recruiter_contract_envelopes').insert({id,case_id:c.id,package_version:TEMPLATE_VERSION,source_reference:`Automatisch aus bestätigten Angaben; zugeordnete Vertragsvorlage SHA-256 ${TEMPLATE_HASH}`,snapshot:c.profile,documents,approved_by:c.created_by,recruiter_client_user_id:normalizeEmail(c.email)===normalizeEmail(c.profile.signerEmail)?c.claimed_by:null,counter_user_id:counterId,counter_name:counterName,counter_email:counterEmail}).select('*').single();
  if(error?.code === '23505') {
    // A concurrent attempt has persisted its own packet. Remove ONLY our losing,
    // definitely uncommitted files; ambiguous errors retain files for recovery.
    await db.storage.from('recruiter-contracts').remove(documents.map(d=>d.path));
    const winner=await existing(); if(winner) return winner;
  }
  dbError(error); return data as RecruiterEnvelope;
}
