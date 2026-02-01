

# Plan: Alle Interview-Dialoge auf den neuen Wizard umstellen

## Problem

Der neue **ProfessionalInterviewWizard** (4-Schritt-Wizard mit Format, Termine, Nachricht, Vorschau) wurde nur in `CandidateActionCard.tsx` eingebaut. An anderen Stellen werden noch die alten Dialoge verwendet:

| Datei | Aktuell | Sollte sein |
|-------|---------|-------------|
| `CandidateDetail.tsx` | `InterviewRequestWithOptInDialog` | `ProfessionalInterviewWizard` |
| `JobCommandCenter.tsx` | `InterviewRequestWithOptInDialog` | `ProfessionalInterviewWizard` |
| `TalentHub.tsx` | `InterviewSchedulingDialog` | `ProfessionalInterviewWizard` |
| `CandidateActionCard.tsx` | `ProfessionalInterviewWizard` ✅ | - |

---

## Änderungen

### 1. CandidateDetail.tsx

**Import ändern (Zeile 53):**
```typescript
// VORHER:
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';

// NACHHER:
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
```

**Dialog ersetzen (Zeilen 1041-1052):**
```typescript
// VORHER:
<InterviewRequestWithOptInDialog
  open={showInterviewDialog}
  onOpenChange={setShowInterviewDialog}
  submissionId={submissionId}
  candidateAnonymousId={displayName}
  jobTitle={jobTitle}
  jobIndustry={jobIndustry}
  onSuccess={() => {
    setShowInterviewDialog(false);
    refetch();
  }}
/>

// NACHHER:
<ProfessionalInterviewWizard
  open={showInterviewDialog}
  onOpenChange={setShowInterviewDialog}
  submissionId={submissionId}
  candidateAnonymousId={displayName}
  jobTitle={jobTitle}
  onSuccess={() => {
    setShowInterviewDialog(false);
    refetch();
  }}
/>
```

### 2. JobCommandCenter.tsx

**Import ändern (Zeile 32):**
```typescript
// VORHER:
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';

// NACHHER:
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
```

**Dialog ersetzen (Zeilen 235-247):**
```typescript
// VORHER:
<InterviewRequestWithOptInDialog ... />

// NACHHER:
<ProfessionalInterviewWizard ... />
```

### 3. TalentHub.tsx

**Import ändern (Zeile 23):**
```typescript
// VORHER:
import { InterviewSchedulingDialog } from '@/components/talent/InterviewSchedulingDialog';

// NACHHER:
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
```

**Dialog ersetzen** (falls dort direkt verwendet):
Prüfen ob `InterviewSchedulingDialog` dort direkt gerendert wird und durch `ProfessionalInterviewWizard` ersetzen.

---

## Erwartetes Ergebnis

Nach der Änderung:
- Einheitlicher 4-Schritt-Wizard an ALLEN Stellen
- Konsistente Nutzererfahrung (Format → Termine → Nachricht → Vorschau)
- Triple-Blind korrekt umgesetzt überall

---

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/pages/dashboard/CandidateDetail.tsx` | Import + Dialog austauschen |
| `src/pages/dashboard/JobCommandCenter.tsx` | Import + Dialog austauschen |
| `src/pages/dashboard/TalentHub.tsx` | Import + Dialog austauschen (falls genutzt) |

