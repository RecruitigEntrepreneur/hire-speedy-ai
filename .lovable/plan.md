

## Recruiter Trust System -- Tabellen erstellen und Types bereinigen

### Ausgangslage
Die Tabellen `recruiter_trust_levels` und `recruiter_job_activations` existieren **nicht** in der Datenbank. Deshalb schlagen alle Queries fehl und Aktivierungen gehen nach Page-Refresh verloren.

### Schritt 1: Datenbank-Migration ausfuehren
Die beiden Tabellen mit Indexes, RLS und Policies erstellen -- exakt das SQL aus der Anfrage:

- `recruiter_trust_levels` -- speichert Trust-Level pro Recruiter (bronze/silver/gold/suspended)
- `recruiter_job_activations` -- speichert welche Jobs ein Recruiter aktiviert hat
- 5 Indexes fuer performante Abfragen
- RLS aktiviert auf beiden Tabellen
- 5 RLS Policies (SELECT/INSERT/UPDATE fuer trust_levels, SELECT/INSERT fuer activations)
- Schema-Cache-Reload via `NOTIFY pgrst`

### Schritt 2: TypeScript Types aktualisieren
Nach der Migration werden die Supabase Types automatisch regeneriert, sodass `recruiter_job_activations` und `recruiter_trust_levels` in `src/integrations/supabase/types.ts` enthalten sind.

### Schritt 3: `as any` Casts entfernen
In zwei Dateien werden die Type-Casts entfernt und durch die generierten Types ersetzt:

**`src/hooks/useJobActivation.ts`**:
- Alle `.from('recruiter_job_activations' as any)` zu `.from('recruiter_job_activations')`
- Alle `as any` auf Query-Chains entfernen
- `data as JobActivation[]` Cast entfernen (nicht mehr noetig)

**`src/hooks/useRecruiterTrustLevel.ts`**:
- Alle `.from('recruiter_trust_levels' as any)` zu `.from('recruiter_trust_levels')`
- Alle `as any` auf Query-Chains entfernen
- `data as RecruiterTrustLevel` Cast entfernen

### Was sich NICHT aendert
- Keine UI-Aenderungen
- Keine Logik-Aenderungen
- Keine Komponenten-Aenderungen
- Nur: DB-Tabellen erstellen, Types regenerieren, Casts entfernen

