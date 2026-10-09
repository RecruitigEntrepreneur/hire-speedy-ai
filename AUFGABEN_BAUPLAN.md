# Aufgaben „Heute“: Bauplan (Stand der Wireframes 09.10.2026)

Gehört zu `AUFGABEN_ZIELBILD.md` (Ziel), `AUFGABEN_KATALOG.md` (18 Zeilentypen, Antworten, Prozesse), `AUFGABEN_ANALYSE_2026-10-08.md` (Befunde, Backend-Entwurf, Welle 0). Dieser Plan beschreibt die Oberfläche, wie sie nach dem Durchgang mit Marko gebaut wird.

## Entscheidungen aus dem Durchgang

- Eine Seite „Heute“, eine Spalte, keine rechte Spalte. Score, Session-Dialog, Filter-Chips, Kartenraster, Dialog in der Mitte, Playbooks, Performance Intel entfallen.
- Zeilen sind **kompakt** (Pille, Name, ein Satz, ein Knopf). Details nur **aufgeklappt**, nur eine Zeile offen. Klick auf den Namen öffnet die Akte.
- Aufgeklappt: zwei Blöcke **Grund** (Fakten mit Zahlen, Folge bei Untätigkeit) und **Deine Aufgabe** (nummerierte Schritte, Sprechsatz), darunter **Ziel heute** und die Knöpfe „Schritt 1 / Schritt 2“.
- Gruppierung oben nach Person („Jetzt“), ein Anruf deckt mehrere Deals ab. Unten „Wartet auf andere“, „Ohne Bewegung“, „Erledigt“ als Zahlen.
- Kopf: Fortschrittsring (erledigt/heute), ein Satz (Gespräche, Geld im Spiel, erstes Ziel), Knopf „Anrufe starten“.
- Zeile „Seit gestern“ (Ereignisse), Schnellerfassung (Notiz/Erinnerung, Diktat am Handy).
- Blöcke: „Die Woche“ (5 Felder), „Termine heute“ (Countdown), „Chancen“ (Matches, Platzfristen), „Matchunt hat erledigt“ (Autopilot-Protokoll).
- „Erreicht?“ nach jedem Anruf als Beleg mit typabhängigen Folgeantworten; „Später“ mit Rückkehr-Bedingung; „Zurückziehen“ mit vier Gründen; eigene Erinnerung mit drei Feldern.
- Dialer: Vollbild, 1 von n, Aufgabe + Grund + Verlauf + Notiz, Erreicht, Weiter.
- Kundenkanal klein: „Kunden erinnern“ (Bitte + Text, einmal je Stufe, Tag 14 übernimmt Matchunt) und „Kunden informieren“ (vorgegebene Zeile). Kunde sieht Benachrichtigung mit Antwortknöpfen (Interview / Absage / Noch in Prüfung) und Spiegelzeile „Headhunter hat reagiert“. Ohne Namen vor Opt-In.
- Angebote lesbar für Recruiter. Kandidaten-Erinnerung aus der Zeile. Debrief über das bestehende Sheet, setzt „Interview geführt“, „Nicht passend“ fragt „Zurückziehen?“.
- Dieselbe Zeile auf Dashboard (3 Zeilen, aufklappbar), Kandidatenakte (gefiltert), Interviews (Debrief), Benachrichtigungen (Verweis „Aufgabe →“). Seitenleiste: „Heute“ mit Zähler.
- Leerzustand: „Nichts braucht dich. n Deals laufen.“ + Wochenvorschau + „Sonst nichts.“ Handy: dieselbe Liste, Tippen klappt auf, Wischen = Später.

## Reihenfolge

1. **Welle 0** (≤ 1 Tag): Absturz, Debrief-Wahrheit, Snooze, Refetch-Sturm, Rechteprüfung Absage, Streichliste. Siehe Analyse Abschnitt 8.
2. **Stufe 1a** (Migration A + Frontend): Marks-Tabelle, Lese-View `recruiter_open_actions`, Seite „Heute“ mit kompakten Zeilen, Grund/Aufgabe aus Vorlagen je Typ (ohne Modell), Erreicht?, Später, eigene Erinnerung, Dashboard/Akte/Interviews/Glocke aus derselben Quelle, Leerzustand, Handy.
3. **Stufe 1b**: Zurückziehen mit Grund, Angebotssicht, Kandidaten-Erinnerung, Platzfrist- und Garantie-Zeilen, Benachrichtigungen mit Handlungsbedarf als Zeilen.
4. **Stufe 1c (Kundenkanal klein)**: RPC für Kunden erinnern/informieren, Kunden-Benachrichtigung mit Antwortknöpfen, Spiegelzeile, Tag-14-Übernahme durch Matchunt.
5. **Stufe 1d**: Dialer, Woche, Seit gestern, Chancen, Ring, Schnellerfassung (ohne Diktat).
6. **Stufe 2**: Entwürfe (Kunde, Kandidat, Debrief-Kundenfassung) mit Pseudonymisierung, Diktat, Kundenverhalten, Erreichbarkeit.
7. **Stufe 3/4**: Vorhersage, Autopilot mit Grenzen, „Matchunt hat erledigt“ mit echter Automatik.

## Daten, die neu entstehen

`recruiter_action_marks` (Später, Wiedervorlage, Noch aktiv) · Ergebnis im Aktivitätslog-Metadata (erreicht, Folgeantwort, Grund) · Rückzugsgrund an der Einreichung · Kunden-Benachrichtigung mit Antwortoptionen + Sperre je Stufe · Autopilot-Grenzen (Stufe 4). Alles andere ist vorhanden (siehe Katalog, Abschnitt Daten).
