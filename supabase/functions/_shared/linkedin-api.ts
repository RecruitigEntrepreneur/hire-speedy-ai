// LinkedIn: Verbinden (OpenID Connect + w_member_social) und Posten mit Bild
// auf dem Profil des Headhunters (21.10.2026). Produkte der LinkedIn-App:
// „Sign In with LinkedIn using OpenID Connect“ und „Share on LinkedIn“.
//
// Env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI
// (Standard: <SUPABASE_URL>/functions/v1/linkedin-callback), LINKEDIN_API_VERSION
// (YYYYMM, Standard 202509; LinkedIn unterstützt jede Version etwa ein Jahr).
// Normale Apps bekommen kein Refresh-Token: die Verbindung hält 60 Tage.
//
// Datenfreigabe (16.11.2026): Mit LINKEDIN_DMA=an fragt die Anmeldung zusätzlich
// r_dma_portability_3rd_party an (Produkt „Member Data Portability API (3rd Party)“,
// nur nach Freischaltung durch LinkedIn, nur Mitglieder im EWR). Erst dann liefert
// snapshotHolen Werdegang, Sprachen und Fähigkeiten. Ohne Freischaltung bleibt es aus,
// sonst lehnt LinkedIn die Anmeldung wegen des unbekannten Scopes ab.

export const LINKEDIN_SCOPES = 'openid profile w_member_social';
export const DMA_SCOPE = 'r_dma_portability_3rd_party';

export interface LinkedinConfig { clientId: string; clientSecret: string; redirectUri: string; version: string; dma: boolean }

export function linkedinConfig(env: (k: string) => string | undefined = (k) => Deno.env.get(k)): LinkedinConfig | null {
  const clientId = env('LINKEDIN_CLIENT_ID');
  const clientSecret = env('LINKEDIN_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: env('LINKEDIN_REDIRECT_URI') ?? `${env('SUPABASE_URL')}/functions/v1/linkedin-callback`,
    version: env('LINKEDIN_API_VERSION') ?? '202509',
    dma: env('LINKEDIN_DMA') === 'an',
  };
}

export const linkedinScopes = (cfg: LinkedinConfig) => (cfg.dma ? `${LINKEDIN_SCOPES} ${DMA_SCOPE}` : LINKEDIN_SCOPES);

export function authorizeUrl(cfg: LinkedinConfig, state: string): string {
  const p = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.redirectUri, state, scope: linkedinScopes(cfg) });
  return `https://www.linkedin.com/oauth/v2/authorization?${p.toString()}`;
}

/** Nur interne Pfade als Rücksprung, nie fremde Adressen. */
export function sichererPfad(raw: unknown, fallback = '/recruiter/profile/ueber-dich'): string {
  const p = typeof raw === 'string' ? raw.trim() : '';
  return p.startsWith('/') && !p.startsWith('//') && !p.includes('\\') && p.length <= 300 ? p : fallback;
}

/** Hängt ?linkedin=<status> an, ohne den #Anker zu verlieren. */
export function mitStatus(appUrl: string, pfad: string, status: string): string {
  const [vor, anker] = pfad.split('#');
  const trenner = vor.includes('?') ? '&' : '?';
  return `${appUrl}${vor}${trenner}linkedin=${encodeURIComponent(status)}${anker ? `#${anker}` : ''}`;
}

/**
 * Text für das Feld `commentary` der Posts-API („little text format“):
 * reservierte Zeichen werden maskiert, #Wort wird ein echter Hashtag.
 */
