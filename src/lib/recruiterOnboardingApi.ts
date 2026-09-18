import { supabase } from '@/integrations/supabase/client';
import type { RecruiterProfile, ContractDocument } from '../../supabase/functions/_shared/recruiter-contract-policy';
import type { MailStat } from '../../supabase/functions/_shared/email-stats';
export type { RecruiterProfile };
export const profileLabels: Record<Exclude<keyof RecruiterProfile, 'contractDetails' | 'expertise'>, string> = {
  name: 'Kontaktname', company: 'Vertragspartner / Firma', legalForm: 'Rechtsform', address: 'Vollständige Geschäftsanschrift', country: 'Sitzland',
  taxStatus: 'Steuerstatus', signer: 'Name der unterzeichnenden Person', signerEmail: 'E-Mail der unterzeichnenden Person', signerRole: 'Funktion / Vertretung',
  authorityDeclared: 'Vertretungsberechtigung angegeben', specialty: 'Recruiting-Schwerpunkt', region: 'Zielregion',
};
export const documentLabels: Record<string, string> = { framework: 'Rahmenvertrag', data: 'Anlage 1 · Datenblatt', pricing: 'Anlage 2 · Konditionenblatt', rules: 'Anlage 3 · Plattformregeln', privacy: 'Anlage 4 · Datenschutzvereinbarung', terms: 'Anlage 5 · Nutzungsbedingungen', brand: 'Anlage 6 · Markenrichtlinie' };
export const stateLabels: Record<string, string> = { invited: 'Eingeladen', draft: 'Angaben ergänzen', review: 'Prüfung offen', approved: 'Angaben geprüft', prepared: 'Vertragspaket vorbereitet', creating: 'DocuSign-Erstellung prüfen', sent: 'Unterschriften offen', completed: 'Vertrag vollständig unterzeichnet', declined: 'Abgelehnt', voided: 'Zurückgezogen', manual_review: 'Manuelle Klärung erforderlich' };
export interface StoredContract {
  id: string; case_id: string; state: string; package_version: string; documents: ContractDocument[];
  recruiter_client_user_id: string | null; recruiter_signed_at: string | null; countersigned_at: string | null;
  signed_document_path: string | null; certificate_path: string | null; source_reference?: string;
}
export interface StoredOnboarding {
  id: string; revision: number; entry_source?: 'invitation' | 'website'; kind: string; email: string; profile: RecruiterProfile; state: string;
  feedback: string; revoked_at?: string; expires_at?: string; claimed_at?: string; contracts: StoredContract[];
  /** Nur in der Admin-Liste. */
  created_at?: string; reviewed_at?: string | null; internal_note?: string; checks?: Record<string, unknown>;
  /** Recruiter-Rolle freigeschaltet (eigener Admin-Schritt nach der Gegenzeichnung). */
  activated?: boolean;
  /** Nur in der Admin-Liste: jüngste Einladungsmail, null wenn keine verschickt wurde. Fehlt das Feld, kennt der Server es noch nicht. */
  mail?: MailStat | null;
}
export type InvitationStatus = 'open' | 'claimed' | 'expired' | 'revoked';
/** Vorschau der Einladung ohne Sitzung: nur Vorname, maskierte Adresse, Status. */
export interface InvitationPeek { name: string; masked_email: string; expires_at: string; status: InvitationStatus }
/** Sitzung nach geprüftem Code; wird mit supabase.auth.setSession übernommen. */
export interface CodeSession { access_token: string; refresh_token: string; expires_in: number | null }
export async function onboardingApi<T>(admin: boolean, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(admin ? 'recruiter-onboarding-admin' : 'recruiter-onboarding', { body });
  if (error) {
    let message = 'Die Onboarding-Anbindung ist gerade nicht erreichbar. Bitte später erneut versuchen.';
    if (error.context instanceof Response) {
      const detail = await error.context.clone().json().catch(() => null);
      if (typeof detail?.message === 'string') message = detail.message;
    }
    throw new Error(message);
  }
  return data as T;
}

/** Eintrag aus recruiter_onboarding_audit: jeder Zustandswechsel von Vorgang (case.*) und Vertrag (contract.*). */
export interface AuditEntry { event: string; revision: number; occurred_at: string }
