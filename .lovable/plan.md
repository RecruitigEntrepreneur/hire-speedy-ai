
# Plan: Interview-Karten-Slider mit vollständigem Gesprächsleitfaden und Coaching-Playbook

## Zusammenfassung

Das aktuelle Interview-UI hat zwei Probleme:
1. Der Klick auf "Interview jetzt starten" in der `QuickInterviewSummary` ruft noch das alte Accordion-Format auf
2. Der neue `InterviewCardSlider` ist unvollständig - es fehlen Fragen und der Gesprächsleitfaden

Der Plan ist, den `InterviewCardSlider` zu vervollständigen und ihn korrekt zu verknüpfen.

---

## Aktueller Zustand

| Komponente | Status |
|------------|--------|
| `InterviewCardSlider.tsx` | Existiert, aber unvollständig - nur 4 Karten, kein Skript, keine Follow-up-Fragen |
| `QuickInterviewSummary.tsx` | Ruft `onViewDetails` auf (führt zum alten Interview-Tab) |
| `CandidateProfileTab.tsx` | Leitet `onViewFullInterview` weiter |
| `RecruiterCandidateDetail.tsx` | Öffnet entweder `showFullInterview` (altes Format) ODER `interviewSliderOpen` (neues Format) |

---

## Geplante Änderungen

### 1. InterviewCardSlider.tsx - Erweitern

**5 Karten statt 4** (mit allen Fragen aus dem Original):

| # | Karte | Inhalte |
|---|-------|---------|
| 0 | **Gesprächsleitfaden** | Begrüßungstext, Coaching-Playbook (optional) |
| 1 | **Karriereziele** | Ultimate Goal, 3-5 Jahre, Was unternommen?, Was funktioniert/nicht |
| 2 | **Situation & Motivation** | Positiv, Negativ, Motivation, Tags, Follow-ups (Vorfall, Häufigkeit, Würde bleiben?, Warum jetzt?, Frühere Prozesse, Intern angesprochen?) |
| 3 | **Gehalt & Konditionen** | Aktuell, Wunsch, Minimum, 3 Must-Haves für Angebot |
| 4 | **Verfügbarkeit & Abschluss** | Kündigungsfrist, Start, Empfehlung, Abschluss-Text, Notizen, Zusammenfassung für Kunden |

**Neue Features:**
- Gesprächsleitfaden mit dynamischen Platzhaltern (Kandidatenname, Recruiter-Name, Firma)
- Integration des `CandidatePlaybookPanel` als collapsible Sidebar
- Alle Felder aus `useInterviewNotes` Hook abgedeckt
- Zusammenfassung für Kunden am Ende

### 2. RecruiterCandidateDetail.tsx - Korrigieren

Aktuell gibt es zwei parallele Flows:
- `showFullInterview` → altes `CandidateInterviewTab`
- `interviewSliderOpen` → neuer `InterviewCardSlider`

**Änderung:** 
- `onViewFullInterview` soll den neuen Slider öffnen, nicht das alte Format
- Das alte Format (`showFullInterview`) bleibt als Fallback für detaillierte Ansicht

### 3. Felder die im Slider fehlen (müssen hinzugefügt werden)

Aus dem Hook `useInterviewNotes`:

**Karriereziele (fehlt):**
- `career_actions_taken` - "Was haben Sie bisher unternommen?"

**Situation (fehlen):**
- `specific_incident` - "Ist da etwas Spezifisches vorgefallen?"
- `frequency_of_issues` - "Wie oft kommt das vor?"
- `would_stay_if_matched` - "Würden Sie bleiben, wenn Ihr Arbeitgeber das Angebot matcht?"
- `why_now` - "Warum jetzt — und nicht letztes Jahr?"
- `previous_process_issues` - "Woran ist es bei früheren Bewerbungsprozessen gescheitert?"
- `discussed_internally` - "Haben Sie dies intern angesprochen?"

**Abschluss (fehlen):**
- `summary_motivation` - Zusammenfassung Motivation
- `summary_salary` - Zusammenfassung Gehalt
- `summary_notice` - Zusammenfassung Kündigungsfrist
- `summary_key_requirements` - Key Requirements
- `summary_cultural_fit` - Cultural Fit

---

## Detaillierte Änderungen

### Datei 1: `src/components/candidates/InterviewCardSlider.tsx`

