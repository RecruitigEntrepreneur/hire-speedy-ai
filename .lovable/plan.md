
# Interview-System vereinfachen: OAuth entfernen, E-Mail-Flow nutzen

## Analyse: Was existiert bereits?

Das Projekt hat bereits einen vollständigen E-Mail-basierten Interview-Flow:

### Bestehende Edge Functions (funktionieren!)

| Funktion | Beschreibung |
|----------|-------------|
| `send-interview-invitation` | Sendet gebrandete Interview-Einladung per E-Mail mit Accept/Counter/Decline-Buttons |
| `process-interview-response` | Verarbeitet Kandidaten-Antwort und sendet Bestätigungs-E-Mails an alle Beteiligten |

### Bestehender Flow (bereits implementiert)

```text
Client (ProfessionalInterviewWizard)
  |
  v
[1] Wählt Format (Teams/Meet/Video/Phone/Onsite), Dauer, Slots, Nachricht
  |
  v
[2] System sendet: send-interview-invitation
  |
  v
[3] Kandidat erhält E-Mail mit:
    - Anonymisiertes Unternehmen (z.B. "IT-Unternehmen")
    - Position + Terminvorschläge
    - Buttons: "Termin annehmen" / "Gegenvorschlag" / "Absagen"
  |
  v
[4] Kandidat klickt Link -> InterviewResponsePage (/interview/respond/:token)
  |
  v
[5] Bei Annahme: process-interview-response
    - Aktualisiert Interview auf "scheduled"
    - Sendet Bestätigungs-E-Mail AN KANDIDAT (mit iCal-Anhang)
    - Sendet Bestätigungs-E-Mail AN RECRUITER
    - Erstellt Notifications für Recruiter + Client
```

## Was fehlt? (Erweiterungen)

### 1. Client erhält keine E-Mail-Bestätigung
Der Client (Auftraggeber) erhält zwar eine **Notification**, aber **keine E-Mail**.

### 2. E-Mail an Client mit vollständigen Kandidaten-Daten fehlt
Nach Opt-In sollte der Client den echten Namen, Telefon, E-Mail etc. des Kandidaten bekommen.

---

## Umsetzungsplan

### Teil A: OAuth-Code aufräumen (optional, aber empfohlen)

Da wir keine direkte Kalender-Integration mehr brauchen, können wir den OAuth-Code entfernen:

**Dateien zu entfernen:**
- `supabase/functions/microsoft-auth/index.ts`
- `supabase/functions/google-auth/index.ts`
- `supabase/functions/create-teams-meeting/index.ts`
- `supabase/functions/create-google-meeting/index.ts`
- `src/hooks/useMicrosoftAuth.ts`
- `src/hooks/useGoogleAuth.ts`
- `src/pages/integrations/OAuthCallback.tsx`
- Route `/oauth/callback` aus `App.tsx`

**Dateien zu bereinigen (OAuth-Referenzen entfernen):**
- `src/components/settings/CalendarConnectionCard.tsx`
- `src/components/dialogs/interview-wizard/InterviewWizardStep2Slots.tsx`
- `src/components/talent/InterviewSchedulingDialog.tsx`
- `src/pages/recruiter/RecruiterIntegrations.tsx`
- `supabase/config.toml` (Edge Function-Einträge entfernen)

### Teil B: E-Mail-Bestätigung an Client hinzufügen

**Datei:** `supabase/functions/process-interview-response/index.ts`

Nach erfolgreicher Terminannahme (im `case 'accept'`-Block) eine zusätzliche E-Mail an den Client senden:

```typescript
// Im accept-Block nach Zeile ~213:

// Email to Client with FULL candidate data (identity reveal)
if (job.client_id) {
  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('user_id', job.client_id)
    .single();

  if (clientProfile?.email) {
    await resend.emails.send({
      from: "Matchunt <noreply@matchunt.ai>",
      to: [clientProfile.email],
      subject: `Interview bestätigt: ${candidate.full_name} für ${job.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Interview bestätigt</h2>
          <p>Der Kandidat hat das Interview für <strong>${job.title}</strong> bestätigt.</p>
          
          <h3>Kandidaten-Details (freigeschaltet)</h3>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px;">
            <p><strong>Name:</strong> ${candidate.full_name}</p>
            <p><strong>E-Mail:</strong> ${candidate.email}</p>
            ${candidate.phone ? `<p><strong>Telefon:</strong> ${candidate.phone}</p>` : ''}
          </div>
          
          <h3>Termin-Details</h3>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px;">
            <p><strong>Datum:</strong> ${formatDate(scheduledAt)}</p>
            <p><strong>Uhrzeit:</strong> ${formatTime(scheduledAt)} Uhr</p>
            <p><strong>Dauer:</strong> ${interview.duration_minutes} Minuten</p>
            ${interview.meeting_link ? `<p><strong>Link:</strong> ${interview.meeting_link}</p>` : ''}
          </div>
          
          <p style="margin-top: 24px;">Sie finden den Termin auch im angehängten Kalender-Event.</p>
        </div>
      `,
      attachments: [{
        filename: 'interview.ics',
        content: btoa(icalContent),
      }],
    });
  }
}
```

---

## Empfohlene Reihenfolge

| Schritt | Beschreibung | Priorität |
|---------|--------------|-----------|
| 1 | E-Mail an Client in `process-interview-response` ergänzen | Hoch |
| 2 | OAuth-Code entfernen (Cleanup) | Niedrig |
| 3 | UI-Komponenten bereinigen (Kalender-Verbinden-Buttons entfernen) | Niedrig |

---

## Entscheidungsfrage

Möchtest du:
1. **Nur die E-Mail-Bestätigung an den Client hinzufügen** (schnell, minimal)
2. **Den gesamten OAuth-Code aufräumen** (sauberer, aber umfangreicher)
3. **Beides** (empfohlen für langfristige Wartbarkeit)
