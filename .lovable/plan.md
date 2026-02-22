

# Key Facts ueber Pipeline + Skills-Badges in Hero

## Aenderungen

### 1. Key Facts UEBER die Pipeline-Statusleiste verschieben
Aktuell ist die Reihenfolge: Avatar/Name -> Pipeline -> Active Processes -> **Key Facts** -> Tasks.
Neu: Avatar/Name -> **Key Facts** -> Pipeline -> Active Processes -> Tasks.

Die kompakte Inline-Zeile `Seniority: Director · Gehalt: 185k-220k EUR · ...` wird direkt unter die Badges (Expose-Ready) verschoben, noch vor die Pipeline. So sieht der Recruiter die harten Fakten sofort.

### 2. Skills & Expertise inline in der Hero-Sektion
Unter der Key-Facts-Zeile wird eine kompakte Skills-Zeile eingefuegt:
- Zeigt `candidate.skills` als kleine Badges (max 8, dann "+N")
- Zeigt `candidate.certificates` als Amber-Badges (falls vorhanden)
- Kein eigener Card-Container, sondern direkt inline im Hero-Block
- Stil: `flex flex-wrap gap-1` mit `text-[11px]` Badges

```text
+------------------------------------------------------------------+
| Avatar | Name, Rolle bei Firma . Ort . 30J     | Tel Mail LI CV  |
|        | [Expose-Ready 71%]                      |                 |
|        | Seniority: Director · Gehalt: 185k€ · Verfuegbar: ...    |
|        | [React] [TypeScript] [Node.js] [AWS] +4                   |
+------------------------------------------------------------------+
| Pipeline: [Neu] [Kontakt] [>>Interview<<] ...                    |
+------------------------------------------------------------------+
| Aktive Prozesse (kompakt)                                        |
+------------------------------------------------------------------+
| Aufgaben                                                          |
+------------------------------------------------------------------+
```

## Technische Details

| Datei | Aenderung |
|---|---|
| `CandidateHeroHeader.tsx` | Key Facts Block von nach Pipeline auf vor Pipeline verschieben. Skills-Badges-Zeile einfuegen (nutzt `candidate.skills` und `candidate.certificates`). |

Keine neuen Dateien, keine neuen Abhaengigkeiten, keine DB-Aenderungen.
