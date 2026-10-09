# Aufgaben-Bereich: Design-Research und drei visuelle Varianten

Stand: 09.10.2026 · drei Research-Berichte (Task-Inbox-Muster der Besten, visuelle Design-Sprache 2026, KI-native Assistenten) · Wireframes Bisher | Neu im Chat gezeigt · nichts gebaut. Ergänzt `AUFGABEN_ANALYSE_2026-10-08.md` (Logik, Backend, Varianten A/B/C der Struktur).

## 1. Diagnose in einem Satz

Der Ist-Zustand ist nicht hässlich, er ist **shadcn-Default von 2024**: Hintergrund #0a0a0a, 8-px-Radius, alles eine Karte mit Rahmen, Lucide-Icon vor jedem Titel, bunte Typ-Badges, Versal-Überschriften, Score als blaue Pille, Detail als Modal. Die Besten (Linear, Vercel, Stripe, Superhuman, Attio, Raycast) sind seit 2025 ruhiger, monochromer, dichter geworden und strukturieren durch Helligkeit statt durch Rahmen.

## 2. Was 2026 modern ist und was oldschool (belegt)

| Merkmal | Oldschool (Matchunt heute) | State of the art | Vorbild |
|---|---|---|---|
| Container | jedes Objekt eine Karte, Kartenraster | Zeilen; Karte nur für eigenständige Objekte („Do not wrap every section in a card“) | Vercel design.md, Linear |
| Detail | zentrales 900-px-Modal | Seitenpanel über der Liste (Side Peek, ContextView) | Notion, Stripe, Linear |
| Farbe | blaue/amber Badges, grüne Beträge, blaue 70 | Farbe nur für Bedeutung: ein Akzent, drei Statusfarben, Status als Punkt | Vercel, Superhuman |
| Gruppentitel | rote VERSALIEN mit Icon | Title-Case, 12 px, gedämpft, Zähler tabular | Apple 2025 |
| Icons | Icon vor allem, Glühbirne, Play | weniger, kleiner, einfarbig, keine farbigen Icon-Hintergründe | Linear Refresh 03/2026 |
| Elevation | Schatten auf dunklen Karten | Höhe = Helligkeit, Hairlines 5–8 % Weiß-Alpha | Material, Atlassian, Linear |
| Schrift | Inter ohne Display-Schnitt, keine Zahlenfeatures | Inter 4 + Inter Display, Gewichte 400/500/600, tabular-nums | Linear, Vercel Geist |
| Zahlen | Score-Pille, Euro grün im Fließtext | Zahlen groß, neutral, rechtsbündig, gleiche Dezimalen | Adobe Spectrum |
| Seitenleiste | 12 gleich laute Einträge | dunkler als Inhalt, weniger Einträge, ⌘K für den Rest | Linear, Vercel |
| Filter | 6 Pillen-Chips | Segmented Control für 2–4 Sichten, sonst Menü | Linear, Attio |
| Bewegung | Default | 120–220 ms, ease-out, nur opacity/transform, reduced-motion | motion.dev |
| Leere/Null | „Placements 0“ als KPI | Leerzustand mit nächstem Schritt | shadcn Empty |
| Tastatur | Maus-only | ⌘K-Palette, Kbd-Hinweise, J/K/E/H | Linear, Raycast, Stripe |

Als veraltet belegt: Kartenraster für Arbeitslisten (Smashing 05/2026), Modal für Details (NN/g), Hover-only-Aktionen (WCAG 2.1.1/1.4.13), Gamification-Scores (Gartner, WVU; keines der zehn untersuchten Produkte zeigt einen Leistungs-Score auf der Arbeitsliste), Chip-Reihen als Hauptnavigation, lange flache Seitenleisten, Chat-Box als einzige KI-Form, ungewichteter Benachrichtigungs-Feed.

## 3. Interaktionsmuster, die 2026 Standard sind (für alle Varianten)

