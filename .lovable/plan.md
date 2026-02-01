
# Plan: Professioneller Interview-Wizard mit vollem Workflow

## Zusammenfassung

Wir bauen einen neuen, einheitlichen **4-Schritt Interview-Wizard** der das aktuelle `InterviewRequestWithOptInDialog` und `InterviewSchedulingDialog` ersetzt. Zusätzlich erweitern wir die Kandidaten-Response-Seite für Annehmen/Gegenvorschlag/Absagen.

---

## Architektur-Übersicht

```text
CLIENT                                KANDIDAT
   │                                     │
   ▼                                     ▼
┌──────────────────────┐           ┌──────────────────────┐
│ ProfessionalInterview│           │ InterviewResponse    │
│ RequestWizard.tsx    │           │ Page.tsx             │
│ (4 Schritte)         │           │                      │
└──────────┬───────────┘           │ - Annehmen           │
           │                       │ - Gegenvorschlag     │
           │ Supabase              │ - Absagen            │
           ▼ Edge Function         └──────────┬───────────┘
┌──────────────────────┐                      │
│ send-interview-      │◄─────────────────────┘
│ invitation           │   
│ (NEU)                │   
│                      │   
│ - Interview erstellen│
│ - Email an Kandidat  │
│ - Benachrichtigungen │
│ - iCal generieren    │
└──────────────────────┘
```

---

## Schritt-für-Schritt Wizard

### Step 1: Format & Dauer
```text
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Interview anfragen                                          │
│  ━━━━━ ○ ○ ○                                                   │
│                                                                  │
│  Format wählen:                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 📹 MS   │ │ 🎦 Google│ │ 📞      │ │ 🏢      │ │ 🔗      │  │
│  │ Teams   │ │ Meet    │ │ Telefon │ │ Vor-Ort │ │ Video   │  │
│  │ (Auto)  │ │ (Auto)  │ │         │ │         │ │ (Link)  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                                  │
│  Dauer:                                                          │
│  [30 Min] [45 Min] [●60 Min●] [90 Min] [120 Min]               │
│                                                                  │
│  Bei "Vor-Ort" → Adresse eingeben                               │
│  Bei "Video (Link)" → Eigenen Link eingeben                     │
│                                                                  │
│  [Abbrechen]                                    [Weiter →]      │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Termine wählen (mit Kalender-Integration)
```text
┌─────────────────────────────────────────────────────────────────┐
│  📅 Terminvorschläge                                            │
│  ━━━━━━━━━ ○ ○                                                  │
│                                                                  │
│  [🤖 Smart Suggest - 5 freie Slots vorschlagen]                │
│                                                                  │
│  ┌─────────────────┐    Montag, 3. Februar                      │
│  │   FEBRUAR       │    ┌────────────────────────────────────┐  │
│  │ Mo Di Mi Do Fr  │    │ 09:00 ░░░░░░ (belegt)             │  │
│  │ 3  4  5  6  7   │    │ 10:00 ▓▓▓▓▓▓ FREI  [+]            │  │
│  │ 10 11 12 13 14  │    │ 11:00 ▓▓▓▓▓▓ FREI  [+]            │  │
│  │ ...             │    │ 14:00 ▓▓▓▓▓▓ FREI  [+]            │  │
│  └─────────────────┘    │ 15:00 ░░░░░░ (belegt)             │  │
│                          └────────────────────────────────────┘  │
│  🟢 Kalender verbunden: Outlook                                  │
│                                                                  │
│  Ausgewählt (3):                                                 │
│  [3.2. 10:00 ×] [4.2. 14:00 ×] [5.2. 11:00 ×]                  │
│                                                                  │
│  [← Zurück]                                     [Weiter →]      │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Nachricht & DSGVO
```text
┌─────────────────────────────────────────────────────────────────┐
│  ✉️ Nachricht & Datenschutz                                     │
│  ━━━━━━━━━━━━━━ ○                                               │
│                                                                  │
│  Nachricht an den Kandidaten (optional):                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Wir freuen uns auf das Gespräch...                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔒 Triple-Blind Datenschutz                              │  │
│  │                                                            │  │
│  │  ✓ Kandidat erhält anonyme Einladung                      │  │
│  │  ✓ Firmenname wird als "[Branche] Unternehmen" gezeigt    │  │
│  │  ✓ Erst bei Zustimmung werden alle Daten freigegeben      │  │
│  │                                                            │  │
│  │  ☑ Ich bestätige die DSGVO-konforme Verarbeitung         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [← Zurück]                                     [Weiter →]      │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4: Vorschau & Senden
```text
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Zusammenfassung                                             │
│  ━━━━━━━━━━━━━━━━━━                                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Preview: E-Mail an Kandidaten                            │  │
│  │ ─────────────────────────────────────────────────────────│  │
│  │                                                            │  │
│  │  Interview-Einladung                                       │  │
│  │  Senior Java Developer                                     │  │
│  │                                                            │  │
│  │  Hallo [Kandidat],                                         │  │
│  │  ein Technologie-Unternehmen möchte Sie kennenlernen...   │  │
│  │                                                            │  │
│  │  Format: Microsoft Teams (Auto-generiert)                  │  │
│  │  Dauer: 60 Minuten                                         │  │
│  │                                                            │  │
│  │  Terminvorschläge:                                         │  │
│  │  • Mo, 3. Februar 10:00                                    │  │
│  │  • Di, 4. Februar 14:00                                    │  │
│  │  • Mi, 5. Februar 11:00                                    │  │
│  │                                                            │  │
│  │  [Annehmen] [Gegenvorschlag] [Absagen]                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [← Zurück]                              [📨 Einladung senden]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Kandidaten-Response-Seite

