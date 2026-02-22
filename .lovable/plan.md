

# Job Detail Page: Maximales UI/UX Upgrade

## Analyse des Ist-Zustands

Die Seite hat alle richtigen Daten, aber die Struktur ist nicht optimal:

1. **Hero-Section ist ueberladen** -- Stats-Bar mit 5 Nullen ("0 Kandidaten, 0 In Bearbeitung...") wirkt leer und demotivierend bei neuen Jobs
2. **Bento Grid ist unbalanciert** -- Pipeline + Recruiter Aktivitaet links (schmal), Executive Summary rechts (breit) -- aber bei neuen Jobs sind links zwei fast leere Karten
3. **Executive Summary dominiert** -- nimmt 2/3 der Breite ein, obwohl es die wertvollste Info ist, koennte sie prominenter und besser strukturiert sein
4. **Leere States wirken deprimierend** -- "Noch keine Kandidaten", "Keine Interviews", "Wenig Aktivitaet" alles auf einer Seite
5. **Company Info Card am Ende** ist fast wertlos -- zeigt nur Name + Branche, obwohl viel mehr Daten verfuegbar waeren
6. **Kein klarer CTA** -- was soll der Client als naechstes tun?

---

## Neues Layout-Konzept: Phasen-adaptiv

Die Seite passt sich dem Lebenszyklus des Jobs an:

**Phase 1: Entwurf/Frisch (0 Kandidaten)** -- Fokus auf Job-Qualitaet + Naechste Schritte
**Phase 2: Aktiv (1+ Kandidaten)** -- Fokus auf Pipeline + Top-Kandidaten
**Phase 3: Fortgeschritten (Interviews laufen)** -- Fokus auf Interviews + Entscheidungen

---

## Konkrete Aenderungen

### 1. Hero Section verschlanken (ClientJobHero.tsx)

- Stats-Bar nur anzeigen wenn mindestens 1 Kandidat vorhanden
- Bei 0 Kandidaten: stattdessen ein "Naechste Schritte"-Banner mit klaren CTAs
  - "Job veroeffentlichen" (wenn Entwurf)
  - "Intake verbessern" (wenn Completeness niedrig)
  - "Recruiter werden bald aktiv" (wenn published)
- Aktions-Buttons besser gruppieren: Primaer-Aktion hervorheben

### 2. Bento Grid Restructuring (ClientJobDetail.tsx)

Neues Layout je nach Phase:

**Bei 0 Kandidaten (Entwurf/Frisch):**

```text
[  Job-Qualitaets-Score Card  |  Naechste Schritte Card  ]
[        Executive Summary (volle Breite)                 ]
[  Recruiter Aktivitaet       |  Unternehmensinfo         ]
```

**Bei 1+ Kandidaten:**

```text
[ Pipeline Snapshot | Recruiter Aktivitaet | Quick Stats  ]
[   Top Kandidaten (volle Breite)                         ]
[   Executive Summary (volle Breite)                      ]
[   Interviews              |  Unternehmensinfo           ]
```

### 3. Neue Komponente: JobQualityScore (src/components/client/JobQualityScoreCard.tsx)

Kombiniert Intake-Completeness mit einer Bewertung der Job-Attraktivitaet:

- Kreisfoermiger Score (0-100) berechnet aus:
  - Intake Completeness (40% Gewicht)
  - Gehalt vorhanden (20%)
  - Benefits vorhanden (15%)
  - Skills definiert (15%)
  - Beschreibung Laenge (10%)
- Darunter: 2-3 konkrete Verbesserungsvorschlaege
  - "Gehaltsrahmen ergaenzen" mit direktem Link zum Edit
  - "Mehr Benefits beschreiben"
- Zeigt dem Client sofort, wie "verkaufbar" der Job ist

### 4. Neue Komponente: NextStepsCard (src/components/client/NextStepsCard.tsx)

Kontextabhaengige Handlungsempfehlungen:

- **Entwurf:** "Veroeffentlichen Sie den Job, damit Recruiter ihn sehen"
- **Published, 0 Kandidaten:** "Recruiter werden benachrichtigt. Verbessern Sie Ihr Profil fuer schnellere Matches"
- **Kandidaten vorhanden:** "Pruefen Sie die neuen Einreichungen"
- **Interviews geplant:** "Naechstes Interview in X Stunden vorbereiten"

Jeder Schritt hat einen klaren Button/Link.

### 5. Executive Summary: Volle Breite + Tabs (JobExecutiveSummary.tsx)

- Auf volle Breite umstellen statt 2/3
- Collapsibles ersetzen durch horizontale Tabs: "Aufgaben | Anforderungen | Benefits | KI-Analyse"
- Intake-Status aus der Summary herausnehmen (ist jetzt im JobQualityScore)
- Key Facts Grid kompakter: max 4-5 Facts in einer Zeile

### 6. Pipeline Card aufwerten (PipelineSnapshotCard.tsx)

- Bei 0 Kandidaten: Anstatt leere Balken, ein motivierender Zustand zeigen
  - "Ihre Stelle wird gerade an Recruiter verteilt"
  - Animierter Puls-Indikator
- Bei Kandidaten: Horizontaler Funnel statt vertikale Liste (visuell staerker)

### 7. Company Info Card aufwerten (CompanyInfoCard.tsx)

- Mehr Daten aus dem Job holen: `industry`, `remote_type`, `employment_type`
- "Profil verbessern" CTA einbauen der zum Company Settings fuehrt
- Wenn wenig Daten: konkreter Hinweis "Recruiter sehen nur: [Name + Branche]. Ergaenzen Sie Ihr Profil."

### 8. Leere States mit Persoenlichkeit (alle Cards)

Alle "keine Daten" Zustaende bekommen:
- Ein passendes, dezentes Icon
- Einen ermutigenden Text statt eines trockenen "Keine Daten"
- Einen klaren CTA wo moeglich

---

## Technische Uebersicht

| Datei | Aenderung |
|-------|-----------|
| `src/pages/dashboard/ClientJobDetail.tsx` | Bento Grid Restructuring, phasen-adaptives Layout, Executive Summary auf volle Breite |
| `src/components/client/ClientJobHero.tsx` | Stats-Bar nur bei Kandidaten > 0, Next-Steps-Banner bei Entwurf/leer |
| `src/components/client/JobQualityScoreCard.tsx` | **Neue Komponente**: Kreisfoermiger Score + Verbesserungsvorschlaege |
| `src/components/client/NextStepsCard.tsx` | **Neue Komponente**: Kontextabhaengige CTAs |
| `src/components/client/PipelineSnapshotCard.tsx` | Leerer State aufwerten, horizontaler Funnel |
| `src/components/client/RecruiterActivityCard.tsx` | Leerer State aufwerten |
| `src/components/client/CompanyInfoCard.tsx` | Mehr Daten anzeigen, Profil-CTA |
| `src/components/client/TopCandidatesCard.tsx` | Leerer State aufwerten |
| `src/components/client/UpcomingInterviewsCard.tsx` | Leerer State aufwerten |
| `src/components/jobs/JobExecutiveSummary.tsx` | Volle Breite, Tabs statt Collapsibles, Intake-Status entfernen |

### Implementierungsreihenfolge

1. Neue Komponenten erstellen (JobQualityScoreCard, NextStepsCard)
2. ClientJobDetail.tsx Layout umbauen (phasen-adaptiv)
3. ClientJobHero.tsx verschlanken
4. Executive Summary auf Tabs umstellen
5. Alle leeren States aufwerten
6. CompanyInfoCard erweitern

