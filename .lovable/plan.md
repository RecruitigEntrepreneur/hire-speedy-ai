
# Überarbeitetes Konzept: Kandidaten-Detailseite mit 2 Bereichen

## Zusammenfassung

Die Kandidaten-Detailseite wird professionalisiert durch:
1. **2-Tab-Navigation** (PROFIL / PROZESS) nach dem kompakten Header
2. **KI-Einschätzung bleibt** - optimal platziert im PROZESS-Tab neben dem Job-Matching
3. **Interview als Karten-Slider** - modernes UI statt langweiliges Accordion

---

## Gesamtlayout

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  [← Zurück]                                                             │
│                                                                         │
│  👤 Max Mustermann                                                      │
│  Senior Developer · Berlin · 5J · 75k€                                  │
│  [✅ Exposé-Ready] [📧] [📞] [🔗] [✏️]                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [✓ Neu] → [✓ Kontaktiert] → [ Interview ] → [ Angebot ] → [ ✓ ]   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║     [ 👤 PROFIL ]                    [ 📊 PROZESS ]               ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │                     AKTIVER TAB-INHALT                              ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════════│
│  [ 📄 Exposé ansehen ] [ 🎤 Interview starten ] [ 📤 Auf Job einreichen ]│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tab 1: PROFIL (Wer ist der Kandidat?)

Fokus auf statische Kandidaten-Informationen.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────┐  │
│  │ 📋 Eckdaten                     │  │ 📄 Dokumente                │  │
│  │                                 │  │                             │  │
│  │ CandidateKeyFactsCard           │  │ CandidateDocumentsManager   │  │
│  │ - Rolle, Seniority, Experience  │  │ - CV Versionen              │  │
│  │ - Gehalt, Verfügbarkeit         │  │ - Zertifikate               │  │
│  │ - Skills, Zertifikate           │  │ - Hochladen                 │  │
│  │ - Tags                          │  └─────────────────────────────┘  │
│  └─────────────────────────────────┘                                   │
│                                                                         │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────┐  │
│  │ 🎤 Interview-Erkenntnisse       │  │ 👥 Ähnliche Kandidaten      │  │
│  │                                 │  │                             │  │
│  │ QuickInterviewSummary           │  │ SimilarCandidates           │  │
│  │ - Wechselmotivation             │  │ - Max M. (87%)              │  │
│  │ - Karriereziel                  │  │ - Lisa S. (82%)             │  │
│  │ - Recruiter-Empfehlung          │  │                             │  │
│  │ [Vollständiges Interview]       │  └─────────────────────────────┘  │
│  └─────────────────────────────────┘                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Komponenten im PROFIL-Tab:**
- `CandidateKeyFactsCard` - Alle Eckdaten auf einen Blick
- `CandidateDocumentsManager` - CV und Dokumente
- `QuickInterviewSummary` - Zusammenfassung + Link zu Interview-Details
- `SimilarCandidates` - Vergleichbare Profile

---

## Tab 2: PROZESS (Was passiert mit dem Kandidaten?)

Fokus auf Workflow, Matching und Pipeline - hier passt die KI-Einschätzung optimal!

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ⚡ Offene Aufgaben                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🔴 Ghosting-Risiko! Kandidat seit 5 Tagen nicht erreicht            ││
│  │ 🟡 CV aktualisieren - Version 2 angefragt                           ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────────┐  ┌────────────────────────────┐  │
│  │ 🎯 Job-Matching                  │  │ ⭐ KI-EINSCHÄTZUNG        │  │
│  │                                  │  │                            │  │
│  │ CandidateJobMatchingV3           │  │ ClientCandidateSummaryCard │  │
│  │ - Hot Matches                    │  │ - Empfehlung: ✓ Ja         │  │
│  │ - Standard Matches               │  │ - Stärken (3)              │  │
│  │ - Einreichen-Funktion            │  │ - Risiken (1)              │  │
│  │                                  │  │ - Jobhopper: Stabil        │  │
│  └──────────────────────────────────┘  │ - Wechselmotivation        │  │
│                                        └────────────────────────────┘  │
│  ┌──────────────────────────────────┐  ┌────────────────────────────┐  │
│  │ 📋 Aktive Bewerbungen            │  │ 🕐 Letzte Aktivitäten     │  │
│  │                                  │  │                            │  │
│  │ CandidateJobsOverview            │  │ CandidateActivityTimeline  │  │
│  │ - Senior Dev @ TechCorp          │  │ - Anruf vor 2 Tagen        │  │
│  │ - Status: Interview              │  │ - Status geändert          │  │
│  │                                  │  │ - E-Mail gesendet          │  │
│  └──────────────────────────────────┘  └────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Warum KI-Einschätzung im PROZESS-Tab?**
- Direkt neben Job-Matching = Kontext für Einreichentscheidungen
- Stärken/Risiken informieren den Vermittlungsprozess
- Jobhopper-Analyse relevant für Kundenerwartungen
- Empfehlung beeinflusst Prozess-Entscheidungen

---

## Interview-Erfassung: Karten-Slider (Modal/Fullscreen)

Wenn "Interview starten" geklickt wird, öffnet sich ein modernes Karten-UI:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  [✕]                    Interview mit Max Mustermann                   │
│                                                                        │
│  ● ○ ○ ○  Karte 1 von 4: Karriereziele                                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                                                                    ││
│  │  🎯 Was wollen Sie ultimativ beruflich erreichen?                  ││
│  │  ┌────────────────────────────────────────────────────────────────┐││
│  │  │                                                                │││
│  │  │  [Großes Textfeld - volle Aufmerksamkeit auf diese Frage]     │││
│  │  │                                                                │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  🎯 Wo sehen Sie sich in 3-5 Jahren?                              ││
│  │  ┌────────────────────────────────────────────────────────────────┐││
│  │  │  [Textfeld]                                                    │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│              [← Zurück]                         [Weiter →]             │
│                                                                        │
│  Tastatur: ← → zum Navigieren | Strg+S zum Speichern                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Die 4 Interview-Karten:**

