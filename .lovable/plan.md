

# Kandidatenseite: Tab-Navigation unter dem Hero

## Konzept

Die Sidebar wird entfernt. Stattdessen kommen **4 Tabs** direkt unter den Hero-Header. Jeder Tab gruppiert zusammengehoerenden Inhalt -- der Recruiter klickt sich sauber durch statt endlos zu scrollen.

```text
+------------------------------------------------------------------+
| HERO (Avatar, Name, Meta, Pipeline)                               |
+------------------------------------------------------------------+
| [Uebersicht] [Prozess] [Matching] [Historie]                     |
+------------------------------------------------------------------+
|                                                                    |
|  Tab-Inhalt (nur der aktive Tab wird angezeigt)                   |
|                                                                    |
+------------------------------------------------------------------+
| ACTION BAR (kontextabhaengig)                                     |
+------------------------------------------------------------------+
```

## Tab-Aufteilung

### Tab 1: Uebersicht (Default)
- Key Facts Grid (8 Tiles)
- Skills + Zertifikate (aus Sidebar)
- AI CV-Zusammenfassung (aus Sidebar)
- Dokumente (aus Sidebar)
- Tags (aus Sidebar)

### Tab 2: Prozess
- Interview-Erkenntnisse (mit "Notizen eintragen" + "Interview starten")
- Interviews (alle, mit externem Eintrag-Formular)
- Offene Aufgaben (CandidateTasksSection)

### Tab 3: Matching
- Job Matching V3.1
- KI-Einschaetzung (ClientCandidateSummaryCard)
- Alle Bewerbungen (CandidateJobsOverview)

### Tab 4: Historie
- Karriere-Timeline
- Aehnliche Kandidaten
- Letzte Aktivitaeten

## Tab-State

- Gespeichert in URL via `?tab=overview|process|matching|history`
- Default: `overview`
- Keyboard-Shortcuts: 1/2/3/4
- Wenn `?task=...` in URL -> automatisch Tab "Prozess" oeffnen

## Technische Aenderungen

### Datei 1: `CandidateMainContent.tsx` -- KOMPLETT NEU
- Importiert `Tabs, TabsList, TabsTrigger, TabsContent` von `@/components/ui/tabs`
- Nimmt neuen Prop `activeTab` und `onTabChange` entgegen
- Die Sidebar-Inhalte (Skills, AI-Summary, Dokumente, Tags) wandern in Tab "Uebersicht"
- Braucht zusaetzliche Props: `skills`, `certifications`, `cv_ai_summary`, `cv_ai_bullets`, `tags`

### Datei 2: `RecruiterCandidateDetail.tsx` -- AENDERN
- Sidebar-Komponente und `flex-row` Layout komplett entfernen
- Tab-State aus URL lesen: `searchParams.get('tab') || 'overview'`
- Wenn `activeTaskId` vorhanden -> `tab = 'process'`
- `CandidateMainContent` bekommt die Sidebar-Props (skills, tags, etc.)

### Datei 3: `CandidateSidebar.tsx` -- LOESCHEN
- Wird nicht mehr gebraucht, alle Inhalte wandern in Tab "Uebersicht"

### Zusammenfassung

| Datei | Aktion |
|---|---|
| `CandidateMainContent.tsx` | Komplett neu: 4 Tabs statt Sektionen |
| `RecruiterCandidateDetail.tsx` | Sidebar entfernen, Tab-State aus URL |
| `CandidateSidebar.tsx` | Loeschen |

Keine neuen Dateien, keine DB-Aenderungen.
