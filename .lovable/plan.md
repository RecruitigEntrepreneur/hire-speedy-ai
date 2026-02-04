
# Redesign: Recruiter Kandidaten-Detailseite

## Analyse der aktuellen Probleme

### 1. Stage Pipeline (Punkte oben)
Die `CandidateStagePipeline` zeigt winzige Punkte (2x2 Pixel) mit Tooltips - das ist:
- Schwer zu erkennen und zu bedienen
- Visuell nicht ansprechend
- Passt nicht zum modernen Design der restlichen App

### 2. KI-Einschätzung (`ClientCandidateSummaryCard`)
Aktuelle Darstellung:
- Collapsible-Sektionen für Risiken/Stärken sind versteckt
- Executive Summary in grauem Box ist langweilig
- Recommendation Badge ist klein und unauffällig
- Viel Text, wenig visuelle Hierarchie

### 3. Allgemeines Layout
- Hero-Header ist zu komplex mit vielen Badges
- Zu viele Informationen auf einen Blick
- Keine klare visuelle Trennung zwischen Bereichen

---

## Vorgeschlagene Verbesserungen

### 1. Neue Stage Pipeline
Ersetze die kleinen Punkte durch eine horizontale Stepper-Leiste:

| NEU → KONTAKTIERT → INTERVIEW → ANGEBOT → PLATZIERT |

- Größere Schritte (horizontale Segmente)
- Farbcodiert (grün für abgeschlossen, primär für aktuell)
- Direkt klickbar ohne Tooltip
- Am oberen Rand der Karte prominent platziert

### 2. KI-Einschätzung Redesign
Neue, visuell ansprechendere Darstellung:

```text
┌────────────────────────────────────────────────────┐
│  ⭐ KI-EINSCHÄTZUNG                                │
├────────────────────────────────────────────────────┤
│  ┌──────────────────┐                              │
│  │   👍 EMPFOHLEN   │  ← Großes Recommendation    │
│  │   Starke Passung │     Badge mit Gradient      │
│  └──────────────────┘                              │
│                                                    │
│  "Der Kandidat bringt ausgezeichnete..."          │
│  ← Executive Summary prominent                    │
│                                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │ Stabil  │ │ 5 Jahre │ │ Remote  │ ← Key Tags  │
│  │ Ø 2.5J  │ │ Erfahrg │ │ OK      │              │
│  └─────────┘ └─────────┘ └─────────┘              │
│                                                    │
│  ✓ Stärken (3)                  ⚠ Risiken (2)    │
│  • Technische Expertise         • Gehalts-Gap     │
│  • Branchenkenntnisse          • Kündigungsfrist  │
│  • Teamführung                                    │
└────────────────────────────────────────────────────┘
```

Merkmale:
- Großes, farbiges Empfehlungs-Banner
- Zweispalten-Layout für Stärken/Risiken (immer sichtbar, keine Collapsibles)
- Visuell unterscheidbare Bereiche
- Jobhopper-Badge und andere Key-Insights als Chips

### 3. Überarbeiteter Hero-Header
Vereinfachtes Layout:
- Avatar größer und prominenter
- Stage Pipeline als horizontale Leiste unter dem Namen
- Quick Actions zusammengefasst
- Active Submissions kompakter dargestellt

---

## Technische Umsetzung

### Datei 1: `src/components/candidates/CandidateStagePipeline.tsx`
Kompletter Rewrite zu horizontalem Stepper:
- 5 Stufen als verbundene Segmente
- Aktive Stufe hervorgehoben
- Hover-Effekt mit Label
- Transition-Animationen

### Datei 2: `src/components/candidates/ClientCandidateSummaryCard.tsx`
Redesign der gesamten Komponente:
- Neues Header-Layout mit prominentem Recommendation Badge
- Grid-Layout für Stärken/Risiken (nebeneinander statt Collapsibles)
- Bessere visuelle Hierarchie
- Farbcodierung basierend auf Empfehlung
- Kompaktere Key-Selling-Points als Chips

### Datei 3: `src/pages/recruiter/RecruiterCandidateDetail.tsx`
Anpassungen am Hero-Header:
- Stage Pipeline Positionierung überarbeiten
- Badges-Row vereinfachen
- Mehr Whitespace für bessere Lesbarkeit

---

## Visual Preview: Vorher → Nachher

### Stage Pipeline
```text
VORHER:  ●  ●  ◐  ○  ○  Kontaktiert
         (winzige Punkte, schwer erkennbar)

NACHHER: [✓ Neu] → [✓ Kontaktiert] → [ Interview ] → [ Angebot ] → [ Platziert ]
         (klare Segmente, gut sichtbar)
```

### KI-Einschätzung Header
```text
VORHER:  ⭐ KI-Einschätzung    [Empfehlung]  ← Klein, unauffällig

NACHHER: ┌────────────────────────────────────────────────┐
         │  ⭐ KI-EINSCHÄTZUNG                            │
         │  ┌─────────────────────────────────────┐       │
         │  │  👍 EMPFOHLEN                       │       │
         │  │  Starke technische Passung          │       │
         │  └─────────────────────────────────────┘       │
         └────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Änderungen

| Komponente | Änderung |
|------------|----------|
| `CandidateStagePipeline` | Punkte → Horizontaler Stepper mit Labels |
| `ClientCandidateSummaryCard` | Collapsibles → Zweispalten-Grid, größeres Banner |
| `RecruiterCandidateDetail` | Hero vereinfachen, Pipeline prominent platzieren |

