

# Fix: Matching für unvollständige Kandidatenprofile

## Problem-Analyse

Ein Kandidat mit 0% Profilvollständigkeit (keine Skills, keine Erfahrung, kein Gehalt, etc.) zeigt **12 Matches mit "70?" Score** anstatt ausgeschlossen zu werden.

### Ursache im Code

| Stelle | Problem |
|--------|---------|
| `mustHaveCoverage` Berechnung (Zeile 1162) | Wenn `mustHaveWeight === 0`, wird Coverage auf `1.0` (100%) gesetzt |
| `overallScore` Fallback (Zeile 1163) | Wenn `totalWeight === 0`, wird Score auf `50` gesetzt |
| Experience/Seniority Scores | Geben Default-Werte (50-70) bei fehlenden Daten zurück |
| Policy-Schwellen | `maybe` braucht nur `minScore: 45` und `minCoverage: 0.40` |

### Aktueller Ablauf bei leerem Profil

```text
Kandidat: skills=[], experience_years=null, expected_salary=null

→ candidateSkills = []
→ Keine Skills matchen
→ mustHaveWeight = (Anzahl Job Must-Haves)
→ mustHaveCredit = 0 (keine Matches)
→ mustHaveCoverage = 0/mustHaveWeight = 0%  ← SOLLTE ausschließen

ABER: Wenn Job AUCH keine Must-Haves hat:
→ mustHaveWeight = 0
→ mustHaveCoverage = 1.0 (100%!)  ← BUG!

Experience Score: null → Default 50
Seniority Score: null → Default 50
Constraints: Default 100

→ Gesamt-Score: ~50-70
→ Policy: "maybe" (weil Score >= 45 und Coverage >= 0.40)
```

---

## Lösungskonzept

### Option A: Profil-Vollständigkeits-Gate (Empfohlen)

Bevor das Matching überhaupt startet, prüfen ob das Profil minimal vollständig ist.

**Kriterien für "minimales Profil":**
- Mindestens 1 Skill ODER
- Job-Titel gesetzt ODER
- Erfahrungsjahre > 0

Falls nicht erfüllt: Alle Jobs als `hidden` mit `whyNot: "Profil unvollständig"` markieren.

### Option B: Coverage-Default anpassen

Wenn `candidateSkills.length === 0`:
- `mustHaveCoverage = 0` statt `1.0`
- Dies würde alle Jobs ausschließen

### Option C: Kombinierte Lösung (Empfohlen)

1. **Frühe Profil-Prüfung** im `calculateMatch`:
   - Prüfe auf minimale Profil-Daten
   - Wenn leer: return `hidden` Policy mit klarer Erklärung

2. **Coverage-Berechnung korrigieren**:
   - `mustHaveCoverage = 0` wenn Kandidat keine Skills hat UND Job welche fordert
   - `score = 0` wenn Kandidat keinerlei relevante Daten hat

3. **Explainability verbessern**:
   - `whyNot: "Profil unvollständig - keine Skills, Erfahrung oder Gehalt angegeben"`

---

## Technische Umsetzung

### Datei: `supabase/functions/calculate-match-v3-1/index.ts`

#### 1. Neue Hilfsfunktion: Profil-Vollständigkeits-Check

```typescript
function isProfileMinimallyComplete(candidate: any): {
  complete: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];
  
  const hasSkills = Array.isArray(candidate.skills) && candidate.skills.length > 0;
  const hasExperience = typeof candidate.experience_years === 'number' && candidate.experience_years > 0;
  const hasJobTitle = !!candidate.job_title?.trim();
  const hasSalary = candidate.expected_salary > 0 || candidate.salary_expectation_min > 0;
  
  if (!hasSkills) missing.push('Skills');
  if (!hasExperience) missing.push('Erfahrung');
  if (!hasSalary) missing.push('Gehalt');
  
  // Minimal: mindestens Skills ODER (JobTitle + Experience)
  const complete = hasSkills || (hasJobTitle && hasExperience);
  
  return { complete, missingFields: missing };
}
```

