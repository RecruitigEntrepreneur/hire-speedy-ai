
# Kandidatenseite Redesign: Auto-Pipeline + CRM-Level UI/UX

## Analyse: Aktuelle Probleme

### 1. Pipeline ist manuell -- keine Automatik
Die Pipeline (Neu -> Kontaktiert -> Interview -> Angebot -> Platziert) wird **nur manuell** durch Klick geaendert. Es gibt keinerlei automatische Fortschritte basierend auf Aktionen:
- Submission eingereicht -> Pipeline bleibt auf "Neu"
- Interview angefragt -> Pipeline bleibt auf "Neu"  
- Interview durchgefuehrt -> Pipeline bleibt auf "Neu"
- Angebot erstellt -> Pipeline bleibt auf "Neu"

### 2. Hero-Sektion: Zu viel Platz, zu wenig Information
- Die Hero-Karte nimmt ~60% des sichtbaren Bildschirms ein
- Stats Bar (71%, 1, 0, 30) wiederholt teilweise Infos aus dem Meta-Bereich
- Die Submissions-Pills unten sind redundant mit dem "Alle Bewerbungen"-Bereich im Prozess-Tab
- Pipeline-Stages sind klickbar aber es ist unklar warum/wann man sie manuell aendern wuerde

### 3. Action Bar unten verdeckt Inhalte
- Der sticky Action Bar unten blockiert den letzten Inhalt auf der Seite (pb-24 als Workaround)
- 3 Buttons die nicht kontextabhaengig sind

### 4. Zwei-Tab-System hat Informations-Silos
- Interview-Erkenntnisse im Profil-Tab, Interviews im Prozess-Tab -> man springt staendig
- Die gleiche CandidateInterviewsCard erscheint in beiden Tabs (einmal kompakt, einmal voll)

---

## Loesung: 5 Massnahmen

### Massnahme 1: Auto-Pipeline (Backend-Logik)

Die `candidate_status` wird automatisch basierend auf Aktionen aktualisiert. Der Recruiter kann sie weiterhin manuell ueberschreiben, aber die Automatik deckt 90% ab.

**Trigger-Regeln:**

| Aktion | Neuer Status |
|--------|-------------|
| Submission wird erstellt (`submissions INSERT`) | `contacted` |
| Interview wird angefragt (`interviews INSERT`) | `interview` |
| Angebot wird erstellt (`offers INSERT`) | `offer` |
| Placement wird erstellt (`placements INSERT`) | `placed` |
| Submission wird abgelehnt | `rejected` (nur wenn keine anderen aktiven Submissions) |

**Implementierung:** 
- Erweitere die bestehende Edge Function `automation-hub` um die `candidate_status`-Logik
- Bei jedem Event pruefen: "Hat dieser Kandidat eine Submission in einem hoeheren Stage?" -> wenn ja, Status auf das Maximum setzen
- Die Stage-Hierarchie: `new (0) < contacted (1) < interview (2) < offer (3) < placed (4)`
- Kandidat bekommt immer den **hoechsten** Status seiner aktiven Submissions

**Aenderungen an `automation-hub/index.ts`:**
- Neue Hilfsfunktion `syncCandidateStatus(supabase, candidateId)` die alle Submissions prueft und den hoechsten Status setzt
- Wird aufgerufen am Ende von `handleSubmissionEvent`, `handlePlacementEvent`, `handleInterviewEvent`

### Massnahme 2: Kompaktere Hero-Sektion

Die Hero-Sektion wird von ~400px Hoehe auf ~180px reduziert. Neue Struktur:

```text
+------------------------------------------------------------------+
| <- Zurueck                                                        |
|                                                                  |
| [MB]  Marko Benko              [Anrufen] [E-Mail] [in] [...]    |
|       Geschaeftsfuehrer & CEO - Muenchen - 30J Erfahrung         |
|       [71% vollstaendig] [Sofort verfuegbar] [85k-95k EUR]      |
|                                                                  |
| [=Neu====|==Kontaktiert==|==Interview==|==Angebot==|==Platziert] |
+------------------------------------------------------------------+
```