Die bestehende `SelectSlot.tsx` wird erweitert zu `InterviewResponsePage.tsx`:

```text
Route: /interview/respond/:token

┌─────────────────────────────────────────────────────────────────┐
│  🎯 Interview-Einladung                                         │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📍 Position: Senior Java Developer                        │  │
│  │  🏢 Unternehmen: Technologie-Unternehmen (IT-Branche)     │  │
│  │  ⏱️ Dauer: 60 Minuten                                      │  │
│  │  📹 Format: Video-Interview (Microsoft Teams)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Nachricht des Unternehmens:                                     │
│  "Wir freuen uns auf das Gespräch..."                           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Terminvorschläge:                                               │
│  ○ Mo, 3. Februar 2025 um 10:00 Uhr                            │
│  ● Di, 4. Februar 2025 um 14:00 Uhr  ← ausgewählt              │
│  ○ Mi, 5. Februar 2025 um 11:00 Uhr                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐
│  │ [✅ Termin annehmen]                                        │
│  │                                                              │
│  │ [🔄 Gegenvorschlag machen]                                  │
│  │                                                              │
│  │ [❌ Absagen]                                                 │
│  └─────────────────────────────────────────────────────────────┘
│                                                                  │
│  🔒 Ihre Daten werden erst nach Zustimmung freigegeben (DSGVO)  │
└─────────────────────────────────────────────────────────────────┘
```

