# Matching – Analyse und Zielbild

Stand 30.09.2026. Grundlage: Code-Analyse (3 parallele Prüfungen), Live-Aufrufe auf matchunt.ai mit Headhunter-Konto, Messlauf des Eval-Harness (`evals/`).

## Kurzfazit

Das Matching rechnet heute mit V3.1 (`supabase/functions/calculate-match-v3-1/index.ts`, seit Februar unverändert). Es hat eine gute Grundidee (harte Ausschlüsse → Punkte → Stufen → Begründungen), aber die Eingangsdaten passen nicht zur Rechnung, fehlende Daten zählen als Bestwert und die Oberfläche nutzt kaum etwas davon. Ergebnis für den Headhunter: falsche Stellen oben, richtige Stellen unten, erfundene Begründungen, und von der Stelle aus gibt es gar keine Vorschläge aus dem eigenen Pool. Auf echten Daten steht der erste richtige Treffer im Schnitt erst auf Platz 4 (MRR 0,26), unverändert seit Juli.

## Live-Beispiele (30.09., Vorschau-Modus)

| Kandidat → Stelle | Ergebnis | Warum |
|---|---|---|
| Lena (Patientenservice) → Senior Softwareentwickler Backend | **75 %, „passend“** | Stelle hat keine Muss-Kriterien → Abdeckung 100 %, Skills neutral 50. Begründungen „Gehalt im Budget“ (46k bei 90–110k), „kurzfristig verfügbar“ (sie hat 3 Monate zum Quartalsende) |
| Lena → Mitarbeiter:in Patientensupport (ihre eigentliche Stelle) | **69 %, „vielleicht“** | Muss-Kriterien sind Satzstücke: „DSGVO im Gesundheitswesen“ trifft „datenschutz im gesundheitswesen (dsgvo)“ nicht, „Medizinische Terminologie“ trifft „medizinische grundkenntnisse / nomenklatur“ nicht, Deutsch fehlt (Sprachen werden nicht gelesen) |
| Jonas (Senior Data Scientist) → Data Scientist | 90 %, „sehr passend“ | 8 Treffer, aber „data science“ fehle angeblich; „kurzfristig verfügbar“ trotz 3 Monaten |
| Jonas → Senior Full-Stack Developer | ausgeblendet | richtig (0 % Muss-Abdeckung) |

Live-Datenlage (31 veröffentlichte Stellen): 1 Stelle mit Pflichtsprachen (Finance Manager: Deutsch C1, Englisch B2) → **dort fällt jeder Kandidat raus**; 1 Stelle mit Pflichtzertifikat → ebenso; 28 Stellen mit Muss-Kriterien als Satzfragmente, teils an Kommas zerrissen („Fähigkeit“, „sich in komplexe Fragestellungen reinzudenken“); nur 3 Stellen mit der vom Kunden bestätigten Einstufung unverzichtbar/verhandelbar/lernbar – die liest der Matcher nicht.

## So funktioniert V3.1 heute (vereinfacht)

1. **Laden:** `matching_config`, `candidates.*`, `jobs.*`, `job_skill_requirements`, Taxonomie, Synonyme. **Nicht geladen:** `candidate_interview_notes` (die ganze Kandidatenakte aus dem Interview) und `candidate_languages`.
2. **Harte Ausschlüsse (Score 0):** Visum, Pflichtsprache, Präsenzpflicht (nur `remote_only`), Zertifikate.
3. **Dealbreaker-Faktor (multipliziert, min. 0,05):** Gehalt über Budget (schon 1 % drüber → ×0,6), Starttermin, Seniority-Abstand (unbekannt = „mid“), Remote vs. Vor Ort, Domäne (13 fest verdrahtete Domänen).
4. **Fit (70 %):** Skills 50 %, Erfahrung 15 %, Seniority 3 %, Branche 2 % – Muss-Abdeckung über Teilstring-Vergleich, Synonyme, Taxonomie. Keine Muss-Kriterien → Abdeckung 1,0, Skills 50.
5. **Rahmen (30 %):** Gehalt, Pendeln, Start. Fehlende Daten → 100 Punkte.
6. **Stufen:** sehr gut ≥80 & Abdeckung ≥0,8 · passend ≥65 & ≥0,6 · vielleicht ≥45 & ≥0,4 · sonst ausgeblendet. Im Modus „strict“ (beim Einreichen) Ausschluss unter 0,4 Abdeckung.
7. **Begründungen:** Regeltexte aus Schwellen.
8. **Schreiben:** bei jedem Aufruf eine Zeile pro Paar in `match_outcomes` (auch bei jedem Profilbesuch, >10.000 Zeilen, als Lerndaten unbrauchbar).

