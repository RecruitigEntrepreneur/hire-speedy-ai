/**
 * Rückkehr des Headhunters aus DocuSign (Wireframe freigegeben 25.09.2026).
 *
 * Befund (Luca, Greeners GmbH): Nach „Fertigstellen“ stand die Seite endlos bei
 * „Wir warten auf die bestätigte Rückmeldung von DocuSign“ und bot „Mit DocuSign
 * unterschreiben“ erneut an. Sie fragte nur die eigene Datenbank, nie DocuSign.
 * Jetzt fragt der Server gezielt nach (syncDue), und die Seite sagt, woran sie ist.
 * Seit 30.10.2026 gilt das auch für den Kunden: Sobald die Unterschrift bestätigt
 * ist, geht es von hier direkt ins Dashboard.
 */

/** Nachfragen nach der Unterschrift: gleich drei kurz hintereinander, dann bis 2 Minuten. Danach „dauert länger“. */
export const RETURN_CHECKS_MS = [0, 3_000, 8_000, 20_000, 60_000, 120_000];

/** Ausgänge, nach denen wir bei DocuSign nachfragen. Wer schon unterschrieben hat und den Vertrag noch einmal öffnet, kommt mit `viewing_complete` zurück. */
export const needsSignatureCheck = (event: string) => event === 'signing_complete' || event === 'viewing_complete';

export type SignatureReturn = 'checking' | 'late' | 'cancelled' | 'declined';

/**
 * Was die Vertragsansicht nach der Rückkehr zeigt; null = normale Ansicht.
 * Gilt nur, solange der Vertrag versendet und die Unterschrift noch nicht erkannt
 * ist. DocuSigns `event` beweist keine Unterschrift: „bestätigt“ zeigt die Seite erst,
 * wenn der Server sie bei DocuSign gesehen hat (recruiter_signed_at).
 */
export function signatureReturnView(input: { event: string; state?: string; signedAt?: string | null; late: boolean }): SignatureReturn | null {
  if (!input.event || input.state !== 'sent' || input.signedAt) return null;
  if (input.event === 'signing_complete') return input.late ? 'late' : 'checking';
  // Nur angesehen ist keine Unterschrift, aber auch kein Beweis dagegen: erst nachfragen, sonst Endlosschleife (FB-0015).
  if (input.event === 'viewing_complete') return input.late ? 'cancelled' : 'checking';
  return input.event === 'decline' ? 'declined' : 'cancelled';
}

/** „Unterschrieben am 25.09.2026 um 14:12 Uhr · Greeners GmbH“, Uhrzeit in deutscher Zeit. */
export function signedLine(signedAt: string, company?: string): string {
  const t = new Date(signedAt);
  const day = t.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = t.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  return `Unterschrieben am ${day} um ${time} Uhr${company?.trim() ? ` · ${company.trim()}` : ''}`;
}
