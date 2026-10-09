# Aufgaben-Katalog: alle Aufgaben, ihre klickbaren Antworten, die Prozesse

Stand 09.10.2026. Gehört zu `AUFGABEN_ZIELBILD.md`. Jede Aufgabe = eine Zeile je Deal. Jede Antwort ist ein Knopf. Jede Antwort ändert einen Zustand oder schreibt einen Beleg (Aktivitätslog), sonst ist sie keine Antwort.

## Antworten, die es überall gibt

| Knopf | Was passiert |
|---|---|
| **Anrufen** | wählt (tel:), danach Rückfrage „Erreicht?“ mit einer Notizzeile. Ja → Beleg im Aktivitätslog + je Aufgabe eine Folgefrage (unten). Nein → Wiedervorlage in 2 Std., zweimal, dann „Erinnerung senden“ als Vorschlag. |
| **Notiz** | eine Zeile, landet im Aktivitätslog des Kandidaten mit Bezug zur Einreichung. |
| **Später** | Morgen · 3 Tage · Wenn die Gegenseite antwortet (was zuerst eintritt). Serverseitig, geräteübergreifend. |
| **Zur Akte / Zur Stelle / Zur Einreichung** | öffnet den vorhandenen Ort. |
| **Entwurf senden** (Stufe 2) | Text prüfen, bearbeiten, senden. Geht nie ohne Klick raus. |

## Katalog