V4 (KI-Prüfer mit Belegpflicht, Normalizer für Anforderungen, Lernprotokoll) ist gebaut und deployt, läuft aber nur im Schatten; die Oberfläche ruft es nicht auf.

## Befunde nach Schwere

### P0 – falsch oder gefährlich

1. **Sicherheit:** `calculate-match-v3-1` arbeitet mit dem Service-Schlüssel und prüft den Aufrufer nicht. Live bestätigt: Der öffentliche App-Schlüssel allein genügt, die Funktion sucht dann beliebige Kandidaten-IDs. Beispiel-IDs (`aaaa4444-…`) sind erratbar. Gleiches Muster bei `talent-pool-match` (`verify_jwt=false`).
2. **Sprach-Ausschluss trifft alle:** Matcher liest `candidates.language_skills` (schreibt niemand), Sprachen liegen in `candidate_languages` („Deutsch“, „Muttersprache“/„native“/„fluent“), Vergleich erwartet ISO-Code + A1–C2 (`:921–941`). Jede Stelle mit Pflichtsprache verschwindet für jeden Kandidaten. Der Anzeigen-Parser setzt seit September „Deutsch C1“ als Standard (`_shared/skills.ts:258–263`).
3. **Zertifikats-Ausschluss trifft alle:** Matcher liest `certifications`, Akte und CV schreiben `certificates` (`candidateDossier.ts:448`, `:953–964`).
4. **Visum:** `visa_sponsorship` leer zählt als „nein“ → wer ein Visum braucht, fliegt überall raus (`:916`).
5. **Schein-Treffer:** Teilstring in beide Richtungen (`:1298`, Synonyme `:1309`): „javascript“ erfüllt „java“, kurze Synonyme wie „ng“, „ap“, „ai“, „ts“ treffen fremde Wörter („Patientenbetreuung“ → Angular).
6. **Fehlende Daten = Bestwert:** Stelle ohne Muss-Kriterien, Kandidat ohne Gehalt/Start → 75 %, „passend“. Genau so landet eine Servicekraft bei „Senior Softwareentwickler“. Domänen-Schutz greift nicht (Titel wie „Softwareentwickler“ stehen in keiner Domänenliste).

### P1 – verzerrt die Reihenfolge

7. **Erfundene Begründungen:** „Gehaltsvorstellung im Budget“ und „Kurzfristig verfügbar“ auch ohne Daten; `notice_period` wird nie gelesen (`:1616`, `:1633`).
8. **Starttermin:** 3 Monate Kündigungsfrist als Datum → ×0,4; ohne Datum volle Punkte. Besetzungsdatum der Stelle fließt nicht ein.
9. **Gehalt:** 1 % über Budget → ×0,6; Schmerzgrenze nur Ersatzwert; `salary_fix` (alter Dialog) wird nicht gelesen; Tagessätze bei Contracting ohne Prüfung; unter Budget („46k bei 90–110k“) wird als Plus gewertet statt als Warnsignal.
10. **Pendeln verkehrt:** Wer weiter pendeln würde, bekommt weniger Punkte (`:1472`); Orte werden nie verglichen.
11. **Arbeitsmodell:** `onsite_days_required` wird nicht gelesen → „hybrid, 5 Tage vor Ort“ zählt als hybrid (der Passungs-Check `fitCheck.ts:78` löst das schon richtig). `remote_only` schreibt keine Oberfläche → Präsenz-Ausschluss tot.
12. **Seniority:** unbekannt = „mid“ → Senior-Stelle ×0,6; „director“ gegen „lead“ ×0,25.
13. **Veraltete Anforderungen:** sobald `job_skill_requirements` eine Zeile hat, werden `must_haves` ignoriert; die Aufnahme schreibt dort nur mit `ignoreDuplicates` (nie löschen/ändern). Die Kunden-Einstufung „lernbar“ zählt weiter als Muss.
14. **Kandidatenakte ungenutzt:** Sperrliste (Kandidat will nicht zu Firma X), No-Go-Firmen der Stelle, Zielrollen, Zielorte, Umzug, Anstellungsart, Führung, Kündigungsfrist fließen nicht ein.

