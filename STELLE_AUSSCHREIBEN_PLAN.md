# Stelle ausschreiben — Dokument-first (fokussierter Plan)

> Stand 2026-07-10. Ziel: Der Kunde liefert, was er hat (Link, PDF, Stellenbeschreibung,
> Freitext) — und das System baut darauf auf, statt ihn zu befragen, als hätte er nichts geliefert.

## Prinzip

```
Kunde gibt Link / PDF / Text          (existiert: Parse läuft)
   ↓
System zeigt, WAS es verstanden hat:  „Aus Ihrer Anzeige übernommen: 14 Angaben
                                       · aus Ihrem Firmenprofil: 6 · noch offen: 5 Fragen"
   ↓
Briefing fragt NUR Lücken             (nicht: alle 26 Fragen abspulen)
und Widersprüche, nach Recruiter-Wert priorisiert
   ↓
Qualitäts-Check vor Übergabe          („passt Budget zu Anspruch? Zu viele Muss-Kriterien?")
```

## Was heute schon da ist (und bleibt)

- Eingang Text/PDF/Link + KI-Parse + Live-Build ✓
- Editierbares Profil (Eckdaten, Skills, Contracting-Fork, Firma & Reveal) ✓
- Tiefes Briefing (26 Fragen statisch; dynamische KI-Fragen gebaut, wartet auf Deploy) ✓
- Entwurf speichern/fortsetzen, Delegation, Erfolgs-Screen ✓

**Die Lücke:** Das Briefing ignoriert, was Dokument und Firmenprofil schon beantwortet
haben — der Kunde beantwortet Fragen doppelt. Und es gibt keinen Qualitäts-Check vor der Übergabe.

## Bauplan (4 Schritte, einzeln shipbar)

### 1. Coverage-Map — „Wir haben Ihre Anzeige gelesen" (~1 Tag)
- Parse-Ergebnis markiert Briefing-Fragen automatisch als beantwortet
  (Gehalt in Anzeige → Comp-Frage übersprungen; Sprachen erkannt → K.O.-Frage vorbefüllt;
  Aufgaben-Abschnitt vorhanden → Aufgaben-Fragen nur noch zur Schärfung, nicht von null).
- Sichtbare Zeile im Studio: **„Aus Ihrer Anzeige übernommen: N · noch offen: K Fragen"** —
  das Vertrauenssignal, dass sich der Upload gelohnt hat.
- Dynamische KI-Fragen bekommen die Coverage als Input („frage NIE, was das Dokument
  schon beantwortet — nur nachschärfen, wo es vage ist").

### 2. Firmenprofil-Vorbefüllung — nie zweimal fragen (~1 Tag)
- Nur lesend: vorhandene `company_profiles`-Daten (Branche, Größe, Standorte, Benefits,
  Remote-Standard) fließen in Profil-Karte + Reveal-Descriptor + Briefing-Prefill ein.
- Statt Neuabfrage: **„Gilt hier Ihr Standard (hybrid, 2 Bürotage)?"** → nur Abweichung erfassen.
- (Das Pflegen/Vervollständigen des Firmenprofils selbst bleibt bewusst außen vor —
  eigenes Thema, siehe COMPANY_PROFILE_MASTERPLAN.)

### 3. Fragenkatalog komplettieren (~0,5 Tage)
- **30/90-Tage-Ergebnisse** ergänzen (12 Monate existiert): „Was muss nach 90 Tagen
  konkret geliefert sein?"
- **Muss-Limit-Warnung**: ab 8 Muss-Kriterien Tension-Flag („Markt schrumpft erheblich —
  welche 2 sind verhandelbar?").
- **Flexibilitätsmatrix light**: je Muss-Kriterium ein Chip — fix / leicht verhandelbar /
  flexibel. Recruiter wissen damit exakt, wo Alternativen erlaubt sind.
- **Ausschlusskriterien-Frage** (echte K.O.s) mit AGG-Guardrail (diskriminierende
  Kriterien werden abgefangen).

### 4. Qualitäts-Check vor Übergabe (~1 Tag)
- Karte im Studio vor „An Recruiter übergeben":
  - **Konsistenz**: remote vs. Bürotage · Budget vs. Seniorität/Titel · Junior + 10 Jahre …
  - **Briefing-Reife 0–100** mit konkreten Hebeln: „+1 Frage zu Aufgaben beantworten: +8 ·
    1 Muss zu Kann: +5".
  - Übergeben bleibt IMMER möglich (nie blockieren) — der Check ist Beratung, kein Gate.

## Bewusst NICHT in diesem Plan
- Firmenprofil-Editor/Enrichment, Output-Generatoren (Anzeige/Pitch/Suchstrategie),
  Interview-Prozess/SLA, Kollaborations-Ausbau, ANÜ/Interim, Spracheingabe, Lernschleife.
- Deploy-Hinweis: Vor dem Deploy der Intake-Migration muss die recruiter_jobs_view
  verdrahtet sein (Leak, siehe COMPANY_PROFILE_MASTERPLAN Phase 0) — unverändert gültig.

**Reihenfolge: 1 → 2 → 3 → 4 · gesamt ~3,5 Tage.**