**Was entfernt wird:**
- Stats Bar (71%, 1 Bewerbung, 0 Tage, 30 Jahre) -- diese Infos sind bereits in der Meta-Zeile oder im Profil-Tab
- Active Submissions Pills -- diese sind im Prozess-Tab besser aufgehoben
- Gradient-Overlay und dekorative Elemente

**Was kompakter wird:**
- Avatar kleiner (h-14 statt h-20)
- Actions in einer Zeile mit Overflow-Menu (`...`) fuer Bearbeiten, CV, Export
- Pipeline bleibt, aber ohne unnoetige Polsterung

### Massnahme 3: Kontextabhaengige Action Bar

Statt 3 statische Buttons zeigt die Action Bar kontextabhaengige Aktionen basierend auf dem aktuellen Status:

| Status | Primaere Aktion | Sekundaere Aktionen |
|--------|----------------|---------------------|
| `new` | "Auf Job einreichen" | Expose, Interview starten |
| `contacted` | "Interview planen" | Expose ansehen |
| `interview` | "Notizen eintragen" | Expose ansehen |
| `offer` | "Angebot verfolgen" | - |
| `placed` | "Abgeschlossen" (Badge, kein Button) | - |

**Aenderungen an `CandidateActionBar.tsx`:**
- Neue Prop `currentStatus: string`
- Konditionelle Button-Anzeige basierend auf Status
- Primaerer Button bekommt visuellen Fokus (filled), sekundaere bleiben outline

### Massnahme 4: "Alles auf einen Blick"-Sidebar statt Tabs

Statt des 2-Tab-Systems wechseln wir zu einem **CRM-artigen Layout** mit sticky Sidebar:

```text
+------------------+------------------------------------------+
| SIDEBAR (320px)  | MAIN CONTENT (scrollbar)                 |
|                  |                                          |
| [MB] Marko Benko | Key Facts Grid                           |
| CEO - Muenchen   |                                          |
|                  | Interview-Erkenntnisse                   |
| --- Quick Facts  |   [Notizen eintragen] [Interview starten]|
| Gehalt: Fehlt    |                                          |
| Verfuegbar: Fehlt| Interviews (alle)                        |
| Remote: Fehlt    |   [Teams] Data & Dashboard Engineer      |
| Seniority: Dir.  |   [+] Externes Interview eintragen       |
|                  |                                          |
| --- Skills       | Job Matching                             |
| 38 Skills        |                                          |
| Corp. Strategy   | AI-Einschaetzung                         |
| M&A, Due Dilig.  |                                          |
| +32 weitere      | Alle Bewerbungen                         |
|                  |                                          |
| --- Dokumente    | Karriere-Timeline                        |
| CV v1 (5.5KB)    |                                          |
|                  | Aktivitaeten                             |
| --- Tags         |                                          |
+------------------+------------------------------------------+
```

**Vorteile:**
- Keine Tab-Wechsel mehr -- alles auf einer Seite
- Sidebar zeigt das Wichtigste (Quick Facts, Skills, Dokumente) permanent
- Main Content scrollt durch den Workflow-Kontext (Interviews, Matching, Bewerbungen)
- Mobile: Sidebar wird zum Collapsible-Header

**Neue Dateien:**
- `CandidateSidebar.tsx` -- Sticky Sidebar mit Quick Facts, Skills, Dokumente, Tags
- `CandidateMainContent.tsx` -- Scrollbarer Hauptbereich

**Geloeschte Dateien:**
- `CandidateProfileTab.tsx` und `CandidateProcessTab.tsx` werden zusammengefuehrt

### Massnahme 5: Interview-Erkenntnisse prominent im Hauptbereich

Die "Interview-Erkenntnisse"-Karte wird die erste Karte im Main Content (nach Key Facts). So sieht der Recruiter sofort, was fuer das Expose fehlt -- der wichtigste Call-to-Action.

---

## Technische Umsetzung