### P2 – Oberfläche, Daten, Lernen

15. **Akte:** Karte „KI-Matching V3.1“ – nur Prozent, keine Gründe, alle 50 veröffentlichten Stellen statt der aktivierten, schon eingereichte bleiben drin, „Alle anzeigen“ tot, englische Stufen mit Emoji, helle Farben im dunklen Theme.
16. **Stelle:** keine Vorschläge aus dem eigenen Pool („Wen habe ich schon für dieses Mandat?“ – die tägliche Frage).
17. **Einreichen:** Toast „mit 90 % Match-Score“ im Modus „strict“ (kann auch „0 %“ melden), Wert wird nie in `submissions.match_score` gespeichert → alle Anzeigen danach leer.
18. **Kunde:** Liste zeigt nichts, Detailseite „82 % Match“ aus einem anderen Modell (`assess-candidate-fit`) – zwei Scores unter einem Namen.
19. **Tote Teile:** volle Matching-Liste `CandidateJobMatchingV3` (umgeht beim Einreichen Einwilligung, Passungs-Check, Aktivierung – so nicht wiederbeleben), v1/v2/v3, Talent-Pool-Abgleich, Embeddings (64 Werte in `vector(1536)` → immer leer).
20. **Lerndaten verschmutzt:** `match_outcomes` bei jedem Aufruf; Admin-Widget zählt das (bei 1.000 gekappt).

## Zielbild: so matcht ein sehr guter Headhunter

Leitsatz: **Erst ausschließen, was sicher nicht geht; dann nach Belegen ordnen; die KI prüft nur die Besten; der Headhunter entscheidet; jede Entscheidung macht das System besser.**

### Stufe 0 – saubere Daten (die Grundlage für alles andere)

- **Stelle:** Muss/Kann/Lernbar aus der Kunden-Einstufung (`must_have_criteria` etc.) ist die Wahrheit; Satzfragmente laufen durch den Normalizer (V4, gebaut) in einzelne Skills mit Synonymen; bei jeder Freigabe automatisch, einmal Backfill aller 31 Stellen; Arbeitsmodell effektiv (hybrid + 5 Tage = vor Ort); Besetzungsdatum; Budget-Spanne; No-Go-Firmen.
- **Kandidat:** Skills aus CV + Akte normalisiert; Sprachen aus `candidate_languages` mit ISO-Code und Stufe (Muttersprache = C2+); Zertifikate aus `certificates`; Starttermin aus Kündigungsfrist; Ort, Zielorte, Umzug, Pendelzeit; Wunsch + Schmerzgrenze; Seniority; Sperrliste.
- **Fehlende Daten heißen „unbekannt“**, nie „passt“ – und senken die Sicherheit der Einschätzung, nicht den Score.

### Stufe 1 – harte Ausschlüsse (nur mit Beleg)

Nur was ein Headhunter nie vorschlagen würde, und nur wenn beide Seiten die Angabe haben: Sperrliste/No-Go-Firma (Grund nur allgemein nennen, sonst verrät er die Firma), Vor-Ort-Pflicht in anderer Stadt ohne Umzugsbereitschaft, Arbeitserlaubnis nötig und Stelle sagt ausdrücklich „kein Sponsoring“, Pflichtsprache nachweislich zu niedrig, Anstellungsart unvereinbar (Teilzeit/Vollzeit, Freelance/Fest), Schmerzgrenze deutlich über Budget-Maximum.

### Stufe 2 – Punkte mit Belegen

