

# Dashboard Kandidaten-Sektion: Redesign zur "Bewerbungsmappe"

## Zusammenfassung

Die Kandidaten-Karten werden radikal vereinfacht zu einer **kompakten, klickbaren Bewerbungsmappe**. Keine CTAs, keine Scores, keine Wertungen, keine bunten Badges. Jede Karte ist ein Eintrag den der Kunde anklickt um die Detail-Seite zu oeffnen und dort seine Entscheidung trifft.

## Was sich aendert

### Entfernt (von jeder Karte)
- "Einstellen" + "Absage" Buttons
- Match-Score Zahl (36, 85, 79, 92, 63...)
- Policy-Badges ("Hot", "Standard", "Nicht geeignet")
- Score-Ring am Avatar
- "Feedback geben" Button
- Skill-Badges (React, Next.js, SAP, +38...)
- Gruene/Rote/Orange Farbakzente
- Vergleichen-Checkbox
- Vergleichen-Button im Header

### Beibehalten + Vereinfacht
- Avatar mit Initialen (neutral, ohne farbigen Ring)
- Anonyme ID (PR-EFDF50) -- kleiner, dezenter
- **Aktuelle Rolle** (prominent)
- **Pfeil + Ziel-Job** (wohin vorgeschlagen)
- Standort + Erfahrungsjahre (wenn vorhanden)
- Wartezeit ("etwa 1 Monat", "28 Tage")
- Klick navigiert zu `/dashboard/candidates/:submissionId`

### Neues Design pro Karte (~60px hoch)

```text
+------------------------------------------------------------------+
| [EF]  Senior Fullstack Developer / Tech Lead                 >  |
|       -> Senior Java & AWS Lead Developer  |  Muenchen  |  10J  |
|       etwa 1 Monat                                              |
+------------------------------------------------------------------+

| [15]  Scrum Master und Entwickler                             >  |
|       -> Senior Java & AWS Lead Developer  |  Valley  |  24J    |
|       etwa 1 Monat                                              |
+------------------------------------------------------------------+

| [E1]  Group-Director Finance and Accounting                   >  |
|       -> Buchhalter (m/w/d)  |  Weiden  |  25J                  |
|       28 Tage                                                   |
+------------------------------------------------------------------+

| [02]  Buchhalter                                              >  |
|       -> Buchhalter (m/w/d)  |  Muenchen  |  20J                |
|       26 Tage                                                   |
+------------------------------------------------------------------+
```

### Header vereinfacht

Aktuell:
```text
Kandidaten  13  [1 Hot]  [7 ueberfaellig]
Alle (13) | Neu (7) | Eingestellt (1)
[Suche...]  [Alle Jobs v]  [Wartezeit v]
```

Neu:
```text
Bewerbungen  13 eingegangen
[Suche...]  [Alle Jobs v]  [Sortieren v]
Alle (13) | Neu (7) | Im Prozess (5) | Eingestellt (1)
```

Entfernt aus Header:
- "Hot" Badge
- "ueberfaellig" Badge
- Vergleichen-Button

## Technische Details

### Datei: `src/components/dashboard/IntegratedTalentSection.tsx`

Aenderungen:
1. **CandidateActionCard** wird durch eine neue, minimale Inline-Komponente ersetzt (direkt in der Datei, ~30 Zeilen). Kein separates File noetig.
2. Jede Karte ist ein `Link` zu `/dashboard/candidates/${submissionId}` -- die gesamte Karte ist klickbar.
3. `quickStats` Section wird entfernt (Hot-Count, Overdue-Count, Interview-Today-Count).
4. `selectedIds`, `compareOpen`, `CandidateCompareView` -- alles entfernt.
5. Grid wechselt von `grid-cols-4` zu `grid-cols-1` (eine Karte pro Zeile, volle Breite).
6. Stage-Tabs bleiben, aber ohne farbige Punkte -- nur Text + Count.
7. Filter (Suche, Job-Filter, Sortierung) bleiben.
8. Alle Interview/Reject/Move Handler werden entfernt -- keine Aktionen auf Dashboard-Ebene.
9. `RejectionDialog`, `InterviewRequestWithOptInDialog` Importe werden entfernt.
10. `CandidateActionCard` Import wird entfernt.

### Neue Card-Komponente (inline)

Minimale Karte mit:
- `Link to={/dashboard/candidates/${submissionId}}`
- Avatar (neutral `bg-muted`, keine Farbringe)
- Rolle als Haupttext (`font-medium`)
- Ziel-Job mit Pfeil (`text-muted-foreground text-sm`)
- Ort + Jahre inline (`text-xs text-muted-foreground`)
- Wartezeit rechts unten (`text-xs text-muted-foreground`)
- Chevron-Right Icon rechts (dezent, `text-muted-foreground`)
- Hover: `hover:bg-muted/50` -- dezent, kein Shadow

### Farbschema

Nur monochrom: `foreground`, `muted-foreground`, `muted`, `border`. Keine gruenen, roten, orangen, blauen Akzente. Passt zum bestehenden Dark-Mode Design.

### Entfernte Importe

- `CandidateActionCard`, `CandidateActionCardProps`
- `CandidateCompareView`
- `RejectionDialog`
- `InterviewRequestWithOptInDialog`
- `Flame`, `AlertTriangle`, `Video`, `GitCompare`, `Star`, `Check`
- `isToday`, `isPast` (nicht mehr gebraucht)
- `ScrollArea` (nicht mehr noetig bei kompakten Zeilen)

### Beibehaltene Importe

- `supabase`, `useAuth`, `useNavigate`
- `Card`, `CardContent`, `Button`, `Badge`, `Input`, `Select`
- `Users`, `Search`, `Filter`, `ArrowUpDown`, `CheckCircle2`
- `PIPELINE_STAGES`
- `cn`, `formatDistanceToNow`, `de`

### Stage-Tabs Anpassung

Die Stage-Tabs bleiben funktional identisch, aber:
- Keine farbigen Punkte (`w-2 h-2 rounded-full`) mehr
- Nur Text: "Alle (13)", "Neu (7)", "Interview (5)", "Eingestellt (1)"
- Stages mit 0 Kandidaten werden weiterhin ausgeblendet

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/dashboard/IntegratedTalentSection.tsx` | Komplettes Redesign: CandidateActionCard durch minimale klickbare Zeilen ersetzen, alle CTAs/Scores/Badges/Farben entfernen, Compare-Feature entfernen, Header vereinfachen |

