

# Fix: Marko Benko fehlt in Aufgaben + Professionelles Task-Design

## Analyse: 3 Probleme gefunden

### Problem 1: Kein Alert existiert fuer Marko Benko

Die Datenbank zeigt: Fuer Marko Benkos Submission (`876e791f...`) existiert **kein einziger** `influence_alert`. Die Interview-Anfrage wurde gestellt **bevor** wir den Alert-Code in die Edge Function eingebaut haben. Der Alert wurde also nie erstellt.

**Loesung:** Beim Laden des Dashboards pruefen, ob Submissions im Status `interview_requested` existieren, fuer die KEIN `influence_alert` vom Typ `opt_in_pending` vorhanden ist. Falls ja: automatisch nachholen.

### Problem 2: Pipeline zeigt falsche Stage-Zuordnung

Die `SubmissionsPipeline` mappt Stages so:

```text
Interview-Spalte: statuses: ['interview']
```

Marko Benkos Stage ist aber `interview_requested` -- das matcht auf `interview` weil sein `status` = `'interview'` ist. Er erscheint also in der Pipeline korrekt. Aber der Zusammenhang zur Aufgabe fehlt komplett.

### Problem 3: Task-Karten zeigen keinen Aufgabengrund

Aktuell sehen die Karten so aus:

```text
+------------------+
| [!] Jens E.      |
|                   |
| [Kontaktieren]   |  <-- Nur generischer Action-Text
| [Tel] [Mail] [v] |
+------------------+
```

Es fehlt:
- **Warum** die Aufgabe existiert (z.B. "Seit 5 Tagen keine Reaktion")
- **Farbliche Konsistenz** mit dem Design-System
- **Zeitangabe** wann die Aufgabe erstellt wurde

## Professionelles Wireframe

### Aktuell (unprofessionell)

```text
+--------------------------------------------------------------------+
| Heute zu tun                                              [9]      |
|                                                                    |
| KRITISCH (1)                                                       |
| +------------------+                                               |
| | [!] Philipp N.   |                                               |
| |                   |  <-- Kein Grund, keine Zeitangabe            |
| | [Kontaktieren]   |  <-- Generischer Text                        |
| | [Tel] [Mail] [v] |                                               |
| +------------------+                                               |
|                                                                    |
| HOCH (8)                                                           |
| +------------------+ +------------------+ +------------------+     |
| | [!] Jens E.      | | [!] Vladislav C. | | [!] Horst S.     |    |
| | [Kontaktieren]   | | [Kontaktieren]   | | [Kontaktieren]   |    |
| | [Tel] [Mail] [v] | | [Tel] [Mail] [v] | | [Tel] [Mail] [v] |    |
| +------------------+ +------------------+ +------------------+     |
|                                                                    |
| Alle Karten sehen identisch aus -- kein Kontext, kein Grund        |
+--------------------------------------------------------------------+
```

### Neu (professionell)

```text
+--------------------------------------------------------------------+
| Aufgaben                                                 [10]      |
|                                                                    |
| DRINGEND                                                           |
| +----------------------------------------------------------------+ |
| | [!!] Marko Benko                     Interview-Anfrage   2 Std | |
| |      Data & Dashboard Engineer @ [Analytics]                    | |
| |      "Kunde moechte ein Interview -- Opt-In einholen"          | |
| |      [Anrufen] [Email]                    [Opt-In best.] [OK]  | |
| +----------------------------------------------------------------+ |
| | [!!] Philipp Numberger               Ghosting-Risiko     2 Tg | |
| |      Buchhalter @ FITSEVENELEVEN                                | |
| |      "Seit 2 Tagen keine Reaktion auf Anfrage"                 | |
| |      [Anrufen] [Email]                             [Erledigt]  | |
| +----------------------------------------------------------------+ |
|                                                                    |
| OFFEN (8)                                                          |
| +----------------------------------------------------------------+ |
| | [!] Jens Eyrich                      Ghosting-Risiko    1 Wo  | |
| |     Buchhalter -- "Seit 7 Tagen keine Reaktion"                | |
| |     [Anrufen] [Email]                              [Erledigt]  | |
| +----------------------------------------------------------------+ |
| | [!] Vladislav Chelakov               Ghosting-Risiko    1 Wo  | |
| |     "Seit 8 Tagen keine Reaktion"                              | |
| |     [Anrufen] [Email]                              [Erledigt]  | |
| +----------------------------------------------------------------+ |
| | ... weitere 6 Aufgaben ...                                     | |
| +----------------------------------------------------------------+ |
|                                                                    |
| [Alle 10 Aufgaben anzeigen -->]                                    |
+--------------------------------------------------------------------+
```

