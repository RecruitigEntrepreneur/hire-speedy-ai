

# Landing Page Komplett-Redesign: Next-Level 2026

## Vision

Die Haende sollen nicht als Hintergrundbild existieren, sondern als **ASCII-Art** gerendert werden -- die Haende bestehen aus Code-Zeichen, bewegen sich aufeinander zu und "atmen". Darunter kommt ein **Dashboard-Demo-Screenshot** der echten Plattform als perspektivisches, schwebendes Element. Die gesamte Seite bekommt moderne Scroll-Animationen, sanfte Uebergaenge zwischen Sektionen, und interaktive Elemente.

---

## Phase 1: Infrastruktur + Grundlagen

### `src/App.css` -- Bereinigen
- `#root { max-width: 1280px; padding: 2rem; text-align: center }` komplett entfernen -- das beschneidet die gesamte Seite

### Neue Hooks erstellen
- **`src/hooks/useScrollReveal.ts`**: IntersectionObserver-Hook, gibt `ref` + `isVisible` zurueck. Jede Sektion nutzt diesen fuer scroll-triggered Einblendungen
- **`src/hooks/useCountUp.ts`**: Animierter Zaehler (0 -> Zielwert) der erst startet wenn sichtbar
- **`src/hooks/useParallax.ts`**: Scroll-basierter Parallax-Effekt fuer Hintergrund-Elemente und das Dashboard-Mockup

### `src/index.css` -- Neue Animations-Klassen
- `.reveal` / `.reveal-visible`: Opacity 0->1, translateY 40px->0 mit konfigurierbarem Delay via CSS-Variable
- `.text-stroke`: Text mit transparentem Fill und sichtbarem Stroke (fuer "Perfect Hire.")
- `.perspective-tilt`: 3D-Perspektive fuer das Dashboard-Mockup
- `.section-transition`: Weiche Uebergaenge zwischen Sektionen via Gradient-Overlaps

---

## Phase 2: Hero Section -- Komplett Neukonzept

### `src/components/landing/AsciiHandsArt.tsx` (NEU)
**Das Herzstück**: Die Michelangelo-Haende werden als **ASCII-Art** gerendert:
- Zwei Hand-Silhouetten bestehend aus Code-Zeichen (`{ } [ ] < > / \ | 0 1`)
- Linke Hand und rechte Hand bewegen sich langsam aufeinander zu (CSS animation, ~3px hin und her)
- Der Raum zwischen den Haenden "flimmert" mit zufaelligen Zeichen -- wie ein Datentransfer
- Die Haende sind gross, zentriert, semi-transparent (opacity 0.15-0.25)
- Dunkler Hintergrund (`bg-background`), kein Weiss

### `src/components/landing/CreationHandsBackground.tsx` -- Entfernen/Ersetzen
- Wird nicht mehr gebraucht, das PNG-Bild wird durch die ASCII-Haende ersetzt

### `src/components/landing/AsciiCodeOverlay.tsx` -- Entfernen
- Der zufaellige ASCII-Overlay wird nicht mehr gebraucht, da die Haende selbst aus ASCII bestehen

### `src/components/landing/DashboardPreview.tsx` (NEU)
**Dashboard-Demo unter dem Hero**:
- Ein statischer Screenshot/Mockup des echten Dashboards (gebaut als React-Komponente, nicht als Bild)
- Zeigt: Sidebar-Ausschnitt, Kandidaten-Pipeline, Match-Score-Karten, Funnel-Chart
- In einem Browser-Chrome-Rahmen (dunkel, mit Dots oben links rot/gelb/gruen)
- **Perspektivisch geneigt**: `perspective(1200px) rotateX(8deg)` -- sieht aus als "schwebt" es
- Subtle Glow darunter (`box-shadow` + blur)
- Beim Scrollen richtet sich das Dashboard langsam auf (rotateX geht auf 0) via `useParallax`
- Monochrom: `bg-card`, `border-border`, `text-foreground/muted-foreground`

