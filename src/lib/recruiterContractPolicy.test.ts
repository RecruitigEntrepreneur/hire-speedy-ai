import { describe, expect, it } from 'vitest';
import { canOpenRecruiterSignature, cleanProfile, DOCUMENT_ROLES, packageIssues, profileIssues, signingEvidence, requiredReviewChecks, type ProviderSigner } from '../../supabase/functions/_shared/recruiter-contract-policy';

const now = Date.parse('2026-09-15T12:00:00Z');
const signer = (id: string, email: string, signed?: string): ProviderSigner => ({ recipientId: id, email, status: signed ? 'completed' : 'sent', signedDateTime: signed });
const valid = [signer('1','recruiter@example.test','2026-09-14T10:00:00Z'),signer('2','matchunt@example.test','2026-09-15T10:00:00Z')];
const evidence = (status: string, recipients = valid) => signingEvidence(status, recipients, 'recruiter@example.test', 'matchunt@example.test', now);
describe('Recruiter DocuSign evidence', () => {
  it('requires both expected recipients and an authoritative completed envelope', () => {
    expect(evidence('completed').completed).toBe(true);
    expect(evidence('sent').completed).toBe(false);
    expect(evidence('completed',[valid[0],signer('2','matchunt@example.test')]).completed).toBe(false);
  });
  it('rejects substitutions, extra and duplicate recipients', () => {
    expect(() => evidence('completed',[valid[0],{ ...valid[1],email:'attacker@example.test' }])).toThrow();
    expect(() => evidence('completed',[...valid, signer('3','stranger@example.test')])).toThrow();
    expect(() => evidence('completed',[valid[0],valid[0]])).toThrow();
  });
  it('rejects missing and future signed timestamps', () => {
    expect(() => evidence('completed',[{ ...valid[0],signedDateTime:undefined },valid[1]])).toThrow();
    expect(() => evidence('completed',[valid[0],{ ...valid[1],signedDateTime:'2026-10-01T10:00:00Z' }])).toThrow();
  });
  it('rejects countersignature without or before recruiter signature', () => {
    expect(() => evidence('completed',[signer('1','recruiter@example.test'), valid[1]])).toThrow();
    expect(() => evidence('completed',[valid[0],{ ...valid[1], signedDateTime:'2026-09-13T10:00:00Z' }])).toThrow();
  });
  it('quarantines completion at the calendar deadline, but accepts the preceding instant', () => {
    const run = (at: string) => signingEvidence('completed', [signer('1','recruiter@example.test','2026-08-16T10:00:00Z'),signer('2','matchunt@example.test',at)],'recruiter@example.test','matchunt@example.test',Date.parse('2026-09-16T12:00:00Z'));
    expect(run('2026-09-15T22:00:00Z').late).toBe(true);
    expect(run('2026-09-15T21:59:59.999Z').completed).toBe(true);
  });
  it('does not turn cancellation/decline into completion', () => {
    expect(evidence('voided').terminal).toBe('voided');
    expect(evidence('declined').completed).toBe(false);
  });
});
describe('Released recruiter package', () => {
  it('requires privacy review and separate user authority for agencies', () => {
    expect(requiredReviewChecks('individual')).toContain('privacy');
    expect(requiredReviewChecks('individual')).not.toContain('user_authority');
    expect(requiredReviewChecks('agency')).toEqual(expect.arrayContaining(['privacy','user_authority']));
  });
  const docs = DOCUMENT_ROLES.map(role => ({ role, path:`case/packet/${role}.pdf`,name:`${role}.pdf`,sha256:'a'.repeat(64) }));
  it('requires every annex rather than only a framework document', () => {
    expect(packageIssues(docs,'case/packet')).toEqual([]);
    expect(packageIssues(docs.slice(0,5),'case/packet').length).toBeGreaterThan(0);
  });
  it('rejects cross-case paths, traversal, duplicate documents and missing hashes', () => {
    expect(packageIssues([{ ...docs[0],path:'other/packet/framework.pdf' },...docs.slice(1)],'case/packet').length).toBeGreaterThan(0);
    expect(packageIssues([{ ...docs[0],path:'case/packet/../other.pdf' },...docs.slice(1)],'case/packet').length).toBeGreaterThan(0);
    expect(packageIssues([...docs,docs[0]],'case/packet').length).toBeGreaterThan(0);
    expect(packageIssues([{ ...docs[0],sha256:'' },...docs.slice(1)],'case/packet').length).toBeGreaterThan(0);
  });
  it('does not treat an open tax status or a string boolean as an approval', () => {
    const profile = cleanProfile({ name:'Alex',company:'Alex Recruiting',legalForm:'Einzelunternehmen',address:'Teststraße 1',country:'DE', signer:'Alex', signerEmail:' alex@example.test ', signerRole:'Inhaber',authorityDeclared:'true',taxStatus:'open',internal_note:'secret',verified:true });
    expect(profile.signerEmail).toBe('alex@example.test');
    expect(profileIssues(profile)).toHaveLength(2);
    expect(profile).not.toHaveProperty('verified'); expect(profile).not.toHaveProperty('internal_note');
    expect(profileIssues({ ...profile,authorityDeclared:true,taxStatus:'regular' })).toEqual([]);
  });
});

describe('Embedded recruiter signing access', () => {
  const own = { userId: 'contact', userEmail: 'alex@example.test', claimedBy: 'contact', clientUserId: 'contact', signerEmail: 'alex@example.test', state: 'sent', signedAt: null };
  it('allows only the assigned, verified account for a still-open recipient', () => {
    expect(canOpenRecruiterSignature(own)).toBe(true);
    for (const patch of [{ userId: 'other' }, { claimedBy: 'other' }, { clientUserId: null }, { signerEmail: 'director@example.test' }, { state: 'completed' }, { state: 'voided' }, { signedAt: '2026-09-15T12:00:00Z' }]) expect(canOpenRecruiterSignature({ ...own, ...patch })).toBe(false);
  });
  it('requires the brand annex in the complete v2.1 package', () => {
    const docs = DOCUMENT_ROLES.filter(role => role !== 'brand').map(role => ({ role, path:`case/packet/${role}.pdf`, name:`${role}.pdf`, sha256:'a'.repeat(64) }));
    expect(packageIssues(docs,'case/packet').some(issue => issue.includes('brand'))).toBe(true);
  });
});