- **Muss-Abdeckung** (Kern): exakter Treffer, Synonym, Taxonomie – mit Wortgrenzen statt Teilstring; Titel zählt als Beleg („Senior Data Scientist“ erfüllt „Data Science“).
- **Rollen-Nähe:** Berufsfamilie aus Titel und Zielrollen (verhindert Servicekraft → Softwareentwickler).
- **Seniority und Erfahrung**, unbekannt neutral.
- **Rahmen:** Gehalt gegen Spanne mit Schmerzgrenze (drüber = verhandelbar/kritisch, deutlich drunter = Hinweis „Seniorität prüfen“), Start aus Kündigungsfrist gegen Besetzungsdatum, Ort/Pendeln/Umzug, Arbeitsmodell effektiv.
- **Sicherheit** als eigene Größe (wie vollständig die Daten sind), getrennt vom Score.

### Stufe 3 – KI prüft die Besten (V4, vorhanden)

Für die Top 5 je Stelle bzw. Kandidat: KI-Prüfer mit Belegpflicht (jede Aussage mit wörtlichem Zitat aus Akte/CV, sonst 0), anonymisiert (bestehende PII-Redaktion). Ergebnis: 2–3 Sätze „warum passt/warum nicht“, Gesprächsleitfaden. Live nur, wenn der Messlauf eine Verbesserung zeigt.

### Stufe 4 – Mensch entscheidet, System lernt

- Die Einstufung ist eine **Empfehlung**; ausblenden/einreichen entscheidet der Headhunter (DSGVO Art. 22).
- Ereignisse sammeln (`match_events`, vorhanden): gezeigt, geöffnet, eingereicht, Kunde lädt ein/sagt ab (mit Grund), eingestellt. `match_outcomes` nur bei Einreichung.
- Wöchentlicher Messlauf gegen echte Ergebnisse; Gewichte nur mit Messbeleg ändern.

## So fühlt es sich für den Headhunter an

- **Akte → „Passende Stellen“:** nur Stellen, auf die er einreichen kann oder könnte; je Zeile 2–3 Gründe (✓) und die wichtigste Lücke; Status (eingereicht / einreichbar / Aktivieren / kein Platz frei); ein Knopf; deutsche Stufen ohne Prozentbalken (Zahl als Tooltip). Wireframe: siehe Chat vom 30.09.
- **Stelle → „Aus deinem Pool passen“ (neu, wichtigster Hebel):** die 5 besten eigenen Kandidaten mit Gründen, Risiko (Gehalt/Frist/Ort) und „Vorstellung vorbereiten“; im Einreichen-Dialog die Kandidatenauswahl danach sortieren.
- **Benachrichtigung:** „Neue Stelle passt zu 3 deiner Kandidaten.“
- **Einreichen:** Passungs-Check vorbefüllt aus dem Matching (Belege je Muss-Kriterium als Vorschlag, der Headhunter bestätigt); Score, Gründe und Version als Schnappschuss an der Einreichung, ohne den Knopf zu blockieren.
- **Kunde:** eine Wahrheit – die bestätigte Kriterien-Einschätzung des Headhunters statt zweier Prozentzahlen.

## Recht und Leitplanken

- Nie verwenden: Nationalität, Alter, Geschlecht, Gesundheit und andere geschützte Merkmale (AGG, Art. 9 DSGVO).
- Wechselbereitschaft, andere Bewerbungen, Empfehlung, „würde bleiben“ nie in den Score (Profiling); höchstens Filter/Erklärung, die der Headhunter setzt.
- Empfehlung statt automatischer Entscheidung, jede Ausblendung übergehbar (Art. 22).
- KI-VO Anhang III (ab 2.12.2027): Dokumentation, Protokoll, menschliche Aufsicht, Bias-Tests – der Messlauf und `match_events` sind dafür die Grundlage.

## Messen statt raten

Der Eval-Harness (`npm run eval:matching`, `eval:check`, 27 Tests) misst schon Recall@10, nDCG@10, MRR und Leak@10 auf einem synthetischen und einem echten Datensatz. Heute echt: R@10 0,39 · nDCG@10 0,28 · MRR 0,26 · Leak@10 0,31.
**Zielwerte (Vorschlag):** echt R@10 ≥ 0,8 · MRR ≥ 0,6 · Leak@10 ≤ 0,15. Jeder Schritt unten wird vorher/nachher gemessen; der Datensatz wächst mit jeder echten Einreichung.