### `src/components/landing/HeroSection.tsx` -- Komplett neu
**Layout:**
1. Dunkler Hintergrund (`bg-background`), KEIN weisser Hintergrund
2. ASCII-Haende als Hintergrund-Element (statt PNG + ASCII-Overlay)
3. Badge: Monochrom (`bg-foreground/5 border-border/30 text-muted-foreground`)
4. **"Perfect Match."** in grosser weisser Schrift
5. **"Perfect Hire."** als **Stroke-Text** -- nur der Outline ist sichtbar, mit einer animierten Gradient-Linie die durch den Stroke fliesst (CSS `background-clip: text` + `stroke` Trick)
6. Subheadline: Schlichter, `text-muted-foreground`
7. CTAs: Primaer = `bg-foreground text-background` (weiss/schwarz invertiert), Sekundaer = `border-foreground/20`
8. Weg mit den fake Firmennamen ("TechCorp" etc.) -- nur "500+ erfolgreiche Placements"
9. **Dashboard-Preview** statt MatchingVisualization
10. Scroll-Indicator am unteren Rand: animierter Chevron/Maus-Icon

### `src/components/landing/MatchingVisualization.tsx` -- Verschieben
- Wird aus dem Hero entfernt und in die Engine-Section integriert (dort passt es thematisch)
- Alle Farben monochrom umstellen

---

## Phase 3: Sektions-Uebergaenge + Scroll-Reveals

Jede Sektion bekommt:
- **Scroll-triggered Reveal**: Elemente erscheinen mit Stagger-Delay beim Scrollen
- **Weiche Uebergaenge**: Gradient-Overlaps am Anfang/Ende jeder Sektion statt harter Farbwechsel
- **Alternierende Hintergruende**: `bg-background` (dunkel) und `bg-muted/30` (leicht heller) im Wechsel

---

## Phase 4: Alle Sektionen -- Monochrom + Modern

### Farb-Cleanup (betrifft ALLE Sektionen)
Jede Datei wird durchgegangen und ersetzt:
- `bg-slate-50` -> `bg-muted/30`
- `bg-white` -> `bg-background` oder `bg-card`
- `text-slate-900` -> `text-foreground`
- `text-slate-600` -> `text-muted-foreground`
- `text-slate-400/500` -> `text-muted-foreground`
- `bg-emerald`, `text-emerald`, `from-emerald`, `border-emerald/*` -> `bg-foreground`, `text-foreground`, `border-foreground/20`
- `bg-red-50`, `bg-orange-50`, `bg-amber-50` -> `bg-muted/50`
- `text-red-500`, `text-orange-500`, `text-amber-500` -> `text-foreground`
- `shadow-emerald/*` -> `shadow-foreground/10`
- `hover:border-emerald/*` -> `hover:border-foreground/20`
- `bg-emerald/10` -> `bg-foreground/5`
- `hover:text-emerald` -> `hover:text-foreground`

### Betroffene Dateien:
| Datei | Hauptaenderungen |
|---|---|
| `SocialProofSection.tsx` | Counter-Animation mit `useCountUp`, Marquee-Band, monochrom |
| `ProblemSection.tsx` | `bg-muted/30`, monochrome Pain-Cards, scroll-reveal, kein Emerald |
| `EngineSection.tsx` | Monochrome Ringe/Core, MatchingVisualization hier integrieren, scroll-stagger |
| `HowItWorksSection.tsx` | `bg-muted/30`, monochrome Timeline, scroll-reveal fuer Steps |
| `FeaturesSection.tsx` | Monochrome Icons/Bars, scroll-reveal pro Feature-Block |
| `ForCompaniesSection.tsx` | `bg-muted/30`, monochrome Benefit-Cards |
| `ForRecruitersSection.tsx` | Monochrome Recruiter-Card, keine farbigen Badges |
| `AnalyticsSection.tsx` | `bg-muted/30`, monochrom Dashboard-Mockup, perspective-tilt |
| `CaseStudiesSection.tsx` | `bg-background`, monochrome Icon-Boxen |
| `PricingSection.tsx` | Monochrome Badge/CTA |
| `TrustSecuritySection.tsx` | `bg-background`, monochrome Grid/Cards |
| `FAQSection.tsx` | Label-Fix (`text-muted-foreground`) |
| `FinalCTASection.tsx` | `bg-background`, keine Emerald-Elemente, Shine-Effekt auf CTA |
| `FooterSection.tsx` | `bg-card`, `border-border`, `text-muted-foreground`, MatchuntLogo statt Briefcase |