### Dateien und Aenderungen

| Datei | Aktion | Beschreibung |
|-------|--------|-------------|
| `supabase/functions/automation-hub/index.ts` | AENDERN | `syncCandidateStatus()` Hilfsfunktion + Aufrufe in allen Event-Handlern |
| `src/components/candidates/CandidateHeroHeader.tsx` | AENDERN | Kompakteres Layout: Stats Bar entfernen, Submissions Pills entfernen, kleinerer Avatar |
| `src/components/candidates/CandidateActionBar.tsx` | AENDERN | Kontextabhaengige Buttons basierend auf `currentStatus` |
| `src/components/candidates/CandidateSidebar.tsx` | NEU | Sticky Sidebar mit Quick Facts, Skills, Dokumente |
| `src/components/candidates/CandidateMainContent.tsx` | NEU | Scrollbarer Hauptbereich: Interview-Erkenntnisse, Interviews, Matching, Bewerbungen, Timeline |
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | AENDERN | Tabs entfernen, neues Sidebar+Main Layout |
| `src/components/candidates/CandidateProfileTab.tsx` | LOESCHEN | Wird in Sidebar + MainContent aufgeteilt |
| `src/components/candidates/CandidateProcessTab.tsx` | LOESCHEN | Wird in MainContent integriert |

### Auto-Pipeline Detail

Neue Funktion in `automation-hub/index.ts`:

```text
syncCandidateStatus(supabase, candidateId):
  1. Lade alle Submissions fuer diesen Kandidaten
  2. Bestimme den hoechsten Stage:
     - submitted/accepted -> "contacted"
     - interview/interview_1/interview_2 -> "interview"  
     - offer -> "offer"
     - hired/placed -> "placed"
  3. Wenn neuer Status > aktueller candidate_status -> Update
  4. Wenn alle Submissions rejected -> candidate_status = "rejected"
```

Die Funktion wird aufgerufen bei:
- `handleSubmissionEvent` (INSERT + UPDATE)
- `handleInterviewEvent` (INSERT)
- `handlePlacementEvent` (INSERT)

### Sidebar Layout (responsive)

```text
Desktop (>= 1024px):
  flex flex-row
    Sidebar: w-80 sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto
    Main:    flex-1 overflow-y-auto

Mobile (< 1024px):
  flex flex-col
    Sidebar-Inhalt als Collapsible oben
    Main darunter
```

### Reihenfolge der Karten im Main Content

1. **Key Facts Grid** (8 Tiles, full width)
2. **Interview-Erkenntnisse** (mit "Notizen eintragen" + "Interview starten")
3. **Interviews** (alle, mit externem Eintrag-Formular)
4. **Offene Aufgaben** (CandidateTasksSection)
5. **Job Matching V3** 
6. **AI-Einschaetzung** (ClientCandidateSummaryCard)
7. **Alle Bewerbungen** (CandidateJobsOverview)
8. **Karriere-Timeline**
9. **Aehnliche Kandidaten**
10. **Aktivitaeten-Timeline**

### Sidebar-Inhalt

1. **Avatar + Name + Rolle** (kompakt)
2. **Quick Facts** (Gehalt, Verfuegbarkeit, Remote, Seniority -- nur die "fehlenden" hervorgehoben)
3. **Skills** (Top 6 + "+X weitere")
4. **AI-Zusammenfassung** (aus CV, 2 Zeilen + "Mehr")
5. **Dokumente** (CV Link, Upload-Button)

---

## Zusammenfassung der Verbesserungen

- **Auto-Pipeline**: Kandidat wandert automatisch durch die Stages basierend auf echten Aktionen
- **-60% Hero-Hoehe**: Mehr Platz fuer relevanten Inhalt
- **Keine Tabs mehr**: Alles auf einen Blick, CRM-Style
- **Kontextabhaengige Actions**: Der richtige naechste Schritt wird prominent angezeigt
- **Interview-Erkenntnisse vorne**: Das Wichtigste (Expose-Luecken) direkt sichtbar
