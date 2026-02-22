
# Benefits-Feld und bessere Beispiele im Edit-Dialog

## Problem

Beim Klick auf "Benefits beschreiben" oder "Skills definieren" in der Quality-Score-Karte oeffnet zwar der richtige Tab, aber:

1. **Benefits**: Es gibt gar kein Benefits-Feld im Edit-Dialog (und auch keine Spalte in der Datenbank). Der Nutzer landet auf "Grunddaten" und weiss nicht, wo er Benefits eintragen soll.
2. **Skills**: Das Feld existiert, aber die Platzhalter-Texte koennten hilfreicher sein mit konkreten Beispielen.

## Loesung

### 1. Neue `benefits`-Spalte in der `jobs`-Tabelle

- Migration: `ALTER TABLE public.jobs ADD COLUMN benefits text[] DEFAULT '{}';`
- Speichert Benefits als Array von Strings (gleiche Logik wie `skills`)

### 2. Benefits-Feld im Edit-Dialog hinzufuegen

**`src/components/jobs/JobEditDialog.tsx`**

- Neues `benefits`-Feld in `formData` (kommagetrennt wie Skills)
- Im **Basics-Tab** (oder besser: im **Conditions-Tab**, da Benefits zu Konditionen gehoeren) ein neues Textarea einfuegen:
  - Label: "Benefits & Zusatzleistungen"
  - Placeholder mit konkreten Beispielen: "z.B. 30 Tage Urlaub, Firmenwagen, betriebliche Altersvorsorge, Weiterbildungsbudget..."
  - Darunter Vorschlags-Chips zum Anklicken (haeufige Benefits), die sich per Klick ins Feld einfuegen
- `handleSave` erweitern: `benefits`-Array in die DB schreiben

### 3. Vorschlags-Chips fuer Benefits

Haeufige Benefits als klickbare Badges unter dem Textfeld:
- 30 Tage Urlaub
- Home Office
- Firmenwagen
- Weiterbildungsbudget
- Betriebliche Altersvorsorge
- Jobrad
- Flexible Arbeitszeiten
- Obstkorb & Getraenke

Beim Klick wird der Chip ins Textfeld uebernommen (falls noch nicht vorhanden).

### 4. Skills-Tab: Bessere Platzhalter

Die Platzhalter-Texte im Skills-Tab verbessern mit konkreteren Beispielen:
- Skills: "z.B. React, TypeScript, Node.js, PostgreSQL, Docker..."
- Must-Haves: "z.B. 5+ Jahre React, Erfahrung mit CI/CD, Teamfuehrung..."
- Nice-to-Haves: "z.B. Kubernetes-Kenntnisse, Open-Source-Beitraege..."

### 5. Quality-Score: Benefits-Suggestion auf richtigen Tab zeigen

**`src/components/client/JobQualityScoreCard.tsx`**
- Benefits-Suggestion Tab von `'basics'` auf `'conditions'` aendern (da das Feld dort landet)

### 6. hasBenefits-Logik anpassen

**`src/pages/dashboard/ClientJobDetail.tsx`**
- `hasBenefits` zusaetzlich pruefen ob `job.benefits` (neues DB-Feld) gefuellt ist, nicht nur `job_summary.benefits_extracted`

## Technische Details

### Dateien die geaendert werden

| Datei | Aenderung |
|---|---|
| DB Migration | `benefits text[]` Spalte hinzufuegen |
| `JobEditDialog.tsx` | Benefits-Textarea mit Vorschlags-Chips im Conditions-Tab |
| `JobEditDialog.tsx` | Bessere Platzhalter fuer Skills/Must-Haves/Nice-to-Haves |
| `JobQualityScoreCard.tsx` | Benefits-Tab-Referenz auf `conditions` aendern |
| `ClientJobDetail.tsx` | `hasBenefits`-Check um `job.benefits` erweitern |