## Fahrplan (Schätzungen, jeweils mit Messlauf)

**Paket 1 – Sofort-Korrekturen (ca. 1–2 Tage)**
Aufrufer prüfen (angemeldet + Besitzer oder Admin) in v3-1 und talent-pool-match · Sprachen aus `candidate_languages` mit Normalisierung · Zertifikate aus beiden Spalten · Visum nur bei ausdrücklichem „kein Sponsoring“ · Wortgrenzen statt Teilstring, kurze Synonyme nur exakt · fehlende Daten = unbekannt, keine erfundenen Begründungen · leere Muss-Liste = geringe Sicherheit statt 100 % · `match_outcomes` nur bei Einreichung · Score-Schnappschuss an der Einreichung.

**Paket 2 – Daten (ca. 3–5 Tage)**
Muss-Quelle = Kunden-Einstufung, lernbar ≠ Muss · Normalizer bei jeder Freigabe + Backfill · Starttermin aus Kündigungsfrist gegen Besetzungsdatum · effektives Arbeitsmodell · Gehalt mit Spanne/Schmerzgrenze, `salary_fix`-Backfill · Seniority unbekannt neutral, Stufen angleichen · Ort/Pendeln/Umzug · Sperrliste/No-Go serverseitig · Berufsfamilie gegen Fehltreffer · Akte-Daten laden (Migration 20260928120000 ist live).

**Paket 3 – Oberfläche (ca. 3–5 Tage)**
„Passende Stellen“ in der Akte · „Aus deinem Pool passen“ an der Stelle + sortierte Auswahl beim Einreichen · Passungs-Check vorbefüllt · tote Komponenten entfernen · Kundenanzeige vereinheitlichen · Benachrichtigung bei neuen Treffern.

**Paket 4 – KI und Lernen (fortlaufend)**
V4-Prüfer als Variante im Harness messen → bei Gewinn für die Top 5 live · Ereignisse aus der Oberfläche in `match_events` · Kalibrierung der Stufen an echten Ergebnissen · Embeddings nur mit EU-Anbieter und Messbeleg.

## Offene Entscheidungen

1. Prozentzahlen weiter zeigen oder nur Stufen + Gründe (Empfehlung: Stufen + Gründe, Zahl als Tooltip)?
2. Sieht der Kunde einen Score? (Empfehlung: nein, nur die Kriterien-Einschätzung des Headhunters.)
3. V4-KI-Prüfung live für die Top 5 (Kosten pro Aufruf, Datenverarbeitung über das KI-Gateway, anonymisiert)?
4. Reihenfolge: Paket 1 sofort, dann 2 und 3 parallel?

## Ergebnis der 7-fachen Prüfung (30.09.2026)

**Messung Prototyp V3.2** (`evals/adapters/v32/`, nicht committed; Live-Funktion unverändert). R@10 / nDCG@10 / MRR / Leak@10:

| Variante | synthetisch | echt |
|---|---|---|
| V3.1 heute (code-defaults) | 0,821 / 0,820 / 0,885 / 0,488 | 0,389 / 0,283 / 0,261 / 0,306 |
| V3.2 alle Korrekturen | 1,000 / 0,966 / 1,000 / 0,393 | 0,444 / 0,311 / 0,289 / 0,306 |

Größte Hebel: Sprachen aus `candidate_languages` (synthetisch), Berufsfamilie (echt), Wortgrenzen statt Teilstring. Auf echten Daten bleiben 7 von 10 guten Kandidaten verborgen, weil Muss-Kriterien Satzstücke sind → Normalisierung ist der entscheidende nächste Hebel. Echte Daten: nur 19 Labels, Unterschiede < 0,01 sind Rauschen.

