

# Haende mit Dot-Grid Textur (inspiriert von IMG_1469 + IMG_1468)

## Problem

Die Haende sind im aktuellen Zustand kaum sichtbar. Die Code-Rain-Spalten mit 80 Columns und 0.20 Opacity erzeugen zu wenig Dichte und wirken duenn/lueckenhaft auf dem dunklen Hintergrund.

## Loesung: CSS Dot-Grid statt Code-Rain

Statt animierter Code-Rain-Spalten mit DOM-Elementen wird ein **CSS-basiertes Dot-Grid Pattern** verwendet (inspiriert von IMG_1469). Das ist:
- Viel dichter (lueckenloses Raster)
- Performanter (ein einziges CSS Background statt 80x75 = 6000 DOM-Elemente pro Hand)
- Eleganter und moderner

## Was sich aendert

### 1. Dot-Grid als CSS Background Pattern

Statt der `CodeRainColumns` Komponente mit tausenden `<span>` Elementen wird ein reines CSS `radial-gradient` Pattern verwendet:

```text
background-image: radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px);
background-size: 8px 8px;
```

Das erzeugt ein gleichmaessiges Punkt-Raster wie in IMG_1469 -- dicht, sauber, monochrom.

### 2. Subtile Animation beibehalten

Statt Code-Rain wird eine langsame **Drift-Animation** auf dem Dot-Grid angewendet:

```text
@keyframes dot-drift {
  0% { background-position: 0 0; }
  100% { background-position: 8px 16px; }
}
```

Die Punkte "wandern" unmerklich -- gibt dem Effekt Leben ohne abzulenken.

### 3. Radiale Opacity-Variation (inspiriert von IMG_1468)

Ein zusaetzlicher `radial-gradient` als Overlay erzeugt variierende Dichte:
- Mitte der Handflaeche: volle Opacity (0.35)
- Raender/Finger: geringere Opacity (0.15)
- Erzeugt natuerlichen Volumen-Effekt wie in IMG_1468

### 4. Zweite Schicht: Vereinzelte groessere Dots

Ueber dem feinen Dot-Grid eine zweite CSS-Pattern-Schicht mit groesseren, selteneren Punkten:

```text
background-image: radial-gradient(circle, rgba(255,255,255,0.12) 2px, transparent 2px);
background-size: 24px 24px;
```

Erzeugt Tiefe durch zwei verschiedene "Frequenzen" -- wie die Dichte-Variation in IMG_1468.

### 5. Erhoehte Gesamt-Sichtbarkeit

- Basis-Hintergrund der Haende: `bg-foreground/[0.06]` (sichtbare Grundflaeche)
- Dot-Grid Opacity: 0.35 (deutlich sichtbar)
- Staerkerer unterer Fade: `h-48` statt `h-32`

### 6. Code-Rain-Animation entfernt

- Die gesamte `generateCodeColumns` Funktion, `CODE_CHARS` Array und `CodeRainColumns` Komponente werden entfernt
- Keine `useMemo` fuer Spalten-Generierung mehr noetig
- Ergebnis: ~6000 weniger DOM-Elemente pro Hand = massive Performance-Verbesserung

## Technische Details

### Datei: `src/components/landing/AsciiHandsArt.tsx`

Folgende Teile werden **entfernt**:
- `CODE_CHARS` Array
- `generateCodeColumns` Funktion
- `CodeRainColumns` Komponente
- `leftColumns` / `rightColumns` useMemo Aufrufe
- `@keyframes code-rain` CSS

Folgende Teile werden **hinzugefuegt**:
- `DotGridFill` Komponente: Rendert zwei `<div>` Schichten mit CSS `radial-gradient` Patterns
- `@keyframes dot-drift` CSS: Langsame Background-Position Animation
- Radiale Opacity-Maske innerhalb der Handflaechen

Folgende Teile **bleiben unveraendert**:
- SVG Hand-Pfade (`RIGHT_HAND_PATHS`, `LEFT_HAND_PATHS`)
- `buildMaskSvg` Funktion
- Hand-Positionierung und mask-image Technik
- Drift-Animationen der Haende (`hand-drift-left`, `hand-drift-right`)
- Spark zwischen den Fingerspitzen
- Fade-Gradienten an den Raendern

### Resultat

Die Haende werden als **dichte, gleichmaessige Punkt-Raster** sichtbar -- modern, elegant, deutlich erkennbar. Zwei Schichten (fein + grob) erzeugen Tiefe. Radiale Opacity-Variation gibt den Handflaechen Volumen. Alles monochrom, keine Farben.

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/landing/AsciiHandsArt.tsx` | Code-Rain durch CSS Dot-Grid ersetzen, Performance-Verbesserung durch ~12000 weniger DOM-Elemente |

