
# Fix: 540 doppelte Ghosting-Alerts stoppen

## Das Problem

Der Kandidat "Philipp Numberger" hat **540 identische** "Ghosting-Risiko!" Alerts. Alle 30 Minuten kommt ein neuer dazu.

**Ursache:** Die Duplikat-Pruefung in der `influence-engine` Edge Function ist fehlerhaft:

```text
.select('id')
.eq('submission_id', ...)
.eq('alert_type', 'ghosting_risk')
.eq('is_dismissed', false)
.single()    <-- DAS IST DAS PROBLEM
```

`.single()` gibt einen Fehler zurueck wenn MEHR ALS EIN Ergebnis existiert. Sobald das erste Duplikat entsteht (z.B. durch Race Condition), findet `.single()` 2+ Treffer, wirft einen Fehler, `existingAlert` wird `null`, und ein NEUES Duplikat wird eingefuegt. Beim naechsten Lauf findet `.single()` dann 3+ Treffer -- und so weiter. Klassischer Schneeballeffekt.

## Loesung: 2 Schritte

### Schritt 1: Bestehende Duplikate bereinigen (SQL)

540 Duplikate auf 1 reduzieren -- den neuesten Alert behalten, alle anderen loeschen.

```sql
DELETE FROM influence_alerts
WHERE id NOT IN (
  SELECT DISTINCT ON (submission_id, alert_type)
    id FROM influence_alerts
  ORDER BY submission_id, alert_type, created_at DESC
)
AND submission_id IN (
  SELECT id FROM submissions
  WHERE candidate_id = 'ca3bffd7-38b5-46d1-a4b9-3fe41b315dfb'
);
```

### Schritt 2: Duplikat-Pruefung in der Edge Function fixen

**Datei:** `supabase/functions/influence-engine/index.ts`

Die fehlerhafte `.single()` Methode wird durch `.maybeSingle()` ersetzt, alternativ durch `.limit(1)`:

```text
Vorher:  .single()       -- Fehler bei 2+ Treffern
Nachher: .maybeSingle()  -- Gibt null bei 0 Treffern, 1 Objekt bei 1+ Treffern, kein Fehler
```

Zusaetzlich wird die Pruefung robuster gemacht: Statt nur `is_dismissed = false` wird auch `action_taken IS NULL` geprueft, damit erledigte Alerts nicht faelschlich als "nicht vorhanden" gelten.

## Dateien

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| SQL Migration | 539 Duplikate loeschen | S |
| `supabase/functions/influence-engine/index.ts` | `.single()` durch `.maybeSingle()` ersetzen | S |
