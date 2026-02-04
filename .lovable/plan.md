# Fix: Matching für unvollständige Kandidatenprofile

## ✅ IMPLEMENTIERT

Die folgenden Änderungen wurden erfolgreich in `supabase/functions/calculate-match-v3-1/index.ts` implementiert:

### 1. Neue Funktion `isProfileMinimallyComplete()`
Prüft ob ein Kandidatenprofil minimal auswertbar ist:
- Mindestens 1 Skill ODER
- Job-Titel + Erfahrungsjahre > 0

### 2. Profil-Vollständigkeits-Gate in `calculateMatch()`
Vor allen anderen Checks wird das Profil geprüft. Bei unvollständigem Profil:
- `policy: 'hidden'`
- `overall: 0`
- `excluded: true`
- `whyNot: "Profil unvollständig: Skills, Erfahrung, Gehalt fehlen"`

### 3. Coverage-/Score-Berechnung korrigiert
- `mustHaveCoverage = 0` wenn Kandidat keine Skills hat (statt 1.0)
- `overallScore = 0` wenn keine Weights und keine Skills (statt 50)

## Erwartetes Verhalten

| Profil | Vorher | Nachher |
|--------|--------|---------|
| 0% vollständig | 12 Matches mit "70?" | 0 sichtbare Matches, alle `hidden` |
| Nur Skills | Matches basierend auf Skills | Unverändert |
| Skills + Gehalt + Verfügbarkeit | Volles Matching | Unverändert |
