

# Plan: Google Calendar Secrets hinzufügen und aktivieren

## Was wir haben

Sie haben die Google OAuth-Zugangsdaten hochgeladen:
- **Client ID**: `620094094966-4u2b5vl3fue0bjp4qo205426ajmqq5h7.apps.googleusercontent.com`
- **Client Secret**: `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`
- **Redirect URI**: Bereits korrekt auf Ihr Projekt konfiguriert

## Was ich mache

### Schritt 1: Secrets hinzufügen

Ich werde die zwei fehlenden Secrets zu Ihrem Projekt hinzufügen:

| Secret Name | Wert |
|-------------|------|
| `GOOGLE_CLIENT_ID` | `620094094966-4u2b5vl3fue0bjp4qo205426ajmqq5h7.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `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` |

### Schritt 2: Edge Function deployen

Nach dem Hinzufügen der Secrets wird die `google-auth` Edge Function neu deployed, damit sie die neuen Secrets erkennt.

### Schritt 3: Testen

Danach können Sie:
1. Im Interview-Wizard auf "Google verbinden" klicken
2. Google OAuth-Consent-Screen erscheint
3. Nach Zustimmung werden Sie zurückgeleitet
4. Kalender ist verbunden!

## Erwartetes Ergebnis

Nach der Änderung:
- Der "Google verbinden" Button im Interview-Wizard funktioniert
- Sie werden zum Google Login weitergeleitet
- Nach Zustimmung wird Ihr Kalender verknüpft
- Termine können automatisch in Google Calendar eingetragen werden

---

## Technische Details

Der bestehende Code ist bereits vollständig implementiert:

**google-auth Edge Function** (bereits vorhanden):
- `get-auth-url`: Generiert OAuth-URL für Google Login
- `exchange-code`: Tauscht Authorization Code gegen Tokens
- `refresh-token`: Erneuert abgelaufene Tokens
- `get-free-busy`: Holt Kalender-Verfügbarkeit
- `disconnect`: Trennt die Verbindung

**useGoogleAuth Hook** (bereits vorhanden):
- Prüft Verbindungsstatus
- Startet OAuth-Flow
- Speichert Tokens in `user_integrations` Tabelle

Einzige Änderung: Die zwei Secrets müssen hinzugefügt werden.

