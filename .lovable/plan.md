

# Echte Michelangelo-Haende mit Code-Matrix

## Das Problem (Screenshot)

Die aktuellen clipPath-Formen sind **grobe Approximationen** -- sie sehen aus wie Schulter-Silhouetten oder Tropfen, nicht wie Haende. Die echten Hand-Pfade aus dem hochgeladenen SVG werden nicht verwendet.

## Die Loesung

Die handgezeichneten clipPath-Approximationen werden durch die **echten SVG-Pfade** aus dem hochgeladenen Michelangelo-SVG ersetzt. Die Haende werden als CSS `mask-image` verwendet, damit der Code-Rain nur innerhalb der echten Hand-Silhouetten sichtbar ist.

## Wie es aussehen wird

Zwei detaillierte, sofort erkennbare Hand-Silhouetten (Gottes Hand rechts, Adams Hand links), gefuellt mit herabfallendem Code-Text. Die Haende bewegen sich langsam aufeinander zu. Zwischen den Fingerspitzen pulsiert ein Funke.

---

## Technische Umsetzung

### `src/components/landing/AsciiHandsArt.tsx` -- Komplett neu

**Ansatz: CSS mask-image mit echten SVG-Pfaden**

1. **Echte SVG-Pfade extrahieren**: Das hochgeladene SVG enthaelt zwei Haupt-Pfade:
   - Pfad 1 (rechte/obere Hand -- "Gottes Hand"): Der grosse komplexe Pfad ab `M11175 5470`
   - Pfad 2 (linke/untere Hand -- "Adams Hand"): Der Pfad ab `M2470 5123`
   - Plus 8 kleine Detail-Pfade (Finger-Details)

2. **Zwei separate SVGs erstellen**: Jede Hand wird als eigenes inline-SVG definiert mit:
   - Dem Original-Transform (`translate(0,800) scale(0.1,-0.1)`)
   - Einem zugeschnittenen `viewBox` fuer nur diese Hand
   - Weisser Fuellung auf transparentem Hintergrund

3. **CSS mask-image anwenden**: Jede Hand-SVG wird als Data-URL `mask-image` auf einen Container angewendet. Der Code-Rain innerhalb des Containers ist nur dort sichtbar, wo die Hand-Maske weiss ist.

4. **Code-Rain beibehalten**: Die bestehenden Code-Spalten (`{ } => fn() hire() match()`) bleiben, scrollen langsam nach unten innerhalb der Masken.

5. **Animationen**:
   - Drift aufeinander zu: Links `translateX(0 -> 15px)`, rechts `translateX(0 -> -15px)`, 6s Zyklus
   - Atem-Puls: Opacity 0.8 -> 1.0, 4s Zyklus
   - Code-Rain: translateY nach oben, verschiedene Geschwindigkeiten pro Spalte
   - Spark zwischen Fingerspitzen: Glow-Punkt pulsiert

6. **Styling**:
   - Code-Zeichen: `font-mono`, `text-foreground/[0.25]` -- deutlich sichtbarer als bisher
   - Haende nehmen je ~40% der Breite ein, positioniert links/rechts
   - Fade-Gradienten an den Raendern

### Koordinaten-Transformation

Das Original-SVG nutzt `viewBox="0 0 1200 800"` (in pt) mit `transform="translate(0,800) scale(0.1,-0.1)"`. Die internen Koordinaten:
- Rechte Hand: ca. x: 760-1120, y: 250-530 (nach Transform)
- Linke Hand: ca. x: 80-530, y: 280-520 (nach Transform)

Jede Hand bekommt einen eigenen zugeschnittenen viewBox, damit sie den Container perfekt ausfuellt.

### `src/components/landing/HeroSection.tsx` -- Keine Aenderung

---

## Warum das diesmal funktioniert

| Bisher | Neu |
|---|---|
| Handgezeichnete clipPath-Pfade mit ~20 Kontrollpunkten | Echte SVG-Pfade mit hunderten Kontrollpunkten |
| Sieht aus wie Tropfen/Blobs | Sofort als detaillierte Haende erkennbar |
| clipPath mit objectBoundingBox (ungenau) | CSS mask-image mit echtem SVG (pixel-perfekt) |

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/landing/AsciiHandsArt.tsx` | Komplett neu: Echte Michelangelo-SVG-Pfade als mask-image, Code-Rain innerhalb, Drift + Puls Animationen |

