import {describe,it,expect} from 'vitest';
import {generationProfile as p} from './recruiterGenerationFixture';
import {contractDataIssues,contractValues,cleanContractDetails} from '../../supabase/functions/_shared/recruiter-contract-data';
import {generateRecruiterContract} from '../../supabase/functions/_shared/recruiter-pdf';
import {PDFDocument} from 'pdf-lib';
describe('Personal contract generation',()=>{
 it('requires all actual agency details before producing documents',()=>{
   expect(contractDataIssues(p,'agency')).toEqual([]);
   expect(contractDataIssues({...p,contractDetails:undefined},'agency').length).toBeGreaterThan(5);
   expect(()=>contractValues('id',{...p,signerEmail:''},'mila@example.test','agency')).toThrow();
 });
 it('preserves identity and never invents consent or banking details',()=>{
   const data=contractValues('CASE',p,'mila@example.test','agency');
   expect(data.company).toBe('Kovačić & Partner GmbH');expect(data.signer_name).toBe('Mila Kovačić');
   expect(data.directory_consent).toBe('Nicht erteilt');expect(data.credit_note_consent).toContain('Keine Zustimmung');
   expect(data.payout_account).toContain('verifiziert');expect(data.contact_email).toBe('mila@example.test');
   expect(cleanContractDetails({directoryConsent:'true'}).directoryConsent).toBe(false);
 });
 it('does not allow personal input to insert additional signature fields',()=>{
   expect(()=>contractValues('CASE',{...p,company:'/matchunt_sign/'},'mila@example.test','agency')).toThrow(/Signaturmarkierungen/);
 });
 it('generates exactly seven complete PDF documents with Unicode fonts',async()=>{
   const result=await generateRecruiterContract('TEST-AUTO',p,'mila@example.test','agency');
   expect(result.map(d=>d.role)).toEqual(['framework','data','pricing','rules','privacy','terms','brand']);
   for(const doc of result){const parsed=await PDFDocument.load(doc.bytes);expect(parsed.getPageCount()).toBeGreaterThan(0);expect(parsed.getTitle()).toContain(p.company);}
 },15000);
});
