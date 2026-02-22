
# Echtes MH-Monogramm SVG einbauen

## Problem
Das aktuelle Logo in `MatchuntLogo.tsx` ist eine falsche Naeherung. Du hast jetzt die echte SVG-Datei hochgeladen.

## Analyse der SVG-Datei

Die hochgeladene SVG nutzt ein altes Format (Koordinatensystem gespiegelt, `pt`-Einheiten) mit einem einzelnen Pfad, der:
1. Ein schwarzes Hintergrund-Rechteck zeichnet
2. Das MH-Monogramm als **negative Raeume** (Ausschnitte) darin definiert

Fuer die React-Komponente brauchen wir das Logo **ohne** Hintergrund-Rechteck, damit `currentColor` nur das Monogramm selbst faerbt.

## Loesung

### 1. SVG als Bilddatei kopieren
- Die Original-SVG nach `src/assets/matchunt-monogram.svg` kopieren (fuer Referenz/Favicon)
- Nach `public/favicon.svg` kopieren und in `index.html` als Favicon referenzieren

### 2. `MatchuntLogo.tsx` umbauen
Da die SVG-Pfade im Originalformat schwer zu invertieren sind (das Monogramm ist als Negativ-Raum definiert), nutze ich folgenden Ansatz:
- Die SVG als `<img>`-Tag einbinden statt inline SVG
- Importiere die Datei aus `src/assets/`
- Fuer **Dark Mode** (weisses Logo noetig): CSS `filter: invert(1)` anwenden
- Fuer **Light Mode** (schwarzes Logo noetig): Keine Transformation noetig (SVG ist schwarz auf transparent nach Verarbeitung)

**Alternativ** (sauberer): Die SVG-Datei aufbereiten -- den aeusseren Rechteck-Subpath entfernen und nur die inneren Monogramm-Pfade behalten, absolute Koordinaten berechnen. Das ergibt ein sauberes inline-SVG mit `fill="currentColor"`.

Ich werde den **saubereren Ansatz** waehlen: Die relativen Pfaddaten aus der SVG in absolute Koordinaten umrechnen, den Hintergrund-Rechteck-Pfad entfernen und die Monogramm-Subpaths extrahieren. Das Ergebnis ist ein kompaktes inline-SVG das mit `currentColor` in beiden Themes funktioniert.

### 3. Favicon aktualisieren
- `public/favicon.svg` mit der Original-SVG befuellen
- `index.html` auf `favicon.svg` umstellen (statt favicon.png)

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/assets/matchunt-monogram.svg` | Original-SVG kopiert (Referenz) |
| `src/components/ui/MatchuntLogo.tsx` | SVG-Pfade durch extrahierte Monogramm-Pfade ersetzen |
| `public/favicon.svg` | Original-SVG als Favicon |
| `index.html` | Favicon-Link auf `.svg` umstellen |

`MatchuntWordmark.tsx` und alle anderen Stellen die `MatchuntLogo` nutzen bleiben unveraendert -- sie zeigen automatisch das korrekte Logo.