1. Priorität vor Chronologie: zwei Reiter „Jetzt / Rest“ statt sechs Chips (Linear Priority Inbox 09/2026, Gmail AI Inbox).
2. Feste Fokus-Gruppen statt Sortier-Optionen; leere Gruppen verschwinden (Linear My Issues).
3. Heute · Demnächst als Tagesliste (Things, Todoist, Attio Home).
4. Zeile statt Karte, Detail im Seitenpanel, Liste bleibt sichtbar.
5. Tastatur: J/K, E tun, H später, ⌘K; Hinweise inline.
6. Später mit Rückkehr-Bedingung: Datum oder neue Aktivität, was zuerst eintritt (Linear Snooze).
7. Ein-Satz-Stand über jedem Vorgang (Superhuman Auto Summarize, Gmail Summary Cards).
8. Natürliche Sprache für Termine („in 3 Tagen nachfassen“, Attio).
9. Geführte Warteschlange statt Session-Dialog (HubSpot Sales Workspace Queue).
10. Handlungsbedarf oben, Kennzahlen unten (Stripe Home).
11. Begründung an jedem Vorschlag, Mensch-Daten optisch getrennt von KI-Vorschlägen (Linear Triage Intelligence, Dynamics „How was this generated?“).
12. KI bereitet vor, Mensch bestätigt: Entwürfe sichtbar als Entwurf, Senden bleibt Klick (Superhuman Auto Drafts, HubSpot „Review before sending“, Salesforce Pipeline Inspection accept/decline/edit).

KI-Regeln für Matchunt: Stufe 1 ohne Modell (Regeln: Fristen, Stillstand, fehlendes Debrief, Morgen-Briefing in max. 10 Zeilen, „Sonst nichts.“ als echter Abschluss), Stufe 2 Entwürfe mit Pseudonymisierung vor dem Aufruf, Stufe 3 Agent mit Freigabe-Schleife. Nie: Firmenname vor Reveal, Kandidatenname vor Opt-In, Versand ohne Klick, Scores als Entscheidung (Art. 22, AI Act Hochrisiko).

## 4. Token-Brief (shadcn/Tailwind, Dark als Primärmodus)

- **Typografie:** Inter 4 (variable, rsms.me) + Inter Display ab 20 px; Alternative Geist Sans/Mono (OFL). Mono nur für IDs, Zeitstempel. Skala 11/16 Meta · 12/16 Label · 13/20 Zeile · 14/20 Body · 20/28 Abschnitt · 24/32 Titel · 32/36 KPI. Gewichte 400/500/600. `tabular-nums` in Listen und KPIs.
- **Farben Dark (OKLCH, leicht warm):** Sidebar `oklch(0.14 0.004 80)` #0d0c0b · Canvas `oklch(0.17 0.004 80)` #121110 · Surface #1b1a18 · Overlay #242220 · Active #2d2b28 · Text #ebe9e6 / #a8a49e / #78746e · Border `rgb(255 255 255 / .07)` (Hover .11, stark .16) · Akzent `oklch(0.72 0.13 258)` #7a9eff (einziger) · ok #3fbf7e · warn #dca64a · danger #e2584d. Farbe nur für Bedeutung, Status auf dem Punkt, Euro neutral.
- **Dichte:** 4-px-Raster, Zeile 36 px (kompakt 32), Zellen-Padding 8/12, Seitenrand 24, Panel 520 px (max 50 %), Inhalt max 1280.
- **Radius:** 4 Badges/Kbd · 6 Buttons/Inputs · 8 Panels · 12 Overlays; konzentrisch.
- **Elevation:** Hairlines statt Schatten; Overlays 1-px-Hairline + `0 8px 24px rgb(0 0 0/.45)` + Lichtkante oben `inset 0 1px 0 rgb(255 255 255/.06)`.
- **Icons:** Lucide 16 px in Zeilen, 20 px Nav, stroke 1.5, Farbe fg-2; keine Icons in Überschriften, keine Erklär-Icons.
- **Bewegung:** 120 ms Hover · 160 ms Menü · 220 ms Panel; ease `cubic-bezier(0.16,1,0.3,1)`; nur opacity/transform; `prefers-reduced-motion`.
- **Zustände:** Hover = Surface, Fokus = 2-px-Akzent-Outline, Selected = Active + 2-px-Akzentleiste links, aktive Nav ohne Akzent.
- **Komponenten:** Zeile statt Karte · Panel statt Modal · Segmented Control statt Chips · Badges monochrom mit Punkt · Gruppentitel Title-Case · KPI neutral 32 px · ein Akzentbutton pro Screen · ⌘K (cmdk) · shadcn-Komponenten Item, Empty, Kbd, Field, Button Group.

## 5. Drei visuelle Varianten

