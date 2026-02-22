

# Anonymes Expose: Vom Client-Dashboard zum Recruiter-Bereich verschieben

## Was wird geaendert

Das "Anonymes Expose generieren"-Feature gehoert in die Haende der Recruiter, nicht der Clients. Die Recruiter nutzen es, um Kandidaten anzusprechen -- der Client hat damit nichts zu tun.

## Konkrete Schritte

### 1. Client-Seite: Expose-Button entfernen

**`src/components/client/SellingPointsCard.tsx`**
- Den "Anonymes Expose generieren"-Button und die `onGenerateExpose`-Prop entfernen
- Die Karte zeigt weiterhin die USPs, aber ohne den Expose-CTA

**`src/pages/dashboard/ClientJobDetail.tsx`**
- Den `AnonymousExposeDialog`-Import und die Verwendung entfernen
- Den `showExposeDialog`-State und die zugehoerige Logik entfernen
- Die `onGenerateExpose`-Prop aus der SellingPointsCard-Nutzung entfernen

### 2. Recruiter-Seite: Expose-Button hinzufuegen

**`src/components/recruiter/SellingPointsCard.tsx`**
- Einen "Anonymes Expose generieren"-Button unten in die bestehende Recruiter-SellingPointsCard einbauen
- Die `jobId`-Prop hinzufuegen fuer die Edge-Function

**`src/pages/recruiter/JobDetail.tsx`**
- Den `AnonymousExposeDialog` importieren und einbinden (wird aus `src/components/client/` verschoben nach `src/components/recruiter/` oder als Shared-Component)
- State fuer den Dialog hinzufuegen (`showExposeDialog`)
- Die `jobId` an die SellingPointsCard und den Dialog durchreichen

### 3. AnonymousExposeDialog verschieben

**`src/components/client/AnonymousExposeDialog.tsx`** wird verschoben/kopiert nach einer gemeinsamen Stelle oder direkt unter `src/components/recruiter/AnonymousExposeDialog.tsx`, da es jetzt primaer ein Recruiter-Feature ist.

### Was bleibt unveraendert
- Die Edge Function `generate-job-expose` bleibt wie sie ist
- Die Client-SellingPointsCard zeigt weiterhin USPs (nur ohne Expose-Button)
- Die Recruiter-SellingPointsCard behaelt ihr bestehendes Design

