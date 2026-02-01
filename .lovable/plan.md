

# Plan: Outlook-Integration + Triple-Blind Text-Korrekturen V2

## Zusammenfassung

Basierend auf dem detaillierten Plan des Users implementieren wir:
1. **Triple-Blind Text-Korrekturen** (6 Dateien) - Die aktuellen UI-Texte sind FALSCH
2. **OAuth Redirect-Bug Fix** - Clients werden fälschlicherweise zu `/recruiter/integrations` geleitet
3. **Kalender-Verbindungs-UI für Clients** - Neue CalendarConnectionCard Komponente
4. **Microsoft Graph Free/Busy API** - Echte Kalender-Verfügbarkeit
5. **Automatische Kalender-Events** - Interviews werden im Outlook-Kalender erstellt

---

## Phase 1: Triple-Blind Korrekturen (KRITISCH)

### Das RICHTIGE Triple-Blind Modell

| Rolle | Sieht zunächst | Sieht nach Event |
|-------|----------------|------------------|
| **Kandidat** | Firmenname + Branche + Job (IMMER) | - |
| **Recruiter** | [Branche Größe Funding] | Firma nach Interview-Bestätigung |
| **Kunde** | Anonymes Profil (TB-7X2K) | Persönliche Daten nach Interview-Annahme |

### Datei 1: `InterviewWizardStep3Message.tsx`

**Zeilen 43-56 - FALSCH:**
```
Kandidat erhält anonyme Einladung
Firmenname wird als "[Branche] Unternehmen" angezeigt
Erst bei Zustimmung werden alle Daten freigegeben
```

**RICHTIG:**
```
Kandidat erhält Ihre Interview-Einladung mit Firmenname und Stelleninfos
Er kann entscheiden, ob er Ihr Unternehmen kennenlernen möchte
Erst bei Annahme werden seine persönlichen Daten für Sie sichtbar
Termin wird automatisch für alle Parteien gebucht
```

### Datei 2: `InterviewRequestWithOptInDialog.tsx`

**Zeilen 293-308 - FALSCH:**
```
Der Kandidat erhält eine anonyme Anfrage mit Ihren Terminvorschlägen
Er sieht nur: "Ein Unternehmen in [Branche] sucht [Jobtitel]"
Bei Zustimmung + Terminwahl werden alle Daten freigegeben
```

**RICHTIG:**
```
Der Kandidat erhält Ihre Interview-Einladung mit Firmenname und Stelleninfos
Er kann entscheiden, ob er Ihr Unternehmen kennenlernen möchte
Erst bei Annahme werden die persönlichen Daten des Kandidaten für Sie sichtbar
Termin wird automatisch für alle Parteien gebucht
```

### Datei 3: `OptInRequestDialog.tsx`

**Zeilen 47-53 - FALSCH:**
```
• Der Kandidat erhält eine anonyme Anfrage
• Er sieht nur: "Ein Unternehmen in [{jobIndustry}]"
• Erst bei Zustimmung werden alle Daten sichtbar
```

**RICHTIG:**
```
• Der Kandidat erhält Ihre Einladung mit Firmennamen und Jobdetails
• Er entscheidet, ob er Sie kennenlernen möchte
• Ihre Sicht: Kandidat bleibt anonym bis er das Interview annimmt
```

### Datei 4: `CandidateDetail.tsx`

**Zeilen 494-498 - Info-Banner:**

**FALSCH:**
```
Persönliche Daten sind zum Schutz des Kandidaten verborgen. 
Nach Interview-Anfrage erhält der Kandidat eine Opt-In Anfrage. 
Bei Zustimmung werden Name, Kontaktdaten und Lebenslauf freigeschaltet.
```

**RICHTIG:**
```
Zum Schutz des Kandidaten sehen Sie ein anonymisiertes Profil. 
Der Kandidat erhält Ihre Interview-Einladung mit Ihrem Firmennamen. 
Erst wenn er das Interview annimmt, werden seine persönlichen Daten (Name, Kontakt, CV) für Sie sichtbar.
```

### Datei 5: `CandidateExpose.tsx`

**Zeile 131 - Shield Banner:**

**FALSCH:**
```
Triple-Blind Mode – Identität geschützt bis Opt-In
```

**RICHTIG:**
```
Anonymisiertes Profil – Identität wird bei Interview-Annahme freigegeben
```

### Datei 6: `CompactExposeCard.tsx` (Prüfen ob auch betroffen)

Wenn dort Triple-Blind-Texte sind, ebenfalls korrigieren.

---

