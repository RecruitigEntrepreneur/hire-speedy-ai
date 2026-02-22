

# Bewerbungsmappe: Vollstaendiger Plan mit Kandidaten-Seite

## Problem entdeckt

`/dashboard/candidates` leitet aktuell per Redirect zurueck auf `/dashboard` (App.tsx Zeile 175). Es gibt keine eigene Kandidaten-Uebersichtsseite. Der "Alle anzeigen"-Button wuerde in eine Endlosschleife fuehren.

## Loesung: 2 Teile

### Teil 1: Dashboard-Sektion (kompakt, max 6 Karten)

Wie bereits geplant:
- 3-Spalten-Grid, max 6 Karten
- Kompakte klickbare Karten ohne CTAs
- Stage-Tabs bleiben
- Suche/Filter entfernt
- "Alle Bewerbungen anzeigen" Button

### Teil 2: Eigene Kandidaten-Seite `/dashboard/candidates`

Eine neue, vollstaendige Kandidaten-Uebersichtsseite die alle Features enthaelt:

```text
+------------------------------------------------------------------+
| Bewerbungen                                    13 eingegangen    |
+------------------------------------------------------------------+
| [Suche...]        [Alle Jobs v]        [Sortieren: Wartezeit v]  |
| Alle (13) | Neu (7) | Interview (5) | Eingestellt (1)           |
+------------------------------------------------------------------+
|                                                                  |
| +-------------------+ +-------------------+ +-------------------+|
| | [EF] Sr. Fullst.  | | [15] Scrum Master | | [E1] Group-Dir.  ||
| | -> Sr. Java & AWS | | -> Sr. Java & AWS | | -> Buchhalter    ||
| | Muenchen | 10J    | | Valley | 24J      | | Weiden | 25J     ||
| | vor 1 Monat       | | vor 1 Monat       | | vor 28 Tagen     ||
| +-------------------+ +-------------------+ +-------------------+|
|                                                                  |
| +-------------------+ +-------------------+ +-------------------+|
| | [63] Controllerin | | [02] Buchhalter   | | [E5] Mitarbeiter ||
| | -> Buchhalter     | | -> Buchhalter     | | -> Buchhalter    ||
| | Kirchdorf | 15J   | | Muenchen | 20J    | | Muenchen | 25J   ||
| | vor 28 Tagen      | | vor 26 Tagen      | | vor 26 Tagen     ||
| +-------------------+ +-------------------+ +-------------------+|
|                                                                  |
| +-------------------+ +-------------------+ +-------------------+|
| | ... weitere ...   | | ... weitere ...   | | ... weitere ...  ||
| +-------------------+ +-------------------+ +-------------------+|
+------------------------------------------------------------------+
```

## Technische Umsetzung

### Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/dashboard/IntegratedTalentSection.tsx` | Grid-Layout, max 6 Karten, Suche/Filter entfernen, "Alle anzeigen" Link hinzufuegen |
| `src/pages/dashboard/ClientCandidatesOverview.tsx` | **Neue Datei**: Vollstaendige Kandidaten-Seite mit Suche, Filter, Sortierung, alle Karten |
| `src/App.tsx` | Redirect auf Zeile 175 ersetzen durch Route zu `ClientCandidatesOverview` |

### Datei 1: `src/components/dashboard/IntegratedTalentSection.tsx`

Aenderungen gegenueber aktuellem Stand:
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2`
- Anzeige limitiert auf `filteredCandidates.slice(0, 6)`
- Such-Input, Job-Filter-Dropdown, Sortierungs-Dropdown entfernen
- Header: "Bewerbungen" + Count links, "Alle anzeigen" als Link-Button rechts zu `/dashboard/candidates`
- Stage-Tabs bleiben als Schnellfilter
- Karten bleiben wie aktuell implementiert (kompakt, klickbar, keine CTAs)
- Wenn mehr als 6 vorhanden: Footer mit "+X weitere Bewerbungen anzeigen"

### Datei 2: `src/pages/dashboard/ClientCandidatesOverview.tsx` (Neu)

Vollstaendige Uebersichtsseite:
- `DashboardLayout` als Wrapper
- Gleiche Karten-Komponente wie im Dashboard (wiederverwendbar)
- Suche, Job-Filter, Sortierung (aus IntegratedTalentSection uebernommen)
- Stage-Tabs
- Alle Kandidaten angezeigt (kein Limit)
- Gleiche Daten-Logik (Supabase-Abfragen)
- Gleiche kompakte Karten, klickbar zu `/dashboard/candidates/:id`

### Datei 3: `src/App.tsx`

Zeile 175 aendern von:
```
<Route path="/dashboard/candidates" element={<Navigate to="/dashboard" replace />} />
```
zu:
```
<Route path="/dashboard/candidates" element={
  <ProtectedRoute allowedRoles={['client']}>
    <ClientCandidatesOverview />
  </ProtectedRoute>
} />
```

### Code-Wiederverwendung

Die kompakte Karten-Darstellung wird als eigene Komponente extrahiert (`CandidateInboxCard`), damit sie sowohl im Dashboard (max 6) als auch auf der Uebersichtsseite (alle) verwendet werden kann:

```text
src/components/dashboard/CandidateInboxCard.tsx  (Neue Datei)
  - Avatar + Initialen
  - Aktuelle Rolle (truncated)
  - Pfeil + Ziel-Job
  - Standort + Jahre
  - Wartezeit
  - Link zu Detail-Seite
```

### Navigation

Die Sidebar hat aktuell keinen separaten "Bewerbungen"-Link. Die Seite ist erreichbar ueber:
1. Dashboard -> "Alle Bewerbungen anzeigen" Button
2. Direkter Link `/dashboard/candidates`

Optional koennte ein Sidebar-Eintrag hinzugefuegt werden, aber das ist nicht zwingend noetig da der Hauptzugang ueber das Dashboard laeuft.

### Zusammenfassung der neuen Dateien

| Datei | Typ | Zweck |
|---|---|---|
| `src/components/dashboard/CandidateInboxCard.tsx` | Neu | Wiederverwendbare kompakte Kandidaten-Karte |
| `src/pages/dashboard/ClientCandidatesOverview.tsx` | Neu | Vollstaendige Kandidaten-Uebersichtsseite |
| `src/components/dashboard/IntegratedTalentSection.tsx` | Bearbeitet | Kompaktes Grid, max 6, "Alle anzeigen" CTA |
| `src/App.tsx` | Bearbeitet | Route fuer `/dashboard/candidates` |

