

# Kandidatenseite: Interview-Sektion + Externes Interview eintragen

## Uebersicht

Die Kandidatenseite bekommt eine neue Interview-Sektion, die alle Interviews (geplante + manuell eingetragene) anzeigt. Dazu kommt ein minimales Formular zum Eintragen externer Interviews.

## Aktueller Zustand

Fuer Marko Benko existiert bereits ein Interview in der Datenbank:

```text
Interview: 50c0aec9...
  - scheduled_at: NULL (noch kein Termin)
  - status: pending_response
  - pending_opt_in: true
  - meeting_type: teams
  - Job: "Data & Dashboard Engineer"
```

Dieses Interview wird auf der Kandidatenseite **nirgends** angezeigt. Der Recruiter sieht nur:
- Die Pipeline-Stage "Interview" im Hero-Header
- Eine Aufgabe in der CandidateTasksSection (wenn Alert existiert)
- ABER: Kein Interview-Eintrag mit Details

## Was gebaut wird

### 1. Neue Komponente: `CandidateInterviewsCard`

Eine kompakte Karte, die alle Interviews fuer diesen Kandidaten anzeigt.

```text
+------------------------------------------------------------------+
| [Calendar] Interviews                                      (2)   |
+------------------------------------------------------------------+
| [Teams]  Data & Dashboard Engineer                               |
|          Ausstehend -- Warte auf Opt-In                          |
|          Angefragt am 22.02.2026                                 |
+------------------------------------------------------------------+
| [Phone]  Buchhalter @ FITSEVENELEVEN        [Manuell]            |
|          20.02.2026, 30 Min -- Kennenlernen                      |
|          Erstgespräch gefuehrt, positiver Eindruck               |
+------------------------------------------------------------------+
| [+] Externes Interview eintragen                                 |
+------------------------------------------------------------------+
```

**Pro Eintrag wird angezeigt:**
- Meeting-Typ-Icon (Video/Telefon/Vor Ort)
- Job-Titel (als Link wenn moeglich)
- Interview-Typ (Kennenlernen, Fachinterview, etc.)
- Status-Badge: Ausstehend / Geplant / Abgeschlossen / Abgesagt
- Datum & Uhrzeit (wenn vorhanden, sonst "Angefragt am...")
- Bei manuellen Eintraegen: "Manuell"-Badge
- Optionale Notizen (gekuerzt, 1 Zeile)

**Keine Quick-Actions** -- nur informativ. Der Recruiter wird informiert, aber kann hier nichts aendern.

### 2. Minimales Formular: "Externes Interview eintragen"

Ein kompakter Inline-Dialog (kein separater Dialog, sondern Collapsible am Ende der Karte):

```text
+------------------------------------------------------------------+
| [v] Externes Interview eintragen                                 |
|                                                                  |
|  Datum:  [22.02.2026]    Interview-Typ: [Kennenlernen v]         |
|  Notizen: [Erstgespraech per Telefon gefuehrt]                   |
|                                              [Speichern]         |
+------------------------------------------------------------------+
```

**Felder:**
- Datum (Pflicht) -- Date-Picker, Default: heute
- Interview-Typ (Optional) -- Select aus `interview_types` Tabelle (Kennenlernen, Fachinterview, Case Study, Culture Fit, Abschlussgespraech)
- Notizen (Optional) -- kurzer Freitext

**Was passiert beim Speichern:**
- Neuer Eintrag in `interviews` Tabelle mit `status: 'completed'`, `scheduled_at: gewaehltes Datum`, `meeting_type: 'phone'` (Default), `notes: Freitext`
- Braucht eine `submission_id` -- wenn der Kandidat nur eine aktive Submission hat, wird diese automatisch gewaehlt. Bei mehreren: Dropdown zur Auswahl des Jobs.

### 3. Platzierung auf der Kandidatenseite

**Profil-Tab (kompakt):**
- Die `CandidateInterviewsCard` wird im **rechten Spalte** eingefuegt, zwischen `QuickInterviewSummary` und `Karriere-Timeline`
- Zeigt maximal 3 Interviews, mit "Alle X anzeigen" Link zum Prozess-Tab