## Phase 2: OAuth Redirect-Bug Fix

### Problem
`OAuthCallback.tsx` leitet IMMER zu `/recruiter/integrations` weiter - auch für Clients.

### Lösung

**Datei: `src/hooks/useMicrosoftAuth.ts` - connectMicrosoft()**

```typescript
// VORHER:
sessionStorage.setItem('oauth_provider', 'microsoft');

// NACHHER:
const returnPath = window.location.pathname;
sessionStorage.setItem('oauth_provider', 'microsoft');
sessionStorage.setItem('oauth_return_path', returnPath);
```

**Datei: `src/pages/integrations/OAuthCallback.tsx`**

```typescript
// VORHER (Zeile 60):
navigate('/recruiter/integrations', { replace: true });

// NACHHER:
const returnPath = sessionStorage.getItem('oauth_return_path');
sessionStorage.removeItem('oauth_return_path');
navigate(returnPath || '/dashboard/integrations', { replace: true });

// Error-Button auch anpassen:
onClick={() => navigate(returnPath || '/dashboard/integrations', { replace: true })}
```

---

## Phase 3: Client Kalender-Integration UI

### Neue Komponente: `CalendarConnectionCard.tsx`

```text
┌─────────────────────────────────────────────────────────────────┐
│  📅 Kalender-Integration                                        │
│                                                                  │
│  Verbinden Sie Ihren Kalender, damit Interview-Termine          │
│  automatisch eingetragen werden.                                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🔷 Microsoft 365 / Outlook                                 ││
│  │                                                              ││
│  │  ✅ Verbunden: max.mustermann@firma.de                      ││
│  │  Verbunden am: 01.02.2026                                   ││
│  │                                    [Trennen]                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🟢 Google Calendar                                         ││
│  │                                                              ││
│  │  ○ Nicht verbunden                                          ││
│  │                                    [Verbinden]              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Datei: `src/pages/dashboard/IntegrationSettings.tsx`

Die bestehende Seite zeigt nur ATS-Integrationen. Wir fügen eine neue Tab oder Sektion für **Kalender-Verbindungen** hinzu:

```typescript
// Neue Imports:
import { useMicrosoftAuth } from '@/hooks/useMicrosoftAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { CalendarConnectionCard } from '@/components/settings/CalendarConnectionCard';

// Neuer Tab "Kalender":
<TabsTrigger value="calendar" className="gap-2">
  <Calendar className="h-4 w-4" />
  Kalender
</TabsTrigger>

<TabsContent value="calendar">
  <CalendarConnectionCard />
