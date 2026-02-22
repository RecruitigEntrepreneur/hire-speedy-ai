
# Interview-Erkenntnisse in den Uebersicht-Tab verschieben

## Aenderung

Die `QuickInterviewSummary`-Komponente wird aus dem **Prozess**-Tab in den **Uebersicht**-Tab verschoben -- prominent ganz oben, direkt vor dem Key Facts Grid. So sieht der Recruiter sofort, was fuer ein vollstaendiges Expose noch fehlt (Interview-Daten + CV).

### Datei: `CandidateMainContent.tsx`

**Uebersicht-Tab (vor Key Facts Grid):** QuickInterviewSummary einfuegen:
```
<QuickInterviewSummary
  candidateId={candidate.id}
  onViewDetails={onStartInterview}
/>
<CandidateKeyFactsGrid candidate={candidate} />
```

**Prozess-Tab:** QuickInterviewSummary entfernen. Der Prozess-Tab behaelt nur noch Interviews und Offene Aufgaben.

| Datei | Aenderung |
|---|---|
| `CandidateMainContent.tsx` | QuickInterviewSummary aus Prozess-Tab entfernen, in Uebersicht-Tab ganz oben einfuegen |

Keine neuen Dateien, keine DB-Aenderungen.
