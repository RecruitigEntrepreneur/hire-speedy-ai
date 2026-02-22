
# Fix: Abbruch des File-Pickers zeigt falschen Screen

## Problem

Wenn der Nutzer den File-Picker abbricht, wird `awaitingFileSelection = false` gesetzt, aber `modeHandled` bleibt `false`. Dadurch greift die Bedingung fuer den Import-Selection-Block (`!modeHandled && !awaitingFileSelection`) und die alte 3-Optionen-Auswahl erscheint -- statt des Fallback-Blocks mit "Andere Methode waehlen".

## Loesung

Im Cancel-Handler (Zeile 341-344) muss zusaetzlich `setModeHandled(true)` gesetzt werden. Dann zeigt sich der Fallback-Block ("Import abgebrochen") mit den Optionen "Andere Methode waehlen" und "Manuell erstellen".

### Aenderung in `src/pages/dashboard/CreateJob.tsx`

**Eine Zeile hinzufuegen** im `setTimeout`-Callback des Focus-Handlers (Zeile 343):

Aktuell:
```
if (prev) {
  // User cancelled the file picker
  return false;
}
```

Neu:
```
if (prev) {
  // User cancelled the file picker
  setModeHandled(true);
  return false;
}
```

Das ist alles. Eine Zeile. Damit landet der Nutzer nach Abbruch auf dem Fallback-Block, der bereits "Andere Methode waehlen" und "Manuell erstellen" anbietet.
