

# Recruiter-Checkliste aus der JobQualityScoreCard entfernen

## Problem

Die "Recruiter-Checkliste" unten in der Job-Qualitaets-Karte ist redundant. Die Verbesserungsvorschlaege darueber zeigen bereits alles, was noch fehlt -- die Checkliste wiederholt das nur in anderer Form und nimmt unnoetig Platz weg. Ausserdem ist eine "Recruiter-Checkliste" im Client-Dashboard fehl am Platz.

## Aenderung

**`src/components/client/JobQualityScoreCard.tsx`**

- Den gesamten "Recruiter-Checkliste"-Block entfernen (ca. Zeilen 160-185): die `<div>` mit dem Titel "Recruiter-Checkliste" und die `.map()` ueber die Checklist-Items
- Die Imports `CheckCircle2` bleiben erhalten fuer den "Alle wichtigen Felder ausgefuellt"-Zustand

Das spart Platz und vermeidet Verwirrung. Die Verbesserungsvorschlaege oben bleiben als einzige Orientierung bestehen.

