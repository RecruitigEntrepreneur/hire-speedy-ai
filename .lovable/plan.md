
# KI-Matching V3.1 im Uebersicht-Tab

## Genaues Layout

So wird die linke Spalte im Uebersicht-Tab aussehen -- die neue Matching-Card erscheint **direkt ueber** der bestehenden Skills-Card:

```text
+---------------------------------------------------+
| KI-Matching V3.1                    [Alle zeigen >]|
|                                                     |
| 🔥 3 Hot   ✓ 2 Standard   ? 1 Maybe               |
|                                                     |
| Senior Developer        ████████░░  87%            |
| PM Lead                 ████████░░  82%            |
| Solution Architect      ███████░░░  79%            |
+---------------------------------------------------+
| Skills & Expertise                   [38 Skills]   |
| Kernkompetenzen                                     |
| [Corporate Strategy] [M&A] [Due Diligence] ...     |
| +32 weitere Skills                                  |
+---------------------------------------------------+
| CV AI Summary                                       |
| ...                                                 |
+---------------------------------------------------+
```

### Details der Matching-Card

- **Titel**: "KI-Matching V3.1" mit BarChart3-Icon, rechts ein "Alle anzeigen"-Link der zum Matching-Tab wechselt
- **Tier-Zeile**: Farbige Badges -- Gruen fuer Hot, Blau fuer Standard, Amber fuer Maybe -- jeweils mit Anzahl
- **Top-3 Liste**: Die 3 besten Matches mit Job-Titel (anonymisiert falls noetig), kleinem Fortschrittsbalken und Prozentzahl
- **Ladezustand**: Skeleton-Animation waehrend die Berechnung laeuft
- **Leerzustand**: "Keine offenen Jobs" Hinweis falls keine published Jobs existieren

### Stil
- Gleicher Card-Stil wie die Skills-Card darunter (gleiche Rundung, Border, Padding)
- Kompakt gehalten -- keine ueberfluessigen Abstande

## Technische Umsetzung

| Datei | Aenderung |
|---|---|
| `src/components/candidates/CandidateHeroMatching.tsx` | **Neue Datei** -- Card-Komponente mit `useMatchScoreV31()`, laedt Jobs, zeigt Tier-Counts + Top-3 |
| `src/components/candidates/CandidateMainContent.tsx` | Import + Einbau vor `CandidateSkillsCard` in Zeile 115 der linken Spalte |

Keine DB-Aenderungen, keine neuen Dependencies.
