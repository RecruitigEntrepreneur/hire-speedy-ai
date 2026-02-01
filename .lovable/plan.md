# Plan: Interview-Dialoge auf neuen Wizard umstellen

## Status: ✅ ABGESCHLOSSEN

Alle Interview-Dialoge wurden erfolgreich auf den neuen `ProfessionalInterviewWizard` umgestellt.

### Durchgeführte Änderungen

| Datei | Änderung | Status |
|-------|----------|--------|
| `CandidateDetail.tsx` | Import + Dialog ersetzt | ✅ |
| `JobCommandCenter.tsx` | Import + Dialog ersetzt | ✅ |
| `TalentHub.tsx` | Ungenutzten Import entfernt | ✅ |

### Ergebnis

- Einheitlicher 4-Schritt-Wizard an ALLEN Stellen
- Konsistente Nutzererfahrung (Format → Termine → Nachricht → Vorschau)
- Triple-Blind korrekt umgesetzt überall