</TabsContent>
```

---

## Phase 4: Fehlende Secrets

Die Secrets `MICROSOFT_CLIENT_ID` und `MICROSOFT_CLIENT_SECRET` fehlen noch. Der User muss:

1. Azure Portal → App Registration erstellen
2. Redirect URI: `https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/microsoft-auth/callback`
3. API Permissions: `User.Read`, `Calendars.ReadWrite`, `OnlineMeetings.ReadWrite`
4. Secrets in Lovable Cloud hinzufügen

### Config-Check Endpoint (NEU)

Neue Action in `microsoft-auth/index.ts`:

```typescript
case 'check-config': {
  // Keine Auth nötig - prüft nur ob Secrets konfiguriert sind
  const configured = !!MICROSOFT_CLIENT_ID && !!MICROSOFT_CLIENT_SECRET;
  return new Response(
    JSON.stringify({ configured, provider: 'microsoft' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Das UI nutzt dies um einen hilfreichen Fehler anzuzeigen statt stumm zu scheitern.

---

## Phase 5: Free/Busy API für Kalender-Verfügbarkeit

### Neue Action in `microsoft-auth/index.ts`

```typescript
case 'get-free-busy': {
  const { startDate, endDate } = body;
  
  // Token inline refreshen wenn nötig
  let accessToken = integration.access_token;
  if (new Date(integration.token_expires_at) < new Date()) {
    const refreshResult = await refreshTokenInline(integration.refresh_token);
    accessToken = refreshResult.access_token;
    await supabase.from('user_integrations').update({...}).eq(...);
  }
  
  // Microsoft Graph API
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
    {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schedules: [userEmail],
        startTime: { dateTime: startDate, timeZone: 'Europe/Berlin' },
        endTime: { dateTime: endDate, timeZone: 'Europe/Berlin' },
        availabilityViewInterval: 30
      })
    }
  );
  
  return { busySlots: parseScheduleResponse(response) };
}
```

### Update `useCalendarAvailability.ts`

Der Hook gibt aktuell nur Dummy-Daten zurück. Wir erweitern ihn:

```typescript
export function useCalendarAvailability(options) {
  const { isConnected: msConnected } = useMicrosoftAuth();
  const { isConnected: googleConnected } = useGoogleAuth();
  
  useEffect(() => {
    if (msConnected) {
      const busySlots = await supabase.functions.invoke('microsoft-auth', {
        body: { action: 'get-free-busy', startDate, endDate }
      });
      // Markiere Slots als unavailable
    } else if (googleConnected) {
      // Google variant
    } else {
      // Default-Slots ohne Verfügbarkeitsprüfung
    }
  }, [msConnected, googleConnected, dateRange]);
}
```

---

## Phase 6: Automatische Kalender-Events

### Neue Actions in `microsoft-auth/index.ts`

```typescript
case 'create-calendar-event': {
  // POST https://graph.microsoft.com/v1.0/me/events
  // Mit: subject, start, end, body, showAs, location, reminder
  // Return: { eventId, iCalUId }
}

case 'update-calendar-event': {
  // PATCH https://graph.microsoft.com/v1.0/me/events/{eventId}
  // Für: Bestätigung, Verschiebung
}

case 'delete-calendar-event': {
  // DELETE https://graph.microsoft.com/v1.0/me/events/{eventId}
  // Für: Absage
}
```

### Event-Lifecycle

| Aktion | Kalender-Effekt |
|--------|-----------------|
| Interview-Anfrage gesendet | Event erstellen (`showAs: tentative`) |
| Kandidat nimmt an | Event updaten (`showAs: busy`, Meeting-Link) |
| Kandidat lehnt ab | Event löschen |
| Gegenvorschlag | Altes Event löschen, neues erstellen |
| Interview abgesagt | Event löschen |

### DB-Migration

```sql
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS outlook_event_id text,
ADD COLUMN IF NOT EXISTS google_event_id text;
```

---

## Geänderte Dateien

| # | Datei | Änderung | Priorität |
|---|-------|----------|-----------|
| 1 | `InterviewWizardStep3Message.tsx` | Triple-Blind Text korrigieren | Hoch |
| 2 | `InterviewRequestWithOptInDialog.tsx` | Triple-Blind Text korrigieren | Hoch |
| 3 | `OptInRequestDialog.tsx` | Triple-Blind Text korrigieren | Hoch |
| 4 | `CandidateDetail.tsx` | Info-Banner korrigieren | Hoch |
| 5 | `CandidateExpose.tsx` | Shield-Banner korrigieren | Hoch |
| 6 | `useMicrosoftAuth.ts` | Return-Path speichern | Hoch |
| 7 | `OAuthCallback.tsx` | Rollenbasierter Redirect | Hoch |
| 8 | `CalendarConnectionCard.tsx` | **NEU** - Kalender-UI | Mittel |
| 9 | `IntegrationSettings.tsx` | Kalender-Tab hinzufügen | Mittel |
| 10 | `microsoft-auth/index.ts` | check-config, get-free-busy, calendar-events | Mittel |
| 11 | `useCalendarAvailability.ts` | Echte Free/Busy Integration | Mittel |
| 12 | `process-interview-response/index.ts` | Outlook-Event bei Bestätigung | Mittel |
| 13 | DB-Migration | outlook_event_id, google_event_id | Mittel |

---

## Implementierungsreihenfolge

### Phase 1 (Sofort - kein Azure-Setup nötig):
1. Triple-Blind Texte korrigieren (5 Dateien)
2. OAuth Redirect-Bug fixen (2 Dateien)

### Phase 2 (Nach Azure-Setup):
3. CalendarConnectionCard erstellen
4. IntegrationSettings: Kalender-Tab hinzufügen
5. check-config Endpoint + UI-Feedback
6. useCalendarAvailability mit echtem Free/Busy
7. get-free-busy Action in microsoft-auth

### Phase 3 (Kalender-Automation):
8. create/update/delete-calendar-event Actions
9. process-interview-response: Auto-Event bei Bestätigung
10. Event-Lifecycle (Absage → löschen, etc.)
11. Migration für event_id Felder

---

## Secrets die noch fehlen

Der User muss nach der Phase 1 folgende Secrets hinzufügen:

| Secret | Quelle |
|--------|--------|
| `MICROSOFT_CLIENT_ID` | Azure Portal → App Registration → Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Azure Portal → Certificates & Secrets → New client secret |

Ich werde nach Genehmigung des Plans mit **Phase 1** beginnen, da diese Änderungen keine externen Abhängigkeiten haben.

