

# Interview-Anfrage als Aufgabe im Recruiter Dashboard

## Idee

Statt einer neuen Komponente nutzen wir das bestehende Aufgaben-System (`influence_alerts` + `CompactTaskList`). Wenn ein Kunde ein Interview anfragt, wird ein `influence_alert` erstellt -- der Recruiter sieht es sofort bei seinen Aufgaben.

## Aktuelles Dashboard (Aufgaben-Bereich)

```text
+--------------------------------------------------------------------+
| Heute zu tun                                              [9]      |
|                                                                    |
| KRITISCH (1)                                                       |
| +------------------+                                               |
| | [!] Philipp N.   |                                               |
| | Buchhalter       |                                               |
| | [Kontaktieren]   |                                               |
| | [Tel] [Mail] [v] |                                               |
| +------------------+                                               |
|                                                                    |
| HOCH (8)                                                           |
| +------------------+ +------------------+ +------------------+     |
| | [!] Jens E.      | | [!] Vladislav C. | | [!] Horst S.     |    |
| | Ghosting-Risiko  | | Ghosting-Risiko  | | Ghosting-Risiko  |    |
| | ...              | | ...              | | ...              |    |
| +------------------+ +------------------+ +------------------+     |
+--------------------------------------------------------------------+
```

## Neues Dashboard (mit Interview-Aufgabe)

```text
+--------------------------------------------------------------------+
| Heute zu tun                                             [11]      |
|                                                                    |
| KRITISCH (2)                                    <-- +1 NEU         |
| +------------------+ +------------------+                          |
| | [!] Andreas P.   | | [!] Philipp N.   |                         |
| | Buchhalter       | | Buchhalter       |                         |
| | @ FITSEVENELEVEN  | | [Kontaktieren]   |                         |
| | [Nachfassen]     | | [Tel] [Mail] [v] |                         |
| | [Tel] [Mail] [v] | +------------------+                         |
| +------------------+                                               |
|          ^                                                         |
|          |                                                         |
|    NEU: Interview-Anfrage als kritische Aufgabe                    |
|    alert_type: 'opt_in_pending'                                    |
|    priority: 'critical'                                            |
|    Aktion: "Opt-In beim Kandidaten einholen"                       |
|                                                                    |
| HOCH (8)                                                           |
| +------------------+ +------------------+ ...                      |
+--------------------------------------------------------------------+
```

## Was passiert technisch?

Einzige Aenderung: Im `InterviewRequestWithOptInDialog` wird neben der Notification auch ein `influence_alert` erstellt.

```text
Kunde klickt "Interview anfragen"
        |
        v
+---------------------------+
| 1. Submission updaten     |  (stage -> interview_requested)
| 2. Notification erstellen |  (notifications Tabelle -- bleibt)
| 3. influence_alert        |  <-- NEU
|    erstellen              |
+---------------------------+
        |
        v
Recruiter sieht sofort in seiner
CompactTaskList: "Interview-Anfrage --
Opt-In beim Kandidaten einholen"
```

## Aenderung: 1 Datei

### `src/components/dialogs/InterviewRequestWithOptInDialog.tsx`

Nach dem Notification-Insert (Zeile 174-181) wird ein `influence_alert` eingefuegt:

```text
// Zeile ~182, nach dem Notification-Insert:

await supabase.from('influence_alerts').insert({
  submission_id: submissionId,
  recruiter_id: submission.recruiter_id,
  alert_type: 'opt_in_pending',
  priority: 'critical',
  title: `Interview-Anfrage: ${candidateAnonymousId} -- ${jobTitle}`,
  message: `Ein Kunde moechte ${candidateAnonymousId} fuer "${jobTitle}" interviewen.`,
  recommended_action: 'Kontaktieren Sie den Kandidaten und holen Sie die Zustimmung (Opt-In) ein.',
});
```

Das ist alles. Kein neues UI, keine neue Komponente. Der Alert erscheint automatisch in:
- `CompactTaskList` auf dem Dashboard (als "Kritisch" mit rotem Indikator)
- `ActionCenterPanel` auf der Influence-Seite
- `CandidateTasksSection` auf der Kandidaten-Detailseite

### Zusaetzlich: `CompactTaskList` Action-Label

In `src/components/influence/CompactTaskList.tsx` muss der `getShortAction` Map um den neuen Alert-Type erweitert werden:

```text
// In getShortAction (Zeile ~63):
'opt_in_pending': 'Opt-In einholen',
```

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `src/components/dialogs/InterviewRequestWithOptInDialog.tsx` | Nach Notification-Insert: `influence_alert` mit `alert_type: 'opt_in_pending'`, `priority: 'critical'` erstellen |
| `src/components/influence/CompactTaskList.tsx` | `'opt_in_pending': 'Opt-In einholen'` zum Action-Label-Map hinzufuegen |

Keine neuen Komponenten, keine Layout-Aenderungen -- die bestehende Aufgaben-Infrastruktur wird einfach mitgenutzt.