### Gegenvorschlag-Modus:
```text
┌─────────────────────────────────────────────────────────────────┐
│  🔄 Gegenvorschlag                                              │
│                                                                  │
│  Ihre Wunschtermine (max. 3):                                   │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ [Datum wählen]  │  │ [Uhrzeit wählen]│  [+ Hinzufügen]      │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                  │
│  Hinzugefügt:                                                    │
│  • Do, 6. Februar 15:00 [×]                                     │
│  • Fr, 7. Februar 10:00 [×]                                     │
│                                                                  │
│  Nachricht (optional):                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Die vorgeschlagenen Termine passen leider nicht...        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [← Zurück]                            [Gegenvorschlag senden]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Neue/Geänderte Dateien

### Frontend-Komponenten

| Datei | Status | Beschreibung |
|-------|--------|--------------|
| `src/components/dialogs/ProfessionalInterviewWizard.tsx` | NEU | 4-Schritt Wizard mit allen Features |
| `src/components/dialogs/InterviewWizardStep1Format.tsx` | NEU | Format & Dauer Auswahl |
| `src/components/dialogs/InterviewWizardStep2Slots.tsx` | NEU | Kalender + Terminauswahl |
| `src/components/dialogs/InterviewWizardStep3Message.tsx` | NEU | Nachricht + DSGVO |
| `src/components/dialogs/InterviewWizardStep4Preview.tsx` | NEU | E-Mail Vorschau |
| `src/pages/interview/InterviewResponsePage.tsx` | NEU | Kandidaten-Response (Accept/Counter/Decline) |
| `src/pages/interview/SelectSlot.tsx` | REDIRECT | Leitet zu neuer Seite weiter |

### Edge Functions

| Datei | Status | Beschreibung |
|-------|--------|--------------|
| `supabase/functions/send-interview-invitation/index.ts` | NEU | Sendet Einladung an Kandidat |
| `supabase/functions/process-interview-response/index.ts` | NEU | Verarbeitet Accept/Counter/Decline |
| `supabase/functions/send-email/index.ts` | UPDATE | Neues Template für schöne Email |

### Integration-Updates

| Datei | Status | Beschreibung |
|-------|--------|--------------|
| `src/components/talent/CandidateActionCard.tsx` | UPDATE | Nutzt neuen Wizard |
| `src/components/dialogs/InterviewRequestWithOptInDialog.tsx` | DEPRECATE | Wird durch neuen Wizard ersetzt |
| `src/components/talent/InterviewSchedulingDialog.tsx` | DEPRECATE | Wird durch neuen Wizard ersetzt |

---

## Backend-Logik (Edge Functions)

### 1. `send-interview-invitation` (NEU)

```typescript
// Input
{
  submissionId: string;
  meetingFormat: 'teams' | 'meet' | 'video' | 'phone' | 'onsite';
  durationMinutes: number;
  proposedSlots: string[];  // ISO timestamps
  clientMessage?: string;
  meetingLink?: string;     // For 'video' or 'onsite'
  onsiteAddress?: string;   // For 'onsite'
}

// Actions:
// 1. Create interview record with status 'pending_response'
// 2. Generate unique response_token
// 3. Send email to candidate with:
//    - Anonymized company info (Industry + Size)
//    - Job details
//    - Proposed slots
//    - 3 Buttons: Accept | Counter | Decline
// 4. Notify recruiter
// 5. Update submission.stage = 'interview_requested'
```

### 2. `process-interview-response` (NEU)

```typescript
// Input
{
  action: 'accept' | 'counter' | 'decline';
  responseToken: string;
  selectedSlotIndex?: number;  // For accept
  counterSlots?: string[];     // For counter
  declineReason?: string;      // For decline
  message?: string;
}