**Erweitern mit:**

1. **Neue Props:**
   - `candidateData` für dynamische Platzhalter (Name, Firma)
   - Optional: `playbook: CoachingPlaybook | null` für Coaching-Integration

2. **5 Slides statt 4:**

```typescript
const SLIDES = [
  { id: 'guide', title: 'Gesprächsleitfaden', icon: MessageSquare },
  { id: 'career', title: 'Karriereziele', icon: Target },
  { id: 'motivation', title: 'Situation & Motivation', icon: TrendingUp },
  { id: 'salary', title: 'Gehalt & Konditionen', icon: Euro },
  { id: 'closing', title: 'Abschluss & Zusammenfassung', icon: CheckCircle2 },
] as const;
```

3. **Slide 0 (Gesprächsleitfaden):**
   - Begrüßungstext mit Platzhaltern
   - Collapsible Coaching-Playbook Panel (wenn vorhanden)
   - Quick-Checklist
   - Talking Points

4. **Slide 1 (Karriereziele) - Erweitern:**
   - Hinzufügen: "Was haben Sie bisher unternommen?" (`career_actions_taken`)

5. **Slide 2 (Situation) - Erweitern:**
   - Collapsible "Weiterführende Fragen" Bereich mit:
     - Spezifischer Vorfall
     - Häufigkeit
     - Würde bleiben wenn gematcht?
     - Warum jetzt?
     - Frühere Prozess-Probleme
     - Intern angesprochen?

6. **Slide 4 (Abschluss) - Erweitern:**
   - Abschluss-Skript anzeigen
   - Zusammenfassung für Kunden (collapsible):
     - Summary Motivation
     - Summary Gehalt
     - Summary Kündigungsfrist
     - Key Requirements
     - Cultural Fit

### Datei 2: `src/pages/recruiter/RecruiterCandidateDetail.tsx`

**Änderungen:**

1. Interview-Playbook laden:
```typescript
// Lade ein Interview-spezifisches Playbook wenn vorhanden
const { playbook: interviewPlaybook } = useCoachingPlaybook('interview_qualification');
```

2. `onViewFullInterview` ändern:
```typescript
// ALT:
const onViewFullInterview = () => setShowFullInterview(true);

// NEU:
const onViewFullInterview = () => setInterviewSliderOpen(true);
```

3. Playbook an Slider übergeben:
```typescript
<InterviewCardSlider
  open={interviewSliderOpen}
  onOpenChange={setInterviewSliderOpen}
  candidateId={candidate.id}
  candidateName={candidate.full_name}
  candidateData={{
    job_title: candidate.job_title,
  }}
  playbook={interviewPlaybook}
/>
```

---

## UI-Mockup: Neuer Gesprächsleitfaden-Slide

