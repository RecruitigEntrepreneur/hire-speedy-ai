

# CandidateTasksSection zuruecksetzen

Die Grid-Aenderung in `CandidateTasksSection.tsx` (Kandidaten-Detailseite) wird rueckgaengig gemacht. Das Ticket-Grid bleibt nur auf dem Dashboard (`CompactTaskList.tsx`).

## Aenderung

### Datei: `src/components/candidates/CandidateTasksSection.tsx`

Zurueck zum urspruenglichen vertikalen Listen-Layout:

- **Grid entfernen**: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2` zurueck zu `divide-y` Liste
- **Ticket-Kacheln** zurueck zu den urspruenglichen Zeilen mit voller Breite, Icon-Box links, Titel + Beschreibung + Text-Buttons ("Anrufen", "Email", "Opt-In bestaetigen", "Erledigt")
- **Expose-Tasks** ebenfalls zurueck zum alten Zeilen-Layout mit Icon-Box, Beschreibungstext und normalen Buttons
- Tooltip-Import kann entfernt werden (war vorher nicht noetig)

### Keine Aenderung an:
- `CompactTaskList.tsx` -- das Ticket-Grid auf dem Dashboard bleibt bestehen
- Logik, Props, Datenfluss -- alles bleibt gleich, nur das Layout wird zurueckgesetzt

