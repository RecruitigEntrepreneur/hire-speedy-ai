import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

/**
 * DocuSign — Anmeldung, Umschlag, eingebettete Unterschrift.
 *
 * Anmeldung ueber JWT Grant (Service-Integration): kein Nutzer-Login, kein
 * Refresh-Token, kein Zustand zwischen Aufrufen ausser dem zwischengespeicherten
 * Zugriffstoken. Das passt zu einer Edge Function, die kalt startet.
 *
 * Die Reihenfolge der Unterschriften wird DOPPELT durchgesetzt: bei DocuSign
 * ueber routingOrder (Matchunt sieht den Umschlag erst, wenn der Kunde
 * unterschrieben hat) und in unserer Datenbank ueber framework_guard und die
 * CHECK-Constraints. Das ist keine Doppelung aus Unsicherheit -- die Datenbank
 * muss auch dann richtig bleiben, wenn ein Webhook ausbleibt, doppelt kommt
 * oder in falscher Reihenfolge eintrifft.
 *
 * Benoetigte Secrets:
 *   DOCUSIGN_INTEGRATION_KEY  Integration Key (Client-ID) der App
 *   DOCUSIGN_USER_ID          GUID des Nutzers, in dessen Namen gehandelt wird
 *   DOCUSIGN_ACCOUNT_ID       API-Account-ID (nicht die Account-Nummer)
 *   DOCUSIGN_PRIVATE_KEY      RSA-Privatschluessel im PEM-Format
 *   DOCUSIGN_OAUTH_BASE       account-d.docusign.com (Demo) | account.docusign.com
 *   DOCUSIGN_API_BASE         https://demo.docusign.net/restapi | https://<region>.docusign.net/restapi
 *   DOCUSIGN_HMAC_KEY         Connect-Schluessel zur Pruefung der Webhooks
 */

export interface DocuSignConfig {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  oauthBase: string;
  apiBase: string;
}

export function docusignConfig(): DocuSignConfig | null {
  const c = {
    integrationKey: Deno.env.get('DOCUSIGN_INTEGRATION_KEY') ?? '',
    userId: Deno.env.get('DOCUSIGN_USER_ID') ?? '',
    accountId: Deno.env.get('DOCUSIGN_ACCOUNT_ID') ?? '',
    privateKey: Deno.env.get('DOCUSIGN_PRIVATE_KEY') ?? '',
    oauthBase: Deno.env.get('DOCUSIGN_OAUTH_BASE') ?? 'account-d.docusign.com',
    apiBase: Deno.env.get('DOCUSIGN_API_BASE') ?? 'https://demo.docusign.net/restapi',
  };
  if (!c.integrationKey || !c.userId || !c.accountId || !c.privateKey) return null;
  return c;
}

// ---------------------------------------------------------------------------
// Schluessel einlesen
// ---------------------------------------------------------------------------
/** DER-Laengenfeld nach X.690. */
function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  let v = n;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  return [0x80 | bytes.length, ...bytes];
}

/**
 * PKCS#1 in PKCS#8 verpacken.
 *
 * DocuSign gibt den Schluessel als "BEGIN RSA PRIVATE KEY" aus -- das ist
 * PKCS#1. WebCrypto importiert nur PKCS#8. Statt den Nutzer zur Umwandlung mit
 * openssl aufzufordern (und damit einen Schritt einzubauen, den man falsch
 * machen kann), wird hier der ASN.1-Rahmen ergaenzt:
 *   SEQUENCE { INTEGER 0, SEQUENCE { OID rsaEncryption, NULL }, OCTET STRING { key } }
 */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const version = [0x02, 0x01, 0x00];
  const octet = [0x04, ...derLength(pkcs1.length), ...pkcs1];
  const inner = [...version, ...algId, ...octet];
  return new Uint8Array([0x30, ...derLength(inner.length), ...inner]);
}

