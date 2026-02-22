

# Fix: PDF File-Picker oeffnet sich nicht

## Ursache

Der `<input type="file" ref={fileInputRef}>` existiert nur innerhalb des Import-Selection-Blocks. Wenn `modeHandled = true` gesetzt wird, wird dieser Block ausgeblendet -- und damit auch das Input-Element. Der `setTimeout(() => fileInputRef.current?.click(), 100)` findet kein Element mehr und tut nichts.

## Loesung

Das hidden File-Input-Element wird aus dem Import-Selection-Block herausgezogen und auf Top-Level innerhalb der Komponente platziert. So ist es IMMER im DOM, unabhaengig davon welcher Block gerade sichtbar ist.

### Aenderung in `src/pages/dashboard/CreateJob.tsx`

**1. Input-Element verschieben**

Das `<input ref={fileInputRef} type="file" ...>` (aktuell Zeile 741-751, innerhalb der PDF-Card) wird an eine Stelle direkt nach dem aeusseren Container-`div` verschoben -- ausserhalb aller bedingten Bloecke. Es bleibt `className="hidden"`, ist also unsichtbar.

**2. `modeHandled` erst NACH Dateiauswahl setzen**

Im `useEffect` fuer `mode=pdf` wird `setModeHandled(true)` entfernt. Stattdessen:
- `awaitingFileSelection = true` setzen (neuer State)
- File-Picker oeffnen via `setTimeout`
- Im `onChange`-Handler des Inputs: `setModeHandled(true)` + `setAwaitingFileSelection(false)` + Datei verarbeiten
- Falls der Nutzer den Picker abbricht: ein `focus`-Event-Listener auf `window` erkennt das und setzt `awaitingFileSelection = false` zurueck, sodass die normale Import-Auswahl erscheint

**3. Neuer State `awaitingFileSelection`**

```
const [awaitingFileSelection, setAwaitingFileSelection] = useState(false);
```

Waehrend `awaitingFileSelection === true` wird ein dezenter Hinweis angezeigt ("Bitte waehle eine PDF-Datei...") statt des Fehler-Blocks.

**4. Fallback-Block Bedingung anpassen**

Der "Import abgebrochen" Block (aktuell Zeile 930) zeigt sich nur wenn:
`modeHandled && !awaitingFileSelection && !isImporting && flowState === 'import-selection'`

### Zusammenfassung

| Stelle | Aenderung |
|--------|-----------|
| Top-Level JSX | Hidden `<input type="file">` immer gerendert |
| `useEffect` (mode=pdf) | `awaitingFileSelection` statt sofort `modeHandled` |
| onChange-Handler | Setzt `modeHandled` erst bei Dateiauswahl |
| Window focus listener | Erkennt "Cancel" im File-Picker |
| Fallback-Block | Prueft zusaetzlich `!awaitingFileSelection` |

