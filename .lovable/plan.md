

# Karriere-Timeline in den Uebersicht-Tab verschieben

## Aktuelle Situation
Die Karriere-Timeline sitzt im **Historie**-Tab -- der Recruiter muss extra dorthin wechseln um die CV-Stationen zu sehen. Die Daten stammen aus dem automatischen CV-Parsing (KI extrahiert Berufsstationen beim Upload).

## Aenderung

Die `CandidateExperienceTimeline` wird aus dem Historie-Tab entfernt und in den Uebersicht-Tab verschoben -- in die rechte Spalte des 2-Column-Grids, unter Dokumente und Tags.

### Datei: `CandidateMainContent.tsx`

**Im Uebersicht-Tab (Zeile 119, rechte Spalte):** Karriere-Timeline Card einfuegen nach dem Tags-Block:
```
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm flex items-center gap-2">
      <Building2 className="h-4 w-4 text-primary" />
      Karriere-Timeline
    </CardTitle>
  </CardHeader>
  <CardContent>
    <CandidateExperienceTimeline candidateId={candidate.id} />
  </CardContent>
</Card>
```

**Im Historie-Tab (Zeile 191-202):** Den Karriere-Timeline Card-Block entfernen. Der Historie-Tab behaelt nur noch "Aehnliche Kandidaten" und "Letzte Aktivitaeten".

### Zusammenfassung

| Datei | Aenderung |
|---|---|
| `CandidateMainContent.tsx` | Timeline aus Historie-Tab entfernen, in Uebersicht-Tab (rechte Spalte) einfuegen |

Keine neuen Dateien, keine DB-Aenderungen. Eine einzige Datei wird geaendert.
