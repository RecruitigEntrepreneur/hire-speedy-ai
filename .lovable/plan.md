

# Duplikate bereinigen und Farben anpassen

## Ursache der Dopplungen

In der Datenbank existieren **9 identische Alerts** fuer dieselbe Submission (876e791f). Das passiert, weil der `InterviewRequestWithOptInDialog` bei jedem Klick einen neuen Alert einfuegt -- ohne zu pruefen, ob bereits einer existiert. Es gibt keine Deduplizierung.

## Aenderungen

### 1. Datenbank bereinigen
Alle doppelten Alerts loeschen, nur den neuesten behalten. Von 9 Eintraegen bleiben 1 uebrig.

### 2. Deduplizierung im Code (InterviewRequestWithOptInDialog.tsx)
Vor dem Insert pruefen: Gibt es bereits einen offenen `opt_in_pending`-Alert fuer diese Submission? Wenn ja, keinen neuen anlegen.

### 3. Tasks-Dopplung im Prozess-Tab entfernen (CandidateMainContent.tsx)
`CandidateTasksSection` wird aus dem Prozess-Tab (Zeile 164) entfernt -- sie lebt jetzt nur noch in der Hero-Sektion.

### 4. Farben an Dark-Theme anpassen (CandidateTasksSection.tsx)
- Header-Hintergrund: `bg-amber-50 dark:bg-amber-950/20` wird zu `bg-amber-500/10` (funktioniert in beiden Themes)
- "Erledigt"-Button: `hover:bg-emerald-50` wird zu `hover:bg-emerald-500/10`
- Container-Border bleibt `border` (passt sich automatisch an)

## Technische Details

| Datei | Aenderung |
|---|---|
| DB-Cleanup | 8 von 9 doppelten Alerts loeschen |
| `InterviewRequestWithOptInDialog.tsx` | Dedup-Check vor Insert |
| `CandidateMainContent.tsx` | `CandidateTasksSection` aus Prozess-Tab entfernen |
| `CandidateTasksSection.tsx` | Farben Dark-Mode-kompatibel |

