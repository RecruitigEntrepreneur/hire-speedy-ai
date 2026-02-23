

# Aufgaben & Einfluss -- Unified Dashboard

## Konzept

Die Seite `/recruiter/influence` wird zu einer klaren Zwei-Zonen-Seite: Links die Aufgabenliste (das Tagesgeschaeft), rechts die Einflussuebersicht (wie gut bin ich, wo stehe ich). Kein Playbook-Fokus, kein Gamification-Jargon wie "THE POWER 3" -- stattdessen professionelle Begriffe.

## Layout

```text
+=============================================================================+
|  [CheckSquare] Aufgaben & Einfluss                         [Score-Badge]   |
|                                                                             |
|  [Alle (20)] [Opt-In] [Follow-up] [Interview] [Sonstige]   <- Filter-Tabs  |
|                                                                             |
|  +--- Aufgaben (2/3) -------------------------+  +--- Einfluss (1/3) -----+|
|  |                                             |  |                        ||
|  |  CompactTaskList                            |  |  PerformanceIntel      ||
|  |  (alle Alerts, kein Limit)                  |  |  (Score, Speed, KPIs)  ||
|  |                                             |  |                        ||
|  |  Prioritaet (9)                             |  +------------------------+|
|  |  [Karten wie bisher]                        |  |                        ||
|  |                                             |  |  TeamLeaderboard       ||
|  |  Weitere (11)                               |  |  (Top 3, kompakt)      ||
|  |  [Karten wie bisher]                        |  |                        ||
|  |                                             |  +------------------------+|
|  |                                             |  |                        ||
|  |                                             |  |  Erledigt (12)         ||
|  |                                             |  |  [aufklappbar]         ||
|  |                                             |  |  - Name, vor 2h       ||
|  |                                             |  |  - Name, vor 5h       ||
|  +---------------------------------------------+  +------------------------+|
+=============================================================================+
```

## Was passiert mit den Komponenten

| Komponente | Aktion |
|---|---|
| `CompactTaskList` | Wird zur Hauptkomponente, bekommt `maxItems={999}` und `showViewAll={false}` |
| `PerformanceIntel` | Wandert in die rechte Sidebar, 1:1 wiederverwendet |
| `TeamLeaderboard` | Wandert in die Sidebar, `limit={3}` statt 5 |
| `InfluenceScoreBadge` | Bleibt im Header rechts, 1:1 wiederverwendet |
| `PowerThreeActions` | Wird entfernt (Import + Rendering) |
| `PlaybookViewer` | Bleibt als Sheet fuer den Fall, dass ein Alert ein Playbook hat -- oeffnet sich bei Klick auf Karte, wenn playbook_id vorhanden |
| `useCandidateBehaviors` | Wird entfernt (wurde nur fuer PowerThree gebraucht) |

## Aenderungen im Detail

### Datei 1: `src/components/layout/DashboardLayout.tsx`

- Zeile 95: Label `'Influence'` wird zu `'Aufgaben'`
- Icon: `Target` wird zu `CheckSquare` (Import hinzufuegen)

### Datei 2: `src/pages/recruiter/RecruiterInfluence.tsx`

**Entfernen:**
- Import + Verwendung von `PowerThreeActions`
- Import + Verwendung von `useCandidateBehaviors`
- `behaviors`, `behaviorsLoading` State

**Header aendern:**
- Titel: "Influence Dashboard" wird zu "Aufgaben & Einfluss"
- Subtext: "Die 3 Hebel fuer deinen naechsten Deal" wird zu "Offene Aufgaben und Einflussuebersicht"
- Icon: `Target` wird zu `CheckSquare`
- `Sparkles`-Icon im Subtext entfernen

**Neuer State:**
- `activeFilter: 'all' | 'opt_in' | 'follow_up' | 'interview' | 'other'` -- fuer die Filter-Tabs

**candidateMap erweitern:**
- `jobTitle` und `companyName` aus `submissions.jobs` in die Map einfuegen (das Interface in CompactTaskList unterstuetzt das bereits)

**Filter-Logik:**
- `opt_in`: alert_type beginnt mit `opt_in_`
- `follow_up`: `follow_up_needed`, `no_activity`, `engagement_drop`, `ghosting_risk`
- `interview`: `interview_prep_missing`, `interview_reminder`
- `other`: alles andere
- Gefilterte Alerts werden an CompactTaskList uebergeben

**Layout umbauen:**
- Grid von `lg:grid-cols-5` auf `lg:grid-cols-3`
- Linke Spalte (`col-span-2`): Filter-Tabs + CompactTaskList (maxItems=999, showViewAll=false)
- Rechte Spalte (`col-span-1`): PerformanceIntel + TeamLeaderboard (limit=3) + Erledigte-Sektion
- `TeamLeaderboard` wird von unterhalb des Grids in die Sidebar verschoben

**Erledigte Aufgaben (neu in Sidebar):**
- Aufklappbare `Collapsible`-Sektion
- Zeigt Alerts mit `action_taken !== null` (letzte 5)
- Kompakte Zeilen: Name + "vor X Stunden/Tagen" (mit `formatDistanceToNow`)

**PlaybookViewer bleibt:**
- Wird weiterhin als Sheet gerendert wenn ein Alert mit `playbook_id` angeklickt wird
- Keine Aenderung an der Logik, nur nicht mehr der Hauptfokus der Seite

### Datei 3: `src/components/influence/CompactTaskList.tsx`

Keine strukturellen Aenderungen noetig. Die Komponente ist bereits flexibel genug durch die bestehenden Props (`maxItems`, `showViewAll`, `candidateMap` mit jobTitle/companyName).

## Zusammenfassung

3 Dateien, davon 2 mit substantiellen Aenderungen:

| Datei | Aenderung |
|---|---|
| `DashboardLayout.tsx` | Nav-Label + Icon (2 Zeilen) |
| `RecruiterInfluence.tsx` | Layout umbauen, PowerThree raus, Filter-Tabs rein, Sidebar mit bestehenden Komponenten |
| `CompactTaskList.tsx` | Keine Aenderung noetig |

0 neue Komponenten, 0 neue Hooks. Alles Bestehende wird wiederverwendet.