| # | Aufgabe | Auslöser und Zeitpunkt | Zeilentext (Beispiel) | Klickbare Antworten | Verschwindet, wenn |
|---|---|---|---|---|---|
| 1 | **Erste Einreichung fällig** | Stelle aktiviert, keine Einreichung, Tag 20 (Platz endet Tag 30) | „Stelle #4390 · 12 Tage ohne Einreichung. Platz endet in 18 Tagen.“ | **Kandidaten** (öffnet Matches mit Belegen) · **Suche abgeben** (Platz frei, Grund) · Später | eingereicht oder abgegeben |
| 2 | **Akte vervollständigen** | Kandidat soll eingereicht werden, Pflichtfelder fehlen | „Katharina Brenner · Gehaltsvorstellung und Kündigungsfrist fehlen fürs Exposé.“ | **Eintragen** · **Anrufen** → Erreicht? → Felder eintragen · Überspringen | Felder gefüllt |
| 3 | **Einladung unbeantwortet** (Opt-In) | Kunde hat Interview angefragt, Kandidat hat nach 24 h nicht reagiert; ab 48 h dringend | „Imran Türe · Einladung seit 2 Tagen offen, Kunde wartet. Terminvorschläge Mo/Di/Mi.“ | **Anrufen** → Erreicht? → *Hat gewählt* (fertig) / *Wählt heute* (Später bis heute Abend) / *Lehnt ab* → Grund → **Anfrage zurückziehen** · **Erinnerung senden** (Mail/SMS an Kandidaten mit Link) · **Anfrage zurückziehen** | Kandidat hat gewählt, abgelehnt, oder Anfrage zurückgezogen |
| 4 | **Kunde bittet um Erinnerung** | Kunde klickt „Erinnern“ | wie 3, Zeile oben, Zusatz „Kunde hat heute nachgefragt“ | wie 3 · **Kunden informieren** („Kandidat erreicht, Antwort bis morgen“, als Plattform-Notiz) | wie 3 |
| 5 | **Gegenvorschlag liegt beim Kunden** | Kandidat hat andere Zeit vorgeschlagen, Kunde hat nach 48 h nicht bestätigt | „Jonas Kreuzer · Gegenvorschlag Mi 10:00 liegt seit 2 Tagen beim Kunden.“ | **Kunden erinnern** (Plattform-Benachrichtigung, einmal) · **Kandidat um weitere Zeiten bitten** · Später | Kunde bestätigt oder neue Anfrage |
| 6 | **Kandidat briefen** | Termin steht, 24 h vorher | „Jonas Kreuzer · Interview morgen 14:00 bei DataDriven. Vorbereitung liegt bereit.“ | **Anrufen** → Erreicht? → *Gebrieft* (Beleg) · **Vorbereitung senden** (Mail an Kandidaten) · Überspringen | gebrieft oder Termin vorbei |
| 7 | **Debrief erfassen** | Termin vorbei, kein Debrief von dir; dringend ab 24 h | „Jonas Kreuzer · Interview war Mo 14:00. Dein Debrief fehlt.“ | **Debrief** (Sheet: Notiz, Empfehlung *Weiter / Unsicher / Nicht passend*, speichert, setzt „Interview geführt“) · **Nicht erschienen** → wird Aufgabe 9 · Später | Debrief gespeichert |
| 8 | **Kundenfeedback fehlt** | 48 h nach Termin ohne Feedback des Kunden | „DataDriven · Feedback zum Interview mit Jonas steht seit 2 Tagen aus.“ | **Kunden erinnern** (Plattform, einmal je 48 h) · Später bis Kunde antwortet | Feedback da |
| 9 | **No-Show** | Kunde meldet No-Show | „Imran Türe · ist zum Interview nicht erschienen. Kunde wartet auf Erklärung.“ | **Anrufen** → Erreicht? → *Grund + will neuen Termin* → **Kunden um neue Zeiten bitten** / *Kandidat raus* → **Zurückziehen** · **Kunden informieren** | neuer Termin oder zurückgezogen |
| 10 | **Kandidat hat abgelehnt** | Kandidat lehnt Interview per Link ab | „Boris Becker · hat das Interview abgelehnt: ‚Gehalt zu niedrig‘.“ | **Anrufen** → Erreicht? → *Doch interessiert* → **Kunden um neue Anfrage bitten** / *Bleibt dabei* → **Zurückziehen** · **Alternative vorschlagen** (Matches auf der Stelle) | zurückgezogen oder neue Anfrage |
| 11 | **Kunde prüft ohne Antwort** | eingereicht, Tag 3, dann 7, dann 14 | „Marko Benko · Kunde prüft seit 8 Tagen. Entscheidung bis Freitag erbitten.“ | **Kunden erinnern** (Plattform-Benachrichtigung + Mail an Ansprechpartner, einmal je Stufe; Tag 14 macht Matchunt es selbst) · **Anrufen** (nach Reveal, wenn Kontakt bekannt) · Notiz · Später bis Kunde antwortet | Stage bewegt sich |
| 12 | **Kunde hat abgesagt** | Absage mit Grund | „Silvio Scheidler · Kunde hat abgesagt, Grund Gehalt. Silvio weiß es noch nicht.“ | **Anrufen** → Erreicht? → *Informiert* (Beleg) → Frage: **In Talent-Pool?** · **Nachricht senden** (Entwurf, Grund neutral) · **2 passende Stellen** → **Einreichen** | Aktivität geloggt |
| 13 | **Angebot ohne Reaktion** | Angebot gesendet, 48 h nicht geöffnet oder 48 h vor Ablauf | „Lena K. · Angebot seit Dienstag ungeöffnet, läuft Freitag ab. 62 k, Erwartung 64 k.“ | **Anrufen** → Erreicht? → *Nimmt an* (sie klickt den Link) / *Verhandelt* → **Kunden informieren** (Gegenwunsch, ohne Schmerzgrenze) / *Lehnt ab* → Grund · **Kunden um Verlängerung bitten** | angenommen, abgelehnt, abgelaufen |
| 14 | **Gegenangebot liegt beim Kunden** | Kandidat hat Gegenangebot gemacht, Kunde reagiert 48 h nicht | „Lena K. · Gegenangebot 64 k liegt seit 2 Tagen beim Kunden.“ | **Kunden erinnern** · Später | Kunde entscheidet |
| 15 | **Nach dem Start** | Placement, Tag 1 · 7 · 30 · 14 Tage vor Garantie-Ende | „Max R. · Tag 30 bei DataDriven. Kurz nachhören.“ | **Anrufen** → Erreicht? → *Alles gut* / *Risiko* → Notiz + **Kunden informieren** (Stufe 2: Entwurf) · Überspringen | Beleg oder Datum vorbei |
| 16 | **Deal ohne Bewegung** | 21 Tage in derselben Stufe, keine Antwort | „Vladislav Chelakov · seit 241 Tagen beim Kunden ohne Antwort. Noch aktiv?“ | **Noch aktiv** (ruhig für 14 Tage) · **Zurückziehen** → Grund (*Kandidat abgesprungen / anderswo unterschrieben / keine Rückmeldung / passt nicht*) → Kunde wird informiert · **Kunden erinnern** | entschieden |
| 17 | **Eigene Erinnerung** | du hast sie angelegt | „Referenz bei Ex-Chef einholen · Katharina Brenner“ | **Erledigt** · Später · Löschen | erledigt |
| 18 | **Autopilot braucht dich** (Stufe 4) | Matchunt hat erinnert/nachgefasst, Frist ohne Ergebnis | „Imran Türe · Matchunt hat zweimal erinnert, keine Antwort.“ | wie 3 | wie 3 |

