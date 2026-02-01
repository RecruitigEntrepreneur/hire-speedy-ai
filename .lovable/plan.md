
# Plan: check-config Action in Google Auth hinzufügen

## Analyse

### Microsoft Auth (microsoft-auth/index.ts)
**Status: Bereits korrekt!**
Der Code in Zeile 104 enthält bereits die richtige Logik:
```typescript
const configured = !!MICROSOFT_CLIENT_ID && !!MICROSOFT_CLIENT_SECRET;
```
Keine Änderung erforderlich.

### Google Auth (google-auth/index.ts)
**Status: Fehlende Action**
Die `check-config` Action fehlt komplett. Der Switch beginnt direkt mit `get-auth-url` (Zeile 45).

## Geplante Änderung

**Datei:** `supabase/functions/google-auth/index.ts`

Die `check-config` Action als ersten Case im Switch-Statement hinzufügen (vor `get-auth-url`):

```typescript
switch (action) {
  case 'check-config': {
    const configured = !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET;
    return new Response(
      JSON.stringify({ configured, provider: 'google' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  case 'get-auth-url': {
    // ... existing code
```

## Technische Details

| Aspekt | Details |
|--------|---------|
| Datei | `supabase/functions/google-auth/index.ts` |
| Position | Nach Zeile 43 (`switch (action) {`), vor `case 'get-auth-url'` |
| Änderungsumfang | 8 neue Zeilen hinzufügen |

## Erwartetes Ergebnis

Nach der Änderung:
- `CalendarConnectionCard.tsx` kann beide Provider-Konfigurationen abfragen
- Google Calendar zeigt "Verbinden" statt "Nicht konfiguriert"
- Microsoft 365 zeigt "Verbinden" (bereits funktionsfähig)