```text
┌────────────────────────────────────────────────────────────────────────┐
│  [✕]                    Interview mit Max Mustermann                   │
│                                                                        │
│  ● ○ ○ ○ ○  Karte 1 von 5: Gesprächsleitfaden                         │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                                                                    ││
│  │  💬 Begrüßung                                                      ││
│  │  ┌────────────────────────────────────────────────────────────────┐││
│  │  │ „Hallo Herr Mustermann, ich bin [Recruiter] von [Firma].       │││
│  │  │  Wie geht es Ihnen heute?"                                     │││
│  │  │                                                                │││
│  │  │ „Bitte erlauben Sie, dass ich mich kurz vorstelle..."          │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  ┌────────────────────────────────────────────────────────────────┐││
│  │  │ 📘 Coaching-Playbook                            [Einblenden ▼] │││
│  │  │                                                                │││
│  │  │ ✅ Quick-Checklist:                                            │││
│  │  │ ☐ Profil vor dem Gespräch geprüft                             │││
│  │  │ ☐ LinkedIn-Profil angeschaut                                  │││
│  │  │ ☐ CV gelesen                                                  │││
│  │  │                                                                │││
│  │  │ 💡 Talking Points:                                             │││
│  │  │ • Auf aktuelle Projekte eingehen                              │││
│  │  │ • Wechselmotivation vertiefen                                 │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│                                                    [Weiter →]          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## UI-Mockup: Erweiterter Situation-Slide

```text
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  📈 Situation & Motivation                                             │
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │ 👍 Was läuft gut?       │  │ 👎 Was stört Sie?       │              │
│  │ [Textarea]              │  │ [Textarea]              │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
│                                                                        │
│  ❓ Woher kommt Ihre Wechselmotivation konkret?                        │
│  [Textarea]                                                            │
│                                                                        │
│  🏷️ Motivations-Tags                                                   │
│  [Gehalt] [Karriere] [Work-Life-Balance] [Führung] ...                 │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ [▼ Weiterführende Fragen einblenden]                               ││
│  │                                                                    ││
│  │ • Ist da etwas Spezifisches vorgefallen?  [Textarea]              ││
│  │ • Wie oft kommt das vor?  [Textarea]                              ││
│  │ • Würden Sie bleiben wenn gematcht?  [Switch]                     ││
│  │ • Warum jetzt — nicht letztes Jahr?  [Textarea]                   ││
│  │ • Frühere Prozess-Probleme?  [Textarea]                           ││
│  │ • Intern angesprochen?  [Textarea]                                ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/candidates/InterviewCardSlider.tsx` | Erweitern: 5 Slides, alle Felder, Gesprächsleitfaden, Playbook-Integration |
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | Interview-Playbook laden, Slider korrekt verknüpfen |

---

## Beibehaltene Original-Fragen (exakter Wortlaut)

Alle Fragen aus `CandidateInterviewTab.tsx` werden übernommen:

**Karriereziele:**
- "Was wollen Sie ultimativ beruflich erreichen?"
- "Was wünschen Sie sich für die nächsten 3–5 Jahre?"
- "Was haben Sie bisher unternommen, um dieses Ziel zu erreichen?"
- "Was hat gut funktioniert?" / "Was hat weniger gut funktioniert?"

**Situation & Motivation:**
- "Was gefällt Ihnen an Ihrer aktuellen Situation besonders gut?"
- "Was gefällt Ihnen weniger? Was stört Sie?"
- "Woher kommt Ihre Wechselmotivation konkret?"
- "Ist da etwas Spezifisches vorgefallen?"
- "Wie oft kommt das vor?"
- "Würden Sie bleiben, wenn Ihr Arbeitgeber das Angebot matcht?"
- "Warum jetzt — und nicht letztes Jahr?"
- "Woran ist es bei früheren Bewerbungsprozessen gescheitert?"
- "Haben Sie dies intern angesprochen? Wie wurde es aufgenommen?"

**Gehalt:**
- "Wo liegen Sie aktuell?"
- "Wo möchten Sie gerne hin?"
- "Was ist Ihre Schmerzgrenze?"
- "Welche 3 Punkte müsste ein Angebot erfüllen, damit Sie es annehmen?"

**Vertragsrahmen & Abschluss:**
- Kündigungsfrist
- Frühester Starttermin
- Empfehlung auf LinkedIn/Google?
- Notizen zum Abschluss

**Zusammenfassung für Kunden:**
- Wechselmotivation
- Gehaltsrahmen
- Kündigungsfrist
- Key Requirements
- Cultural Fit

---

## Gesprächsleitfaden-Text (Original, wird übernommen)

```text
Begrüßung:
„Hallo [Anrede] [Nachname], ich bin [Recruiter-Name] von [Firma]. Wie geht es Ihnen heute?"

„Bitte erlauben Sie, dass ich mich kurz vorstelle: Ich bin [Recruiter-Name], [Recruiter-Rolle] bei [Firma]. In den letzten 6 Jahren habe ich über 400 Menschen erfolgreich vermittelt."

„Ich sage immer: Es gibt weder den perfekten Bewerber noch das perfekte Unternehmen, sondern nur Menschen mit eigenen Werten und Zielen. Und nur wenn diese im Einklang sind, entsteht eine langfristige Zusammenarbeit."

„Um herauszufinden, ob die Werte und Ziele meines Kunden mit Ihren im Einklang stehen, müsste ich Ihnen ein paar Fragen stellen. Ist das für Sie in Ordnung?"

„Super — bevor ich starte, haben Sie vorab Fragen an mich?"
```

```text
Abschluss:
„Basierend auf dem, was Sie mir erzählt haben, passen Sie hervorragend auf die Position. Die nächsten Schritte sind sehr einfach: Ich leite Ihr Profil anonymisiert weiter und melde mich, sobald wir Feedback haben."
```
