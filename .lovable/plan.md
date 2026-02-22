

# Kandidaten-Detailseite: Redesign fuer Kundenentscheidung

## Zusammenfassung

Die aktuelle Seite hat 1054 Zeilen, 7+ Sektionen, 3x redundante Status-Anzeige, 3x Anonymitaets-Erklaerung und viele leere Felder. Sie wird radikal vereinfacht zu einer klaren Entscheidungsseite.

## Neues Layout

```text
+------------------------------------------------------------------+
| <- Zurueck zu Bewerbungen                                        |
|                                                                  |
| [Avatar]  Kandidat #A7FA2CCF                                    |
|           fuer Product Manager                                   |
|           Interview angefragt | Opt-In ausstehend               |
|                                                                  |
|           [Interview anfragen]  [Ablehnen]                       |
+------------------------------------------------------------------+
|                                                                  |
| KI-Einschaetzung                               Erstellt 02.02.  |
| ---------------------------------------------------------------- |
| Nicht geeignet                                                   |
|                                                                  |
| Der Kandidat bringt keinerlei relevante Berufserfahrung im       |
| Bereich Produktmanagement mit. Die Skills konzentrieren sich     |
| auf Softwareentwicklung und Cloud Operations...                  |
|                                                                  |
| Wechselmotivation: Unbekannt (kein Interview gefuehrt)           |
+------------------------------------------------------------------+
|                                                                  |
| Profil                                    | Notizen              |
| ----------------------------------------- | -------------------- |
| Aktuelle Rolle    Fachkraft               | [Notiz hinzufuegen]  |
| Hintergrund       Sr. C# Dev .Net/Azure  | ...                  |
| Region            DACH                    |                      |
| Arbeitsmodell     Flexibel                |                      |
| Verfuegbarkeit    Noch nicht besprochen   |                      |
| Erfahrung         Ausstehend             |                      |
| Gehalt            Wird besprochen         |                      |
+------------------------------------------------------------------+
|                                                                  |
| Anonymisiertes Profil - Nach Interview-Zustimmung werden Name,   |
| Kontakt und CV freigeschaltet.                                   |
+------------------------------------------------------------------+
```

## Was sich aendert

### Entfernt
- Match-Score SVG-Kreis (6%) und Policy-Badge ("Nicht geeignet" in Rot)
- Match-Empfehlung Card komplett (Sektion 4) -- die KI-Einschaetzung deckt das ab
- Deal-Faktoren Card (Sektion 5) -- alles leer/unbekannt, Motivation wird in KI-Einschaetzung integriert
- 2 von 3 Anonymitaets-Erklaerungen (Shield-Banner UND Sektion 6)
- Readiness Warning Banner (fuer den Kunden nicht relevant)
- MatchScoreBreakdown Komponente
- DealHealthBadge Komponente
- Fit-Label Badge (redundant mit KI-Einschaetzung)
- Farbige Status-Banner (Blau/Gruen/Lila) -- Status wird kompakt im Header gezeigt
- Fachlicher Hintergrund als eigene Card (wird in Profil-Snapshot integriert)
- Leere Felder die nur "Ausstehend/Unbekannt" zeigen werden dezenter dargestellt

### Beibehalten + Verbessert
- Header mit Avatar, Name, Job, Status, CTAs -- alles in einer Zeile/Block
- KI-Einschaetzung (ClientCandidateSummaryCard) -- wird zum HERO-Element, volle Breite, prominent
- Profil-Snapshot -- kompakter, nur gefuellte Felder prominent, leere Felder grau/klein
- Notizen/Kommentare -- bleibt, aber als Sidebar rechts neben Profil
- Anonymitaets-Hinweis -- 1x als dezenter Footer-Hinweis
- Dokumente & Links (wenn unlocked)
- Kontaktdaten (wenn unlocked)
- Rejection Dialog + Interview Wizard -- bleiben als Dialoge

### Neue Hierarchie (von oben nach unten)

