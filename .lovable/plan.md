

# Kandidaten-Detail-Seite: Recruiter Command Center

## Denkweise des Recruiters

Ein Headhunter oeffnet die Kandidaten-Seite mit genau drei Fragen im Kopf:

1. **"Wo kann ich mit diesem Kandidaten Geld verdienen?"** -- Welche offenen Positionen passen, wo steht er im Prozess, wann kommt die Provision?
2. **"Was muss ich JETZT tun?"** -- Aufgaben, anstehende Interviews, Deadlines
3. **"Ist das Profil vollstaendig genug zum Einreichen?"** -- Readiness-Gate

Die aktuelle Seite beantwortet diese Fragen nicht auf einen Blick. Man muss durch Tabs klicken um Submissions, Interviews und Matching zu finden.

---

## Neues Hero-Layout (Prioritaetsreihenfolge)

```text
+------------------------------------------------------------------+
| [<-] Zurueck                                                      |
+------------------------------------------------------------------+
| ZEILE 1: Identitaet + Quick Actions                               |
| Avatar | Name, Rolle, Ort, Erfahrung        | Tel Mail LI [...]   |
|        | [Expose-Ready] oder [71% - fehlt: Gehalt, Verfuegb.]     |
+------------------------------------------------------------------+
| ZEILE 2: Pipeline (wie bisher)                                    |
| [Neu] [Kontakt] [>>Interview<<] [Angebot] [Platziert]            |
+------------------------------------------------------------------+
| ZEILE 3: AKTIVE PROZESSE (NEU - wichtigster Block)                |
| Kompakte Karten pro Submission mit Interview-Info:                |
|                                                                    |
| +------------------------------------------------------------+   |
| | AIS Management (oder [Branche] anonymisiert)                |   |
| | Data & Dashboard Engineer                                   |   |
| | Stage: Interview | Interview: 26. Feb 10:00 (in 4 Tagen)   |   |
| | [Teams beitreten] [Expose oeffnen] [Einreichen]             |   |
| +------------------------------------------------------------+   |
|                                                                    |
| (Weitere Submissions als kompakte Zeilen darunter)                |
+------------------------------------------------------------------+
| ZEILE 4: Key Facts (wie bisher, kompakt)                          |
| Seniority | Gehalt | Verfuegbar | Remote | Fuehrung              |
+------------------------------------------------------------------+
| ZEILE 5: Aufgaben (wie bisher, bereinigt)                         |
| 1 offene Aufgabe  [kritisch]                                     |
+------------------------------------------------------------------+
```

### Was ist neu?

**"Aktive Prozesse"** -- ein kompakter Block zwischen Pipeline und Key Facts, der ALLE laufenden Submissions des Kandidaten zeigt. Pro Submission:
- Firmenname (oder anonymisiert wenn `company_revealed = false`)
- Job-Titel
- Aktueller Stage (Badge)
- Naechstes Interview (Datum, Typ, Countdown "in X Tagen")
- Quick-Actions: Meeting beitreten (wenn Link vorhanden), Expose oeffnen, auf weitere Jobs einreichen

Der Recruiter sieht sofort: "Marko ist bei AIS Management im Interview-Prozess, naechstes Gespraech am 26. Feb um 10:00 via Teams."

---

## Technische Aenderungen

### 1. Neue Komponente: `CandidateActiveProcesses.tsx`
- Nimmt `candidateId` als Prop
- Laedt Submissions mit Jobs und Interviews via React Query:
  ```
  submissions -> jobs (title, company_name, industry)
  submissions -> interviews (scheduled_at, status, meeting_link, meeting_type)
  ```
- Filtert auf aktive Submissions (nicht `rejected`, `withdrawn`, `hired`)
- Zeigt pro Submission eine kompakte Karte mit:
  - Firmenname oder `formatSimpleAnonymousCompany(industry)` je nach `company_revealed`
  - Job-Titel
  - Stage als farbiger Badge
  - Naechstes anstehendes Interview (nur `scheduled`/`pending_response`, `scheduled_at` in der Zukunft)
  - Countdown: "in 4 Tagen", "Morgen", "Heute um 10:00"
  - Aktions-Buttons: Meeting-Link (wenn vorhanden), Link zum Job-Detail

### 2. CandidateHeroHeader.tsx erweitern
- Readiness-Badge: Tooltip hinzufuegen der fehlende Felder auflistet (nutzt `missingFields` aus `getExposeReadiness`)
- Neuen Block `CandidateActiveProcesses` zwischen Pipeline und Key Facts einbauen
- Reihenfolge wird: Avatar/Name -> Pipeline -> Aktive Prozesse -> Key Facts -> Aufgaben

### 3. Readiness-Badge mit Tooltip (CandidateHeroHeader.tsx)
Statt nur "71%" oder "Expose-Ready" wird ein Tooltip angezeigt:
- Ready: Gruenes Badge "Expose-Ready" (wie bisher)
- Nicht Ready: Amber Badge "71%" mit Tooltip: "Fehlend: Gehalt, Verfuegbarkeit"
- Das hilft dem Recruiter sofort zu verstehen was noch fehlt

---

## Dateien

| Datei | Aenderung |
|---|---|
| `src/components/candidates/CandidateActiveProcesses.tsx` | **Neue Datei**: Aktive Prozesse mit Interview-Infos |
| `src/components/candidates/CandidateHeroHeader.tsx` | Readiness-Tooltip, ActiveProcesses-Block einbauen, `getExposeReadiness` importieren |

Keine DB-Aenderungen. Keine neuen Abhaengigkeiten. Nutzt bestehende Supabase-Queries und UI-Komponenten.
