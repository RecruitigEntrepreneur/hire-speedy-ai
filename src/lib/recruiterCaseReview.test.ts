import { describe, expect, it } from 'vitest';
import { nextAction, processSteps, reviewGroups, reviewHints } from './recruiterCaseReview';
import type { StoredContract, StoredOnboarding } from './recruiterOnboardingApi';
import { cleanProfile } from '../../supabase/functions/_shared/recruiter-contract-policy';

const profile = (details: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => cleanProfile({
  name: 'Danny Kostic', company: 'KMB Partners GmbH', legalForm: 'GmbH', address: 'Am Wörth 11, 85354 Freising', country: 'Deutschland',
  taxStatus: 'regular', signer: 'Danny Kostic', signerEmail: 'dk@kmb-partners.com', signerRole: 'Geschäftsführer', authorityDeclared: true,
  contractDetails: {
    businessEvidence: 'Handelsregister HRB 12345', taxNumber: 'USt-IdNr. DE367976742', responsiblePerson: 'Danny Kostic-Bagci',
    authorityEvidence: 'Geschäftsführer laut Impressum', insuranceEvidence: 'Kein zusätzlicher Nachweis hinterlegt; wird auf Anfrage nachgereicht.',
    permitsDeclaration: 'Ausschließlich Personalvermittlung, keine Arbeitnehmerüberlassung; keine Erlaubnis nach AÜG erforderlich.',
    incomeConcentration: 'Nein, unter der Hälfte der Erwerbseinkünfte.', dualRole: 'Keine.', privacyContact: 'Danny Kostic',
    accessCountries: 'Deutschland', transferRecord: 'Keine Drittlandzugriffe vorgesehen; Zugriff nur aus EU/EWR.', ...details,
  }, ...extra,
});
const onboarding = (over: Partial<StoredOnboarding> = {}): StoredOnboarding => ({
  id: 'case-danny', revision: 5, entry_source: 'invitation', kind: 'individual', email: 'dk@kmb-partners.com', profile: profile(), state: 'approved',
  feedback: '', contracts: [], created_at: '2026-09-21T08:33:56Z', claimed_at: '2026-09-21T08:35:00Z', reviewed_at: '2026-09-21T12:00:00Z', activated: false, ...over,
});
const contract = (over: Partial<StoredContract> = {}): StoredContract => ({
  id: 'env-1', case_id: 'case-danny', state: 'sent', package_version: '2.1', documents: [], recruiter_client_user_id: 'u', recruiter_signed_at: '2026-09-21T09:23:03Z',
  countersigned_at: null, signed_document_path: null, certificate_path: null, ...over,
});

describe('Vorgangsseite: Angaben in Gruppen', () => {
  it('ordnet jede Prüfung der Gruppe zu, die sie betrifft', () => {
    const groups = reviewGroups(onboarding());
    expect(groups.map(g => g.id)).toEqual(['company', 'signature', 'taxPrivacy', 'activity']);
    expect(groups.find(g => g.id === 'signature')?.checks).toEqual(['identity', 'authority']);
    expect(groups.flatMap(g => g.checks).sort()).toEqual(['authority', 'business', 'identity', 'privacy', 'tax']);
    expect(groups[0].fields[0]).toEqual({ label: 'Firma', value: 'KMB Partners GmbH' });
    expect(groups.find(g => g.id === 'signature')?.fields[0].value).toBe('Danny Kostic, Geschäftsführer');
  });

  it('zeigt Agenturen zusätzlich die Nutzer und lässt leere Felder weg', () => {
    const agency = reviewGroups(onboarding({ kind: 'agency', profile: profile({ userAuthorities: 'Sandra R.: Admin' }) }));
    expect(agency.at(-1)).toMatchObject({ id: 'agency', checks: ['user_authority'] });
    const empty = reviewGroups(onboarding({ profile: profile({ dualRole: '' }) }));
    expect(empty.find(g => g.id === 'activity')?.fields.map(f => f.label)).not.toContain('Verflechtung mit Kunden');
  });
});

describe('Vorgangsseite: Hinweise', () => {
  it('findet bei Danny den abweichenden Namen und den fehlenden Versicherungsnachweis', () => {
    expect(reviewHints(onboarding())).toEqual([
      { group: 'signature', text: 'Name weicht ab: Danny Kostic und Danny Kostic-Bagci' },
      { group: 'activity', text: 'Versicherungsnachweis nicht hinterlegt, auf Anfrage' },
    ]);
  });

  it('bleibt still bei den Standardangaben und meldet Abweichungen', () => {
    const clean = onboarding({ profile: profile({ responsiblePerson: 'Dänny  Kostic', insuranceEvidence: 'Police 123, Allianz' }) });
    expect(reviewHints(clean)).toEqual([]);
    const odd = onboarding({ email: 'danny@privat.de', profile: profile({ responsiblePerson: 'Danny Kostic', insuranceEvidence: 'Police 1', incomeConcentration: 'Ja, rund 70 %', dualRole: 'Beteiligung an der ABC GmbH', transferRecord: 'Drittlandzugriffe möglich', accessCountries: 'USA', permitsDeclaration: 'Erlaubnis nach AÜG vorhanden' }, { authorityDeclared: false }) });
    expect(reviewHints(odd).map(h => h.text)).toEqual([
      'Unterschreibt über eine andere Adresse als das Konto: dk@kmb-partners.com',
      'Vertretungsberechtigung nicht erklärt',
      'Zugriff aus Drittländern angegeben: USA',
      'Eigene Angabe zu Erlaubnissen: Erlaubnis nach AÜG vorhanden',
      'Einkünfte über Matchunt prüfen: Ja, rund 70 %',
      'Verflechtung mit möglichen Kunden: Beteiligung an der ABC GmbH',
    ]);
  });
});

describe('Vorgangsseite: Prozess und nächster Schritt', () => {
  it('zeigt bei Danny die Gegenzeichnung als aktuellen Schritt mit Frist', () => {
    const steps = processSteps(onboarding(), contract(), [{ event: 'case.review', revision: 3, occurred_at: '2026-09-21T09:10:00Z' }]);
    expect(steps.map(s => s.state)).toEqual(['done', 'done', 'done', 'done', 'current', 'open']);
    expect(steps[1].at).toBe('2026-09-21T09:10:00Z');
    expect(steps[4].note).toBe('bis 21.10.2026');
    expect(nextAction(onboarding(), contract())).toEqual({ kind: 'counter', label: 'In DocuSign gegenzeichnen' });
  });

  it('führt durch Prüfung, Warten, Freischalten und Abschluss', () => {
    expect(nextAction(onboarding({ state: 'review' }), contract())).toMatchObject({ kind: 'review', hint: 'Der Headhunter hat schon unterschrieben.' });
    expect(nextAction(onboarding(), contract({ recruiter_signed_at: null }))).toMatchObject({ kind: 'wait', label: 'Wartet auf die Unterschrift des Headhunters' });
    expect(nextAction(onboarding(), null)).toMatchObject({ kind: 'wait', label: 'Der Headhunter startet den Vertrag' });
    expect(nextAction(onboarding(), contract({ state: 'completed', countersigned_at: '2026-09-22T08:00:00Z' }))).toMatchObject({ kind: 'activate' });
    expect(nextAction(onboarding({ activated: true }), contract({ state: 'completed' }))).toMatchObject({ kind: 'done' });
    expect(nextAction(onboarding({ state: 'draft' }), null)).toMatchObject({ kind: 'wait' });
    expect(nextAction(onboarding({ claimed_at: undefined, state: 'invited' }), null)).toMatchObject({ kind: 'wait', label: 'Einladung noch nicht angenommen' });
    expect(nextAction(onboarding({ revoked_at: '2026-09-21T10:00:00Z' }), contract())).toMatchObject({ kind: 'closed' });
    expect(nextAction(onboarding(), contract(), Date.parse('2026-10-22T00:00:00+02:00'))).toMatchObject({ kind: 'closed', label: 'Frist zum Gegenzeichnen abgelaufen' });
    const done = processSteps(onboarding(), contract({ state: 'completed', countersigned_at: '2026-09-22T08:00:00Z' }), []);
    expect(done.map(s => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'current']);
    expect(done[5].note).toBe('danach automatisch');
  });
});