### Unterschiede zum aktuellen Design

| Aspekt | Aktuell | Neu |
|---|---|---|
| Layout | Horizontale Karten (200px breit, scrollen) | Vertikale Liste (volle Breite, scanbar) |
| Aufgabengrund | Fehlt komplett | Alert-`message` wird angezeigt |
| Zeitangabe | Fehlt | Relative Zeit ("2 Std", "1 Wo") |
| Job-Kontext | Nur teilweise | Immer: Jobtitel + Firma |
| Alert-Typ | Nur als Badge-Text | Als farbiges Label rechts oben |
| Gruppierung | Nach Priority (Kritisch/Hoch/Weitere) | Nach Dringlichkeit (Dringend/Offen) -- vereinfacht |
| Farben | `bg-destructive/5` mit `border-l-destructive` | Konsistent: Rot-Toene fuer dringend, Slate fuer offen |

## Technische Umsetzung

### Aenderung 1: Fehlende Alerts nachholen

**Datei: `src/pages/recruiter/RecruiterDashboard.tsx`**

Neue Funktion `ensureInterviewAlerts()` die beim Dashboard-Load prueft:

```text
1. Lade alle Submissions mit stage = 'interview_requested' fuer den Recruiter
2. Lade alle influence_alerts mit alert_type = 'opt_in_pending' fuer den Recruiter
3. Fuer jede Submission OHNE passenden Alert: Alert erstellen
```

Dies wird in `fetchCandidateMapForAlerts()` integriert oder als separater `useEffect` ausgefuehrt. So werden bestehende Interview-Anfragen (wie Marko Benko) nachtraeglich erfasst.

### Aenderung 2: CompactTaskList komplett umbauen

**Datei: `src/components/influence/CompactTaskList.tsx`**

Kompletter Umbau von horizontalen Karten zu vertikaler Liste:

**Neue TaskRow-Komponente (statt TaskCard):**
- Volle Breite statt 200px Karte
- Zeigt: Priority-Icon | Kandidatenname | Aufgabengrund (`alert.message`) | Alert-Typ-Label | Zeitangabe
- Quick Actions rechts: Anrufen/Email/Typ-spezifisch/Erledigt
- Fuer `opt_in_pending`: zusaetzlich "Opt-In bestaetigen"-Button
- Hover-Effekt statt Card-Shadow

**Vereinfachte Gruppierung:**
- "Dringend": `priority === 'critical'` (roter Akzent)
- "Offen": alles andere (neutraler Akzent)
- Keine separaten Sektionen fuer high/medium/low

**Zeitangabe berechnen:**
- Aus `alert.created_at` relative Zeit berechnen ("vor 2 Std", "vor 1 Tag", "vor 1 Wo")
- Zeigt an wie lange die Aufgabe schon offen ist

**Farbsystem:**
- Dringend: `border-l-red-500 bg-red-50/50` (konsistent mit Design)
- Offen: `border-l-slate-300 bg-slate-50/30`
- Kein `bg-destructive/5` oder `bg-amber-500/5` mehr -- stattdessen die Projekt-Farbpalette

### Aenderung 3: getShortAction durch getAlertTypeLabel ersetzen

In `CompactTaskList.tsx` wird die Action-Map erweitert um lesbare Labels:

```text
'opt_in_pending'    -> 'Interview-Anfrage'
'ghosting_risk'     -> 'Ghosting-Risiko'
'follow_up_needed'  -> 'Follow-up'
'sla_warning'       -> 'SLA-Warnung'
'no_activity'       -> 'Keine Aktivitaet'
...
```

Diese Labels werden als farbige Badges rechts in der Zeile angezeigt.

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `src/pages/recruiter/RecruiterDashboard.tsx` | `ensureInterviewAlerts()`: Prueft ob fuer `interview_requested`-Submissions Alerts existieren, erstellt fehlende |
| `src/components/influence/CompactTaskList.tsx` | Kompletter Umbau: Vertikale Liste statt horizontale Karten, mit Aufgabengrund, Zeitangabe, Alert-Typ-Label und konsistenten Farben |

Keine neuen Dateien, keine neuen Hooks. Bestehende Daten (`alert.message`, `alert.created_at`, `alert.alert_type`) werden einfach endlich angezeigt.