| | A Monochrome Präzision | B Warme Klarheit | C Glas und Tiefe |
|---|---|---|---|
| Vorbilder | Linear, Vercel, Raycast | Stripe, Attio, Superhuman 2026 | Apple Liquid Glass (zurückhaltend), shadcn Luma |
| Gefühl | ernsthaftes Arbeitsgerät | Boutique, Beratung, Menschen statt Datensätze | neuestes Gerät, Premium, vorführbar |
| Palette | #121110 · #1b1a18 · #2d2b28 · #a8a49e · #ebe9e6 + #7a9eff | #141210 · #1e1b18 · #2c2823 · #a39e95 · #f2ede4 + Kupfer #d9a15a | #07080a · #111318 · #1b1e25 · #8b91a0 · #e8eaf0 + #7aa2ff |
| Schrift | Inter 4 + Inter Display | Inter 4 + Instrument Serif (nur Titel, Namen im Panel, Beträge) | Geist Sans / Geist Mono |
| Radius / Zeile | 6 / 36 px | 8 / 40 px | 10–14 / 38 px |
| Signatur | Hairline-Raster, ⌘K, rechtsbündige Zahlen | Serif-Zahl, warme Flächenstufen ohne Rahmen | Glas-Kopfleiste und Glas-Panel über matter Liste |
| Umbaukosten | gering (passt zur shadcn-Herkunft) | mittel (Fonts, Light Mode als Partner) | hoch (Disziplin, Performance, reduced-transparency) |
| Risiko | wirkt ohne Craft „unfertig“ | warm kippt ins Muddy; Serif nie in 13-px-Zeilen | Lesbarkeit über bewegtem Inhalt; Glassmorphism altert schnell; Vercel lehnt Glas ab |

**Empfehlung:** A als Fundament, mit zwei Elementen aus B (warmes Grau, Serif nur für Honorar- und KPI-Zahlen). C höchstens später als Experiment auf ⌘K und Panel.

## 6. Plan (nach Entscheidung)

1. **Welle 0 (Logik, ≤ 1 Tag):** unverändert aus `AUFGABEN_ANALYSE_2026-10-08.md` Abschnitt 8.
2. **Tokens (S):** `src/index.css` auf die Stufen oben; Inter 4 + Inter Display von rsms.me statt Google-Fonts-Kopie; `tabular-nums` global in Listen.
3. **Entkernen (S):** Score, Performance Intel, Session-Karte, Filter-Chips, Versal-Gruppentitel, Icons in Überschriften, Karten-Schatten, farbige Badges.
4. **Zeile + Panel (M):** eine Zeilen-Komponente (36 px, Punkt, Name 500, Job fg-2, Zeit/Betrag tabular rechts, Primäraktion als Text), Panel 520 px über der Liste; Segmented Control „Jetzt / Rest“; feste Gruppen; Briefing-Zeile aus Regeln.
5. **Seitenleiste (S):** dunkler als Inhalt, auf 6 Einträge, Rest über ⌘K; Zähler „heute dran“.
6. **Tastatur (S):** J/K/E/H, ⌘K mit cmdk, Kbd-Hinweise.
7. **Dashboard-Karte und Akte (S):** dieselbe Zeile, derselbe Panel-Deeplink.
8. **Später mit Rückkehr (S, nach Marks-Tabelle):** „Morgen / 3 Tage / wenn Kunde antwortet“.

## 7. Quellen (Auswahl)

Linear: linear.app/now/behind-the-latest-design-refresh · linear.app/changelog/2026-03-12-ui-refresh · linear.app/changelog/2026-09-03-priority-inbox · linear.app/docs/triage · linear.app/docs/triage-intelligence · Vercel: vercel.com/design.md · vercel.com/geist/font · shadcn: ui.shadcn.com/docs/changelog (Luma 03/2026, Sera 04/2026, Rhea 05/2026) · Apple: developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass · Stripe: docs.stripe.com/stripe-apps/design · docs.stripe.com/dashboard/basics · Superhuman: superhuman.com/ai · blog.superhuman.com/docs-new-visual-identity · Attio: attio.com/product/ai · attio.com/help/reference/attio-101/productivity/introduction-to-tasks · Notion: notion.com/releases/2022-07-20 · HubSpot: knowledge.hubspot.com/prospecting/use-the-prospecting-workspace · knowledge.hubspot.com/prospecting/use-the-prospecting-agent · Salesforce: salesforceben.com/salesforce-rebrands-sales-cloud-to-agentforce-sales-at-dreamforce-25 · Microsoft: learn.microsoft.com/en-us/dynamics365/sales/use-sales-qualification-agent · Google: blog.google (Gmail AI Inbox 01/2026) · NN/g: nngroup.com/articles/modal-nonmodal-dialog · nngroup.com/articles/ai-paradigm · WCAG: w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus · Material Dark: m2.material.io/design/color/dark-theme · Atlassian: atlassian.design/foundations/elevation · motion.dev/docs/react-accessibility · DSGVO Art. 22 / EuGH C-634/21.
