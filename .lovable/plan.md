
# Echte Michelangelo-Haende mit Code-Matrix

## Status: IMPLEMENTIERT

Echte SVG-Pfade aus dem hochgeladenen Michelangelo-SVG werden als CSS `mask-image` verwendet.
Code-Rain (Matrix-Effekt) ist nur innerhalb der Hand-Silhouetten sichtbar.

### Technische Details
- Rechte Hand (Gottes Hand): viewBox `750 240 470 340`
- Linke Hand (Adams Hand): viewBox `0 270 550 280`
- SVG-Pfade als Data-URL mask-image
- Code-Rain mit `translateY(-50%)` Animation
- Drift-Animation: Haende bewegen sich aufeinander zu
- Spark zwischen Fingerspitzen
