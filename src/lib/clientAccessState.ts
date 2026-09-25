/**
 * Block „Zugang des Kunden“ in der Jobaufnahme (Admin, Entscheidung 25.09.2026):
 * Wo steht der Kunde auf dem Weg von der Gegenzeichnung in sein Dashboard?
 * Die Antwort von intake-admin `access_status` in einen Stand übersetzt.
 */

export interface IntakeAccess {
  account: {
    user_id: string; email: string | null; roles: string[];
    created_at: string | null; last_sign_in_at: string | null; password_set_at: string | null;
  } | null;
  mail: { created_at: string; status: string; error_message: string | null; to_email: string } | null;
  countersigned: boolean;
  signature_required: boolean;
  accepted: boolean;
}

export type AccessState =
  | 'held'              // Adresse gehört zu einem Headhunter-Konto: Mail angehalten
  | 'waiting_contract'  // Gegenzeichnung fehlt noch; die Mail kommt mit ihr
  | 'waiting_accept'    // gegengezeichnet, aber nicht angenommen (Annahme gescheitert)
  | 'missing'           // angenommen und gezeichnet, aber keine Zugangsmail (etwa vor dem 25.09.2026)
  | 'failed'            // Versand gescheitert
  | 'sent';

export function accessState(a: IntakeAccess): AccessState {
  if (a.account?.roles.includes('recruiter')) return 'held';
  if (a.signature_required && !a.countersigned) return 'waiting_contract';
  if (!a.accepted) return 'waiting_accept';
  if (!a.mail) return 'missing';
  return a.mail.status === 'sent' ? 'sent' : 'failed';
}

export const ACCESS_LABEL: Record<AccessState, string> = {
  held: 'Angehalten',
  waiting_contract: 'Wartet auf Gegenzeichnung',
  waiting_accept: 'Nicht angenommen',
  missing: 'Noch keine Zugangsmail',
  failed: 'Versand gescheitert',
  sent: 'Mail gesendet',
};
