import { hashKey, timingSafeEqual } from './tokens.ts';

/**
 * Bindet die Anmeldung aus der Aufnahme an den Browser, der die Adresse per Code
 * bestätigt hat. Der Entwurfs-Link allein reicht nicht: Er lässt sich an einen
 * Entscheider weiterleiten („An Entscheider weiterleiten“), und der darf nicht im
 * Konto der Kontaktperson landen. Ohne Marke geht der Zugang wie bisher per Mail raus.
 *
 * Kein Datenbankfeld: `<ablauf>.<hash>`, der Hash enthält das Geheimnis INTAKE_TOKEN_PEPPER.
 */
export const TICKET_HOURS = 24;

const signature = (draftId: string, email: string, expires: number) =>
  hashKey(`sitzung:${draftId}:${email.trim().toLowerCase()}:${expires}`);

export async function issueSessionTicket(draftId: string, email: string, now = Date.now()): Promise<string> {
  const expires = now + TICKET_HOURS * 3_600_000;
  return `${expires}.${await signature(draftId, email, expires)}`;
}

export async function checkSessionTicket(draftId: string, email: string, ticket: unknown, now = Date.now()): Promise<boolean> {
  if (typeof ticket !== 'string') return false;
  const [expires, hash] = ticket.split('.');
  const until = Number(expires);
  if (!Number.isFinite(until) || !hash || now >= until) return false;
  return timingSafeEqual(hash, await signature(draftId, email, until));
}
