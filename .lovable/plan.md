

# Plan: Testdaten für Company-Reveal aktivieren

## Aktuelle Situation

Der eingeloggte Recruiter (Marko Benko) hat 5 Kandidaten im Interview-Status, aber bei **KEINEM** ist `company_revealed = true`:

| Kandidat | Job | Firma | company_revealed |
|----------|-----|-------|------------------|
| Horst Schmid | Referent IT | Bayerische Versorgungskammer | **false** |
| Imran Türe | Buchhalter | FITSEVENELEVEN GmbH | **false** |
| Ulf Jaeger | Java Developer | Trivium eSolutions GmbH | **false** |
| Dmitrii Shadrin | Product Manager | InnoSoft Solutions | **false** |
| Boris Becker | Java Developer | Trivium eSolutions GmbH | **false** |

**Warum?** Der Trigger `reveal_company_on_opt_in()` setzt `company_revealed = true` nur wenn der Status auf `candidate_opted_in` wechselt. Die bestehenden Submissions wurden vermutlich direkt auf `interview` gesetzt.

## Lösungsvorschlag

Eine Datenmigration durchführen, die für die **"Bayerische Versorgungskammer"** Submission (Horst Schmid) den `company_revealed` Status auf `true` setzt.

### Migration

```sql
-- Setze company_revealed = true für die Horst Schmid Submission
-- bei Bayerische Versorgungskammer (aktuell im Interview-Status)
UPDATE public.submissions
SET 
  company_revealed = true,
  company_revealed_at = NOW()
WHERE id = '9671c2a0-cde6-43b0-9bdd-c5a861cc0c10';
```

## Ergebnis nach Migration

| Ort | Vorher | Nachher |
|-----|--------|---------|
| **Job-Liste** (`/recruiter/jobs`) | 🔒 [Technology \| Konzern \| Hybrid München] | **Bayerische Versorgungskammer** |
| **Job-Detail** | 🔒 Anonymisiert | ✅ Firma sichtbar mit Badge "Unternehmen enthüllt" |
| **Pipeline** | 🔒 Anonymisiert | ✅ Firmenname sichtbar |

## Wichtiger Hinweis

Die Job-Liste (`RecruiterJobs.tsx`) zeigt aktuell **ALLE** Jobs anonymisiert an - auch wenn der Recruiter bereits eine "revealed" Submission hat. Das ist **korrekt nach Triple-Blind Architektur**:

- In der **Übersicht** bleiben Jobs anonym (andere Recruiter sollen den Firmennamen nicht sehen)
- Erst in der **Detailansicht** wird geprüft ob DIESER Recruiter eine revealed Submission hat

Um das korrekt zu testen, navigiere nach der Migration zu:
1. `/recruiter/jobs` → Job "Referent Bereichsleitung IT" anklicken
2. Auf der **Detailseite** sollte die Firma "Bayerische Versorgungskammer" sichtbar sein

## Alternative: Alle Interview-Submissions fixen

Falls gewünscht, kann ich auch ALLE bestehenden Interview-Submissions für diesen Recruiter fixen:

```sql
UPDATE public.submissions
SET 
  company_revealed = true,
  company_revealed_at = NOW()
WHERE recruiter_id = '9ee0e9d4-2191-4ff3-b845-cef0305a5f39'
  AND status IN ('interview', 'offer', 'hired')
  AND company_revealed = false;
```

Dies würde alle 5 Interview-Submissions auf `company_revealed = true` setzen.

