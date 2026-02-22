

# Sichtbare ASCII-Haende: SVG-Mask + Code-Zeichen

## Das Problem (Screenshot-Beweis)

Die aktuellen "Haende" sind **unsichtbar**. Was man sieht: verstreute `x`, `X`, `#` Zeichen bei 8px Font und 14% Opacity. Das sieht aus wie zufaelliges Rauschen -- niemand erkennt darin Haende. Wir haben das jetzt 4x versucht und es funktioniert nicht, weil:

- ASCII-Art aus Einzelzeichen braucht mindestens 20-30px Font-Size um als Form erkennbar zu sein
- Bei der noetige Groesse wuerden die Haende die gesamte Hero-Section ueberdecken
- Die Zeichen-Arrays sind zu klein (23 Zeilen x ~40 Zeichen) fuer erkennbare Silhouetten

## Die Loesung: Anderer Ansatz

Statt zu versuchen, Zeichen so anzuordnen dass sie wie Haende aussehen, drehen wir es um:

**SVG-Pfade definieren die Hand-Form als Clip-Mask. Innerhalb dieser Maske werden Code-Zeichen angezeigt.**

Das Ergebnis: Zwei perfekte Hand-Silhouetten, gefuellt mit fallendem/scrollendem Code-Text. Sofort als Haende erkennbar. 100% ASCII/Code-Aesthetic.

---

## Wie es aussieht

Stell dir zwei grosse Hand-Silhouetten vor (Michelangelo "Creation of Adam"), die wie Fenster in eine Code-Matrix sind. Innerhalb der Hand-Formen sieht man Zeichen wie `{ } => fn() match() hire() 0 1 return`. Die Zeichen scrollen langsam nach unten (wie Matrix Rain, aber subtil). Die Haende selbst bewegen sich langsam aufeinander zu.

## Technische Umsetzung

### `src/components/landing/AsciiHandsArt.tsx` -- Komplett neu

1. **Zwei SVG clipPath-Definitionen**: Linke und rechte Hand als SVG-Pfade (aus dem zuvor hochgeladenen SVG abgeleitet -- vereinfachte Konturen)
2. **Code-Text-Spalten**: Innerhalb jeder Hand-Maske laufen vertikale Spalten von Code-Zeichen (`{`, `}`, `=>`, `fn`, `()`, `0`, `1`, `match`, `hire`) langsam nach unten
3. **Animations**:
   - Haende driften aufeinander zu: `translateX(0 -> 8px)` links, `translateX(0 -> -8px)` rechts, 6s Zyklus
   - Code-Rain innerhalb der Haende: `translateY` Animation, 15s Zyklus, verschiedene Geschwindigkeiten pro Spalte
   - Puls: Opacity 0.12 -> 0.22 -> 0.12, 4s Zyklus
   - Spark zwischen Fingerspitzen: Glow-Punkt pulsiert
4. **Styling**:
   - `font-mono`, `text-foreground` mit Opacity 0.15-0.25
   - Haende nehmen ca. 60-70% der Viewport-Breite ein
   - Position: `absolute`, zentriert, oberer Bereich
   - Fade-Gradienten an den Raendern

### `src/components/landing/HeroSection.tsx` -- Keine Aenderung

Import bleibt gleich.

---

## Warum das diesmal funktioniert

| Bisheriger Ansatz | Neuer Ansatz |
|---|---|
| Zeichen muessen die Form bilden -- funktioniert nur bei riesiger Font-Size | SVG-Pfade bilden die Form -- pixel-perfekt auf jeder Groesse |
| 23 Zeilen x 40 Zeichen = zu wenig Aufloesung | SVG skaliert beliebig |
| Opacity 0.14 bei 8px = unsichtbar | Opacity 0.15-0.25 innerhalb klarer Konturen = erkennbar |
| Kein Mensch erkennt die Haende | Sofort als Haende erkennbar dank SVG-Clip |

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/landing/AsciiHandsArt.tsx` | Komplett neu: SVG-Clip-Mask Haende gefuellt mit Code-Zeichen, Drift + Rain + Puls Animationen |

Eine einzige Datei.