export function linkedinKommentar(text: string): string {
  const RESERVIERT = /[\\|{}@[\]()<>#*_~]/g;
  return text.split(/(#[\p{L}\p{N}]+)/u).map((teil) => {
    const tag = teil.match(/^#([\p{L}\p{N}]+)$/u);
    if (tag) return `{hashtag|\\#|${tag[1]}}`;
    return teil.replace(RESERVIERT, (z) => `\\${z}`);
  }).join('');
}

export const postUrl = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`;

export class LinkedinError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const restHeaders = (cfg: LinkedinConfig, token: string) => ({
  Authorization: `Bearer ${token}`,
  'LinkedIn-Version': cfg.version,
  'X-Restli-Protocol-Version': '2.0.0',
  'Content-Type': 'application/json',
});

export async function codeTauschen(cfg: LinkedinConfig, code: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, client_id: cfg.clientId, client_secret: cfg.clientSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new LinkedinError(res.status, String(data.error_description ?? data.error ?? 'Token-Tausch fehlgeschlagen'));
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in) || 5184000 };
}

export async function mitglied(token: string): Promise<{ id: string; name: string | null; picture: string | null }> {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sub) throw new LinkedinError(res.status, 'Profil konnte nicht gelesen werden');
  return { id: String(data.sub), name: data.name ?? null, picture: data.picture ?? null };
}

/** Bild hochladen (Images-API) und als Beitrag veröffentlichen (Posts-API). */
export async function posten(cfg: LinkedinConfig, token: string, o: {
  memberId: string; text: string; bild: Uint8Array; bildText: string; sichtbarkeit: 'PUBLIC' | 'CONNECTIONS';
}): Promise<string> {
  const autor = `urn:li:person:${o.memberId}`;
  const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST', headers: restHeaders(cfg, token), body: JSON.stringify({ initializeUploadRequest: { owner: autor } }),
  });
  const initData = await init.json().catch(() => ({}));
  if (!init.ok || !initData?.value?.uploadUrl) throw new LinkedinError(init.status, String(initData?.message ?? 'Bild-Upload nicht möglich'));
  const hoch = await fetch(initData.value.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: o.bild });
  if (!hoch.ok) throw new LinkedinError(hoch.status, 'Bild konnte nicht hochgeladen werden');
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: restHeaders(cfg, token),
    body: JSON.stringify({
      author: autor,
      commentary: linkedinKommentar(o.text),
      visibility: o.sichtbarkeit,
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { altText: o.bildText.slice(0, 300), id: initData.value.image } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (res.status !== 201) {
    const data = await res.json().catch(() => ({}));
    throw new LinkedinError(res.status, String(data?.message ?? `LinkedIn ${res.status}`));
  }
  const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id');
  if (!urn) throw new LinkedinError(500, 'LinkedIn hat keine Beitrags-ID geliefert');
  return urn;
}

export async function loeschen(cfg: LinkedinConfig, token: string, urn: string) {
  const res = await fetch(`https://api.linkedin.com/rest/posts/${encodeURIComponent(urn)}`, { method: 'DELETE', headers: restHeaders(cfg, token) });
  if (!res.ok && res.status !== 404) throw new LinkedinError(res.status, 'Beitrag konnte nicht gelöscht werden');
}

/**
 * Datenfreigabe: einen Bereich aus der Member Snapshot API holen (alle Seiten).
 * Die API kennt nur die Version 202312. „in_arbeit“: LinkedIn stellt die Daten
 * nach der Zustimmung erst zusammen; „nicht_freigegeben“: Scope fehlt oder abgelehnt.
 */
export type SnapshotErgebnis = { stand: 'ok'; zeilen: Record<string, unknown>[] } | { stand: 'in_arbeit' | 'nicht_freigegeben' };

export async function snapshotHolen(token: string, bereich: string, maxSeiten = 20): Promise<SnapshotErgebnis> {
  const zeilen: Record<string, unknown>[] = [];
  for (let start = 0; start < maxSeiten; start++) {
    const url = `https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=${encodeURIComponent(bereich)}&start=${start}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202312', 'X-Restli-Protocol-Version': '2.0.0' } });
    if (res.status === 401 || res.status === 403) return { stand: 'nicht_freigegeben' };
    // 404 „No data found for this memberId“: am Anfang noch nicht bereit, später das Ende der Seiten.
    if (res.status === 404) return start === 0 ? { stand: 'in_arbeit' } : { stand: 'ok', zeilen };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new LinkedinError(res.status, String(data?.message ?? `LinkedIn ${res.status}`));
    for (const el of Array.isArray(data?.elements) ? data.elements : []) {
      const teil = Array.isArray(el?.snapshotData) ? el.snapshotData : [];
      zeilen.push(...teil.filter((z: unknown) => z && typeof z === 'object'));
    }
    const weiter = Array.isArray(data?.paging?.links) && data.paging.links.some((l: { rel?: string }) => l?.rel === 'next');
    if (!weiter) break;
  }
  return { stand: 'ok', zeilen };
}

/** Foto von LinkedIn laden, nur von den LinkedIn-Bildservern, höchstens 5 MB. */
export async function fotoLaden(url: string): Promise<{ bytes: Uint8Array; typ: string }> {
  let host = '';
  try { host = new URL(url).hostname; } catch { /* unten abgelehnt */ }
  if (!/(^|\.)licdn(-ei)?\.com$/.test(host) || !url.startsWith('https://')) throw new LinkedinError(400, 'Fotoadresse nicht von LinkedIn');
  const res = await fetch(url);
  const typ = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!res.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(typ)) throw new LinkedinError(res.status, 'Foto konnte nicht geladen werden');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new LinkedinError(413, 'Foto zu groß');
  return { bytes, typ };
}
