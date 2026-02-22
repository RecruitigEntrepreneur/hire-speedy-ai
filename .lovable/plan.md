
# ASCII-Art Haende: Echte Hand-Silhouetten aus Zeichen

## Das Konzept

Die Michelangelo "Creation of Adam" Haende werden als **grosse ASCII-Art** dargestellt -- jede Hand ist ein Raster aus Zeichen (`x`, `X`, `#`, `@`, `.`, `:`, `*`, `/`, `\`) die zusammen die Form einer echten Hand ergeben. Wie Pixel-Art, aber mit Text-Symbolen.

**Aktuell**: Kaputte Rechtecke aus Box-Drawing-Zeichen, 7% Opacity, 11px -- unsichtbar.
**Neu**: Grosse, erkennbare Hand-Silhouetten aus Symbolen, ~15% Opacity, gut lesbar.

---

## Die ASCII-Haende

Jede Hand wird als mehrzeiliger String definiert -- ca. 25-30 Zeilen hoch, 35-45 Zeichen breit. Die Zeichen werden nach "Dichte" gewaehlt:
- **Dunkle Bereiche** (Handflaeche): `X`, `#`, `@`, `%`
- **Mittlere Bereiche** (Finger): `x`, `*`, `+`, `=`
- **Helle Bereiche** (Raender): `.`, `:`, `-`, `~`
- **Leere Bereiche**: Leerzeichen

Die **linke Hand** zeigt mit ausgestrecktem Zeigefinger nach rechts (Gottes Hand).
Die **rechte Hand** zeigt mit ausgestrecktem Zeigefinger nach links (Adams Hand).
Zwischen den Fingerspitzen ist ein kleiner Gap -- der "Funke".

Beispiel-Ausschnitt (vereinfacht):

```
Linke Hand:                          Rechte Hand:
                  . x x                  x x .
              . x X X x .          . x X X x .
          x x X X X X x          x X X X X x x
        x X X X X # x              x # X X X X x
      x X X # # x .                  . x # # X X x
    x X X # x .                          . x # X X x
    x X x .           * . *           . x X x
    x X x           . * * * .           x X x
    x X X x x x x x X X X X x x x x x X X x
      x X X X X X X X # # X X X X X X X X x
        . x x X X X X X X X X X X x x .
              . x x x x x x x x .
```

---

## Technische Umsetzung

### `src/components/landing/AsciiHandsArt.tsx` -- Komplett neu

**Struktur:**
- `LEFT_HAND`: Array von ~28 Strings, formt die linke Hand-Silhouette aus Symbolen
- `RIGHT_HAND`: Array von ~28 Strings, formt die rechte Hand-Silhouette (gespiegelt)
- Zwischen den Haenden: Ein schmaler Spark-Bereich mit flackernden Zeichen (`*`, `+`, `.`)

**Styling:**
- Font: `font-mono` (monospace ist Pflicht fuer ASCII-Art)
- Font-Size: `text-xs sm:text-sm md:text-base lg:text-lg` -- deutlich groesser als aktuell
- Farbe: `text-foreground` mit Opacity 0.12-0.18 -- subtil aber **sichtbar**
- Die Haende sollen als Hintergrund-Element erkennbar sein, nicht dominant

**Animationen:**
- **Drift aufeinander zu**: Linke Hand `translateX(0 -> 10px)`, rechte Hand `translateX(0 -> -10px)`, 6s ease-in-out infinite -- sie bewegen sich staendig aufeinander zu und zurueck
- **Atem-Puls**: Gesamte Opacity pulsiert leicht (0.12 -> 0.18 -> 0.12, 4s Zyklus)
- **Spark zwischen Fingerspitzen**: Der Bereich zwischen den Fingerspitzen flackert mit wechselnden Zeichen (`*`, `+`, `x`, `.`) -- wie ein Datentransfer. Opacity springt gelegentlich kurz hoch (Flash-Effekt)

**Position:**
- `absolute`, zentriert, im oberen Bereich der Hero-Section (`top-4 md:top-12`)
- `pointer-events-none`, `z-[5]`
- Fade-Gradienten an den Raendern (oben/unten) fuer weichen Uebergang

### `src/components/landing/HeroSection.tsx` -- Keine Aenderung

Die Komponente importiert weiterhin `AsciiHandsArt` -- nur der Inhalt der Komponente aendert sich.

---

## Warum dieser Ansatz funktioniert

1. **Erkennbare Haende**: Durch die Pixel-Art-Technik sieht man sofort zwei Haende die sich entgegenstrecken
2. **ASCII-Aesthetic**: Monospace-Font + Symbole = der gewuenschte "Code/Hacker"-Look
3. **Kein Font-Rendering-Problem**: Normale ASCII-Zeichen (`x`, `#`, `.`) rendern auf jedem System gleich -- im Gegensatz zu Box-Drawing-Characters
4. **Skalierbar**: Groessere Font-Size = groessere Haende, ohne Qualitaetsverlust
5. **Die Bewegung erzaehlt die Story**: Die Haende bewegen sich aufeinander zu = "Recruiter und Unternehmen finden zusammen"

---

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/landing/AsciiHandsArt.tsx` | Komplett neu: Echte Hand-Silhouetten aus ASCII-Zeichen, Drift-Animation aufeinander zu, Atem-Puls, Spark-Gap |

Eine einzige Datei. Keine weiteren Aenderungen noetig.
