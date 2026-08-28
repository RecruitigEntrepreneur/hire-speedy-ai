# Aufgaben & Task-Detail — was der Headhunter wirklich braucht

**Leitfrage:** Nicht „welche Felder fehlen", sondern: *Ein Headhunter setzt sich um 8:30 an den Schreibtisch. Was muss dieser Bildschirm leisten, damit er um 18:00 mehr Geld in der Pipeline hat als um 8:30?*

---

## 0. Was heute schon richtig gut ist

Damit das nicht untergeht — diese Entscheidungen sind richtig und sollten bleiben:

- **Geld steht auf der Karte.** `~€16k` pro Aufgabe. Kein anderes Recruiting-Tool traut sich das. Genau so denkt ein Headhunter.
- **Begründung statt Befehl.** „Das Interview war vor 149 Tagen — Eindruck einholen, solange er frisch ist." Das Warum steht da, nicht nur das Was.
- **Session-Modus mit Zeitschätzung.** „3 Aufgaben · ~9 min" senkt die Einstiegshürde. Sehr gut gedacht.
- **Ein Bildschirm, nicht fünf.** Kandidat, Job, Stage, Aktivität, Aktion in einem Dialog.

Die Grundidee stimmt. Was fehlt, ist die Hälfte danach.

---

## 1. Der Kernbefund: Aufgaben enden im Nichts

Heute kann eine Aufgabe genau zwei Enden nehmen: Häkchen oder Snooze. Beide werfen die eigentliche Information weg.

**Konkret geprüft:**

| Aktion | Was tatsächlich passiert |
|---|---|
| ✓ Erledigt (abgeleitete Aufgabe) | Ein Eintrag in `localStorage`, 3 Tage Unterdrückung. Kein DB-Vermerk, gerätelokal, für Team und Kunde unsichtbar. Auf dem Handy taucht die Aufgabe wieder auf. |
| 📞 Anrufen | `window.location.href = 'tel:…'`. Kein Ergebnis, kein Protokoll, keine Folgeaufgabe. |
| ✉️ Email | `mailto:` — leeres Fenster. |

Bei einem **Debrief** ist das besonders teuer: Der gesamte Wert dieser Aufgabe *ist* die Information. Wie lief das Gespräch? Was hat der Kunde gesagt? Will der Kandidat noch? Was ist der nächste Schritt? Genau das wird gerade weggeworfen — und es ist der wertvollste Datenpunkt im ganzen Produkt. Er würde speisen: Pipeline-Stage, Kundenreporting, Forecast, Matching-Lernschleife.

> **Was gebaut werden muss:** Jede Aufgabe endet in einem *Ergebnis*, nie in einem Häkchen. Für den Debrief: Ausgang (weiter / raus / Kunde zögert), O-Ton des Kunden, Kandidatenstimmung, nächster Schritt mit Datum. Drei Klicks und ein Freitextfeld. Daraus folgt automatisch die neue Stage und die nächste Aufgabe.

---

## 2. Die Liste ist ein Friedhof, kein Arbeitsmodus

Vier Aufgaben, **alle fünf Monate überfällig**. Ein Debrief nach 149 Tagen ist kein Debrief mehr — der Kandidat erinnert sich nicht, der Kunde hat längst besetzt oder abgebrochen.

Das ist das Glaubwürdigkeitsproblem der ganzen Seite. Wenn oben Leichen liegen, lernt der Headhunter binnen zwei Wochen, die Liste zu ignorieren. Dann ist das Feature wertlos — egal wie gut der Rest ist.

> **Was gebaut werden muss:** Ein Sterblichkeitsmodell. Nach X Tagen ohne Bewegung fragt das System aktiv: *„Dieser Deal liegt seit 90 Tagen. Abschließen? Grund?"* — mit Ein-Klick-Gründen (Kunde hat intern besetzt / Kandidat abgesprungen / Kunde meldet sich nicht / Bedarf entfallen). Das räumt die Liste auf, erzeugt Lerndaten und macht die verbleibenden Aufgaben wieder ernst.
>
> Zusätzlich: Eskalation. „Kunde antwortet seit 152 Tagen nicht" darf nicht ewig beim Recruiter liegen. Ab einer Schwelle gehört das an Account Management oder Admin.

---

## 3. Der Anruf ist die Kernhandlung — und er ist unsichtbar

Ein Headhunter telefoniert 20–40 Mal am Tag. Das ist *der* Beruf. Heute öffnet der Button den Dialer und danach weiß das System nichts.

