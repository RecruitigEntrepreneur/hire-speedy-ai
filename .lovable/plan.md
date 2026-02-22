
# Hero Section Overhaul: ASCII-Haende + Interaktives Dashboard

## Probleme (Screenshot-basiert)

1. **ASCII-Haende unsichtbar**: Font-Size 8-12px, Opacity 0.12 -- man sieht praktisch nichts. Die Box-Drawing-Characters sind zu fein fuer den Zweck
2. **Positionierung falsch**: Die Haende sind `absolute inset-0` zentriert und landen direkt hinter/unter den CTAs -- nicht als eigenstaendiges visuelles Element sichtbar
3. **Dashboard statisch**: Sieht gut aus, aber null Interaktivitaet -- man kann nichts klicken

---

## Loesung

### 1. ASCII-Haende komplett neu (`AsciiHandsArt.tsx`)

**Was sich aendert:**
- **Groessere Schrift**: Von `text-[8px]/[10px]/[12px]` auf `text-[14px]/[18px]/[22px]` -- die Haende muessen sichtbar sein
- **Hoehere Opacity**: Von `0.12` auf `0.06-0.08` fuer die Haende, aber dafuer mit einem **animierten Glow-Effekt** der periodisch auf `0.15` hochfaehrt -- wie ein "Puls"
- **Bessere ASCII-Art**: Die aktuellen Box-Drawing-Haende sehen zu technisch/steif aus. Neue Hand-Silhouetten die organischer wirken, mit mehr Code-Zeichen im Inneren (`function()`, `return`, `match()`, `hire()`, `</>`, `=>`)
- **Groesserer Spark-Gap**: Der Bereich zwischen den Haenden wird breiter (w-32 md:w-48) mit staerkerem Flicker-Effekt und gelegentlichen "Blitz"-Momenten wo die Opacity kurz auf 0.3 springt
- **Position**: Leicht nach oben versetzt (`translateY(-120px)` statt `-40px`) damit die Haende im oberen Bereich der Hero-Section schweben, UEBER der Headline -- nicht dahinter versteckt
- **Skalierung responsive**: Auf Mobile kleiner aber immer noch sichtbar, auf Desktop gross und praesent

### 2. Dashboard interaktiv machen (`DashboardPreview.tsx`)

**Interaktive Elemente:**
- **Sidebar-Navigation klickbar**: Beim Klick auf "Jobs", "Kandidaten", "Analytics" wechselt der Hauptbereich zu einer anderen Demo-Ansicht (3 vordefinierte States)
  - **Dashboard**: Aktueller Zustand (Metriken + Pipeline) -- Default
  - **Jobs**: Eine Mini-Job-Liste mit Status-Badges (Aktiv, Pause, Geschlossen)
  - **Kandidaten**: Match-Score-Karten mit Profilbildern und Skill-Tags
- **Hover-Effekte auf Kandidaten-Zeilen**: Beim Hover leuchtet die Zeile auf (`bg-foreground/5`), der Score-Balken animiert sich
- **Metriken-Karten**: Zahlen zaehlen kurz hoch beim ersten Sichtbar-werden (mini countUp, schnell)
- **Cursor aendert sich**: `pointer-events-auto` statt `none` auf dem Dashboard, Custom-Cursor oder zumindest Pointer auf interaktiven Elementen
- **Klick-Feedback**: Beim Klick auf Sidebar-Items gibt es eine subtile Uebergangs-Animation (fade/slide)

### 3. Hero-Section Layout-Anpassung (`HeroSection.tsx`)

- **Spacing**: Mehr Abstand zwischen Headline und Dashboard -- das Dashboard soll als eigenstaendiger Block wirken
- **ASCII-Haende Z-Index**: z-[5] bleibt, aber die Position wird so angepasst dass die Haende UEBER der Headline schweben, nicht dahinter verschwinden

---

## Technische Details

### `src/components/landing/AsciiHandsArt.tsx` -- Komplett neu

Neue ASCII-Art mit groesseren, organischeren Hand-Formen:
- Linke Hand zeigt nach rechts, besteht aus Zeichen wie `{ } ( ) => fn match()`
- Rechte Hand zeigt nach links, besteht aus `hire() <> [] return true`
- Zwischen den Haenden: Spark-Bereich mit zufaellig wechselnden Code-Snippets
- **Puls-Animation**: Alle 4 Sekunden faehrt die Opacity der gesamten Haende kurz hoch (0.06 -> 0.12 -> 0.06)
- **Bewegung bleibt**: translateX 6px/-6px Hin-und-Her-Bewegung
- Font-Size: `text-sm sm:text-base md:text-lg lg:text-xl` (deutlich groesser)
- Position: `top-8 md:top-16` statt vertikal zentriert -- Haende im oberen Drittel

### `src/components/landing/DashboardPreview.tsx` -- Interaktiv

Neuer State-basierter Aufbau:
- `useState` fuer `activeTab` ("dashboard" | "jobs" | "kandidaten")
- Sidebar-Items bekommen `onClick` Handler + `cursor-pointer`
- Drei Content-Panels die per `activeTab` gerendert werden
- Uebergangs-Animation: `transition-opacity duration-300` beim Wechsel
- Hover-States auf allen Zeilen/Karten
- Mini-CountUp fuer die Metriken-Zahlen (nur beim initialen Render)
- `pointer-events-auto` auf dem gesamten Dashboard-Container

### `src/components/landing/HeroSection.tsx` -- Minimal

- `mt-16` auf DashboardPreview wird `mt-20 md:mt-24` fuer mehr Breathing Room
- Kein weiterer struktureller Umbau noetig

---

## Dateiaenderungen

| Datei | Art der Aenderung |
|---|---|
| `src/components/landing/AsciiHandsArt.tsx` | Komplett neu: groessere Schrift, bessere Art, Puls-Animation, neue Position |
| `src/components/landing/DashboardPreview.tsx` | Interaktiv: klickbare Sidebar, 3 Views, Hover-States, CountUp |
| `src/components/landing/HeroSection.tsx` | Spacing-Anpassung (mt-20) |
