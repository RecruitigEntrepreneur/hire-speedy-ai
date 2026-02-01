
# Plan: OAuth Redirect URI auf FRONTEND_URL umstellen

## Problem
Die Edge Functions bauen die Redirect URI aktuell auf Backend-Pfade (`/functions/v1/.../callback`), die keine GET-Requests mit Query Params verarbeiten können. Die Verwendung von `origin` aus Request-Headers ist unzuverlässig, da Preview- und Production-URLs unterschiedlich sind.

## Lösung: FRONTEND_URL als Environment Variable

### Schritt 1: FRONTEND_URL als Secret hinzufügen

**Wert:** `https://hire-speedy-ai.lovable.app`

Dieses Secret wird in beiden Edge Functions verwendet, um eine konsistente Redirect URI zu generieren.

---

### Schritt 2: Edge Functions anpassen

**Datei: `supabase/functions/microsoft-auth/index.ts`**

Änderungen:
- Zeile 13: `FRONTEND_URL` Environment Variable lesen
- Zeile 15-18: `getRedirectUri()` ändern zu `${FRONTEND_URL}/oauth/callback`
- Zeile 130: `offline_access` Scope hinzufügen für Refresh Token Support

```typescript
// Zeile 13 - neue Variable
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://hire-speedy-ai.lovable.app';

// Zeile 15-17 - neue Funktion
const getRedirectUri = () => {
  return `${FRONTEND_URL}/oauth/callback`;
};

// Zeile 130 - Scope erweitern
scope: 'openid profile email offline_access User.Read OnlineMeetings.ReadWrite Calendars.ReadWrite',
```

**Datei: `supabase/functions/google-auth/index.ts`**

Änderungen:
- Zeile 13: `FRONTEND_URL` Environment Variable lesen
- Zeile 14-17: `getRedirectUri()` ändern zu `${FRONTEND_URL}/oauth/callback`

```typescript
// Zeile 13 - neue Variable
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://hire-speedy-ai.lovable.app';

// Zeile 14-17 - neue Funktion
const getRedirectUri = () => {
  return `${FRONTEND_URL}/oauth/callback`;
};
```

---

### Schritt 3: Route in App.tsx hinzufügen

**Datei: `src/App.tsx`**

Nach Zeile 440 (vor `{/* Settings */}`):

```typescript
{/* OAuth Callback */}
<Route path="/oauth/callback" element={
  <ProtectedRoute>
    <OAuthCallback />
  </ProtectedRoute>
} />
```

Die Route muss mit `ProtectedRoute` geschützt sein, weil `exchange-code` den eingeloggten User benötigt.

---

### Schritt 4: useGoogleAuth oauth_return_path Support hinzufügen

**Datei: `src/hooks/useGoogleAuth.ts`**

In der `connectGoogle` Funktion (Zeile 58-72), vor `window.location.href`:

```typescript
sessionStorage.setItem('oauth_return_path', window.location.pathname);
```

Dies stellt sicher, dass nach dem Google OAuth der User zur ursprünglichen Seite zurückgeleitet wird (wie bei Microsoft bereits implementiert).

---

## Erforderliche Provider-Konfiguration

### Microsoft Azure Portal

1. Gehen Sie zu **Azure Portal → Microsoft Entra ID → App-Registrierungen**
2. Öffnen Sie die App mit Client ID `175edabd-8e2b-4f0f-94d4-5bf5a05f16a6`
3. **Authentifizierung → Redirect URIs**:
   - **Hinzufügen:** `https://hire-speedy-ai.lovable.app/oauth/callback`
   - **Entfernen:** `https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/microsoft-auth/callback` (alte URI)
4. Speichern

### Google Cloud Console

1. Gehen Sie zu **Google Cloud Console → APIs & Services → Credentials**
2. Öffnen Sie den OAuth 2.0 Client
3. **Authorized redirect URIs**:
   - **Hinzufügen:** `https://hire-speedy-ai.lovable.app/oauth/callback`
   - **Entfernen:** `https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/google-auth/callback` (alte URI)
4. Speichern

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| Secret: `FRONTEND_URL` | Neu hinzufügen: `https://hire-speedy-ai.lovable.app` |
| `supabase/functions/microsoft-auth/index.ts` | `getRedirectUri()` auf FRONTEND_URL umstellen, `offline_access` Scope |
| `supabase/functions/google-auth/index.ts` | `getRedirectUri()` auf FRONTEND_URL umstellen |
| `src/App.tsx` | Route `/oauth/callback` hinzufügen |
| `src/hooks/useGoogleAuth.ts` | `oauth_return_path` Support hinzufügen |

## Erwartetes Ergebnis

Nach den Änderungen:
- OAuth-Flow läuft über Frontend-URL (`/oauth/callback`)
- Nur eine Redirect URI pro Provider nötig
- Konsistente Rückleitung zur ursprünglichen Seite
- Kein 403-Fehler mehr von Microsoft/Google
