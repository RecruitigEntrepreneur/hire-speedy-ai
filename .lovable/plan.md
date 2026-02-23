
# Aufgaben-Karten im Dashboard verbessern

## Probleme

1. **Farbe passt nicht** -- Die amber/gelbe Farbgebung fuer dringende Karten wirkt nicht stimmig
2. **Karten nicht klickbar** -- Nur der Kandidatenname ist anklickbar, die gesamte Karte sollte klickbar sein
3. **Ueberall "Interview-Anfrage"** -- Da die meisten Alerts vom Typ `opt_in_pending` sind, steht ueberall dasselbe Label. Stattdessen soll der Titel/Kontext der Aufgabe sichtbar sein

## Loesung

### Datei: `src/components/influence/CompactTaskList.tsx`

**Karten klickbar machen:**
- Die gesamte `TicketCard` wird in ein klickbares `div` mit `cursor-pointer` und `onClick` umgewandelt
- Beim Klick wird `onViewCandidate(alert.submission_id, alert.id)` aufgerufen
- Der separate Name-Button wird durch normalen Text ersetzt

**Farben anpassen:**
- Dringende Karten: Von `amber` auf ein dezenteres, professionelleres Farbschema wechseln (z.B. `border-l-red-500` mit leichtem `bg-red-50/50` oder `border-l-primary`)
- "Dringend"-Badge und Section-Header: Ebenfalls dezenter gestalten
- Hover-Effekt fuer alle Karten hinzufuegen (`hover:shadow-sm hover:border-primary/30`)

**Label-Logik verbessern:**
- Statt nur den Alert-Typ als Badge anzuzeigen, den konkreten Aufgaben-Kontext (Job-Titel oder kurze Beschreibung) prominenter darstellen
- Badge zeigt weiterhin den Typ, aber der Titel der Aufgabe (aus `alert.title`) wird als Hauptzeile genutzt statt nur "Kandidat"
- Wenn der Alert-Typ `opt_in_pending` ist, wird z.B. "Opt-In einholen" statt "Interview-Anfrage" angezeigt

### Technische Details

```text
Vorher:                          Nachher:
+---------------------------+    +---------------------------+
| [Interview-Anfrage] [x]  |    | [Opt-In einholen]    [x]  |
| Andreas Plagniat          |    | Andreas Plagniat          |
| Buchhalter @ [HealthTech] |    | Buchhalter @ [HealthTech] |
| [phone] [mail]            |    | [phone] [mail]            |
+---------------------------+    +---------------------------+
  amber Rand, nicht klickbar       dezenter Rand, ganze Karte
                                   klickbar mit Hover-Effekt
```

Aenderungen nur in einer Datei: `src/components/influence/CompactTaskList.tsx`