Ergebnis: Die Liste stimmt schon am nächsten Morgen nicht mehr. Er hat angerufen, niemand ist rangegangen, die Aufgabe steht unverändert da — oder er hat sie abgehakt, obwohl nichts passiert ist.

> **Was gebaut werden muss:** Nach dem Auflegen ein Ergebnis in drei Klicks — *erreicht · Mailbox · Rückruf vereinbart am …* Daraus entsteht automatisch die Folgeaufgabe zum richtigen Zeitpunkt. Der Anrufversuch selbst wird protokolliert (auch der erfolglose — „3× versucht, nie erreicht" ist eine wichtige Information für den Kunden).

---

## 4. Nie ein leeres Textfeld

Der größte einzelne Zeitgewinn im Alltag: Der Headhunter soll nie vor einem leeren Feld sitzen.

Heute: `mailto:` → weiße Seite. Er tippt dieselbe Debrief-Nachfass-Mail zum 200. Mal.

> **Was gebaut werden muss:** Kontextbezogener Entwurf, den er in 10 Sekunden kürzt und sendet. Der Kontext ist vollständig vorhanden: Kandidat, Job, Stage, was zuletzt besprochen wurde, wie lange es her ist, was jetzt gebraucht wird. Die Edge Function `generate-outreach-email` existiert bereits — sie ist an dieser Stelle nur nicht angebunden.
>
> Zwei bis drei Tonlagen zur Auswahl (freundlich nachfassen / Dringlichkeit erzeugen / Abschluss suchen), sonst klingt alles gleich.

---

## 5. Nach Gegenüber bündeln, nicht nach Submission

Heute ist jede Aufgabe an eine Einreichung gebunden. In der Realität hängen bei *einem* Kunden drei Kandidaten seit fünf Monaten.

Das sind nicht drei Aufgaben. Das ist **ein Anruf**.

Ein Headhunter denkt in Beziehungen: *„Ich muss heute mit Frau Müller sprechen — es geht um drei Leute und €41k."* Die Oberfläche zwingt ihn, dreimal dasselbe Gespräch vorzubereiten.

> **Was gebaut werden muss:** Aufgaben nach Gegenüber gruppierbar — pro Kunde und pro Kandidat. Mit Sammel-Kontext („diese 3 hängen dort") und einer Aktion, die alle drei gleichzeitig weiterbewegt.

---

## 6. Priorisierung: Geld × Wahrscheinlichkeit × Verfall

„Impact 81 %" und „Influence Score 70/100" sind Systemmetriken. Sie beantworten nicht die Frage, die er morgens hat.

Seine Frage lautet: **Was verliere ich, wenn ich heute nichts tue?**

Ein €16k-Debrief, der 149 Tage alt ist, ist vermutlich schon verloren. Ein €10k-Deal im Angebotsstadium, der heute einen Anstupser braucht, ist lebendig. Die aktuelle Sortierung stellt beide nebeneinander.

> **Was gebaut werden muss:** Sortierung nach *erwartetem Verlust bei Nichtstun* — Fee × Abschlusswahrscheinlichkeit × Verfallsrate der Stage. Und ganz oben eine ehrliche Zeile: *„3 Deals sterben diese Woche: €31k."*

---

## 7. Vorbereitung im Moment des Handelns

Der Dialog zeigt „Letzte Aktivität": *Opt-In vom Recruiter bestätigt · Aufgabe erledigt: Interview-Anfrage*. Das sind **Systemereignisse**, keine Gesprächsinhalte.

Bevor er zum Hörer greift, braucht er anderes: Was habe ich diesem Menschen zuletzt gesagt? Was war offen? Was will er verdienen, was bietet der Kunde? Welche Einwände kamen?

> **Was gebaut werden muss:** Eine Gesprächshistorie neben der Systemhistorie — die letzten drei Notizen im Klartext, offene Punkte als Liste, Gehaltsvorstellung gegen Angebot, bekannte Einwände. Alles, was er sonst im Kopf oder in einem Notizbuch hat.

---

## 8. „Was passiert ohne mich?"

Es gibt Erinnerungen und automatische Nachfassungen im System. Der Recruiter sieht sie nicht.

Folge: Er fasst nach, obwohl das System gestern schon nachgefasst hat. Der Kandidat bekommt zwei Nachrichten und fühlt sich bedrängt.

> **Was gebaut werden muss:** Pro Aufgabe eine Zeile *„System hat am 12.07. und 19.07. erinnert — keine Reaktion."* Damit weiß er, ob sein Eingreifen der erste oder der vierte Kontakt ist.

---

## 9. Mobil ist der eigentliche Arbeitsplatz

Ein Headhunter telefoniert zwischen Terminen, im Auto, vor dem Kundengebäude. Diese Seite ist Desktop-first gedacht.

> **Was gebaut werden muss:** Eine einzige mobile Ansicht — *„Heute anrufen"*. Tippen zum Wählen, danach drei große Knöpfe für das Ergebnis. Mehr nicht. Das ist der wertvollste mobile Bildschirm im gesamten Produkt.

---

## 10. Der Session-Modus endet im Nichts

„Session starten (3 Aufgaben) · ~9 min" ist eine der besten Ideen der Seite. Aber was passiert am Ende?

> **Was gebaut werden muss:** Ein Abschluss. *„9 Minuten, 3 Deals bewegt, €38k weitergeschoben. Morgen warten 2 Aufgaben."* Das ist der Moment, der ihn morgen wiederkommen lässt. Außerdem: unterbrechbar und fortsetzbar — ein Anruf dauert selten 3 Minuten.

---

## 11. Kleinkram, der Vertrauen kostet

- Badge sagt **„Sonstiges"** bei einem Debrief, der Filter **„Sonstige (0)"** zählt null. Zwei Taxonomien, die nicht zusammenpassen.
- **„Erledigt" ist gerätelokal.** Am Handy taucht die Aufgabe wieder auf. Das untergräbt das Vertrauen in die Liste sofort.
- **Kein Rückgängig.** Versehentlich abgehakt = weg für 3 Tage, ohne Hinweis.

---

## Was ich zuerst bauen würde

Reihenfolge nach Wirkung pro Aufwand:

| # | Was | Warum zuerst |
|---|---|---|
| 1 | **Ergebnis-Erfassung statt Häkchen** (Debrief, Follow-up, Anrufergebnis) | Ohne das erzeugt die Seite keine Daten. Alles andere baut darauf auf — Forecast, Reporting, Lernschleife. |
| 2 | **Anrufergebnis + automatische Folgeaufgabe** | Macht die Liste zum ersten Mal *wahr*. Ohne das stimmt sie nach einem Tag nicht mehr. |
| 3 | **Deal-Sterblichkeit & Aufräumen** | Stellt die Glaubwürdigkeit her. Solange 5-Monate-Leichen oben liegen, nutzt niemand die Seite. |
| 4 | **Vorbefüllte Entwürfe** | Größter spürbarer Zeitgewinn im Alltag, Backend existiert bereits. |
| 5 | **Bündelung nach Kunde** | Verwandelt Aufgabenabarbeitung in Beziehungsarbeit — das ist der Beruf. |
| 6 | **Verlust-basierte Priorisierung** | Beantwortet endlich seine Morgenfrage. |
| 7 | **Mobile „Heute anrufen"** | Erschließt den Ort, an dem die Arbeit wirklich stattfindet. |

---

## Wenn das Team stark ist: drei ambitionierte Züge

**A. Der Debrief per Sprache.** Nach dem Kundengespräch spricht er 40 Sekunden ins Handy. Das System extrahiert daraus Ausgang, Einwände, nächsten Schritt und Termin — und aktualisiert Stage, Kundenreporting und Kandidatenprofil. Kein Headhunter tippt gern Protokolle. Aber jeder redet gern.

**B. Die Lernschleife schließen.** Das System erzeugt Aufgaben, erfährt aber nie, ob sie gewirkt haben. Mit erfassten Ergebnissen wird messbar: Welche Aktion rettet welchen Deal-Typ? Wann ist Nachfassen sinnvoll, wann verbrannt? Nach 500 Ergebnissen priorisiert das System nicht mehr nach Heuristik, sondern nach Evidenz. Genau das ist der Graben zum Wettbewerb.

**C. Der Kunde als eigenes Objekt.** Heute dreht sich alles um Einreichungen. Ein Headhunter verdient sein Geld über Kundenbeziehungen. Eine Kundensicht mit Reaktionszeit, offenen Entscheidungen, Wert in der Pipeline und Gesprächshistorie — das ist die Grundlage für „welche drei Kunden rufe ich diese Woche an".

---

## Die eine Frage, an der sich alles messen lässt

> *Nach einer Woche Nutzung: Weiß der Headhunter mehr über seine Deals als vorher — oder hat er nur Häkchen gesetzt?*

Heute lautet die Antwort: Häkchen. Punkt 1 und 2 der Reihenfolge oben drehen genau das um.
