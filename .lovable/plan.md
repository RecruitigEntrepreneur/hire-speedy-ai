
# Key Facts Grid in die Hero-Sektion verschieben

## Aenderung

Das `CandidateKeyFactsGrid` (Rolle, Erfahrung, Seniority, Standort, Gehalt, Verfuegbar, Remote, Fuehrung) wird aus dem Uebersicht-Tab entfernt und direkt in die Hero-Card integriert -- unterhalb der Pipeline, noch innerhalb der Card. So sieht der Recruiter die wichtigsten Fakten sofort, egal welcher Tab aktiv ist.

```text
+------------------------------------------------------------------+
| Avatar | Name, Position, Badges        | Actions (Phone/Mail/...) |
|--------|--------------------------------------------------------------|
| Pipeline: [Neu] [Kontakt] [Interview] [Angebot] [Platziert]      |
|--------|--------------------------------------------------------------|
| Rolle | Erfahrung | Seniority | Standort | Gehalt | Verfuegbar | Remote | Fuehrung |
+------------------------------------------------------------------+
| [Uebersicht] [Prozess] [Matching] [Historie]                     |
+------------------------------------------------------------------+
```

## Technische Aenderungen

### Datei 1: `CandidateHeroHeader.tsx`
- Import `CandidateKeyFactsGrid` hinzufuegen
- Nach dem Pipeline-Block (und nach dem Rejected-Alert) das Grid einbauen:
  ```
  <div className="mt-4 pt-3 border-t">
    <CandidateKeyFactsGrid candidate={candidate} />
  </div>
  ```
- Die Candidate-Prop hat bereits alle benoetigten Felder (job_title, seniority, experience_years, city, etc.)

### Datei 2: `CandidateMainContent.tsx`
- Die Zeile `<CandidateKeyFactsGrid candidate={candidate} />` aus dem Uebersicht-Tab entfernen (Zeile 117)
- Der Uebersicht-Tab beginnt dann direkt mit der QuickInterviewSummary

| Datei | Aenderung |
|---|---|
| `CandidateHeroHeader.tsx` | KeyFactsGrid nach Pipeline/Rejected einfuegen |
| `CandidateMainContent.tsx` | KeyFactsGrid-Zeile aus Uebersicht-Tab entfernen |

Keine neuen Dateien, keine DB-Aenderungen.
