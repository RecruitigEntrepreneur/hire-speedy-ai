

## Plan: Deploy Git-Aenderungen + Build-Error fixen

### 1. Migration deployen

Die Datei `supabase/migrations/20260307000000_fit_assessment_auto_trigger.sql` existiert bereits im Repo. Sie wird per Migration-Tool ausgefuehrt:
- Erstellt `trigger_generate_fit_assessment()` Function (pg_net HTTP POST)
- Erstellt `trg_generate_fit_assessment` AFTER INSERT Trigger auf `submissions`

### 2. Edge Function redeployen

Die aktuelle `assess-candidate-fit/index.ts` hat bereits die pg_net-Kompatibilitaet (Service Role Key Erkennung in Zeile 355-367). Keine Aenderung noetig, nur Redeploy.

### 3. Build-Error fixen

Der Fehler in `CandidateSubmitForm.tsx` Zeile 165: `cv_ai_bullets` kommt als `Json` (kann `string` sein) aus der DB, aber das Interface erwartet `unknown[]`.

**Fix**: In der `ExistingCandidate` Interface Zeile 56 den Typ von `cv_ai_bullets` aendern:
```typescript
cv_ai_bullets: unknown[] | null;
// wird zu:
cv_ai_bullets: unknown;
```

### Aenderungen

| Datei | Aktion |
|---|---|
| Migration SQL (auto-trigger) | Via Migration-Tool ausfuehren |
| `supabase/functions/assess-candidate-fit/index.ts` | Redeploy (keine Code-Aenderung) |
| `src/components/recruiter/CandidateSubmitForm.tsx` | Zeile 56: `cv_ai_bullets` Typ-Fix |

