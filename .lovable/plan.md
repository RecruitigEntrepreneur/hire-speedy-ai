

# Fix: Interview-Anfrage erzeugt keine Aufgabe beim Recruiter

## Root-Cause-Analyse

Es gibt **3 Probleme**, die zusammenwirken:

### Problem 1: Falscher Dialog wird verwendet

Auf der Client-Kandidatenseite (`CandidateDetail.tsx`) wird der `ProfessionalInterviewWizard` verwendet, der die Edge Function `send-interview-invitation` aufruft. Diese Edge Function erstellt **keinen** `influence_alert`. Unser Code-Change war im `InterviewRequestWithOptInDialog` -- der wird aber auf der Kandidaten-Detailseite gar nicht benutzt.

```text
CandidateDetail.tsx
  |
  +--> ProfessionalInterviewWizard
         |
         +--> Edge Function "send-interview-invitation"
                |
                +--> interviews INSERT ✓
                +--> submissions UPDATE ✓  
                +--> notifications INSERT ✓
                +--> influence_alerts INSERT ✗  <-- FEHLT!
```

### Problem 2: Dashboard-Query ist kaputt

In `RecruiterDashboard.tsx` (Zeile 225) wird nach `status: 'active'` in der `influence_alerts`-Tabelle gefiltert -- diese Spalte existiert aber gar nicht. Das erzeugt massenweise Postgres-Fehler (`column influence_alerts.status does not exist`) und verhindert das Laden von Alerts.

### Problem 3: Kein visueller Hinweis auf der Kandidatenseite

Auf der Recruiter-Kandidatenseite fehlt ein sichtbarer Hinweis, dass ein Interview angefragt wurde. Die `CandidateTasksSection` zeigt zwar Aufgaben an, aber nur wenn der `influence_alert` existiert -- der aber wegen Problem 1 nicht erstellt wird.

## Loesung

### Aenderung 1: Edge Function `send-interview-invitation` erweitern

**Datei: `supabase/functions/send-interview-invitation/index.ts`**

Nach dem Notification-Insert (ca. Zeile 280) einen `influence_alert` einfuegen:

```text
// Nach: await supabase.from('notifications').insert(...)

await supabase.from('influence_alerts').insert({
  submission_id: submissionId,
  recruiter_id: submission.recruiter_id,
  alert_type: 'opt_in_pending',
  priority: 'critical',
  title: `Interview-Anfrage: ${candidate.full_name} – ${job.title}`,
  message: `Ein Kunde moechte ${candidate.full_name} fuer "${job.title}" interviewen.`,
  recommended_action: 'Kontaktieren Sie den Kandidaten und holen Sie die Zustimmung (Opt-In) ein.',
});
```

### Aenderung 2: Dashboard-Query fixen

**Datei: `src/pages/recruiter/RecruiterDashboard.tsx`**

Zeile 225: `.match({ submission_id: sid, status: 'active' })` ersetzen durch `.match({ submission_id: sid, is_dismissed: false })` und `.is('action_taken', null)`.

```text
// Vorher (Zeile 221-227):
for (const sid of submissionIds) {
  const res = await supabase
    .from('influence_alerts')
    .select('submission_id')
    .match({ submission_id: sid, status: 'active' });  // KAPUTT
  if (res.data) alertData = [...alertData, ...res.data];
}

// Nachher:
for (const sid of submissionIds) {
  const res = await supabase
    .from('influence_alerts')
    .select('submission_id')
    .eq('submission_id', sid)
    .eq('is_dismissed', false)
    .is('action_taken', null);
  if (res.data) alertData = [...alertData, ...res.data];
}
```

### Aenderung 3: `CandidateTasksSection` mit Opt-In-Aktionen

**Datei: `src/components/candidates/CandidateTasksSection.tsx`**

Fuer `opt_in_pending`-Aufgaben kontextspezifische Aktionen anzeigen:

```text
Vorher:
+------------------------------------------------------------+
| [!!] Interview-Anfrage: Max M. -- Buchhalter               |
|      Opt-In beim Kandidaten einholen                        |
|                                       [Erledigt]           |
+------------------------------------------------------------+

Nachher:
+------------------------------------------------------------+
| [!!] Interview-Anfrage: Max M. -- Buchhalter               |
|      Opt-In beim Kandidaten einholen                        |
|                                                             |
|      [Anrufen] [Email] [Opt-In bestaetigen] [Erledigt]     |
+------------------------------------------------------------+
```

Konkrete Aenderungen:
- Kandidaten-Kontaktdaten (Email, Phone) mit laden (ueber Submission -> Candidate Join)
- Fuer `alert_type === 'opt_in_pending'`: Anrufen/Email-Links + "Opt-In bestaetigen"-Button
- "Opt-In bestaetigen" setzt `submissions.stage` auf `candidate_opted_in` und markiert den Alert als erledigt

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `supabase/functions/send-interview-invitation/index.ts` | Nach Notification-Insert: `influence_alert` mit `alert_type: 'opt_in_pending'` erstellen |
| `src/pages/recruiter/RecruiterDashboard.tsx` | Zeile 225: `status: 'active'` durch `is_dismissed: false` + `action_taken IS NULL` ersetzen |
| `src/components/candidates/CandidateTasksSection.tsx` | Kandidaten-Kontaktdaten laden; Opt-In-spezifische Aktionen (Anrufen, Email, Bestaetigen) |

## Ergebnis nach dem Fix

```text
Kunde klickt "Interview anfragen" (CandidateDetail.tsx)
        |
        v
ProfessionalInterviewWizard -> send-interview-invitation
        |
        +--> Interview erstellt ✓
        +--> Submission Stage aktualisiert ✓
        +--> Notification erstellt ✓
        +--> influence_alert erstellt ✓  <-- NEU
        |
        v
Recruiter Dashboard:
        +--> CompactTaskList zeigt "Opt-In einholen" ✓ (Query gefixt)
        +--> Kandidatenseite zeigt Aufgabe mit Aktionen ✓
```

