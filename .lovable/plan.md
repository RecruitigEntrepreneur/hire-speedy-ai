

# Verbesserungsvorschlaege direkt umsetzbar machen

## Problem

Aktuell oeffnen alle Verbesserungsvorschlaege im Quality Score den JobEditDialog immer auf dem ersten Tab ("Grunddaten"). Wenn der Nutzer "Gehaltsrahmen ergaenzen" klickt, muss er sich erst zum Tab "Konditionen" durchklicken. Das ist umstaendlich und die Vorschlaege wirken nicht wirklich actionable.

## Loesung

Jeder Verbesserungsvorschlag oeffnet den Edit-Dialog direkt auf dem richtigen Tab:

| Vorschlag | Ziel-Tab im Dialog |
|---|---|
| Gehaltsrahmen ergaenzen | `conditions` (Konditionen) |
| Benefits beschreiben | `basics` (Grunddaten / Beschreibung) |
| Skills definieren | `skills` |
| Beschreibung erweitern | `basics` (Grunddaten) |

## Technische Aenderungen

### 1. JobEditDialog: Initialen Tab von aussen steuerbar machen

**`src/components/jobs/JobEditDialog.tsx`**
- Neue optionale Prop `initialTab?: string` hinzufuegen
- Den `activeTab`-State mit `initialTab` initialisieren und bei Aenderung aktualisieren (useEffect)

### 2. JobQualityScoreCard: Feld-spezifische Callbacks

**`src/components/client/JobQualityScoreCard.tsx`**
- Die `onEditIntake`-Prop aendern zu `onEditField: (tab: string) => void`
- Jeder Suggestion bekommt seinen eigenen Tab-Key:
  - `!hasSalary` -> `onEditField('conditions')`
  - `!hasBenefits` -> `onEditField('basics')`
  - `!hasSkills` -> `onEditField('skills')`
  - `descLength < 200` -> `onEditField('basics')`
- Der "Details ergaenzen"-Button unten ruft weiterhin den ersten fehlenden Tab auf
- Die Checklisten-Items (Gehalt, Skills, etc.) werden ebenfalls klickbar -- fehlende Items oeffnen den passenden Tab

### 3. ClientJobDetail: Verbindung herstellen

**`src/pages/dashboard/ClientJobDetail.tsx`**
- Neuen State `editDialogTab` hinzufuegen
- `onEditField`-Handler: setzt `editDialogTab` und oeffnet den Dialog
- Den `JobEditDialog` bekommt `initialTab={editDialogTab}`
- Beim Schliessen des Dialogs wird `editDialogTab` zurueckgesetzt

