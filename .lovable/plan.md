

# Design-System Rebranding: Matchunt.ai (Schritte 1-4)

## 1. Farb-Analyse aus den Bildern

Aus den Brand Guidelines (Bild 1) und dem Monogramm (Bild 2) ergeben sich folgende Werte:

### Dark UI (Standard / Dashboard / Login)
- Background: `#0a0a0a` (fast schwarz)
- Card/Surface: `#141414`
- Elevated Surface: `#1a1a1a`
- Border: `#262626`
- Border subtle: `#1f1f1f`
- Text primary: `#fafafa`
- Text muted: `#a1a1a1`
- Text subtle: `#737373`

### Neutral Surfaces (Light Mode / Cards)
- Background: `#fafafa`
- Card: `#ffffff`
- Border: `#e5e5e5`
- Text primary: `#0a0a0a`
- Text muted: `#737373`
- Text subtle: `#a1a1a1`

### Markenfarben
- Kein Akzent-Farbton -- das Branding ist rein monochromatisch (schwarz/weiss)
- Primary im Dark Mode: `#fafafa` (weiss)
- Primary im Light Mode: `#0a0a0a` (schwarz)
- Die bisherigen Emerald/Navy/Blau-Toene werden durch neutrale Toene ersetzt

### Schrift
- Aus den Bildern: Clean Sans-Serif, passend zu dem bereits eingesetzten **Inter**
- Wordmark "Matchunt.ai": Inter, font-weight 600, letter-spacing tight

---

## 2. CSS-Variablen komplett ersetzen

**Datei: `src/index.css`**

Der bestehende `:root`-Block (light-first) wird zu einem **dark-first** System umgebaut:

- `:root` bekommt die Dark-UI-Werte (Standard)
- Neuer `.light`-Block bekommt die Neutral-Surfaces-Werte
- Alle custom colors (navy, emerald, slate-blue etc.) werden entfernt
- Gradients vereinfacht auf monochromatische Varianten
- Shadows an dunklen Hintergrund angepasst (subtiler)

Alle bisherigen Farbvariablen (`--primary`, `--card`, `--muted`, etc.) werden mit den neuen monochromatischen Werten befuellt.

---

## 3. Theme-System: useTheme Hook + ThemeToggle

### 3a. `src/hooks/useTheme.ts` (neue Datei)
- Hook der den Theme-State verwaltet (`dark` | `light`)
- Liest/schreibt `localStorage` key `matchunt-theme`
- Setzt `.light` Klasse auf `<html>` (statt `.dark`, weil dark jetzt der Default ist)
- Default: `dark`

### 3b. `src/components/ui/ThemeToggle.tsx` (neue Datei)
- Button mit Sun/Moon Icon (aus lucide-react)
- Nutzt `useTheme` Hook
- Minimales Design: Ghost-Button, passt sich dem aktuellen Theme an

### 3c. Integration in `DashboardLayout.tsx`
- ThemeToggle wird im Sidebar-Footer eingefuegt (neben "Einstellungen")

### 3d. `src/main.tsx` anpassen
- Beim App-Start Theme aus localStorage lesen und `.light` Klasse setzen falls noetig

### 3e. `tailwind.config.ts` anpassen
- `darkMode` von `["class"]` bleibt, aber die Klasse wird `.light` statt `.dark` (oder wir nutzen den Ansatz: root = dark, `.light` override)

---

## 4. Logo als SVG-Komponente + Sidebar-Header

### 4a. `src/components/ui/MatchuntLogo.tsx` (neue Datei)
- SVG-Komponente des MH-Monogramms basierend auf Bild 2
- Das Monogramm besteht aus geometrischen Formen: Ein "M" und "H" verschraenkt in einem nach unten zeigenden Pfeil/Diamant-Form
- Props: `size`, `className`, `variant` (`light` | `dark`)
- Farbe passt sich automatisch an (`currentColor`)

### 4b. `src/components/ui/MatchuntWordmark.tsx` (neue Datei)
- Kombination aus Monogramm + "Matchunt.ai" Text
- Layout wie in Bild 1 "Product UI": Icon links, Text rechts
- Props: `size` (`sm` | `md` | `lg`)

### 4c. `DashboardLayout.tsx` aktualisieren
- Briefcase-Icon im Header durch MatchuntWordmark ersetzen
- Monogramm-Groesse: 32px, Text: "Matchunt.ai", font-semibold

### 4d. `Navbar.tsx` aktualisieren
- Gleiches Logo-Update fuer die Landing-Page Navigation

### 4e. Favicon
- MH-Monogramm als Favicon einsetzen (aus Bild 2 kopieren nach `public/favicon.png`)

---

## Technische Zusammenfassung

| Datei | Aenderung |
|---|---|
| `src/index.css` | Komplett neue CSS-Variablen: dark-first, monochromatisch |
| `tailwind.config.ts` | darkMode-Logik anpassen, custom colors bereinigen |
| `src/hooks/useTheme.ts` | Neuer Hook fuer Theme-Switching |
| `src/components/ui/ThemeToggle.tsx` | Sun/Moon Toggle-Button |
| `src/components/ui/MatchuntLogo.tsx` | SVG Monogramm-Komponente |
| `src/components/ui/MatchuntWordmark.tsx` | Logo + Schriftzug Kombination |
| `src/components/layout/DashboardLayout.tsx` | Neues Logo + ThemeToggle im Footer |
| `src/components/layout/Navbar.tsx` | Neues Logo |
| `src/main.tsx` | Theme-Initialisierung |
| `index.html` | Favicon + dark default class auf html |
| `public/favicon.png` | MH-Monogramm kopiert |

### Nicht in diesem Schritt (Schritte 5-7, spaeter)
- Hardcodierte Farben in allen 62 Dateien ersetzen
- Landing Page Redesign
- Kandidaten-Seiten Light-Mode-Lock

