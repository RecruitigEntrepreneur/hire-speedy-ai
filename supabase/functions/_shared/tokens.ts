/**
 * Token- und Code-Erzeugung fuer die login-freie Jobaufnahme.
 *
 * Uebernimmt das Muster aus organization-invite/index.ts:19-32 — dem einzigen
 * Generator im Repo, der einen CSPRNG benutzt. Die Math.random-Varianten aus
 * send-interview-invitation/index.ts:29-36 und create-offer/index.ts:9-16
 * werden bewusst NICHT kopiert: Math.random ist nicht kryptografisch, der
 * interne Zustand ist aus wenigen Ausgaben rekonstruierbar.
 *
 * In der Datenbank liegt immer nur der Hash. Der Klartext existiert einmal,
 * in der Antwort des erzeugenden Aufrufs.
 */

const B64URL = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 32 Zufallsbytes → 43 Zeichen base64url (256 Bit). */
export const generateToken = (): string => B64URL(crypto.getRandomValues(new Uint8Array(32)));

/**
 * Pfeffer aus der Umgebung. Ohne ihn waere ein gestohlener Datenbank-Dump
 * bei sechsstelligen Codes in Sekunden per Rainbow-Table aufloesbar — der
 * Suchraum ist nur eine Million.
 */
const pepper = (): string => Deno.env.get('INTAKE_TOKEN_PEPPER') ?? '';

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/** Hash eines Zugriffstokens (Link oder Entwurf). */
export const hashToken = (token: string): Promise<string> => sha256Hex(`${pepper()}:token:${token}`);

/** Hash eines Verifizierungscodes, an den Entwurf gebunden. */
export const hashCode = (draftId: string, code: string): Promise<string> =>
  sha256Hex(`${pepper()}:code:${draftId}:${code}`);

/** Hash eines Rate-Limit-Schluessels — IP und E-Mail liegen nie im Klartext. */
export const hashKey = (value: string): Promise<string> => sha256Hex(`${pepper()}:key:${value.toLowerCase()}`);

/**
 * Sechsstelliger numerischer Code, gleichverteilt.
 *
 * Modulo auf einen zufaelligen 32-Bit-Wert waere leicht verzerrt; die
 * Ablehnungsschleife vermeidet das. Bei einer Million moeglichen Codes,
 * 5 Versuchen und 15 Minuten Gueltigkeit ist Raten aussichtslos.
 */
export const generateNumericCode = (digits = 6): string => {
  const max = 10 ** digits;
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return String(value % max).padStart(digits, '0');
};

/** Zeitkonstanter Vergleich zweier Hex-Hashes. */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** SHA-256 ueber beliebigen Text — fuer Snapshot-Pruefsummen. */
export const contentHash = (value: string): Promise<string> => sha256Hex(value);
