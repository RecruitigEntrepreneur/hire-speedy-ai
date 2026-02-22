

# Key Facts: Von Grid-Kacheln zu kompakter Inline-Zeile

## Problem
Die 5 Kacheln (Seniority, Gehalt, Verfuegbar, Remote, Fuehrung) nehmen eine komplette Zeile mit grossen Boxen, Icons, Borders und Padding ein. Das ist zu viel Platz fuer 5 kurze Werte.

## Loesung
Statt 5 separater Karten eine **einzelne horizontale Zeile** mit Trennzeichen -- aehnlich wie die Meta-Zeile unter dem Namen. Fehlende Werte werden dezent angezeigt statt als eigene Box.

**Vorher (5 Kacheln mit Borders):**
```text
+----------+ +----------+ +----------+ +----------+ +----------+
| Seniority| |  Gehalt  | | Verfuegb.| |  Remote  | | Fuehrung |
| Director | | 185-220k | | 6 Monate | |  Fehlt   | |  Fehlt   |
+----------+ +----------+ +----------+ +----------+ +----------+
```

**Nachher (eine kompakte Zeile):**
```text
Director  .  185k-220k EUR  .  6 Monate  .  Remote: --  .  Fuehrung: --
```

Jeder Fakt wird als `Icon + Label: Wert` dargestellt, getrennt durch einen Punkt. Fehlende Werte zeigen "--" in gedaempfter Farbe statt "Fehlt" in einer auffaelligen Amber-Box. Vorhandene Werte mit Highlight (Gehalt, Remote) bekommen eine dezente farbige Text-Farbe statt einer ganzen farbigen Box.

## Technische Details

| Datei | Aenderung |
|---|---|
| `CandidateKeyFactsGrid.tsx` | Grid-Layout durch `flex flex-wrap items-center gap-x-4 gap-y-1` ersetzen. Kacheln werden zu inline `span`-Elementen mit kleinem Icon + Text. Keine Borders, kein Padding, keine Karten. |

- Icons bleiben erhalten aber kleiner (`h-3.5 w-3.5`)
- Labels werden inline vor den Wert gesetzt: `Gehalt: 185k-220k EUR`
- Fehlende Werte: `text-muted-foreground` mit "--" statt amber Box
- Gehalt-Highlight: gruener Text statt gruene Box
- Remote-Highlight: blauer Text statt blaue Box
- Trennzeichen: `text-border` Punkt zwischen den Fakten