1. **Header** -- Wer + Status + CTAs (1 Block, keine separate Card)
2. **KI-Einschaetzung** -- Volle Breite, das Wichtigste zuerst
3. **Profil + Notizen** -- 2-Spalten, Fakten links, Kommentare rechts
4. **Anonymitaets-Hinweis** -- 1 Zeile, dezent, am Ende
5. **Dokumente/Kontakt** -- Nur wenn unlocked, am Ende

## Technische Umsetzung

### Datei: `src/pages/dashboard/CandidateDetail.tsx`

Komplette Ueberarbeitung:

1. **Header vereinfacht** (Zeilen 276-391): 
   - Status-Banner entfernen (Zeilen 394-471)
   - Readiness-Banner entfernen (Zeilen 473-487)
   - Triple-Blind Banner entfernen (Zeilen 489-502)
   - Fit-Label Badge aus Header entfernen
   - Stage-aware Actions bleiben, aber kompakter

2. **KI-Einschaetzung nach oben** (aktuell Zeile 962):
   - `ClientCandidateSummaryCard` wird das erste Element nach dem Header
   - Volle Breite statt 40% rechte Spalte
   - Deal-Wahrscheinlichkeit und Motivation werden hier integriert

3. **Match-Empfehlung entfernen** (Zeilen 620-749):
   - Komplette Card mit SVG-Kreis, Policy-Badge, MatchScoreBreakdown weg
   - Import von `MatchScoreBreakdown`, `useMatchScoreV31` entfernen

4. **Deal-Faktoren entfernen** (Zeilen 751-834):
   - Komplette Card weg -- bei leeren Daten nutzlos
   - Wenn Daten vorhanden: Motivation wird in KI-Einschaetzung gezeigt

5. **Fachlicher Hintergrund integrieren** (Zeilen 587-618):
   - Skills werden in den Profil-Snapshot integriert statt eigene Card
   
6. **Anonymitaets-Hinweis reduzieren** (Zeilen 836-872):
   - Sektion 6 (komplette Card mit Icon-Liste) wird zu 1 Zeile am Seitenende
   
7. **Layout von 60/40 zu Einzel-Spalte + Sidebar**:
   - KI-Einschaetzung: volle Breite
   - Profil + Notizen: 60/40 Split
   - Recruiter-Empfehlung unter KI-Einschaetzung (wenn vorhanden)

8. **Leere Felder dezenter**:
   - Felder mit "Ausstehend/Unbekannt" bekommen `text-muted-foreground/50` statt normalen Text
   - Keine Icons bei leeren Feldern

### Entfernte Importe
- `MatchScoreBreakdown` aus `@/components/matching/MatchScoreBreakdown`
- `DealHealthBadge` aus `@/components/health/DealHealthBadge`
- `useMatchScoreV31` aus `@/hooks/useMatchScoreV31`
- `AlertTriangle`, `TrendingUp`, `CheckCircle`, `Target`, `GraduationCap`, `Shield`, `Info`, `Video`, `Sparkles` (nicht mehr noetig)
- Match-bezogener State (`matchResults`, `matchLoading`, `calculateSingleMatch`)

### Beibehaltene Importe
- `ClientCandidateSummaryCard`
- `RejectionDialog`, `ProfessionalInterviewWizard`
- `useClientCandidateView`
- `supabase`, `useAuth`, `useToast`
- `DashboardLayout`, UI-Komponenten

### Farbschema
- Monochrom: `foreground`, `muted-foreground`, `muted`, `border`
- Einzige Farbe: Primary fuer CTAs
- Destructive nur fuer "Ablehnen" Button
- Keine blauen/gruenen/lila Status-Banner mehr

## Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/pages/dashboard/CandidateDetail.tsx` | Komplettes Redesign: KI-Einschaetzung als Hero, Match/Deal-Sektionen entfernt, Layout vereinfacht, Redundanzen eliminiert |

## Ergebnis

Die Seite schrumpft von ~1054 auf ~500 Zeilen. Der Kunde sieht sofort:
- Wer ist das (Header)
- Passt er (KI-Einschaetzung -- prominent, volle Breite)
- Fakten auf einen Blick (kompakter Snapshot)
- Was tun (CTAs im Header)

Keine Informationsflut, keine leeren Sektionen, keine redundanten Hinweise.