// Actions based on action:
// ACCEPT:
//   - Update interview with scheduled_at
//   - Create Teams/Meet meeting if connected
//   - Send confirmation to ALL 3 parties
//   - Attach iCal
//   - Trigger identity_reveal (Triple-Blind Stage 2)
//
// COUNTER:
//   - Store counter_slots in interview
//   - Notify client + recruiter
//   - Status → 'counter_proposed'
//
// DECLINE:
//   - Status → 'declined'
//   - Notify client + recruiter
//   - Optional: Log reason
```

---

## E-Mail Template (Neu)

Das bestehende `interview_invitation` Template wird durch das vom User vorgeschlagene Design ersetzt:

```html
<!-- Template: interview_invitation_candidate -->
<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
  <!-- Header mit Gradient -->
  <div style="background: linear-gradient(135deg, #1a2332 0%, #0f172a 100%);
              color: white; padding: 32px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Interview-Einladung</h1>
    <p style="margin: 8px 0 0; opacity: 0.8;">{{job_title}}</p>
  </div>

  <!-- Body -->
  <div style="background: white; padding: 32px; border: 1px solid #e2e8f0;">
    <p>Hallo {{candidate_name}},</p>
    <p>ein {{company_description}} möchte Sie gerne kennenlernen.</p>

    <!-- Details Tabelle -->
    <table style="width: 100%; margin: 16px 0;">
      <tr><td>Position:</td><td><strong>{{job_title}}</strong></td></tr>
      <tr><td>Format:</td><td>{{meeting_format_label}}</td></tr>
      <tr><td>Dauer:</td><td>{{duration}} Minuten</td></tr>
    </table>

    <!-- Nachricht Box -->
    {{#if client_message}}
    <div style="background: #f8fafc; padding: 16px; border-left: 3px solid #0284c7;">
      <p>Nachricht vom Unternehmen:</p>
      <p><em>„{{client_message}}"</em></p>
    </div>
    {{/if}}

    <!-- Terminvorschläge -->
    <h3>Terminvorschläge:</h3>
    <table>{{slot_list_html}}</table>

    <!-- 3 Action Buttons -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{accept_url}}" style="background: #16a34a; color: white; padding: 14px 32px;">
        ✅ Termin annehmen
      </a>
      <a href="{{counter_url}}" style="background: white; border: 1px solid #e2e8f0; padding: 14px 32px;">
        🔄 Gegenvorschlag
      </a>
      <a href="{{decline_url}}" style="background: white; color: #dc2626; border: 1px solid #fecaca; padding: 14px 32px;">
        ❌ Absagen
      </a>
    </div>

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      🔒 Ihre Daten werden erst nach Ihrer Zustimmung freigegeben (DSGVO-konform).
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #f8fafc; padding: 16px; text-align: center;">
    <p style="font-size: 12px; color: #94a3b8;">
      Versendet über Matchunt • Datenschutz-konform
    </p>
  </div>
</div>
```

---

## Routing

Neue Routes in `App.tsx`:

```typescript
// Kandidaten-Response-Seite
<Route path="/interview/respond/:token" element={<InterviewResponsePage />} />

// Redirect alte Route
<Route path="/interview/select/:token" element={<Navigate to="/interview/respond/:token" replace />} />
```

---

## Datenbank-Erweiterungen

Die `interviews` Tabelle hat bereits die nötigen Felder:
- `proposed_slots` (jsonb)
- `selection_token` (text)
- `pending_opt_in` (boolean)
- `meeting_type` (text)

Neue Felder benötigt:

```sql
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS 
  response_token text UNIQUE,
  counter_slots jsonb,
  decline_reason text,
  candidate_message text,
  meeting_format text, -- 'teams' | 'meet' | 'video' | 'phone' | 'onsite'
  onsite_address text,
  client_message text;
```

---

## Workflow-Zusammenfassung

```text
1. CLIENT klickt "Interview anfragen"
   │
2. WIZARD Step 1: Format + Dauer wählen
   │
3. WIZARD Step 2: Termine wählen (mit Kalender)
   │                └─ Belegte Zeiten ausgegraut
   │                └─ "Smart Suggest" findet freie Slots
   │
4. WIZARD Step 3: Nachricht + DSGVO bestätigen
   │
5. WIZARD Step 4: Preview → "Einladung senden"
   │
6. BACKEND (send-interview-invitation):
   │  ├─ Interview-Record erstellen
   │  ├─ Email an KANDIDAT (schönes Template)
   │  ├─ Notification an Recruiter
   │  └─ Status → 'pending_response'
   │
7. KANDIDAT öffnet Email → klickt Button → InterviewResponsePage
   │
   ├─ ANNEHMEN:
   │    ├─ Wählt Termin
   │    ├─ Backend erstellt Meeting-Link (Teams/Meet)
   │    ├─ Kalender-Event erstellt
   │    ├─ iCal als Email-Anhang
   │    ├─ Bestätigung an ALLE 3 Parteien
   │    └─ Triple-Blind: Identity revealed
   │
   ├─ GEGENVORSCHLAG:
   │    ├─ Kandidat schlägt eigene Termine vor
   │    ├─ Client + Recruiter benachrichtigt
   │    └─ Client kann neuen Termin bestätigen
   │
   └─ ABSAGE:
        ├─ Optional: Grund angeben
        └─ Client + Recruiter benachrichtigt
```

---

## Implementierungsreihenfolge

| Phase | Aufgabe | Priorität |
|-------|---------|-----------|
| 1 | Datenbank-Erweiterungen (Migration) | Hoch |
| 2 | `ProfessionalInterviewWizard.tsx` erstellen | Hoch |
| 3 | `InterviewResponsePage.tsx` erstellen | Hoch |
| 4 | `send-interview-invitation` Edge Function | Hoch |
| 5 | `process-interview-response` Edge Function | Hoch |
| 6 | E-Mail Template updaten | Mittel |
| 7 | Alte Dialoge ersetzen (CandidateActionCard etc.) | Mittel |
| 8 | Alte Komponenten deprecaten | Niedrig |
