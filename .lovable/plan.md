

# Dichtere Zeichen-Matrix in den Haenden

## Aktueller Zustand (Screenshot)

Die Hand-Silhouetten sind erkennbar, aber die Code-Rain-Spalten sind **extrem duenn und lueckenhaft** -- man sieht mehr Leerraum als Zeichen. Das liegt an:

- Nur **35 Spalten** pro Hand -- viel zu wenig fuer die Flaeche
- **1px Gap** zwischen Spalten und Zeilen
- Multi-Zeichen-Strings wie `match`, `hire`, `=>` erzeugen ungleichmaessige Breiten
- Font-Size 9-11px ist zu gross fuer die Anzahl Spalten

## Die Aenderungen

### 1. Einzelzeichen statt Woerter

Statt `["match", "hire", "=>", "fn", "()"]` werden **nur Einzelzeichen** verwendet:

`["x", "X", "#", ".", ":", "*", "+", "=", "~", "-", "0", "1", "/", "\\", "|", "%", "@", "&"]`

Das sorgt fuer gleichmaessige Spaltenbreite und maximale Dichte -- jedes Zeichen nimmt exakt gleich viel Platz ein.

### 2. Viel mehr Spalten, kein Gap

- Von **35 auf 80 Spalten** pro Hand
- Gap von `1px` auf `0px` (kein Abstand zwischen Spalten)
- Zeilen-Gap ebenfalls `0px`
- Font-Size bleibt bei `text-[9px] md:text-[11px]` -- aber mit 80 Spalten und 0 Gap ist alles dicht gepackt

### 3. Mehr Zeilen pro Spalte

- Von `rows * 2` auf `rows * 3` Zeichen pro Spalte -- damit die Animation fluessiger laeuft und keine Luecken beim Scrollen entstehen

### 4. Erhoehte Opacity

- Code-Zeichen von `text-foreground/[0.30]` auf `text-foreground/[0.20]`
- Hintergrund von `bg-foreground/[0.06]` auf `bg-foreground/[0.03]`
- Die Dichte der Zeichen kompensiert die etwas niedrigere Einzel-Opacity -- in der Masse wirkt es sichtbarer

### 5. Keine Farben

Alles bleibt `text-foreground` (monochrom, kein Gruen, kein Blau). Passt zum Design.

---

## Technische Details

### `src/components/landing/AsciiHandsArt.tsx`

**CODE_CHARS**: Wird ersetzt durch ein Array aus Einzelzeichen mit verschiedenen "Dichten" (schwere Zeichen wie `#`, `@`, `X` und leichte wie `.`, `:`, `~`)

**generateCodeColumns**: Erhoehung auf 80 Spalten, rows * 3 Zeilen

**CodeRainColumns**: 
- `gap-0` statt `gap-[1px]`
- `leading-none` statt `leading-tight` (kompaktere Zeilenhoehe)
- Opacity auf `0.20`

**Alles andere bleibt**: SVG-Pfade, mask-image, Drift-Animationen, Spark -- nur die Fuell-Dichte aendert sich.

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/landing/AsciiHandsArt.tsx` | CODE_CHARS auf Einzelzeichen, 80 Spalten, 0 Gap, leading-none, Opacity-Anpassung |

