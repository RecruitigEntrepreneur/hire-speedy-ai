# Intake-Fragenkatalog — 122 Question Cards

Erarbeitet vom Question Design Council (8 Fachagenten). Begleitdokument zu [ONBOARDING_INTAKE_MASTERANALYSE.md](ONBOARDING_INTAKE_MASTERANALYSE.md).

**Lesehinweis:** Der Katalog umfasst 122 Cards, aber **kein Kunde soll je mehr als etwa 14 Fragen sehen**. Die Auswahl trifft die Skip-Logik aus dem jeweiligen Trigger. Steigt der Median ueber 14, ist die Skip-Logik defekt.

---

## D.3 · Der vollstaendige Fragenkatalog — 122 Question Cards

Erarbeitet vom Question Design Council: acht Fachagenten, jeder fuer seine Rollenfamilie, alle auf demselben Ist-Inventar.


---

### Kern-Katalog (gilt fuer alle Rollenfamilien)

**Rollenfamilie:** übergreifend (Kern-Katalog für alle Rollenfamilien) · **Cards:** 12

> **Kernthese:** Die Jobaufnahme scheitert nicht an zu wenigen Fragen, sondern an Fragen ohne Ziel. BEWIESEN: Von den zwölf Entscheidungen, die ein Personalberater vor dem ersten Anruf treffen muss, landet heute nur bei vier die Antwort in einem Feld, das der Live-Pfad tatsächlich schreibt (jobs.vacancy_reason, jobs.must_haves, jobs.salary_min/max, jobs.candidates_in_pipeline — alle REST 200 und im Insert CreateJob.tsx:619-668). BEWIESEN: Die Felder für die anderen acht existieren teilweise längst in Produktion (jobs.success_profile, jobs.required_languages, jobs.required_certifications, jobs.onsite_required, jobs.company_culture, jobs.career_path, jobs.daily_routine, jobs.works_council, jobs.reports_to, Tabelle job_skill_requirements — alle REST 200), werden aber ausschließlich von Pfaden beschrieben, die in PROD 404 liefern (extract-intake-briefing, intake-questions) oder gar nicht ausgeliefert sind (JobIntakeStudio.tsx:377-379). ABGELEITET: Es fehlen keine Spalten, es fehlen Fragen mit Ziel — und zwei Live-Ausschlusskriterien laufen dabei ins Leere bzw. verkehrt herum: jobs.required_languages wird vom Matcher als harter Kill gelesen (calculate-match-v3-1/index.ts:921-941), ist aber nie befüllt; jobs.visa_sponsorship fehlt in PROD (REST 42703), der Matcher liest die Jobs jedoch mit select('*') (index.ts:640-642) und prüft `!job.visa_sponsorship` (index.ts:916) — jeder Kandidat mit Visumsbedarf wird damit auf JEDEM Job hart aussortiert. Deshalb: zwölf Fragen, jede mit genau einem typisierten Ziel und genau einer Nachfassregel — denn die vier Angaben, an denen DACH-Mandate real scheitern (Gehaltsdecke, Dringlichkeit, Entscheidungsmacht, "wir sind flexibel"), sind erfahrungsgemäß nicht falsch, sondern geschönt.


#### `K01` · Neu geschaffen vs. Nachbesetzung — und bei Nachbesetzung der wahre Abgangsgrund. Das ist gleichzeitig Risikoindikator (Fluktuation, Chef, Struktur) und Pflichtmaterial fü

> **„Ist die Position neu entstanden, oder besetzen Sie nach?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl (Chips) + optionaler Freitext |
| Optionen | Neu geschaffen · Nachbesetzung · Zusätzlich zum Team (Wachstum) · Vertretung (Elternzeit/Krankheit) · Umstrukturierung |
| Trigger | Immer, direkt nach Titel und Standort — erste inhaltliche Frage. |
| Uebersprungen wenn | Für dieselbe Rolle im selben Team wurde in den letzten 6 Monaten schon eine Stelle aufgenommen → Wert übernehmen und nur bestätigen lassen. |
| „Weiss ich nicht“ | Als offen markieren und in die Übergabefrage an den Fachbereich (K08) hängen — nicht stillschweigend als 'Wachstum' speichern. |
| Zielfeld | `jobs.vacancy_reason (BEWIESEN: existiert in PROD, REST 200; wird im Live-Pfad geschrieben, CreateJob.tsx:645) + Abgangsgrund als Freitext nach jobs.intake_briefing (REST 200)` |
| Folgefragen | – Bei Nachbesetzung: Was hat die Person zum Wechsel bewogen?<br>– Bei Nachbesetzung: Ist sie noch im Haus, und wie lange haben wir sie für die Übergabe?<br>– Bei neu geschaffen: Wer macht diese Aufgaben heute — und was passiert mit denen? |
| Widerspruchsregel | Wenn Nachbesetzung UND der Vorgänger war unter 12 Monaten da: einmal nachfassen, was sich seither verändert hat. Ohne Antwort geht der nächste Kandidat aus demselben Grund wieder. |
| Starke Antwort | Nachbesetzung. Der Kollege ist intern in die Bereichsleitung gewechselt, ist noch sechs Wochen da und übergibt. |
| Schwache Antwort | Nachbesetzung. |
| Wenn die Antwort fehlt | Der Recruiter kann die Story nicht erzählen und steht bei der häufigsten Rückfrage im Erstkontakt ('Warum ist der Vorgänger weg?') ohne Antwort da. |
| Zweck / Sensitivitaet | Beratung · normal |

#### `K02` · Das Erfolgsprofil: das messbare Delta nach 12 Monaten. Es ist die eigentliche Suchvorgabe — ohne dieses Delta screent jeder Recruiter auf Lebenslauf-Ähnlichkeit statt auf

> **„Wir sind ein Jahr weiter und Sie sagen: Das war die richtige Entscheidung. Woran machen Sie das fest?“**

| | |
|---|---|
| Antworttyp | Chips als Anker + Freitext (Pflicht: mindestens ein Satz) |
| Optionen | Eine bestimmte Kennzahl ist erreicht · Ein Projekt ist live und läuft stabil · Das Team steht und liefert ohne mich · Ein Rückstand ist abgearbeitet · Etwas anderes (beschreiben) |
| Trigger | Immer, direkt nach K01. |
| Uebersprungen wenn | Nie überspringen. Diese Frage ist die einzige, die dem Recruiter sagt, wonach er sucht. |
| „Weiss ich nicht“ | Umdrehen: 'Was müsste nach zwölf Monaten anders sein als heute, damit Sie zufrieden sind?' Kommt auch dann nichts, wird die Rolle als 'Erfolgsbild offen' markiert und der Recruiter sieht diesen Hinweis — er ist ein Warnsignal, keine Lücke. |
| Zielfeld | `jobs.success_profile (BEWIESEN: existiert in PROD, REST 200 — heute aber nur aus intakeData befüllbar, CreateJob.tsx:651, und intakeData kommt aus extract-intake-briefing, die in PROD 404 liefert → Spalte praktisch immer null). Folgefrage 'erste 90 Tage' → jobs.daily_routine (REST 200).` |
| Folgefragen | – Und die ersten 90 Tage: Welches konkrete Vorhaben übernimmt die Person zuerst?<br>– Was davon muss die Person schon einmal gemacht haben — und was darf sie bei Ihnen zum ersten Mal machen? |
| Widerspruchsregel | Wenn die Antwort nur Aufgaben beschreibt ('läuft mit, macht die Abschlüsse'), genau einmal nachfassen: 'Was wäre in zwölf Monaten anders als heute?' Ohne Delta gibt es kein Erfolgsprofil, sondern nur eine Stellenbeschreibung. |
| Starke Antwort | Die Monatsabschlüsse stehen bis Werktag 5, ohne dass ich eingreifen muss, und die zwei offenen Altprojekte sind sauber übergeben. |
| Schwache Antwort | Dass die Person gut ins Team passt und die Aufgaben zuverlässig erledigt. |
| Wenn die Antwort fehlt | Jede Vorstellung wird Geschmackssache; Absagen kommen mit der Begründung 'passt nicht ganz', die niemand in eine bessere Suche übersetzen kann. |
| Zweck / Sensitivitaet | Matching · normal |

#### `K03` · Die Trennung von Wunschliste und echter Prüfliste — inklusive der Frage, welches 'Muss' bei einem sonst überzeugenden Menschen wirklich fallen würde. Erfahrungsgemäß der 

> **„Wenn Sie nur drei Dinge prüfen dürften, bevor jemand zu Ihnen ins Gespräch kommt — welche drei sind das?“**

| | |
|---|---|
| Antworttyp | Liste, maximal 3 Einträge; je Eintrag Einstufung Muss / Wunsch / Ausschluss |
| Optionen | Muss (ohne das kein Gespräch) · Wunsch (angenehm, aber verzichtbar) · Ausschluss (disqualifiziert sofort) |
| Trigger | Immer, nach K02. Vorbelegt mit den Muss-Kriterien aus der Anzeige, sofern importiert. |
| Uebersprungen wenn | Nie überspringen. |
| „Weiss ich nicht“ | Nicht zulässig. Ersatzweg anbieten: 'Dann drehen wir es um — was war bei den letzten beiden Absagen der Grund?' (Brücke zu K10). |
| Zielfeld | `jobs.must_haves + jobs.nice_to_haves (BEWIESEN: existieren, werden im Live-Pfad geschrieben, CreateJob.tsx:633-634). Einstufung je Kriterium → job_skill_requirements.type/weight (BEWIESEN: Tabelle existiert, REST 200) — heute nur aus dem nicht ausgelieferten Studio-Pfad befüllt (JobIntakeStudio.tsx:409-419).` |
| Folgefragen | – Welches dieser drei würden Sie bei einem sonst überzeugenden Menschen durchgehen lassen?<br>– Gibt es etwas, das Sie zwar in der Anzeige fordern, aber intern beibringen würden? |
| Widerspruchsregel | Ab dem sechsten Muss-Kriterium den Zielkonflikt sichtbar machen: 'Mit diesen sechs Punkten und Ihrer Gehaltsspanne bleiben im DACH-Markt erfahrungsgemäß sehr wenige Profile übrig. Welche zwei davon sind ehrlich verhandelbar?' Die Antwort wird als 'verhandelbar' gespeichert, das Kriterium wird nicht gelöscht. |
| Starke Antwort | Erstens: fünf Jahre Bilanzierung nach HGB im Konzernumfeld — Muss. Zweitens: SAP FI produktiv — Muss, S/4-Erfahrung wäre nur Wunsch. Drittens: Deutsch verhandlungssicher — ohne das geht es nicht. |
| Schwache Antwort | Erfahrung, Teamfähigkeit und Hands-on-Mentalität. |
| Wenn die Antwort fehlt | Die Muss-Liste bleibt eine Wunschliste; der Recruiter filtert nach Bauchgefühl, und Sie sehen die Falschen. |
| Zweck / Sensitivitaet | Matching · normal |

#### `K04` · Nachweisbare Tiefe des wichtigsten Muss-Kriteriums. 'SAP' oder 'Führungserfahrung' als Wort steht in jedem zweiten Lebenslauf — erst Tiefe, Umfeld und Aktualität machen d

> **„Zu Ihrem wichtigsten Punkt, {muss_1}: Was muss jemand damit nachweislich gemacht haben, damit Sie es glauben?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext-Präzisierung |
| Optionen | Täglich damit gearbeitet · Ein Projekt damit verantwortet · Selbst eingeführt oder aufgebaut · Grundkenntnisse genügen |
| Trigger | Immer, unmittelbar nach K03; bezieht sich wörtlich auf das erste Muss-Kriterium aus K03. |
| Uebersprungen wenn | Überspringen, wenn K03 nur weiche Kriterien geliefert hat (dann zuerst K03 nachschärfen). |
| „Weiss ich nicht“ | Auf 'Projekt damit verantwortet' als mittlere Stufe setzen, sichtbar als Annahme kennzeichnen und dem Fachbereich zur Bestätigung vorlegen. |
| Zielfeld | `job_skill_requirements (skill_name, type, weight, min_years, proficiency, recency) — BEWIESEN: Tabelle existiert in PROD (REST 200) und der Live-Matcher bevorzugt sie gegenüber jobs.must_haves (calculate-match-v3-1/index.ts:1166-1173).` |
| Folgefragen | – In welchem Umfeld — welche Größenordnung, welche Module oder Werkzeuge?<br>– Wie aktuell muss das sein: reicht 'zuletzt vor drei Jahren'? |
| Widerspruchsregel | Wenn 'selbst eingeführt/aufgebaut' verlangt wird und das Budget im unteren Drittel der marktüblichen Spanne liegt: benennen, dass Aufbau-Erfahrung nahezu immer teurer ist, und fragen, ob wirklich Aufbau nötig ist oder ob sauberer Betrieb genügt. |
| Starke Antwort | SAP FI produktiv, Module FI und AA, im Konzern mit rund 40 Buchungskreisen; eine Migration muss sie nicht geleitet haben, aber mitgemacht. |
| Schwache Antwort | Sie sollte sich mit SAP eben gut auskennen. |
| Wenn die Antwort fehlt | Der Recruiter sucht auf Stichwortebene; Sie bekommen Profile, bei denen das Stichwort im Lebenslauf steht und im Gespräch zerfällt. |
| Zweck / Sensitivitaet | Matching · normal |

#### `K05` · Anti-Profil: das Scheitermuster trotz starkem Lebenslauf. Erspart erfahrungsgemäß mehr Fehlvorstellungen als jede zusätzliche Anforderung — und liefert die Screening-Frag

*Zwei Sätze dazu helfen uns mehr als jede weitere Anforderung — bitte nur arbeitsbezogen; Angaben zu Alter, Geschlecht, Herkunft, Religion oder Gesundheit dürfen wir weder speichern noch weitergeben.*

> **„Wer würde bei Ihnen scheitern, obwohl der Lebenslauf perfekt aussieht?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext |
| Optionen | Wer klare Vorgaben und Strukturen braucht · Wer nur Konzernstrukturen kennt · Wer nur kleine Strukturen kennt · Wer nicht selbst mit anpackt · Wer Konflikten ausweicht |
| Trigger | Immer, nach K04. |
| Uebersprungen wenn | Nie überspringen; bei Freelance-Mandaten kürzer stellen ('Womit kommt jemand hier nicht durch?'). |
| „Weiss ich nicht“ | Ersatzfrage: 'Wen haben Sie zuletzt eingestellt, der nicht funktioniert hat — woran lag es?' |
| Zielfeld | `Vorschlag: intake_payload.anti_profile (BEWIESEN: Spalte jobs.intake_payload fehlt in PROD, REST 42703) — bis dahin jobs.intake_briefing (REST 200), recruiter-privat. Freitext MUSS vor dem Speichern durch einen AGG-Filter; ABGELEITET: heute setzt kein Code die AGG-Zusage aus IntakeBriefing.tsx (IB-15) technisch durch.` |
| Folgefragen | – Ist das schon einmal passiert — was war da genau das Problem?<br>– Woran hätte man das im ersten Gespräch erkennen können? |
| Widerspruchsregel | Wenn die Antwort eine Personengruppe statt eines Verhaltens beschreibt ('zu jung', 'zu lange dabei'), freundlich umlenken: 'Was genau kann jemand dann nicht, den Sie meinen?' — und nur das Verhalten speichern. |
| Starke Antwort | Wer immer eine fertige Vorlage braucht. Bei uns gibt es für die halbe Rolle keinen Prozess, den muss man selbst schreiben. |
| Schwache Antwort | Jemand, der nicht ins Team passt. |
| Wenn die Antwort fehlt | Fachlich einwandfreie Kandidaten werden erst in Runde zwei aussortiert — das ist der teuerste Zeitpunkt für alle Beteiligten. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `K06` · Sprachanforderung mit Niveau als typisiertes Ausschlusskriterium. Der Live-Matcher wertet das bereits als harten Kill — heute mit leerem Feld, also wirkungslos.

> **„Zum Sprachlichen: Ist Deutsch auf verhandlungssicherem Niveau Pflicht, oder funktioniert die Rolle auch auf Englisch?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl (Bestätigung eines Vorschlags) |
| Optionen | Deutsch verhandlungssicher (C1) ist Pflicht · Deutsch gut (B2) genügt · Deutsch und Englisch, beides sicher · Englisch genügt · Kein Sprachkriterium |
| Trigger | Immer; vorbelegt aus Standort und Sprache der Anzeige, dem Kunden als Bestätigung mit einem Klick angeboten. |
| Uebersprungen wenn | Nie überspringen — aber als Ein-Klick-Bestätigung darstellen, nicht als offene Frage. |
| „Weiss ich nicht“ | Vorschlag aus Standort und Anzeigensprache stehen lassen, aber als 'nicht bestätigt' markieren und NICHT als harten Ausschluss scharf schalten. |
| Zielfeld | `jobs.required_languages als [{code, minLevel}] (BEWIESEN: existiert in PROD, REST 200; wird vom Live-Matcher als harter Ausschluss gelesen, calculate-match-v3-1/index.ts:921-941). BEWIESEN: geschrieben wird sie heute nur in JobIntakeStudio.tsx:377 — einem Pfad, der in PROD nicht ausgeliefert ist.` |
| Folgefragen | – Mit wem spricht die Person täglich — intern, Kunden, Konzernzentrale?<br>– Wäre B2 mit Sprachkurs ein gangbarer Weg? |
| Widerspruchsregel | Wenn Deutsch C1 Pflicht ist UND das Suchbild international angelegt ist: einmal spiegeln — 'C1 halbiert im technischen Umfeld den erreichbaren Markt. Ist der Kundenkontakt wirklich auf Deutsch?' ACHTUNG beim Scharfschalten: das Team hat den Sprach-Kill bewusst nicht aktiviert, solange candidates.language_skills nicht gepflegt ist (normalize-job-requirements/index.ts:19-21) — erst Kandidatendaten, dann Kill. |
| Starke Antwort | Deutsch C1 ist Pflicht, die Fachbereiche arbeiten komplett auf Deutsch. Englisch nur für die Konzernberichte, da reicht Schulniveau. |
| Schwache Antwort | Deutsch sollte schon gut sein. |
| Wenn die Antwort fehlt | Entweder werden Kandidaten ohne Deutsch bis ins Kundengespräch geschleppt, oder — sobald das Feld scharf ist — passende Menschen unsichtbar aussortiert. |
| Zweck / Sensitivitaet | Matching · normal |

#### `K07` · Die echte Gehaltsdecke inklusive Freigabeweg und Beleg. Die in der Anzeige genannte Obergrenze ist erfahrungsgemäß die Verhandlungsposition, nicht die Grenze.

*Diese Zahl sieht kein Kandidat — sie verhindert nur, dass ich jemanden ins Rennen schicke, den Sie am Ende nicht halten können.*

> **„Angenommen, ich stelle Ihnen jemanden vor, der fachlich genau passt, aber über Ihrer Spanne liegt: Bis zu welchem Fixgehalt sagen Sie Ja?“**

| | |
|---|---|
| Antworttyp | Zahl in Euro pro Jahr + Einstufung des Freigabewegs |
| Optionen | Entscheide ich allein · Brauche ich eine Freigabe · Ausgeschlossen, die Spanne ist die Grenze |
| Trigger | Immer, sobald eine Gehaltsspanne erfasst ist (bei Festanstellung); bei Freelance analog auf den Tagessatz bezogen. |
| Uebersprungen wenn | Überspringen, wenn Gehalt tariflich gebunden ist — dann stattdessen Entgeltgruppe und Stufe erfassen. |
| „Weiss ich nicht“ | Decke = Maximum der Spanne speichern und dem Recruiter genau so anzeigen ('Decke nicht bestätigt'). Keine stillschweigende Annahme von Spielraum. |
| Zielfeld | `jobs.salary_max (BEWIESEN: existiert, Live-Pfad, CreateJob.tsx:630) für die veröffentlichte Spanne; die Decke, der Freigabeweg und der Beleg getrennt und recruiter-privat nach intake_payload.comp_ceiling (BEWIESEN: Spalte fehlt in PROD, REST 42703 — bis dahin jobs.intake_briefing, REST 200). Niemals in kandidatensichtbare Texte.` |
| Folgefragen | – Was war das höchste Fixgehalt, das Sie in den letzten zwölf Monaten auf dieser Ebene tatsächlich gezahlt haben?<br>– Wer müsste ein Überschreiten freigeben, und wie lange dauert das?<br>– Was geht außer Fixgehalt — Antrittsprämie, Titel, ein zusätzlicher Homeoffice-Tag, früherer Start? |
| Widerspruchsregel | 'Wir sind flexibel für den Richtigen' ist keine Zahl. Genau einmal nachfassen — mit der Beleg-Frage (letzte tatsächliche Zahlung) und dem Freigabeweg. Kommt dann keine Zahl, wird die Spannenobergrenze als Decke gespeichert und als unbestätigt markiert. Zweiter Fall: liegt die Spanne unter dem Marktband für die Muss-Liste aus K03, den Konflikt sofort benennen und die Wahl anbieten — Budget oder Kriterium. |
| Starke Antwort | 85 ist die Zielmarke, bis 90 entscheide ich allein, darüber brauche ich meinen Geschäftsführer — das dauert einen Tag. |
| Schwache Antwort | Für den Richtigen ist bei uns immer etwas möglich. |
| Wenn die Antwort fehlt | Der Recruiter verhandelt blind. Der teuerste Abbruch im Prozess ist die Absage im Angebot, und sie geht fast immer auf eine nie ausgesprochene Decke zurück. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `K08` · Wer die Zusage tatsächlich gibt, wer die Suche stoppen kann und ob die Stelle freigegeben ist. Ohne benannten Entscheider ist es kein Mandat, sondern eine Idee.

> **„Wer trifft am Ende die Entscheidung für eine Zusage?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext (Rolle, nicht Name) |
| Optionen | Ich allein · Ich gemeinsam mit HR · Ich und die Geschäftsführung · Ein Gremium; Betriebsrat ist beteiligt |
| Trigger | Immer, im Prozessteil der Aufnahme. |
| Uebersprungen wenn | Überspringen, wenn derselbe Ansprechpartner in den letzten 6 Monaten schon ein Mandat abgeschlossen hat → übernehmen und bestätigen lassen. |
| „Weiss ich nicht“ | Mandat als 'Entscheidungsweg offen' kennzeichnen und vor der ersten Ansprache klären. Diese Lücke ist ein Risiko, keine Kleinigkeit. |
| Zielfeld | `BEWIESEN: kein Ziel in PROD — jobs.decision_makers_count existiert nicht (REST 42703) und die heutige Frage CJ-27 wird nirgends gespeichert (CreateJob.tsx:619-668 enthält decision_makers_count nicht, obwohl es in formData:155 und der Vollständigkeitsprüfung:188 auftaucht). Ziel: intake_payload.decision_path; Betriebsratsbeteiligung zusätzlich nach jobs.works_council (BEWIESEN: existiert, REST 200).` |
| Folgefragen | – Ist die Stelle bereits budgetiert und freigegeben, oder steht die Freigabe noch aus?<br>– Wer außer Ihnen könnte diese Suche stoppen?<br>– Wer muss zwingend mit dem Kandidaten gesprochen haben, bevor ein Angebot rausgeht? |
| Widerspruchsregel | Wenn 'ich allein entscheide', im Prozess (K09) aber drei Runden mit vier Beteiligten stehen: den Widerspruch sofort ansprechen. Der spätere Bremser ist fast immer die Person, die im ersten Gespräch nicht genannt wurde. Zweiter Fall: 'Freigabe steht noch aus' → Mandat sichtbar als vorläufig markieren, statt Kandidaten in Bewegung zu setzen. |
| Starke Antwort | Ich entscheide mit meiner Geschäftsführerin gemeinsam; das Budget ist im Plan freigegeben. Der Betriebsrat muss der Einstellung formal zustimmen, das dauert eine Woche. |
| Schwache Antwort | Das machen wir dann intern aus. |
| Wenn die Antwort fehlt | Mandate ohne Entscheider sterben spät und teuer — nach Wochen Suche, im Angebot. |
| Zweck / Sensitivitaet | Prozess · normal |

#### `K09` · Der reale Takt des Verfahrens: Anzahl der Runden, Terminverfügbarkeit und die tatsächliche Toleranz gegenüber Kündigungsfristen. Prüft zugleich, ob die behauptete Dringli

> **„Wie viele Gespräche sind vorgesehen, bis Sie eine Zusage geben können?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext |
| Optionen | Zwei Gespräche · Zwei Gespräche plus Fallaufgabe · Drei oder mehr Runden · Steht noch nicht fest |
| Trigger | Immer, nach K08. |
| Uebersprungen wenn | Überspringen, wenn für dieselbe Rollenfamilie beim selben Kunden bereits ein Verfahren hinterlegt ist → bestätigen lassen. |
| „Weiss ich nicht“ | Standard vorschlagen (zwei Runden in zwei Wochen) und als Vorschlag kennzeichnen, damit der Recruiter ihn im Kandidatengespräch nicht als Zusage verkauft. |
| Zielfeld | `BEWIESEN: kein typisiertes Ziel in PROD (jobs.interview_rounds / interview_process existieren nicht, REST 42703). Ziel: intake_payload.process; Dringlichkeit weiter nach jobs.hiring_urgency (BEWIESEN: existiert, wird aber nur gespeichert, wenn ungleich 'standard' — CreateJob.tsx:643).` |
| Folgefragen | – Bis wann könnten die ersten Gespräche stattfinden — haben Sie in den nächsten zwei Wochen feste Zeitfenster?<br>– Wenn die richtige Person sechs Monate Kündigungsfrist hat: Warten Sie, oder ist das ein Ausschluss?<br>– Wer ist in den nächsten Wochen im Urlaub? |
| Widerspruchsregel | 'Sehr dringend' plus drei Runden plus Urlaub bis Monatsende ist kein dringender Prozess. Den Widerspruch sofort spiegeln und um zwei feste Zeitfenster pro Woche für Erstgespräche bitten. Zweiter Fall: 'ASAP' plus 'nur sofort verfügbar' → benennen, dass damit fast ausschließlich gekündigte oder unzufriedene Kandidaten übrig bleiben. |
| Starke Antwort | Zwei Runden: 45 Minuten mit mir, dann 90 Minuten mit mir und meiner Chefin. Donnerstag- und Freitagvormittag halte ich frei. Bis zu drei Monate Kündigungsfrist warte ich. |
| Schwache Antwort | Wir sind da sehr schnell, das bekommen wir kurzfristig hin. |
| Wenn die Antwort fehlt | Kandidaten springen zwischen Runde eins und zwei ab, weil niemand ihnen sagen konnte, wie lange es dauert. |
| Zweck / Sensitivitaet | Prozess · normal |

#### `K10` · Kalibrierung an der Realität: Woran sind bisherige Kandidaten gescheitert und wer sucht sonst noch. Das ist die ehrlichste verfügbare Rückmeldung darüber, ob Anforderung,

*Bitte ohne Namen — für uns zählt nur der Grund.*

> **„Woran sind die Kandidaten gescheitert, die Sie für diese Stelle bisher gesehen haben?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext |
| Optionen | Noch niemanden gesehen · Fachlich zu schwach · Gehaltsvorstellung zu hoch · Persönlich nicht überzeugend · Kandidat hat abgesagt |
| Trigger | Wenn die Stelle nicht neu geschaffen ist ODER bereits Kandidaten im Verfahren sind ODER die Stelle länger als vier Wochen offen ist. |
| Uebersprungen wenn | Stelle ist neu geschaffen und seit weniger als vier Wochen offen. |
| „Weiss ich nicht“ | Ersatzfrage an HR statt an den Fachbereich; alternativ: 'Wie viele Lebensläufe haben Sie in dieser Sache ungefähr gesehen?' |
| Zielfeld | `jobs.candidates_in_pipeline (BEWIESEN: existiert, wird geschrieben — aber '1-3' wird über coerceLeadingInt auf 1 verkürzt, CreateJob.tsx:646, und der Rohwert landet in intake_payload, das in PROD fehlt) + Ablehnungsgründe → intake_payload.rejections, ausdrücklich ohne personenbezogene Daten Dritter.` |
| Folgefragen | – Seit wann ist die Stelle offen?<br>– Wer sucht sonst noch — intern, eine andere Beratung, ein Portal?<br>– Gab es jemanden, den Sie gern gehabt hätten und der abgesagt hat? Woran lag es? |
| Widerspruchsregel | Wenn länger als drei Monate gesucht wird und mehr als fünf Kandidaten abgelehnt wurden: nicht über weitere Kandidaten sprechen, sondern über die Anforderung. 'Was hat allen gefehlt?' — war es immer dasselbe, fehlt es entweder im Markt oder im Budget. Dann zurück zu K03 und K07. |
| Starke Antwort | Seit April. Vier Profile gesehen: drei fachlich gut, aber keiner hatte Führungserfahrung im Schichtbetrieb, einer wollte 20 Prozent mehr. |
| Schwache Antwort | Es war einfach niemand Passendes dabei. |
| Wenn die Antwort fehlt | Der Recruiter legt Ihnen Profile vor, die Sie längst abgelehnt haben — der schnellste Weg, Vertrauen zu verlieren. Klarnamen fremder Kandidaten dürfen dabei nicht im Job-Datensatz landen. |
| Zweck / Sensitivitaet | Beratung · DSGVO-relevant |

#### `K11` · Die Suchlandkarte: Zielunternehmen als positive Suchvorgabe und Tabu-Firmen als verbindliche Grenze (Kunden, Partner, Abwerbeverbote).

> **„Wo arbeiten die Menschen heute, die Sie gern hätten?“**

| | |
|---|---|
| Antworttyp | Chips + Firmenliste (Freitext, mehrfach) |
| Optionen | Direkte Wettbewerber · Bestimmte Firmen (ich nenne sie) · Zulieferer und Dienstleister der Branche · Egal, Hauptsache die Person passt |
| Trigger | Immer, im Sourcing-Teil der Aufnahme; vorbelegt aus früheren Mandaten desselben Kunden. |
| Uebersprungen wenn | Tabu-Liste des Kunden ist aus einem früheren Mandat vorhanden → nur bestätigen, Zielfirmen trotzdem neu fragen (sie sind rollenabhängig). |
| „Weiss ich nicht“ | Der Recruiter schlägt nach dem Erstkontakt eine Liste vor, der Kunde streicht. Das ist schneller als jede offene Frage. |
| Zielfeld | `jobs.target_companies und jobs.nogo_companies — BEWIESEN: BEIDE Spalten fehlen in PROD (REST 42703); die Vorbefüllungsquelle company_profiles.excluded_companies fehlt ebenfalls (REST 42703). Heute landet die Antwort bestenfalls als Fließtext in jobs.briefing_notes (REST 200). ABGELEITET: Eine Abwerbe-Zusage ist damit derzeit nirgends maschinell durchsetzbar.` |
| Folgefragen | – Und welche Firmen sind tabu — Kunden, Partner, bestehende Vereinbarungen?<br>– Gibt es einzelne Personen, die wir nicht ansprechen dürfen?<br>– Gibt es Firmen, aus denen Sie bewusst niemanden mehr wollen? Woran lag das? |
| Widerspruchsregel | Wenn die Tabu-Liste die halbe Branche umfasst, Branchenerfahrung aber Pflicht ist (K03), den Widerspruch benennen und um Priorisierung bitten: 'Beides zusammen lässt im DACH-Raum kaum jemanden übrig — was wiegt schwerer?' |
| Starke Antwort | Direkte Wettbewerber sind genau richtig, dazu die zwei großen Zulieferer. Tabu sind unsere drei größten Kunden, die nenne ich Ihnen namentlich. |
| Schwache Antwort | Suchen Sie einfach in der Branche. |
| Wenn die Antwort fehlt | Der Recruiter spricht Ihren wichtigsten Kunden an. Das merken Sie erst, wenn es zu spät ist. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `K12` · Die Reveal-Regel: bis wann bleibt der Kunde anonym, wie wird er bis dahin beschrieben und was darf keinesfalls genannt werden. Ohne diese Regel schreibt der Recruiter die

*Bis dahin sprechen wir Kandidaten anonym an — dafür brauchen wir eine Beschreibung, die zu Ihnen passt, Sie aber nicht verrät.*

> **„Ab wann dürfen wir Ihren Firmennamen nennen?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Bestätigung eines generierten Beschreibungstexts |
| Optionen | Sobald der Kandidat zustimmt · Nach dem ersten Gespräch · Erst beim Angebot |
| Trigger | Immer, als letzter Block der Aufnahme. |
| Uebersprungen wenn | Kunde hat eine Standardregel im Profil hinterlegt → nur bestätigen lassen. |
| „Weiss ich nicht“ | Vorsichtigste Variante setzen ('erst beim Angebot') und den Kunden informieren, dass eine spätere Freigabe jederzeit möglich ist. |
| Zielfeld | `jobs.reveal_trigger und jobs.reveal_envelope {descriptor, green_list, red_list} — BEWIESEN: BEIDE fehlen in PROD (REST 42703), während jobs.company_name im Klartext gespeichert wird (CreateJob.tsx:624). Der Katalog braucht genau EINE Frage dazu: die konkurrierende Briefing-Frage IB-34 mit abweichenden Werten ('Nach NDA', 'Bei gegenseitigem Interesse') entfällt.` |
| Folgefragen | – Passt diese Beschreibung: 'Maschinenbau-Mittelstand, rund 500 Mitarbeitende, Raum Stuttgart'?<br>– Was dürfen wir auf keinen Fall nennen — Produkte, Projekte, Kunden, den Namen Ihrer Führungskraft?<br>– Dürfen wir die Gehaltsspanne anonym nennen? |
| Widerspruchsregel | Wenn 'erst beim Angebot' gewählt wird UND die Beschreibung faktisch identifiziert ('Weltmarktführer für X im Raum Y'), sofort zeigen: 'Damit findet Sie jeder in zwei Minuten. Zwei Alternativen wären …'. Zweiter Fall: sehr späte Freigabe plus enger Zeitplan (K09) → benennen, dass Kandidaten in gehobenen Positionen ohne Firmennamen selten ein zweites Gespräch zusagen. |
| Starke Antwort | Nach dem ersten Gespräch. Beschreiben Sie uns als familiengeführten Maschinenbauer mit rund 500 Mitarbeitenden im Raum Stuttgart. Unsere Produktnamen und den Namen meiner Chefin bitte nicht. |
| Schwache Antwort | Sagen Sie einfach nichts Konkretes. |
| Wenn die Antwort fehlt | Der Recruiter erfindet die Beschreibung selbst — entweder so vage, dass niemand antwortet, oder so konkret, dass Ihre Anonymität dahin ist. |
| Zweck / Sensitivitaet | Vertrag · sensibel |

**Beispieldialog**

```
SITUATION: Erstaufnahme, Leiter Finanzen eines Maschinenbauers, sucht eine Teamleitung Rechnungswesen. In der Anzeige steht "70.000 – 85.000 €", Dringlichkeit "sehr dringend".

Berater (K07): "Damit ich niemanden ins Rennen schicke, den Sie am Ende nicht halten können — angenommen, ich stelle Ihnen jemanden vor, der fachlich genau passt und über Ihrer Spanne liegt. Bis zu welchem Fixgehalt sagen Sie Ja?"

Kunde: "Für den Richtigen sind wir da grundsätzlich flexibel."

Berater (Nachfassen, Regel aus K07): "Das höre ich in fast jeder Aufnahme — und in den meisten Fällen heißt es später doch 'nicht darstellbar'. Deshalb zwei konkrete Fragen: Was war das höchste Fixgehalt, das Sie in den letzten zwölf Monaten auf dieser Ebene tatsächlich gezahlt haben? Und wer müsste ein Überschreiten freigeben?"

Kunde: "Zuletzt haben wir 88 gezahlt, das war aber ein Sonderfall. Freigeben würde das meine Geschäftsführerin."

Berater: "Dann halte ich fest: 85 ist die Zielmarke, bis 90 ist ohne Rückfrage darstellbar, darüber brauchen wir Ihre Geschäftsführerin und rund einen Tag Vorlauf. Ich melde mich, bevor ich jemandem über 90 etwas in Aussicht stelle. Einverstanden?"
[gespeichert, recruiter-privat: Decke 90.000, Freigabeweg 'Geschäftsführung, ca. 1 Tag', Beleg '88.000 in den letzten 12 Monaten'. Kandidatensichtbar bleibt 70.000–85.000.]

Berater (K09): "Wie viele Gespräche sind vorgesehen, bis Sie eine Zusage geben können?"

Kunde: "Wir sind sehr schnell, das machen wir kurzfristig. Drei Runden: ich, dann meine Geschäftsführerin, dann noch einmal mit dem Team."

Berater (Widerspruch spiegeln, Regel aus K09): "Sie haben die Stelle als sehr dringend eingestuft. Drei Runden mit drei Beteiligtenkreisen dauern erfahrungsgemäß vier bis sechs Wochen — in dieser Ebene sind gute Leute vorher woanders unterschrieben. Zwei Wege: Wir legen Runde eins und zwei auf einen Termin zusammen, oder Sie geben mir feste Zeitfenster. Was ist Ihnen lieber?"

Kunde: "Zusammenlegen geht. Donnerstag- und Freitagvormittag halte ich frei."

Berater (K09-Folgefrage, Test der Dringlichkeit): "Und wenn die richtige Person sechs Monate Kündigungsfrist hat — warten Sie?"

Kunde: "Sechs Monate wären schwierig. Drei ginge."

Berater: "Gut, dann suche ich mit maximal drei Monaten Kündigungsfrist. Das ist eine echte Einschränkung — sie kostet uns etwa ein Drittel des Marktes, aber sie stimmt wenigstens." [gespeichert: Verfügbarkeit ≤ 3 Monate als Ausschluss, nicht als Wunsch — Dringlichkeit damit belegt statt behauptet.]

Berater (K10): "Woran sind die Kandidaten gescheitert, die Sie bisher gesehen haben? Ohne Namen, für mich zählt nur der Grund."

Kunde: "Es war einfach niemand Passendes dabei."

Berater (Nachfassen): "Wie viele Lebensläufe waren das ungefähr — und was hat dem letzten konkret gefehlt?"

Kunde: "Vier oder fünf. Fachlich waren drei davon in Ordnung, aber keiner hat schon einmal ein Team im Schichtbetrieb geführt."

Berater: "Das ist die wichtigste Information des ganzen Gesprächs. Dann ist Führung im Schichtbetrieb Ihr eigentliches Muss-Kriterium — und nicht die zehn Jahre Berufserfahrung, die in der Anzeige stehen. Sind Sie einverstanden, wenn ich das tausche?" [zurück zu K03; Ablehnungsgrund gespeichert, keine Namen Dritter.]
```


---

### IT & Digital

**Rollenfamilie:** IT & Digital (Software Engineering, Cloud/DevOps, Data, Security, ERP/SAP, Product, IT-Leadership) · **Cards:** 16

> **Kernthese:** Bei IT-Rollen ist das Problem nicht zu wenig Information, sondern zu viel undifferenzierte. Jeder Begriff, den der Kunde nennt, wird zu einem gleichgewichtigen Muss — und trifft dann entweder falsch oder gar nicht. BEWIESEN (calculate-match-v3-1/index.ts:1298, `candidateSkills.some(cs => cs.includes(normalizedSkill) || normalizedSkill.includes(cs))`, reproduziert per node): Job-Skill "Java" zählt als DIREKTER Volltreffer (credit 1.0) auf den Kandidaten-Skill "JavaScript"; "Go" trifft "Google Cloud" und "MongoDB"; "C" trifft "C#", "JavaScript" und "Google Cloud". BEWIESEN (REST 200, content-range 0-102/103): skill_taxonomy hat 103 Einträge, davon 3 Cloud-Plattformen, 4 DevOps-Einträge und NULL Security-Einträge; Kubernetes und SAP haben `transferability_from = {}` (REST-Antwort zitiert) — für sie gibt es also keinen Transferkredit, ein Verfehlen kostet das volle Muss-Gewicht. BEWIESEN (grep über calculate-match-v3-1, calculate-match-v4, _shared/match-v4.ts liefert LEER; Matcher lädt zwar `select('*')` in Zeile 650-652, liest aber nur skill_name/type/weight in 1168-1232): min_years, min_proficiency und recency_required werden von KEINEM Matcher gelesen. FOLGE FÜR DEN FRAGENPFAD: Meine Fragen sammeln nicht, sie entscheiden. Aus der Buzzword-Liste werden 3 kanonisch benannte Muss-Skills mit differenziertem GEWICHT (das wird gelesen, Zeile 1201: `const weight = req.weight || 1.0`), alles andere wird Kann. Tiefe ("hat benutzt" vs. "hat eingeführt") muss in job_skill_requirements.weight + .description landen, nicht in min_years — sonst ist die Frage wirkungslos. BEWIESEN (REST): job_skill_requirements existiert in PROD vollständig (skill_name, type, weight, min_years, min_proficiency, recency_required, description, cluster_id alle HTTP 200) und ist damit das einzige belastbare Landefeld meines Pfades; jobs.intake_payload dagegen fehlt (42703), d.h. jede Antwort, die dorthin geplant ist, ist heute verloren.


#### `IT-01` · Reduktion der Buzzword-Liste auf 3 matchbare Kern-Skills. Dies ist die wichtigste Karte des ganzen Pfades: sie bestimmt, welche Skills mit vollem Gewicht ins Matching geh

*Sie haben {n} Technologien genannt. Ich moechte die drei herausziehen, die wirklich jeden Tag gebraucht werden — an denen suchen wir, der Rest ist Bonus.*

> **„Wenn Sie an eine ganz normale Arbeitswoche denken: Mit welchen drei Technologien hat die Person taeglich zu tun?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl, hart begrenzt auf 3) aus den bereits genannten Skills + Freitext fuer Nachtraege |
| Optionen | {Skill 1 aus Anzeige} · {Skill 2 aus Anzeige} · {Skill 3 aus Anzeige} · {... alle weiteren genannten} · Eine wichtige Technologie fehlt in der Liste |
| Trigger | Sobald aus Anzeige, Text oder Eingabe mehr als 3 Skills vorliegen. Erste Frage des IT-Pfades, vor jeder Tiefenfrage. |
| Uebersprungen wenn | Es liegen von vornherein hoechstens 3 Skills vor. Dann direkt zu IT-02. |
| „Weiss ich nicht“ | Umdrehen: 'Dann andersherum — welche zwei koennten wir streichen, ohne dass die Person im ersten Monat scheitert?' Wenn auch das nicht kommt: die drei Skills nehmen, die im Jobtitel oder in den ersten drei Zeilen der Anzeige stehen, und als Bestaetigungsfrage vorlegen. |
| Zielfeld | `job_skill_requirements: die 3 gewaehlten als type='must'; ALLE uebrigen genannten Skills automatisch als type='nice', weight=0.5. Tabelle in PROD vorhanden (REST 200 auf skill_name/type/weight). Zusaetzlich jobs.must_haves / jobs.nice_to_haves fuer den Fallback-Pfad (calculate-match-v3-1:1175-1177).` |
| Folgefragen | – Die uebrigen {n-3} nehme ich als 'waere schoen' auf — einverstanden?<br>– Fehlt etwas, das taeglich gebraucht wird, aber in der Anzeige gar nicht steht? |
| Widerspruchsregel | Waehlt der Kunde mehr als 3 an, sofort einblenden: 'Jede zusaetzliche Pflicht-Technologie halbiert etwa den erreichbaren Markt. Bei {n} Pflichten reden wir ueber eine Handvoll Menschen in ganz Deutschland — welche zwei duerfen wir zu Kann machen?' inkl. Ein-Klick-Button 'zu Kann verschieben' (existiert bereits: DynamicBriefing.tsx:202-214). |
| Starke Antwort | Genau drei benannte Technologien, idealerweise mit Halbsatz warum ('Kubernetes, weil wir die Cluster selbst betreiben'). |
| Schwache Antwort | 'Alle sind wichtig.' / Kunde waehlt alle Chips an. |
| Wenn die Antwort fehlt | Alle genannten Skills landen als gleichgewichtige Muss-Kriterien im Matching. Bei 8+ Skills faellt die Muss-Abdeckung praktisch jedes realen Kandidaten unter die Schwelle — die Trefferliste ist dann leer, ohne dass jemand versteht warum. |
| Zweck / Sensitivitaet | Matching · normal |

#### `IT-02` · Der Unterschied zwischen 'hat damit gearbeitet' und 'hat es eingefuehrt/verantwortet'. Wird PRO Kern-Skill aus IT-01 gestellt (max. 3 Durchlaeufe). Muss zwingend in weigh

> **„Bei {Skill}: Reicht es, wenn die Person damit gearbeitet hat — oder muss sie es selbst aufgebaut haben?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext + 'Weiss ich nicht' |
| Optionen | Grundkenntnisse reichen · Hat damit gearbeitet · Hat ein Projekt damit verantwortet · Hat es selbst eingefuehrt oder migriert |
| Trigger | Direkt nach IT-01, einmal je gewaehltem Kern-Skill. Bei nur 1-2 Kern-Skills entsprechend seltener. |
| Uebersprungen wenn | Skill ist bereits als Kann eingestuft, oder der Kunde hat die Tiefe in der Anzeige explizit genannt ('mind. 3 Jahre produktive Erfahrung mit X') — dann Bestaetigungsfrage statt Neufrage. |
| „Weiss ich nicht“ | Nicht wiederholen. Default: type='must', weight=1.0 setzen und im Recruiter-Text kennzeichnen 'Tiefe nicht geklaert — im Erstgespraech abfragen'. Kapitel als partial markieren. |
| Zielfeld | `job_skill_requirements fuer genau diesen Skill: 'Grundkenntnisse' -> type='nice', weight=0.5 | 'gearbeitet' -> type='must', weight=0.8 | 'Projekt verantwortet' -> type='must', weight=1.0 | 'selbst eingefuehrt' -> type='must', weight=1.3. Zusaetzlich min_proficiency (beginner/intermediate/advanced/expert) und description (Klartext fuer den Recruiter) — beide Spalten in PROD vorhanden (REST 200), aber vom Matcher heute NICHT gelesen; sie wirken nur ueber weight und ueber den Text, den der Recruiter sieht.` |
| Folgefragen | – Bei 'selbst eingefuehrt': Was genau soll die Person bei Ihnen aufbauen oder abloesen?<br>– Bei 'Grundkenntnisse reichen': Dann nehme ich {Skill} als Kann auf — dadurch verdreifacht sich der Markt. In Ordnung? |
| Widerspruchsregel | Wenn alle 3 Kern-Skills 'selbst eingefuehrt' bekommen UND das Gehalt unter Marktband liegt: 'Sie suchen jemanden, der drei Dinge selbst aufgebaut hat. Solche Leute kosten in diesem Markt {X}. Ihr Maximum liegt bei {Y}. Was soll ich anpassen — Anspruch oder Budget?' |
| Starke Antwort | 'Hat selbst eingefuehrt' plus Beispiel: 'Wir brauchen jemanden, der schon einmal von Jenkins auf GitLab CI migriert hat.' |
| Schwache Antwort | 'Sehr gute Kenntnisse.' / 'Expertenlevel.' — beides sagt nichts ueber nachweisbares Tun. |
| Wenn die Antwort fehlt | Alle Muss-Skills bekommen Gewicht 1.0. Der Kandidat, der eine Technologie eingefuehrt hat, wird nicht besser bewertet als der, der sie einmal gestreift hat — und beide werden gleich behandelt wie bei einer Technologie, die eigentlich Beiwerk ist. |
| Zweck / Sensitivitaet | Matching · normal |

#### `IT-03` · Legacy vs. Modern innerhalb derselben Technologie. Kritisch, weil die Taxonomie das nicht kann: BEWIESEN, SAP hat nur die Aliases ['SAP ERP','SAP S/4HANA'] und transferab

*Das klingt nach Detail, entscheidet aber, wen wir ansprechen — zwischen zwei Generationen derselben Technologie liegen oft voellig verschiedene Lebenslaeufe.*

> **„Welche Version oder welcher Teil von {Skill} laeuft bei Ihnen konkret?“**

| | |
|---|---|
| Antworttyp | Chips (kontextabhaengig generiert) + Freitext |
| Optionen | {z.B. SAP: 'ECC / R3'} · {z.B. SAP: 'S/4HANA'} · {z.B. SAP: 'Beides, wir migrieren gerade'} · Weiss ich nicht genau, das kann Ihnen unser Fachbereich sagen |
| Trigger | Nur bei Kern-Skills, die generationsabhaengig oder modular sind: SAP, Java, .NET, Angular, Datenbanken, Cloud-Plattformen, ERP allgemein, alles mit erkennbarer Versionshistorie. |
| Uebersprungen wenn | Skill ist versionsneutral (Python, Docker, Git) oder die Version steht bereits in der hochgeladenen Anzeige. |
| „Weiss ich nicht“ | Als Bestaetigungsfrage an den Fachbereich weiterreichen statt raten (JobIntakeStudio.tsx:710-729 bietet 'an Fachbereich geben' bereits an). Bis dahin den Oberbegriff behalten und im Recruiter-Text markieren. |
| Zielfeld | `job_skill_requirements.skill_name wird PRAEZISIERT (aus 'SAP' wird 'SAP S/4HANA FI') und job_skill_requirements.description bekommt den Klartext. Zusaetzlich jobs.tech_environment (string[]) — Spalte in PROD vorhanden (REST 200), heute IMMER null, weil ihr einziger Schreiber enrich-job-data ist (BEWIESEN HTTP 404).` |
| Folgefragen | – Waere jemand aus der jeweils anderen Welt ein Ausschluss — oder koennte er sich einarbeiten?<br>– Bei 'wir migrieren gerade': Soll die Person die Migration mitmachen oder danach den Betrieb uebernehmen? |
| Widerspruchsregel | Bei 'Beides, wir migrieren gerade' + 'muss beides koennen': 'Menschen, die beide Welten produktiv kennen, sind selten und teuer. Wollen wir lieber jemanden mit Migrationserfahrung suchen, unabhaengig vom Produkt?' |
| Starke Antwort | 'ECC, Umstieg auf S/4 ist fuer 2027 geplant — wer nur S/4 kennt, tut sich bei uns schwer.' |
| Schwache Antwort | 'Das aktuelle halt.' / 'Wir sind da modern aufgestellt.' |
| Wenn die Antwort fehlt | Der Skill bleibt als unspezifischer Oberbegriff im System. Der Recruiter schickt ECC-Leute in eine S/4-Rolle (oder umgekehrt), beide Seiten verlieren zwei Wochen, und der Kunde haelt den Recruiter fuer schlecht. |
| Zweck / Sensitivitaet | Matching · normal |

#### `IT-04` · Sauberer Schnitt zwischen Wunsch, Mindestanforderung und echtem Ausschluss. Der Kunde soll GENAU EINEN echten Ausschluss benennen — das zwingt zur Ehrlichkeit und schuetz

> **„Bei welcher einen Sache sagen Sie sicher Nein — egal wie gut alles andere passt?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext + 'Weiss ich nicht' |
| Optionen | {Kern-Skill 1 fehlt} · {Kern-Skill 2 fehlt} · Person kann nicht regelmaessig ins Buero kommen · Erforderliche Sprache fehlt · Es gibt kein echtes Nein — ueberzeugen Sie mich |
| Trigger | Nach IT-02, sobald die Muss-Liste steht. |
| Uebersprungen wenn | Nur ein einziger Muss-Skill existiert. |
| „Weiss ich nicht“ | Akzeptieren und als Chance verkaufen: 'Gut — dann arbeiten wir ohne hartes Ausschlusskriterium und zeigen Ihnen bewusst auch zwei Profile, die anders aussehen als gedacht.' Das ist ein legitimes Ergebnis, keine Luecke. |
| Zielfeld | `Der genannte Ausschluss wird zum einzigen Skill mit weight=1.5 in job_skill_requirements (bzw. bei Ort/Sprache auf die jeweilige K.O.-Karte IT-10/IT-11 umgeleitet). Alle anderen bleiben bei ihrem Gewicht aus IT-02. jobs.briefing_notes bekommt den Klartext (Spalte in PROD vorhanden, REST 200).` |
| Folgefragen | – Und das Zweitwichtigste — ist das ein Nein oder nur ein Nachteil?<br>– Hat schon einmal jemand genau daran gescheitert bei Ihnen? |
| Widerspruchsregel | Nennt der Kunde mehr als einen Ausschluss: 'Zwei harte Neins sind moeglich, aber jedes halbiert die Liste. Welches der beiden wuerden Sie fallen lassen, wenn Sie muessten?' |
| Starke Antwort | 'Ohne produktive Kubernetes-Erfahrung geht es nicht, weil die Person ab Tag eins Rufbereitschaft fuer unsere Cluster hat.' — Ausschluss mit Begruendung. |
| Schwache Antwort | 'Alle Muss-Kriterien sind Muss.' — das ist keine Antwort, sondern die Ausgangslage. |
| Wenn die Antwort fehlt | Der Recruiter kann nicht priorisieren und legt jeden Kandidaten vor, der 'ungefaehr passt'. Der Kunde lehnt ab, ohne dass jemand lernt, warum. |
| Zweck / Sensitivitaet | Matching · normal |

#### `IT-05` · Verantwortungsniveau — der wichtigste Trennschnitt zwischen 'Senior' auf dem Papier und Senior in der Realitaet. Wer bei Ihnen entscheidet, welche Technologie eingesetzt 

> **„Wer entscheidet bei Ihnen, mit welcher Technologie etwas gebaut wird?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Die Person selbst · Das Team gemeinsam · Ist vorgegeben, Architektur entscheidet · Ein externer Dienstleister |
| Trigger | Immer bei Titeln mit Senior, Lead, Principal, Architekt, Head of oder wenn experience_level >= senior. |
| Uebersprungen wenn | Junior- oder Mid-Level-Rolle ohne Fuehrungs- oder Architekturanteil. |
| „Weiss ich nicht“ | Als Frage an den fachlichen Ansprechpartner weiterreichen; bis dahin experience_level unveraendert lassen und im Recruiter-Text 'Entscheidungsspielraum ungeklaert' vermerken. |
| Zielfeld | `jobs.success_profile (Spalte in PROD vorhanden, REST 200) + jobs.briefing_notes. Bei 'ist vorgegeben' zusaetzlich: Korrekturvorschlag auf jobs.experience_level, weil die Rolle dann faktisch keine Lead-Rolle ist.` |
| Folgefragen | – Bei 'die Person selbst': Gegen wen muss sie diese Entscheidung durchsetzen?<br>– Bei 'ist vorgegeben': Dann suchen wir eher einen starken Umsetzer als einen Gestalter — passt das zum Titel 'Lead'? |
| Widerspruchsregel | Bei 'ist vorgegeben' + Titel enthaelt Lead/Principal/Architekt: 'Der Titel verspricht Gestaltung, die Realitaet ist Umsetzung. Kandidaten merken das im ersten Gespraech. Wollen wir den Titel anpassen oder den Spielraum erweitern?' |
| Starke Antwort | 'Die Person entscheidet den Stack fuer ihren Bereich, muss es nur mit der Architektur abstimmen — die letzten drei Vorschlaege sind alle durchgegangen.' |
| Schwache Antwort | 'Das machen wir gemeinsam im Team.' — kann alles heissen, von echter Autonomie bis zu 'niemand darf etwas entscheiden'. |
| Wenn die Antwort fehlt | Wir sprechen Gestalter an und verkaufen ihnen eine Umsetzer-Rolle. Die Absprungrate liegt dann im zweiten Gespraech, nach dem der Kunde bereits Zeit investiert hat. |
| Zweck / Sensitivitaet | Matching · normal |

#### `IT-06` · Team-Reife und Legacy-Anteil — was die Person am ersten Tag vorfindet. Der stabilste Praediktor dafuer, welcher Menschentyp bleibt. Kommt spaetestens im zweiten Gespraech

*Ich frage das offen, weil es niemandem nutzt, wenn wir es beschoenigen: Kandidaten erfahren es ohnehin im zweiten Gespraech, und dann springen sie ab.*

> **„Was findet die Person am ersten Tag vor — eine aufgeraeumte Umgebung oder eine, die dringend Ordnung braucht?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Modern und aufgeraeumt · Gemischt, historisch gewachsen · Viel Altlast — Aufraeumen ist ein Teil des Jobs · Gruene Wiese, es steht noch nichts |
| Trigger | Immer im IT-Pfad, nach IT-05. |
| Uebersprungen wenn | Rolle ist rein beratend/extern ohne eigene Systemverantwortung. |
| „Weiss ich nicht“ | Ueber die Symptome fragen statt ueber das Urteil: 'Wie oft kommt es vor, dass jemand ein System anfassen muss, das niemand mehr richtig kennt?' |
| Zielfeld | `jobs.briefing_notes + jobs.success_profile. GEPLANT WAR intake_payload.environment_maturity — Spalte fehlt in PROD (BEWIESEN, REST 42703), Antwort waere dort verloren.` |
| Folgefragen | – Wie gross ist der Altlast-Anteil ungefaehr — ein Viertel der Zeit, die Haelfte?<br>– Bei 'gruene Wiese': Wer trifft die grundlegenden Entscheidungen, die Person oder jemand darueber? |
| Widerspruchsregel | Bei 'viel Altlast' + Anforderung 'modernste Technologien': 'Sie werben mit modernem Stack, beschreiben aber viel Altlast. Kandidaten fragen im ersten Gespraech danach. Lassen Sie uns die Aufraeum-Aufgabe offensiv als Gestaltungsspielraum erzaehlen — das zieht andere, oft bessere Leute an.' |
| Starke Antwort | 'Ehrlich: gut die Haelfte der Zeit geht in ein altes System, das keiner mehr anfassen will. Genau deshalb suchen wir jemanden.' |
| Schwache Antwort | 'Ganz normal.' / 'Wie ueberall.' |
| Wenn die Antwort fehlt | Der Recruiter erzaehlt eine Greenfield-Geschichte, der Kandidat kommt und findet Altlast. Das kostet die Besetzung — und beim Kunden das Vertrauen in den Recruiter. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `IT-07` · Rufbereitschaft und Betriebsverantwortung. In DACH vertrags- und mitbestimmungsrelevant und einer der haeufigsten Absprunggruende im Angebotsstadium. Muss frueh auf den T

*Kandidaten fragen das frueh. Wenn es erst im Angebot auftaucht, springen sie ab — deshalb klaere ich es lieber jetzt.*

> **„Gehoert zu der Stelle Rufbereitschaft oder Einsatz ausserhalb der normalen Arbeitszeit?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Nein, gar nicht · Ja, im Turnus mit dem Team · Ja, aber nur bei Eskalation · Ist noch nicht geregelt |
| Trigger | Immer bei Betriebs-, Plattform-, Infrastruktur-, Cloud-, SRE-, Datenbank-, Security- und ERP-Betriebsrollen. Auch bei Entwicklerrollen, wenn das Team den eigenen Betrieb verantwortet. |
| Uebersprungen wenn | Reine Produkt-, Design- oder Projektrolle ohne Systembetrieb; oder Freelance-Mandat mit fest definiertem Leistungsumfang. |
| „Weiss ich nicht“ | Nicht wiederholen. Im Recruiter-Text und in der Kandidatenansprache offen kennzeichnen: 'Bereitschaftsregelung noch offen'. Als Nachfassthema fuer den Kunden markieren. |
| Zielfeld | `jobs.briefing_notes (Klartext) + Aufnahme in den Recruiter-Text und spaeter in das Angebot. GEPLANT WAR intake_payload.on_call — Spalte fehlt in PROD (42703).` |
| Folgefragen | – Wie oft trifft es die Person konkret — jede vierte Woche, jede zweite?<br>– Wird das verguetet oder mit Freizeit ausgeglichen?<br>– Bei 'noch nicht geregelt': Dann sage ich Kandidaten, dass es kommen kann und die Regelung noch offen ist — einverstanden? |
| Widerspruchsregel | Bei 'ja, im Turnus' + Gehalt am unteren Marktrand: 'Bereitschaft ist ein Preisaufschlag im Markt. Wenn wir das Band nicht anheben koennen, sollten wir den Ausgleich sehr konkret benennen — sonst sortieren gute Leute die Stelle direkt aus.' |
| Starke Antwort | 'Jede vierte Woche im Turnus, 400 Euro Pauschale plus Einsatzzeit als Freizeitausgleich, im Schnitt ein Anruf pro Turnus.' |
| Schwache Antwort | 'Nur im Notfall.' — jeder Betrieb hat Notfaelle; die Frage ist wie oft und wie geregelt. |
| Wenn die Antwort fehlt | Die Rolle wird ohne Bereitschaft verkauft und mit Bereitschaft angeboten. Das ist der klassische Abbruch kurz vor Vertragsunterschrift und beschaedigt beide Marken. |
| Zweck / Sensitivitaet | Vertrag · sensibel |

#### `IT-08` · Formale Zutrittshuerden, die kein Skill sind: Sicherheitsueberpruefung, Fuehrungszeugnis, Branchenzulassung, Pflichtzertifizierung. Fuer IT besonders wichtig, weil Securi

*Ich frage nur nach berufsbezogenen Voraussetzungen — die brauche ich, damit wir niemanden ansprechen, der ohnehin nicht anfangen duerfte.*

> **„Gibt es eine formale Voraussetzung, ohne die jemand bei Ihnen gar nicht anfangen kann?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext |
| Optionen | Nein, nichts davon · Erweitertes Fuehrungszeugnis · Sicherheitsueberpruefung (z.B. Ue2) · Bestimmte Zertifizierung — welche? · Muss bereits in Deutschland arbeiten duerfen |
| Trigger | Immer bei Security-, Public-Sector-, Ruestungs-, Finanz-, Gesundheits- und Kritis-Kontext; sonst nur, wenn in der Anzeige ein Zertifikat oder eine Ueberpruefung auftaucht. |
| Uebersprungen wenn | Kein regulierter Kontext und keine Zertifizierung in der Anzeige. |
| „Weiss ich nicht“ | Als 'nachholbar' behandeln, NICHT als Ausschluss setzen. Begruendung: ein faelschlich gesetzter Hard-Kill loescht die gesamte Trefferliste unbemerkt. |
| Zielfeld | `jobs.required_certifications (string[]) — Spalte in PROD vorhanden (REST 200) und vom Matcher als HARTER Ausschluss gelesen (calculate-match-v3-1:953-955, nur aktiv wenn defaults.license_required). Heute IMMER null, weil ihr einziger Schreiber JobIntakeStudio.tsx:378 ist und dieser Pfad nicht ausgeliefert ist. Arbeitserlaubnis geplant fuer jobs.visa_sponsorship — Spalte fehlt in PROD (BEWIESEN, 42703), Antwort waere verloren.` |
| Folgefragen | – Muss das schon vorliegen oder kann es die Person bei Ihnen nachholen?<br>– Wie lange dauert die Ueberpruefung bei Ihnen ungefaehr — das brauche ich fuer die Startterminplanung. |
| Widerspruchsregel | IMMER pruefen, bevor required_certifications geschrieben wird: nur eintragen, wenn die Antwort auf die Folgefrage 'muss schon vorliegen' lautet. Bei 'nachholbar' als Kann-Kriterium in die Beschreibung, nicht in das Ausschlussfeld. |
| Starke Antwort | 'Ue2 muss vorliegen oder beantragbar sein, dauert bei uns rund vier Monate — deshalb suchen wir bevorzugt Leute, die sie schon haben.' |
| Schwache Antwort | 'Zertifizierungen sind gern gesehen.' — das ist ein Wunsch, kein Zutritt. |
| Wenn die Antwort fehlt | Wir sprechen monatelang Menschen an, die gar nicht anfangen duerfen, und merken es erst im Onboarding. |
| Zweck / Sensitivitaet | Matching · DSGVO-relevant |

#### `IT-09` · Cloud-Reifegrad als Bewegung, nicht als Zustand. Entscheidet, ob die Zielplattform ein Muss ist oder ob wir Migrationskompetenz suchen. Wichtig, weil BEWIESEN nur AWS, Az

> **„Wo laufen Ihre Systeme heute — und wo sollen sie in zwei Jahren laufen?“**

| | |
|---|---|
| Antworttyp | Zwei Chips-Auswahlen (heute / in zwei Jahren) + Freitext |
| Optionen | Eigenes Rechenzentrum · Gemischt: teils eigenes RZ, teils Cloud · Groesstenteils Cloud · Von Anfang an cloud-nativ |
| Trigger | Bei allen Infrastruktur-, Plattform-, Cloud-, DevOps- und Architekturrollen; und immer, wenn AWS, Azure, GCP, Kubernetes oder Terraform unter den Skills auftauchen. |
| Uebersprungen wenn | Reine Frontend-, Produkt-, Design- oder Datenanalyse-Rolle ohne Infrastrukturbezug. |
| „Weiss ich nicht“ | Nur den heutigen Zustand nehmen und die Zukunftsfrage als offen markieren. Der heutige Zustand allein ist bereits verwertbar. |
| Zielfeld | `jobs.tech_environment (string[], PROD vorhanden, REST 200) + job_skill_requirements: bei erkennbarer Bewegung wird 'Migrationserfahrung' als eigener Muss-Eintrag ergaenzt statt nur der Zielplattform. jobs.briefing_notes fuer den Klartext.` |
| Folgefragen | – Soll die Person diesen Weg mitgestalten oder danach den Betrieb uebernehmen?<br>– Wer hat den Weg bisher geplant — gibt es schon eine Entscheidung fuer eine Plattform? |
| Widerspruchsregel | Bei 'eigenes RZ heute' + Zielplattform als Muss-Skill: 'Wenn die Plattform bei Ihnen erst kommt, finden wir niemanden, der sie bei Ihnen schon betrieben hat. Ich schlage vor, wir machen Migrationserfahrung zum Muss und die Zielplattform zum Kann — das oeffnet den Markt deutlich, ohne Qualitaet zu verlieren.' |
| Starke Antwort | 'Heute zwei Drittel eigenes RZ, in zwei Jahren alles auf Azure. Wir suchen genau jemanden, der so einen Umzug schon einmal gemacht hat.' |
| Schwache Antwort | 'Wir sind in der Cloud.' — sagt nicht, welche, wie tief und ob selbst betrieben. |
| Wenn die Antwort fehlt | Wir suchen nach der Zielplattform und uebersehen die Menschen, die den Weg dorthin koennen — obwohl das die eigentliche Aufgabe ist. Oder umgekehrt: wir schicken Cloud-Native-Leute in eine Rechenzentrumsrealitaet. |
| Zweck / Sensitivitaet | Matching · normal |

#### `IT-10` · Arbeitssprache als Marktgroesse. Die guenstigste Massnahme ueberhaupt: von 'alles Deutsch' auf 'Team Englisch' verdoppelt sich der erreichbare IT-Markt in Deutschland ung

> **„In welcher Sprache laeuft der Alltag im Team — und in welcher die Termine mit dem Rest des Hauses?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Alles auf Deutsch · Im Team Englisch, mit dem Haus Deutsch · Alles auf Englisch · Noch nicht entschieden |
| Trigger | Immer im IT-Pfad. Besonders wichtig bei Engineering-, Data- und Cloud-Rollen in Ballungsraeumen. |
| Uebersprungen wenn | Die Anzeige nennt die Arbeitssprache bereits eindeutig — dann Bestaetigungsfrage. |
| „Weiss ich nicht“ | Als 'Deutsch im Alltag, Englisch moeglich' fuehren und dem Kunden zwei englischsprachige Profile bewusst mitschicken. Die Reaktion darauf ist die eigentliche Antwort. |
| Zielfeld | `jobs.briefing_notes als Klartext. jobs.required_languages EXISTIERT in PROD (REST 200) und wird vom Matcher als HARTER Ausschluss gelesen (calculate-match-v3-1:921-923) — darf aber nach heutigem Stand NICHT gesetzt werden. Begruendung im Code selbst: normalize-job-requirements/index.ts:20-22 schreibt required_languages bewusst nicht, weil das 'den Language-Kill scharf schalten wuerde, solange candidates.language_skills leer ist'. Erst wenn die Kandidatenseite gefuellt ist, darf diese Antwort typisiert werden.` |
| Folgefragen | – Wenn jemand fachlich perfekt passt, aber erst B1-Deutsch spricht — waere das ein Nein?<br>– Sind Dokumentation und Code-Kommentare bei Ihnen deutsch oder englisch? |
| Widerspruchsregel | Bei 'alles Deutsch' + hoher Suchschwierigkeit: 'Mit Deutsch als Pflicht bleiben in Ihrem Feld realistisch {X} Menschen im erreichbaren Umkreis. Waere Englisch im Team eine Option, waeren es etwa doppelt so viele. Soll ich Ihnen zwei englischsprachige Profile zeigen, bevor Sie entscheiden?' |
| Starke Antwort | 'Im Team laeuft alles auf Englisch, nur die Quartalsrunde mit dem Fachbereich ist deutsch — B1 reicht dafuer.' |
| Schwache Antwort | 'Deutsch waere schon gut.' — Wunsch oder Ausschluss? Genau das muss geklaert werden. |
| Wenn die Antwort fehlt | Der Recruiter nimmt vorsichtshalber verhandlungssicheres Deutsch an und sortiert damit still die Haelfte des Marktes aus, ohne dass der Kunde je gefragt wurde. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `IT-11` · Die gelebte Vor-Ort-Praxis, nicht die Regelung. In IT der haeufigste stille Dealbreaker. Muss sauber von der Policy getrennt werden, weil die Policy in zwei widerspruechl

> **„Wie viele Tage ist das Team tatsaechlich im Buero — nicht die Regelung, sondern die Praxis?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Faktisch gar nicht · 1 Tag · 2 Tage · 3 Tage · 4-5 Tage, Anwesenheit ist Pflicht |
| Trigger | Immer, ausser remote_type ist bereits eindeutig 'remote'. |
| Uebersprungen wenn | remote_type = 'remote' und keine Buero-Adresse hinterlegt. |
| „Weiss ich nicht“ | Von der Regelung ausgehen (remote_policy) und im Recruiter-Text 'Praxis unklar, Spielraum wahrscheinlich' vermerken. onsite_required NICHT setzen. |
| Zielfeld | `jobs.onsite_days_required (PROD vorhanden) + Vereinheitlichung von jobs.remote_type und jobs.remote_policy, die heute widerspruchsfrei nur zufaellig sind (Inventar CJ-08 vs. CJ-15). jobs.onsite_required (boolean, PROD vorhanden, REST 200) NUR bei '4-5 Tage, Pflicht' setzen — dieses Feld ist ein HARTER Ausschluss (calculate-match-v3-1:944).` |
| Folgefragen | – Ist das eine feste Regel oder eine Erwartung?<br>– Waere jemand, der 200 km entfernt wohnt und zweimal im Monat kommt, ein Nein? |
| Widerspruchsregel | onsite_required nur bei ausdruecklicher Pflicht setzen — sonst loescht der Hard-Kill unbemerkt die gesamte Liste. Bei '4-5 Tage Pflicht' + Ballungsraum: 'Volle Anwesenheit kostet in diesem Markt spuerbar Reichweite. Waere ein Tag Homeoffice fuer den Richtigen verhandelbar?' |
| Starke Antwort | 'Auf dem Papier zwei Tage, real kommen die meisten einmal die Woche. Wer weiter weg wohnt, kommt alle zwei Wochen — das haben wir schon so geloest.' |
| Schwache Antwort | 'Hybrid.' — das Wort bedeutet in der Praxis alles zwischen null und vier Tagen. |
| Wenn die Antwort fehlt | Wir sprechen den Standort zu eng ein und uebersehen starke Leute im Umkreis von 150 km, die zweimal im Monat kommen wuerden. |
| Zweck / Sensitivitaet | Matching · normal |

#### `IT-12` · Das Sourcing-Bild: aus welchem Firmentyp der Ideal-Kandidat kommt. In IT entscheidender als die Branche, weil Konzern-IT, Produktunternehmen, Beratung und Mittelstand voe

> **„Wenn Sie an jemanden denken, der heute schon genau das macht, was Sie brauchen — wo arbeitet der?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext |
| Optionen | Bei einem direkten Wettbewerber · Bei einem Dienstleister oder in der Beratung · In einem Produkt- oder Techunternehmen · In der IT eines Konzerns · Im Mittelstand, aehnlich wie wir |
| Trigger | Immer, nach Klaerung der Muss-Kriterien. |
| Uebersprungen wenn | Der Kunde hat in der Anzeige bereits Zielfirmen oder eine Branche eindeutig benannt. |
| „Weiss ich nicht“ | Ueber den letzten Erfolg fragen: 'Wer war der beste Mensch, den Sie in den letzten Jahren fuer so eine Aufgabe eingestellt haben — und wo kam der her?' |
| Zielfeld | `GEPLANT WAR jobs.target_companies — Spalte fehlt in PROD (BEWIESEN, REST 42703), also heute nur jobs.briefing_notes (PROD vorhanden). Ohne die Migration ist diese Antwort nicht maschinell verwertbar, nur lesbar fuer den Recruiter.` |
| Folgefragen | – Fallen Ihnen zwei, drei konkrete Haeuser ein, deren Leute gut zu Ihnen passen wuerden?<br>– Gibt es umgekehrt Firmen, bei denen wir nicht ansprechen duerfen — Kunden, Partner, Absprachen? |
| Widerspruchsregel | Bei 'direkter Wettbewerber' als einziger Quelle: 'Wenn wir nur bei drei Wettbewerbern suchen duerfen, ist die Liste in zwei Wochen erschoepft. Waere ein angrenzendes Feld denkbar — und wenn ja, welches?' |
| Starke Antwort | 'Typischerweise die Nummer zwei in einem Mittelstaendler unserer Groesse, die endlich Nummer eins werden will.' |
| Schwache Antwort | 'Irgendjemand, der es kann.' |
| Wenn die Antwort fehlt | Der Recruiter sucht nach Titel und Stichwort statt nach Herkunft. Er legt Konzernprofile in einer Mittelstandsrolle vor — fachlich richtig, kulturell chancenlos. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `IT-13` · Anti-Persona in IT-Auspraegung. Deckt die Faelle auf, die fachlich passen und trotzdem scheitern. Nur bei erkennbarer Schwierigkeit stellen — sonst zu teuer fuer den Erke

> **„Wer ist bei Ihnen schon einmal gescheitert, obwohl der Lebenslauf perfekt aussah?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext + 'Ist noch nicht passiert' |
| Optionen | Kam aus dem Konzern, brauchte zu viel Struktur · Reiner Berater, konnte selbst nicht liefern · Zu spezialisiert fuer unsere Breite · Sehr belesen, aber wenig eigene Praxis · Ist noch nicht passiert |
| Trigger | Nur wenn mindestens eine der Bedingungen gilt: Suchschwierigkeit hoch, mehr als 5 Muss-Kriterien, die Stelle laeuft bereits laenger als 8 Wochen, oder IT-06 ergab 'viel Altlast'. |
| Uebersprungen wenn | Neu geschaffene Stelle ohne Vorgeschichte und ohne erkennbare Suchschwierigkeit. |
| „Weiss ich nicht“ | Akzeptieren und nicht wiederholen. Kapitel als skipped markieren. |
| Zielfeld | `jobs.briefing_notes. Zusaetzlich als Ausschluss-Hinweis in job_skill_requirements.description des betroffenen Kern-Skills.` |
| Folgefragen | – Woran haben Sie es gemerkt — was hat konkret nicht funktioniert?<br>– Haetten wir das im Lebenslauf sehen koennen, oder erst im Gespraech? |
| Widerspruchsregel | Wenn die Antwort eine ganze Herkunftsgruppe ausschliesst (z.B. 'keine Konzernleute'): 'Das schliesst einen grossen Teil des Marktes aus. Woran genau haette man es erkennen koennen — dann suchen wir nach dem Merkmal statt nach der Herkunft.' |
| Starke Antwort | 'Der Letzte kam aus einem Konzern mit eigenem Plattformteam. Bei uns muss man alles selbst machen — er hat drei Monate auf Zuarbeit gewartet, die nie kam.' |
| Schwache Antwort | 'Der hat einfach nicht gepasst.' |
| Wenn die Antwort fehlt | Wir wiederholen den Fehler des Kunden auf seine Kosten und auf unsere Zeit. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `IT-14` · Der eine technische Grund zu wechseln — erzaehlbar OHNE den Firmennamen. Direkt triple-blind-relevant: das ist das Material, mit dem der Recruiter anspricht, bevor die Id

*Recruiter sprechen Kandidaten an, ohne Ihren Namen zu nennen. Diese eine Sache ist alles, was sie in der Hand haben.*

> **„Was koennen wir jemandem ueber die Aufgabe erzaehlen, das ihn wirklich reizt — ohne Ihren Namen zu nennen?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Etwas Neues von Grund auf bauen · Ungewoehnlich grosser Gestaltungsspielraum · Technisch anspruchsvolle Groessenordnung · Modernisierung mit sichtbarem Ergebnis · Starkes Team, von dem man lernt |
| Trigger | Immer, gegen Ende des Pfades, nachdem Rolle und Umfeld stehen. |
| Uebersprungen wenn | Nie ueberspringen — das ist im Triple-Blind-Modell die Grundlage jeder Ansprache. |
| „Weiss ich nicht“ | Aus IT-06 und IT-09 selbst formulieren und dem Kunden als Bestaetigungsfrage vorlegen: 'Duerfen wir es so erzaehlen?' |
| Zielfeld | `jobs.briefing_notes. GEPLANT WAR reveal_envelope.green_list und .descriptor — Spalte reveal_envelope fehlt in PROD (BEWIESEN, REST 42703), die Triple-Blind-Angabe ist heute nicht persistierbar.` |
| Folgefragen | – Koennen wir das so sagen, ohne dass jemand Ihre Firma erraet?<br>– Was davon duerfen wir NICHT nennen, weil es Sie sofort verraten wuerde? |
| Widerspruchsregel | Enthaelt die Antwort etwas eindeutig Identifizierendes (Produktname, 'Marktfuehrer fuer X in Y', exakte Adresse), sofort zurueckspiegeln: 'Das wuerde Sie verraten. Ich formuliere es so um: {anonymisierte Fassung} — passt das?' Der Guardrail existiert im KI-Prompt bereits (intake-questions/index.ts:175, red_list), die Funktion ist in PROD aber nicht deployed (BEWIESEN, HTTP 404) — also muss die Regel im Frontend liegen. |
| Starke Antwort | 'Die Person baut unsere gesamte Deployment-Strecke neu auf — heute dauert ein Release zwei Tage, danach soll es zwanzig Minuten sein.' |
| Schwache Antwort | 'Wir sind ein tolles Team mit flachen Hierarchien.' — steht in jeder zweiten Anzeige und traegt kein Gespraech. |
| Wenn die Antwort fehlt | Der Recruiter spricht anonym mit leeren Haenden an. Die Antwortquote faellt, und der Kunde haelt den Markt fuer leer, obwohl nur die Ansprache leer war. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `IT-15` · Die echte Gehaltsdecke fuer den Richtigen — als Verhandlungsraum, nicht als Zahl. In IT unverzichtbar, weil die Kundenvorstellung dem Markt oft 12-24 Monate hinterherlaeu

> **„Angenommen, wir finden genau die richtige Person, sie liegt aber zehn Prozent ueber Ihrem Maximum — was passiert dann?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Geht nicht, das Band ist fix · Fuenf bis zehn Prozent liessen sich machen · Ueber Bonus oder Sonderzahlung loesbar · Sagen Sie uns, was der Markt aufruft |
| Trigger | Nur bei Festanstellung. Immer, wenn salary_max gesetzt ist; mit erhoehter Prioritaet, wenn IT-02 mindestens zweimal 'selbst eingefuehrt' ergeben hat. |
| Uebersprungen wenn | employment_type = 'freelance' (dort greift die Tagessatz-Logik) oder salary_max ist gar nicht gesetzt. |
| „Weiss ich nicht“ | Nicht wiederholen. Mit salary_max als harter Decke arbeiten und beim ersten starken Profil ueber dem Band konkret zurueckfragen — dann ist die Frage nicht mehr abstrakt. |
| Zielfeld | `jobs.briefing_notes (recruiter-privat, NICHT im Kandidatentext). GEPLANT WAR intake_payload.comp_ceiling — Spalte fehlt in PROD (42703). jobs.salary_min/salary_max bleiben unveraendert; die Decke ist das Verhandlungsbudget des Recruiters.` |
| Folgefragen | – Wer muesste einer Ausnahme zustimmen — und wie lange dauert das?<br>– Bei 'fix': Was koennen wir stattdessen bieten — Titel, Tage, frueherer Start? |
| Widerspruchsregel | Bei 'Band ist fix' + drei Kern-Skills auf Niveau 'selbst eingefuehrt': 'Sie suchen jemanden, der drei Dinge aufgebaut hat, zu einem Gehalt, fuer das der Markt Anwender bezahlt. Eines von beiden muss sich bewegen. Ich schlage vor, wir machen {Skill} zu Kann — dann passt das Budget zum Anspruch.' |
| Starke Antwort | 'Bis 95.000 ist mein Rahmen, darueber muss die Geschaeftsfuehrung zustimmen — das habe ich zweimal durchbekommen und es dauert etwa eine Woche.' |
| Schwache Antwort | 'Fuer den Richtigen finden wir immer eine Loesung.' — freundlich, aber im Abschluss wertlos. |
| Wenn die Antwort fehlt | Der Recruiter verhandelt am unteren Rand und verliert den besten Kandidaten an ein schnelleres Angebot, obwohl der Spielraum vorhanden gewesen waere. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `IT-16` · Fachliche Beurteilung und Reaktionsgeschwindigkeit. In IT prozesskritisch: gute Kandidaten sind in zwei Wochen vom Markt. Ersetzt die heute wirkungslose Frage nach der Za

> **„Wer schaut sich die Profile fachlich an — und wie schnell bekommen wir eine Rueckmeldung?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Zahl (Tage) + Freitext |
| Optionen | Ich selbst, innerhalb von zwei Tagen · Der fachliche Leiter, innerhalb einer Woche · Mehrere Personen, dauert laenger · Ist noch nicht geklaert |
| Trigger | Immer, als letzte Frage des Pfades. |
| Uebersprungen wenn | Nie ueberspringen. Billigste Frage des Pfades mit dem direktesten Effekt auf die Abschlussquote. |
| „Weiss ich nicht“ | Mit fuenf Werktagen als Annahme arbeiten und dem Kunden diese Annahme ausdruecklich mitteilen — dann korrigiert er sie meist selbst. |
| Zielfeld | `jobs.briefing_notes + Nutzung fuer die Nachfass-Steuerung. Ersetzt CJ-27 und IB-29, deren Antworten heute BEWIESEN nirgends gespeichert werden (CJ-27: decision_makers_count wird in CreateJob.tsx handleSubmit 619-668 nie verwendet).` |
| Folgefragen | – Ist diese Person im Urlaub oder auf Reisen in den naechsten Wochen?<br>– Wenn ein Profil richtig gut ist — wie schnell koennten Sie ein Erstgespraech anbieten? |
| Widerspruchsregel | Bei 'mehrere Personen, dauert laenger' + hiring_urgency = hot/urgent: 'Sie brauchen jemanden in unter vier Wochen, aber die Beurteilung dauert bei Ihnen laenger als der Markt wartet. Koennen wir eine Person benennen, die im Zweifel allein entscheidet?' |
| Starke Antwort | 'Unser Teamlead, der antwortet innerhalb von 48 Stunden. Ab uebernaechster Woche ist er zwei Wochen weg, dann uebernimmt seine Vertretung.' |
| Schwache Antwort | 'Zeitnah.' / 'Schnell.' |
| Wenn die Antwort fehlt | Profile liegen zehn Tage unbeantwortet. Der Kandidat nimmt woanders an, und beide Seiten schieben sich die Schuld zu. |
| Zweck / Sensitivitaet | Prozess · normal |

**Beispieldialog**

```
— Kontext: Kunde ist ein Maschinenbauer, 600 Mitarbeiter, Raum Stuttgart. Anzeige hochgeladen, Titel „Senior DevOps Engineer (m/w/d)". Aus der Anzeige extrahiert: Kubernetes, Terraform, AWS, Azure, Python, Go, Jenkins, Prometheus, Security, Netzwerk, Linux, Ansible. Gehalt 75.000–88.000. —

BERATER (IT-01): Sie haben zwölf Technologien in der Anzeige. Ich möchte die drei herausziehen, die wirklich jeden Tag gebraucht werden — an denen suchen wir, der Rest ist Bonus. Wenn Sie an eine normale Arbeitswoche denken: Mit welchen drei Technologien hat die Person täglich zu tun?

KUNDE: Ehrlich gesagt braucht er das alles. Das steht ja nicht umsonst drin.

BERATER: Verstehe — und in der Anzeige ist das auch richtig so. Für die Suche brauche ich aber eine Rangfolge, sonst suche ich nach einer Person, die es in Deutschland vielleicht zwanzigmal gibt. Deshalb anders gefragt: Wenn die Person am Montagmorgen den Rechner aufklappt — was macht sie als Erstes auf?

KUNDE: Naja … das Cluster. Kubernetes und Terraform, damit arbeitet er täglich. Python schreibt er auch viel.

BERATER: Gut, das ist die Antwort. Kubernetes, Terraform, Python sind die Pflicht. Die anderen neun nehme ich als „wäre schön" auf — sie zählen im Matching mit, sortieren aber niemanden aus. Einverstanden?

KUNDE: Aber AWS muss er schon können.

BERATER (IT-09): Dazu komme ich gleich. Vorher noch eine Sache zu Kubernetes (IT-02): Reicht es, wenn die Person damit gearbeitet hat — oder muss sie es selbst aufgebaut haben?

KUNDE: Selbst aufgebaut wäre optimal.

BERATER: „Optimal" nehme ich als Wunsch. Ich frage nach der Grenze: Wenn jemand seit vier Jahren produktiv auf Clustern arbeitet, die jemand anderes gebaut hat — ist der raus?

KUNDE: Nein, raus ist der nicht. Aber er muss verstehen, was da passiert, nicht nur kubectl tippen.

BERATER: Das ist verwertbar. Ich notiere: „hat Projekte damit verantwortet", nicht „hat es eingeführt". Das ist im Markt der Unterschied zwischen etwa dreihundert und etwa dreißig Menschen im Umkreis.

BERATER (IT-09): Jetzt zu AWS. Wo laufen Ihre Systeme heute — und wo sollen sie in zwei Jahren laufen?

KUNDE: Heute läuft fast alles im eigenen Rechenzentrum. In zwei Jahren soll das Meiste auf AWS sein, das ist beschlossen.

BERATER: Dann liegt hier ein Zielkonflikt, den ich Ihnen zeigen muss. Sie suchen jemanden mit AWS-Erfahrung für eine Umgebung, in der AWS bei Ihnen noch gar nicht läuft. Niemand kann bei Ihnen AWS betrieben haben. Mein Vorschlag: Wir machen „hat schon einmal ein Rechenzentrum in die Cloud gebracht" zum Pflichtkriterium und AWS selbst zum Wunsch. Damit kommen auch Azure-Leute in Frage — die Erfahrung überträgt sich, das Produkt lernt man in Wochen. Das öffnet uns spürbar den Markt und kostet Sie fachlich nichts.

KUNDE: Klingt vernünftig. Machen wir so.

BERATER (IT-07): Letzte unangenehme Frage, dann sind wir durch. Kandidaten fragen das früh, und wenn es erst im Angebot auftaucht, springen sie ab: Gehört zu der Stelle Rufbereitschaft?

KUNDE: Das ist bei uns im Team geregelt, das ist kein Thema.

BERATER: Das heißt, es gibt sie — und sie ist geregelt. Beides ist gut. Ich brauche nur zwei Zahlen, damit ich es ehrlich erzählen kann: Wie oft trifft es die Person, und wird sie dafür vergütet oder mit Freizeit ausgeglichen?

KUNDE: Jede vierte Woche. Es gibt eine Pauschale, ich glaube 350 Euro, plus Freizeitausgleich für tatsächliche Einsätze.

BERATER: Perfekt. Genau so sage ich es — jede vierte Woche, 350 Euro Pauschale, Einsätze werden ausgeglichen. Das ist für Ihre Zielgruppe eher ein Argument als ein Hindernis, weil es geregelt ist. Ungeregelte Bereitschaft ist das Problem, nicht die Bereitschaft selbst.

— Ergebnis dieses Ausschnitts: aus zwölf gleichgewichtigen Buzzwords sind drei Pflicht-Skills mit differenziertem Gewicht geworden (Kubernetes weight 1.0, Terraform 1.0, Python 0.8), ein neu geschaffenes Pflichtkriterium „Cloud-Migrationserfahrung", neun Kann-Kriterien — und eine Bereitschaftsregelung, die der Recruiter offensiv erzählen kann statt sie zu verschweigen. —
```


---

### Finance & Controlling

**Rollenfamilie:** Finance & Controlling (Bilanzbuchhaltung, Konzernrechnungswesen, Controlling, Tax, Treasury, CFO) · **Cards:** 16

> **Kernthese:** In Finance entscheidet nicht der Titel, sondern eine Kette aus vier Fakten: welchen Abschluss die Person eigenständig unterschreibt, nach welchem Standard, über wie viele Gesellschaften und in welchem System — alles andere ist Beiwerk; und genau diese vier Fakten fragt heute keiner der drei Aufnahmepfade typisiert ab, während die einzigen Felder, die den Recruiter überhaupt erreichen (recruiter_jobs_view), leer bleiben. KRITISCHE KORREKTUR AM INVENTAR: jobs.required_languages und jobs.required_certifications EXISTIEREN in PROD (BEWIESEN, REST liefert [] statt 42703; Kontrollprobe jobs.zzz_bogus_col → 42703) und sind Teil von recruiter_jobs_view (BEWIESEN, REST []) — das Inventar behauptet bei IB-13 fälschlich, es gebe keine Sprachspalte. Zweite Korrektur mit noch größerer Tragweite: jobs.briefing_notes ist in PROD NICHT Teil von recruiter_jobs_view (BEWIESEN: REST auf jobs.briefing_notes → [], REST auf recruiter_jobs_view.briefing_notes → 42703; gleiches Bild für intake_briefing, success_profile, team_size, vacancy_reason, reports_to) — damit erreicht KEINE der 34 statischen Briefing-Fragen (IB-01 bis IB-34) den Recruiter, weil ihr einziges Ziel briefing_notes ist. Der Kunde beantwortet 34 Fragen, der Recruiter sieht null davon. Gleichzeitig liegt ein leerer, recruiter-sichtbarer Kanal brach: jobs.screening_questions (JSONB) existiert in PROD (REST []), ist in recruiter_jobs_view (REST []) und wird dem Recruiter gerendert (BEWIESEN: src/pages/recruiter/JobDetail.tsx:511-531) — hat aber im gesamten Repo keinen einzigen Schreibzugriff (BEWIESEN: grep über src + supabase/functions, außer der Leseansicht kein Treffer). Mein Finance-Pfad landet deshalb konsequent auf must_haves / nice_to_haves / skills (Normalizer kanonisiert nachweislich 'datev' und 'sap fi', supabase/functions/_shared/match-v4.ts:179, und schreibt nach job_skill_requirements — Tabelle existiert in PROD mit skill_name/type/weight/min_years), auf intake_briefing (fließt über generate-job-summary/index.ts:112 in job_summary und damit in die View) und auf screening_questions — NIE auf briefing_notes. Dritte Warnung, Finance-spezifisch und scharf: required_certifications und required_languages sind HARTE KILL-Kriterien im Live-Matcher (BEWIESEN: supabase/functions/calculate-match-v3-1/index.ts:921-941 und :953-962, defaults license_required/language_required beide true, Zeile 736/738) — aber die Kandidatenseite ist leer: kein Code im Repo schreibt candidates.certifications (BEWIESEN: parse-cv/index.ts:214 schreibt ausschließlich expose_certifications), und normalize-job-requirements verweigert das Schreiben von required_languages ausdrücklich mit genau dieser Begründung (BEWIESEN: index.ts:19-21). Wer heute 'Bilanzbuchhalter IHK zwingend' oder 'Deutsch C1' in diese Felder schreibt, killt jeden einzelnen Kandidaten. Für genau die zwei Fragen, die im Finance-Markt am häufigsten K.-o.-Charakter haben, ist das Zielfeld also vorhanden, angeschlossen — und vergiftet.


#### `FIN-01` · Welcher der fünf faktisch getrennten Finance-Teilmärkte gemeint ist. 'Finance Manager', 'Finance Business Partner' oder 'Referent Rechnungswesen' sagen über den Kandidate

> **„Wo liegt der Schwerpunkt der Stelle — bei den Abschlüssen und der laufenden Buchhaltung, bei Auswertung und Planung, bei Steuern, oder bei Liquidität und Banken?“**

| | |
|---|---|
| Antworttyp | Chips, Einfachauswahl, zweite Auswahl als 'zusätzlich' möglich |
| Optionen | Abschlüsse & laufende Buchhaltung · Auswertung, Planung & Forecast · Steuern · Liquidität, Banken & Cash · Führung des gesamten Finanzbereichs |
| Trigger | Immer, als erste Finance-Frage, sobald der Titel steht und der Titel in die Rollenfamilie Finance fällt. |
| Uebersprungen wenn | Der Titel ist eindeutig einwertig (z. B. 'Lohnbuchhalter', 'Konzernbilanzbuchhalter', 'Treasury Manager') — dann nur als Bestätigung in einem Satz zeigen. |
| „Weiss ich nicht“ | Rückfall auf die Aufgabenliste aus der Anzeige: 'Ich lese aus Ihrer Anzeige heraus, dass der Schwerpunkt auf {X} liegt — passt das?' Wenn auch das nicht geht, Frage an den Fachbereich weiterreichen und Job als Entwurf halten. |
| Zielfeld | `jobs.skills (existiert, in recruiter_jobs_view) als führender Eintrag; steuert intern die Trigger von FIN-02/FIN-03/FIN-04/FIN-05` |
| Folgefragen | – Wenn in einer Woche nur die Hälfte der Zeit da ist — was macht die Person dann trotzdem?<br>– Was davon macht heute wer, und was bleibt liegen? |
| Widerspruchsregel | Wenn drei oder mehr Schwerpunkte gleichgewichtig genannt werden, oder wenn 'Abschlüsse' und 'Planung & Forecast' beide als gleich wichtig markiert sind: Hinweis, dass hier zwei getrennte Kandidatenmärkte gemischt werden, mit der Bitte, den Schwerpunkt zu benennen, der im Zweifel gewinnt. Kein Streichvorschlag, sondern Priorisierung. |
| Starke Antwort | Rund 70 % Monats- und Jahresabschluss nach HGB, 30 % Zuarbeit zum Konzernreporting. Steuern macht der Berater. |
| Schwache Antwort | Von allem etwas — die Person soll breit aufgestellt sein. |
| Wenn die Antwort fehlt | Der Recruiter bekommt einen Titel ohne Markt. Die Ansprache trifft Controlling-Profile für eine Bilanz-Stelle; Absagequote in Runde 1 steigt massiv. |
| Zweck / Sensitivitaet | Matching · normal |

#### `FIN-02` · Das Wort 'abschlusssicher' konkretisieren. Es ist der meistbenutzte und aussageloseste Begriff in Finance-Anzeigen. Entscheidend ist nicht, ob jemand schon mal an einem A

> **„Welchen Abschluss soll die neue Person eigenständig verantworten — also am Ende dafür geradestehen, nicht nur zuarbeiten?“**

| | |
|---|---|
| Antworttyp | Chips, Einfachauswahl |
| Optionen | Monatsabschluss · Quartalsabschluss · Jahresabschluss · Konzernabschluss · Noch keinen — arbeitet zu und wächst rein |
| Trigger | Wenn FIN-01 'Abschlüsse & laufende Buchhaltung', 'Steuern' oder 'Führung des gesamten Finanzbereichs' ergibt. |
| Uebersprungen wenn | Die Anzeige nennt bereits ausdrücklich einen konkreten Abschluss mit dem Wort 'eigenverantwortlich' oder 'selbstständig'. Dann nur bestätigen. |
| „Weiss ich nicht“ | Ersatzfrage über die Ist-Situation, die jeder beantworten kann: 'Wer macht den Jahresabschluss heute — intern oder der Steuerberater?' Daraus lässt sich der Anspruch sauber ableiten. |
| Zielfeld | `jobs.must_haves (existiert, in recruiter_jobs_view, wird vom Normalizer nach job_skill_requirements kanonisiert) als expliziter Eintrag, z. B. 'Jahresabschluss HGB eigenständig'; zusätzlich jobs.screening_questions` |
| Folgefragen | – Für wie viele Gesellschaften?<br>– Wer schaut heute gegen — der Steuerberater, der Prüfer, oder niemand?<br>– Und was davon macht die Person am ersten Tag, was erst nach einem Jahr? |
| Widerspruchsregel | Wenn 'Jahresabschluss' oder 'Konzernabschluss' eigenständig verlangt wird UND jobs.experience_level 'junior' oder 'mid' ist ODER jobs.salary_max unter dem Marktband liegt: Hinweis, dass eigenständige Abschlussverantwortung im DACH-Markt ein eigenes Preisschild hat, mit der konkreten Wahl zwischen Budget öffnen oder Verantwortung auf 'arbeitet zu' senken. |
| Starke Antwort | Jahresabschluss nach HGB für zwei GmbHs, eigenständig bis zur Vorlage beim Wirtschaftsprüfer. Der Monatsabschluss läuft heute schon im Team. |
| Schwache Antwort | Die Person soll abschlusssicher sein. |
| Wenn die Antwort fehlt | Der Recruiter kann Senior und Junior nicht auseinanderhalten und schickt Profile, die zwei Gehaltsbänder auseinanderliegen. Häufigster Grund für 'passt fachlich nicht' nach dem ersten Gespräch. |
| Zweck / Sensitivitaet | Matching · normal |

#### `FIN-03` · Das Controlling-Pendant zu FIN-02. Auch hier ist der Titel wertlos: 'Controller' reicht vom Kostenstellen-Buchhalter bis zum Sparringspartner der Geschäftsführung. Entsch

> **„Was liegt am Monatsende auf dem Tisch der Geschäftsführung, das die neue Person gebaut hat?“**

| | |
|---|---|
| Antworttyp | Chips, Mehrfachauswahl, plus Freitext |
| Optionen | Das Monatsreporting · Planung und Forecast · Kalkulation und Deckungsbeiträge · Ad-hoc-Analysen für konkrete Entscheidungen · Ein Reporting, das es heute noch gar nicht gibt |
| Trigger | Wenn FIN-01 'Auswertung, Planung & Forecast' ergibt (exklusiv zu FIN-02; beide werden nie zusammen gestellt, außer FIN-01 nennt beides ausdrücklich gleichgewichtig). |
| Uebersprungen wenn | FIN-01 hat reines Rechnungswesen ohne Controlling-Anteil ergeben. |
| „Weiss ich nicht“ | Ersatzfrage: 'Welche Auswertung fehlt Ihnen heute am meisten?' Die Antwort darauf ist inhaltlich gleichwertig und fällt jedem Geschäftsführer leicht. |
| Zielfeld | `jobs.must_haves + jobs.screening_questions (beide existieren, beide in recruiter_jobs_view)` |
| Folgefragen | – Wer baut das heute — und warum hört das auf?<br>– In welchem Werkzeug entsteht der Bericht am Ende: Excel, BI-Tool, direkt aus dem ERP?<br>– Sitzt die Person mit im Entscheidungsgespräch oder liefert sie die Zahlen zu? |
| Widerspruchsregel | Wenn 'Ein Reporting, das es heute noch gar nicht gibt' gewählt wird, das Gehaltsband aber im unteren Drittel liegt: Hinweis, dass Aufbau-Controlling ein anderes Profil ist als Pflege-Controlling und teurer eingekauft wird. |
| Starke Antwort | Ein monatliches Deckungsbeitragsreporting je Produktlinie, das heute in Excel entsteht und künftig aus Power BI kommen soll. Dazu die rollierende Forecast-Runde. |
| Schwache Antwort | Reporting und Analysen, das Übliche. |
| Wenn die Antwort fehlt | Der Recruiter kann Aufbau- und Betriebs-Controller nicht unterscheiden. Bewerber mit reiner Pflege-Erfahrung scheitern an der Aufbauaufgabe, Aufbau-Profile langweilen sich in der Pflege und gehen im ersten Jahr. |
| Zweck / Sensitivitaet | Matching · normal |

#### `FIN-04` · Rechnungslegungsstandard und — wichtiger — ob der genannte Standard eine echte Anforderung oder ein Wunsch ist. 'IFRS-Kenntnisse' ist die am häufigsten überzogene Anforde

> **„Nach welchen Regeln wird bei Ihnen bilanziert — HGB, IFRS, US-GAAP, oder mehrere parallel?“**

| | |
|---|---|
| Antworttyp | Chips, Mehrfachauswahl |
| Optionen | Nur HGB · HGB und IFRS parallel · Nur IFRS · US-GAAP (Konzernmutter im Ausland) · Weiß ich nicht genau |
| Trigger | Immer, wenn FIN-02 oder FIN-03 beantwortet ist. |
| Uebersprungen wenn | Die Anzeige nennt den Standard eindeutig und es gibt genau einen. Dann nur die Folgefrage 'Pflicht oder lernbar?' stellen. |
| „Weiss ich nicht“ | Aus dem Firmenprofil ableiten: Bei Konzernzugehörigkeit oder ausländischer Mutter IFRS/US-GAAP als Vermutung anbieten, sonst HGB annehmen — und als Vermutung kennzeichnen, nicht als Zusage. |
| Zielfeld | `Bei 'Pflicht' nach jobs.must_haves, bei 'wäre schön' nach jobs.nice_to_haves (beide existieren, beide in recruiter_jobs_view). Der Normalizer kanonisiert 'hgb'/'ifrs' und schreibt sie mit type must/nice nach job_skill_requirements (Tabelle existiert in PROD).` |
| Folgefragen | – Muss die Person IFRS am ersten Tag können, oder reicht es, wenn sie es bei Ihnen lernt?<br>– Erstellt die Person selbst nach IFRS, oder liefert sie nur ein Reporting-Package zu? |
| Widerspruchsregel | Wenn IFRS als Muss markiert ist, aber weder Kapitalmarktorientierung noch eine ausländische Konzernmutter vorliegt, oder wenn FIN-05 nur eine Gesellschaft ergeben hat: konkreter Vorschlag, IFRS von 'Muss' auf 'Kann' zu verschieben, mit der Begründung, dass reine HGB-Bilanzbuchhalter im Mittelstand ein Vielfaches der Grundgesamtheit ausmachen. Dieser eine Schieber ist im Finance-Markt der wirksamste Einzelhebel überhaupt. |
| Starke Antwort | Wir bilanzieren nach HGB. Die Konzernmutter berichtet nach IFRS, unsere Zuarbeit dafür ist ein Reporting-Package, kein eigener IFRS-Abschluss. IFRS-Erfahrung ist also nett, aber kein Muss. |
| Schwache Antwort | HGB, und IFRS wäre natürlich super. |
| Wenn die Antwort fehlt | Der Recruiter filtert entweder zu hart (verliert gute HGB-Leute an einer erfundenen IFRS-Hürde) oder zu weich (schickt HGB-Profile in eine echte IFRS-Rolle). Beides kostet eine volle Runde. |
| Zweck / Sensitivitaet | Matching · normal |

#### `FIN-05` · Unternehmenskomplexität als Zahl statt als Gefühl. Für ein Finance-Profil ist die Anzahl der Gesellschaften und der Auslandsbezug der stärkste Vorhersagewert überhaupt: '

*Kurz zur Größenordnung — daran erkennt ein Bilanzbuchhalter sofort, ob die Stelle zu ihm passt:*

> **„Wie viele Gesellschaften laufen über Ihre Bücher — und wie viele davon im Ausland?“**

| | |
|---|---|
| Antworttyp | Chips, Einfachauswahl, plus separate Zahl für Auslandsgesellschaften |
| Optionen | Nur eine Gesellschaft · 2 bis 5 · 6 bis 20 · Mehr als 20 |
| Trigger | Immer, wenn FIN-02 'Jahresabschluss' oder 'Konzernabschluss' ergibt, oder wenn der Titel 'Konzern', 'Group' oder 'Holding' enthält. |
| Uebersprungen wenn | FIN-01 ergab reines Controlling ohne Abschlussbezug und der Titel enthält kein 'Konzern'/'Group'. |
| „Weiss ich nicht“ | Aus dem Firmenprofil vorschlagen (headcount, annual_revenue) und als Bestätigungsfrage formulieren: 'Bei Ihrer Größe rechne ich mit einer Handvoll Gesellschaften — trifft das zu?' Wenn weiterhin unklar: als 'unbekannt' markieren, nicht raten, und im Recruiter-Text weglassen. |
| Zielfeld | `jobs.must_haves (bei Konsolidierungspflicht als Eintrag 'Konzernkonsolidierung, {n} Gesellschaften'); Größenband zusätzlich nach jobs.company_size_band (existiert, in recruiter_jobs_view). ACHTUNG De-Anonymisierung: exakte Zahl plus Branche plus Region kann die Firma identifizieren — an den Recruiter geht das Band, nicht die exakte Zahl.` |
| Folgefragen | – Wird konsolidiert — und wenn ja, womit?<br>– Welche Währungen kommen dazu?<br>– Macht die neue Person die Konsolidierung selbst, oder liefert sie zu? |
| Widerspruchsregel | Wenn mehr als 20 Gesellschaften mit Auslandsbezug genannt werden, aber Erfahrungslevel oder Gehaltsband auf Mittelstandsniveau stehen: Hinweis, dass Konzernkonsolidierer ein knapper, teuer gehandelter Markt sind, mit der Wahl zwischen Budget, längerer Laufzeit oder Zuarbeits-Zuschnitt. |
| Starke Antwort | Sieben Gesellschaften, davon zwei in Polen und eine in der Schweiz. Konsolidiert wird in LucaNet, Fremdwährung ist ein Thema. |
| Schwache Antwort | Wir sind eine mittelständische Gruppe. |
| Wenn die Antwort fehlt | Der Recruiter kalibriert falsch und schickt Mittelstands-Allrounder in eine Konzernrolle oder umgekehrt Konzern-Spezialisten in eine Ende-zu-Ende-Rolle. Beides ist im Finance-Bereich die klassische Fehlbesetzung, siehe FIN-14. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `FIN-06` · Die konkrete Systemlandschaft. 'SAP-Kenntnisse' ist in Finance-Anzeigen die zweithäufigste Leerformel nach 'abschlusssicher': SAP FI, SAP CO, SAP FI-AA und S/4HANA sind f

> **„In welchem System bucht oder arbeitet die Person täglich — und wenn es SAP ist: welche Module?“**

| | |
|---|---|
| Antworttyp | Chips mit Freitext-Präzisierung, Mehrfachauswahl |
| Optionen | SAP (welche Module?) · DATEV · Microsoft Dynamics / Navision / Business Central · Oracle · Sage / Lexware / andere · Weiß ich nicht genau |
| Trigger | Immer. |
| Uebersprungen wenn | Die Anzeige nennt System UND Module bereits eindeutig. Dann nur die Folgefrage 'Pflicht oder anlernbar?' stellen — die ist nie in der Anzeige beantwortet. |
| „Weiss ich nicht“ | An den Fachbereich weiterreichen; ersatzweise die niedrigschwellige Ersatzfrage: 'In welchem Programm sehen Sie Ihre Zahlen, wenn Sie sie ansehen?' Das beantwortet auch ein Geschäftsführer ohne Finance-Hintergrund. |
| Zielfeld | `jobs.skills und bei Pflicht zusätzlich jobs.must_haves (beide existieren, beide in recruiter_jobs_view). Der Normalizer kennt 'datev' und 'sap fi' ausdrücklich als kanonische Formen (supabase/functions/_shared/match-v4.ts:179) und schreibt daraus job_skill_requirements mit type und min_years — der einzige belastbar strukturierte Ausgang des gesamten Fragenpfads in PROD.` |
| Folgefragen | – Welches Nebensystem hängt dran — LucaNet, IDL, Power BI, ein DMS?<br>– Ist das System eine echte Voraussetzung, oder in vier Wochen anlernbar, wenn die Fachlichkeit stimmt?<br>– Klassisches SAP ECC oder schon S/4HANA? |
| Widerspruchsregel | Wenn ein knappes System als Muss gesetzt ist (S/4HANA, LucaNet, IDL) UND das Gehaltsband im unteren Drittel liegt: Hinweis mit Zahl, dass die Systemhürde den Markt stärker verkleinert als die Fachlichkeit, und die Frage, ob das System oder die Abschlusssicherheit im Zweifel gewinnt. |
| Starke Antwort | SAP FI und FI-AA, produktiv, kein S/4HANA. Daneben LucaNet für die Konsolidierung und Excel für alles andere. DATEV brauchen wir nicht. |
| Schwache Antwort | SAP. |
| Wenn die Antwort fehlt | Der Recruiter kann die Trefferliste nicht filtern. In Finance ist das ERP das erste Kriterium, nach dem in jeder Datenbank gesucht wird — ohne diese Angabe wird die Suche unspezifisch und die Ansprache unglaubwürdig. |
| Zweck / Sensitivitaet | Matching · normal |

#### `FIN-07` · Ob die Stelle Linie oder Umbau ist. Systemwechsel, Erstkonsolidierung, Carve-out oder Digitalisierung verändern das gesuchte Profil vollständig — und sind gleichzeitig da

> **„Läuft bei Ihnen gerade ein größerer Umbau im Finanzbereich — ein Systemwechsel, eine Erstkonsolidierung, ein Zukauf, der integriert werden muss?“**

| | |
|---|---|
| Antworttyp | Chips, Mehrfachauswahl, plus Freitext |
| Optionen | Nein, stabiler Betrieb · Umstellung auf S/4HANA oder ein neues ERP · Erstkonsolidierung / neuer Konzernabschluss · Carve-out oder Integration nach einem Zukauf · Digitalisierung der Buchhaltung (Beleglauf, Automatisierung) |
| Trigger | Immer. |
| Uebersprungen wenn | Nie überspringen. Auch ein 'nein' ist wertvoll, weil es dem Recruiter sagt, dass er über Stabilität und nicht über Gestaltung verkaufen muss. |
| „Weiss ich nicht“ | Ersatzfrage: 'Was soll im Finanzbereich in zwei Jahren anders sein als heute?' Die Antwort liefert dasselbe, ohne Projektvokabular. |
| Zielfeld | `jobs.intake_briefing (existiert; erreicht den Recruiter nachweislich indirekt über generate-job-summary/index.ts:112 → jobs.job_summary → recruiter_jobs_view) sowie bei Projekterfahrung als Anforderung nach jobs.nice_to_haves. Ausdrücklich NICHT nach briefing_notes.` |
| Folgefragen | – Ist das der Grund für die Stelle — oder läuft es nebenher?<br>– Wie viel Prozent der Zeit geht in dieses Projekt?<br>– Was passiert mit der Rolle, wenn das Projekt abgeschlossen ist? |
| Widerspruchsregel | Wenn ein Umbau genannt wird, aber der Titel und das Gehaltsband auf reine Sachbearbeitung deuten: Hinweis, dass Projektanteil das Profil verteuert, aber auch die Ansprache spürbar erleichtert — Vorschlag, den Projektanteil in Titel und Anzeige sichtbar zu machen statt ihn zu verstecken. |
| Starke Antwort | Wir stellen im nächsten Jahr auf S/4HANA um. Die neue Person soll aus dem Rechnungswesen heraus dabei mitgestalten, ist aber nicht Projektleitung. |
| Schwache Antwort | Nichts Besonderes, das Übliche. |
| Wenn die Antwort fehlt | Die Ansprache hat kein Argument außer Geld. In Finance ist der typische Zielkandidat unbefristet, gut bezahlt und nicht suchend — ohne Gestaltungsversprechen antwortet er nicht. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `FIN-08` · Den tatsächlichen Führungsumfang gegen den Titel prüfen. Finance-Titel sind stark inflationiert: 'Head of Accounting' ohne Mitarbeiter ist ein Senior Accountant, 'Teamlei

> **„Wie viele Mitarbeiter führt die Person direkt?“**

| | |
|---|---|
| Antworttyp | Chips, Einfachauswahl |
| Optionen | Keine · 1 bis 3 · 4 bis 8 · Mehr als 8 |
| Trigger | Wenn der Titel Führung suggeriert (Leiter, Head, Manager, Teamleitung, CFO) ODER wenn FIN-01 'Führung des gesamten Finanzbereichs' ergibt. |
| Uebersprungen wenn | Der Titel ist eindeutig eine Fachrolle ohne Führungsanspruch (Sachbearbeiter, Referent, Specialist) und die Anzeige erwähnt keine Führung. |
| „Weiss ich nicht“ | Ersatzfrage über den Ist-Zustand: 'Wie viele Leute sitzen heute in der Buchhaltung, und wer koordiniert sie?' Danach als abgeleitete Annahme kennzeichnen. |
| Zielfeld | `jobs.team_size (existiert in PROD, ABER: nicht Teil von recruiter_jobs_view, BEWIESEN 42703 auf der View) — deshalb ZUSÄTZLICH als expliziter Eintrag nach jobs.must_haves, z. B. 'Führung von 5 Mitarbeitern, disziplinarisch'. Nur so erreicht die Angabe den Recruiter.` |
| Folgefragen | – Mit Personalverantwortung — also Einstellung, Gehalt, Beurteilung — oder fachlich?<br>– An wen berichtet die Rolle?<br>– Gibt es im Team jemanden, der die Stelle selbst wollte? |
| Widerspruchsregel | Wenn der Titel 'Leiter' oder 'Head' enthält, die Antwort aber 'Keine' lautet: Hinweis, dass der Titel im Markt eine Erwartung erzeugt, die im ersten Gespräch enttäuscht wird — Vorschlag, entweder den Titel zu korrigieren oder die Perspektive auf Teamaufbau ausdrücklich zu benennen. |
| Starke Antwort | Fünf Mitarbeiter direkt, davon zwei in Teilzeit, mit Personalverantwortung. Berichtet an den kaufmännischen Geschäftsführer. |
| Schwache Antwort | Die Person führt das Team. |
| Wenn die Antwort fehlt | Der Recruiter verspricht Führung, die es nicht gibt, oder unterschlägt Führung, die es gibt. Ersteres kostet den Kandidaten nach der Zusage, letzteres kostet die guten Kandidaten schon in der Ansprache. |
| Zweck / Sensitivitaet | Matching · normal |

#### `FIN-09` · Ob ein formaler Abschluss zwingend ist. In Finance ist das der teuerste Filter überhaupt: Bilanzbuchhalter (IHK), Steuerberater oder Wirtschaftsprüfer als hartes Muss red

*Kurz zu den Abschlüssen — die kosten in der Ansprache am meisten Zeit, deshalb frage ich es genau:*

> **„Muss ein formaler Abschluss zwingend vorliegen — Bilanzbuchhalter, Steuerberater, Wirtschaftsprüfer — oder zählt am Ende die Praxis?“**

| | |
|---|---|
| Antworttyp | Chips, Einfachauswahl |
| Optionen | Bilanzbuchhalter (IHK) zwingend · Steuerberater zwingend · Wirtschaftsprüfer zwingend · Gern gesehen, aber kein Muss · Praxis zählt, Abschluss egal |
| Trigger | Wenn FIN-02 'Jahresabschluss' oder 'Konzernabschluss' ergibt, oder wenn FIN-01 'Steuern' ergibt, oder wenn die Anzeige einen dieser Titel nennt. |
| Uebersprungen wenn | FIN-01 ergab reines Controlling oder Treasury ohne Abschlussbezug. |
| „Weiss ich nicht“ | Als 'gern gesehen' behandeln, nicht als Muss — die vorsichtige Auslegung schadet hier nie, die scharfe schon. Kennzeichnen als abgeleitet und im Recruiter-Text als 'von Vorteil' formulieren. |
| Zielfeld | `HEUTE: bei 'zwingend' nach jobs.must_haves plus jobs.screening_questions; bei 'gern gesehen' nach jobs.nice_to_haves. AUSDRÜCKLICH NOCH NICHT nach jobs.required_certifications — das Feld existiert zwar in PROD und liegt in recruiter_jobs_view, ist aber ein scharfes Hard-Kill-Kriterium (calculate-match-v3-1/index.ts:953-962, license_required default true, Zeile 738), während die Kandidatenseite leer ist: kein Code schreibt candidates.certifications, parse-cv/index.ts:214 schreibt nur expose_certifications. Ein Eintrag dort killt heute jeden Kandidaten. Erst nach einem Backfill von candidates.certifications freigeben.` |
| Folgefragen | – Wenn jemand seit acht Jahren Jahresabschlüsse macht, aber den Schein nicht hat — sehen Sie sich den an?<br>– Ist das eine Vorgabe von außen (Prüfer, Konzernmutter, Kunde), oder Ihre eigene Einschätzung? |
| Widerspruchsregel | Wenn 'zwingend' gewählt wird UND das Gehaltsband im unteren Drittel liegt ODER FIN-05 nur eine Gesellschaft ergeben hat: Hinweis, dass ein Pflichtabschluss den Kreis stark verkleinert und im Markt eigenständig bepreist wird — mit der konkreten Frage, ob nachgewiesene Abschlusspraxis den fehlenden Schein ersetzen darf. Diese eine Rückfrage öffnet in der Praxis die meisten festgefahrenen Bilanz-Suchen. |
| Starke Antwort | Bilanzbuchhalter ist mir wichtig, aber wer zehn Jahre Abschlüsse gemacht hat und den Schein nicht hat, den sehe ich mir trotzdem an. Steuerberater brauche ich nicht. |
| Schwache Antwort | Bilanzbuchhalter oder vergleichbare Qualifikation. |
| Wenn die Antwort fehlt | Der Recruiter setzt den Abschluss vorsichtshalber als hart und verliert die Hälfte des Marktes an einer Hürde, die der Kunde gar nicht gemeint hat. |
| Zweck / Sensitivitaet | Matching · normal |

#### `FIN-10` · Das tatsächlich benötigte Deutschniveau, getrennt nach Wunsch und Absagegrund. In Finance ist Deutsch häufiger ein echter K.-o. als in anderen Familien — ein HGB-Abschlus

*Weil das über die halbe Trefferliste entscheidet, frage ich es genauer als üblich:*

> **„Auf welchem Niveau muss die Person Deutsch sprechen — reicht gutes Arbeitsdeutsch, oder muss sie einen Abschluss mit dem Steuerberater und dem Prüfer verhandeln können?“**

| | |
|---|---|
| Antworttyp | Chips, Einfachauswahl |
| Optionen | Verhandlungssicher — Abschluss und Prüfung laufen auf Deutsch · Gutes Arbeitsdeutsch reicht, Fachbegriffe werden gelernt · Englisch reicht, Konzernsprache ist Englisch · Beides fließend erforderlich |
| Trigger | Immer, wenn FIN-02 einen Abschluss ergibt oder FIN-01 'Steuern' ergibt. Bei reinem Controlling in Konzernumgebung ebenfalls, dann aber mit Fokus auf die Konzernsprache. |
| Uebersprungen wenn | Die Anzeige nennt bereits ein konkretes Niveau UND die Rolle ist eindeutig englischsprachig (Konzernrolle mit englischem Titel und englischer Anzeige). |
| „Weiss ich nicht“ | Aus der Aufgabe ableiten: Abschluss oder Steuern im Zuschnitt → verhandlungssicheres Deutsch als Vermutung, sonst Arbeitsdeutsch. Als abgeleitet kennzeichnen und nie als hartes Kriterium in ein Killfeld schreiben. |
| Zielfeld | `HEUTE: nach jobs.must_haves und jobs.screening_questions (beide existieren, beide in recruiter_jobs_view). AUSDRÜCKLICH NOCH NICHT nach jobs.required_languages — das Feld existiert in PROD (entgegen der Inventarangabe bei IB-13) und liegt in recruiter_jobs_view, ist aber ein Hard-Kill (calculate-match-v3-1/index.ts:921-941, language_required default true) gegen ein leeres candidates.language_skills; normalize-job-requirements verweigert das Schreiben ausdrücklich aus genau diesem Grund (index.ts:19-21). Freigabe erst nach Backfill der Kandidatensprachen.` |
| Folgefragen | – Ist das eine Absage-Grenze oder ein Wunsch?<br>– Was macht die Person konkret auf Deutsch, das schiefgeht, wenn die Sprache nicht reicht? |
| Widerspruchsregel | Wenn verhandlungssicheres Deutsch als hartes Muss gesetzt wird UND gleichzeitig ein knappes System (FIN-06) und ein Pflichtabschluss (FIN-09) verlangt werden: Hinweis, dass drei harte Filter übereinander den Markt praktisch schließen, mit der Bitte, den am wenigsten kritischen davon zu benennen. Fachlich sauber begründen: Sprache lässt sich am wenigsten nachtrainieren, Abschluss am zweitwenigsten, System am ehesten. |
| Starke Antwort | Deutsch verhandlungssicher, weil die Person die Betriebsprüfung begleitet und mit unserem Steuerberater arbeitet. Englisch nur für gelegentliche Konzernmails, das reicht auf Schulniveau. |
| Schwache Antwort | Sehr gutes Deutsch, versteht sich. |
| Wenn die Antwort fehlt | Entweder werden gute internationale Profile grundlos aussortiert, oder es wird ein Kandidat bis ins Angebot getragen, der in der Betriebsprüfung nicht bestehen kann. Der zweite Fall ist der teurere. |
| Zweck / Sensitivitaet | Matching · sensibel |

#### `FIN-11` · Ob Branchenerfahrung ein echtes Erfordernis oder eine Gewohnheit ist. Buchhaltung ist zu 90 % branchenunabhängig — die Ausnahmen sind wenige, aber hart: Langfristfertigun

> **„Gibt es in Ihrer Buchhaltung etwas, das man anderswo nicht lernt — Baustellen und Teilgewinne, Bestandsbewertung, Fördermittel, Meldepflichten?“**

| | |
|---|---|
| Antworttyp | Chips, Mehrfachauswahl, plus Freitext |
| Optionen | Nein, im Kern Standard · Langfristfertigung / Teilgewinnrealisierung · Warenwirtschaft und Bestandsbewertung · Immobilien · Regulatorik und Meldewesen · Fördermittel und Zuschüsse |
| Trigger | Immer, wenn die Anzeige oder die Muss-Kriterien 'Branchenerfahrung' oder eine konkrete Branche als Anforderung enthalten. Sonst optional. |
| Uebersprungen wenn | Weder Anzeige noch Muss-Kriterien nennen Branchenerfahrung. |
| „Weiss ich nicht“ | Als 'im Kern Standard' behandeln und Branchenerfahrung nach nice_to_haves schieben. Die vorsichtige Auslegung öffnet den Markt und kostet nichts. |
| Zielfeld | `Bei echtem Erfordernis nach jobs.must_haves, sonst nach jobs.nice_to_haves; Branche selbst nach jobs.industry (existiert, in recruiter_jobs_view).` |
| Folgefragen | – Muss die Person das mitbringen — oder ist das in drei Monaten gelernt?<br>– Wenn Sie zwei Kandidaten hätten: einer aus Ihrer Branche mit weniger Abschlusserfahrung, einer aus einer anderen Branche mit mehr — wen sehen Sie zuerst? |
| Widerspruchsregel | Wenn 'Branchenerfahrung' als Muss steht, aber keine der besonderen Sachverhalte gewählt wird: konkreter Vorschlag, Branchenerfahrung von 'Muss' auf 'Kann' zu setzen, mit dem Hinweis, welche angrenzenden Branchen dadurch zusätzlich erreichbar werden. |
| Starke Antwort | Im Kern Standard-Buchhaltung. Einzige Besonderheit: wir bilanzieren Fördermittel, das ist erklärungsbedürftig, aber in drei Monaten gelernt. Branchenerfahrung brauche ich nicht. |
| Schwache Antwort | Branchenerfahrung wäre schon wichtig. |
| Wenn die Antwort fehlt | Der Recruiter sucht innerhalb der Branche und übersieht die deutlich größere Gruppe fachlich passender Kandidaten daneben. In Finance ist das der häufigste selbstgemachte Engpass. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `FIN-12` · Die tatsächliche Vergütungsstruktur und die echte Obergrenze. Drei Dinge, die in Finance regelmäßig erst im Angebot auffallen und dann Prozesse platzen lassen: dass die g

*Damit wir Ihnen keine Kandidaten bringen, die am Ende am Geld scheitern — und damit unsere Leute das im ersten Gespräch offen sagen können:*

> **„Ist die genannte Zahl das Fixgehalt — oder ist ein variabler Anteil schon enthalten?“**

| | |
|---|---|
| Antworttyp | Chips plus Zahlenfeld für den variablen Anteil |
| Optionen | Reines Fixgehalt · Fix plus variabler Anteil (Höhe?) · Nach Tarif oder fester Eingruppierung · Noch nicht festgelegt |
| Trigger | Immer, sobald ein Gehaltsband erfasst ist. Bei Interim- und Freelance-Zuschnitt stattdessen die Tagessatz-Variante. |
| Uebersprungen wenn | Nie überspringen — außer der Kunde hat bei einem früheren Job desselben Unternehmens bereits Tarifbindung und variable Struktur angegeben; dann als Bestätigung in einem Satz zeigen. |
| „Weiss ich nicht“ | Bei 'noch nicht festgelegt': Marktband für den in FIN-02/FIN-05 beschriebenen Zuschnitt vorschlagen und bestätigen lassen. Das ist Beratung und der Punkt, an dem der Kunde den Wert der Aufnahme spürt. |
| Zielfeld | `jobs.salary_min / salary_max (existieren, in recruiter_jobs_view); variabler Anteil nach jobs.bonus_structure (existiert in PROD, BEWIESEN — aber NICHT in recruiter_jobs_view, ABGELEITET aus der View-Definition, deshalb zusätzlich in einem Satz nach jobs.intake_briefing, das über job_summary den Recruiter erreicht). Tarifbindung und Eingruppierung nach jobs.screening_questions, weil sie im Gespräch vorab genannt werden müssen.` |
| Folgefragen | – Sind Sie tarifgebunden oder gibt es eine feste Eingruppierung? Dann sagen wir das den Kandidaten vorher, statt am Ende.<br>– Wenn wir Ihnen genau das richtige Profil bringen, das acht Prozent über Ihrem Maximum liegt — führen Sie das Gespräch?<br>– Woran hängt der variable Teil — an Unternehmens- oder an persönlichen Zielen? |
| Widerspruchsregel | Wenn das Fixum unter dem Marktband für die in FIN-02 verlangte Abschlussverantwortung liegt: Hinweis mit Bezug auf genau diese Verantwortung ('eigenständiger Jahresabschluss für sieben Gesellschaften wird im Markt anders bepreist'), und die Wahl zwischen Budget öffnen, Verantwortung zuschneiden oder längere Laufzeit akzeptieren. |
| Starke Antwort | 75.000 Euro fix, dazu bis zu 10 % variabel an Unternehmenszielen. Wir sind nicht tarifgebunden. Für jemanden, der wirklich passt, gehe ich beim Fixum auf 82.000 — das würde ich aber nicht in die Anzeige schreiben. |
| Schwache Antwort | Das machen wir dann individuell, je nach Kandidat. |
| Wenn die Antwort fehlt | Der Recruiter verhandelt gegen eine Obergrenze, die es so nicht gibt, oder gegen eine Tarifgrenze, von der er nichts weiß. Beides führt zur Absage nach dem Angebot — dem teuersten Zeitpunkt. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `FIN-13` · Die Präsenzpflicht in der Abschlussphase. Das ist die spezifischste und wirksamste Frage der gesamten Finance-Familie: Sehr viele als 'hybrid, zwei Bürotage' ausgeschrieb

> **„Sie haben Homeoffice-Tage genannt — gilt das auch in der Abschlusswoche, oder erwarten Sie die Person dann durchgehend vor Ort?“**

| | |
|---|---|
| Antworttyp | Chips, Einfachauswahl |
| Optionen | Gilt immer, auch im Abschluss · In der Abschlusswoche durchgehend vor Ort · Der Abschluss läuft ohnehin überwiegend remote · Ist noch nicht besprochen |
| Trigger | Wenn jobs.remote_policy 'hybrid' oder 'full_remote' ist, oder jobs.remote_type nicht 'onsite' ist — und FIN-02 einen Abschluss ergeben hat. |
| Uebersprungen wenn | jobs.remote_policy ist 'onsite_only' — dann ist die Frage gegenstandslos. |
| „Weiss ich nicht“ | Als offene Frage an den Fachbereich markieren und im Recruiter-Hinweis ausdrücklich als ungeklärt kennzeichnen, damit der Recruiter sie nicht versehentlich zusagt. |
| Zielfeld | `jobs.onsite_required und jobs.onsite_days_required (beide existieren, beide in recruiter_jobs_view) plus ein Klartextsatz nach jobs.screening_questions (existiert, in recruiter_jobs_view, wird dem Recruiter gerendert — src/pages/recruiter/JobDetail.tsx:511-531 — und hat heute keinen einzigen Writer).` |
| Folgefragen | – Wie viele Tage sind das im Monat konkret?<br>– Gilt das auch im Jahresabschluss, also über mehrere Wochen?<br>– Wie handhaben Sie das heute im Team? |
| Widerspruchsregel | Wenn 'Ist noch nicht besprochen' gewählt wird: Hinweis, dass diese Frage im Bewerbungsprozess sicher kommt und eine unklare Antwort im dritten Gespräch teurer ist als eine unbequeme Antwort im ersten — mit der Bitte, sie vor der ersten Ansprache mit dem Fachbereich zu klären. |
| Starke Antwort | Grundsätzlich zwei Bürotage. In den ersten fünf Arbeitstagen des Monats erwarte ich die Person aber vor Ort, weil der Monatsabschluss läuft. Das sagen wir Kandidaten von Anfang an. |
| Schwache Antwort | Wir sind da flexibel. |
| Wenn die Antwort fehlt | Kandidatenabsprünge in Runde drei oder in der Probezeit, aus einem Grund, der zehn Sekunden Aufnahme gekostet hätte. In Finance ist das die häufigste vermeidbare Absage. |
| Zweck / Sensitivitaet | Beratung · normal |

#### `FIN-14` · Das Anti-Profil in den vier Mustern, die in Finance real vorkommen. Als offene Frage bringt 'wer würde hier scheitern' meist nichts; als Auswahl mit den echten Finance-Fe

> **„Wer würde hier trotz perfektem Lebenslauf scheitern?“**

| | |
|---|---|
| Antworttyp | Chips, Mehrfachauswahl, plus Freitext |
| Optionen | Wer nur ein Teilgebiet kennt und nicht bis zum Abschluss durchgeht · Wer aus dem Konzern kommt und Zuarbeit gewohnt ist · Wer nur geprüft oder beraten und nie selbst gebucht hat · Wer ohne fertige Prozesse und klare Ansagen nicht arbeiten kann · Wer nicht mit dem Fachbereich reden mag |
| Trigger | Immer, gegen Ende der Aufnahme, nachdem FIN-02 bis FIN-06 beantwortet sind. |
| Uebersprungen wenn | Der Kunde hat bei einem früheren Job desselben Unternehmens bereits ein Anti-Profil hinterlegt und der Zuschnitt ist vergleichbar. Dann als Bestätigung zeigen. |
| „Weiss ich nicht“ | Ersatzfrage über die Vergangenheit: 'Wer hat auf dieser Stelle oder einer ähnlichen zuletzt nicht funktioniert, und warum?' Das beantwortet fast jeder, auch wenn ihm die abstrakte Frage nichts sagt. |
| Zielfeld | `jobs.intake_briefing (existiert; erreicht den Recruiter über generate-job-summary → job_summary → recruiter_jobs_view) plus jobs.screening_questions. AUSDRÜCKLICH NICHT jobs.briefing_notes — BEWIESEN nicht Teil von recruiter_jobs_view, die Antwort wäre für den Recruiter unsichtbar.` |
| Folgefragen | – Gab es das schon mal — jemanden, bei dem es nicht funktioniert hat?<br>– Was hat da konkret gefehlt? |
| Widerspruchsregel | Wenn 'Wer aus dem Konzern kommt' gewählt wird, die Muss-Kriterien aber Konzernstandards wie IFRS oder Konsolidierung verlangen: auf den Widerspruch hinweisen — Sie schließen genau die Gruppe aus, aus der die verlangten Kenntnisse üblicherweise kommen. |
| Starke Antwort | Jemand aus einem großen Konzern, der nur Debitoren gemacht hat. Bei uns muss die Person von der Buchung bis zum fertigen Abschluss alles selbst können, es gibt niemanden, der die Lücken füllt. |
| Schwache Antwort | Schwer zu sagen, das merkt man im Gespräch. |
| Wenn die Antwort fehlt | Der Recruiter hat nur ein Positivbild und keine Ausschlusslogik. Er schickt formal passende Profile, die im Fachgespräch aus immer demselben Grund durchfallen — ohne dass jemand den Grund je aufgeschrieben hat. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `FIN-15` · Sperrfirmen und Zielfirmen. In Finance ist die Sperrliste anders als in anderen Familien: Der eigene Steuerberater und der eigene Wirtschaftsprüfer sind fast immer tabu, 

*Damit wir niemanden ansprechen, den Sie nicht angesprochen haben wollen — das klären wir immer vorher, nicht hinterher:*

> **„Gibt es Firmen, bei denen wir auf keinen Fall ansprechen dürfen — Ihr Steuerberater, Ihr Wirtschaftsprüfer, ein wichtiger Kunde?“**

| | |
|---|---|
| Antworttyp | Freitext mit Firmen-Chips, plus Vorschlagsliste |
| Optionen | Unser Steuerberater · Unsere Prüfungsgesellschaft · Bestimmte Kunden oder Partner · Direkte Wettbewerber · Keine Einschränkung |
| Trigger | Immer, vor der Freigabe zur Ausschreibung. |
| Uebersprungen wenn | Nie überspringen. Auch ein ausdrückliches 'keine' ist eine dokumentierte Antwort und schützt beide Seiten. |
| „Weiss ich nicht“ | Zwei konkrete Kandidaten selbst benennen ('Ihr Steuerberater und Ihr Prüfer sind bei uns Standard-Sperre — soll ich die setzen?') und bestätigen lassen. Bei weiterhin unklarer Lage die konservative Variante setzen. |
| Zielfeld | `PROBLEM: jobs.nogo_companies und jobs.target_companies existieren in PROD NICHT (BEWIESEN, REST 42703), company_profiles.excluded_companies ebenfalls nicht (BEWIESEN, REST 42703). Einziges heute belastbares Ziel: jobs.screening_questions (JSONB, existiert, in recruiter_jobs_view, wird dem Recruiter gerendert, hat keinen Writer). Bis die Migration liegt, ist eine Sperrliste eine organisatorische und keine maschinell durchgesetzte Zusage — das muss dem Kunden gegenüber ehrlich formuliert werden.` |
| Folgefragen | – Und umgekehrt: bei welchen Firmen sitzen die Leute, die Sie meinen?<br>– Gilt das auch für Ihre Prüfungsgesellschaft?<br>– Gibt es eine Vereinbarung mit einem Kunden, die das regelt? |
| Widerspruchsregel | Wenn die Sperrliste die naheliegendsten Quellen abdeckt (Wettbewerber plus Kanzleien plus Kunden), muss der Recruiter das wissen, bevor er zusagt: Hinweis, welcher Teil des Marktes damit übrig bleibt, und die Frage, ob die Sperre für alle Rollen oder nur diese gilt. |
| Starke Antwort | Bei unserem Steuerberater, der Kanzlei Müller & Partner, bitte nicht — die machen unseren Abschluss. Sonst gerne überall, auch bei den direkten Wettbewerbern. |
| Schwache Antwort | Nein, sprecht ruhig alle an. |
| Wenn die Antwort fehlt | Ein Recruiter spricht beim Steuerberater des Kunden an. Das ist der Fall, der eine Kundenbeziehung in einem einzigen Telefonat beendet — und in Finance passiert er häufiger als in jeder anderen Rollenfamilie, weil die Kanzlei fachlich der naheliegendste Ort ist. |
| Zweck / Sensitivitaet | Sourcing · DSGVO-relevant |

#### `FIN-16` · Das Zeitfenster für Gespräche und den echten Startbedarf, beides gebunden an den Abschlusskalender. In Finance ist der Prozess selbst der häufigste Verlustgrund: Der Fach

> **„Wann können Sie Gespräche führen — in den ersten Tagen des Monats läuft bei Ihnen vermutlich der Abschluss?“**

| | |
|---|---|
| Antworttyp | Chips, Mehrfachauswahl, plus Freitext |
| Optionen | Jederzeit, wir richten uns danach · Nicht in der ersten Monatswoche · Nicht während des Jahresabschlusses · Nur früh morgens, abends oder freitags · Weiß ich noch nicht |
| Trigger | Immer, am Ende der Aufnahme, direkt vor der Freigabe. |
| Uebersprungen wenn | Nie überspringen. Bei sehr kleinen Firmen ohne festen Abschlussrhythmus kann die Frage verkürzt als reine Verfügbarkeitsfrage gestellt werden. |
| „Weiss ich nicht“ | Standardannahme setzen und offenlegen: 'Ich plane vorsichtshalber ohne die erste Monatswoche — sagen Sie Bescheid, wenn das zu eng ist.' Damit ist die Annahme dokumentiert und korrigierbar. |
| Zielfeld | `jobs.deadline (existiert, in recruiter_jobs_view) für den Startbedarf; das Gesprächsfenster als Klartextsatz nach jobs.screening_questions plus jobs.intake_briefing. Ausdrücklich NICHT nach briefing_notes.` |
| Folgefragen | – Ab wann brauchen Sie die Person tatsächlich — hängt der Start am Jahresabschluss oder an der Planungsrunde?<br>– Wenn wir Ihnen morgen jemanden schicken, wie lange dauert es bis zum ersten Gespräch?<br>– Wer muss außer Ihnen dabei sein, und ist der zur selben Zeit verfügbar? |
| Widerspruchsregel | Wenn Dringlichkeit auf 'sehr dringend' steht, das Gesprächsfenster aber die halbe verfügbare Zeit sperrt: den Widerspruch mit Zahlen benennen ('Sie brauchen jemanden in vier Wochen, können aber in zwei davon nicht sprechen') und die Wahl anbieten zwischen Vertretungsentscheider, Abendterminen oder realistischerer Zeitlinie. |
| Starke Antwort | In den ersten sieben Arbeitstagen des Monats geht bei mir nichts, da läuft der Abschluss. Danach bekomme ich innerhalb von 48 Stunden einen Termin frei. Von Januar bis März ist es generell eng. |
| Schwache Antwort | Wir sind schnell, das kriegen wir hin. |
| Wenn die Antwort fehlt | Kandidaten warten zwei Wochen auf einen Termin und sind dann weg. In Finance sind die guten Leute nicht suchend, sondern nur kurz offen — verpasste Fenster kosten den Kandidaten, nicht nur Zeit. |
| Zweck / Sensitivitaet | Prozess · normal |

**Beispieldialog**

```
SITUATION: Kunde ist ein familiengeführter Maschinenbauer, rund 400 Mitarbeiter, sucht laut Anzeige einen "Finanzbuchhalter (m/w/d)" für 60.000 bis 68.000 Euro. Aus der Anzeige übernommen: Standort Ulm, hybrid mit 2 Homeoffice-Tagen, "SAP-Kenntnisse", "abschlusssicher", "Bilanzbuchhalter oder vergleichbare Qualifikation".

— FIN-01 —
BERATER: Wo liegt der Schwerpunkt der Stelle — bei den Abschlüssen und der laufenden Buchhaltung, bei Auswertung und Planung, bei Steuern, oder bei Liquidität und Banken?
KUNDE: Also im Prinzip von allem etwas. Die Person soll breit aufgestellt sein, wir sind ja kein Konzern.
BERATER (Nachfrage, weil "von allem etwas" der häufigste Weg ist, sich zwei Stellen einzuhandeln): Verstehe ich. Dann anders gefragt: Wenn die Woche eng wird und nur die Hälfte der Zeit da ist — was macht die Person trotzdem, und was bleibt liegen?
KUNDE: Der Monatsabschluss bleibt nie liegen, der muss am achten stehen. Die Auswertungen für die Geschäftsführung schiebe ich zur Not.
BERATER: Dann ist es eine Abschluss-Stelle mit Auswertungsanteil, nicht umgekehrt. Ich merke das so an, weil es entscheidet, wen wir ansprechen.

— FIN-02 —
BERATER: Welchen Abschluss soll die neue Person eigenständig verantworten — also am Ende dafür geradestehen, nicht nur zuarbeiten?
KUNDE: Abschlusssicher soll sie halt sein.
BERATER (Nachfrage über den Ist-Zustand, weil das jeder beantworten kann): Wer macht den Jahresabschluss heute?
KUNDE: Den macht unser Steuerberater, wir liefern zu. Den Monatsabschluss machen wir selbst, das macht bisher der Kollege, der jetzt in Rente geht.
BERATER: Dann ist "eigenständig" der Monatsabschluss, und beim Jahresabschluss ist es qualifizierte Zuarbeit. Das ist wichtig — für den vollen Jahresabschluss inklusive Verantwortung liegen wir im Markt eher bei 72.000 aufwärts. So, wie Sie es beschreiben, sind Ihre 68.000 realistisch.
KUNDE: Gut zu wissen. Ja, so ist es.

— FIN-04 —
BERATER: Nach welchen Regeln wird bei Ihnen bilanziert — HGB, IFRS, oder beides parallel?
KUNDE: HGB. IFRS wäre natürlich super, falls jemand das mitbringt.
BERATER: Dann setze ich IFRS als "wäre schön", nicht als Anforderung. Der Unterschied ist groß: Als Muss verlieren wir hier im Umkreis einen erheblichen Teil der passenden Bilanzbuchhalter an einer Hürde, die Ihre Bücher gar nicht verlangen.
KUNDE: Einverstanden, das brauchen wir wirklich nicht.

— FIN-06 —
BERATER: In welchem System bucht die Person täglich — und wenn es SAP ist: welche Module?
KUNDE: SAP.
BERATER (Nachfrage, weil "SAP" allein keine Suche ermöglicht): Klassisches SAP oder schon S/4HANA — und arbeitet die Person in FI, oder auch in CO?
KUNDE: Das müsste ich nachfragen. Wir haben SAP seit 2011, umgestellt haben wir noch nicht.
BERATER: Dann gehe ich von SAP ECC aus, das sage ich auch so. Ich schreibe Ihnen die Modulfrage auf, die klären Sie bitte mit dem Fachbereich — FI und CO sind für die Suche zwei verschiedene Kandidatengruppen. Solange es offen ist, suche ich breiter und filtere im Gespräch.

— FIN-09 —
BERATER: Kurz zu den Abschlüssen — die kosten in der Ansprache am meisten Zeit, deshalb frage ich es genau: Muss der Bilanzbuchhalter zwingend vorliegen, oder zählt die Praxis?
KUNDE: In der Anzeige steht "oder vergleichbare Qualifikation", das machen wir immer so.
BERATER: Dann konkret: Wenn jemand seit acht Jahren Monatsabschlüsse fährt und den Schein nicht hat — sehen Sie sich den an?
KUNDE: Ja, klar. Ehrlich gesagt ist mir die Praxis lieber.
BERATER: Gut, dann geht der Bilanzbuchhalter zu den Kann-Kriterien. Das erweitert Ihre Trefferliste spürbar.

— FIN-13 —
BERATER: Sie haben zwei Homeoffice-Tage genannt — gilt das auch in der Abschlusswoche, oder erwarten Sie die Person dann durchgehend vor Ort?
KUNDE: Hm. Ehrlich gesagt haben wir das nie besprochen. Aber am Monatsanfang sitzen wir schon alle da.
BERATER: Das ist die Antwort, die ich brauche — und es ist der häufigste Grund, warum Finance-Kandidaten im dritten Gespräch abspringen. Ich formuliere es so: hybrid mit zwei Homeoffice-Tagen, in den ersten fünf Arbeitstagen des Monats Anwesenheit. Wenn wir das vorher sagen, kostet es fast nie einen Kandidaten. Wenn es im dritten Gespräch kommt, kostet es fast immer einen.
KUNDE: Machen Sie das so.

— FIN-15 —
BERATER: Damit wir niemanden ansprechen, den Sie nicht angesprochen haben wollen — gibt es Firmen, bei denen wir nicht suchen dürfen? Ihr Steuerberater zum Beispiel?
KUNDE: Nein, sprecht ruhig alle an.
BERATER (Nachfrage, weil "alle" in Finance fast nie stimmt): Auch die Kanzlei, die Ihren Jahresabschluss macht? Dort sitzen erfahrungsgemäß genau die Leute, die wir suchen — und es ist genau die Ansprache, die eine Beziehung beenden kann.
KUNDE: Ach so, nein. Die Kanzlei Brandt in Neu-Ulm bitte nicht. Und unseren Wettbewerber Hartmann auch nicht, mit denen haben wir eine Vereinbarung.
BERATER: Notiert, beide gesperrt. Und damit ich ehrlich bin: Diese Sperre führen wir derzeit organisatorisch, nicht technisch — sie steht im Auftrag und im Briefing des Recruiters, aber es gibt heute keinen automatischen Riegel im System.

— FIN-16 —
BERATER: Wann können Sie Gespräche führen — in den ersten Tagen des Monats läuft bei Ihnen ja der Abschluss.
KUNDE: Wir sind schnell, das kriegen wir hin.
BERATER (Nachfrage, weil "wir sind schnell" keine Terminzusage ist): Sagen wir, ich schicke Ihnen am dritten des Monats ein Profil — wann sitzt der Kandidat bei Ihnen?
KUNDE: Am dritten? Da ist Abschluss, da geht nichts. Realistisch ab dem zehnten.
BERATER: Dann planen wir so: Ansprache immer ab Monatsmitte, damit die Leute nicht eine Woche auf einen Termin warten. Denn genau in dieser Woche entscheiden sie sich um.
```


---

### Fuehrung & Executive

**Rollenfamilie:** Führung & Executive · **Cards:** 15

> **Kernthese:** Für Führungsmandate fehlen Matchunt nicht Fragen, sondern eine Ebene oberhalb von "Lead" und ein Feld für Vertraulichkeit. BEWIESEN: Der Matcher kennt acht Senioritätsstufen bis c-level (supabase/functions/calculate-match-v3-1/index.ts:1009) und vergleicht sie gegen job.experience_level (Zeile 1011). Beide Aufnahmepfade lassen den Kunden aber nur vier Stufen wählen, maximal "lead" (CreateJob.tsx:1267-1270, ProfileSections.tsx:128-131). Jedes Executive-Mandat wird deshalb zu tief erfasst — und ausgerechnet die passenden Kandidaten werden bestraft: Gap 2 (director) → Faktor 0.25, Gap ≥3 (vp/c-level) → 0.1 (Zeilen 753-757 und 1017-1024). Je richtiger der Kandidat, desto härter die Abwertung. BEWIESEN: Ein Vertraulichkeitsfeld existiert nirgends — jobs.is_confidential und jobs.confidentiality_level liefern REST 42703, repo-weiter grep findet kein is_confidential. Das ist die Sollbruchstelle, denn die häufigste Führungsvakanz ist eine noch nicht kommunizierte Ablösung. BEWIESEN (REST 200) ist dagegen die gute Nachricht: reports_to, success_profile, failure_profile, decision_makers, department_structure, bonus_structure, task_focus, negative_impact_if_unfilled, works_council und required_languages existieren in PRODUKTION bereits — und werden von keinem lebenden Pfad beschrieben. failure_profile, decision_makers, bonus_structure, negative_impact_if_unfilled, contract_sensitive_topics und screening_questions haben repo-weit NULL Schreiber; success_profile/reports_to/works_council werden nur aus intakeData befüllt (CreateJob.tsx:651-657), das aus extract-intake-briefing stammt — BEWIESEN HTTP 404. KORREKTUR zum Inventar (IB-13, KI-06): jobs.required_languages existiert in PROD (REST 200), ist ein harter Killer im Matcher mit CEFR-Stufenvergleich (calculate-match-v3-1:921-941) UND recruiter-sichtbar in recruiter_jobs_view — die Sprachantwort gehört typisiert dorthin, nicht in briefing_notes. Mein Fragenpfad zielt deshalb bewusst auf bereits vorhandene Spalten, damit er ohne Migration wirkt; nur Vertraulichkeit und reveal_trigger brauchen echte Schema-Arbeit. ABGELEITET und wichtig für die Erwartung: Selbst gut erfasster Führungskontext erreicht den Recruiter heute nicht — reports_to, success_profile, team_size, vacancy_reason und decision_makers sind nicht Teil der recruiter_jobs_view (20260725120000, decision_makers explizit Klasse C), und die einzige deployte Redaktions-Funktion format-job-for-recruiters (REST 400 = deployed) liest keines dieser Felder.


#### `EX-01` · Die echte Hierarchieebene, um jobs.experience_level oberhalb von 'lead' setzen zu können. Ohne diese Stufe deckelt das UI bei 'lead' und der Matcher rechnet genau die pas

> **„Wenn Sie mir Ihr Organigramm zeigen würden – auf welcher Ebene sitzt diese Position?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl), danach zwei Freitext-Folgefragen |
| Optionen | Teamleitung · Bereichs- oder Abteilungsleitung (Head) · Direktor:in · Geschäftsführung / VP · Vorstand / C-Level |
| Trigger | Immer als erste Frage der Führungsstrecke, sobald Titel, Gehaltsband oder Führungsverantwortung auf eine Leitungsrolle hindeuten. |
| Uebersprungen wenn | Nie überspringen – diese Frage trägt den gesamten Pfad. |
| „Weiss ich nicht“ | Über die Berichtslinie herleiten: 'An wen berichtet die Person?' bestimmt die Ebene zuverlässiger als jeder Titel. Titel sind zwischen Konzern und Mittelstand nicht vergleichbar, Berichtswege schon. |
| Zielfeld | `jobs.experience_level (PROD 200) – Wertebereich muss um head|director|vp|c-level erweitert werden, sonst bleibt die Antwort wirkungslos; zusätzlich jobs.reports_to (PROD 200, heute nur aus dem toten Parser befüllbar)` |
| Folgefragen | – An wen berichtet die Position direkt – bitte die Funktion, nicht den Namen.<br>– Ist das dieselbe Ebene wie bei Ihrem Vorgänger, oder hängen Sie die Rolle bewusst höher oder tiefer auf? |
| Widerspruchsregel | Ebene ≥ director UND salary_max < 120.000 € → Tension-Flag: 'Sie suchen auf Direktorenebene mit einem Budget, das im Markt eine Bereichsleitung bezahlt. Entweder die Ebene oder das Band muss sich bewegen.' |
| Starke Antwort | Bereichsleitung Finance, berichtet direkt an den CFO, eine Ebene unter der Geschäftsführung. |
| Schwache Antwort | Es ist eine Führungsposition. |
| Wenn die Antwort fehlt | experience_level fällt auf den Matcher-Default 'mid' zurück (calculate-match-v3-1:1011). Ein VP-Kandidat hat dann Gap 4 und wird mit 0.1 multipliziert – die Rolle bekommt strukturell nur zu junge Vorschläge. |
| Zweck / Sensitivitaet | Matching · normal |

#### `EX-02` · Führungsspanne in zwei Dimensionen: direkte Berichte und Gesamtorganisation. Entscheidend ist die Folgefrage, ob die Person selbst Führungskräfte führt – das ist der eige

> **„Wie viele Menschen führt die Person direkt?“**

| | |
|---|---|
| Antworttyp | Zahl, danach zwei Folgefragen (Zahl und Ja/Nein) |
| Trigger | Direkt nach EX-01, sobald die Ebene bekannt ist. |
| Uebersprungen wenn | Rolle ohne disziplinarische Führung (reine Stabs- oder Expertenrolle) – dann nur die fachliche Steuerung erfassen. |
| „Weiss ich nicht“ | Auf die direkten Berichte reduzieren – die Gesamtzahl kann später nachgereicht werden. Wichtiger ist die Ja/Nein-Antwort, ob Führungskräfte geführt werden. |
| Zielfeld | `jobs.team_size (PROD 200, direkte Berichte) + jobs.department_structure (PROD 200, Gesamtaufstellung als Text; heute nur von parse-job-url beschrieben, das in PROD 404 liefert)` |
| Folgefragen | – Und wie viele Mitarbeitende hängen insgesamt an dem Bereich?<br>– Sind unter den direkten Berichten selbst Führungskräfte? |
| Widerspruchsregel | Ebene aus EX-01 = VP oder C-Level, aber team_size ≤ 3 → Hinweis: 'Das ist faktisch eine Expertenrolle mit Führungstitel. Das gehört offen in die Ansprache, sonst springen Kandidaten im zweiten Gespräch ab.' |
| Starke Antwort | Sechs direkte Berichte, davon zwei Teamleiter, insgesamt 34 Mitarbeitende im Bereich. |
| Schwache Antwort | Ein größeres Team. |
| Wenn die Antwort fehlt | team_size bleibt null. Der Recruiter kann die Führungsspanne im Erstgespräch nicht benennen, obwohl sie für Führungskandidaten das erste Qualifizierungskriterium ist. |
| Zweck / Sensitivitaet | Matching · normal |

#### `EX-03` · Verantwortungsgröße als Vergleichsmaßstab. Führungskandidaten werden im Markt über Budget- und Ergebnisverantwortung eingeordnet, nicht über Titel. Gleichzeitig ist die Z

*Eine Frage zur Größenordnung, damit ich Kandidaten auf vergleichbarem Verantwortungsniveau anspreche.*

> **„Trägt die Position ein eigenes Budget oder eine Ergebnisverantwortung – und in welcher Größenordnung?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + optionaler Freitext für die konkrete Zahl |
| Optionen | Kein eigenes Budget · Kostenstelle bis 1 Mio. € · 1 bis 10 Mio. € · Über 10 Mio. € · Volle P&L-Verantwortung |
| Trigger | Bei Ebene ≥ Bereichsleitung aus EX-01. |
| „Weiss ich nicht“ | Auf die Entscheidungsbefugnis ausweichen: 'Bis zu welcher Summe kann die Person allein entscheiden?' Das ist für Kandidaten aussagekräftiger als die absolute Budgethöhe. |
| Zielfeld | `intake_payload.leadership.budget_scope – BEWIESEN nicht in PROD (REST 42703, Migration 20260619120000 nicht angewandt). Interimsziel ohne Migration: jobs.department_structure (PROD 200) als Klartext-Zusatz.` |
| Folgefragen | – Ist das ein Budget, das die Person verwaltet, oder eines, über das sie entscheidet? |
| Widerspruchsregel | Genannte Umsatz- oder Budgetzahl zusammen mit Branche und Region → ABGELEITET hoher De-Anonymisierungswert; gehört zwingend auf reveal_envelope.red_list und darf nie in Recruiter-Texte. Der Guardrail existiert nur im Prompt von intake-questions (index.ts:175), das in PROD 404 liefert – heute also ungeschützt. |
| Starke Antwort | Volle P&L für den Bereich, rund 40 Mio. € Umsatz, Investitionsentscheidungen bis 250.000 € eigenständig. |
| Schwache Antwort | Da hängt schon einiges dran. |
| Wenn die Antwort fehlt | Der Recruiter kann die Rolle im Markt nicht einordnen und spricht Kandidaten auf falschem Verantwortungsniveau an. |
| Zweck / Sensitivitaet | Matching · sensibel |

#### `EX-04` · Der strategische Auftrag: Soll aufgebaut, skaliert, saniert, transformiert oder stabil weitergeführt werden? Das ist die wichtigste Sourcing-Weiche der ganzen Familie, we

> **„Was soll in diesem Bereich in zwei Jahren anders sein als heute?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext zur Konkretisierung |
| Optionen | Neu aufbauen – gibt es so noch nicht · Wachstum skalieren · Sanieren, Kosten und Struktur in den Griff bekommen · Transformation und Modernisierung · Stabil weiterführen, kein Umbau gewünscht |
| Trigger | Immer, direkt nach der Erfassung von Ebene und Spanne. |
| „Weiss ich nicht“ | Über die Gegenprobe erschließen: 'Wenn die Person nichts verändert und den Bereich genau so weiterführt wie heute – wären Sie zufrieden?' Ein Nein legt den Veränderungsauftrag offen. |
| Zielfeld | `jobs.task_focus (PROD 200) für die gewählte Stoßrichtung + jobs.success_profile (PROD 200) für die Konkretisierung` |
| Folgefragen | – Was muss dafür als Erstes angefasst werden?<br>– Was soll dabei ausdrücklich unangetastet bleiben? |
| Widerspruchsregel | Antwort = 'Stabil weiterführen', aber EX-15 nennt massive Probleme, oder umgekehrt Antwort = 'Sanieren' bei gleichzeitig sehr kurzer Kündigungsfrist-Toleranz → Widerspruch ansprechen: Umbauaufträge brauchen erfahrene Kandidaten mit langen Fristen. |
| Starke Antwort | Der Bereich ist über Zukäufe gewachsen und läuft heute auf drei getrennten Systemen. In zwei Jahren soll das eine Organisation mit einem Prozess sein – ohne dass wir dabei Leistungsträger verlieren. |
| Schwache Antwort | Wir wollen uns weiterentwickeln. |
| Wenn die Antwort fehlt | Die Ansprache bleibt generisch. Ein Sanierer und ein Aufbauer bewerben sich auf denselben Text, und die Fehlbesetzungsquote steigt genau dort, wo sie am teuersten ist. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `EX-05` · Das Erfolgsbild nach zwölf Monaten mit einem Frühindikator nach sechs. Für Führungskräfte ist die 30-Tage-Frage wertlos, weil sie in der Einarbeitung sind – der Zwölfmona

> **„Woran würden Sie in zwölf Monaten festmachen, dass die Besetzung richtig war?“**

| | |
|---|---|
| Antworttyp | Freitext mit Chips als Starthilfe |
| Optionen | Eine konkrete Kennzahl ist erreicht · Die Organisation steht und liefert ohne mich · Ein bestimmtes Vorhaben ist umgesetzt · Die Fluktuation im Bereich ist gestoppt · Ich bin operativ entlastet |
| Trigger | Immer, nach EX-04. |
| „Weiss ich nicht“ | Über die Entlastungsfrage einsteigen: 'Was machen Sie heute selbst, das Sie in einem Jahr nicht mehr machen wollen?' Das liefert bei Führungsmandaten fast immer das ehrlichste Erfolgsbild. |
| Zielfeld | `jobs.success_profile (PROD 200). BEWIESEN: einziger lebender Schreiber ist CreateJob.tsx:651 aus intakeData – intakeData stammt aus extract-intake-briefing, das in PROD HTTP 404 liefert, die Spalte ist heute faktisch immer null.` |
| Folgefragen | – Und was müsste nach sechs Monaten sichtbar sein, damit Sie ruhig schlafen? |
| Widerspruchsregel | Erfolgsbild verlangt messbaren Umbau, aber EX-14 nennt mehr als drei Entscheider und EX-07 nennt Widerstand aus anderen Bereichen → Machbarkeit offen ansprechen: Der Auftrag ist ambitionierter als das Mandat, das die Person bekommt. |
| Starke Antwort | Der Monatsabschluss steht am fünften Werktag statt am zwölften, und ich muss nicht mehr selbst in den Zahlen sitzen. Nach sechs Monaten will ich sehen, dass die zwei Teamleiter eigenständig arbeiten. |
| Schwache Antwort | Dass es einfach läuft. |
| Wenn die Antwort fehlt | Der Recruiter kann im Gespräch nicht sagen, woran der Kandidat gemessen wird. Führungskandidaten steigen genau an dieser Stelle aus, weil sie die Rolle nicht bewerten können. |
| Zweck / Sensitivitaet | Matching · normal |

#### `EX-06` · Die Stakeholder-Landkarte außerhalb der eigenen Linie. Bei Führungsrollen entscheidet nicht die Fachkompetenz über den Erfolg, sondern die Frage, mit wem die Person Einig

> **„Mit wem außerhalb des eigenen Bereichs muss die Person zusammenkommen, damit sie etwas bewegt?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext |
| Optionen | Geschäftsführung · Vertrieb · IT · Produktion / Operations · Konzernmutter oder Gesellschafter · Betriebsrat |
| Trigger | Bei Ebene ≥ Bereichsleitung, immer nach EX-04. |
| Uebersprungen wenn | Reine Teamleitung ohne bereichsübergreifenden Auftrag. |
| „Weiss ich nicht“ | Über den Konfliktfall erschließen: 'Wenn die Person eine Entscheidung durchsetzen will und jemand blockiert – wer wäre das am ehesten?' |
| Zielfeld | `jobs.department_structure (PROD 200). WICHTIG: NICHT nach jobs.decision_makers schreiben – diese Spalte ist in recruiter_jobs_view bewusst Klasse C und wird Recruitern nie ausgeliefert (Migration 20260725120000). Stakeholder-Wissen, das der Recruiter für den Pitch braucht, wäre dort tot.` |
| Folgefragen | – Wer davon ist erfahrungsgemäß am schwersten zu gewinnen? |
| Widerspruchsregel | Mehr als vier genannte Stakeholder bei gleichzeitig 'stabil weiterführen' aus EX-04 → Rückfrage, ob die Rolle tatsächlich so viel Abstimmung braucht oder ob die Organisation ungeklärt ist. |
| Starke Antwort | Vor allem mit dem Vertriebsleiter – der sitzt seit zwölf Jahren im Haus und hat eigene Vorstellungen von der Preisgestaltung. Ohne ihn geht nichts. |
| Schwache Antwort | Eigentlich mit allen Bereichen. |
| Wenn die Antwort fehlt | Der Recruiter kann nicht prüfen, ob der Kandidat in vergleichbaren Konstellationen erfolgreich war. Bei Führungsmandaten ist das der häufigste Grund für ein Scheitern im ersten Jahr. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `EX-07` · Die politische Realität hinter der Vakanz und die Kosten des Nichtstuns. Wenn ein Thema wichtig ist und trotzdem ungelöst blieb, gibt es dafür einen Grund – und dieser Gr

*Das frage ich bei jedem Führungsmandat. Die Antwort entscheidet, welchen Typ Mensch ich Ihnen vorstelle.*

> **„Wenn das Thema so wichtig ist – warum ist es bisher nicht gelöst worden?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Die Position war schlicht unbesetzt · Der Vorgänger kam damit nicht durch · Es fehlte an Mandat und Rückendeckung · Widerstand aus anderen Bereichen · Ressourcen oder Budget fehlten |
| Trigger | Bei Veränderungsauftrag aus EX-04 (Aufbau, Sanierung oder Transformation). |
| Uebersprungen wenn | Neu geschaffene Position ohne Vorgeschichte. |
| „Weiss ich nicht“ | Nicht drängen, sondern auf den Vorgänger lenken: 'Was hätte Ihr Vorgänger gebraucht, um damit durchzukommen?' Das öffnet dasselbe Thema ohne Schuldzuweisung. |
| Zielfeld | `jobs.negative_impact_if_unfilled (PROD 200) für die Folgefrage nach den Kosten. BEWIESEN: Diese Spalte hat repo-weit NULL Schreiber und NULL Leser – sie existiert seit Migration 20260123171202 ungenutzt. Der Hauptbefund gehört nach intake_payload.leadership.political_context (fehlt in PROD, 42703).` |
| Folgefragen | – Was kostet es Sie, wenn die Rolle weitere sechs Monate offen bleibt?<br>– Was wird diesmal anders sein als beim letzten Versuch? |
| Widerspruchsregel | Antwort = 'fehlendes Mandat' oder 'Widerstand' UND EX-05 verlangt messbaren Umbau in zwölf Monaten → offen ansprechen: 'Dann ist die Rolle heute nicht besetzbar, sondern zuerst zu klären. Sonst verbrennen wir einen guten Kandidaten.' |
| Starke Antwort | Mein Vorgänger hat es zweimal versucht und ist beide Male an der Geschäftsführung gescheitert, weil das Budget nicht freigegeben wurde. Diesmal ist es bewilligt, das ist der Unterschied. |
| Schwache Antwort | Es hat sich einfach nie ergeben. |
| Wenn die Antwort fehlt | Wir schicken Kandidaten in eine Rolle, deren strukturelles Hindernis niemand benannt hat. Das erzeugt Frühfluktuation und beschädigt die Reputation der Plattform beim Kandidaten. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `EX-08` · Ob intern jemand auf die Position hofft. Ein interner Mitbewerber verändert alles: Geschwindigkeit, Ehrlichkeit des Prozesses und das Risiko, dass externe Kandidaten nur 

*Kurz und vertraulich, damit ich niemanden gegen einen internen Favoriten laufen lasse.*

> **„Gibt es intern jemanden, der sich Hoffnungen auf diese Position macht?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + optionaler Freitext |
| Optionen | Nein, niemand · Ja, aber die Person kommt nicht in Frage · Ja, sie bewirbt sich parallel · Das ist noch offen |
| Trigger | Immer bei Führungsmandaten, direkt vor der Diskretionsfrage EX-09. |
| Uebersprungen wenn | Neu geschaffene Position in einem neu aufgebauten Bereich. |
| „Weiss ich nicht“ | Umformulieren auf die Wahrnehmung im Haus: 'Wenn morgen bekannt wird, dass Sie extern suchen – wer wäre enttäuscht?' |
| Zielfeld | `intake_payload.leadership.internal_candidate – BEWIESEN nicht in PROD (42703). Interim: jobs.briefing_notes (PROD 200), das in recruiter_jobs_view Klasse C ist und damit korrekterweise nicht an Recruiter geht.` |
| Folgefragen | – Wie geht die Person damit um, wenn sie es nicht wird? |
| Widerspruchsregel | Antwort = 'bewirbt sich parallel' UND hiring_urgency = hot → Hinweis: Interne Prozesse verzögern die Entscheidung fast immer; die Dringlichkeitsangabe ist dann nicht realistisch. |
| Starke Antwort | Ja, mein stellvertretender Leiter. Er bewirbt sich offiziell mit, ist aber fachlich noch nicht so weit. Er weiß, dass wir extern suchen. |
| Schwache Antwort | Das spielt keine Rolle. |
| Wenn die Antwort fehlt | Externe Kandidaten laufen ohne Wissen gegen einen internen Favoriten. Das ist der schnellste Weg, gute Kandidaten dauerhaft für die Plattform zu verlieren. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `EX-09` · Ob die Position besetzt ist und ob der Stelleninhaber davon weiß. Das ist die Weiche, die über die gesamte Suchmechanik entscheidet: Reveal-Zeitpunkt, Detailtiefe des ano

*Eine heikle, aber wichtige Frage – davon hängt ab, wie offen wir suchen dürfen.*

> **„Ist die Position aktuell besetzt?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl), danach zwei Pflicht-Folgefragen |
| Optionen | Vakant, die Person ist bereits weg · Besetzt – die Person weiß Bescheid · Besetzt – die Person weiß es noch nicht · Neu geschaffen |
| Trigger | Immer bei Führungsmandaten, bevor irgendein Text für Recruiter erzeugt wird. |
| Uebersprungen wenn | Nie überspringen. |
| „Weiss ich nicht“ | Kann es faktisch nicht geben – wer ein Mandat vergibt, weiß das. Bei Ausweichen: die Konsequenz beider Fälle konkret gegenüberstellen und die Frage einmal wiederholen. Bis zur Klärung kein Recruiter-Expose erzeugen. |
| Zielfeld | `KEINE SPALTE VORHANDEN. BEWIESEN: jobs.is_confidential und jobs.confidentiality_level liefern beide REST 42703; repo-weiter grep nach is_confidential/confidential/vertraulich findet nur AGB-, NDA- und Marketingtexte, kein Datenfeld. Muss neu angelegt werden – ohne dieses Feld ist die Zusage technisch nicht durchsetzbar.` |
| Folgefragen | – Weiß die Person bereits, dass Sie sich verändern wollen?<br>– Wer bei Ihnen im Haus darf von der Suche wissen? |
| Widerspruchsregel | Antwort = 'die Person weiß es noch nicht' UND reveal_trigger = opt_in → harter Widerspruch. Reveal muss auf 'offer' gesetzt und der anonyme Descriptor auf Branche plus grobe Region reduziert werden; Bereichsgröße und Standort gehören dann auf die red_list. |
| Starke Antwort | Besetzt, und der Kollege weiß es nicht. Außer mir und dem CFO weiß niemand von der Suche, HR ausdrücklich nicht. |
| Schwache Antwort | Das ist gerade in Klärung. |
| Wenn die Antwort fehlt | ABGELEITET: Ohne dieses Feld behandelt die Plattform eine vertrauliche Ablösung wie eine normale Vakanz. Titel plus Region plus Branche reichen im Mittelstand für die Identifikation – und BEWIESEN steht im Migrationskommentar 20260725120000, dass in 4 von 20 Bestandsjobs sogar die aufbereitete Recruiter-Fassung noch Ortsdetails wie 'Rhein-Main' oder 'Taunus' enthält. |
| Zweck / Sensitivitaet | Prozess · DSGVO-relevant |

#### `EX-10` · Der Reveal-Zeitpunkt für genau dieses Mandat, abgeleitet aus der Diskretionsantwort. Ersetzt die zwei widersprüchlichen Fragen PS-17 und IB-34 durch eine einzige verbindl

> **„Ab wann darf ein Kandidat erfahren, um welches Haus es geht?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl), vorbelegt aus EX-09 |
| Optionen | Sobald er ernsthaftes Interesse zeigt · Nach dem ersten Gespräch · Erst wenn wir über ein Angebot reden |
| Trigger | Direkt nach EX-09; bei 'die Person weiß es noch nicht' wird 'Erst beim Angebot' vorbelegt und muss aktiv geändert werden. |
| „Weiss ich nicht“ | Aus EX-09 ableiten und zur Bestätigung vorlegen: 'Da der Stelleninhaber es noch nicht weiß, schlage ich vor, Ihren Namen erst beim Angebot zu nennen. Einverstanden?' |
| Zielfeld | `jobs.reveal_trigger – BEWIESEN nicht in PROD (REST 42703, Migration 20260619120000_intake_hybrid_foundation.sql nicht angewandt). Bis dahin ist die Antwort nicht persistierbar, während jobs.company_name im Klartext gespeichert wird.` |
| Folgefragen | – Und was dürfen wir vorher über Sie sagen – Branche, Größe, Region? |
| Widerspruchsregel | Reveal 'beim Interesse' UND EX-09 = 'Person weiß es noch nicht' → blockieren, nicht nur warnen. |
| Starke Antwort | Erst beim Angebot. Vorher nur: mittelständischer Maschinenbauer, Region Mitte. Keine Umsatzzahl, keine Standortangabe. |
| Schwache Antwort | Machen Sie das, wie Sie es für richtig halten. |
| Wenn die Antwort fehlt | Default greift auf 'after_first_interview' (Spalten-Default der nicht angewandten Migration) – für ein vertrauliches Mandat zu früh. |
| Zweck / Sensitivitaet | Prozess · sensibel |

#### `EX-11` · Die tatsächliche Paketstruktur. Bei Führungsrollen sagt das Fixgehalt allein wenig – 180.000 € fix mit 40 Prozent Ziel-Bonus ist ein anderes Angebot als 220.000 € flach. 

> **„Wie setzt sich das Paket zusammen – fix, variabel und alles Weitere?“**

| | |
|---|---|
| Antworttyp | Zwei Zahlenfelder (fix von/bis) + Freitext für die variable Struktur |
| Optionen | Nur Fixgehalt · Fix plus Zielbonus · Fix, Bonus und Dienstwagen · Zusätzlich langfristige Vergütung oder Beteiligung |
| Trigger | Immer bei Ebene ≥ Bereichsleitung; ersetzt für diese Familie die reine Min/Max-Erfassung. |
| „Weiss ich nicht“ | Über den Vergleich im Haus erschließen: 'Was verdienen die anderen Bereichsleiter auf dieser Ebene?' Und die Obergrenze als Szenario stellen, nicht als Zahl abfragen. |
| Zielfeld | `jobs.salary_min / salary_max (PROD 200, Fixanteil) + jobs.bonus_structure (PROD 200) für die variable Struktur. BEWIESEN: bonus_structure wird von extract-intake-briefing erzeugt (index.ts:119), fehlt aber im Insert-Block von CreateJob.tsx:619-668 – die Spalte hat damit keinen lebenden Schreiber.` |
| Folgefragen | – Und wo ist die echte Grenze, wenn der Richtige vor Ihnen sitzt?<br>– Ist der Bonus garantiert oder rein leistungsabhängig? |
| Widerspruchsregel | Ebene ≥ director aus EX-01 UND salary_max unter dem für die Ebene üblichen Band → Tension-Flag mit konkretem Vorschlag: entweder variable Anteile erhöhen oder die Ebene realistisch tiefer aufhängen. |
| Starke Antwort | 180.000 fix, 30 Prozent Zielbonus, Dienstwagen. Bei einem wirklich passenden Kandidaten gehe ich beim Fix auf 195.000, das ist dann aber das Ende. |
| Schwache Antwort | Marktüblich, das finden wir schon. |
| Wenn die Antwort fehlt | Der Recruiter verhandelt ohne Spielraumkenntnis und verliert Kandidaten in der Schlussphase an Wettbewerber, die schneller nachlegen. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `EX-12` · Sprachanforderung mit Niveau, sauber getrennt in Mindestanforderung und Ausschlusskriterium. Höchste Hebelwirkung aller Fragen, weil das Zielfeld als einziges bereits typ

> **„Welches Deutsch- und Englischniveau muss die Person mitbringen – und wo ist das eine harte Grenze?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) mit Niveau-Angabe, dazu je Sprache die Einstufung Wunsch / Mindestanforderung / Ausschluss |
| Optionen | Deutsch verhandlungssicher (C1) · Deutsch gut (B2) reicht · Englisch verhandlungssicher · Deutsch und Englisch verhandlungssicher · Nur Englisch, Bereichssprache ist Englisch |
| Trigger | Immer. Bei Führungsrollen im DACH-Mittelstand ist Deutsch häufiger der echte Ausschlussgrund als jede Fachanforderung. |
| „Weiss ich nicht“ | Über die Arbeitssituation erschließen: 'In welcher Sprache finden die Sitzungen statt, in denen die Person überzeugen muss?' Daraus lässt sich das Niveau sauber ableiten. |
| Zielfeld | `jobs.required_languages (PROD 200, Format [{code, minLevel}]). KORREKTUR zum Inventar (IB-13 und KI-06 behaupten, es gebe keine Sprachspalte): Die Spalte existiert, der Matcher killt hart darauf mit CEFR-Stufenvergleich (calculate-match-v3-1:921-941) und sie ist in recruiter_jobs_view Klasse A, also immer recruiter-sichtbar. Einziger Schreiber ist JobIntakeStudio.tsx:377 im nicht ausgelieferten Pfad.` |
| Folgefragen | – Ist das eine Grenze, oder würden Sie bei einem exzellenten Kandidaten davon abweichen? |
| Widerspruchsregel | Deutsch C1 als Ausschluss UND Zielfirmen aus dem internationalen Umfeld → Hinweis auf die Verengung des erreichbaren Marktes mit dem Vorschlag, B2 plus Lernbereitschaft zu prüfen. |
| Starke Antwort | Deutsch muss C1 sein, das ist eine harte Grenze – die Person führt Betriebsratsgespräche. Englisch B2 reicht, das ist ein Wunsch. |
| Schwache Antwort | Deutsch und Englisch, wie üblich. |
| Wenn die Antwort fehlt | required_languages bleibt null, der Sprach-Kill im Matcher greift nicht (die Prüfung läuft nur bei gesetztem Feld) – Kandidaten ohne ausreichendes Deutsch laufen bis ins Kundengespräch. |
| Zweck / Sensitivitaet | Matching · normal |

#### `EX-13` · Tabu-Firmen und Interessenkonflikte. Bei Führungsmandaten reicht das über Kunden und Partner hinaus bis zu Aufsichtsratsverflechtungen und Gesellschafterbeziehungen – ein

*Damit ich niemanden ansprechen lasse, der Ihnen an anderer Stelle wehtut.*

> **„Gibt es Häuser, bei denen wir auf keinen Fall anklopfen dürfen?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext-Liste für konkrete Firmennamen |
| Optionen | Nein, keine Einschränkung · Unsere Kunden und Partner · Bestimmte Firmen, die nenne ich Ihnen · Unternehmen mit Aufsichtsrats- oder Gesellschafterverflechtung |
| Trigger | Immer bei Führungsmandaten, vor der Freigabe an Recruiter. |
| „Weiss ich nicht“ | Konkret machen statt allgemein fragen: 'Wer sind Ihre drei größten Kunden?' und 'Wo sitzen Ihre Gesellschafter noch im Beirat?' Das liefert die Liste, ohne dass der Kunde sie selbst zusammenstellen muss. |
| Zielfeld | `jobs.nogo_companies – BEWIESEN nicht in PROD (REST 42703). Auch die Vorbefüllungsquelle company_profiles.excluded_companies fehlt in PROD (42703) und hat kein UI. ABGELEITET: Eine No-Poach-Zusage ist heute nirgends maschinell durchsetzbar.` |
| Folgefragen | – Und umgekehrt: Aus welchen Häusern würde Sie ein Kandidat sofort überzeugen? |
| Widerspruchsregel | Sehr lange Tabu-Liste bei gleichzeitig enger Nische → Machbarkeit offen ansprechen: Der erreichbare Markt kann kleiner sein als die Anzahl benötigter Kandidaten. |
| Starke Antwort | Unsere drei größten Kunden sind tabu, die Namen schicke ich Ihnen. Und bei der Firma, in der unser Aufsichtsratsvorsitzender sitzt, bitte gar nicht erst anfangen. |
| Schwache Antwort | Da fällt mir spontan nichts ein. |
| Wenn die Antwort fehlt | Recruiter sprechen Kandidaten bei Kunden des Auftraggebers an. Der Schaden trifft die Geschäftsbeziehung des Kunden und fällt auf die Plattform zurück. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `EX-14` · Wer real entscheidet und welche Freigaben es braucht. Ersetzt die Frage nach der Anzahl durch die Frage nach den Personen und Gremien, weil bei Führungsmandaten Aufsichts

> **„Wer sitzt am Ende mit am Tisch, wenn über die Einstellung entschieden wird?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext für Funktionen, danach zwei Ja/Nein-Folgefragen |
| Optionen | Nur ich · Ich und HR · Geschäftsführung · Gesellschafter oder Beirat · Aufsichtsrat · Konzernmutter |
| Trigger | Immer bei Führungsmandaten; ersetzt CJ-27 und IB-29. |
| „Weiss ich nicht“ | Über den Vertrag aufrollen: 'Wer unterschreibt am Ende den Arbeitsvertrag?' Das legt die formale Entscheidungskette zuverlässig offen. |
| Zielfeld | `jobs.decision_makers (text[], PROD 200, repo-weit kein Schreiber; in recruiter_jobs_view bewusst Klasse C und damit korrekt recruiter-unsichtbar) + jobs.works_council (PROD 200) aus der zweiten Folgefrage` |
| Folgefragen | – Braucht es eine Freigabe von Gesellschaftern, Aufsichtsrat oder Konzernmutter?<br>– Muss der Betriebsrat auf dieser Ebene mitreden? |
| Widerspruchsregel | Mehr als drei Entscheider oder Gremienfreigabe UND hiring_urgency = hot → Widerspruch benennen und eine realistische Zeitschiene vereinbaren, statt die Dringlichkeit ungeprüft an Recruiter weiterzugeben. |
| Starke Antwort | Fachlich entscheide ich mit dem CFO. Formal muss der Beirat zustimmen, der tagt aber nur quartalsweise – das nächste Mal Mitte März. |
| Schwache Antwort | Am Ende entscheide ich. |
| Wenn die Antwort fehlt | Der Prozess wird zeitlich falsch geplant. Führungskandidaten mit Parallelprozessen springen ab, wenn zwischen Zusage und Vertrag Wochen vergehen. |
| Zweck / Sensitivitaet | Prozess · normal |

#### `EX-15` · Das Anti-Profil über den Ausstiegsfall. Die Frage nach dem Scheitern nach einem Jahr liefert bei Führungsmandaten verlässlicher als jede Anforderungsliste, welcher Kandid

*Letzte Frage, und die ehrlichste.*

> **„Angenommen, wir besetzen die Rolle und die Person ist nach einem Jahr wieder weg – was wäre dann passiert?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Kam mit den Stakeholdern nicht klar · Hat zu wenig bewegt · Hat zu viel zu schnell verändert · Zu wenig Rückendeckung von oben bekommen · Hatte eine falsche Erwartung an die Rolle |
| Trigger | Zum Abschluss der Führungsstrecke, wenn bereits Vertrauen aufgebaut ist. |
| „Weiss ich nicht“ | Über die Vergangenheit einsteigen: 'Wer hat auf dieser Ebene bei Ihnen schon einmal nicht funktioniert – und woran lag es?' Das ist konkreter als die hypothetische Frage. |
| Zielfeld | `jobs.failure_profile (PROD 200). BEWIESEN: Die Spalte existiert und wird von extract-intake-briefing erzeugt (index.ts:104), fehlt aber im Insert-Block CreateJob.tsx:619-668 – sie hat repo-weit keinen Schreiber und ist immer null.` |
| Folgefragen | – Ist genau das bei Ihrem Vorgänger passiert? |
| Widerspruchsregel | Genanntes Scheitermuster widerspricht dem Suchbild aus EX-04 (etwa 'zu viel zu schnell verändert' bei gleichzeitigem Transformationsauftrag) → Zielkonflikt offen ansprechen, bevor gesourct wird. |
| Starke Antwort | Wenn er aus dem Konzern kommt und hier auf Zuruf und ohne Stab arbeiten muss. Genau daran ist der Letzte gescheitert – nach acht Monaten. |
| Schwache Antwort | Das kann ich mir eigentlich nicht vorstellen. |
| Wenn die Antwort fehlt | Das Anti-Profil fehlt vollständig. Recruiter schlagen fachlich starke Kandidaten vor, die kulturell chancenlos sind – die teuerste Form der Fehlbesetzung. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

**Beispieldialog**

```
Mandat: Bereichsleitung Finance, mittelständischer Maschinenbauer, Region Rhein-Main.

BERATER: Wenn Sie mir Ihr Organigramm zeigen würden – auf welcher Ebene sitzt diese Position?

KUNDE: Bereichsleitung. Berichtet direkt an den CFO.

BERATER: Danke, dann trage ich sie als Bereichsleitung ein und nicht als Teamleitung. Das klingt nach einer Formalie, ist aber keine: Wenn die Ebene zu niedrig steht, bekommen Sie systematisch zu junge Profile vorgeschlagen. – Ist die Position aktuell besetzt?

KUNDE: Das ist gerade in Klärung.

BERATER: Ich frage nicht aus Neugier, sondern weil es zwei Fälle gibt, die zu zwei völlig verschiedenen Suchen führen. Ist die Stelle vakant, können wir offen über Bereich, Größe und Region sprechen – das bringt uns deutlich mehr Rückläufer. Soll dagegen jemand ersetzt werden, der es noch nicht weiß, dürfen wir das Umfeld gar nicht so genau beschreiben. Bei Ihrer Größe im Rhein-Main-Gebiet reichen Branche und Bereichsgröße, damit ein Marktkenner Ihr Haus errät. Welcher der beiden Fälle ist es?

KUNDE: Der zweite. Der Kollege weiß es nicht. Das darf auf keinen Fall nach außen.

BERATER: Verstanden, dann führen wir das Mandat vertraulich. Konkret heißt das dreierlei. Erstens fällt Ihr Name erst, wenn wir über ein Angebot sprechen – nicht schon, wenn ein Kandidat Interesse zeigt. Zweitens nennen wir im anonymen Profil weder die Bereichsgröße noch den Standort, sondern nur Branche und Region Mitte. Und drittens: Wer bei Ihnen im Haus darf von der Suche wissen?

KUNDE: Nur ich und der CFO. HR ausdrücklich nicht.

BERATER: Gut, dann läuft die Terminabstimmung ausschließlich über Sie beide, und ich schicke nichts an eine allgemeine Bewerbungsadresse. – Eine Frage noch dazu, weil sie sonst später teuer wird: Gibt es intern jemanden, der sich Hoffnungen auf die Position macht?

KUNDE: Mein Stellvertreter. Der ist fachlich noch nicht so weit.

BERATER: Weiß er, dass Sie extern suchen?

KUNDE: Nein, siehe oben.

BERATER: Dann halte ich das fest, und wir sollten es im Blick behalten. Wenn er im Prozess doch noch antritt, muss ich das den externen Kandidaten sagen können – Führungskandidaten auf dieser Ebene verzeihen es nicht, wenn sie merken, dass sie als Vergleichsmaßstab gedient haben. Sie kommen dann kein zweites Mal.

KUNDE: Er tritt nicht an. Das ist entschieden.

BERATER: Danke, das genügt mir. Letzte Frage, und die ehrlichste: Angenommen, wir besetzen die Rolle und die Person ist nach einem Jahr wieder weg – was wäre dann passiert?

KUNDE: Wenn sie aus dem Konzern kommt und hier merkt, dass es keinen Stab gibt und alles auf Zuruf läuft. Genau daran ist der Vorgänger gescheitert, nach acht Monaten.

BERATER: Das ist die wertvollste Information des Gesprächs. Ich suche dann bewusst nicht im Konzernumfeld, sondern bei gewachsenen Mittelständlern vergleichbarer Größe – und ich spreche die fehlende Stabsstruktur im Erstgespräch offen an, statt sie zu verstecken.
```


---

### Contracting & Interim

**Rollenfamilie:** Contracting & Interim · **Cards:** 15

> **Kernthese:** Contracting ist heute kein eigener Pfad, sondern eine Festanstellung mit abgeschalteter Vergütung: BEWIESEN setzt JobIntakeStudio.tsx:342-343 salary_min/max bei employment_type='freelance' hart auf null, der Tagessatz landet ausschliesslich in intake_payload (Zeile 382), und REST bestaetigt, dass diese Spalte in PROD nicht existiert (42703) — ebensowenig wie irgendeine Alternative (day_rate_min/max, rate_period, duration_months, utilization_days_per_week, start_date, budget_total, deliverables: alle 42703). Die Folge ist eine Kette: der Kunde tippt einen Tagessatz, das UI zeigt ihn nicht einmal an (Zeile 195: 'noch ergaenzen'), der Einreichen-Gate laesst den Job trotzdem durch (ClientJobDetail.tsx:302 prueft Vergütung bei Freelance bewusst NICHT), der Recruiter sieht kein Honorar (JobDetail.tsx:267-271 und RecruiterJobs.tsx:93 geben ohne salary null zurueck) und der Matcher sieht kein Geld (calculate-match-v3-1:981 rechnet mit job.salary_max || 0; employment_type kommt in keinem Matcher vor). Der Fragenpfad muss deshalb zwei Dinge zugleich leisten: eine eigene Geldlogik (Satz oder Gesamtbudget, all-in oder plus Reise) und eine Abgrenzungsfrage zur Weisungsbindung — denn Matchunt schliesst in den eigenen AGB (AGB.tsx:57, §3 Abs. 2) Arbeitnehmerueberlassung aus, und ausser dieser einen Zeile enthaelt das gesamte Repository BEWIESEN kein einziges Vorkommen von AÜG, Scheinselbstaendigkeit oder Werkvertrag. Zusatzbefund: onsite_days traegt appliesTo:'full-time' (IntakeBriefing.tsx:189, Filter Zeile 290) — ein Contracting-Einsatz wird heute nirgends gefragt, an wie vielen Tagen die Person vor Ort sein muss.


#### `C-01` · Das Auftragsergebnis (Deliverable). Bei Contracting ersetzt es das Stellenprofil: Der Recruiter sucht nicht nach einem Titel, sondern nach jemandem, der genau dieses Erge

> **„Wenn der Einsatz am letzten Tag erfolgreich war — was liegt dann fertig auf dem Tisch?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Pflicht-Freitext zur Konkretisierung |
| Optionen | Ein System oder Modul ist live · Ein Projekt ist abgeschlossen und uebergeben · Eine Luecke ist ueberbrueckt (Vakanz, Ausfall, Elternzeit) · Das Team laeuft wieder stabil · Ein Konzept oder Gutachten liegt vor · Der laufende Betrieb ist abgesichert |
| Trigger | Erste Frage, sobald der Kunde 'Contracting / Interim' waehlt (NeueStelleBar.tsx:71). Immer, nicht ueberspringbar. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | Nicht drängen, sondern von hinten aufrollen: 'Was ist passiert, dass Sie jemanden von aussen holen?' Aus der Antwort formulieren wir das Ergebnis als Vorschlag und lassen ihn nur bestaetigen. |
| Zielfeld | `jobs.deliverables (NEU, text — BEWIESEN nicht vorhanden, REST 42703) + jobs.description (vorhanden). Heute gibt es dafuer KEIN Feld: der Studio-Pfad speichert nur built.description.` |
| Folgefragen | – Woran wuerden Sie schon nach 30 Tagen merken, dass es NICHT laeuft?<br>– Gibt es ein Datum, an dem das fertig sein muss — Audit, Go-Live, Jahresabschluss, Saison? |
| Widerspruchsregel | Wenn 'Luecke ueberbruecken' UND Laufzeit >= 12 Monate (C-04) UND 5 Tage/Woche (C-05): das ist faktisch eine Stelle, keine Projektleistung. C-11 wird dann zur Pflichtfrage und darf nicht uebersprungen werden. |
| Starke Antwort | Die S/4-Migration FI/CO fuer drei Gesellschaften ist zum 31.03. produktiv, das Altsystem ist abgeschaltet und die Key-User sind geschult. |
| Schwache Antwort | Wir brauchen Unterstuetzung im Controlling. |
| Wenn die Antwort fehlt | Der Einsatz ist nicht einreichbar. Ohne Ergebnis kann der Recruiter nur nach Jobtitel suchen — und Titel sind bei Freiberuflern beliebig (jeder nennt sich Consultant). Heute faellt das nicht auf, weil ClientJobDetail.tsx:302 fuer Freelance-Jobs gar keine Vollstaendigkeit prueft. |
| Zweck / Sensitivitaet | Matching · normal |

#### `C-02` · Ob es ein echtes Projekt, eine Ueberbrueckung, eine gesperrte Planstelle oder eine verkappte Festanstellung ist. Bestimmt die Ansprache, die Satzhoehe und ob eine Verlaen

*Das bleibt zwischen Ihnen und dem Recruiter. Es entscheidet nur darueber, wie wir den Einsatz Kandidaten gegenueber ehrlich erklaeren.*

> **„Warum soll das jemand von aussen machen und nicht jemand aus dem Team oder eine feste Einstellung?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Zeitlich begrenztes Projekt · Ausfall oder Vakanz ueberbruecken · Spezialwissen, das wir intern nicht haben · Die Planstelle ist gesperrt · Auftragsspitze · Erst zusammenarbeiten, spaeter vielleicht fest |
| Trigger | Immer, direkt nach C-01. |
| Uebersprungen wenn | Wenn aus einem importierten Anforderungsprofil bereits ein eindeutiger Grund hervorgeht — dann nur bestaetigen lassen. |
| „Weiss ich nicht“ | Ersatzfrage: 'Wer hat diese Aufgabe bisher gemacht?' Daraus ergibt sich der Grund fast immer von selbst. |
| Zielfeld | `jobs.vacancy_reason (vorhanden, REST 200) — heute BEWIESEN nur aus dem Parser befuellt (JobIntakeStudio.tsx:348); die Briefing-Antwort IB-01 setzt es nicht.` |
| Folgefragen | – Wenn die Planstelle gesperrt ist: wie lange voraussichtlich?<br>– Wenn spaetere Uebernahme im Raum steht: ist die wirklich moeglich, oder ist sie vertraglich ausgeschlossen? |
| Widerspruchsregel | 'Planstelle gesperrt' zusammen mit 'Uebernahme moeglich' (C-04) ist ein Widerspruch. Nachfassen, sonst verspricht der Recruiter etwas, das es organisatorisch nicht gibt. |
| Starke Antwort | Unsere Leiterin Rechnungswesen ist bis Maerz in Elternzeit, die Migration laeuft parallel weiter — intern schafft das niemand nebenbei. |
| Schwache Antwort | Wir haben gerade viel zu tun. |
| Wenn die Antwort fehlt | Der Recruiter erzaehlt eine falsche Geschichte. Freiberufler durchschauen 'spannendes Projekt' sofort, wenn es in Wahrheit eine gesperrte Planstelle ist — und springen im Erstgespraech ab. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `C-03` · Startdatum und vor allem, wie hart es ist. Verfuegbarkeit ist bei Contracting das staerkste Auswahlkriterium — zwei Wochen Unterschied halbieren oder verdoppeln den errei

> **„Ab wann brauchen Sie die Person — und ist das Datum hart oder haben Sie etwas Luft?“**

| | |
|---|---|
| Antworttyp | Datumsfeld + Chips zur Haerte |
| Optionen | Hart, haengt an einem Termin · Plus/minus zwei Wochen · So frueh wie moeglich · Flexibel fuer die richtige Person |
| Trigger | Immer, nach C-02. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | An das Datum aus C-01 andocken: 'Sie sagten, es muss zum Go-Live fertig sein — dann brauchen wir jemanden spaetestens ab …?' und bestaetigen lassen. |
| Zielfeld | `jobs.start_date + jobs.start_flexibility (BEIDE NEU — BEWIESEN: start_date, project_start_date, desired_start_date, earliest_start alle REST 42703). Heute existiert am Job KEIN Startdatum; IB-20 sammelt nur Chips als Fliesstext in briefing_notes.` |
| Folgefragen | – Was passiert konkret, wenn erst vier Wochen spaeter gestartet wird?<br>– Waere ein Start mit zwei Tagen pro Woche und spaeterer Aufstockung eine Option? |
| Widerspruchsregel | 'Hart' + Start in unter drei Wochen + Zugangsvorlauf aus C-13 ueber zwei Wochen = rechnerisch unmoeglich. Dem Kunden vor Veroeffentlichung zeigen: entweder Vorlauf verkuerzen oder Datum bewegen. |
| Starke Antwort | Hart zum 1. Oktober, weil das Altsystem zum Jahresende abgeschaltet wird. |
| Schwache Antwort | So schnell wie moeglich. |
| Wenn die Antwort fehlt | Der Recruiter spricht Kandidaten an, die erst in drei Monaten frei sind — oder verwirft die, die naechste Woche koennten. Beides kostet den Einsatz. |
| Zweck / Sensitivitaet | Matching · normal |

#### `C-04` · Laufzeit UND was danach realistisch passiert — in einer Frage. Die Fortsetzungsperspektive ist bei Freiberuflern das staerkste Pitch-Argument nach dem Satz und entscheide

> **„Fuer welchen Zeitraum planen Sie — und was passiert danach realistisch?“**

| | |
|---|---|
| Antworttyp | Zahlenfeld (Monate) + Chips zur Fortsetzung |
| Optionen | Verlaengerung sehr wahrscheinlich · Verlaengerung moeglich, noch offen · Fix Schluss, keine Verlaengerung · Uebernahme in Festanstellung denkbar |
| Trigger | Immer, nach C-03. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | Zweiteilen: 'Wie lange ist das Budget bewilligt?' Das weiss praktisch jeder Kunde. Die Fortsetzungsfrage dann als 'noch offen' erfassen statt zu raten. |
| Zielfeld | `jobs.contract_duration_months + jobs.extension_likelihood (BEIDE NEU, REST 42703). Ersetzt vier heutige Erfassungen derselben Sache: PS-10 (Dauer, verloren in intake_payload), PS-12 (binaere Checkbox), IB-22 (Chips) und IB-24 (Chips) — BEWIESEN landen alle vier nur in briefing_notes oder intake_payload.` |
| Folgefragen | – Ist das Budget fuer den gesamten Zeitraum bereits bewilligt oder nur fuer den ersten Abschnitt?<br>– Falls Uebernahme denkbar: gibt es eine Ablöseregelung mit dem Dienstleister? |
| Widerspruchsregel | 'Fix Schluss' + Laufzeit hoechstens drei Monate + Satzobergrenze im unteren Marktdrittel (C-08/C-09) = sehr schwer besetzbar. Vor Veroeffentlichung als Marktfeedback zeigen, nicht erst nach vier Wochen Funkstille. |
| Starke Antwort | Sechs Monate bewilligt, Verlaengerung sehr wahrscheinlich, weil Phase zwei im Januar startet und dasselbe Wissen braucht. |
| Schwache Antwort | Erstmal drei Monate, mal schauen. |
| Wenn die Antwort fehlt | Der Recruiter kann den Einsatz nicht verkaufen. Ein Freiberufler entscheidet zwischen zwei Angeboten fast immer ueber Planungssicherheit — 'sechs Monate mit hoher Verlaengerungschance' schlaegt 'drei Monate, dann sehen wir'. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `C-05` · Auslastung in Tagen pro Woche und ob sie verhandelbar ist. Entscheidet, ob nur Vollzeit-Verfuegbare in Frage kommen oder auch sehr gute Teilzeit-Freiberufler mit Parallel

> **„Wie viele Tage pro Woche soll die Person fuer Sie arbeiten?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Zusatzschalter 'ist verhandelbar' |
| Optionen | 1 Tag · 2 Tage · 3 Tage · 4 Tage · 5 Tage · Nach Bedarf, schwankt |
| Trigger | Immer, nach C-04. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | Ueber den Aufwand rechnen: 'Wenn Sie den Auftrag aus C-01 auf die Laufzeit umlegen — sind das eher 20, 60 oder 120 Personentage?' Daraus die Wochenauslastung vorschlagen und bestaetigen lassen. |
| Zielfeld | `jobs.utilization_days_per_week + jobs.utilization_flexible (BEIDE NEU, REST 42703). Ersetzt PS-11 (Select, verloren in intake_payload.contracting) und IB-23 (Chips, verloren in briefing_notes).` |
| Folgefragen | – Waeren auch zwei feste Tage plus Rufbereitschaft denkbar?<br>– Duerfte die Person parallel ein anderes Mandat betreuen? |
| Widerspruchsregel | 'Nach Bedarf, schwankt' ist fuer Freiberufler oft ein Ausschlusskriterium, weil sie den Rest der Woche nicht verplanen koennen. Dann Hinweis: feste Tage vereinbaren oder Mindestabnahme zusagen. Zweitens: 5 Tage/Woche + Laufzeit >= 12 Monate + weisungsgebunden (C-11) loest das AÜG-Warnbanner aus. |
| Starke Antwort | Drei feste Tage, davon Dienstag und Mittwoch, der dritte flexibel — aufstocken auf vier waere moeglich. |
| Schwache Antwort | Voll, wie alle anderen auch. |
| Wenn die Antwort fehlt | Der Recruiter rechnet mit Vollzeit. Wer nur zwei Tage braucht, verliert die besten Leute an ein Vollzeitmandat, obwohl gerade die Zwei-Tage-Konstellation viele Top-Freiberufler ueberhaupt erst verfuegbar macht. |
| Zweck / Sensitivitaet | Matching · normal |

#### `C-06` · Wie viele Tage die Person tatsaechlich vor Ort sein muss UND wer Anreise und Uebernachtung traegt. Bei externen Einsaetzen ist das ein Geldthema, kein Komfortthema.

*Das entscheidet ueber den halben Markt: Wer 400 Kilometer entfernt wohnt, rechnet Reisezeit und Hotel in den Tagessatz ein, wenn Sie es nicht separat erstatten.*

> **„An wie vielen Tagen muss die Person tatsaechlich bei Ihnen vor Ort sein — und uebernehmen Sie Anreise und Uebernachtung?“**

| | |
|---|---|
| Antworttyp | Zahl 0-5 + Chips zur Kostenregel |
| Optionen | Reise und Uebernachtung werden zusaetzlich erstattet · Pauschale zusaetzlich zum Satz · Im Tagessatz enthalten (all-in) · Noch nicht entschieden |
| Trigger | Immer, wenn Arbeitsmodell nicht 'Remote' ist. |
| Uebersprungen wenn | Arbeitsmodell = 'Remote' und C-07 erlaubt ortsunabhaengiges Arbeiten. |
| „Weiss ich nicht“ | Bei der Kostenregel nicht raten lassen. 'Noch nicht entschieden' sauber erfassen und dem Recruiter als offener Verhandlungspunkt mitgeben, statt eine Zahl zu erfinden. |
| Zielfeld | `jobs.onsite_days_required (vorhanden, REST 200) + jobs.travel_expenses_policy (NEU, REST 42703). BEFUND: Diese Frage wird Contracting-Einsaetzen heute NIE gestellt — IntakeBriefing.tsx:189 traegt appliesTo:'full-time' und applicableFor (Zeile 290) filtert sie fuer Freelance heraus; die Contracting-Sektion in ProfileSections.tsx:138-181 hat ebenfalls kein Onsite-Feld.` |
| Folgefragen | – Gibt es Wochen mit Praesenzpflicht, etwa zum Go-Live oder zur Jahresabschlussphase?<br>– Zaehlt der Anreisetag als Arbeitstag? |
| Widerspruchsregel | Drei oder mehr Onsite-Tage + 'im Tagessatz enthalten' + Satzobergrenze im unteren Marktdrittel = der effektive Satz liegt weit unter Markt. Dem Kunden vorrechnen, bevor der Recruiter startet. |
| Starke Antwort | Zwei Tage vor Ort in Stuttgart, Anreise und Hotel erstatten wir nach Beleg, der Rest remote. |
| Schwache Antwort | Ueberwiegend vor Ort. |
| Wenn die Antwort fehlt | Die Verhandlung platzt in der letzten Runde. Der Kandidat rechnet all-in, der Kunde rechnet plus Spesen — der Unterschied sind schnell 15 Prozent des Satzes. |
| Zweck / Sensitivitaet | Matching · normal |

#### `C-07` · Ob ortsunabhaengiges Arbeiten aus dem Ausland zulaessig ist. Harte Ja/Nein-Regel, die spaet entdeckt den kompletten Prozess vernichtet — viele erfahrene Freiberufler arbe

*Wenn das bei Ihnen nicht geht, sollten wir es vor dem ersten Gespraech wissen und nicht danach.*

> **„Darf die Person auch aus dem Ausland arbeiten, oder muss sie in Deutschland sitzen?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) |
| Optionen | Nur aus Deutschland · EU/EWR ist in Ordnung · Ortsunabhaengig, egal woher · Einzelfallpruefung noetig |
| Trigger | Immer, wenn Arbeitsmodell 'Remote' oder 'Hybrid' ist. |
| Uebersprungen wenn | Onsite-Pflicht aus C-06 betraegt 4 oder 5 Tage — dann erledigt sich die Frage. |
| „Weiss ich nicht“ | Als 'Einzelfallpruefung' erfassen und dem Recruiter mitgeben, dass er die Frage vor dem Angebot klaeren lassen muss. Nicht auf 'Nur Deutschland' defaulten — das schneidet den Markt grundlos ab. |
| Zielfeld | `jobs.work_location_restriction (NEU, REST 42703). Sollte als Firmen-Konstante in company_profiles liegen und pro Einsatz nur bestaetigt werden.` |
| Folgefragen | – Gibt es Systeme oder Daten, die nur aus Deutschland zugaenglich sind? |
| Widerspruchsregel | 'Nur aus Deutschland' + Arbeitsmodell 'Remote' + Satz im oberen Marktband: pruefen, ob die Einschraenkung sachlich noetig ist — sie verteuert die Suche ohne Gegenwert. |
| Starke Antwort | EU ist in Ordnung, aber der Zugriff auf unser Netz geht nur ueber unser VPN und das ist auf EU-Adressen beschraenkt. |
| Schwache Antwort | Remote ist okay. |
| Wenn die Antwort fehlt | Der Recruiter spricht Kandidaten an, die vertraglich nicht einsetzbar sind. Das faellt erst beim Vertrag auf, also nach der gesamten investierten Arbeit. |
| Zweck / Sensitivitaet | Matching · normal |

#### `C-08` · Die Geldlogik: rechnet der Kunde in einem Tagessatz oder in einem Gesamtbudget, und was ist im Satz enthalten. Genau diese Angabe geht heute vollstaendig verloren.

> **„Rechnen Sie in einem Tagessatz oder in einem Gesamtbudget fuer den Auftrag?“**

| | |
|---|---|
| Antworttyp | Auswahl (Tagessatz / Stundensatz / Gesamtbudget) und je nach Wahl zwei Zahlenfelder (von-bis) oder Gesamtsumme plus geschaetzte Personentage; dazu ein Schalter 'Satz ist all-in' / 'Reise und Spesen kommen obendrauf' |
| Optionen | Tagessatz · Stundensatz · Gesamtbudget fuer den Auftrag |
| Trigger | Immer, nach C-05. Ersetzt im Contracting-Pfad das Gehaltsband vollstaendig. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | Zwei Auswege anbieten, nie leer lassen: entweder die Zahl aus dem letzten vergleichbaren Einsatz bestaetigen, oder eine Marktspanne vom Recruiter vorschlagen lassen und als 'Marktrate, noch zu bestaetigen' markieren. |
| Zielfeld | `jobs.rate_period ('day'|'hour'|'total') + jobs.rate_min/jobs.rate_max + jobs.budget_total + jobs.rate_includes_expenses (ALLE NEU — BEWIESEN alle REST 42703). Heute: PS-08/PS-09 schreiben nach intake_payload.contracting.dayRateMin/Max (JobIntakeStudio.tsx:382), die Spalte existiert nicht; parallel setzt JobIntakeStudio.tsx:342-343 salary_min/max fuer Freelance hart auf null. Ergebnis: ein Contracting-Job hat nach dem Speichern KEINE Verguetungsangabe. Uebergangsloesung bis zur Migration: rate_min/rate_max in salary_min/salary_max schreiben und rate_period in einer eigenen Spalte fuehren — niemals wieder null.` |
| Folgefragen | – Ist das der Betrag, den der Freiberufler bekommt, oder ist unsere Gebuehr darin enthalten?<br>– Sind Reisekosten und Spesen im Satz enthalten oder kommen sie obendrauf?<br>– Bei Gesamtbudget: mit wie vielen Personentagen rechnen Sie? |
| Widerspruchsregel | Wenn die Satzobergrenze unter dem Marktband fuer Skill und Region liegt oder wenn 'all-in' mit drei oder mehr Onsite-Tagen (C-06) kombiniert ist: Marktfeedback VOR der Veroeffentlichung, mit konkreter Zahl. Bei Gesamtbudget zusaetzlich rechnen — Budget geteilt durch Personentage muss einen plausiblen Satz ergeben, sonst passt Auftragsumfang und Budget nicht zusammen. |
| Starke Antwort | Tagessatz 850 bis 950 Euro netto an den Freiberufler, Reise und Hotel erstatten wir zusaetzlich nach Beleg. |
| Schwache Antwort | Marktueblich halt. |
| Wenn die Antwort fehlt | Der Einsatz darf nicht eingereicht werden. Heute passiert genau das Gegenteil: ClientJobDetail.tsx:302 prueft die Verguetung bei Freelance-Jobs bewusst nicht, der Job geht ohne jede Zahl live, der Recruiter sieht kein Honorar (JobDetail.tsx:267-271 gibt ohne salary null zurueck) und der Matcher rechnet mit 0 (calculate-match-v3-1:981). |
| Zweck / Sensitivitaet | Matching · sensibel |

#### `C-09` · Die echte Obergrenze und wer sie freigibt. Das ist das Verhandlungsbudget des Recruiters — ohne die Zahl verhandelt er entweder zu vorsichtig und verliert, oder zu mutig 

*Der Recruiter verhandelt mit Ihrem Geld. Diese Zahl sieht kein Kandidat, sie bleibt zwischen Ihnen und ihm.*

> **„Wenn Ihnen der Recruiter nach zwei Tagen sagt: das ist genau die Person — was koennen Sie beim Satz noch bewegen?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) |
| Optionen | Fix, keinen Euro mehr · Bis etwa zehn Prozent · Bis etwa zwanzig Prozent · Fuer den Richtigen verhandelbar · Sagen Sie uns, was marktueblich ist |
| Trigger | Direkt nach C-08, sobald eine Satzspanne oder ein Budget erfasst ist. |
| Uebersprungen wenn | Wenn in C-08 'Gesamtbudget' gewaehlt wurde und dieses Budget bereits als Obergrenze gilt — dann nur bestaetigen lassen. |
| „Weiss ich nicht“ | Umformulieren statt bohren: 'Wenn Sie zur Freigabe muessten — bei welcher Zahl wuerden Sie noch hingehen und bei welcher nicht mehr?' |
| Zielfeld | `jobs.rate_ceiling (NEU, REST 42703) — recruiter-privat, darf nie in kandidatensichtbare Ansichten gelangen. Pendant zu IB-16, das BEWIESEN appliesTo:'full-time' traegt (IntakeBriefing.tsx:170) und fuer Contracting damit ueberhaupt nicht existiert.` |
| Folgefragen | – Wer muss einer Erhoehung zustimmen und wie lange dauert das? |
| Widerspruchsregel | 'Fix, keinen Euro mehr' + Satz unter Marktband + Start hart in unter vier Wochen (C-03) = der Einsatz ist so nicht besetzbar. Ehrlich sagen, bevor der Recruiter zwei Wochen investiert. |
| Starke Antwort | Bis 1.000 Euro kann ich selbst entscheiden, darueber braucht es den Bereichsleiter — das dauert etwa drei Tage. |
| Schwache Antwort | Da ist kein Spielraum. (Erfahrungsgemaess fast nie wahr — nachfassen.) |
| Wenn die Antwort fehlt | Der Recruiter geht ohne Spielraum in die Verhandlung und verliert Kandidaten, die fuer fuenf Prozent mehr zugesagt haetten. Bei Contracting laeuft das in Tagen ab, nicht in Wochen. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `C-10` · Der Beschaffungsweg: direkt mit dem Freiberufler oder ueber Einkauf, Rahmenvertrag oder gelisteten Dienstleister. Entscheidet, ob das Mandat ueberhaupt lieferbar ist.

> **„Schliessen Sie den Vertrag direkt mit dem Freiberufler ab, oder laeuft das bei Ihnen ueber den Einkauf oder einen festen Dienstleister?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Folgefelder |
| Optionen | Direkt mit dem Freiberufler · Ueber unseren Einkauf oder Rahmenvertrag · Nur ueber bereits gelistete Dienstleister · Weiss ich nicht, das klaere ich |
| Trigger | Immer, nach C-09. |
| Uebersprungen wenn | Wenn der Kunde bereits einen Contracting-Einsatz ueber Matchunt abgeschlossen hat — dann den letzten Weg anzeigen und bestaetigen lassen. |
| „Weiss ich nicht“ | Legitime Antwort, sie ist haeufig. Als offener Punkt erfassen und dem Recruiter mit Frist mitgeben: vor der ersten Kandidatenansprache klaeren, nicht vor dem Angebot. |
| Zielfeld | `jobs.contract_route + jobs.payment_terms_days (BEIDE NEU, REST 42703). Sollte Firmen-Konstante in company_profiles sein und pro Einsatz nur bestaetigt werden. BEWIESEN gibt es dafuer heute kein Feld: buildRecord (JobIntakeStudio.tsx:332-354) kennt nur employment_type.` |
| Folgefragen | – Wie lange dauert die Freigabe eines neuen Dienstleisters bei Ihnen erfahrungsgemaess?<br>– Welches Zahlungsziel gilt — 30, 60 oder 90 Tage? |
| Widerspruchsregel | 'Nur gelistete Dienstleister' + Start in unter vier Wochen (C-03) = der Termin ist nicht haltbar. Zweitens: Zahlungsziel 60 Tage oder mehr ist fuer einzelne Freiberufler oft ein Ausschlusskriterium — der Recruiter muss das vor der Ansprache wissen, nicht danach. |
| Starke Antwort | Direkt, ich habe eine eigene Bestellfreigabe bis 100.000 Euro. Zahlungsziel 30 Tage. |
| Schwache Antwort | Das macht dann der Einkauf. |
| Wenn die Antwort fehlt | Der Recruiter findet den passenden Freiberufler, und dann stellt sich heraus, dass nur gelistete Lieferanten beauftragt werden duerfen. Der gesamte Prozess war umsonst. |
| Zweck / Sensitivitaet | Vertrag · normal |

#### `C-11` · Ob der Einsatz als selbstaendige Leistung tragfaehig ist oder faktisch Arbeitnehmerueberlassung waere. Matchunt schliesst AÜG in den eigenen AGB aus — ohne diese Frage wi

*Eine kurze, aber wichtige Frage. Bei externen Einsaetzen entscheidet die Antwort darueber, welche Vertragsform ueberhaupt zulaessig ist. Wir fragen das einmal am Anfang, damit es spaeter niemandem auf die Fuesse faellt.*

> **„Arbeitet die Person eigenverantwortlich an einem abgegrenzten Auftrag, oder wird sie wie ein Teammitglied in Ihre Ablaeufe und Arbeitszeiten eingeplant?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext |
| Optionen | Eigenverantwortlich, klar abgegrenzter Auftrag · Arbeitet im Team mit, steuert sich aber selbst · Wird wie ein Mitarbeiter eingeplant: feste Zeiten, Weisung, Schichten · Weiss ich nicht |
| Trigger | Immer. Zwingend und nicht ueberspringbar, wenn die Tension-Regel aus C-01 oder C-05 ausgeloest hat. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | Nicht draengen und keine Rechtsberatung geben. Als Flag erfassen, dem Kunden und dem Recruiter denselben Hinweis zeigen: vor Vertragsschluss mit der eigenen Rechtsabteilung klaeren. Der Einsatz bleibt lieferbar, aber markiert. |
| Zielfeld | `jobs.engagement_control_model + jobs.aueg_risk_flag (BEIDE NEU, REST 42703). BEWIESEN: Das gesamte Repository enthaelt ausser AGB.tsx:57 kein einziges Vorkommen von AÜG, Arbeitnehmerueberlassung, Scheinselbstaendigkeit oder Werkvertrag — es gibt heute weder Frage noch Feld noch Pruefung.` |
| Folgefragen | – Hat die Person eigene Arbeitszeiten oder gelten Ihre Kernzeiten?<br>– Wird sie in Ihrem Organigramm oder in internen Verteilern gefuehrt?<br>– Bringt sie eigenes Geraet mit oder stellen Sie eines (siehe C-13)? |
| Widerspruchsregel | Option 3 gewaehlt ODER die Kombination aus 5 Tagen pro Woche (C-05), Laufzeit ab 12 Monaten (C-04), festem Onsite-Rhythmus (C-06) und gestelltem Firmen-Equipment (C-13) loest ein Warnbanner aus: 'So beschrieben ist das eher Arbeitnehmerueberlassung als ein freier Auftrag. Matchunt vermittelt keine Arbeitnehmerueberlassung. Bitte pruefen Sie die Vertragsform — oder wir legen den Einsatz als Festanstellung an.' |
| Starke Antwort | Abgegrenztes Migrationspaket gegen Meilensteine, eigene Zeiteinteilung, nimmt an zwei Jour Fixes pro Woche teil, nutzt eigenes Geraet. |
| Schwache Antwort | Sie soll einfach im Team mitarbeiten wie alle anderen. |
| Wenn die Antwort fehlt | Matchunt vermittelt einen Einsatz, der die eigene AGB-Zusage bricht (AGB.tsx:57, §3 Abs. 2: 'betreibt keine Arbeitnehmerueberlassung im Sinne des AÜG'). Das Risiko traegt am Ende der Kunde, aber die Plattform hat es sehenden Auges erzeugt. |
| Zweck / Sensitivitaet | Vertrag · sensibel |

#### `C-12` · Welche Nachweise und Freigaben vor dem ersten Arbeitstag vorliegen muessen. Manche brauchen Wochen Vorlauf und machen ein hartes Startdatum unmoeglich.

*Einige dieser Nachweise brauchen mehrere Wochen. Wenn wir sie kennen, suchen wir gleich passend — sonst platzt der Starttermin.*

> **„Was muss vorliegen, bevor die Person bei Ihnen anfangen darf?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) + Freitext |
| Optionen | Betriebs- oder Berufshaftpflicht · Nachweis der Selbstaendigkeit (Gewerbe, Freiberufler-Status) · Unbedenklichkeitsbescheinigung der Sozialversicherung · Verschwiegenheitserklaerung · Erweitertes Fuehrungszeugnis · Sicherheitsueberpruefung · Branchen- oder Kundenzertifikat · Nichts davon |
| Trigger | Immer, nach C-11. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | Ersatzfrage an die Praxis: 'Was mussten die letzten Externen bei Ihnen vorlegen?' Das weiss auch jemand, der die Compliance-Liste nicht kennt. |
| Zielfeld | `jobs.compliance_prerequisites (NEU, text[], REST 42703). Wichtig: nur die ANFORDERUNG am Einsatz speichern, niemals die Nachweisdokumente selbst in der Plattform sammeln.` |
| Folgefragen | – Wie lange dauert die Pruefung bei Ihnen erfahrungsgemaess?<br>– Duerfen wir Kandidaten vorab sagen, dass diese Nachweise verlangt werden? |
| Widerspruchsregel | 'Sicherheitsueberpruefung' oder 'Erweitertes Fuehrungszeugnis' + hartes Startdatum in unter acht Wochen (C-03) = nicht erreichbar, dem Kunden vorrechnen. Zweitens Datenschutz-Hinweis im UI: Fuehrungszeugnis und Sicherheitsueberpruefung betreffen besonders geschuetzte Daten (Art. 10 DSGVO) — die Nachweise gehen direkt zwischen Kunde und Freiberufler, nie ueber die Plattform. |
| Starke Antwort | Berufshaftpflicht ueber zwei Millionen, NDA vor dem ersten Gespraech, sonst nichts. Das NDA ist am selben Tag durch. |
| Schwache Antwort | Das Uebliche. |
| Wenn die Antwort fehlt | Der Recruiter verspricht einen Start in zwei Wochen, und dann liegt eine Sicherheitsueberpruefung dazwischen, die drei Monate braucht. Der Kandidat springt ab, der Kunde verliert das Vertrauen. |
| Zweck / Sensitivitaet | Prozess · DSGVO-relevant |

#### `C-13` · Vorlaufzeit vom unterschriebenen Vertrag bis zum ersten produktiven Tag — und ob Geraet und Zugaenge gestellt werden. Bezahlter Leerlauf ist bei Tagessaetzen reiner Verlu

> **„Wie lange dauert es bei Ihnen erfahrungsgemaess vom unterschriebenen Vertrag bis die Person wirklich arbeiten kann — Laptop, Zugaenge, Ausweis?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Zusatzauswahl zum Geraet |
| Optionen | Am ersten Tag · Drei bis fuenf Tage · Zwei bis drei Wochen · Laenger · Die Person arbeitet mit eigener Ausstattung |
| Trigger | Immer, nach C-12. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | An der letzten Erfahrung ansetzen: 'Wie lief das beim letzten Externen — konnte der sofort loslegen?' |
| Zielfeld | `jobs.access_lead_time_days + jobs.equipment_provided (BEIDE NEU, REST 42703).` |
| Folgefragen | – Stellen Sie Laptop und Zugaenge, oder arbeitet die Person mit eigener Ausstattung?<br>– Gibt es einen festen Termin fuer die Ausweiserstellung oder geht das laufend? |
| Widerspruchsregel | Vorlauf ab zwei Wochen + hartes Startdatum (C-03) = das Datum stimmt nicht, es ist in Wahrheit zwei Wochen frueher. Zweitens: gestelltes Firmen-Equipment fliesst in die AÜG-Gesamtbetrachtung aus C-11 ein. |
| Starke Antwort | Laptop und VPN sind am ersten Tag da, den Werksausweis gibt es innerhalb einer Woche — bis dahin geht Begleitung. |
| Schwache Antwort | Das regelt die IT. |
| Wenn die Antwort fehlt | Der Freiberufler stellt drei Wochen Wartezeit in Rechnung oder nimmt das naechste Mandat. Beides kostet Sie Geld, und Sie erfahren es erst hinterher. |
| Zweck / Sensitivitaet | Prozess · normal |

#### `C-14` · Die nachweisbare Vorleistung als Mindestanforderung. Bei Contracting gibt es keine Einarbeitungszeit — was die Person nicht schon einmal gemacht hat, wird sie hier nicht 

> **„Was muss die Person nachweislich schon einmal gemacht haben, damit sie hier ohne Einarbeitung liefern kann?“**

| | |
|---|---|
| Antworttyp | Freitext-Liste; jedes Kriterium wird eingestuft als Wunsch, Mindestanforderung oder Ausschlusskriterium |
| Optionen | Wunsch · Mindestanforderung · Ausschlusskriterium |
| Trigger | Immer, nach C-01. Wird bei mehreren Kriterien wiederholt, bis der Kunde abbricht. |
| Uebersprungen wenn | Wenn ein Anforderungsprofil importiert wurde: Kriterien daraus vorschlagen und nur einstufen lassen, statt neu abzufragen. |
| „Weiss ich nicht“ | Ueber den letzten Fall gehen: 'Wer hat so etwas bei Ihnen schon einmal gemacht — und was konnte der, was andere nicht konnten?' |
| Zielfeld | `jobs.must_haves (vorhanden) + job_skill_requirements (Tabelle vorhanden, REST 200) mit Auspraegung und Aktualitaet. BEWIESEN wird job_skill_requirements heute nur vom KI-Pfad befuellt (JobIntakeStudio.tsx:409-419), und intake-questions liefert in PROD 404 — die Tabelle bleibt fuer Kundenjobs leer. Die Verhandelbarkeits-Einstufung landet heute in intake_payload.flexibility (Zeile 383) und ist damit verloren.` |
| Folgefragen | – In welcher Groessenordnung — Konzern oder Mittelstand, wie viele Nutzer, Standorte, Gesellschaften?<br>– Wie aktuell muss das sein — reicht vor fuenf Jahren oder muss es aus den letzten zwei Jahren stammen?<br>– Von diesen Punkten: welcher ist wirklich ein Ausschlusskriterium und welcher waere verhandelbar? |
| Widerspruchsregel | Mehr als fuenf Mindestanforderungen + Satzobergrenze im unteren Marktdrittel (C-09) = der Markt gibt das nicht her. Konkret zurueckspiegeln: 'Bei diesem Satz finden wir jemanden mit vier dieser fuenf Punkte. Welchen streichen wir?' |
| Starke Antwort | Mindestens zwei S/4-Migrationen im Konzernumfeld selbst verantwortet, davon eine in den letzten 24 Monaten. Branchenerfahrung waere ein Wunsch, kein Muss. |
| Schwache Antwort | Sie soll SAP koennen. |
| Wenn die Antwort fehlt | Der Recruiter schickt Leute, die es 'im Prinzip koennen'. Bei einem Sechs-Monats-Einsatz merkt der Kunde das in Woche drei — und dann ist ein Drittel der Laufzeit weg. |
| Zweck / Sensitivitaet | Matching · normal |

#### `C-15` · Ob der Auftrag bereits im Markt liegt und seit wann gesucht wird. Bestimmt, ob der Recruiter das Mandat ueberhaupt annimmt und ob am Markt schon ein Satz gesetzt ist, geg

*Das ist keine Fangfrage. Wenn die Anfrage schon laenger im Markt ist, kennen viele Freiberufler sie bereits und wir muessen anders herangehen.*

> **„Liegt der Auftrag schon bei anderen Dienstleistern — und seit wann suchen Sie?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Zahlenfeld (Wochen) |
| Optionen | Nur bei Ihnen · Bei ein bis zwei weiteren · Breit im Markt · Weiss ich nicht |
| Trigger | Immer, am Ende des Pfades vor der Zusammenfassung. |
| Uebersprungen wenn | nie |
| „Weiss ich nicht“ | Umwegfrage: 'Haben Sie in den letzten Wochen schon Profile zu diesem Thema bekommen?' Das beantwortet dieselbe Frage ohne Rechtfertigungsdruck. |
| Zielfeld | `jobs.mandate_exclusivity + jobs.searching_since_weeks (BEIDE NEU, REST 42703). Verwandt mit jobs.candidates_in_pipeline (vorhanden, REST 200), das heute BEWIESEN aus CJ-28 verkuerzt befuellt wird ('1-3' wird zu 1, coerceLeadingInt in CreateJob.tsx:646) — der Rohwert sollte in intake_payload landen und geht dort verloren.` |
| Folgefragen | – Welche Profile haben Sie schon gesehen und woran hat es gelegen?<br>– Zu welchem Satz wurden Ihnen die angeboten? |
| Widerspruchsregel | 'Breit im Markt' + Suche laeuft ueber acht Wochen + 'kein Spielraum beim Satz' (C-09) = das Problem ist nicht die Suche, sondern der Preis oder das Profil. Das gehoert vor Annahme des Mandats gesagt, nicht nach vier Wochen. |
| Starke Antwort | Seit drei Wochen, parallel bei einem Partner. Zwei Profile gesehen, beide zu teuer und ohne Konzernerfahrung. |
| Schwache Antwort | Wir schauen uns gerade erst um. |
| Wenn die Antwort fehlt | Der Recruiter spricht Freiberufler an, die dieselbe Anfrage diese Woche schon dreimal bekommen haben — und verbrennt dabei seinen eigenen Ruf und den Ihrer Firma. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

**Beispieldialog**

```
Matchunt: Wenn der Einsatz am letzten Tag erfolgreich war — was liegt dann fertig auf dem Tisch?

Kunde: Wir brauchen jemanden, der uns im SAP-Umfeld unterstuetzt. Wir sind da gerade unterbesetzt.

Matchunt: Verstanden. Damit der Recruiter nicht nach einem Titel sucht, sondern nach jemandem, der genau das schon geliefert hat: Was ist der konkrete Anlass — steht ein Go-Live an, faellt jemand aus, oder soll etwas aufgeraeumt werden?

Kunde: Wir migrieren auf S/4, drei Gesellschaften, und unsere Leiterin Rechnungswesen ist ab September in Elternzeit.

Matchunt: Danke, das ist genau der Punkt. Ich halte fest: Bis zum 31.03. ist FI/CO fuer drei Gesellschaften produktiv und die Key-User sind geschult. Stimmt das so?

Kunde: Ja, genau.

Matchunt: Rechnen Sie in einem Tagessatz oder in einem Gesamtbudget fuer den Auftrag?

Kunde: Tagessatz. Marktueblich halt.

Matchunt: Marktueblich ist bei S/4-Migration im Konzernumfeld eine ziemlich breite Spanne — von 750 bis ueber 1.200 Euro, je nachdem wie viel Verantwortung die Person traegt. Ich frage deshalb anders herum: Welche Zahl steht in Ihrer Budgetplanung fuer diesen Einsatz?

Kunde: Wir haben 120.000 fuer den Zeitraum eingeplant.

Matchunt: Dann rechnen wir das kurz gegen. Bei sechs Monaten und drei Tagen pro Woche sind das etwa 78 Personentage, also rund 1.150 Euro pro Tag — das liegt gut im Markt. Zwei Dinge muss ich noch wissen: Ist das der Betrag, den der Freiberufler bekommt, oder ist unsere Gebuehr darin enthalten? Und sind Reise und Uebernachtung enthalten oder kommen sie obendrauf?

Kunde: Alles zusammen. Und vor Ort waeren es drei Tage in Stuttgart.

Matchunt: Dann sage ich Ihnen etwas Unangenehmes, aber es ist besser jetzt als in vier Wochen: Bei drei Onsite-Tagen und all-in bleiben einem Freiberufler aus dem Rhein-Main-Gebiet nach Bahn und Hotel etwa 950 Euro. Damit erreichen wir das obere Drittel des Marktes nicht mehr. Zwei Wege: Reise und Hotel nach Beleg zusaetzlich, oder zwei Onsite-Tage statt drei. Was ist Ihnen lieber?

Kunde: Reisekosten koennen wir separat abrechnen, das laeuft ueber ein anderes Konto.

Matchunt: Sehr gut, das aendert die Ausgangslage deutlich. Letzte wichtige Frage, und die stelle ich einmal am Anfang, damit sie spaeter niemandem auf die Fuesse faellt: Arbeitet die Person eigenverantwortlich an diesem Migrationspaket, oder wird sie wie ein Teammitglied in Ihre Ablaeufe und Arbeitszeiten eingeplant?

Kunde: Naja, sie sitzt im Team, macht die Daily Standups mit, und wenn im Tagesgeschaeft was brennt, springt sie mit ein. Wie alle anderen auch.

Matchunt: Das ist der Punkt, an dem ich kurz nachhaken muss — nicht um Ihnen Steine in den Weg zu legen, sondern weil die Antwort die zulaessige Vertragsform bestimmt. 'Springt im Tagesgeschaeft mit ein' und feste Arbeitszeiten sehen von aussen nach Weisungsbindung aus, und das ist dann keine freie Mitarbeit mehr, sondern Arbeitnehmerueberlassung. Ueber Matchunt laeuft das nicht. Also konkret: Gibt es ein abgegrenztes Paket, das die Person gegen Meilensteine liefert — oder ist es in Wahrheit eine Vollzeitstelle auf Zeit?

Kunde: Ehrlich gesagt beides. Die Migration ist das Hauptthema, aber wir brauchen auch jemanden fuer den Monatsabschluss, solange die Kollegin weg ist.

Matchunt: Danke fuer die Ehrlichkeit, das hilft mehr als eine glatte Antwort. Mein Vorschlag: Wir schneiden es sauber. Die Migration wird der beauftragte Leistungsumfang mit eigener Zeiteinteilung und Meilensteinen — das traegt als freier Auftrag. Den Monatsabschluss nehmen wir als klar benannte Mitwirkung auf, mit Aufwandsobergrenze, nicht als 'springt ein, wenn es brennt'. Ich markiere den Einsatz zusaetzlich mit dem Hinweis, dass Ihre Rechtsabteilung die Vertragsform vor Unterschrift bestaetigt. Wenn Sie in Wahrheit eine Vollzeitkraft fuer zwoelf Monate im Team brauchen, ist eine befristete Anstellung der ehrlichere und guenstigere Weg — dann legen wir den Einsatz anders an. Was passt besser zu dem, was Sie wirklich vorhaben?
```


---

### Gespraechsfuehrung & Formulierung

**Rollenfamilie:** übergreifend · **Cards:** 16

> **Kernthese:** Das heutige Instrument BELOHNT Ausweichen — genau bei den Fragen, die über den Erfolg eines Mandats entscheiden. BEWIESEN: (1) "Weiß ich nicht" zählt 50 % der Fragengewichtung in die Vollständigkeit (IntakeBriefing.tsx:303 und :349, `s + (a.unknown ? q.weight * 0.5 : q.weight)`) — Ausweichen kostet den halben Preis. (2) "Überspringen" schreibt exakt denselben Wert wie "Weiß ich nicht" (:466 und :439, beide `set({ unknown: true })`) — Nicht-Wissen, Nicht-Sagen-Wollen und Desinteresse sind in den Daten ununterscheidbar. (3) Es gibt im gesamten Briefing genau EINE bedingte Verzweigung (`showIf` nur bei IB-02, :75/:292) und `set()` springt sofort weiter — es ist strukturell unmöglich, auf eine Antwort nachzufassen. (4) Ein Dauer-Badge sagt "nichts ist Pflicht" (:476). Dazu kommen eingebaute Fluchttüren in den Chips selbst: "Gibt keine nennenswerte" (:236) beendet die Schattenseiten-Frage, "Verhandelbar"/"Marktrate" (:173) beendet die Budget-Frage, "Keine" (:165/:270) beendet die K.O.-Fragen — jeweils mit voller Punktzahl. ABGELEITET: Auch der (tote) KI-Pfad ist so gebaut — Regel 4 im Prompt (intake-questions/index.ts) weist die KI an, "__unknown__"-Antworten NICHT zu wiederholen und das Kapitel als skipped zu markieren. Nachfassen ist also nicht vergessen worden, es ist ausgeschlossen worden.

METHODISCHE KORREKTUR IN VIER SÄTZEN: Unangenehme Wahrheiten erhebt man nicht durch Ehrlichkeitsappelle ("Ehrlich: ...", IB-27), sondern durch Formulierungstechnik — (a) SZENARIO statt Selbsteinschätzung ("Die Person kostet 10 % mehr — was passiert dann?" statt "Wie flexibel ist Ihr Budget?"), (b) VERGANGENES VERHALTEN statt Absichtserklärung ("Wie viele Tage lagen zuletzt zwischen Lebenslauf und Gespräch?" statt "Wie schnell sind Sie?"), (c) PRÄSUPPOSITION statt Erlaubnisfrage ("Woran ist es bisher gescheitert?" statt "Gab es Probleme?"), (d) DRITTE PERSON statt Selbstanklage ("Wenn jemand nach sechs Monaten kündigt — warum?" statt "Was ist schlecht bei Ihnen?"). Zusätzlich: die sozial bequeme Option NIE an erste Stelle und nie als Fluchttür anbieten.

STANDARD-NACHFASSLOGIK (gilt für jede Karte, N1–N6):
N1 GENAU EINE NACHFRAGE. Nach der ersten Nachfrage wird die Antwort akzeptiert. Kein zweites Bohren — das zerstört die psychologische Sicherheit für alle Folgefragen.
N2 DIE NACHFRAGE VERKLEINERT, SIE WIEDERHOLT NICHT. Nie dieselbe Frage anders formulieren, sondern eine leichter beantwortbare Version: Spanne statt Zahl, letztes konkretes Mal statt Grundsatz, Beispiel statt Regel, "wer weiß es?" statt "was ist es?".
N3 AUSWEICHEN KOSTET 0 %, NICHT 50 %. `weight * 0.5` streichen. Eine unbeantwortete Frage erzeugt einen sichtbaren offenen Punkt mit Zuständigkeit und Frist ("Wer bei Ihnen weiß das? Bis wann können Sie es nachreichen?") — Vollständigkeit misst Wissen, nicht Klickzahl.
N4 VIER AUSWEICHTYPEN, VIER REAKTIONEN — getrennt erfassbar, nicht ein gemeinsamer `unknown`-Flag: (a) ECHTES NICHT-WISSEN → Frage an die richtige Person weiterreichen, Aufgabe erzeugen. (b) NICHT-SAGEN-WOLLEN ("möchte ich nicht sagen", eigener Button) → akzeptieren, aber Konsequenz benennen und Ersatzinformation holen ("Dann ohne Zahl: eher am oberen oder unteren Ende?"). (c) NOCH-NICHT-ENTSCHIEDEN → Termin statt Antwort ("Wann steht das fest?") und Prozessrisiko markieren. (d) SCHEINANTWORT/FLOSKEL → Konkretisierung erzwingen.
N5 FLOSKEL-LISTE mit automatischer Konkretisierungs-Nachfrage: "marktüblich", "attraktives Paket", "flache Hierarchien", "dynamisches Umfeld", "wir sind flexibel", "die Chemie muss stimmen", "wir suchen den Besten", "Hands-on-Mentalität", "kommt drauf an". Standard-Nachfrage: "Damit ich das richtig weitergebe — woran würden Sie das im konkreten Fall festmachen?"
N6 KONSEQUENZ STATT VORWURF. Die Nachfrage nennt immer den Preis des Nicht-Wissens in Kandidaten- oder Zeit-Einheiten, nie als Kritik: "Ohne diese Zahl stellen wir Ihnen Leute vor, die am Ende absagen — das kostet uns beide drei Wochen." Nie: "Das sollten Sie eigentlich wissen."
N7 REPARATUR NACH SELBSTKRITIK. Direkt nach jeder Frage, auf die eine unangenehme Antwort kam (UE-11, UE-05, UE-09), folgt eine Frage, bei der der Kunde etwas Positives sagen darf (UE-12, UE-13). ABGELEITET aus Interviewpraxis: ohne diesen Ausgleich sinkt die Offenheit aller Folgeantworten spürbar.


#### `UE-01` · Ist das überhaupt ein echtes Mandat? Existiert eine formale Freigabe und ein Budget, oder ist es eine Absichtserklärung? Größter Verschwender von Recruiter-Zeit — im heut

*Eine kurze Formalie vorweg — davon hängt ab, ob wir sofort loslegen oder besser noch zwei Wochen warten.*

> **„Ist die Stelle bei Ihnen intern schon freigegeben und das Budget eingeplant?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl |
| Optionen | Ja, alles freigegeben · Mündlich zugesagt, formal noch offen · Wird gerade noch entschieden · Das weiß ich nicht |
| Trigger | Immer, als eine der ersten drei Fragen — direkt nach Titel und Standort, VOR jeder inhaltlichen Frage. Eine nicht freigegebene Stelle darf gar nicht erst ins Sourcing. |
| Uebersprungen wenn | Der Kunde hat in den letzten 6 Monaten bereits einen Job derselben Familie erfolgreich besetzt — dann als Bestätigung zeigen statt fragen. |
| „Weiss ich nicht“ | N4(a): akzeptieren, Aufgabe "Freigabe klären" mit Zuständigem und Frist erzeugen. Job bleibt Entwurf, geht NICHT ins Sourcing, bis geklärt. Kein Punktabzug in der Vollständigkeit, aber sichtbarer roter offener Punkt. |
| Zielfeld | `jobs.approval_status (NEU, existiert nicht) — Zwischenlösung intake_payload.approval_status; ACHTUNG BEWIESEN: intake_payload fehlt in PROD (REST 42703), ohne Migration 20260619120000 stiller Verlust über intakeCapture.ts` |
| Folgefragen | – Wenn nicht vollständig freigegeben: Wann rechnen Sie mit der endgültigen Entscheidung?<br>– Wenn "das weiß ich nicht": Wer bei Ihnen im Haus könnte das beantworten? |
| Widerspruchsregel | Wenn Antwort ≠ "Ja, alles freigegeben" UND Dringlichkeit = "sehr dringend": Hinweis an den Kunden — "Sehr dringend und noch nicht freigegeben passt selten zusammen. Sollen wir schon suchen und Ihnen die Profile parken, bis die Freigabe da ist?" |
| Starke Antwort | "Formal freigegeben ist sie seit dem 1., Budget liegt im Plan für dieses Jahr." |
| Schwache Antwort | "Das läuft schon." |
| Wenn die Antwort fehlt | ABGELEITET: Recruiter investieren wochenlang in eine Vakanz, die nie besetzt wird. Der teuerste einzelne Informationsmangel im ganzen Modell — und heute wird er nicht einmal gefragt. |
| Zweck / Sensitivitaet | Prozess · sensibel |

#### `UE-02` · Das REALE Zahlungslimit für den Wunschkandidaten, nicht die genehmigte Anzeigen-Range. Ersetzt IB-16, deren Chips "Verhandelbar" und "Marktrate (beraten Sie uns)" (BEWIES

*Diese Frage stellen wir jedem. Sie entscheidet später, ob wir eine Zusage bekommen oder knapp verlieren — und sie bleibt zwischen uns.*

> **„Angenommen, wir finden genau die Person, die Sie beschrieben haben — und sie sagt, sie wechselt nur für rund 10 % mehr als Ihr Maximum. Was passiert dann?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext |
| Optionen | Dann müssen wir passen — das Maximum ist wirklich fix · Ich könnte es intern durchbekommen, mit guter Begründung · Bei der richtigen Person: ja, ohne große Diskussion · Das entscheide nicht ich |
| Trigger | Nach der Gehaltsspanne, im selben Schritt. Nur bei Festanstellung; bei Freelance mit Tagessatz statt Jahresgehalt formulieren. |
| Uebersprungen wenn | Der Kunde hat für einen früheren Job derselben Familie bereits ein Verhalten am Limit gezeigt (Abschluss über/unter Range) — dann als Bestätigung anbieten. |
| „Weiss ich nicht“ | N4(b) wahrscheinlicher als (a): Nachfrage nach N2 verkleinern — "Dann ohne Zusage: Haben Sie in den letzten zwei Jahren schon einmal über der ursprünglichen Spanne eingestellt?" Ja/Nein ist fast immer beantwortbar und liefert 80 % des Werts. |
| Zielfeld | `intake_payload.salary_ceiling_behaviour (Spalte fehlt in PROD, 42703). Heute landet die Antwort als Fließtext in jobs.briefing_notes (BEWIESEN JobIntakeStudio.tsx:347) und ist für kein Matching lesbar.` |
| Folgefragen | – Bei "intern durchbekommen": Wer müsste zustimmen — und wie lange dauert das erfahrungsgemäß?<br>– Bei "das entscheide nicht ich": Wer entscheidet über das Gehalt? (führt zu UE-03)<br>– Bei "wirklich fix": Wenn wir bei diesem Deckel bleiben — welches Ihrer Muss-Kriterien dürfen wir dafür lockern? (führt zu UE-10) |
| Widerspruchsregel | Wenn "wirklich fix" UND (Anzahl Muss-Kriterien ≥ 6 ODER Erfahrungslevel Senior/Lead): Spannungshinweis mit konkreter Wahl — "Festes Maximum plus {n} Muss-Kriterien schließen sich erfahrungsgemäß aus. Sie haben zwei Hebel: Deckel anheben oder zwei Kriterien lockern. Welchen möchten Sie?" |
| Starke Antwort | "Bis 95.000 entscheide ich allein. Darüber brauche ich die Geschäftsführung, das dauert etwa eine Woche und ich bekomme es bei einem starken Profil durch." |
| Schwache Antwort | "Wir sind da flexibel." / "Marktüblich." (N5-Floskel) |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter verhandelt blind und verliert den Kandidaten im Endspurt an ein Angebot, das 5.000 € höher lag — nach acht Wochen Arbeit. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `UE-03` · Wer muss TATSÄCHLICH zustimmen, bevor ein Vertrag rausgeht. Ersetzt CJ-27 und IB-29 — beide fragen abstrakt nach Anzahl bzw. Gremium, laden zur sozial erwünschten Antwort

> **„Wenn wir Ihnen nächste Woche die perfekte Person vorstellen — wer muss zustimmen, bevor ein Vertrag rausgehen kann?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl |
| Optionen | Nur ich · Ich und meine Führungskraft · Fachbereich und Personalabteilung gemeinsam · Die Geschäftsführung · Ein Gremium oder der Betriebsrat muss mit |
| Trigger | Immer, im Prozess-Block. Vor der ersten Kandidatenvorstellung zwingend beantwortet. |
| Uebersprungen wenn | Aus einem früheren Job desselben Ansprechpartners bekannt und seither keine Rollenänderung — dann bestätigen lassen. |
| „Weiss ich nicht“ | Hier praktisch ausgeschlossen. Falls doch: N4(c), Termin statt Antwort. |
| Zielfeld | `jobs.decision_makers (NEU) + jobs.decision_maker_informed (bool). Heute: BEWIESEN kein Zielfeld — CJ-27 geht beim Speichern verloren (CreateJob.tsx:619-668), IB-29 wird nur serialisiert.` |
| Folgefragen | – Bei allem außer "Nur ich": Weiß diese Person bereits, dass gesucht wird?<br>– Bei "Gremium/Betriebsrat": Wann tagt das nächste Mal? |
| Widerspruchsregel | Wenn "Gremium/Betriebsrat" oder "Geschäftsführung" UND Dringlichkeit "sehr dringend (<4 Wochen)": Hinweis, dass die genannte Frist mit dieser Freigabekette erfahrungsgemäß nicht haltbar ist, und Rückfrage, welche der beiden Angaben angepasst werden soll. |
| Starke Antwort | "Ich entscheide fachlich, aber das Angebot unterschreibt der Bereichsleiter. Der ist informiert und reagiert innerhalb von zwei Tagen." |
| Schwache Antwort | "Im Prinzip ich." — "Im Prinzip" ist das Signalwort für eine verdeckte zweite Instanz. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter optimiert auf den falschen Ansprechpartner, das Angebot verzögert sich um Wochen an einer Freigabestufe, von der niemand wusste. |
| Zweck / Sensitivitaet | Prozess · normal |

#### `UE-04` · Wie lange läuft die Suche schon und mit welchen Mitteln. Trennt Marktproblem von Prozessproblem von Geldproblem — die wichtigste Weichenstellung der Suchstrategie. Im heu

*Damit wir nicht dieselbe Runde noch einmal drehen.*

> **„Wie lange suchen Sie diese Person schon — und was haben Sie bisher schon probiert?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Mehrfachauswahl (Kanäle) |
| Optionen | Die Suche ist ganz neu · Seit ein bis drei Monaten · Seit drei bis sechs Monaten · Seit über einem halben Jahr |
| Trigger | Immer, früh — direkt nach UE-01. Steuert die gesamte Suchstrategie. |
| Uebersprungen wenn | Nie überspringen. Auch "ganz neu" ist eine wertvolle Antwort. |
| „Weiss ich nicht“ | Bei einem neuen Ansprechpartner realistisch: N2-Nachfrage "Seit wann ist die Stelle denn ungefähr offen?" — Zeitraum genügt. |
| Zielfeld | `jobs.search_started_at + intake_payload.previous_channels (beide NEU/fehlend in PROD)` |
| Folgefragen | – Wenn nicht neu: Über welche Wege lief die Suche bisher? (eigene Anzeige / Personalabteilung intern / anderer Personalberater / eigenes Netzwerk / direkte Ansprache)<br>– Wenn nicht neu: weiter mit UE-05 |
| Widerspruchsregel | Wenn "über ein halbes Jahr" UND Gehaltsmaximum unverändert UND Muss-Kriterien ≥ 5: klarer Hinweis, dass die bisherige Kombination am Markt nachweislich nicht funktioniert hat, und Wahl anbieten (Budget, Kriterien oder Region). |
| Starke Antwort | "Seit fünf Monaten. Erst eigene Anzeige, dann eine Personalberatung, die hat drei Profile geschickt, alle zu junior." |
| Schwache Antwort | "Schon eine Weile." |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter spricht dieselben Personen an, die vor vier Monaten schon abgesagt haben. Bei den Kandidaten verbrennt das den Kunden dauerhaft. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `UE-05` · Woran die bisherige Suche konkret gescheitert ist. Die diagnostisch wertvollste Antwort im gesamten Briefing — sie sagt, ob wir ein Sichtbarkeits-, Qualitäts-, Geld- oder

*Kein Vorwurf, im Gegenteil: Wenn ich das weiß, spare ich Ihnen die ersten vier Wochen.*

> **„Woran ist es bisher gescheitert — kamen zu wenige Leute, oder passten die, die kamen, nicht?“**

| | |
|---|---|
| Antworttyp | Mehrfachauswahl + Freitext |
| Optionen | Es haben sich kaum Leute gemeldet · Genug Bewerbungen, aber fachlich zu schwach · Fachlich passend, aber beim Gehalt lagen wir auseinander · Wir hatten jemanden, der hat am Ende abgesagt · Wir waren uns intern nicht einig · Es hat schlicht zu lange gedauert |
| Trigger | Nur wenn UE-04 ≠ "ganz neu". |
| Uebersprungen wenn | UE-04 = "ganz neu". |
| „Weiss ich nicht“ | N4(a) plausibel, wenn die Personalabteilung gesucht hat: "Wer hatte die Suche bisher in der Hand? Ich frage dort einmal nach." |
| Zielfeld | `intake_payload.previous_failure_reason (fehlt in PROD, 42703)` |
| Folgefragen | – Bei "jemand hat abgesagt": weiter mit UE-06<br>– Bei "intern nicht einig": weiter mit UE-09<br>– Bei "kaum jemand gemeldet": Wo haben Sie ausgeschrieben? |
| Widerspruchsregel | Bei "fachlich zu schwach" gleichzeitig prüfen, ob das genannte Muss-Kriterium mit dem Gehalt am Markt überhaupt zu haben ist, und das als konkreten Zielkonflikt anzeigen. |
| Starke Antwort | "Genug Bewerbungen, aber niemand hatte SAP FI produktiv gemacht — nur Berührung damit. Und zwei sind beim Gehalt abgesprungen." |
| Schwache Antwort | "Es war einfach niemand Passendes dabei." — beschreibt das Ergebnis, nicht die Ursache. |
| Wenn die Antwort fehlt | ABGELEITET: Die neue Suche wiederholt die alte. Der Kunde erlebt dasselbe Ergebnis und verliert das Vertrauen in die Plattform, obwohl die Ursache im Profil oder im Budget lag. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `UE-06` · Der echte Absagegrund eines Kandidaten, der schon einmal kurz vor Abschluss stand. Die ehrlichste verfügbare Marktrückmeldung über den Kunden — und Direktmaterial für die

> **„Sie hatten jemanden, der abgesagt hat — was hat die Person als Grund genannt?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext |
| Optionen | Das Gehalt · Ein anderes Angebot war schneller · Die Aufgabe war doch nicht das, was erwartet wurde · Standort oder Homeoffice-Regelung · Der Ablauf hat zu lange gedauert · Es wurde kein Grund genannt |
| Trigger | Nur wenn UE-05 = "Wir hatten jemanden, der hat am Ende abgesagt". |
| Uebersprungen wenn | UE-05 enthält keine Absage. |
| „Weiss ich nicht“ | N4(b) sehr wahrscheinlich — hier wird ungern zitiert. Nachfrage nach N2: "Auch nur Ihr Eindruck hilft mir: eher Geld, eher Aufgabe, oder eher Tempo?" |
| Zielfeld | `intake_payload.last_rejection_reason (fehlt in PROD, 42703)` |
| Folgefragen | – Bei "kein Grund genannt": Was war Ihr eigener Eindruck, woran es lag?<br>– Bei "Aufgabe nicht wie erwartet": Was hatte die Person anders verstanden? (fließt direkt in die Anzeigenschärfung) |
| Widerspruchsregel | Wenn der Absagegrund eine Rahmenbedingung war, die unverändert bleibt (Homeoffice, Standort, Gehalt): unmissverständlich benennen, dass dieselbe Absage wieder eintreten wird, und fragen, was sich diesmal ändern kann. |
| Starke Antwort | "Sie hatte parallel ein Angebot mit vier Tagen Homeoffice. Wir konnten nur zwei bieten, das war der Punkt." |
| Schwache Antwort | "Passte nicht." |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter läuft in exakt dieselbe Absage. Ein bekannter Absagegrund ist im Pitch neutralisierbar, ein unbekannter nicht. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `UE-07` · Ob eine bestehende Person ersetzt wird und ob sie davon weiß. Bestimmt Vertraulichkeitsgrad, Ausschreibbarkeit und Reveal-Regeln. Heute nur indirekt über den Chip "Ablösu

*Kurz zur Vertraulichkeit — davon hängt ab, wie offen wir suchen dürfen.*

> **„Ist die Position aktuell noch besetzt?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl |
| Optionen | Nein, die Stelle ist frei · Ja, und die Person weiß Bescheid · Ja, und die Person weiß es noch nicht · Ja, sie wechselt intern auf eine andere Stelle |
| Trigger | Immer, direkt nach dem Grund der Vakanz. |
| Uebersprungen wenn | Grund der Vakanz = "neu geschaffen" oder "Wachstum". |
| „Weiss ich nicht“ | Praktisch ausgeschlossen. Falls doch, defensiv als vertraulich behandeln. |
| Zielfeld | `jobs.confidential (bool) + jobs.incumbent_aware (NEU). WICHTIG: nur den Zustand speichern, NIEMALS Name oder Merkmale der bestehenden Person — das wären Daten über eine dritte Person, die kein Recruiter sehen darf.` |
| Folgefragen | – Bei "weiß es noch nicht": weiter mit UE-08 (Vertraulichkeitsradius) — und Hinweis, dass die Stelle dann nicht öffentlich sichtbar geschaltet wird.<br>– Bei "weiß Bescheid": Dürfen wir mit der Person über die Aufgabe sprechen? Sie kann sie am besten beschreiben. |
| Widerspruchsregel | Bei "weiß es noch nicht": Vertraulichkeitsmodus erzwingen — kein öffentlicher Aushang, kein Firmenname gegenüber Recruitern, keine Ansprache im direkten Umfeld des Kunden. Der Kunde bestätigt diesen Modus ausdrücklich. |
| Starke Antwort | "Ja, der Kollege ist noch da und weiß es nicht. Außer mir und der Geschäftsführung weiß niemand von der Suche." |
| Schwache Antwort | "Das ist gerade in Klärung." — bis zur Klärung als vertraulich behandeln. |
| Wenn die Antwort fehlt | ABGELEITET: Die Stelle wird öffentlich sichtbar oder in der Branche des Kunden angesprochen — der Amtsinhaber erfährt aus dem Markt von seiner Ablösung. Größter Reputations- und Rechtsschaden, den dieser Prozess erzeugen kann. |
| Zweck / Sensitivitaet | Prozess · DSGVO-relevant |

#### `UE-08` · Wie eng der Kreis der Mitwissenden ist. Bestimmt, an wen der Recruiter überhaupt Fragen stellen darf und ob Referenzen möglich sind.

> **„Wer in Ihrem Haus darf von dieser Suche wissen?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl |
| Optionen | Das ist kein Geheimnis · Nur die Geschäftsführung und ich · Nur ich |
| Trigger | Nur wenn UE-07 = "Person weiß es noch nicht" ODER der Kunde den anonymen Firmenbeschreiber als zu verräterisch abgelehnt hat. |
| Uebersprungen wenn | UE-07 = "Stelle ist frei" und kein Vertraulichkeitswunsch geäußert. |
| „Weiss ich nicht“ | Defensiv auf den engsten Kreis setzen. |
| Zielfeld | `jobs.confidentiality_scope (NEU)` |
| Folgefragen | – Bei "Nur ich": An welche Adresse und Telefonnummer dürfen wir uns wenden — und in welchem Zeitfenster? |
| Widerspruchsregel | Bei "Nur ich": alle automatischen Benachrichtigungen an weitere Personen des Unternehmens abschalten. |
| Starke Antwort | "Nur die Geschäftsführerin und ich. Bitte schreiben Sie mir nicht an die Firmenadresse." |
| Schwache Antwort | "Ach, das ist nicht so streng." |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter ruft in der Personalabteilung an, die von der Suche nichts weiß. Vertrauensbruch in einem Anruf. |
| Zweck / Sensitivitaet | Prozess · DSGVO-relevant |

#### `UE-09` · Interne Uneinigkeit über das Profil — vor der ersten Vorstellung, nicht danach. Bewusst NICHT als Konfliktfrage formuliert ("Gibt es Meinungsverschiedenheiten?" lädt zum 

*Das ist bei fast jeder Suche so — und es ist der häufigste Grund, warum gute Kandidaten in der zweiten Runde durchfallen.*

> **„Wenn Sie und die anderen Beteiligten jeweils Ihre Wunschperson beschreiben würden — wo würden sich die Beschreibungen am ehesten unterscheiden?“**

| | |
|---|---|
| Antworttyp | Mehrfachauswahl + Freitext |
| Optionen | Beim fachlichen Schwerpunkt · Bei der Seniorität · Bei der Frage, ob Führungserfahrung nötig ist · Bei der Branchenherkunft · Beim Gehalt · Wir würden ziemlich dasselbe beschreiben |
| Trigger | Immer, wenn UE-03 ≠ "Nur ich". |
| Uebersprungen wenn | UE-03 = "Nur ich". |
| „Weiss ich nicht“ | N4(b): "Dann anders gefragt — beim letzten Kandidaten, den Sie gut fanden: waren sich alle einig?" |
| Zielfeld | `intake_payload.internal_alignment_gap (fehlt in PROD, 42703)` |
| Folgefragen | – Bei genannter Differenz: Wessen Sicht gibt am Ende den Ausschlag? |
| Widerspruchsregel | Die Option "Wir würden ziemlich dasselbe beschreiben" steht bewusst ZULETZT und ist nicht vorausgewählt — sie darf nicht als bequemer Anker wirken. |
| Starke Antwort | "Der Fachbereich will jemanden, der selbst programmiert. Ich hätte lieber jemanden, der das Team führt. Am Ende entscheidet der Fachbereich." |
| Schwache Antwort | "Wir sind uns völlig einig." — bei drei Beteiligten fast nie zutreffend; einmal nachfassen nach N1. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter liefert auf das Profil des Ansprechpartners und der Fachbereich lehnt ab. Der Recruiter hält es für einen eigenen Fehler und stellt das Suchbild um — obwohl das Suchbild nie abgestimmt war. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `UE-10` · Welches Muss-Kriterium wirklich hart ist. Ersetzt den Dreistufen-Schalter PS-13 ("fix / verhandelbar / flexibel"), der abstrakt ist und BEWIESEN nicht gespeichert wird (V

> **„Von Ihren Muss-Kriterien: Welches würden Sie fallen lassen, wenn die Person Sie in allem anderen überzeugt?“**

| | |
|---|---|
| Antworttyp | Mehrfachauswahl aus den eigenen Muss-Kriterien |
| Optionen | (dynamisch: die vom Kunden genannten Muss-Kriterien) · Keines davon |
| Trigger | Immer, sobald mindestens drei Muss-Kriterien erfasst sind. |
| Uebersprungen wenn | Weniger als drei Muss-Kriterien. |
| „Weiss ich nicht“ | N4(c): "Kein Problem — wir schicken Ihnen bewusst ein Profil, dem ein Kriterium fehlt. An Ihrer Reaktion sehen wir es dann gemeinsam." Das ist die ehrlichste Form der Kalibrierung. |
| Zielfeld | `job_skill_requirements.weight (Tabelle existiert in PROD, BEWIESEN REST 200) — die Verhandelbarkeit gehört genau hierhin, nicht in intake_payload.` |
| Folgefragen | – Bei "Keines davon" und mindestens sechs Kriterien: "Dann ist die Suche sehr eng. Sollen wir mit dieser Enge starten und nach vier Wochen gemeinsam draufschauen?"<br>– Bei gewähltem Kriterium: "Und was müsste die Person stattdessen mitbringen, damit das Fehlen nicht auffällt?" |
| Widerspruchsregel | Bei "Keines davon" und ≥ 6 Kriterien: nicht argumentieren, sondern die Enge dokumentieren und einen festen Überprüfungszeitpunkt nach vier Wochen setzen. Widerspruch erzeugt Trotz, ein Termin erzeugt Lernbereitschaft. |
| Starke Antwort | "Das Studium ist verzichtbar, wenn die Person zehn Jahre praktisch drin ist. Die Sprache nicht — ohne Deutsch geht es im Team nicht." |
| Schwache Antwort | "Alle sind wichtig." |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter behandelt alle Kriterien als gleich hart, filtert starke Kandidaten an einem weichen Punkt weg und liefert eine leere Liste. |
| Zweck / Sensitivitaet | Matching · normal |

#### `UE-11` · Die unattraktiven Rahmenbedingungen. Ersetzt IB-27, die drei methodische Fehler hat: das Wort "Ehrlich:" unterstellt, die bisherigen Antworten seien es nicht; die Frage v

*Das ist keine Fangfrage. Wer das früh sagt, bekommt Kandidaten, die genau deshalb später nicht abspringen.*

> **„Wenn jemand die Stelle annimmt und nach sechs Monaten wieder kündigt — was wäre der wahrscheinlichste Grund?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext |
| Optionen | Die Aufgabe war operativer als erwartet · Zu wenig Struktur, sehr viel Baustelle · Viele Abstimmungen, langsame Entscheidungen · Alte Systeme und technische Altlasten · Der Führungsstil im Haus · Die Arbeitsbelastung |
| Trigger | Immer, im Block "Was Kandidaten wissen müssen". |
| Uebersprungen wenn | Nie überspringen. |
| „Weiss ich nicht“ | N4(d) am häufigsten — die Antwort kommt als Verneinung. Nachfrage nach N2: "Dann anders: Was war der Grund, aus dem zuletzt jemand aus dem Team gegangen ist?" Vergangenes Verhalten statt Hypothese. |
| Zielfeld | `intake_payload.honest_downside (fehlt in PROD, 42703). ACHTUNG: IB-27 verspricht heute im UI, die Antwort bleibe "recruiter-intern" — ABGELEITET ist das unbelegt, denn briefing_notes ist eine gewöhnliche jobs-Spalte. Entweder die Trennung wird technisch hergestellt oder das Versprechen muss aus dem Text.` |
| Folgefragen | – Immer im Anschluss: UE-12 (N7-Reparatur) |
| Widerspruchsregel | Keine Option ohne Inhalt anbieten. Wenn der Kunde dennoch verneint, EINMAL nachfassen (N1) und dann akzeptieren — aber intern als ungeklärt vermerken, nicht als "keine Schattenseite". |
| Starke Antwort | "Wir haben eine sehr alte Systemlandschaft. Wer aus einem modernen Umfeld kommt, findet das im dritten Monat frustrierend." |
| Schwache Antwort | "Eigentlich gibt es keinen Grund." |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter verkauft ein Bild, das der Kandidat im zweiten Gespräch korrigiert bekommt. Absprung nach der Vorstellung — der teuerste Zeitpunkt für alle drei Seiten. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `UE-12` · Was die Bleibenden hält. Doppelter Zweck: liefert das Gegengewicht zur Schattenseite für die Ansprache UND stellt nach der selbstkritischen Antwort aus UE-11 die Gespräch

> **„Und was hält die, die bleiben?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext |
| Optionen | Die Kollegen und das Team · Die Freiheit, selbst zu entscheiden · Die fachliche Aufgabe selbst · Sicherheit und Verlässlichkeit · Die Entwicklungsmöglichkeiten · Die Bezahlung |
| Trigger | Immer direkt nach UE-11, ohne Zwischenschritt. |
| Uebersprungen wenn | Nie — auch methodisch nicht, das ist die Reparaturfrage. |
| „Weiss ich nicht“ | Selten. Dann: "Wer ist am längsten im Team, und warum ist die Person geblieben?" |
| Zielfeld | `intake_payload.retention_driver (fehlt in PROD, 42703)` |
| Folgefragen | – Bei genannter Antwort: "Woran würde ein Außenstehender das merken?" — verwandelt die Nennung in ein erzählbares Beispiel. |
| Widerspruchsregel | Wenn hier eine Floskel kommt, EINMAL konkretisieren lassen (N5), dann akzeptieren. |
| Starke Antwort | "Zwei aus dem Team sind seit über zehn Jahren da. Beide sagen, es ist die Freiheit — es redet ihnen niemand rein." |
| Schwache Antwort | "Das gute Betriebsklima." (N5-Floskel) |
| Wenn die Antwort fehlt | ABGELEITET: Der anonyme Pitch besteht aus Aufgabenbeschreibung und Gehalt — austauschbar mit jeder anderen Anzeige. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `UE-13` · Das reale Kaufargument, belegt durch einen tatsächlichen Fall statt durch Selbstbeschreibung. Ersetzt IB-25, deren Chips ("Greenfield / Autonomie", "Mission / Impact") re

> **„Die letzte Person, die Sie für Ihr Team gewonnen haben: Was hat am Ende den Ausschlag gegeben, dass sie zugesagt hat?“**

| | |
|---|---|
| Antworttyp | Freitext + optionale Chips |
| Optionen | Die konkrete Aufgabe · Die Führungskraft · Das Gehalt · Die Flexibilität · Die Perspektive · Wir haben zuletzt niemanden eingestellt |
| Trigger | Immer, direkt nach UE-12. |
| Uebersprungen wenn | Nie überspringen — liefert das einzige nicht-werbliche Verkaufsargument im ganzen Briefing. |
| „Weiss ich nicht“ | N4(a): "Wer war die letzte Einstellung? Wenn Sie mögen, fragen wir die Person selbst — das ist die beste Quelle, die es gibt." |
| Zielfeld | `intake_payload.proven_selling_point (fehlt in PROD, 42703)` |
| Folgefragen | – Bei "zuletzt niemanden eingestellt": "Und bei Ihnen selbst — warum sind Sie damals gekommen?" |
| Widerspruchsregel | Wenn die Antwort ausschließlich "Gehalt" ist UND das Budget als fix angegeben wurde (UE-02): Hinweis, dass das einzige belegte Argument gerade nicht verfügbar ist. |
| Starke Antwort | "Sie kam von einem Konzern und wollte endlich selbst entscheiden dürfen. Bei uns hat sie ab dem ersten Tag ihr eigenes Budget." |
| Schwache Antwort | "Das Gesamtpaket hat gepasst." |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter spricht mit Werbeworten an, auf die niemand reagiert. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `UE-14` · Die tatsächliche Reaktionsgeschwindigkeit, gemessen an vergangenem Verhalten statt an Selbsteinschätzung. Ersetzt die reine Dringlichkeitsangabe CJ-26/CJ-22 (deren Werteb

*Kandidaten entscheiden sich fast immer für den, der zuerst zurückruft. Deshalb frage ich nach Tagen, nicht nach Absicht.*

> **„Beim letzten Mal, als Ihnen ein Lebenslauf gefallen hat — wie viele Tage lagen zwischen dem Lebenslauf und dem ersten Gespräch?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl |
| Optionen | Noch in derselben Woche · Ein bis zwei Wochen · Drei bis vier Wochen · Länger · Wir haben zuletzt nicht eingestellt |
| Trigger | Immer, im Prozess-Block. |
| Uebersprungen wenn | Nie überspringen. |
| „Weiss ich nicht“ | N4(a) plausibel: "Ungefähr genügt — eher Tage oder eher Wochen?" |
| Zielfeld | `intake_payload.historical_time_to_interview (fehlt in PROD, 42703)` |
| Folgefragen | – Bei drei Wochen oder länger: "Woran lag das — Terminfindung, Abstimmung oder Urlaub?"<br>– Bei drei Wochen oder länger: "Können Sie für diese Suche zwei feste Zeitfenster pro Woche reservieren?" |
| Widerspruchsregel | Wenn die reale Zeit ≥ drei Wochen betrug UND Dringlichkeit "sehr dringend": beide Angaben nebeneinander zeigen und um Auflösung bitten — ohne Bewertung, nur als Widerspruch. |
| Starke Antwort | "Ehrlich gesagt drei Wochen — mein Kollege war im Urlaub. Diesmal blocke ich Dienstag- und Donnerstagvormittag." |
| Schwache Antwort | "Bei uns geht das immer schnell." |
| Wenn die Antwort fehlt | ABGELEITET: Die selbstberichtete Dringlichkeit "sehr dringend" steuert das Sourcing-Tempo, während die reale Rückmeldezeit bei drei Wochen liegt. Der Recruiter liefert schnell, verliert die Kandidaten an der Wartezeit und hält es für ein Kandidatenproblem. |
| Zweck / Sensitivitaet | Prozess · sensibel |

#### `UE-15` · Parallele Suchen und bereits gesehene Kandidaten. Verhindert Doppelvorstellungen mit Honorarstreit und verhindert, dass ein Kandidat zweimal auf dieselbe Stelle angesproc

*Völlig üblich. Für uns ist nur wichtig, dass wir Ihnen niemanden vorstellen, den Sie schon kennen.*

> **„Suchen für diese Stelle aktuell noch andere — Ihre Personalabteilung oder weitere Personalberater?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl |
| Optionen | Nein, nur über Sie · Ja, intern läuft parallel eine Suche · Ja, ein weiterer Dienstleister · Ja, mehrere Dienstleister |
| Trigger | Immer, vor der ersten Kandidatenvorstellung. |
| Uebersprungen wenn | Nie überspringen. |
| „Weiss ich nicht“ | Bei einem Ansprechpartner, der nicht aus der Personalabteilung kommt, realistisch: "Fragen Sie das bitte einmal intern nach — sonst stellen wir Ihnen jemanden vor, den Sie schon abgelehnt haben." |
| Zielfeld | `jobs.parallel_search (NEU) + Sperrliste bereits gesehener Kandidaten` |
| Folgefragen | – Wenn nicht "nur über Sie": "Gibt es Personen, die Sie bereits gesehen haben und die wir nicht noch einmal vorstellen sollen?" |
| Widerspruchsregel | Bei mehreren parallelen Wegen: Sperrliste zwingend anlegen, bevor der erste Recruiter startet. |
| Starke Antwort | "Unsere Personalabteilung hat die Anzeige laufen. Vier Bewerbungen bisher, alle abgelehnt — die Namen schicke ich Ihnen." |
| Schwache Antwort | "Nicht, dass ich wüsste." |
| Wenn die Antwort fehlt | ABGELEITET: Doppelvorstellung derselben Person durch zwei Wege. Der Kandidat verliert das Vertrauen, der Kunde bekommt eine Honorarfrage, die niemand sauber lösen kann. |
| Zweck / Sensitivitaet | Vertrag · sensibel |

#### `UE-16` · Unternehmen, bei denen nicht angesprochen werden darf. Ersetzt IB-32, deren Formulierung "No-Poach" ein Fachbegriff ist, den ein Fachbereichsleiter nicht kennt. BEWIESEN:

> **„Bei welchen Unternehmen sollen wir auf keinen Fall ansprechen — zum Beispiel Kunden, Partner oder Firmen, mit denen Sie eine Vereinbarung haben?“**

| | |
|---|---|
| Antworttyp | Einfachauswahl + Freitext-Liste |
| Optionen | Keine Einschränkung · Unsere Kunden und Partner · Bestimmte Unternehmen (bitte eintragen) |
| Trigger | Immer, im Sourcing-Block. |
| Uebersprungen wenn | Wenn im Firmenprofil bereits eine Ausschlussliste hinterlegt ist: nur bestätigen lassen, nicht neu erheben. |
| „Weiss ich nicht“ | N4(a): "Wer im Haus hätte die Kundenliste? Wir starten so lange ohne Ihre direkten Wettbewerber." |
| Zielfeld | `jobs.nogo_companies (BEWIESEN: Spalte fehlt in PROD, REST 42703). Bis zur Migration darf diese Frage nicht gestellt werden — eine Zusage, die nirgends ankommt, ist schlimmer als keine Frage.` |
| Folgefragen | – Bei "Kunden und Partner": "Können Sie mir die wichtigsten fünf nennen? Den Rest klären wir im Einzelfall." |
| Widerspruchsregel | Bewusst nur nach der LISTE fragen, nicht nach dem Grund einer Vereinbarung. Der Grund verbessert keine einzige Entscheidung im Prozess und kann für den Kunden heikel sein — wir erheben ausschließlich, was wir operativ brauchen. |
| Starke Antwort | "Unsere drei größten Kunden sind tabu: A, B, C. Bei Wettbewerbern gerne — da wollen wir sogar gezielt hin." |
| Schwache Antwort | "Eigentlich keine." |
| Wenn die Antwort fehlt | ABGELEITET: Ein Recruiter spricht bei einem Großkunden des Auftraggebers an. Geschäftsschaden weit über dem Honorar. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

**Beispieldialog**

```
— Auszug aus der Jobaufnahme, Rolle „Leiter Instandhaltung", Kunde: Fertigungsbetrieb, ca. 400 Mitarbeiter —

BERATER (UE-01): Eine kurze Formalie vorweg — davon hängt ab, ob wir sofort loslegen oder besser noch zwei Wochen warten. Ist die Stelle bei Ihnen intern schon freigegeben und das Budget eingeplant?
KUNDE: Ja, die ist durch. Steht so im Personalplan.
BERATER: Perfekt, dann können wir starten.

BERATER (UE-04): Damit wir nicht dieselbe Runde noch einmal drehen — wie lange suchen Sie diese Person schon, und was haben Sie bisher probiert?
KUNDE: Ach, das läuft schon eine Weile.
  ▸ AUSWEICHTYP (d): Scheinantwort. Regel N2 — die Nachfrage verkleinert die Frage, sie wiederholt sie nicht.
BERATER (Nachfrage): Ungefähr genügt mir völlig — eher seit dem Frühjahr oder eher seit letztem Jahr?
KUNDE: Seit Februar. Wir hatten erst eine Anzeige laufen, dann hat es eine Personalberatung versucht. Drei Profile, alle nicht das, was wir brauchen.

BERATER (UE-05): Woran ist es gescheitert — kamen zu wenige Leute, oder passten die, die kamen, nicht?
KUNDE: Es war einfach niemand Passendes dabei.
  ▸ AUSWEICHTYP (d): beschreibt das Ergebnis, nicht die Ursache. Regel N1 — genau eine Nachfrage, und sie bietet zwei konkrete Ursachen zur Wahl an, statt offen zu bleiben.
BERATER (Nachfrage): Wenn Sie an das beste der drei Profile denken — fehlte da eher die Fachtiefe, oder lagen Sie beim Gehalt auseinander?
KUNDE: Die Fachtiefe. Keiner hatte je eine eigene Instandhaltung geleitet, das waren alles Meister ohne Führungsverantwortung. Und der Beste wollte 95.000.

BERATER (UE-02): Da hake ich kurz ein, denn genau das entscheidet später über die Zusage — und es bleibt zwischen uns. Angenommen, wir finden genau die Person, die Sie beschrieben haben, und sie sagt, sie wechselt nur für rund zehn Prozent mehr als Ihre 85.000. Was passiert dann?
KUNDE: Wir sind da flexibel.
  ▸ AUSWEICHTYP (b/d): „flexibel" steht auf der Floskelliste (N5). Nicht als Zusage werten. Regel N6 — die Nachfrage nennt die Konsequenz, nicht den Vorwurf, und fragt nach vergangenem Verhalten statt nach einer Absicht.
BERATER (Nachfrage): Das glaube ich Ihnen — nur kann ich mit „flexibel" am Telefon nicht verhandeln, und dann verlieren wir die Person an jemanden, der eine Zahl nennen konnte. Deshalb anders gefragt: Haben Sie in den letzten zwei Jahren schon einmal über der ursprünglichen Spanne eingestellt?
KUNDE: … Einmal, ja. Da sind wir auf 92.000 hoch. Aber das musste ich beim Geschäftsführer durchboxen, das hat drei Wochen gedauert.
  ▸ ERGEBNIS: Verhandelbare Decke ≈ 92.000, Freigabestufe = Geschäftsführung, Vorlaufzeit ≈ 3 Wochen. Alle drei Angaben sind operativ verwertbar. „Wir sind flexibel" war keine davon.
BERATER: Das ist genau, was ich wissen musste. Dann planen wir die drei Wochen von vornherein mit ein, statt am Ende überrascht zu werden.

BERATER (UE-10): Sie haben sieben Muss-Kriterien genannt. Welches würden Sie fallen lassen, wenn die Person Sie in allem anderen überzeugt?
KUNDE: Eigentlich keines, die brauchen wir alle.
  ▸ AUSWEICHTYP (c): keine Ausweichung im engeren Sinn, sondern eine nicht getroffene Entscheidung. Regel N10 gilt nicht — nicht argumentieren. Stattdessen Termin statt Widerspruch.
BERATER (Nachfrage): Verstanden, dann starten wir mit allen sieben. Ich sage Ihnen nur ehrlich, was das bedeutet: Ihre bisherige Suche lief mit diesen Kriterien acht Monate. Machen wir Folgendes — wir suchen vier Wochen streng nach Ihrer Liste, und ich zeige Ihnen danach, wie viele Personen es im Umkreis überhaupt gab. Dann entscheiden Sie mit Zahlen statt mit Bauchgefühl. Einverstanden?
KUNDE: Ja, so machen wir das. Und ehrlich gesagt — die Zertifizierung wäre vermutlich verzichtbar, wenn der Rest sitzt.
  ▸ Die Antwort kommt, sobald der Kunde sie nicht als Niederlage erlebt. Genau dafür ist Regel N6 da.

BERATER (UE-11): Noch eine Frage, die unangenehm klingt, aber keine Fangfrage ist: Wer sie früh beantwortet, bekommt Kandidaten, die deshalb später nicht abspringen. Wenn jemand die Stelle annimmt und nach sechs Monaten wieder kündigt — was wäre der wahrscheinlichste Grund?
KUNDE: Bei uns geht eigentlich niemand.
  ▸ AUSWEICHTYP (d). Regel N2 — von der Hypothese auf ein konkretes vergangenes Ereignis umschalten.
BERATER (Nachfrage): Dann anders: Der Kollege, der die Stelle zuletzt hatte — warum ist der gegangen?
KUNDE: Der ist zum Wettbewerber. Ihm war die Anlagentechnik zu alt, ehrlich gesagt. Wir schieben die Modernisierung seit Jahren vor uns her.
BERATER (UE-12, direkt im Anschluss — Regel N7): Danke, das ist wertvoll, damit kann ich arbeiten. Und was hält die, die bleiben?
KUNDE: Die Leute. Wir haben Schichtführer, die seit zwanzig Jahren da sind. Und man kann bei uns wirklich entscheiden, da redet niemand rein.
  ▸ Innerhalb von zwei Fragen liegen jetzt beide Hälften der Ansprache vor: das ehrliche Risiko (alte Anlagen) und das belastbare Gegenargument (Entscheidungsfreiheit, stabile Mannschaft). Ohne die Reparaturfrage bliebe nur die Hälfte — und der Kunde ginge mit dem Gefühl aus dem Gespräch, sich schlechtgeredet zu haben.
```


---

### Sourcing-Wirksamkeit

**Rollenfamilie:** übergreifend · **Cards:** 16

> **Kernthese:** Die heutige Jobaufnahme erzeugt keine Suche, sondern eine Stellenanzeige. Drei Befunde tragen das: (1) BEWIESEN — jede der 34 statischen Briefing-Antworten landet in jobs.briefing_notes, aber recruiter_jobs_view kennt diese Spalte nicht (REST 42703), kein einziges Recruiter-Frontend liest sie (grep: nur JobApprovalDialog, JobsList, ClientJobDetail, BriefingNotesDialog), und die deployte Funktion format-job-for-recruiters (POST 400 = deployed) übergibt sie dem Formatierer nie. Der Headhunter, der sourcen soll, sieht also Zielfirmen, Tabu-Firmen, Anti-Profil und Pitch-Story NICHT. (2) BEWIESEN — die drei K.O.-Spalten, die der LIVE-Matcher als Hard Kill liest, existieren in PROD (jobs.required_languages, jobs.onsite_required, jobs.required_certifications → REST 200), werden aber von KEINEM Aufnahmepfad geschrieben; JobIntakeStudio.tsx:377-379 legt sie in intake_payload.typed_extras ab, und intake_payload existiert in PROD nicht (42703). Der Sprach-K.O. feuert damit nie. (3) ABGELEITET — calculate-match-v3-1 ist deployed (POST 400), lädt Jobs mit select('*') (Zeile 641), hard_kill_defaults.visa_required ist per Default true (Zeile 735), und jobs.visa_sponsorship fehlt (42703). In evaluateHardKills (Zeile 916) ist !job.visa_sponsorship damit immer true — jeder Kandidat mit visa_required wird auf JEDEM Job still gekillt. Der gesamte Nicht-EU-Pool ist strukturell ausgeschlossen, und keine Kundenantwort kann das heute ändern. Konsequenz für Sourcing: Der Recruiter bekommt Titel, Gehaltsband und eine kommagetrennte Skill-Liste — und muss das Suchbild selbst erfinden. Was fehlt, ist nicht Tiefe, sondern Übersetzbarkeit: Titel-Synonyme, Zielfirmen als Namen, Radius, Branchennähe, Umfeld-Herkunft und ein Wechselmotiv. Ohne diese sechs Angaben ist keine belastbare Suchhypothese formulierbar. Empfehlung: EINE Migration (jobs.sourcing_brief jsonb + Aufnahme in recruiter_jobs_view) plus das Beschreiben der drei bereits existierenden K.O.-Spalten macht alle 16 Karten unten sofort wirksam — ohne den Matcher anzufassen.


#### `S-01` · Titel-Synonyme und Bezeichnungsvarianten im DACH-Raum, um überhaupt eine Boolesche Suchzeile bauen zu können. Ohne Titelvarianten ist jede Suche auf den vom Kunden gewähl

> **„Wenn Sie jemanden mit genau diesem Aufgabenzuschnitt bei einer anderen Firma abwerben würden – unter welcher Bezeichnung liefe die Person dort?“**

| | |
|---|---|
| Antworttyp | Chips (KI-Vorschläge aus Titel + Aufgaben) mit Mehrfachauswahl + Freitext für eigene Varianten |
| Optionen | Gleiche Bezeichnung wie bei uns · Englische Variante üblich · Bei kleineren Firmen heißt das anders · Weiß ich nicht – schlagen Sie vor |
| Trigger | Direkt nach Titel und Aufgaben, als erste Sourcing-Frage. Immer. |
| Uebersprungen wenn | Wenn aus einer importierten Stellenanzeige bereits mehrere Titelvarianten extrahiert wurden, nur bestätigen lassen statt neu fragen. |
| „Weiss ich nicht“ | Die KI schlägt aus Titel + Aufgaben drei Varianten vor, der Kunde hakt nur ab, was er wiedererkennt. Kein Abbruch – das ist eine Frage, bei der Vorschlagen besser funktioniert als Fragen. |
| Zielfeld | `NEU jobs.sourcing_brief.title_variants (text[]). BEWIESEN: heute existiert kein Zielfeld – weder jobs noch recruiter_jobs_view kennen ein Titel-Varianten-Feld.` |
| Folgefragen | – Und wie hieße die Rolle in einem deutlich größeren Haus?<br>– Gibt es eine Bezeichnung, unter der Sie ausdrücklich NICHT suchen wollen, weil damit etwas anderes gemeint ist? |
| Widerspruchsregel | Wenn nur eine einzige Titelvariante bestätigt wird und der Titel ungewöhnlich ist (Kunstbegriff, Hausbezeichnung), Hinweis: 'Unter diesem Begriff finden wir im Markt kaum jemanden – lassen Sie uns zwei gängige Bezeichnungen dazunehmen, sonst suchen wir an der Sprache des Marktes vorbei.' |
| Starke Antwort | Zwei bis vier konkrete Alternativbezeichnungen, idealerweise mit Hinweis, in welchem Firmentyp welche üblich ist ('im Konzern heißt das Teamleiter, im Mittelstand Abteilungsleiter'). |
| Schwache Antwort | 'Steht doch im Titel.' – Der Kunde bestätigt nur seinen eigenen Wortlaut und liefert keine zweite Variante. |
| Wenn die Antwort fehlt | ABGELEITET: Die Suche bleibt auf den Kundenwortlaut beschränkt. Bei Hausbezeichnungen ist die Trefferzahl real nahe null, ohne dass der Recruiter merkt, dass es an der Bezeichnung liegt. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `S-02` · Konkrete Firmennamen als Ankerpunkte des Talentpools. Namen sind die einzige Form von Zielfirmen-Angabe, die sich in eine Suche übersetzen lässt – Kategorien wie 'Wettbew

> **„Bei welchen drei bis fünf Firmen arbeiten die Leute heute, die wir für Sie gewinnen wollen?“**

| | |
|---|---|
| Antworttyp | Freitext-Chips (Firmennamen einzeln erfassbar, entfernbar) + Vorschlagsliste aus Branche und Region |
| Trigger | Nach Titelvarianten (S-01), sobald Rolle und Standort stehen. Immer. |
| Uebersprungen wenn | Wenn für dieselbe Firma schon eine vergleichbare Rolle besetzt wurde, die damalige Zielliste zur Bestätigung vorlegen statt neu erheben. |
| „Weiss ich nicht“ | Nicht als Wissenslücke behandeln, sondern umformulieren: nach den letzten beiden Einstellungen im Bereich fragen und danach, wohin die eigenen Leistungsträger abwandern würden. Beides liefert Namen, ohne dass der Kunde eine Marktanalyse machen muss. |
| Zielfeld | `jobs.target_companies (text[]). BEWIESEN: Spalte existiert in PROD NICHT (REST 42703); ersatzweise NEU jobs.sourcing_brief.target_companies. IB-31 fragt heute ähnlich, landet aber in briefing_notes und ist für Recruiter unsichtbar (BEWIESEN).` |
| Folgefragen | – Denken Sie an die letzten zwei Kollegen, die Sie in diesem Bereich eingestellt haben – wo kamen die her?<br>– Wenn morgen einer Ihrer Besten kündigt: zu welcher Firma würde er gehen? |
| Widerspruchsregel | Wenn die Zielliste ausschließlich aus zwei bis drei sehr großen Namen besteht und gleichzeitig das Gehalt unter deren Niveau liegt, den Konflikt benennen: 'Genau diese Firmen zahlen über Ihrer Spanne – entweder wir erweitern die Zielliste oder wir reden über die Decke.' |
| Starke Antwort | Drei bis fünf echte Firmennamen, gern mit Begründung ('von dort kam auch unser letzter Kollege'). |
| Schwache Antwort | 'Das können Sie doch besser beurteilen als ich' oder 'Es gibt da viele.' – reine Kategorien ohne einen einzigen Namen. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter startet ohne Talentpool und sucht über Titel und Skills quer durch den Markt. Das erzeugt genau die breiten, schlecht passenden Profile, über die Kunden sich anschließend beschweren. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `S-03` · Firmen, bei denen eine Ansprache verboten ist (Kunden, Partner, Beteiligungen, No-Poach-Zusagen). Das ist kein Nice-to-have, sondern Haftungsvermeidung und Kundenschutz.

*Kurz vorab: Wir geben diese Liste nur an die Recruiter weiter, die für Sie suchen – damit niemand versehentlich bei einem Ihrer Kunden anklopft.*

> **„Gibt es Firmen, bei denen wir auf keinen Fall jemanden ansprechen dürfen – zum Beispiel Kunden, Partner oder Beteiligungen von Ihnen?“**

| | |
|---|---|
| Antworttyp | Freitext-Chips (Firmennamen) + Option 'Keine' |
| Optionen | Keine · Unsere Kunden und Partner · Bestimmte Firmen (eintragen) |
| Trigger | Direkt nach der Zielfirmen-Frage (S-02), damit Ziel- und Tabuliste zusammen entstehen. Immer. |
| Uebersprungen wenn | Wenn im Firmenprofil bereits eine Tabuliste gepflegt ist, nur bestätigen lassen ('Gilt Ihre bestehende Sperrliste auch für diese Stelle?'). |
| „Weiss ich nicht“ | Nachhaken, ob es vertragliche Abwerbeverbote gibt und wer im Haus das wüsste; notfalls als offen markieren und den Recruitern sichtbar als 'ungeklärt' anzeigen, statt Freigabe zu suggerieren. |
| Zielfeld | `jobs.nogo_companies (text[]). BEWIESEN: Spalte fehlt in PROD (42703). Auch company_profiles.excluded_companies fehlt in PROD und hat kein UI (BEWIESEN, aus Inventar IB-32). Ersatzweise NEU jobs.sourcing_brief.nogo_companies – und zwingend in recruiter_jobs_view aufnehmen, sonst sieht der Recruiter das Verbot nicht.` |
| Folgefragen | – Haben Sie mit einem dieser Häuser ein vertragliches Abwerbeverbot?<br>– Gilt das dauerhaft oder nur für laufende Projekte? |
| Widerspruchsregel | Wenn Tabuliste und Zielliste sich überschneiden (dieselbe Firma in beiden), sofort auflösen lassen – sonst arbeitet der Recruiter gegen eine unsichtbare Sperre. |
| Starke Antwort | Konkrete Namen, gern mit Grund ('X ist unser größter Kunde', 'mit Y haben wir ein Abwerbeverbot im Vertrag'). |
| Schwache Antwort | 'Nein, alles frei.' – bei Firmen mit Kunden- oder Lieferantenbeziehungen im gleichen Marktsegment fast immer unvollständig. |
| Wenn die Antwort fehlt | BEWIESEN/ABGELEITET: Heute ist eine No-Poach-Zusage maschinell nirgends durchsetzbar – es gibt weder eine Spalte in PROD noch eine Anzeige im Recruiter-View. Ein Recruiter kann also völlig regelkonform beim größten Kunden des Auftraggebers anrufen. Das ist der teuerste stille Fehler im ganzen Prozess. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `S-04` · Sprache und Mindestniveau als harte Filterbedingung – und zwar realistisch, nicht reflexhaft. Dies ist die trennschärfste Suchbedingung im DACH-Markt und entscheidet, ob 

> **„In welcher Sprache läuft die tägliche Arbeit im Team – und welches Niveau braucht die Person, um am ersten Tag mitreden zu können?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl je Sprache) mit Niveau-Stufe |
| Optionen | Deutsch verhandlungssicher (C1) · Deutsch gut, Akzent egal (B2) · Deutsch und Englisch · Englisch reicht völlig |
| Trigger | Im Block harte Bedingungen, immer. Vorziehen, sobald der Kunde von internationalen Kandidaten oder Remote spricht. |
| Uebersprungen wenn | Wenn im Firmenprofil eine Konzernsprache hinterlegt ist, nur als Bestätigungsfrage stellen ('Ihr Standard ist Deutsch C1 – gilt das auch für diese Stelle?'). |
| „Weiss ich nicht“ | Über den Arbeitsalltag herleiten: In welcher Sprache finden Meetings, Kundenkontakt und Dokumentation statt? Aus den Antworten das Niveau ableiten und bestätigen lassen. |
| Zielfeld | `jobs.required_languages (jsonb [{code, minLevel}]) — BEWIESEN: Spalte existiert in PROD (REST 200) und wird vom deployten Matcher calculate-match-v3-1 als Hard Kill gelesen (Zeile 921-940). BEWIESEN: kein Aufnahmepfad schreibt sie; IB-13 landet als Fließtext in briefing_notes, KI-06 in intake_payload.typed_extras (Spalte fehlt).` |
| Folgefragen | – Gibt es Kundenkontakt auf Deutsch, oder ist es teaminterne Kommunikation?<br>– Wäre jemand mit sehr gutem, aber hörbar nicht-muttersprachlichem Deutsch ein Problem für die Rolle? |
| Widerspruchsregel | Zwei Regeln. Erstens: Deutsch C1/Muttersprache plus seltener Skill plus enges Budget = Markt bricht zusammen; aktiv anbieten, auf B2 zu gehen. Zweitens BEWIESEN/technisch: Das Feld darf erst scharf geschaltet werden, wenn candidates.language_skills gepflegt ist – der Code sagt das selbst in normalize-job-requirements/index.ts:19-21 ('Bewusst NICHT: jobs.required_languages schreiben (würde den Language-Kill scharf schalten, solange candidates.language_skills leer ist)'). Sonst kippt der Filter von 'wirkungslos' zu 'killt alle'. |
| Starke Antwort | Ein Niveau mit Begründung aus dem Arbeitsalltag ('Kundentermine auf Deutsch, Doku auf Englisch – also C1 Deutsch'). |
| Schwache Antwort | 'Perfektes Deutsch' oder 'Muttersprachler'. Das ist meist ein Reflex, kein Bedarf – und schließt starke Kandidaten aus, die fachlich passen. |
| Wenn die Antwort fehlt | BEWIESEN: Der Sprach-K.O. feuert heute nie, weil die Spalte leer bleibt. Der Kunde bekommt Kandidaten ohne das geforderte Deutsch und lehnt sie im Screening ab – der Recruiter erfährt den wahren Grund erst nach der Ablehnung. |
| Zweck / Sensitivitaet | Matching · normal |

#### `S-05` · Ob Kandidaten ohne bestehende Arbeitserlaubnis überhaupt einstellbar sind. Entscheidet, ob der Nicht-EU-Pool geöffnet oder geschlossen ist – bei Engpassprofilen oft der U

*Damit wir niemanden ansprechen, den Sie am Ende gar nicht einstellen dürften.*

> **„Könnten Sie jemanden einstellen, der für Deutschland noch eine Arbeitserlaubnis braucht – oder muss die schon vorliegen?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) |
| Optionen | Muss bereits vorliegen · EU-Bürger reicht uns · Wir unterstützen bei der Arbeitserlaubnis · Bei Remote aus dem Ausland egal |
| Trigger | Im Block harte Bedingungen. Zwingend, sobald der Suchdruck hoch ist (wenige Treffer, seltener Skill, Engpassberuf). |
| Uebersprungen wenn | Wenn der Kunde für eine frühere Stelle bereits gesponsert hat, als Bestätigungsfrage stellen. |
| „Weiss ich nicht“ | Als offen markieren und aktiv anbieten, es intern zu klären – nicht auf 'muss vorliegen' defaulten. Ein Default schließt hier still einen ganzen Markt aus. |
| Zielfeld | `jobs.visa_sponsorship (boolean). BEWIESEN: Spalte fehlt in PROD (REST 42703), obwohl der deployte Matcher sie in evaluateHardKills (Zeile 916) liest.` |
| Folgefragen | – Haben Sie das schon einmal gemacht – gibt es intern jemanden, der den Ablauf kennt?<br>– Wenn wir sonst niemanden finden: wäre es dann eine Option? |
| Widerspruchsregel | Wenn search_difficulty hoch ist und die Antwort 'muss vorliegen' lautet, den Preis benennen: 'Damit fällt ein erheblicher Teil der verfügbaren Fachkräfte weg. Wollen wir das für diese Stelle wirklich so setzen?' |
| Starke Antwort | Klare Aussage plus Prozesswissen ('wir haben zwei Kollegen mit Blauer Karte, HR kennt den Weg'). |
| Schwache Antwort | 'Muss vorliegen' – oft ungeprüft geantwortet, weil noch niemand gefragt hat, ob HR das könnte. |
| Wenn die Antwort fehlt | ABGELEITET, hoch belastbar: Der Matcher lädt Jobs mit select('*') (calculate-match-v3-1:641), hard_kill_defaults.visa_required ist per Default true (Zeile 735), und die Spalte fehlt. Damit ist !job.visa_sponsorship immer wahr und JEDER Kandidat mit visa_required wird auf JEDEM Job gekillt – lautlos, ohne dass Kunde oder Recruiter es sehen. |
| Zweck / Sensitivitaet | Matching · sensibel |

#### `S-06` · Formale Nachweise, ohne die die Tätigkeit rechtlich nicht ausgeübt werden darf – abgegrenzt von Zertifikaten, die nur nett sind. Diese Unterscheidung halbiert oder verzeh

> **„Gibt es einen Nachweis, ohne den die Person die Aufgabe formal gar nicht ausüben dürfte?“**

| | |
|---|---|
| Antworttyp | Chips + Freitext für den konkreten Nachweis |
| Optionen | Nein, nichts Formales · Ja, eine Zulassung oder Kammerzugehörigkeit · Ja, ein Sicherheits- oder Führungszeugnis · Ja, ein Führerschein oder eine Fahrerlaubnis |
| Trigger | Im Block harte Bedingungen, wenn die Rolle regulierte Anteile hat (Technik, Medizin, Finanzen, Sicherheit, Bau) oder wenn Zertifikate in den Must-Haves auftauchen. |
| Uebersprungen wenn | Wenn die importierte Anzeige einen Nachweis nennt, nur bestätigen und die Verbindlichkeit klären. |
| „Weiss ich nicht“ | Über die Tätigkeit herleiten: Gibt es Aufgaben, die ohne Zulassung nicht erledigt werden dürfen? Wenn unklar, NICHT als Pflicht setzen – ein falscher Hard Kill ist teurer als ein fehlender. |
| Zielfeld | `jobs.required_certifications (text[]). BEWIESEN: Spalte existiert in PROD (REST 200) und wird vom deployten Matcher als Hard Kill gelesen (Zeile 953-960). BEWIESEN: kein Aufnahmepfad schreibt sie.` |
| Folgefragen | – Ist das gesetzlich vorgeschrieben oder Ihre interne Regel?<br>– Könnte die Person den Nachweis auch nach dem Start erwerben? |
| Widerspruchsregel | Jedes Zertifikat, das nicht zwingend rechtlich nötig ist, gehört automatisch zu 'Kann', nicht zu 'Muss'. Bei Widerspruch den Effekt zeigen: 'Als Pflicht schließt das alle aus, die es nachholen könnten.' |
| Starke Antwort | Entweder ein klares Nein oder ein präzise benannter Nachweis mit Rechtsgrund. |
| Schwache Antwort | Der Kunde nennt Weiterbildungszertifikate (Cloud-Zertifikat, Methodenschein) als 'Pflicht' – das sind keine formalen Zulassungen und darf keinen Hard Kill auslösen. |
| Wenn die Antwort fehlt | ABGELEITET: Zertifikate stehen heute als Freitext in must_haves. Der Matcher liest sie nicht als Nachweis, und der Recruiter kann nicht unterscheiden, was verhandelbar ist – er filtert entweder zu hart oder gar nicht. |
| Zweck / Sensitivitaet | Matching · normal |

#### `S-07` · Der geografische Suchradius – aus welchem Einzugsgebiet Kandidaten kommen dürfen und ob Umzug realistisch ist. jobs.location ist heute ein einzelner Ortsstring und beschr

> **„Von wo aus könnte jemand diese Stelle realistisch machen – reicht das Umland, oder käme auch jemand infrage, der dafür umziehen müsste?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) + Freitext für konkrete Städte oder Regionen |
| Optionen | Nur Tagespendler aus dem Umland · Auch weitere Anfahrt, wenn Bürotage flexibel sind · Umzug ist möglich, wir unterstützen · Wohnort egal |
| Trigger | Nach Standort und Arbeitsmodell. Immer, außer bei vollständig remote. |
| Uebersprungen wenn | Bei remote_type = remote überspringen und nur die Zeitzone oder das Land klären. |
| „Weiss ich nicht“ | Über die Bürotage herleiten: Bei drei Tagen vor Ort ist der Radius faktisch die tägliche Pendelgrenze. Das dem Kunden vorrechnen und bestätigen lassen. |
| Zielfeld | `NEU jobs.sourcing_brief.search_radius + relocation_supported. BEWIESEN: heute existiert kein Radius- oder Umzugsfeld; jobs.location ist Freitext (CreateJob.tsx:1230-1236).` |
| Folgefragen | – Wenn jemand fachlich perfekt passt, aber zwei Stunden entfernt wohnt – wäre das ein Ausschluss?<br>– Gibt es Unterstützung beim Umzug, oder wäre das Sache des Kandidaten? |
| Widerspruchsregel | Radius mal Bürotage mal Skill-Seltenheit ist die eigentliche Marktgröße. Bei engem Radius PLUS drei oder mehr Bürotagen PLUS seltenem Skill aktiv gegensteuern: 'In diesem Einzugsgebiet gibt es realistisch nur eine Handvoll Menschen mit diesem Profil. Am leichtesten öffnen wir die Suche über einen Bürotag weniger.' |
| Starke Antwort | Ein Radius oder konkrete Städte plus Aussage zur Umzugsunterstützung. |
| Schwache Antwort | 'Aus der Region halt.' – ohne Radius oder Städtenamen nicht in eine Suche übersetzbar. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter rät den Radius. Entweder sucht er zu eng und findet niemanden, oder er liefert Kandidaten, die der Kunde wegen der Entfernung ablehnt – in beiden Fällen ohne verwertbares Marktfeedback. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `S-08` · Die tatsächliche Präsenzpflicht UND ihre Elastizität in einer Antwort. Bürotage sind im DACH-Markt der häufigste stille Dealbreaker und zugleich der billigste Hebel zur M

> **„Wie viele Tage pro Woche muss die Person wirklich im Büro sein?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl); die Optionen kodieren zugleich die Verhandelbarkeit |
| Optionen | Jeden Tag, daran rütteln wir nicht · Drei Tage, fest · Drei Tage – für die richtige Person auch zwei · Ein bis zwei Tage, eher symbolisch · Gar nicht, reine Fernarbeit |
| Trigger | Nach Standort und Arbeitsmodell. Immer, außer bei vollständig remote. |
| Uebersprungen wenn | Wenn im Firmenprofil eine Standard-Bürotageregel hinterlegt ist, als Bestätigungsfrage stellen. |
| „Weiss ich nicht“ | Über den Anlass fragen: Wofür ist Anwesenheit nötig – Team, Labor, Kundentermine, Führung? Daraus die Zahl ableiten. |
| Zielfeld | `jobs.onsite_required (boolean) + jobs.onsite_days_required (int) — BEWIESEN: onsite_required existiert in PROD (REST 200) und ist im deployten Matcher ein Hard Kill (Zeile 944-951), wird aber von keinem Pfad geschrieben. Elastizität nach NEU jobs.sourcing_brief.onsite_flexibility.` |
| Folgefragen | – Sind das feste Tage oder darf sich die Person das einteilen?<br>– Gilt das auch in den ersten Wochen, oder ist die Einarbeitung präsenzintensiver? |
| Widerspruchsregel | Bei drei oder mehr Pflichttagen plus engem Radius plus seltenem Skill: den Bürotag als ersten Verhandlungsgegenstand vorschlagen, noch vor dem Gehalt. Er kostet den Kunden weniger und öffnet den Markt stärker. Technischer Zusatz: onsite_required nur setzen, wenn die Präsenz wirklich hart ist – der Matcher kickt sonst jeden Kandidaten mit Remote-Präferenz. |
| Starke Antwort | Eine Zahl plus die Angabe, ob und wofür davon abgewichen wird. |
| Schwache Antwort | 'Hybrid' ohne Zahl. Das ist kein Arbeitsmodell, sondern ein Wort – jeder Kandidat versteht etwas anderes darunter. |
| Wenn die Antwort fehlt | BEWIESEN im Inventar: Heute konkurrieren vier Felder um dieselbe Aussage (CJ-08 remote_type, CJ-15 remote_policy, CJ-17 onsite_days_required, CJ-30 remote_days) – zwei davon werden gar nicht gespeichert. Der Recruiter kann Kandidaten die häufigste Frage nicht beantworten. |
| Zweck / Sensitivitaet | Matching · normal |

#### `S-09` · Welche Branchen als gleichwertig gelten. Im DACH-Markt entscheidet Branchennähe (etwa Automotive zu Maschinenbau zu Anlagenbau) über die Poolgröße stärker als jeder Skill

> **„Aus welchen Branchen würden Sie jemanden ohne Zögern nehmen – und wo würden Sie zögern?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl aus verwandten Branchen) + Freitext |
| Optionen | Nur aus unserer Branche · Aus verwandten Branchen gern · Branche ist uns egal, das Handwerk zählt · Aus einer bestimmten Branche auf keinen Fall |
| Trigger | Nach Zielfirmen (S-02), wenn die Zielliste klein ist oder die Branche eng. |
| Uebersprungen wenn | Wenn die Branche aus dem Firmenprofil bekannt ist, nur die Nachbarschaft klären, nicht die eigene Branche erfragen. |
| „Weiss ich nicht“ | Am Kern der Aufgabe entlang prüfen: Was von dem, was die Person können muss, ist wirklich branchenspezifisch? Meist ist es weniger, als der Kunde annimmt. |
| Zielfeld | `NEU jobs.sourcing_brief.industry_adjacency (accept[] / avoid[]). Ergänzend jobs.industry (REST 200, existiert). BEWIESEN: jobs.industry ist im Live-Pfad nicht befüllbar – CJ-19 rendert nur bei Enrichment-Daten und enrich-job-data liefert 404.` |
| Folgefragen | – Was genau müsste jemand aus einer anderen Branche nachlernen – und wie lange dauert das?<br>– Haben Sie im Team jemanden, der branchenfremd angefangen hat und heute gut läuft? |
| Widerspruchsregel | Wenn 'nur unsere Branche' gewählt wird und die Zielliste unter fünf Firmen hat, den Kunden mit der Zahl konfrontieren: 'Dann suchen wir in wenigen Häusern, von denen einige auch noch tabu sind. Welche Nachbarbranche können wir öffnen?' |
| Starke Antwort | Zwei bis drei akzeptierte Nachbarbranchen mit Begründung, plus gegebenenfalls eine echte Ausschlussbranche. |
| Schwache Antwort | 'Muss aus unserer Branche kommen' – meist ungeprüft und der häufigste unnötige Poolkiller. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter engt entweder auf die Kundenbranche ein (zu wenige Treffer) oder ignoriert Branche völlig (Kunde lehnt wegen fehlendem Kontextverständnis ab). Beides erzeugt Reibung ohne Erkenntnis. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `S-10` · Ob die Herkunft aus einem vergleichbaren Unternehmensumfeld erfolgskritisch ist. Der Wechsel Konzern zu Mittelstand (und umgekehrt) ist im DACH-Raum eine der häufigsten F

> **„Muss die Person aus einem ähnlich großen Haus kommen, oder ist Ihnen das gleichgültig?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) |
| Optionen | Ähnliche Größe wäre wichtig · Kleiner ist okay, größer wird schwierig · Größer ist okay, kleiner wird schwierig · Größe spielt keine Rolle |
| Trigger | Nach Teamgröße und Branchennähe. Besonders bei Rollen mit viel Eigenverantwortung oder viel Struktur. |
| Uebersprungen wenn | Wenn im Anti-Profil (S-13) bereits eine Umfeld-Aussage gefallen ist ('reiner Konzernhintergrund funktioniert hier nicht'), nur bestätigen. |
| „Weiss ich nicht“ | Über Ressourcen fragen: Wie viel Zuarbeit, Prozess und Struktur findet die Person vor? Daraus die Umfeldpassung ableiten und bestätigen lassen. |
| Zielfeld | `NEU jobs.sourcing_brief.environment_fit. Kontextquelle: company_profiles.headcount (CS-09).` |
| Folgefragen | – Wie viel Zuarbeit und wie viele Prozesse findet die Person bei Ihnen vor?<br>– Gab es schon einmal jemanden aus einem viel größeren Haus – wie ist das gelaufen? |
| Widerspruchsregel | Wenn 'ähnliche Größe' gefordert wird und gleichzeitig die Zielliste nur Konzerne enthält, während der Kunde Mittelstand ist, den Widerspruch benennen – sonst sourct der Recruiter gegen ein unausgesprochenes Ausschlusskriterium. |
| Starke Antwort | Eine Richtungsaussage mit Begründung aus dem Alltag ('bei uns gibt es keine Assistenz und kein Shared-Service-Center, das muss jemand aushalten'). |
| Schwache Antwort | 'Hauptsache gut' – klingt offen, ist aber meist unreflektiert; im Zweifel lehnt der Kunde später genau daran ab. |
| Wenn die Antwort fehlt | ABGELEITET: Der häufigste Ablehnungsgrund im zweiten Gespräch ('passt nicht zu uns') bleibt unbenannt und damit im Sourcing nicht steuerbar. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `S-11` · Das Wechselmotiv als Ansprache-Hebel: Was kann jemand hier tun, was er beim jetzigen Arbeitgeber nicht kann? Das ist der Satz, mit dem der Recruiter die erste Nachricht s

> **„Was kann jemand bei Ihnen tun, was er bei seinem jetzigen Arbeitgeber nicht tun kann?“**

| | |
|---|---|
| Antworttyp | Chips + Freitext (Freitext ist hier die eigentliche Antwort, Chips nur Starthilfe) |
| Optionen | Deutlich mehr Gestaltungsspielraum · Etwas von Grund auf aufbauen · Größerer Verantwortungsbereich · Näher an der Entscheidung, kürzere Wege |
| Trigger | Im Block Ansprache, nachdem Rolle und Aufgaben stehen. Immer. |
| Uebersprungen wenn | Wenn aus dem Firmenprofil ein USP vorliegt, als Schärfungsfrage stellen ('Ihr Profil nennt X – gilt das auch für diese Rolle, oder ist hier etwas anderes der Hebel?'). |
| „Weiss ich nicht“ | Umdrehen: Warum ist der letzte Kollege zu Ihnen gekommen – und was hat er vorher nicht gehabt? Das liefert fast immer den echten Differenzierer. |
| Zielfeld | `NEU jobs.sourcing_brief.pitch_differentiator. Quelle zur Vorbefüllung: company_profiles.unique_selling_point (CS-12). BEWIESEN: CS-12 wird heute nicht in die Jobaufnahme übernommen.` |
| Folgefragen | – Das schreibt Ihr Wettbewerber auch auf seine Seite – was davon stimmt bei Ihnen konkreter?<br>– Was hat der letzte Kollege gesagt, warum er zugesagt hat? |
| Widerspruchsregel | Wenn nur austauschbare Argumente kommen und gleichzeitig das Gehalt unter dem Zielfirmen-Niveau liegt, den Zielkonflikt aussprechen: Ohne Differenzierer UND ohne Gehaltsvorteil gibt es kein Wechselargument. |
| Starke Antwort | Ein konkreter Unterschied, den ein Kandidat prüfen kann ('Sie verantworten das Thema allein, es gibt keine zweite Ebene darüber'). |
| Schwache Antwort | Allgemeine Arbeitgebersprache: 'gutes Betriebsklima', 'flache Hierarchien', 'spannende Aufgaben'. Damit lässt sich niemand abwerben, weil es der Wettbewerber genauso schreibt. |
| Wenn die Antwort fehlt | BEWIESEN: Die Funktion generate-outreach-email ist in PROD nicht deployed (POST 404) und generate-job-expose ebenfalls nicht (404). Selbst ein guter Pitch hätte heute keinen Abnehmer – deshalb muss dieses Feld mindestens im Recruiter-View sichtbar sein, sonst ist die Frage wertlos. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `S-12` · Die ehrliche Schattenseite der Rolle. Wer sie kennt, spricht anders an und verliert Kandidaten nicht erst im zweiten Gespräch – das ist gesparte Recruiterzeit und geschüt

*Das hilft uns, die richtigen Leute anzusprechen – wir spielen es nicht in Anzeigen aus, sondern nutzen es im Gespräch.*

> **„Was ist an dieser Stelle unbequem – etwas, das ein Kandidat spätestens im zweiten Gespräch merkt?“**

| | |
|---|---|
| Antworttyp | Chips + Freitext |
| Optionen | Viel Altbestand und alte Systeme · Hohe Taktung, viel gleichzeitig · Wenig Struktur, muss selbst aufgebaut werden · Viele Beteiligte, lange Abstimmungen · Ehrlich: nichts Nennenswertes |
| Trigger | Im Block Ansprache, direkt nach dem Wechselmotiv (S-11). Immer. |
| Uebersprungen wenn | Nicht überspringen. Wenn der Kunde die Frage einmal ausweichend beantwortet hat, später im Prozess erneut anbieten. |
| „Weiss ich nicht“ | Über die Vorgeschichte fragen: Was hat der Vorgänger als anstrengend empfunden? Oder: Woran ist die letzte Besetzung gescheitert? |
| Zielfeld | `NEU jobs.sourcing_brief.honest_downside (recruiter-sichtbar, kandidatenseitig gesperrt). BEWIESEN: IB-27 verspricht heute 'bleibt recruiter-intern', landet aber in jobs.briefing_notes – einer normalen jobs-Spalte ohne getrennte Sichtbarkeit.` |
| Folgefragen | – Was hat Ihr Vorgänger auf der Stelle als anstrengend empfunden?<br>– Wenn jemand nach sechs Monaten wieder ginge – was wäre am ehesten der Grund? |
| Widerspruchsregel | Die Einleitung darf nur versprechen, was die Software hält. Solange keine getrennte Sichtbarkeit existiert (heute nicht der Fall), keine Vertraulichkeit zusagen, die technisch nicht durchgesetzt ist. |
| Starke Antwort | Ein konkreter, benennbarer Reibungspunkt, den der Recruiter im Gespräch aktiv adressieren kann. |
| Schwache Antwort | 'Eigentlich nichts' – bei einer Stelle, die schon länger offen ist, praktisch nie zutreffend. |
| Wenn die Antwort fehlt | ABGELEITET: Kandidaten springen im zweiten Gespräch ab. Der Recruiter hat dann bereits die teuerste Arbeit geleistet – Identifikation und Ansprache – und verliert sie an eine Information, die der Kunde von Anfang an hatte. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `S-13` · Das Anti-Profil: wer hier trotz starkem Lebenslauf scheitert. Ausschlusswissen ist im Sourcing schneller wirksam als Einschlusswissen, weil es Vorauswahl-Zeit spart.

> **„Wen würden Sie nach zwei Wochen bereuen – obwohl der Lebenslauf perfekt aussah?“**

| | |
|---|---|
| Antworttyp | Chips + Freitext |
| Optionen | Wer feste Vorgaben braucht · Wer nur Konzernstrukturen kennt · Wer nicht allein liefern kann · Wer zu eng spezialisiert ist · Wer nicht auf Menschen zugeht |
| Trigger | Im Block Profil, nach den Muss-Kriterien. Immer, außer S-14 hat bereits konkrete Ablehnungsgründe geliefert. |
| Uebersprungen wenn | Überspringen, wenn S-14 bereits zwei oder mehr konkrete Ablehnungsgründe aus echten Gesprächen geliefert hat – gelebte Ablehnungen schlagen hypothetische Anti-Profile. |
| „Weiss ich nicht“ | An einer echten Erfahrung entlangfragen: Gab es schon einmal jemanden im Team, der fachlich stark war und trotzdem nicht funktioniert hat? Warum? |
| Zielfeld | `NEU jobs.sourcing_brief.anti_persona. BEWIESEN: IB-12 fragt heute Ähnliches, landet in briefing_notes und ist im Recruiter-View nicht vorhanden (recruiter_jobs_view.briefing_notes → 42703).` |
| Folgefragen | – Gab es so einen Fall schon einmal – was war da los?<br>– Woran hätte man das im Lebenslauf erkennen können? |
| Widerspruchsregel | AGG-Grenze aktiv halten: Nur berufsbezogene Merkmale. Bei Alters-, Geschlechts-, Herkunfts- oder Gesundheitsbezug die Antwort nicht speichern, sondern umformulieren lassen. BEWIESEN aus dem Inventar: Heute existiert diese Zusage nur als UI-Text bei IB-15, ohne jede Durchsetzung im Code – Freitext geht ungefiltert in briefing_notes. |
| Starke Antwort | Eine benennbare Eigenschaft oder Herkunft mit Beispiel aus der Vergangenheit. |
| Schwache Antwort | 'Jemand, der nicht ins Team passt' – nicht operationalisierbar. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter liefert formal passende, praktisch unpassende Profile und lernt den wahren Filter erst über Ablehnungen – langsam, teuer und ohne strukturierte Rückspeisung. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

#### `S-14` · Kalibrierung an echten Ablehnungen. Wenn bereits Kandidaten gesehen wurden, definieren die Ablehnungsgründe die tatsächliche Messlatte präziser als jede Anforderungsliste

> **„Haben Sie für diese Stelle schon jemanden gesehen und abgelehnt? Was hat gefehlt?“**

| | |
|---|---|
| Antworttyp | Freitext + Chips für den Hauptgrund |
| Optionen | Fachlich zu dünn · Zu teuer · Persönlich nicht passend · Zu weit weg oder Bürotage · Wir haben noch niemanden gesehen |
| Trigger | Nur wenn Kandidaten im Prozess sind oder waren (candidates_in_pipeline > 0) oder die Stelle bereits länger offen ist. |
| Uebersprungen wenn | Überspringen, wenn CJ-28 mit 'Keine' beantwortet wurde und die Stelle neu ist. |
| „Weiss ich nicht“ | Wenn nur HR die Ablehnungen kennt, anbieten, die Info nachzureichen – sie ist mehr wert als jede weitere Anforderungsfrage. |
| Zielfeld | `NEU jobs.sourcing_brief.calibration_rejections. Kontext: jobs.candidates_in_pipeline (REST 200, existiert). BEWIESEN: Diese Frage existiert im heutigen Inventar überhaupt nicht.` |
| Folgefragen | – Und gab es umgekehrt jemanden, den Sie gern genommen hätten, der aber abgesagt hat – warum?<br>– War der Grund bei mehreren derselbe? |
| Widerspruchsregel | Wenn mehrere Ablehnungen denselben Grund haben und dieser Grund in den Muss-Kriterien gar nicht auftaucht, das offen ansprechen und das Kriterium ergänzen. Wenn Ablehnungen wegen Gehalt gehäuft auftreten, direkt in die Gehaltsdecke (S-15) überleiten. |
| Starke Antwort | Ein bis zwei konkrete Personen mit konkretem Mangel ('kam aus dem Handel, kannte unsere Regulatorik nicht'). |
| Schwache Antwort | 'Passte einfach nicht.' – ohne Kriterium wertlos für die Kalibrierung. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter wiederholt die Fehler, die der Kunde bereits gemacht hat, und liefert Profile, die intern längst durchgefallen sind. Das ist der schnellste Weg, Vertrauen im ersten Lieferzyklus zu verlieren. |
| Zweck / Sensitivitaet | Beratung · normal |

#### `S-15` · Die echte Gehaltsdecke für den Idealkandidaten – das Verhandlungsbudget des Recruiters. Ohne sie spricht der Recruiter Menschen an, die er sich nicht leisten kann, oder v

*Das bleibt zwischen uns und den Recruitern – es ist ihr Verhandlungsspielraum, nicht das, was wir Kandidaten nennen.*

> **„Angenommen, wir finden jemanden, der wirklich passt, aber zehn Prozent über Ihrer Spanne liegt – steigen Sie dann aus, oder reden wir?“**

| | |
|---|---|
| Antworttyp | Chips (Einfachauswahl) |
| Optionen | Die Spanne ist die Grenze · Bis etwa fünf Prozent darüber · Bis etwa zehn Prozent darüber · Beim Richtigen finden wir eine Lösung |
| Trigger | Nach der Gehaltsspanne. Immer bei Festanstellung; bei Contracting als Tagessatz-Variante. |
| Uebersprungen wenn | Bei Contracting stattdessen die Tagessatzdecke erfragen, nicht beides. |
| „Weiss ich nicht“ | Als offen markieren und vor der ersten Ansprache klären lassen – nicht auf 'Spanne ist fix' defaulten, das kostet Kandidaten. |
| Zielfeld | `NEU jobs.sourcing_brief.comp_ceiling (recruiter-sichtbar, kandidatenseitig gesperrt). BEWIESEN: IB-16 fragt das heute, landet in briefing_notes und erreicht den Recruiter nicht.` |
| Folgefragen | – Und wenn es statt Gehalt ein Einmalbonus oder ein anderer Titel wäre – ginge das leichter?<br>– Wer müsste einer Abweichung zustimmen, und wie lange dauert das? |
| Widerspruchsregel | Gehaltsdecke gegen Zielfirmen prüfen: Wenn die genannten Zielfirmen (S-02) bekanntermaßen über der Spanne zahlen, den Konflikt mit Zahlen benennen und den billigsten Hebel anbieten – meist ein Bürotag weniger (S-08) statt mehr Gehalt. |
| Starke Antwort | Eine benannte Obergrenze oder eine klare Bedingung, unter der mehr geht. |
| Schwache Antwort | 'Die Spanne steht' – reflexhaft, besonders wenn zugleich seltene Skills gefordert werden. |
| Wenn die Antwort fehlt | ABGELEITET: Der Recruiter verhandelt blind. Entweder er verliert Kandidaten an einer Grenze, die gar nicht fest war, oder er investiert Wochen in Profile, die budgetär nie möglich waren. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `S-16` · Die Grüne Liste für die anonyme Ansprache: was über den Arbeitgeber gesagt werden darf, ohne ihn zu nennen. Das ist die Substanz der Erstansprache – ohne sie wirkt jede N

*Je mehr wir andeuten dürfen, desto eher antworten die Leute – und Ihr Name fällt trotzdem erst, wenn Sie es freigeben.*

> **„Was dürfen wir über Sie erzählen, solange Ihr Name nicht fällt?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl) mit Live-Vorschau des anonymen Beschreibungstexts |
| Optionen | Branche · Ungefähre Größe · Region · Gehaltsband · Eigentümerstruktur oder Finanzierung |
| Trigger | Im Block Sichtbarkeit, nachdem der anonyme Beschreibungstext vorgeschlagen wurde. Immer. |
| Uebersprungen wenn | Wenn für dieselbe Firma bereits eine Grüne Liste existiert, nur bestätigen lassen. |
| „Weiss ich nicht“ | Den vorgeschlagenen anonymen Text zeigen und fragen, ob sich der Kunde darin erkennen würde. Das ist konkreter als eine abstrakte Freigabe. |
| Zielfeld | `jobs.reveal_envelope.green_list / red_list. BEWIESEN: Spalte reveal_envelope fehlt in PROD (42703). Ersatzweise NEU jobs.sourcing_brief.green_list, zwingend im Recruiter-View sichtbar. BEWIESEN: IB-33 erfasst das heute nur als Fließtext in briefing_notes; kein Code liest es beim Anonymisieren.` |
| Folgefragen | – Gibt es ein Produkt oder Projekt, das Sie sofort verraten würde?<br>– Würden Sie sich in diesem Satz selbst erkennen, wenn Sie ihn als Kandidat läsen? |
| Widerspruchsregel | Wenn Branche plus Größe plus Region plus Finanzierung gemeinsam freigegeben werden und das Marktsegment eng ist, warnen: Diese vier Angaben zusammen identifizieren im DACH-Raum oft genau ein Haus. Vorschlag: eine Angabe gröber fassen. Zusätzlich BEWIESEN: exakte Adresse gehört auf die rote Liste – im KI-Briefing steht sie dort explizit (intake-questions/index.ts:175), während CJ-16 sie ungeschützt am Job speichert. |
| Starke Antwort | Eine bewusste Auswahl plus die Nennung dessen, was auf keinen Fall gesagt werden darf (Produkte, Projekte, Kunden). |
| Schwache Antwort | 'Alles außer dem Namen.' – klingt großzügig, ist aber bei schmalen Marktsegmenten faktisch eine Offenlegung. |
| Wenn die Antwort fehlt | BEWIESEN: recruiter_jobs_view liefert company_name (REST 200). Ohne definierte Grüne Liste gibt es keine positive Freigaberegel, sondern nur einen Klartext-Firmennamen im Recruiter-View – die Anonymisierung existiert dann ausschließlich als Bitte im Prompt von format-job-for-recruiters, nicht als Regel. |
| Zweck / Sensitivitaet | Sourcing · sensibel |

**Beispieldialog**

```
Kontext: Stelle „Teamleiter Instandhaltung", Mittelstand bei Stuttgart, drei Bürotage, Spanne 85.000–95.000 €. Die Zielfirmen-Frage (S-02) steht an.

BERATER: Bei welchen drei bis fünf Firmen arbeiten die Leute heute, die wir für Sie gewinnen wollen?

KUNDE: Puh. Das ist doch eher Ihr Job, oder? Es gibt da sicher viele.

BERATER: Verstehe – und ich mache das auch. Ich frage nicht nach einer Marktanalyse, sondern nach Ihrem Bauchgefühl, weil Sie Ihren Markt anders kennen als jede Datenbank. Denken Sie an die letzten beiden Kollegen, die Sie in diesem Bereich eingestellt haben: Wo kamen die her?

KUNDE: Der eine kam von Kärcher. Die andere von einem Zulieferer hier aus der Region, der Name fällt mir gerade nicht ein.

BERATER: Das hilft schon. Und einmal andersherum: Wenn Ihnen morgen einer Ihrer beiden Besten kündigt – zu welcher Firma geht der?

KUNDE: Wahrscheinlich zu Festo oder Bosch Rexroth. Die zahlen einfach besser.

BERATER: Dann haben wir ein Suchbild: das Umfeld Kärcher, Festo, Bosch Rexroth und regionale Zulieferer. Bevor wir loslaufen – ist unter diesen Firmen eine, bei der wir auf keinen Fall anklopfen dürfen? Kunde, Partner, Beteiligung?

KUNDE: Festo ist Kunde von uns. Da bitte nicht.

BERATER: Notiert, Festo ist tabu, das geben wir so an die Recruiter weiter. Und ein Punkt, den ich Ihnen nicht ersparen kann: Sie haben gerade selbst gesagt, dass Festo und Bosch Rexroth besser zahlen. Wir suchen also in einem Umfeld, das über Ihrer Spanne liegt. Wenn wir jemanden finden, der wirklich passt, aber bei 105.000 € steht – steigen Sie aus, oder reden wir?

KUNDE: Bis 100.000 könnte ich das durchbekommen. Darüber wird es schwierig.

BERATER: Gut, dann ist 100.000 unser Verhandlungsrahmen – das bleibt zwischen uns und den Recruitern, das nennen wir keinem Kandidaten. Und weil das Budget knapp gegen den Wettbewerb steht, ist mein erster Vorschlag nicht mehr Geld, sondern ein Bürotag weniger: Drei feste Tage bei Radius Stuttgart plus dieses Profil ist ein sehr kleiner Kreis. Bei zwei Tagen öffnen wir Karlsruhe und Heilbronn mit. Wäre das für den Richtigen denkbar?

KUNDE: Für den Richtigen ja. Aber nicht in den ersten drei Monaten, da will ich ihn hier haben.

BERATER: Perfekt, genau so schreiben wir es auf: drei Tage in der Einarbeitung, danach zwei. Das ist ein Argument, mit dem die Recruiter arbeiten können.
```


---

### Dialoglogik & Dramaturgie

**Rollenfamilie:** übergreifend · **Cards:** 16

> **Kernthese:** KERNTHESE: Der Prompt ist als Fragen-Autor gut, als Dialog-Maschine unbrauchbar. Er delegiert vier Dinge an das Modell, die ein Modell prinzipiell nicht garantieren kann — Nicht-Wiederholung, Terminierung, Faktenherkunft und Anonymitätsschutz — und hat für keines davon eine deterministische Schranke. Ziel-Architektur: die KI formuliert und normalisiert, aber der Server entscheidet, ob eine Frage überhaupt gestellt werden darf. Fragenauswahl wird zu einer serverseitigen Slot-Maschine mit Informationsgewinn-Score; die KI liefert nur noch Wortlaut, Chips und Extraktion.

=== A) AUDIT DES PROMPTS (index.ts:158-188) ===

A1 BEWIESEN — TOTALVERLUST, auch nach Deploy. serializeBriefing iteriert über die STATISCHE Liste (IntakeBriefing.tsx:322 `for (const q of QUESTIONS)`). Die dynamischen Antworten gehen ausschließlich nach intake_payload.briefing_dynamic (JobIntakeStudio.tsx:374). Diese Spalte fehlt in PROD (eigene REST-Probe heute: {"code":"42703","message":"column jobs.intake_payload does not exist"}), und intakeCapture.ts:53 speichert dann still ohne sie. Ergebnis: selbst wenn intake-questions morgen deployed wird (heute POST → HTTP 404, eigene Probe), landet KEINE einzige KI-Antwort in der Datenbank. Der Prompt kann noch so gut sein — er schreibt in einen Eimer ohne Boden. Migration 20260619120000 ist die harte Vorbedingung für alles Folgende.

A2 BEWIESEN — Der Kreisel-Schutz existiert nicht. Regel 4 verbietet Wiederholung, aber die Frage-ID wählt das Modell selbst (index.ts:62 „stabiler snake_case-Schlüssel"). Serverseitig gibt es keinerlei Filter: index.ts:245 macht nur `.slice(0, max_questions)`, kein Abgleich gegen asked_ids. Das Modell muss nur `comp_ceiling` beim nächsten Turn `salary_ceiling_top_candidate` nennen — und stellt dieselbe Frage neu. Die einzige Sperre ist eine Bitte im Prompt. ABGELEITET: bei 6+ Turns mit wachsendem Antwortkontext ist Wiederholung nicht die Ausnahme, sondern das erwartbare Verhalten.

A3 BEWIESEN — Keine Terminierungsgarantie und kein Ausstieg. Abbruch hängt allein an weighted_completeness ≥ 85 (Regel 7) — einer Zahl, die dasselbe Modell selbst schätzt und die niemand prüft. Es gibt kein Rundenlimit. Und der einzige Ausstiegsknopf ist tot: DynamicBriefing.tsx:268 rendert „Fertig" mit onClick={onDone}, JobIntakeStudio.tsx:632 übergibt `onDone={() => undefined}`. Der Kunde kann das Briefing nicht beenden, er kann nur den Dialog schließen.

A4 BEWIESEN — Halluzination wird zum Hard-Kill befördert. typed_fields hat kein Konfidenz- und kein Herkunftsfeld (index.ts:83-100). DynamicBriefing.tsx:108 merged sie nur additiv (`{...prev, ...neu}`) — ein einmal geratenes `visa_sponsorship:false` oder `experience_min:5` ist unwiderruflich und wandert über JobIntakeStudio.tsx:357-359 in typisierte Spalten, die laut ULTIMATE_INTAKE_PLAN (D2/D3) im V3.1-Matcher als HARTE Killkriterien wirken. Ein Modellfehler in Turn 2 schließt danach lautlos Kandidaten aus, ohne dass es jemand sieht. Das ist der teuerste Einzeldefekt.

A5 BEWIESEN — Zustand wird beim Zurückschreiben zerstört. DynamicBriefing.tsx:109 ersetzt skillRequirements komplett (`data.skill_requirements?.length ? data.skill_requirements : prev`), Zeile 112 ersetzt tensionFlags komplett. Liefert das Modell in Turn 5 eine kürzere Liste als in Turn 3, ist die Differenz weg. Ein in Turn 2 gemeldeter, ungelöster Zielkonflikt verschwindet in Turn 3 von selbst.

A6 BEWIESEN — Ein Netzwerk-Schluckauf löscht den Dialog. DynamicBriefing.tsx:116-118: JEDER Fehler (Timeout, 502, Gateway-Limit) setzt available=false. Danach greift Zeile 135 dauerhaft und rendert das statische Briefing — mit anderen Fragen, die der Kunde teils schon beantwortet hat. Kein Retry, kein AbortController, kein Timeout (grep über index.ts: keine Treffer). Der Fallback ist als Deploy-Fallback gedacht, wirkt aber als Laufzeit-Fallback mitten im Gespräch.

A7 BEWIESEN — „Weiß ich nicht" ist zu grob. Regel 4 sagt: __unknown__ → „Kapitel als skipped markieren". Ein „weiß ich nicht" zur Gehaltsdecke tötet damit das ganze Kapitel „Vergütung & Flexibilität" inklusive Tagessatz und Verhandlungsspielraum. Fachlich ist „weiß ich nicht" außerdem meistens „nicht ich, sondern der Fachbereich" — das ist ein Delegations-Signal, kein Skip-Signal. Die Delegation existiert sogar schon (JobIntakeStudio.tsx:435-454), wird aber nie aus einer Antwort heraus angeboten.

A8 BEWIESEN — Kein AGG-Guardrail. grep über index.ts:158-188 auf agg|diskrimin|alter|geschlecht|herkunft: null Treffer. Das Modell darf frei formulieren und ist nirgends gehindert, „Wie alt soll die Person sein?" oder „Passt eine Frau ins Team?" zu fragen. Das statische Briefing gibt dem Kunden bei IB-15 sogar ein AGG-Versprechen, das kein Code einlöst. ABGELEITET: für ein DACH-Produkt ist eine KI, die Fragen frei erfindet, ohne verbotene Merkmale zu sperren, ein direktes AGG-Risiko — der Betreiber erzeugt die Frage, nicht der Kunde.

A9 ABGELEITET — Der De-Anonymisierungs-Guardrail (Regel 5) ist Selbstkontrolle. Dasselbe Modell schreibt descriptor UND red_list; nichts prüft die Trennung, und niemand konsumiert die red_list (P4 im Plan ist ungebaut). Parallel schreibt JobIntakeStudio.tsx:335 jobs.company_name im Klartext (Default „Mein Unternehmen"). Die Regel schützt einen Textkanal, während der Hauptkanal offen ist.

A10 ABGELEITET — Regel 8 („Dokument & Profil respektieren") kann nicht funktionieren, weil job_draft keine Herkunft trägt. JobIntakeStudio.tsx:203-236 baut ein flaches Objekt; nur company_defaults ist markiert. Das Modell kann nicht unterscheiden zwischen „stand in der 2 Jahre alten Anzeige", „hat der Kunde gerade getippt" und „hat der Parser geraten". Genau diese Unterscheidung ist aber die Grundlage jeder Bestätigungsfrage.

A11 BEWIESEN — Kein Widerspruchsbegriff. Das Schema kennt tension_flags nur für Anforderung-gegen-Budget (index.ts:125-137). Für „Profil sagt hybrid 2 Tage, Antwort sagt 4 Tage vor Ort" oder „Anzeige nennt Senior, Gehalt liegt auf Mid-Niveau" gibt es keinen Ausgabekanal. Der spätere Recruiter erbt beide Aussagen unaufgelöst.

A12 BEWIESEN/ABGELEITET — Kosten und Latenz. Jeder Turn schickt den vollen Entwurf plus alle Antworten und lässt das Modell ALLES neu ableiten: 11 Kapitel-Fortschritte, typed_fields, skill_requirements, payload-patch, envelope-patch, tension_flags — nur um 2 Fragen zu bekommen (max_questions=2, DynamicBriefing.tsx:98). Refetch passiert, sobald die Queue leer ist (Zeile 158), also nach je 2 Antworten; bei ~12 Fragen sind das ~6 volle Rundläufe. ANNAHME: 2-5 s je Aufruf bei gemini-2.5-flash mit diesem Ausgabeumfang. Der Kunde sieht dabei „KI wählt die nächste wichtige Frage …" (Zeile 225) — Totzeit mitten im Gespräch. Zusätzlich werden response_format:json_object UND tools/tool_choice gleichzeitig gesendet (index.ts:204-215); ANNAHME: bei manchen OpenRouter-Providern schließt sich das gegenseitig aus und erzeugt genau den 502-Pfad aus A6.

A13 BEWIESEN — Widerspruch im Prompt selbst: der Systemtext fordert „${max_questions} Fragen" (=2), das Schema beschreibt „die 1-3 wertvollsten" (index.ts:58). Kleinigkeit, aber sie kostet bei jedem Aufruf Entscheidungssicherheit.

=== B) IST STATELESS DIE RICHTIGE WAHL? ===
Ja für die Function, nein für den Dialog. Stateless ist richtig: kein Service-Role-Key, RLS bleibt die einzige Wahrheit, die Function ist beliebig neu deploybar, und das Muster ist im Repo etabliert (parse-*, extract-*). Falsch ist, dass es auch KEINEN Zustand außerhalb gibt. Heute liegt der gesamte Dialogzustand im React-State und wird nur in intake_payload.draft_state mitgeschrieben (JobIntakeStudio.tsx:393) — also in die Spalte, die in PROD nicht existiert. Abbruch = Totalverlust. EMPFEHLUNG: Function bleibt stateless, aber der Zustand bekommt einen eigenen, kleinen persistenten Ort (job_intake_sessions: job_id, turn, asked_slots[], answers[], typed_fields mit Herkunft/Konfidenz, open_conflicts[], cost_cents, last_error). Der Client schreibt ihn per eigenem JWT nach jedem Turn — dasselbe Muster wie heute, nur in eine Spalte, die es gibt, und nicht als Anhängsel des Job-Datensatzes. Damit ist Abbruch/Wiederaufnahme über Tage und über Personen hinweg möglich (die Delegation an den Fachbereich existiert bereits und ist heute nur deshalb wertlos, weil der Zustand nicht überlebt).
Zusätzlich: „voller Kontext bei jedem Turn" ist zu teuer und zu unscharf. Ab Turn 3 nur noch ein verdichtetes Zustandsobjekt schicken (bestätigte Fakten + offene Slots + letzte 2 Rohantworten), nicht die wachsende Antwortliste. Das hält den Prompt konstant groß statt linear wachsend und macht Prompt-Caching überhaupt erst möglich.

=== C) WIE VERHINDERT MAN, DASS DIE KI IM KREIS FRAGT? ===
Nicht durch bessere Prompt-Formulierungen — durch Entzug der Zuständigkeit.
1. SLOT-REGISTER statt freier IDs: Der Server hält eine feste Liste von ~30 Slots (role.week_shape, comp.ceiling, ko.language, reveal.trigger …). Jede Frage MUSS genau einen Slot adressieren; das Modell wählt aus einer übergebenen Liste offener Slots, es erfindet keine IDs mehr. Schema-Änderung: `slot: {type:'string', enum: OPEN_SLOTS}` statt freiem id-String.
2. HARTE SERVERSEITIGE FILTERUNG: nach dem Modellaufruf `next_questions.filter(q => open_slots.includes(q.slot))`, dedupliziert. Kommt nichts durch, wird der nächstwichtigste offene Slot deterministisch aus einer statischen Fallback-Formulierung gestellt. Damit ist Wiederholung strukturell unmöglich, nicht nur unerwünscht.
3. SEMANTISCHE DOPPLUNGSBREMSE: zusätzlich normalisierter Text-Vergleich der Frage gegen die letzten 8 gestellten Fragen (Trigram-Ähnlichkeit > 0.8 → verwerfen). Fängt den Fall „gleicher Slot-Sinn, anderer Slot-Name" ab.
4. RUNDENDECKEL: max 8 Modell-Turns, max 14 Fragen, max 6 Minuten. Danach schließt der Server das Briefing selbst ab und markiert die Restslots als „offen, bewusst übersprungen" — der Recruiter sieht die Lücke, statt dass der Kunde in einer Schleife hängt.
5. FRAGE-BUDGET statt Completeness-Schätzung: Abbruch nicht bei „weighted_completeness ≥ 85" (Selbstauskunft), sondern wenn alle Pflicht-Slots einen Wert oder ein explizites „übersprungen" haben. Prüfbar, deterministisch, nicht vom Modell manipulierbar.

=== D) MAXIMALE DATENQUALITÄT GEGEN MINIMALE FRAGENZAHL ===
Die Zielgröße ist nicht „wenige Fragen", sondern „wenige TEURE Fragen". Konkret:
1. INFORMATIONSGEWINN-SCORE je Slot, serverseitig berechnet: gain = matching_impact × unsicherheit × (1 − ableitbarkeit). matching_impact ist fix hinterlegt (Hard-Kill-Slots wie Sprache/Visa/Vor-Ort = 3, Sourcing-Slots = 2, Farbe/Kultur = 1). unsicherheit fällt auf 0, sobald ein Wert bestätigt ist. ableitbarkeit ist 1, wenn Anzeige, Firmenprofil oder ein früherer Job desselben Kunden den Wert liefern. Gefragt wird immer der höchste Score. Das Modell entscheidet die Reihenfolge nicht mehr — es formuliert nur.
2. BESTÄTIGEN STATT FRAGEN, gebündelt: alles Ableitbare kommt in EINE Bestätigungskarte am Anfang (UE-01), nicht in zehn Einzelfragen. Ein Klick „Alles korrekt" schließt fünf Slots. Das ist der größte Hebel: heute werden Titel, Standort, Modell, Branche, Gehalt teils dreifach über die drei Pfade erhoben.
3. VERERBUNG: ab dem zweiten Job desselben Kunden werden Prozess, Reveal-Zeitpunkt, Tabu-Firmen, Sprachanforderung und Gehaltslogik aus dem Vorgänger vorgeschlagen. Die Fragenzahl sinkt bei Bestandskunden von ~14 auf ~5.
4. TIEFE NUR DORT, WO SIE ZAHLT: eine Nachbohr-Frage pro Muss-Skill, aber nur für die Top-3-Muss-Skills und nur, wenn der Skill mehrdeutig ist (SAP, Salesforce, „Projektleitung" ja; „Deutsch" nein). Der heutige Prompt fordert es für JEDEN Muss-Skill (Regel 2b) — bei 9 Muss-Kriterien sind das allein 9 Fragen.
5. ZWEI ANTWORTQUALITÄTEN UNTERSCHEIDEN: jede Karte definiert eine schwache und eine starke Antwort. Nur bei schwacher Antwort feuert die Nachfrage. Eine Nachfrage-Ebene, nie zwei — sonst kippt Beratung in Verhör.
6. NIE BLOCKIEREN: keine Pflichtfrage im Dialog. Übersprungene Slots erscheinen als sichtbare Lücke im Recruiter-Briefing („Gehaltsdecke: nicht freigegeben") — das erzeugt den Nachfragedruck da, wo er hingehört, statt im Formular.

=== E) HALLUZINATIONSSCHUTZ, HERKUNFT, KONFIDENZ ===
Jeder extrahierte Fakt bekommt drei Attribute: value, source ∈ {kunde_explizit, anzeige, firmenprofil, vorgaenger_job, ki_abgeleitet}, confidence ∈ {hoch, mittel, niedrig}. Harte Regel, serverseitig durchgesetzt: ein Wert darf NUR dann in eine typisierte Matching-Spalte geschrieben werden, wenn source=kunde_explizit ODER (source≠ki_abgeleitet UND vom Kunden bestätigt). Alles mit source=ki_abgeleitet landet ausschließlich in intake_payload und wird dem Recruiter als „abgeleitet" gekennzeichnet. Damit kann A4 nicht mehr passieren: ein geratenes visa_sponsorship wird nie zum Hard-Kill. Zusätzlich: Zahlenfelder (experience_min/max, salary) werden nur übernommen, wenn die Zahl wörtlich in der Kundenantwort vorkommt — reine Regex-Prüfung, kein Modellvertrauen.

=== F) WIDERSPRUCHSERKENNUNG ===
Neuer Ausgabekanal `conflicts[{slot_a, value_a, source_a, slot_b, value_b, source_b, question}]`, getrennt von tension_flags (Zielkonflikt ≠ Widerspruch). Erkannt wird serverseitig, wo es billig ist (remote_type vs. onsite_days, salary_max vs. experience_level, Firmenprofil-Standard vs. Job-Wert, Sprache C1 vs. „nur Englisch"), und durch das Modell, wo es Sprache braucht. Auflösung immer als eigene, freundliche Rückfrage (UE-16), nie stillschweigend. Ein offener Konflikt blockiert die Übergabe nicht, wird aber im Recruiter-Briefing sichtbar geführt.

=== G) FALLBACK-KASKADE BEI KI-AUSFALL ===
Statt heute „ein Fehler = für immer statisch" (A6): (1) 1× Retry nach 800 ms mit AbortController/8 s Timeout; (2) zweiter Versuch mit reduziertem Ausgabeschema (nur next_questions, ohne Normalisierung — schneller, billiger, robuster); (3) DETERMINISTISCHE Formulierung des höchstbewerteten offenen Slots aus einer statischen Wortlaut-Tabelle — der Dialog läuft in derselben Karten-Optik weiter, nur ohne KI-Zuspitzung; (4) erst wenn auch das scheitert, das statische Briefing — und dann mit Vorbefüllung aus den bereits gegebenen dynamischen Antworten, damit nichts doppelt gefragt wird. Der Zustand available=false wird nie dauerhaft gesetzt, sondern nur für den laufenden Turn.

=== H) REIHENFOLGE DER UMSETZUNG (aus Dialogsicht) ===
1. Migration 20260619120000 anwenden (ohne sie ist jede weitere Arbeit an diesem Dialog wertlos — A1). 2. onDone verdrahten + Retry-Kaskade (A3/A6, beide klein). 3. Slot-Register + serverseitiger Filter + Rundendeckel (A2/A3). 4. Herkunft/Konfidenz und die Schreibsperre für ki_abgeleitet (A4). 5. Merge statt Ersetzen für skillRequirements/tensionFlags (A5). 6. AGG-Sperre im Prompt UND als Ausgabe-Filter auf verbotene Merkmale (A8). 7. job_intake_sessions für echte Wiederaufnahme und Delegation.


#### `UE-01` · Alles, was aus Anzeige, Firmenprofil oder einem früheren Job dieses Kunden bekannt ist, in EINEM Zug bestätigen oder korrigieren lassen — damit kein bereits bekanntes Fel

> **„Ich habe aus Ihrer Anzeige und Ihrem Firmenprofil das hier übernommen: {Titel}, {Standort}, {Arbeitsmodell}, {Gehaltsband}, {Branche}. Stimmt das so für diese Stelle?“**

| | |
|---|---|
| Antworttyp | Bestätigen (ein Klick) oder einzelne Zeilen inline korrigieren |
| Optionen | Alles korrekt · Ich korrigiere etwas |
| Trigger | Allererste Karte, direkt nachdem das Profil gebaut ist. Zeigt nur Felder mit einer Herkunft ungleich 'kunde_explizit'. |
| Uebersprungen wenn | Kein einziges Feld hat eine Fremdherkunft — also reine Freitext-Eingabe ohne Anzeige und ohne Firmenprofil. |
| „Weiss ich nicht“ | Entfällt. Bestätigen ist immer beantwortbar; wer unsicher ist, korrigiert nichts und der Wert behält die Herkunft 'anzeige' statt 'kunde_explizit'. |
| Zielfeld | `jobs.title, jobs.location, jobs.remote_type, jobs.salary_min/max, jobs.industry — plus Herkunftsstempel in intake_payload.provenance (Spalte fehlt in PROD, REST 42703)` |
| Folgefragen | – Sie haben {Feld} auf {neuer Wert} korrigiert — gilt das nur für diese Stelle oder ab jetzt für alle? |
| Widerspruchsregel | Weicht ein Wert vom hinterlegten Firmenstandard ab (Profil: hybrid, 2 Bürotage — Anzeige: 4 Tage vor Ort), wird genau dieses eine Feld einzeln mit beiden Werten zur Entscheidung gestellt, statt es stillschweigend zu übernehmen. |
| Starke Antwort | Titel und Standort stimmen. Das Gehaltsband ist alt — wir gehen inzwischen bis 95.000. |
| Schwache Antwort | Passt. |
| Wenn die Antwort fehlt | Jeder geparste Wert bleibt unbestätigt. Der Recruiter kann nicht unterscheiden, ob 'hybrid' vom Kunden kommt oder aus einer zwei Jahre alten Anzeige — und die KI fragt später Dinge erneut, die längst dastehen. |
| Zweck / Sensitivitaet | Matching · normal |

#### `UE-02` · Der tatsächliche Arbeitsinhalt statt der Stellenanzeigen-Prosa. Ohne diese Antwort sucht der Recruiter nach einem Titel, nicht nach einer Tätigkeit.

> **„Wenn Sie sich eine ganz normale Arbeitswoche dieser Person vorstellen: Welche drei Dinge füllen den größten Teil davon?“**

| | |
|---|---|
| Antworttyp | Chips (bis zu drei wählbar) plus Freitext |
| Optionen | Operativ selbst umsetzen · Projekte steuern · Konzept und Strategie · Kunden und Fachbereiche beraten · Team führen · Auswerten und berichten |
| Trigger | Erste inhaltliche Frage nach der Bestätigungskarte. Immer — dieser Slot ist nie ableitbar. |
| Uebersprungen wenn | Nie überspringen. Auch bei perfekt geparster Anzeige nicht — Anzeigen beschreiben Wünsche, nicht Wochen. |
| „Weiss ich nicht“ | Signal, dass hier nicht der Fachbereich sitzt. Es wird nicht als Wissenslücke behandelt, sondern die Übergabe an den Fachbereich angeboten: 'Soll ich diese Frage an die Person schicken, die das Team führt?' |
| Zielfeld | `intake_payload.role.week_shape (Spalte fehlt in PROD, 42703) — fließt in format-job-for-recruiters statt der heute halluzinierten quick_facts` |
| Folgefragen | – Welches der drei würde die Person als Erstes vermissen, wenn wir es streichen? |
| Widerspruchsregel | Wird 'Team führen' gewählt, obwohl team_size leer oder 0 ist, entsteht ein Widerspruch für UE-16. |
| Starke Antwort | Etwa die Hälfte Monatsabschluss und Reporting, ein Viertel Betreuung von zwei Auslandsgesellschaften, ein Viertel die Ablösung unseres Altsystems. |
| Schwache Antwort | Das Übliche für die Position. |
| Wenn die Antwort fehlt | Der Recruiter kann Kandidaten nicht vorqualifizieren und keine glaubwürdige Ansprache schreiben. Das ist die häufigste Ursache für Vorschläge, die auf dem Papier passen und im Gespräch durchfallen. |
| Zweck / Sensitivitaet | Matching · normal |

#### `UE-03` · Das konkrete Einstiegsprojekt. Es ist gleichzeitig das beste Argument in der Ansprache und der beste Filter im Erstgespräch.

> **„Woran arbeitet die Person in den ersten drei Monaten ganz konkret — steht dafür schon ein Projekt oder ein Thema fest?“**

| | |
|---|---|
| Antworttyp | Chips plus Freitext |
| Optionen | Laufendes Geschäft übernehmen · Ein bestimmtes Projekt (kurz beschreiben) · Etwas neu aufbauen · Aufräumen und stabilisieren |
| Trigger | Direkt nach UE-02. |
| Uebersprungen wenn | Die Anzeige nennt bereits ein benanntes Projekt mit Zeitbezug — dann nur bestätigen lassen. |
| „Weiss ich nicht“ | Ersatzfrage, die fast immer funktioniert: 'Was liegt gerade liegen, weil die Stelle unbesetzt ist?' Diese Antwort ist meist konkreter als die ursprüngliche Frage. |
| Zielfeld | `intake_payload.role.first_90_days (Spalte fehlt in PROD, 42703)` |
| Folgefragen | – Läuft das Projekt schon, oder startet es mit der neuen Person?<br>– Wer macht das heute übergangsweise? |
| Widerspruchsregel | Wird 'Etwas neu aufbauen' gewählt und gleichzeitig ein Erfahrungslevel unter Senior geführt, entsteht ein Widerspruch für UE-16. |
| Starke Antwort | Die Migration unserer drei Standorte auf ein gemeinsames ERP — Kick-off war im Juni, die Stelle ist die Projektleitung darin. |
| Schwache Antwort | Erstmal einarbeiten und ankommen. |
| Wenn die Antwort fehlt | Die Ansprache bleibt austauschbar. Anonyme Ansprache ohne konkretes Projekt ist der schwächste Fall, den ein Recruiter haben kann. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `UE-04` · Das Erfolgsmaß des Kunden — die einzige Angabe, aus der sich ein belastbares Suchbild ableiten lässt, weil sie Prioritäten offenlegt.

> **„Ein Jahr später sagen Sie: Das war genau die richtige Einstellung. Woran machen Sie das dann fest?“**

| | |
|---|---|
| Antworttyp | Chips plus Freitext |
| Optionen | Eine bestimmte Kennzahl erreicht · Projekt läuft stabil · Team steht und liefert · Ich bin spürbar entlastet |
| Trigger | Nach UE-03. Immer. |
| Uebersprungen wenn | Nie überspringen. |
| „Weiss ich nicht“ | Umformulierung statt Skip: 'Was müsste passieren, damit Sie es bereuen?' Die negative Formulierung wird erfahrungsgemäß deutlich konkreter beantwortet. |
| Zielfeld | `jobs.success_profile (Spalte in PROD vorhanden, wird heute nur vom CreateJob-Pfad befüllt) plus intake_payload.role.success_12m` |
| Folgefragen | – Und was ist die ehrliche Schattenseite dieser Stelle, die eine Kandidatin nach drei Monaten merkt? |
| Widerspruchsregel | Nennt der Kunde eine Kennzahl, die in den Muss-Kriterien keine Entsprechung hat, wird das als Hinweis geführt: das eigentliche Erfolgskriterium steht nicht im Anforderungsprofil. |
| Starke Antwort | Wenn der Abschluss ohne meine Nachtschichten steht und die zwei offenen Prüfungsfeststellungen erledigt sind. |
| Schwache Antwort | Wenn sie sich gut eingearbeitet hat. |
| Wenn die Antwort fehlt | Der Recruiter kann nicht priorisieren, wenn zwei Kandidaten unterschiedliche Stärken haben. Er legt dann beide vor — und der Kunde entscheidet ohne Vorarbeit. |
| Zweck / Sensitivitaet | Matching · normal |

#### `UE-05` · Die tatsächlich verlangte Tiefe pro Muss-Skill — der Unterschied zwischen 'hat davon gehört' und 'hat es selbst eingeführt' entscheidet über Trefferquote und Gehalt.

> **„Sie haben {Skill} als Muss genannt. Muss die Person damit täglich gearbeitet haben, damit ein Projekt verantwortet haben — oder es selbst eingeführt haben?“**

| | |
|---|---|
| Antworttyp | Chips plus Freitext, je Skill eine Runde |
| Optionen | Täglich damit gearbeitet · Ein Projekt damit verantwortet · Selbst eingeführt oder aufgebaut · Grundkenntnisse reichen |
| Trigger | Schleife über maximal die drei wichtigsten Muss-Skills, und nur für mehrdeutige Skills (SAP, Salesforce, 'Projektleitung' ja — 'MS Office', 'Deutsch' nein). |
| Uebersprungen wenn | Der Skill ist eindeutig, oder die Anzeige nennt bereits Jahre und Kontext ('mindestens 5 Jahre SAP FI/CO im produktiven Betrieb'). |
| „Weiss ich nicht“ | Delegation anbieten, nicht überspringen — Skill-Tiefe weiß fast immer der Fachbereich. Bis dahin wird der Skill mit weight 0.5 statt 1.0 geführt und ist damit kein Ausschlusskriterium. |
| Zielfeld | `job_skill_requirements (Tabelle in PROD vorhanden, REST 200) als {skill_name, type, weight} plus min_years/proficiency/recency in intake_payload.skill_requirements (Spalte fehlt in PROD, 42703)` |
| Folgefragen | – Welche Module beziehungsweise welche Umgebung genau?<br>– In welcher Größenordnung — ein Standort oder ein Konzern? |
| Widerspruchsregel | Wird bei drei oder mehr Skills 'selbst eingeführt' verlangt und liegt das Gehalt im unteren Marktdrittel, wird der Zielkonflikt benannt und ein Skill zur Verschiebung nach 'Kann' vorgeschlagen. |
| Starke Antwort | FI und CO produktiv, mindestens einen Rollout begleitet, S/4-Umfeld — reine Anwenderkenntnis reicht nicht. |
| Schwache Antwort | Gute Kenntnisse eben. |
| Wenn die Antwort fehlt | Der Matcher fällt auf reine Wortübereinstimmung in must_haves zurück. 'SAP' trifft dann den Anwender genauso wie den Modulbetreuer. |
| Zweck / Sensitivitaet | Matching · normal |

#### `UE-06` · Die ehrliche Härte der Muss-Liste. Das ist die wertvollste Antwort im ganzen Briefing, weil sie den erreichbaren Markt sofort vergrößert.

*Damit ich weiß, wo der Recruiter suchen darf und wo nicht.*

> **„Von Ihren {n} Muss-Kriterien: Bei welchen zwei würden Sie sich jemanden trotzdem ansehen, wenn alles andere überzeugt?“**

| | |
|---|---|
| Antworttyp | Auswahl aus der eigenen Muss-Liste, je Kriterium dreistufig |
| Optionen | fix · verhandelbar · flexibel |
| Trigger | Sobald sechs oder mehr Muss-Kriterien vorliegen, oder bei Senior-und-darüber mit engem Budget. |
| Uebersprungen wenn | Weniger als vier Muss-Kriterien und Gehalt im oberen Marktdrittel. |
| „Weiss ich nicht“ | Umkehr der Frage: 'Wenn Sie in vier Wochen niemanden gesehen haben — welches Kriterium fällt als Erstes?' Das beantwortet fast jeder Kunde. |
| Zielfeld | `jobs.must_haves plus intake_payload.flexibility (Spalte fehlt in PROD, 42703) — heute die einzige Stelle im Produkt, an der Verhandelbarkeit erfasst und dann verworfen wird` |
| Folgefragen | – Wenn Sie nur eines behalten dürften: welches? |
| Widerspruchsregel | Bleibt alles auf 'fix' und liegt das Gehalt unter dem Marktband für dieses Profil, wird genau ein Kriterium konkret zur Verschiebung vorgeschlagen — mit Begründung, nicht als Warnung. |
| Starke Antwort | Die Branchenerfahrung ist verhandelbar, das Studium auch. SAP und Deutsch auf Verhandlungsniveau nicht. |
| Schwache Antwort | Alles ist wichtig, sonst stünde es nicht da. |
| Wenn die Antwort fehlt | Der Recruiter behandelt alle Kriterien als hart und legt niemanden vor. Der Kunde hält den Markt für leer, obwohl er nur seine eigene Liste sieht. |
| Zweck / Sensitivitaet | Beratung · normal |

#### `UE-07` · Das eigentliche Ausschlusskriterium hinter dem Anforderungsprofil — meist etwas, das gar nicht im Profil steht.

*Bitte nur, was mit der Arbeit zu tun hat — Alter, Geschlecht oder Herkunft dürfen wir weder erfassen noch weitergeben.*

> **„Angenommen, ein Lebenslauf sieht auf dem Papier perfekt aus: Woran scheitert die Person bei Ihnen trotzdem am ehesten?“**

| | |
|---|---|
| Antworttyp | Chips plus Freitext |
| Optionen | Fachliche Tiefe fehlt · Zu wenig Führungserfahrung · Kennt unsere Branche nicht · Passt nicht zur Arbeitsweise · Sprache reicht nicht |
| Trigger | Nach UE-06. Immer — dieser Slot ist nie ableitbar. |
| Uebersprungen wenn | Nie überspringen. |
| „Weiss ich nicht“ | Rückgriff auf die Erfahrung: 'Wen haben Sie zuletzt für eine ähnliche Stelle abgelehnt — und woran lag es?' |
| Zielfeld | `intake_payload.profile.top_disqualifier plus anti_persona (Spalte fehlt in PROD, 42703)` |
| Folgefragen | – Woran würden Sie das schon im ersten Gespräch merken? |
| Widerspruchsregel | Nennt der Kunde ein Merkmal aus dem AGG-Katalog, wird die Antwort nicht gespeichert. Stattdessen kommt eine Rückfrage nach dem beruflichen Kern dahinter ('Welche Anforderung steckt dahinter?'). |
| Starke Antwort | An der Selbstständigkeit. Wer aus dem Konzern kommt und einen Stab gewohnt ist, kommt hier nach vier Wochen nicht klar. |
| Schwache Antwort | Wenn die Chemie nicht stimmt. |
| Wenn die Antwort fehlt | Der Recruiter lernt das Ausschlusskriterium erst nach der dritten Absage. Das kostet drei Wochen und Vertrauen auf beiden Seiten. |
| Zweck / Sensitivitaet | Matching · sensibel |

#### `UE-08` · Sprache als typisiertes Ausschlusskriterium mit Niveau — heute reiner Fließtext und damit für das Matching wirkungslos.

> **„In welcher Sprache arbeitet die Person im Alltag — und reicht es, sich gut zu verständigen, oder muss sie darin verhandeln und präsentieren?“**

| | |
|---|---|
| Antworttyp | Chips (Mehrfachauswahl je Sprache) plus Niveaustufe |
| Optionen | Deutsch, verhandlungssicher · Deutsch, gutes Arbeitsniveau · Englisch, verhandlungssicher · Englisch, gutes Arbeitsniveau · Deutsch und Englisch |
| Trigger | Immer, außer die Anzeige nennt bereits Sprache mit Niveau. |
| Uebersprungen wenn | Die Anzeige nennt Sprache und Niveau bereits eindeutig — dann in UE-01 mitbestätigen. |
| „Weiss ich nicht“ | Vorbelegung aus dem Standort ableiten und explizit als Vorschlag zeigen ('Standort Stuttgart, also Deutsch auf Arbeitsniveau — richtig?'), nicht raten und speichern. |
| Zielfeld | `jobs.required_languages jsonb [{code, minLevel}] — exakte Shape, weil der Matcher sie als Hard-Kill liest (ULTIMATE_INTAKE_PLAN D3)` |
| Folgefragen | – Wo genau braucht sie die Sprache — im Team, gegenüber Kunden oder in der Dokumentation? |
| Widerspruchsregel | Wird 'nur Englisch' gewählt, obwohl remote_type onsite und der Standort in der DACH-Region liegt, entsteht ein Widerspruch für UE-16. |
| Starke Antwort | Deutsch verhandlungssicher, weil sie vor dem Betriebsrat präsentiert. Englisch reicht auf Arbeitsniveau für die Konzernberichte. |
| Schwache Antwort | Deutsch natürlich. |
| Wenn die Antwort fehlt | Der teuerste späte Abbruch im ganzen Prozess: alles passt, und im dritten Gespräch scheitert es an der Sprache. |
| Zweck / Sensitivitaet | Matching · normal |

#### `UE-09` · Ob international gesucht werden darf. Steuert einen echten Hard-Kill im Matcher und entscheidet über die Größe des Suchraums.

*Das entscheidet nur, wie weit wir suchen dürfen — es geht nicht um die Herkunft einer Person, sondern um Ihren Aufwand.*

> **„Muss eine Arbeitserlaubnis für Deutschland bereits vorliegen — oder würden Sie bei der richtigen Person ein Visum unterstützen?“**

| | |
|---|---|
| Antworttyp | Chips |
| Optionen | Muss vorliegen · EU-Bürger genügt · Wir unterstützen bei einem Visum · Spielt bei uns keine Rolle |
| Trigger | Immer bei Festanstellung. Bei Contracting nur, wenn der Einsatz vor Ort stattfindet. |
| Uebersprungen wenn | Der Kunde hat diese Frage bei einem früheren Job bereits beantwortet und die Rollenfamilie ist dieselbe — dann in UE-01 mitbestätigen. |
| „Weiss ich nicht“ | Konservativ als 'nicht geklärt' führen, NICHT als 'muss vorliegen'. Ein geratenes Nein würde als Hard-Kill den halben Markt ausschließen. |
| Zielfeld | `jobs.visa_sponsorship boolean (Spalte fehlt in PROD, 42703 — Migration 20260619120000 ist Vorbedingung; heute liest der Matcher eine Phantomspalte)` |
| Folgefragen | – Haben Sie das schon einmal gemacht — und wie lange hat es gedauert? |
| Widerspruchsregel | Wird 'Muss vorliegen' gewählt, während UE-06 einen sehr engen Markt zeigt, wird der Preis der Entscheidung genannt: welcher Anteil des Marktes damit wegfällt. |
| Starke Antwort | Blaue Karte übernehmen wir, das haben wir zweimal gemacht. Eine komplette Neuerteilung von außerhalb der EU schaffen wir zeitlich nicht. |
| Schwache Antwort | Das haben wir bisher nicht gebraucht. |
| Wenn die Antwort fehlt | Entweder sucht der Recruiter zu eng oder er legt Kandidaten vor, die der Kunde aus Aufwandsgründen ablehnt. |
| Zweck / Sensitivitaet | Matching · sensibel |

#### `UE-10` · Die echte Obergrenze für den Wunschkandidaten. Sie ist das Verhandlungsbudget des Recruiters und entscheidet, ob ein Abschluss überhaupt möglich ist.

*Die Zahl sehen weder Kandidaten noch Ihre Anzeige — sie ist nur der Verhandlungsspielraum unserer Recruiter.*

> **„Wenn in vier Wochen genau die richtige Person vor Ihnen sitzt und acht Prozent über Ihrem Maximum liegt — machen Sie das?“**

| | |
|---|---|
| Antworttyp | Chips plus optionale Zahl |
| Optionen | Ja, ohne Rückfrage · Ja, mit interner Freigabe · Nein, {salary_max} ist die Decke · Kommt auf die Person an |
| Trigger | Nach den Anforderungsfragen, nie am Anfang. Bei Festanstellung mit gesetztem salary_max. |
| Uebersprungen wenn | Contracting — dort greift die Tagessatz-Karte der Vergütungs-Rollenfamilie. |
| „Weiss ich nicht“ | Als Delegationssignal behandeln (Budget liegt meist bei HR oder Geschäftsführung) und die Frage an die freigebende Person weiterreichen, statt sie zu überspringen. |
| Zielfeld | `intake_payload.comp.ceiling und comp.ceiling_source (Spalte fehlt in PROD, 42703). Bewusst NICHT in jobs.salary_max — die Decke ist recruiter-intern und darf nicht in der Ausschreibung landen.` |
| Folgefragen | – Bis zu welcher Zahl entscheiden Sie selbst, ab wann brauchen Sie jemanden dazu?<br>– Was ist außer dem Grundgehalt noch beweglich — Antrittsprämie, Titel, mehr Homeoffice? |
| Widerspruchsregel | Bei 'Nein, das ist die Decke' und gleichzeitig 'alles fix' aus UE-06 wird der Zielkonflikt mit Zahlen benannt und genau ein Ausweg vorgeschlagen — Budget oder Kriterium. |
| Starke Antwort | Bis 98.000 entscheide ich allein, darüber brauche ich die Geschäftsführung — das dauert dann etwa eine Woche. |
| Schwache Antwort | Wir sind da flexibel. |
| Wenn die Antwort fehlt | Der Recruiter verhandelt am unteren Rand und verliert den Kandidaten an ein Angebot, das der Kunde selbst überboten hätte. |
| Zweck / Sensitivitaet | Beratung · sensibel |

#### `UE-11` · Wo die Zielpersonen heute arbeiten. Das ist die Suchanfrage des Recruiters, wortwörtlich.

> **„Wenn Sie an jemanden denken, der das heute schon gut macht: Wo arbeitet der gerade — bei welcher Art von Firma, in welcher Rolle?“**

| | |
|---|---|
| Antworttyp | Chips plus Freitext für konkrete Firmennamen |
| Optionen | Bei direkten Wettbewerbern · Bei den Branchenführern · Bei kleineren Firmen als uns · Aus der Beratung heraus · Bestimmte Firmen (eintragen) |
| Trigger | Nach dem Anforderungsteil, immer. |
| Uebersprungen wenn | Der Kunde hat für eine frühere Stelle derselben Rollenfamilie bereits Ziel-Firmen genannt — dann bestätigen statt fragen. |
| „Weiss ich nicht“ | Über die Person statt über die Firma fragen: 'Wer in Ihrem Umfeld macht das gut — und wo arbeitet der?' Fast jeder Kunde hat hier einen Namen im Kopf. |
| Zielfeld | `jobs.target_companies text[] (Spalte fehlt in PROD, 42703) plus intake_payload.sourcing.current_titles` |
| Folgefragen | – Wie heißt diese Rolle dort typischerweise?<br>– Gibt es zwei, drei Firmen, die Sie konkret nennen würden? |
| Widerspruchsregel | Werden ausschließlich Branchenführer genannt, während das Gehalt im unteren Drittel liegt, wird der Widerspruch benannt statt kommentarlos übernommen. |
| Starke Antwort | Bei den zwei großen Zulieferern im Umkreis, dort typischerweise als Gruppenleiter — oder bei uns in der Nachbarabteilung eine Ebene tiefer. |
| Schwache Antwort | In der Branche eben. |
| Wenn die Antwort fehlt | Der Recruiter sucht nach Stichworten statt nach Personen. Genau das unterscheidet Direktansprache von Anzeigenschaltung. |
| Zweck / Sensitivitaet | Sourcing · normal |

#### `UE-12` · Firmen, die nicht angesprochen werden dürfen. Ohne diese Angabe ist eine Zusage an Kunden und Partner nicht einhaltbar.

*Das geben wir als Sperrliste an die Recruiter weiter, ohne dass jemand erfährt, warum.*

> **„Gibt es Firmen, bei denen wir auf keinen Fall ansprechen dürfen — Kunden, Partner oder eine bestehende Abmachung?“**

| | |
|---|---|
| Antworttyp | Chips plus Freitext-Liste |
| Optionen | Keine · Unsere Kunden und Partner · Bestimmte Firmen (eintragen) |
| Trigger | Direkt nach UE-11, im selben Gedankengang. |
| Uebersprungen wenn | Der Kunde hat im Firmenprofil eine gepflegte Sperrliste — dann nur bestätigen und ergänzen lassen. |
| „Weiss ich nicht“ | Als offen führen und im Recruiter-Briefing sichtbar als 'nicht geklärt' markieren. Eine geratene leere Liste wäre die gefährlichste aller Antworten. |
| Zielfeld | `jobs.nogo_companies text[] (Spalte fehlt in PROD, 42703). Vorbefüllung aus company_profiles.excluded_companies — diese Spalte fehlt in PROD ebenfalls und hat kein Eingabefeld.` |
| Folgefragen | – Gilt die Sperre dauerhaft oder nur für diese Suche? |
| Widerspruchsregel | Steht eine Firma sowohl in den Ziel-Firmen aus UE-11 als auch hier, wird der Konflikt sofort und namentlich zur Klärung gestellt. |
| Starke Antwort | Unsere drei größten Kunden — die Liste schicke ich Ihnen. Und der Zulieferer, mit dem wir das Gemeinschaftsunternehmen haben. |
| Schwache Antwort | Nicht dass ich wüsste. |
| Wenn die Antwort fehlt | Ein Recruiter spricht den Mitarbeiter eines Großkunden an. Das ist der Schaden, der eine Plattform-Beziehung sofort beendet. |
| Zweck / Sensitivitaet | Vertrag · sensibel |

#### `UE-13` · Die Grenze zwischen dem, was anonym über den Kunden gesagt werden darf, und dem, was ihn sofort verrät. Das ist die operative Grundlage des gesamten Triple-Blind-Versprec

*Kandidaten und Recruiter sehen bis zur Freigabe nur diese Beschreibung — deshalb sollte sie attraktiv sein, ohne Sie zu verraten.*

> **„Bis Sie Ihren Namen freigeben, beschreiben wir Sie gegenüber Kandidaten so: „{descriptor}". Was davon dürfen wir sagen — und was würde Sie sofort verraten?“**

| | |
|---|---|
| Antworttyp | Zwei Listen: freigegeben und gesperrt, vorbelegt aus Firmenprofil und Anzeige |
| Optionen | Branche · Unternehmensgröße · Region · Gehaltsband · Finanzierungsstand · Produktbereich |
| Trigger | Gegen Ende, sobald Branche, Größe und Region bekannt sind. Immer. |
| Uebersprungen wenn | Der Kunde hat bei einem früheren Job bereits eine Freigabeliste gepflegt — dann Descriptor vorschlagen und bestätigen lassen. |
| „Weiss ich nicht“ | Konservativer Vorschlag aus Branche, Größenband und Region, ausdrücklich als Vorschlag markiert und mit Herkunft 'ki_abgeleitet' gespeichert — er wird nie ohne Bestätigung an Recruiter ausgespielt. |
| Zielfeld | `reveal_envelope.descriptor / green_list / red_list (Spalte fehlt in PROD, 42703). Achtung: jobs.company_name wird parallel im Klartext gespeichert (JobIntakeStudio.tsx:335) — die Freigabeliste wirkt erst, wenn recruiter_jobs_view verdrahtet ist.` |
| Folgefragen | – Wenn jemand aus Ihrer Branche das liest — wüsste er, wer Sie sind? |
| Widerspruchsregel | Enthält die Freigabeliste 'Marktführer für X in Y', exakte Umsatzzahlen, das Gründungsjahr oder eine genaue Adresse, wandert die Angabe automatisch auf die Sperrliste und der Kunde bekommt eine kurze Begründung — die Kombination aus Branche, Größe, Region und Alleinstellung identifiziert eine Firma zuverlässig. |
| Starke Antwort | Branche, Größenordnung und Rhein-Main dürfen Sie sagen. Nicht, dass wir der einzige zertifizierte Anbieter für diese Prüfnorm sind — daran erkennt uns jeder in der Branche sofort. |
| Schwache Antwort | Alles außer dem Namen. |
| Wenn die Antwort fehlt | Der Recruiter erfindet die anonyme Beschreibung selbst. Genau das ist der heutige Zustand mit den halluzinierten quick_facts. |
| Zweck / Sensitivitaet | Sourcing · DSGVO-relevant |

#### `UE-14` · Der maschinell auswertbare Zeitpunkt der Namensfreigabe. Heute in zwei Pfaden mit unterschiedlichen Werten erfasst und in keinem gespeichert.

> **„Ab wann darf ein Kandidat erfahren, dass Sie es sind?“**

| | |
|---|---|
| Antworttyp | Auswahl (einfach), Vorbelegung aus dem Kundenstandard |
| Optionen | Sobald er ernsthaft interessiert ist · Nach dem ersten Gespräch · Erst nach Unterzeichnung einer Verschwiegenheitserklärung · Erst mit dem Angebot |
| Trigger | Direkt nach UE-13. |
| Uebersprungen wenn | Der Kunde hat einen Standard aus einem früheren Job — dann als Vorbelegung zeigen und bestätigen lassen. |
| „Weiss ich nicht“ | Voreinstellung 'nach dem ersten Gespräch' verwenden, aber sichtbar als Voreinstellung kennzeichnen, damit der Kunde sie im Zweifel korrigiert. |
| Zielfeld | `jobs.reveal_trigger text (Spalte fehlt in PROD, 42703). Die Werteliste muss über beide Pfade vereinheitlicht werden: PS-17 kennt drei Werte, IB-34 vier abweichende — 'Nach NDA' und 'Bei gegenseitigem Interesse' haben heute kein maschinelles Gegenstück.` |
| Folgefragen | – Gilt das auch für die Recruiter, oder dürfen die es früher wissen? |
| Widerspruchsregel | Bei 'Erst mit dem Angebot' und gleichzeitig hoher Dringlichkeit wird der Preis benannt: sehr späte Freigabe senkt die Zusagequote spürbar. |
| Starke Antwort | Nach dem ersten Gespräch. Vorher nicht, weil zwei unserer Wettbewerber im selben Ort sitzen und wir keine Gerüchte wollen. |
| Schwache Antwort | So spät wie möglich. |
| Wenn die Antwort fehlt | Die Freigabe passiert nach Code-Zufall statt nach Kundenwunsch. Das ist der Kern des heutigen Reveal-Split-Brains. |
| Zweck / Sensitivitaet | Prozess · DSGVO-relevant |

#### `UE-15` · Prozesslänge, Beteiligte und Reaktionsgeschwindigkeit — die drei Angaben, mit denen der Recruiter einen Kandidaten überhaupt halten kann.

> **„Wie viele Gespräche braucht es bei Ihnen realistisch bis zur Zusage?“**

| | |
|---|---|
| Antworttyp | Chips plus Freitext |
| Optionen | Zwei Gespräche, unter zwei Wochen · Zwei Gespräche plus Aufgabe · Drei oder mehr · Noch nicht festgelegt |
| Trigger | Gegen Ende. Bei Bestandskunden wird der Prozess des letzten Jobs vorgeschlagen und nur bestätigt. |
| Uebersprungen wenn | Prozess aus einem früheren Job desselben Kunden bekannt — dann bestätigen. |
| „Weiss ich nicht“ | Nicht überspringen, sondern zur Beratung machen: 'Zwei Runden in zwei Wochen ist das, was wir bei vergleichbaren Stellen empfehlen — passt das?' Aus einer Wissenslücke wird eine Entscheidung. |
| Zielfeld | `intake_payload.process.rounds, process.decision_makers, process.response_sla (Spalte fehlt in PROD, 42703). Ersetzt CJ-27 und IB-29, die heute beide erfasst und beide verworfen werden.` |
| Folgefragen | – Wer sitzt in welcher Runde?<br>– Wer sagt am Ende ja oder nein?<br>– Wie schnell schaffen Sie eine Rückmeldung zu einem Vorschlag — ein Tag, drei Tage, eine Woche? |
| Widerspruchsregel | Bei drei oder mehr Runden und gleichzeitig 'sehr dringend' wird der Widerspruch benannt und eine Zusammenlegung vorgeschlagen. |
| Starke Antwort | Erst ein Videogespräch mit mir, dann ein Termin vor Ort mit dem Fachbereich und der Geschäftsführung. Zwischen beiden liegen maximal zehn Tage. |
| Schwache Antwort | Das machen wir, wenn wir jemanden sehen. |
| Wenn die Antwort fehlt | Der Recruiter kann dem Kandidaten nicht sagen, worauf er sich einlässt. Absprünge passieren genau in dieser Unklarheit. |
| Zweck / Sensitivitaet | Prozess · normal |

#### `UE-16` · Auflösung eines erkannten Widerspruchs zwischen zwei Angaben, bevor er in die Datenbank und damit ins Recruiter-Briefing wandert. Das ist die Meta-Karte des Dialogs — sie

> **„Kurze Rückfrage, damit ich es richtig weitergebe: Vorhin hieß es {A}, gerade eben {B}. Was gilt?“**

| | |
|---|---|
| Antworttyp | Auswahl zwischen den beiden Werten plus Freitext für 'beides, aber unterschiedlich' |
| Optionen | Es gilt {A} · Es gilt {B} · Beides — ich erkläre es kurz |
| Trigger | Automatisch, sobald der Konflikt-Prüfer anschlägt — serverseitig bei Feldpaaren (Arbeitsmodell gegen Bürotage, Gehalt gegen Erfahrungslevel, Firmenstandard gegen Job-Wert, Ziel-Firma gegen Sperrliste), durch die KI bei sprachlichen Widersprüchen. Maximal zwei solcher Karten pro Sitzung, sonst wirkt es wie ein Verhör. |
| Uebersprungen wenn | Kein Konflikt erkannt — dann feuert die Karte nie. |
| „Weiss ich nicht“ | Beide Werte bleiben stehen und werden im Recruiter-Briefing ausdrücklich als 'nicht geklärt' geführt. Nie stillschweigend einen der beiden gewinnen lassen — genau das passiert heute bei remote_type gegen remote_policy. |
| Zielfeld | `Das jeweils betroffene Feld wird überschrieben und bekommt source='kunde_explizit' plus confidence='hoch'; der aufgelöste Konflikt bleibt in intake_payload.conflicts protokolliert (Spalte fehlt in PROD, 42703)` |
| Folgefragen | – Und gibt es sonst noch etwas zu dieser Stelle, wonach ich nicht gefragt habe? |
| Widerspruchsregel | Widerspruch und Zielkonflikt werden strikt getrennt geführt: Widerspruch heißt 'zwei Aussagen, eine muss falsch sein' und wird gefragt. Zielkonflikt heißt 'beides ist wahr und passt nicht zusammen' und wird beraten, nicht gefragt. |
| Starke Antwort | Drei Tage vor Ort sind die Regel. Die zwei Tage im Profil sind unser Standard, für diese Stelle gilt er nicht, weil das Labor vor Ort ist. |
| Schwache Antwort | Passt beides irgendwie. |
| Wenn die Antwort fehlt | Der Widerspruch erreicht den Recruiter unaufgelöst. Er entscheidet sich für eine der beiden Aussagen und liegt in der Hälfte der Fälle falsch. |
| Zweck / Sensitivitaet | Matching · normal |

**Beispieldialog**

```
Situation: Der Kunde hat eine Stellenanzeige für einen Leiter Finanzbuchhaltung eingefügt. Der Parser hat Titel, Standort, Arbeitsmodell und ein Gehaltsband erkannt; das Firmenprofil liefert Branche und Größe.

[UE-01 · Bestätigungskarte]
Matchunt: Ich habe aus Ihrer Anzeige und Ihrem Firmenprofil das hier übernommen: Leiter Finanzbuchhaltung, Stuttgart, hybrid mit zwei Bürotagen, 85.000 bis 92.000 Euro, Maschinenbau. Stimmt das so für diese Stelle?
Kunde: [klickt „Ich korrigiere etwas"] Drei Tage vor Ort, nicht zwei.
Matchunt: Notiert — drei Bürotage. Gilt das nur für diese Stelle oder ab jetzt für alle?
Kunde: Nur hier. Das Team sitzt zusammen.
(Fünf Slots in einem Zug geschlossen, ein Wert korrigiert, Herkunft für alle fünf steht jetzt auf „vom Kunden bestätigt". Ohne diese Karte wären das nach heutiger Logik fünf einzelne Fragen gewesen.)

[UE-02 · Die Woche]
Matchunt: Wenn Sie sich eine ganz normale Arbeitswoche dieser Person vorstellen: Welche drei Dinge füllen den größten Teil davon?
Kunde: Monatsabschluss, die zwei Auslandsgesellschaften, und die Ablösung unseres Altsystems.

[UE-05 · Skill-Tiefe — hier kommt die ausweichende Antwort]
Matchunt: Sie haben SAP als Muss genannt. Muss die Person damit täglich gearbeitet haben, damit ein Projekt verantwortet haben — oder es selbst eingeführt haben?
Kunde: Gute SAP-Kenntnisse eben, das Übliche.
(Erkannt als schwache Antwort: kein Modul, kein Kontext, keine Tiefe. Genau eine Nachfrage, nicht zwei.)
Matchunt: Sie haben gerade die Ablösung des Altsystems genannt — heißt das, die Person begleitet einen Wechsel auf S/4? Dann ist die Frage nicht, ob sie SAP kennt, sondern ob sie so etwas schon einmal mitgemacht hat.
Kunde: Ah, so gemeint. Ja: FI und CO produktiv, und mindestens einen Rollout begleitet. Reine Anwenderkenntnis reicht nicht.
Matchunt: Danke. Ich gebe das so weiter: FI und CO produktiv, mindestens ein begleiteter Rollout, S/4-Umfeld.
(Ergebnis: aus einem nicht matchbaren Wort „SAP" wurde eine Anforderung mit Modul, Tiefe und Umgebung — durch eine einzige Nachfrage, die sich auf eine frühere Antwort des Kunden stützt statt auf eine Standardformulierung.)

[UE-06 · Härtekarte, ausgelöst durch sieben Muss-Kriterien]
Matchunt: Von Ihren sieben Muss-Kriterien: Bei welchen zwei würden Sie sich jemanden trotzdem ansehen, wenn alles andere überzeugt?
Kunde: Eigentlich bei keinem, sonst stünde es nicht da.
Matchunt: Verstehe. Dann anders gefragt: Wenn Sie in vier Wochen niemanden gesehen haben — welches Kriterium fällt als Erstes?
Kunde: Die Maschinenbau-Erfahrung. Und ehrlich gesagt auch das BWL-Studium.
(Aus „alles ist fix" wurden zwei verhandelbare Kriterien — nicht durch Druck, sondern durch eine Frage, die dem Kunden erlaubt, sich später umzuentscheiden.)

[UE-10 · Vergütungsdecke — zweite ausweichende Antwort]
Matchunt: Die Zahl sehen weder Kandidaten noch Ihre Anzeige, sie ist nur der Verhandlungsspielraum unserer Recruiter. Wenn in vier Wochen genau die richtige Person vor Ihnen sitzt und acht Prozent über Ihrem Maximum liegt — machen Sie das?
Kunde: Wir sind da flexibel.
(Erkannt als schwache Antwort: „flexibel" ist keine Zahl und für einen Recruiter wertlos.)
Matchunt: Das hilft mir schon. Damit der Recruiter weiß, wo er verhandeln darf: Bis zu welcher Zahl entscheiden Sie selbst — und ab wann brauchen Sie jemanden dazu?
Kunde: Bis 98.000 entscheide ich allein. Darüber die Geschäftsführung, das dauert dann etwa eine Woche.
Matchunt: Danke. Ich vermerke 98.000 als Ihre eigene Grenze und den Weg darüber mit einer Woche Vorlauf — das bleibt intern.

[UE-16 · Widerspruchskarte, automatisch ausgelöst]
Matchunt: Kurze Rückfrage, damit ich es richtig weitergebe: Ihr Firmenprofil führt hybrid mit zwei Bürotagen, für diese Stelle haben Sie drei genannt. Was gilt?
Kunde: Drei. Der Abschluss läuft nun mal vor Ort.
Matchunt: Danke. Und gibt es sonst noch etwas zu dieser Stelle, wonach ich nicht gefragt habe?
Kunde: Ja — die Person übernimmt in zwei Jahren wahrscheinlich die gesamte Finanzleitung. Das ist unser bestes Argument.
(Genau diese Angabe hätte keine vorformulierte Frage je eingesammelt. Deshalb steht die offene Auffangfrage am Ende und nicht am Anfang: an dieser Stelle ist der Kunde bereits im Erzählmodus.)
```