Nicht als Aufgabe, nur als Zeile unter „Wartet auf andere“: Einladung unter 24 h beim Kandidaten · Kunde prüft unter 3 Tagen · Gegenvorschlag unter 48 h · Angebot unter 48 h · Termin steht (bis 24 h vorher) · Kundenfeedback unter 48 h.

## Vier Prozesse mit echten Kandidaten

### A · Jonas Kreuzer × Data Scientist, DataDriven GmbH (der gute Fall)

| Tag | Was passiert | Deine Zeile | Du klickst | Danach |
|---|---|---|---|---|
| Mo 06.10. 14:12 | Kunde fragt Interview an, 5 Zeiten. Einladung geht an Jonas. | Wartet: „Einladung seit heute bei Jonas“ | nichts | — |
| Di 07.10. 14:12 | 24 h ohne Antwort | **Einladung unbeantwortet** | Anrufen → Erreicht? → „Wählt heute“ | Später bis 20:00 |
| Di 07.10. 18:40 | Jonas wählt Di 13.10. 14:00 | Zeile weg. Wartet: „Termin steht“ | — | Kunde bekommt „Interview steht“ |
| Mo 12.10. 14:00 | 24 h vorher | **Kandidat briefen** · „Vorbereitung liegt bereit“ | Anrufen → Erreicht? → Gebrieft | Beleg, Zeile weg |
| Di 13.10. 15:00 | Termin vorbei | **Debrief erfassen** | Debrief → „Weiter“, 3 Sätze | „Interview geführt“, Kundenfassung zur Freigabe (Stufe 2) |
| Do 15.10. 15:00 | Kunde hat kein Feedback | **Kundenfeedback fehlt** | Kunden erinnern | Zeile weg bis Antwort |
| Fr 16.10. | Kunde: „Weiter“, Runde 2 angefragt | wieder ab Zeile 1 für Runde 2 | … | … |
| Fr 23.10. | Angebot 72 k gesendet | Wartet: „Angebot bei Jonas, bis 30.10.“ | nichts | — |
| So 25.10. | 48 h ungeöffnet | **Angebot ohne Reaktion** | Anrufen → „Nimmt an“ | Jonas klickt, Placement entsteht |
| Mo 05.01. | Tag 1 | **Nach dem Start** | Anrufen → Alles gut | Beleg |
| Mo 12.01. / Mi 04.02. / 14 Tage vor Garantie-Ende | Tag 7 / 30 / Ende | **Nach dem Start** | Anrufen → Alles gut | Garantie abgelaufen, Provision sicher |

Du hast in drei Monaten sechs Zeilen gesehen und sechs Anrufe geführt. Alles andere lief.

### B · Marko Benko × Frontend Developer (Vue.js) (der Kunde schweigt)