**Anzeige-Regeln („nur passende Stellen“), Simulation:** Fachfremde in der Hauptliste echt 12 → 0; Abgelehnte echt 1 → 0; sichtbare gute Kandidaten synthetisch 21 → 32 von 32.
1. Harte Ausschlüsse nur mit Beleg auf beiden Seiten (sonst Deckel + „prüfen“).
2. „Nicht bewertbar“ statt Score: Stellen ohne prüfbares Muss-Kriterium, Kandidaten ohne Titel und < 3 Skills.
3. Berufsfamilie als Schranke (Titel-Lexikon ~20 Familien, Nachbarschaft → höchstens „Prüfen“, fremd → ausgeschlossen; Generalisten nie hart).
4. Wortgrenzen, Komposita ab 6 Zeichen, Kürzel ≤ 3 Zeichen nur exakt; Domänenerkennung mit demselben Matcher („hr“ in „Erfahrung“).
5. Abdeckung nur über prüfbare Muss-Kriterien; Soft Skills/Abschlüsse/Sprachen „unbekannt“.
6. Stufen: Sehr passend ≥ 80 & Abdeckung ≥ 0,8 & ≥ 2 prüfbare Muss & gleiche Familie & kein Deckel; Passend ≥ 65 & ≥ 0,6; Prüfen ≥ 50 & ≥ 0,5.
7. Seniorität aus Titel lesen („Senior“ überschreibt Default „mid“), 1 Stufe daneben höchstens „Prüfen“.
8. Hauptliste zeigt Sehr passend + Passend, „Prüfen“ eingeklappt mit Grund.

**Abnahme:** 0 Fachfremde in den Top 5 (beide Richtungen), 0 Bewertungen ohne Datengrundlage, Unit-Gate „0 Teilstring-Fehltreffer“ (ts/umweltschutz, oss/abgeschlossen, java/javascript, sap/sap fi, visio/navision, c/koch, hr/erfahrung), Headhunter-Katalog mit 25 Fällen als Regressionstest, R@10/nDCG als Regressionsschutz.

**V4:** gutes Gerüst (Versionen, Cache, Flag), aber nicht live-reif: `calculate-match-v4` und `run-v4-shadow-batch` ohne Anmeldung erreichbar bei eingeschaltetem Flag (unbegrenzte KI-Kosten, Datenabfluss), Normalizer mit öffentlichem Schlüssel auslösbar, Zitate nicht gegen den Input geprüft, NaN-Fehler, sequentielle Aufrufe ohne Timeout, Schwärzung lückenhaft, geschützte Merkmale und „Überqualifizierung ist ein Minus“ im Prompt, Normalizer ignoriert die Kunden-Einstufung. Nutzen realistisch: Begründungen mit Belegen und semantische Treffer, kein gemessener Ranking-Gewinn. → nach Absicherung als Erklär-Schicht für die Top 5, asynchron, Kosten < 1 € je Voll-Lauf (Schätzung).

**Recht (Anwalt bestätigen):** Kunde sieht heute KI-Score und Urteil (`CandidateFitAssessmentCard`) → Art.-22-Risiko (EuGH SCHUFA) → entfernen. Überqualifikation nie abwerten (Altersproxy), „Muttersprache“ nur als GER-Stufe (AGG), Teilzeit/Vollzeit nicht als harter Ausschluss, Ist-Gehalt nie in KI oder Score (Entgelttransparenz). DSFA Pflicht, AVV/Drittland für das KI-Gateway, Löschkonzept für Match-Protokolle, Bias-Tests als CI-Gate, Hinweistexte für Kandidaten/Headhunter/Kunden, AI-Act-Dokumentation (Hochrisiko, Stichtag prüfen).

**Datenursachen:** `JobEditDialog` fügt Muss-Kriterien mit Komma zusammen und trennt am Komma → Satzstücke; `splitCompoundSkill` trennt an „oder/und“; Kunden-Einstufung erreicht den Matcher nie; `job_skill_requirements` nur mit `ignoreDuplicates` geschrieben; Finanz-Synonym-Migration nicht einspielen (gefährliche Kürzel).

**Plan (Schätzung):** 1 Matcher reparieren + Anzeige-Regeln + Berechtigungen + KI-Score aus Kundenansicht (ca. 2 T) · 2 Kriterien sauber (ca. 3 T) · 3 Seiten laut Wireframes mit Cache/Warteschlange (ca. 6–8 T) · 4 V4 als Erklär-Schicht (ca. 2 T) · parallel Recht mit Anwalt.