---

## Phase 5: Spezial-Effekte

### Social Proof -- Animated Counter + Marquee
- Metriken ("3.8 Tage", "+42%", "12.000+") zaehlen mit `useCountUp` hoch wenn sichtbar
- Neues **Marquee-Band** zwischen Metriken und Testimonial: Endlos-Lauftext "Schneller. Praeziser. Fairer. Ergebnisorientiert." in grosser, leicht transparenter Schrift

### Engine Section -- MatchingVisualization Integration
- Die Animation aus dem Hero wird hier platziert (thematisch passend: "The Recruiting OS")
- Alle Farben monochrom

### Analytics Section -- Dashboard-Tilt
- Das Dashboard-Mockup bekommt `perspective(1200px) rotateX(5deg)` und richtet sich beim Scrollen auf

### Final CTA -- Shine-Effekt
- Ein weisser Lichtstreifen gleitet periodisch ueber den CTA-Button

---

## Zusammenfassung der Dateien

| Datei | Typ |
|---|---|
| `src/App.css` | Bereinigen |
| `src/hooks/useScrollReveal.ts` | Neu |
| `src/hooks/useCountUp.ts` | Neu |
| `src/hooks/useParallax.ts` | Neu |
| `src/index.css` | Erweitern (neue Utility-Klassen) |
| `src/components/landing/AsciiHandsArt.tsx` | Neu -- ASCII-Haende |
| `src/components/landing/DashboardPreview.tsx` | Neu -- Demo-Dashboard |
| `src/components/landing/HeroSection.tsx` | Komplett neu |
| `src/components/landing/CreationHandsBackground.tsx` | Entfernen (durch ASCII ersetzt) |
| `src/components/landing/AsciiCodeOverlay.tsx` | Entfernen (in Haende integriert) |
| `src/components/landing/MatchingVisualization.tsx` | Monochrom + in EngineSection verschieben |
| `src/components/landing/SocialProofSection.tsx` | Counter, Marquee, monochrom |
| `src/components/landing/ProblemSection.tsx` | Monochrom, scroll-reveal |
| `src/components/landing/EngineSection.tsx` | Monochrom, Visualization integriert |
| `src/components/landing/HowItWorksSection.tsx` | Monochrom, scroll-reveal |
| `src/components/landing/FeaturesSection.tsx` | Monochrom, scroll-reveal |
| `src/components/landing/ForCompaniesSection.tsx` | Monochrom |
| `src/components/landing/ForRecruitersSection.tsx` | Monochrom |
| `src/components/landing/AnalyticsSection.tsx` | Monochrom, perspective-tilt |
| `src/components/landing/CaseStudiesSection.tsx` | Monochrom |
| `src/components/landing/PricingSection.tsx` | Monochrom |
| `src/components/landing/TrustSecuritySection.tsx` | Monochrom |
| `src/components/landing/FAQSection.tsx` | Label-Fix |
| `src/components/landing/FinalCTASection.tsx` | Monochrom, Shine-CTA |
| `src/components/landing/FooterSection.tsx` | Monochrom, MatchuntLogo |

**25 Dateien, 3 neue Hooks, 2 neue Komponenten.** Jede Sektion bekommt scroll-triggered Reveals. Die Hero-Section wird zum cinematischen Einstieg mit ASCII-Haenden und schwebendem Dashboard-Preview.

