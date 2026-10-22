// deno-lint-ignore-file no-explicit-any
/**
 * linkedin-callback – Rücksprung nach der LinkedIn-Anmeldung (21.10.2026).
 * Tauscht den Code gegen ein Token, liest das Mitglied (OpenID Connect),
 * speichert das Token verschlüsselt und leitet zurück in die App
 * (?linkedin=verbunden | abgebrochen | fehler). Öffentlich (verify_jwt = false).
 */
import { serviceClient } from '../_shared/intake-core.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';
import { encryptToken, getEncryptionKey } from '../_shared/encryption.ts';
import { codeTauschen, linkedinConfig, mitglied, mitStatus, sichererPfad } from '../_shared/linkedin-api.ts';

const weiter = (url: string) => new Response(null, { status: 302, headers: { Location: url } });

Deno.serve(async (req) => {
  const app = getPublicAppUrl();
  const url = new URL(req.url);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const db = serviceClient();
  const { data: s } = state ? await db.from('linkedin_oauth_states').select('*').eq('state', state).maybeSingle() : { data: null };
  const zurueck = sichererPfad(s?.return_to);
  if (!s || Date.parse(s.created_at) < Date.now() - 15 * 60000) return weiter(mitStatus(app, zurueck, 'fehler'));
  await db.from('linkedin_oauth_states').delete().eq('state', state);
  if (url.searchParams.get('error') || !code) return weiter(mitStatus(app, zurueck, 'abgebrochen'));
  try {
    const cfg = linkedinConfig();
    if (!cfg) return weiter(mitStatus(app, zurueck, 'fehler'));
    const t = await codeTauschen(cfg, code);
    const m = await mitglied(t.accessToken);
    const { error } = await db.from('recruiter_linkedin').upsert({
      recruiter_id: s.user_id, member_id: m.id, name: m.name, picture_url: m.picture,
      access_token_enc: await encryptToken(t.accessToken, getEncryptionKey()),
      expires_at: new Date(Date.now() + t.expiresIn * 1000).toISOString(), connected_at: new Date().toISOString(), reminder_sent_at: null,
    }, { onConflict: 'recruiter_id' });
    if (error) throw error;
    return weiter(mitStatus(app, zurueck, 'verbunden'));
  } catch (e) {
    console.error('linkedin-callback', e instanceof Error ? e.message : e);
    return weiter(mitStatus(app, zurueck, 'fehler'));
  }
});