#### 2. Änderung in `calculateMatch` (nach Zeile 754)

```typescript
function calculateMatch(...): V31MatchResult {
  const jobId = job.id;

  // NEUER CHECK: Profil-Vollständigkeit
  const profileCheck = isProfileMinimallyComplete(candidate);
  if (!profileCheck.complete) {
    return {
      version: 'v3.1',
      jobId,
      overall: 0,
      killed: false,
      excluded: true,
      mustHaveCoverage: 0,
      gateMultiplier: 0,
      policy: 'hidden',
      gates: {
        hardKills: { visa: false, language: false, onsite: false, license: false, techDomain: false },
        dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1, techDomain: 1 },
        multiplier: 0
      },
      fit: {
        score: 0,
        breakdown: { skills: 0, experience: 0, seniority: 0, industry: 0 },
        details: { skills: { matched: [], transferable: [], missing: [], mustHaveMissing: [] } }
      },
      constraints: {
        score: 0,
        breakdown: { salary: 0, commute: 0, startDate: 0 }
      },
      explainability: {
        topReasons: [],
        topRisks: ['Profil nicht auswertbar'],
        whyNot: `Profil unvollständig: ${profileCheck.missingFields.join(', ')} fehlen`,
        nextAction: 'Profil vervollständigen',
        enhancedReasons: [],
        enhancedRisks: [{
          text: 'Keine auswertbaren Profildaten',
          severity: 'critical',
          mitigatable: true,
          mitigation: 'Skills und Erfahrung ergänzen',
          category: 'skills'
        }],
        recruiterAction: {
          recommendation: 'skip',
          priority: 'low',
          nextSteps: ['Profil vervollständigen']
        }
      }
    };
  }

  // Rest der Funktion bleibt unverändert...
}
```

#### 3. Skill-Score-Berechnung korrigieren (Zeile 1162-1163)

```typescript
// VORHER:
const mustHaveCoverage = mustHaveWeight > 0 ? mustHaveCredit / mustHaveWeight : 1.0;
const overallScore = totalWeight > 0 ? (totalCredit / totalWeight) * 100 : 50;

// NACHHER:
// Wenn Kandidat keine Skills hat UND Job welche fordert: Coverage = 0
const mustHaveCoverage = mustHaveWeight > 0 
  ? mustHaveCredit / mustHaveWeight 
  : (candidateSkills.length === 0 ? 0 : 1.0);

// Wenn keine Weights: Score basiert auf Kandidat-Skills-Existenz
const overallScore = totalWeight > 0 
  ? (totalCredit / totalWeight) * 100 
  : (candidateSkills.length > 0 ? 50 : 0);
```

---

## Erwartetes Verhalten nach Fix

### Kandidat mit 0% Profil

```text
Vorher:
- 12 Matches mit "70?" Score
- Policy: "maybe" für alle Jobs
- UI zeigt alle Jobs als "Weitere Optionen"

Nachher:
- 0 sichtbare Matches
- Policy: "hidden" für alle Jobs
- whyNot: "Profil unvollständig: Skills, Erfahrung, Gehalt fehlen"
- UI zeigt: "Keine passenden Jobs - Profil vervollständigen"
```

### Kandidat mit teilweisem Profil (z.B. nur Skills)

```text
- Matching läuft normal
- Matches basieren auf vorhandenen Skills
- Fehlende Felder (Gehalt, Verfügbarkeit) beeinflussen Constraint-Score
```

---

## UI-Auswirkungen

Die UI (`CandidateJobMatchingV3.tsx`) zeigt bereits korrekt:
- "Profil unvollständig" Warnung (Zeile 322-335)
- `readiness.isReady` Check blockiert Einreichungen

**Keine UI-Änderungen nötig** - die Änderung ist rein Backend-seitig.

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `supabase/functions/calculate-match-v3-1/index.ts` | 1. Neue Funktion `isProfileMinimallyComplete()` hinzufügen |
| | 2. Profil-Check am Anfang von `calculateMatch()` |
| | 3. Coverage-/Score-Berechnung bei leeren Skills korrigieren |

