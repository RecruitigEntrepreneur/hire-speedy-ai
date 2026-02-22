

# Job-Import Workflow: Komplettes Redesign

## Die drei Ergaenzungen integriert

### 1. Duplikation eliminieren -- Ein Flow, eine Komponente

**Aktuell:** `QuickJobImport.tsx` (235 Zeilen) dupliziert die gesamte Import-Logik inkl. eigener Hooks, Modals und sessionStorage-Workaround. `CreateJob.tsx` hat dieselbe Logik nochmal (Zeilen 588-691).

**Neu:** `QuickJobImport` wird zu einem reinen CTA-Widget ohne eigene Import-Logik. Ein Klick navigiert direkt zu `/dashboard/jobs/new?mode=pdf|text|url`. CreateJob erkennt den `mode`-Parameter und oeffnet sofort die richtige Aktion (File-Picker, Text-Modal, URL-Modal).

- `QuickJobImport.tsx` schrumpft von 235 auf ~60 Zeilen
- Beide Hooks (`useJobPdfParsing`, `useJobParsing`) werden nur noch in `CreateJob` verwendet
- sessionStorage-Prefill-Workaround entfaellt komplett
- Keine doppelten Modals, keine doppelten Toasts

### 2. Fehlerfaelle und Partial Success

Drei Error-States werden explizit behandelt:

**a) PDF nicht parsebar (Bild-PDF, verschluesselt, korrupt)**
- Die `parse-job-pdf` Edge Function gibt bereits einen Fehler zurueck
- `CreateJob` zeigt einen Error-State mit konkreter Meldung: "PDF konnte nicht gelesen werden -- ist sie moeglicherweise ein Scan oder passwortgeschuetzt?"
- CTA: "Stattdessen als Text einfuegen" (oeffnet Text-Modal)

**b) URL nicht erreichbar oder kein Job-Posting**
- Die `parse-job-url` Edge Function gibt bereits Fallback-Text zurueck bei Fetch-Fehler
- Neuer Check: Wenn die KI nur `title` und `company_name` zurueckgibt aber alles andere leer ist, wird das als "Partial" erkannt
- Error-State: "Die Seite konnte nicht vollstaendig gelesen werden -- moeglicherweise blockiert die Website automatisches Auslesen"
- CTA: "Text manuell einfuegen"

**c) Partial Success (KI hat nur 30% gefuellt)**
- `countFilledFields()` existiert bereits (Zeile 169-199, zaehlt 27 Felder)
- Neuer Schwellenwert: Unter 5 gefuellte Felder = "Partial Success"
- Statt gruener Erfolgsmeldung eine gelbe Warnung: "KI konnte nur 4 von 27 Feldern erkennen. Bitte pruefe die Daten und ergaenze fehlende Informationen."
- Fehlende Pflichtfelder (Titel, Firma, Gehalt) werden visuell rot markiert

### 3. Mobile First

**Drag-Drop:**
- Drag-Drop-Zone wird auf Desktop beibehalten
- Auf Mobile (`useIsMobile()` Hook existiert bereits): Nur ein grosser "PDF hochladen" Button mit nativer File-Input-Oeffnung
- Kein `onDragEnter/onDragOver/onDragLeave` auf Mobile

**Sticky Footer:**
- Desktop: `sticky bottom-0` mit Backdrop-Blur
- Mobile: `fixed bottom-0` mit `pb-safe` (Safe Area Inset) und genuegend Abstand fuer Mobile-Keyboard
- Beim Fokussieren eines Input-Felds wird der Footer ausgeblendet (via `focus-within` Detection)

**Visual Summary Card:**
- Desktop: Key Facts als horizontale Pill-Row
- Mobile: Key Facts als vertikales 2-Spalten-Grid
- Skills-Tags wrappen automatisch (bereits `flex-wrap` vorhanden)

---

## Technische Umsetzung

### Datei 1: `src/components/dashboard/QuickJobImport.tsx` -- Reiner CTA

Kompletter Rewrite auf ~60 Zeilen. Keine Hooks, keine Modals, keine Import-Logik.

```text
Aufbau:
- Gradient-Card mit Headline "Neue Stelle in 60 Sekunden"
- 3 Buttons nebeneinander: PDF | Text | URL
- Jeder Button navigiert zu /dashboard/jobs/new?mode=pdf|text|url
- Mobile: Buttons stacken vertikal
```

Entfernt werden:
- `useJobPdfParsing`, `useJobParsing` Hooks
- `useState` fuer Modals, jobText, jobUrl, isDragging
- Beide Dialog-Komponenten (Text-Modal, URL-Modal)
- sessionStorage-Logik
- fileInputRef und Drag-Drop-Handler

### Datei 2: `src/pages/dashboard/CreateJob.tsx` -- Zentraler Flow