async function importKey(pem: string): Promise<CryptoKey> {
  const clean = pem.replace(/\\n/g, '\n').trim();
  const body = clean.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  if (!body) throw new Error('DOCUSIGN_PRIVATE_KEY ist leer oder kein PEM.');

  const raw = decodeBase64(body);
  const der = /BEGIN RSA PRIVATE KEY/.test(clean) ? pkcs1ToPkcs8(raw) : raw;

  return await crypto.subtle.importKey(
    'pkcs8',
    der.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

const b64url = (b: Uint8Array) =>
  encodeBase64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ---------------------------------------------------------------------------
// Zugriffstoken
// ---------------------------------------------------------------------------
let cached: { token: string; expiresAt: number } | null = null;

export async function accessToken(c: DocuSignConfig): Promise<string> {
  // 60 Sekunden Sicherheitsabstand: ein Token, das waehrend des Aufrufs
  // ablaeuft, produziert einen 401 mitten im Umschlagversand.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    iss: c.integrationKey,
    sub: c.userId,
    aud: c.oauthBase,
    iat: now,
    exp: now + 3600,          // DocuSign laesst hoechstens eine Stunde zu
    scope: 'signature impersonation',
  })));

  const key = await importKey(c.privateKey);
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`));
  const assertion = `${header}.${payload}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch(`https://${c.oauthBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // consent_required ist der haeufigste Fehler beim Einrichten und hat eine
    // konkrete Loesung -- die gehoert in die Meldung, nicht in die Doku.
    if (data?.error === 'consent_required') {
      throw new Error(
        'DocuSign verlangt die einmalige Zustimmung für diese Integration. '
        + `Einmal aufrufen und zustimmen: https://${c.oauthBase}/oauth/auth`
        + `?response_type=code&scope=signature%20impersonation`
        + `&client_id=${c.integrationKey}&redirect_uri=https://www.docusign.com`);
    }
    throw new Error(`DocuSign-Anmeldung fehlgeschlagen (${res.status}): ${data?.error ?? ''} ${data?.error_description ?? ''}`.trim());
  }

  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

// ---------------------------------------------------------------------------
// Umschlag
// ---------------------------------------------------------------------------
export interface Signer {
  name: string;
  email: string;
  /** Gesetzt = eingebettete Unterschrift ohne DocuSign-Mail. */
  clientUserId?: string;
  anchor: string;
  routingOrder: number;
  recipientId: string;
}

export interface EnvelopeResult {
  envelopeId: string;
  status: string;
}

export async function createEnvelope(c: DocuSignConfig, args: {
  subject: string;
  blurb?: string;
  /** Mehrere Dokumente in EINEM Umschlag: der Kunde unterschreibt einmal. */
  documents: { base64: string; name: string }[];
  signers: Signer[];
  /** Landet unveraendert in den Webhook-Ereignissen -- unser Rueckbezug. */
  customFields?: Record<string, string>;
}): Promise<EnvelopeResult> {
  const token = await accessToken(c);

  const body = {
    emailSubject: args.subject,
    emailBlurb: args.blurb,
    documents: args.documents.map((d, i) => ({
      documentBase64: d.base64,
      name: d.name,
      fileExtension: 'pdf',
      documentId: String(i + 1),
    })),
    recipients: {
      signers: args.signers.map((s) => ({
        email: s.email,
        name: s.name,
        recipientId: s.recipientId,
        routingOrder: String(s.routingOrder),
        ...(s.clientUserId ? { clientUserId: s.clientUserId } : {}),
        tabs: {
          // Ohne documentId greift der Anker in ALLEN Dokumenten des
          // Umschlags -- genau richtig: der Kunde unterschreibt Rahmenvertrag
          // und Einzelauftrag, beide tragen dieselbe Marke.
          signHereTabs: [{
            anchorString: s.anchor,
            anchorUnits: 'pixels',
            anchorXOffset: '0',
            anchorYOffset: '0',
            anchorIgnoreIfNotPresent: 'false',
          }],
          // Kein Datumsfeld am selben Anker: es landete auf der Beschriftung
          // "Auftraggeber" und ueberdeckte sie. Der Zeitpunkt steht ohnehin im
          // Abschlusszertifikat von DocuSign und in customer_signed_at -- ein
          // kollidierendes Feld im Vertrag waere schlechter als keines.
        },
      })),
    },
    customFields: args.customFields
      ? {
          textCustomFields: Object.entries(args.customFields).map(([name, value]) => ({
            name, value, show: 'false',
          })),
        }
      : undefined,
    status: 'sent',
  };

  const res = await fetch(`${c.apiBase}/v2.1/accounts/${c.accountId}/envelopes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Umschlag konnte nicht erstellt werden (${res.status}): ${data?.message ?? JSON.stringify(data).slice(0, 300)}`);
  }
  return { envelopeId: data.envelopeId, status: data.status };
}

