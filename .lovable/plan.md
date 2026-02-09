
# Fix: Dashboard-Import leitet korrekt zum ausgefuellten Formular weiter

## Das Problem

Der `QuickJobImport` auf dem Dashboard parst die Stellenanzeige erfolgreich, speichert die Daten in `sessionStorage.setItem('prefillJobData', ...)` und navigiert zu `/dashboard/jobs/new?prefill=true`. Aber `CreateJob.tsx` liest diese Daten **nie aus** -- es gibt keinen einzigen Verweis auf `sessionStorage`, `prefill` oder `searchParams` in der Datei.

Der Kunde sieht deshalb nach dem Import wieder den leeren Import-Bildschirm.

---

## Loesung: 2 kleine Aenderungen

### Aenderung 1: CreateJob.tsx -- Prefill-Daten beim Laden konsumieren

**Was sich aendert:**
- `useSearchParams` aus `react-router-dom` importieren
- Ein `useEffect` wird ergaenzt, der beim Mount:
  1. Prueft ob `?prefill=true` in der URL steht
  2. `sessionStorage.getItem('prefillJobData')` ausliest und parst
  3. Die Daten durch die bereits existierende `applyParsedData()` Funktion (Zeile 201) schickt
  4. `sessionStorage.removeItem('prefillJobData')` aufrauemt
  5. Falls SessionStorage leer ist (z.B. Seite neu geladen), bleibt der normale Import-Bildschirm sichtbar

**Ergebnis:** Der Kunde landet direkt im ausgefuellten Formular mit KI-Enrichment im Hintergrund.

### Aenderung 2: QuickJobImport.tsx -- Doppelten Toast entfernen

**Was sich aendert:**
- Der Toast `toast.success('Stellenausschreibung erfolgreich importiert')` in `QuickJobImport` wird entfernt (Zeilen 54, 82, 96)
- Der Toast kommt stattdessen erst auf der `CreateJob`-Seite nach erfolgreichem Prefill
- Dadurch sieht der Kunde nur eine einzige Erfolgsmeldung, nicht zwei

---

## Ergebnis

```text
Vorher:
Dashboard [URL eingeben] --> Toast 1 "Analysiert" --> Toast 2 "Importiert"
  --> CreateJob: Leerer Import-Screen (Daten ignoriert)

Nachher:
Dashboard [URL eingeben] --> Toast "Analysiert"
  --> CreateJob: Formular mit allen Feldern ausgefuellt
                 + Toast "Job erfolgreich importiert"
                 + KI-Enrichment laeuft automatisch
```

## Dateien

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `src/pages/dashboard/CreateJob.tsx` | `useEffect` mit `useSearchParams` fuer SessionStorage-Prefill | S |
| `src/components/dashboard/QuickJobImport.tsx` | Redundante Toasts entfernen | S |

Keine Datenbank-Aenderungen. Keine neuen Abhaengigkeiten.
