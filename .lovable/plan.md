

# Interview-Erkenntnisse: Freitext-Notizen + AI-Extraktion

## Idee

Statt strukturierter Formularfelder bekommt der Recruiter ein **einziges grosses Textfeld**, in das er seine Interview-Notizen frei eintippt oder reinkopiert. Beim Speichern werden die Notizen gespeichert und die **AI extrahiert automatisch** die strukturierten Daten (Gehalt, Motivation, Verfuegbarkeit, Empfehlung) daraus -- genau wie beim Interview-Wizard, nur ohne den Wizard.

## Ablauf

```text
Recruiter tippt frei:
"Telefonat mit Marko am 20.02. - will 90k, minimum 80k.
 Kuendigung 3 Monate. Motivation: will mehr Verantwortung.
 Sehr guter Eindruck, wuerde ich empfehlen."

         |
         v

[Speichern] --> Freitext in candidate_interview_notes.additional_notes
         |
         v

AI (process-interview-notes) extrahiert automatisch:
  - salary_desired: 90.000
  - salary_minimum: 80.000
  - notice_period: 3 Monate
  - change_motivation: Mehr Verantwortung
  - would_recommend: true
  - recommendation: "Sehr guter Eindruck"

         |
         v

Karte wechselt zur Anzeige mit extrahierten Daten
```

## UI-Aenderung in QuickInterviewSummary

### Vorher (nur Checkliste + "Interview starten")

```text
+------------------------------------------------------------------+
| Interview-Erkenntnisse                                           |
| Fuer ein vollstaendiges Expose fehlen:                           |
| [x] Gehaltsvorstellung                                          |
| [x] Wechselmotivation                                           |
| [x] Verfuegbarkeit                                               |
| [x] Einschaetzung                                                |
|                                                                  |
| [Interview jetzt starten]                                        |
+------------------------------------------------------------------+
```

### Nachher (Freitext-Option dazu)

```text
+------------------------------------------------------------------+
| Interview-Erkenntnisse                                           |
| Fuer ein vollstaendiges Expose fehlen:                           |
| [x] Gehaltsvorstellung                                          |
| [x] Wechselmotivation                                           |
| [x] Verfuegbarkeit                                               |
| [x] Einschaetzung                                                |
|                                                                  |
| [Interview jetzt starten]  [Notizen eintragen]                  |
+------------------------------------------------------------------+
```

Klick auf **"Notizen eintragen"** oeffnet das Freifeld:

```text
+------------------------------------------------------------------+
| Interview-Erkenntnisse                                           |
|                                                                  |
| Trage deine Interview-Notizen ein. Die AI extrahiert             |
| automatisch Gehalt, Motivation und Verfuegbarkeit.               |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Telefonat mit Marko am 20.02. Er will 90k, minimum 80k.     | |
| | Kuendigung 3 Monate zum Monatsende. Fruehester Start Juni.   | |
| | Motivation: will mehr strategische Verantwortung, aktuell    | |
| | nur operativ. Sehr guter Eindruck, empfehle ich weiter.      | |
| |                                                              | |
| +--------------------------------------------------------------+ |
|                                                                  |
|                          [Abbrechen]  [Speichern & Analysieren]  |
+------------------------------------------------------------------+
```

Nach dem Speichern: Spinner waehrend AI verarbeitet, dann zeigt die Karte die extrahierten Daten an (Wechselmotivation, Gehalt, Empfehlung etc.).

## Technische Umsetzung

### Datei 1: `src/components/candidates/QuickInterviewSummary.tsx`

**Aenderungen:**

1. Neuer State: `showFreeText` (boolean), `freeText` (string), `saving` (boolean)
2. Import `useAuth` fuer `recruiter_id`
3. Import `Textarea` und `Loader2`
4. Zweiter Button neben "Interview jetzt starten": **"Notizen eintragen"** (variant="outline", size="sm")
5. Wenn `showFreeText = true`: Textarea + Hinweistext + "Abbrechen"/"Speichern & Analysieren"-Buttons
6. `handleSave`:
   - Insert in `candidate_interview_notes` mit `additional_notes: freeText`, `status: 'completed'`, `candidate_id`, `recruiter_id`
   - Dann Edge Function `process-interview-notes` aufrufen mit `{ candidateId, interviewNotes: { additional_notes: freeText }, candidateData: {} }`
   - Die Edge Function extrahiert strukturierte Daten und speichert AI-Assessment
   - Nach Erfolg: Notes neu laden (refetch), Karte wechselt zur Anzeige-Ansicht
7. Die bestehende Edge Function `process-interview-notes` wird unveraendert genutzt -- sie akzeptiert bereits Freitext in `additionalNotes`

### Datei 2: `src/components/candidates/CandidateInterviewsCard.tsx`

**Fix Zeile 108:** Anfuehrungszeichen im `.not()` Filter entfernen damit die Submissions korrekt gefunden werden.

```text
Vorher:  .not('status', 'in', '("rejected","withdrawn","hired","client_rejected")')
Nachher: .not('status', 'in', '(rejected,withdrawn,hired,client_rejected)')
```

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `QuickInterviewSummary.tsx` | "Notizen eintragen"-Button + Freitext-Textarea + Speichern ruft AI-Extraktion auf |
| `CandidateInterviewsCard.tsx` | Fix: Anfuehrungszeichen in `.not()` Filter entfernen |

- Kein neuer Wizard, kein strukturiertes Formular
- Ein Freifeld, AI macht den Rest
- Bestehende Edge Function wird wiederverwendet
- Keine DB-Aenderungen noetig