/** Woher DocuSign seine eigene Oberflaeche ausliefert -- je Umgebung anders. */
export function docusignAppOrigin(c: DocuSignConfig): string {
  return c.oauthBase.includes('-d')
    ? 'https://apps-d.docusign.com'
    : 'https://apps.docusign.com';
}

/**
 * URL fuer die eingebettete Unterschrift. Gilt nur wenige Minuten.
 *
 * frameAncestors und messageOrigins sind Pflicht, sobald die Ansicht in einem
 * iframe laufen soll: ohne sie setzt DocuSign eine Content-Security-Policy, die
 * das Einbetten verbietet, und der Rahmen bleibt leer. Sie sind zugleich der
 * Schutz -- nur die hier genannten Herkuenfte duerfen die Ansicht einbetten,
 * niemand sonst kann sie in eine fremde Seite haengen.
 */
export async function recipientView(c: DocuSignConfig, args: {
  envelopeId: string;
  name: string;
  email: string;
  clientUserId: string;
  returnUrl: string;
  /** Seiten, die die Ansicht einbetten duerfen. Leer = kein iframe moeglich. */
  frameAncestors?: string[];
  /** Herkuenfte, von denen DocuSign Nachrichten an das Fenster erlaubt. */
  messageOrigins?: string[];
}): Promise<string> {
  const token = await accessToken(c);
  const res = await fetch(
    `${c.apiBase}/v2.1/accounts/${c.accountId}/envelopes/${args.envelopeId}/views/recipient`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnUrl: args.returnUrl,
        authenticationMethod: 'none',
        userName: args.name,
        email: args.email,
        clientUserId: args.clientUserId,
        ...(args.frameAncestors?.length
          ? { frameAncestors: args.frameAncestors, messageOrigins: args.messageOrigins ?? [] }
          : {}),
      }),
    });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Unterschriftsansicht nicht verfügbar (${res.status}): ${data?.message ?? ''}`);
  }
  return data.url;
}

export async function envelopeStatus(c: DocuSignConfig, envelopeId: string): Promise<{
  status: string;
  recipients: { signers: { recipientId: string; status: string; signedDateTime?: string }[] };
}> {
  const token = await accessToken(c);
  const res = await fetch(
    `${c.apiBase}/v2.1/accounts/${c.accountId}/envelopes/${envelopeId}?include=recipients`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Umschlagstatus nicht abrufbar (${res.status}).`);
  return await res.json();
}

/** Das unterzeichnete Dokument, base64. Erst nach Abschluss verfuegbar. */
export async function completedDocument(c: DocuSignConfig, envelopeId: string): Promise<Uint8Array> {
  const token = await accessToken(c);
  const res = await fetch(
    `${c.apiBase}/v2.1/accounts/${c.accountId}/envelopes/${envelopeId}/documents/combined`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Unterzeichnetes Dokument nicht abrufbar (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Webhook-Pruefung
// ---------------------------------------------------------------------------
/**
 * Signatur eines Connect-Ereignisses pruefen.
 *
 * Ohne diese Pruefung koennte jeder, der die Adresse kennt, einen Vertrag als
 * unterzeichnet melden -- und damit die Veroeffentlichungssperre aushebeln.
 * Vergleich in konstanter Zeit.
 */
export async function verifyWebhook(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get('DOCUSIGN_HMAC_KEY');
  if (!secret) return false;          // Ohne Schluessel wird nichts akzeptiert.
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = encodeBase64(new Uint8Array(mac));

  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}