| # | Karte | Felder |
|---|-------|--------|
| 1 | **Karriereziele** | Ultimate Goal, 3-5 Jahre Plan, Was funktioniert/nicht |
| 2 | **Situation & Motivation** | Aktuelle Situation, Wechselgründe, Motivation-Tags |
| 3 | **Gehalt & Konditionen** | Aktuell, Wunsch, Minimum, 3 Must-Haves |
| 4 | **Verfügbarkeit & Abschluss** | Kündigungsfrist, Start, Empfehlung, Notizen |

**Features:**
- Tastatur-Navigation (← → Pfeiltasten)
- Auto-Save bei Kartenwechsel
- Progress-Dots oben
- Große, fokussierte Eingabefelder
- Fullscreen-Modus für ungestörtes Arbeiten

---

## Sticky Action Bar

Immer sichtbar am unteren Rand:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  [📄 Exposé ansehen]   [🎤 Interview starten]   [📤 Auf Job einreichen] │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Exposé ansehen** - Öffnet Expose-Preview Modal
- **Interview starten** - Öffnet Karten-Slider
- **Auf Job einreichen** - Quick-Submit zu Top-Match

---

## Technische Umsetzung

### Dateien die geändert werden

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `RecruiterCandidateDetail.tsx` | **Umstrukturieren** | Tab-Navigation hinzufügen, 2-Spalten-Layout pro Tab |
| `CandidateProfileTab.tsx` | **NEU** | Container für PROFIL-Tab |
| `CandidateProcessTab.tsx` | **NEU** | Container für PROZESS-Tab (inkl. KI-Einschätzung) |
| `InterviewCardSlider.tsx` | **NEU** | Karten-basiertes Interview-UI |
| `CandidateActionBar.tsx` | **NEU** | Sticky Action Bar unten |

### Wiederverwendete Komponenten (keine Änderung nötig)

- `CandidateStagePipeline` - Header
- `CandidateKeyFactsCard` - PROFIL-Tab
- `CandidateDocumentsManager` - PROFIL-Tab
- `QuickInterviewSummary` - PROFIL-Tab
- `SimilarCandidates` - PROFIL-Tab
- `CandidateTasksSection` - PROZESS-Tab
- `CandidateJobMatchingV3` - PROZESS-Tab
- `ClientCandidateSummaryCard` - **PROZESS-Tab** (optimal platziert!)
- `CandidateJobsOverview` - PROZESS-Tab
- `CandidateActivityTimeline` - PROZESS-Tab
- `CandidatePlaybookPanel` - Bleibt kontextabhängig (URL-Parameter)

### URL-Persistenz

```typescript
// Tab-Status wird in URL gespeichert
const [tab, setTab] = useState(searchParams.get('tab') || 'profile');

// Beim Tab-Wechsel URL aktualisieren
const handleTabChange = (newTab: string) => {
  setTab(newTab);
  setSearchParams({ ...Object.fromEntries(searchParams), tab: newTab });
};

// URLs:
// /recruiter/candidates/:id?tab=profile
// /recruiter/candidates/:id?tab=process
```

### Keyboard Shortcuts

| Taste | Aktion |
|-------|--------|
| `1` oder `P` | Zu PROFIL-Tab wechseln |
| `2` oder `R` | Zu PROZESS-Tab wechseln |
| `←` / `→` | Interview-Karten navigieren |
| `Escape` | Interview-Slider schließen |

---

## Vergleich: Vorher vs. Nachher

| Aspekt | VORHER | NACHHER |
|--------|--------|---------|
| **Layout** | Alles auf einer langen Scroll-Seite | 2 fokussierte Tabs |
| **KI-Einschätzung** | Mitte der linken Spalte, verloren | PROZESS-Tab neben Matching |
| **Interview** | Accordion versteckt in Sidebar | Modernes Karten-Slider Modal |
| **Navigation** | Scrollen, scrollen, scrollen | Tab-Klick + Keyboard |
| **Aktionen** | Verstreut im Header | Sticky Bar unten, immer sichtbar |
| **Fokus** | Alles gleich wichtig | Profil ODER Prozess |

---

## Implementierungsreihenfolge

### Phase 1: Tab-Struktur (Priorität: Hoch)
1. `CandidateProfileTab.tsx` erstellen
2. `CandidateProcessTab.tsx` erstellen (mit KI-Einschätzung!)
3. `RecruiterCandidateDetail.tsx` umstrukturieren

### Phase 2: Interview-Slider (Priorität: Hoch)
4. `InterviewCardSlider.tsx` erstellen
5. Integration in PROFIL-Tab (Button öffnet Slider)

### Phase 3: Action Bar (Priorität: Mittel)
6. `CandidateActionBar.tsx` erstellen
7. Sticky Positionierung am unteren Rand

### Phase 4: Polishing (Priorität: Niedrig)
8. URL-Persistenz für Tab-Status
9. Keyboard Navigation
10. Animationen für Tab-Wechsel

---

## Zusammenfassung der Entscheidungen

| Entscheidung | Wert |
|--------------|------|
| KI-Einschätzung | **BLEIBT** - im PROZESS-Tab neben Matching |
| Interview-UI | Karten-Slider statt Accordion |
| Tab-Struktur | PROFIL (statisch) vs. PROZESS (dynamisch) |
| Action Bar | Sticky unten, 3 Hauptaktionen |
| Keyboard | Volle Navigation-Unterstützung |