**Prozess-Tab (ausfuehrlich):**
- Gleiche Komponente, aber alle Interviews sichtbar
- Direkt unter der `CandidateTasksSection`
- Mit dem "Externes Interview eintragen"-Formular

### 4. Daten-Flow

```text
interviews Tabelle
  |
  +-- submission_id --> submissions --> jobs (fuer Job-Titel)
  |
  +-- interview_type_id --> interview_types (fuer Typ-Label)
  |
  +-- scheduled_at, status, meeting_type, notes
```

Query: Alle Interviews fuer Submissions dieses Kandidaten, sortiert nach `created_at DESC`.

## Technische Umsetzung

### Dateien

| Datei | Aenderung |
|---|---|
| `src/components/candidates/CandidateInterviewsCard.tsx` | **NEU** -- Kompakte Interview-Liste + minimales Formular fuer externe Interviews |
| `src/components/candidates/CandidateProfileTab.tsx` | Interview-Karte in rechte Spalte einfuegen (zwischen QuickInterviewSummary und Karriere-Timeline), max 3 Eintraege |
| `src/components/candidates/CandidateProcessTab.tsx` | Vollstaendige Interview-Karte unter Tasks einfuegen, mit Formular |

### `CandidateInterviewsCard` -- Komponente

**Props:**
```text
interface CandidateInterviewsCardProps {
  candidateId: string;
  maxItems?: number;          // undefined = alle, 3 = kompakt
  showAddForm?: boolean;      // false im Profil-Tab, true im Prozess-Tab
  onViewAll?: () => void;     // Link zum Prozess-Tab
}
```

**Daten laden:**
- Query: `interviews` JOIN `submissions` JOIN `jobs` WHERE `submissions.candidate_id = candidateId`
- Zusaetzlich: `interview_types` fuer Typ-Labels
- Sortierung: `scheduled_at DESC NULLS LAST`, dann `created_at DESC`

**Interview-Typ-Labels aus DB:**
- Kennenlernen (30 Min)
- Fachinterview (60 Min)
- Case Study (90 Min)
- Culture Fit (45 Min)
- Abschlussgespraech (30 Min)

**Status-Mapping:**
```text
'pending'           -> Badge "Ausstehend" (gelb)
'pending_response'  -> Badge "Warte auf Antwort" (blau)
'scheduled'         -> Badge "Geplant" (gruen)
'completed'         -> Badge "Abgeschlossen" (grau)
'cancelled'         -> Badge "Abgesagt" (rot)
'no_show'           -> Badge "Nicht erschienen" (rot)
```

Fuer `pending_opt_in: true` wird zusaetzlich "(Opt-In ausstehend)" angezeigt.

**Minimales Formular (Collapsible):**
- Nutzt `interview_types` Select
- Default-Submission: automatisch die erste aktive Submission; bei mehreren ein Select-Dropdown
- Insert in `interviews`: `{ submission_id, scheduled_at, status: 'completed', meeting_type: 'phone', notes, interview_type_id }`

### Profil-Tab Aenderung

Rechte Spalte wird:
1. QuickInterviewSummary (bleibt)
2. **CandidateInterviewsCard** (NEU, maxItems=3, showAddForm=false)
3. Karriere-Timeline (bleibt)
4. Similar Candidates (bleibt)

### Prozess-Tab Aenderung

Unter CandidateTasksSection:
- **CandidateInterviewsCard** (NEU, alle Interviews, showAddForm=true)

## Zusammenfassung

- 1 neue Datei: `CandidateInterviewsCard.tsx`
- 2 geaenderte Dateien: `CandidateProfileTab.tsx`, `CandidateProcessTab.tsx`
- Keine Datenbank-Aenderungen -- alles nutzt die bestehende `interviews` + `interview_types` Tabellen
- Kein neuer Hook -- Query direkt in der Komponente
- Nur informativ -- keine Quick-Actions, der Recruiter sieht die Interview-Daten aber kann hier nichts aendern

