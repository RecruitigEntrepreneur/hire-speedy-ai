

# Tabs entfernen, Uebersicht-Layout beibehalten + Aktivitaets-Log hinzufuegen

## Was sich aendert

Die Tab-Leiste (Uebersicht, Prozess, Matching, Historie) wird entfernt. Der bisherige Inhalt des "Uebersicht"-Tabs bleibt exakt so wie er ist. Einzige Ergaenzung: der Aktivitaets-Log wird unten in der rechten Spalte hinzugefuegt.

## Beibehaltenes Layout (identisch mit aktuellem Uebersicht-Tab)

```text
Linke Spalte                    Rechte Spalte
+----------------------------+  +----------------------------+
| KI-Matching Vorschau       |  | Interview-Erkenntnisse     |
| Skills + Zertifikate       |  | Tags (wenn vorhanden)      |
| CV AI Summary              |  | Karriere-Timeline          |
+----------------------------+  | Dokumente                  |
                                | Aktivitaets-Log (NEU)      |
                                +----------------------------+
```

## Technische Umsetzung

### Datei: `src/components/candidates/CandidateMainContent.tsx`

- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` Wrapper entfernen
- Keyboard-Shortcut `useEffect` entfernen
- Props `activeTab`, `onTabChange`, `activeTaskId` aus Interface entfernen
- Nur den bisherigen Uebersicht-Inhalt (2-Spalten-Grid) direkt rendern
- Aktivitaets-Log (`CandidateActivityTimeline`) + "Aktivitaet hinzufuegen"-Button in die rechte Spalte unten einfuegen
- Imports fuer entfernte Sektionen aufraemen: `CandidateJobMatchingV3`, `ClientCandidateSummaryCard`, `CandidateJobsOverview`, `CandidateInterviewsCard`, `CandidateTasksSection`, `SimilarCandidates`
- Tab-Icons (`Briefcase`, `BarChart3`, `History`, `LayoutGrid`) entfernen

### Datei: `src/pages/recruiter/RecruiterCandidateDetail.tsx`

- `activeTab`, `handleTabChange` Logik entfernen
- `tab` URL-Parameter nicht mehr lesen/setzen
- `handleSubmitToJob` entfernen
- `activeTaskId` nicht mehr an `CandidateMainContent` uebergeben
- `onTabChange` nicht mehr an `CandidateMainContent` uebergeben
- `CandidateActionBar` `onSubmitToJob` anpassen

### Nicht angefasst:
- `CandidateHeroHeader` -- bleibt komplett unveraendert
- `CandidatePlaybookPanel` -- bleibt
- `CandidateActionBar` -- bleibt (nur `onSubmitToJob` ggf. entfernen)
- Daten-Logik, Props-Typen der Eltern