**A) Mode-Parameter auswerten (ersetzt Prefill-Logik)**

Der bestehende `useEffect` (Zeilen 285-299) wird ersetzt:
- Liest `?mode=pdf|text|url` aus `searchParams`
- `mode=pdf`: Oeffnet sofort den nativen File-Picker (`fileInputRef.current?.click()`)
- `mode=text`: Oeffnet sofort das Text-Modal (`setShowTextModal(true)`)
- `mode=url`: Oeffnet sofort das URL-Modal (`setShowUrlModal(true)`)
- Kein `mode`: Zeigt den normalen Import-Selection-Screen

**B) Error-States im Import-Screen (Zeilen 654-666)**

Der bestehende "KI analysiert..." Block wird erweitert um drei Zustaende:
- `importing`: Mehrstufige Fortschrittsanzeige (bestehend)
- `import-error`: Rote Fehlerkarte mit spezifischer Meldung und Fallback-CTA
- `import-partial`: Gelbe Warnkarte mit Feldanzahl und Hinweis auf fehlende Daten

Neue State-Variable: `importError: { type: 'pdf_unreadable' | 'url_unreachable' | 'partial_success', message: string } | null`

**C) Parsing-Animation (inline, keine neue Datei)**

Der Spinner (Zeile 658) wird ersetzt durch eine Step-Liste:
- 4 Steps als vertikale Liste mit Checkmarks/Spinner/Grau
- Steps werden per `useState` durchgeschaltet basierend auf Hook-States (`pdfParsing`, `parsing`, `enriching`)
- Kein Lottie, keine externe Dependency -- nur Lucide Icons + Tailwind Animationen

**D) Visual Summary vor Formular (Zeilen 694-866)**

Nach dem Success-Banner (Zeile 697-733) wird ein neuer Block eingefuegt:

```text
Job-Preview-Card:
- Grosser Titel + Firmenname
- Key Facts Row: Gehalt | Standort | Remote | Level | Dringlichkeit
  (Desktop: horizontal, Mobile: 2-Spalten Grid)
- Skills als loeschbare Tags (Klick auf X entfernt Skill)
- KI-Confidence Badge: "X von 27 Feldern erkannt"
- CTA: "Direkt einreichen" (wenn alle Pflichtfelder da)
  + "Details bearbeiten" (scrollt zum Formular)
```

Das bestehende Formular (Zeilen 753-1146) bleibt erhalten, wird aber in ein `Collapsible` gewrappt das standardmaessig geschlossen ist wenn >10 Felder gefuellt wurden.

**E) Sticky Action Footer (Zeilen 1148-1167)**

Die bestehenden Action-Buttons werden in einen Sticky Footer verschoben:
- `sticky bottom-0 bg-background/95 backdrop-blur border-t p-4`
- Mobile: `pb-[env(safe-area-inset-bottom)]`
- Validation-Dots: Rote Punkte neben dem Submit-Button zeigen Anzahl fehlender Pflichtfelder

**F) Error-Handling in Import-Funktionen**

`handleImportFromUrl` (Zeile 301-317), `handleImportFromText` (Zeile 319-335), `handleFileUpload` (Zeile 337-346):
- Statt nur `setFlowState('import-selection')` bei Fehler wird jetzt `setImportError({ type, message })` gesetzt
- Bei Partial Success (unter 5 Felder): Warning-Toast + gelber Banner statt gruener Erfolg
- Spezifische Fehlermeldungen je nach Fehlertyp

### Datei 3: `src/hooks/useJobPdfParsing.ts` -- Toast-Fehler ergaenzen

- `toast.error()` bei Upload-Fehler und Parse-Fehler (fehlt aktuell komplett)
- Spezifische Meldungen: "PDF-Upload fehlgeschlagen", "PDF konnte nicht analysiert werden"

---

## Zusammenfassung

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `src/components/dashboard/QuickJobImport.tsx` | Rewrite: Reiner CTA ohne Logik (~60 Zeilen statt 235) | S |
| `src/pages/dashboard/CreateJob.tsx` | Mode-Parameter, Error-States, Parsing-Animation, Visual Summary, Sticky Footer, Mobile-Anpassungen | L |
| `src/hooks/useJobPdfParsing.ts` | Toast-Fehler ergaenzen | S |

Keine neuen Dateien. Keine neuen Dependencies. Keine Datenbank-Aenderungen.

**Ergebnis:**
- 1 Import-Flow statt 2 (Duplikation eliminiert)
- 3 Error-States explizit behandelt (PDF unlesbar, URL nicht erreichbar, Partial Success)
- Mobile-First: Kein Drag-Drop auf Mobile, vertikales Layout, Safe-Area Footer
- 3 Klicks statt 7: Dashboard CTA --> Import --> Einreichen