| Tag | Was passiert | Deine Zeile | Du klickst | Danach |
|---|---|---|---|---|
| 30.09. | eingereicht | Wartet: „Kunde prüft seit heute“ | — | — |
| 03.10. (Tag 3) | keine Antwort | **Kunde prüft ohne Antwort** | Kunden erinnern | Kunde: Benachrichtigung + Mail; Zeile weg bis Tag 7 |
| 07.10. (Tag 7) | keine Antwort; Kunde hat am 06.10. einen anderen Kandidaten eingeladen | **Kunde prüft ohne Antwort** · Kontext: „1 Mitbewerber im Interview“ | Anrufen (Reveal ist da) → Erreicht? → „Entscheidung bis Fr zugesagt“ | Später bis Fr |
| 14.10. (Tag 14) | immer noch nichts | Matchunt fasst selbst nach, du siehst es unter „Matchunt hat erledigt“ | nichts | — |
| 21.10. (Tag 21) | nichts | **Deal ohne Bewegung · Noch aktiv?** | Zurückziehen → „keine Rückmeldung“ | Kunde informiert, Stage withdrawn, Marko bleibt in deiner Akte für die nächste Stelle |

### C · Silvio Scheidler × Buchhalter (m/w/d) (die Absage)

| Tag | Was passiert | Deine Zeile | Du klickst | Danach |
|---|---|---|---|---|
| 23.07. 09:10 | Kunde sagt ab, Grund Gehalt | **Kunde hat abgesagt** · „Silvio weiß es noch nicht“ | Anrufen → Erreicht? → Informiert → „In Talent-Pool? Ja“ | Beleg, Talent-Pool-Markierung |
| gleicher Tag | Matching findet 2 Stellen mit Gehalt in Silvios Spanne | Zeile zeigt „2 passende Stellen“ | Einreichen auf Stelle #4512 | neuer Deal, Prozess B oder A beginnt |
| ohne Stellen | — | Zeile weg nach dem Anruf; Silvio taucht wieder auf, sobald eine Stelle passt (Aufgabe 1 auf der neuen Stelle nennt ihn) | — | — |

### D · Imran Türe × Buchhalter (m/w/d), HealthTech (der Kandidat schweigt, Autopilot)

| Tag | Was passiert | Deine Zeile | Du klickst | Danach |
|---|---|---|---|---|
| Mo 08:00 | Kunde fragt an | Wartet | — | — |
| Di 08:00 (24 h) | keine Antwort; Autopilot (deine Grenze: Erinnerung an Kandidaten darf allein laufen) schickt Erinnerung | „Matchunt hat erledigt: Imran erinnert“ | nichts | — |
| Mi 08:00 (48 h) | Kunde klickt „Erinnern“ | **Kunde bittet um Erinnerung** · ganz oben | Anrufen → nicht erreicht | Wiedervorlage 10:00 |
| Mi 10:00 | Wiedervorlage | dieselbe Zeile | Anrufen → Erreicht? → „Lehnt ab, hat anderswo unterschrieben“ | Anfrage zurückziehen, Grund an Kunden, Imran aus dem Prozess, Kunde sieht „Headhunter hat reagiert“ |

## Was dafür gebaut werden muss (über Stufe 1 hinaus)

Rückfrage „Erreicht?“ mit Folgefragen je Aufgabe (S) · Wiedervorlage in 2 Std. (S) · Kunden erinnern als Plattform-Benachrichtigung + Mail an den Ansprechpartner, einmal je Stufe (M) · Zurückziehen mit Grund (S) · Erinnerung an Kandidaten mit Link (S, Mail existiert, Resend-Vorlage) · Angebote für Recruiter sichtbar (S) · Platzfrist als Zeile (S) · Nach-dem-Start-Zeilen aus `placements` (S) · Kundensicht „Headhunter hat reagiert“ (M) · Autopilot-Grenzen in den Einstellungen (M, Stufe 4).
