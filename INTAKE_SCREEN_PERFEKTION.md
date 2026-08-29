# Jobaufnahme — Screen-Perfektionierung

**Stand:** 2026-08-29 · **Grundlage:** Live-Durchklick durch 9 Zustaende + 8 Fachagenten (7 Linsen + Red Team)

Begleitdokument zu [ONBOARDING_INTAKE_MASTERANALYSE.md](ONBOARDING_INTAKE_MASTERANALYSE.md).

**101 Feature-Vorschlaege eingereicht, 17 haben die Pruefung des Red Teams ueberstanden.** Der Rest ist unten mit Begruendung gestrichen oder zurueckgestellt.


> ### Korrektur in eigener Sache
>
> Das Red Team hat meine eigene Erhebung angegriffen — mit Recht. In der Aufgabenstellung an die Agenten
> stand, ich haette alle neun Zustaende "selbst im Browser erfasst". Das ist fuer **S3, S4 und S5 irrefuehrend**:
> Diese drei Zustaende sind in Produktion **nicht erreichbar**, weil `parse-job-url` mit
> `NOT_FOUND_FUNCTION_BLOB` antwortet und `startBuild` ohne Job-Objekt nie auf Stufe `built` kommt.
> Ich habe sie nur sichtbar gemacht, indem ich im Browser eine Antwort-Attrappe fuer die fehlenden
> Edge Functions installiert habe (rein clientseitig, kein Schreibvorgang, danach entfernt).
>
> Die Beobachtungen zum Aufbau dieser Screens bleiben gueltig — es ist derselbe Komponentenbaum.
> Aber die Reihenfolge der Massnahmen aendert sich dadurch: **Jedes Feature fuer S3/S4/S5 setzt voraus,
> dass diese Screens ueberhaupt erreichbar werden.** Genau darauf laeuft die Kernthese des Red Teams hinaus.


---

## Das Urteil der acht Agenten

| Screen | | erstklassig | solide | zu starr | schaedlich |
|---|---|---|---|---|---|
| **S1** | Dashboard-Kachel „Stelle ausschreiben" | — | **5** | 3 | — |
| **S2** | Studio · Eingabe | — | 1 | **7** | — |
| **S3** | Studio · Aufbau-Animation | — | — | — | **8** |
| **S4** | Studio · Profil + Briefing (Festanstellung) | — | — | **7** | 1 |
| **S5** | Studio · Contracting | — | — | 4 | 4 |
| **S6** | Alter Pfad · Einstieg | — | — | — | **8** |
| **S7** | Alter Pfad · manuelles Formular | — | **5** | 2 | 1 |
| **S8** | Einstellungen · Firmenprofil | — | 1 | — | **7** |
| **S9** | Job-Detail (Cockpit) | — | — | 3 | **5** |

Kein einziger Screen wurde von einem einzigen Agenten als *erstklassig* bewertet. Bei **S3** und **S6** waren sich alle acht einig: schaedlich.


---

## Screen fuer Screen


### S1 · Dashboard-Kachel „Stelle ausschreiben"

**Urteil:** 5x solide · 3x zu starr

> **Red Team (zu starr):** BEWIESEN: Die Entwurfs-Abfrage in NeueStelleBar.tsx:38-44 filtert nur .eq('status','draft') — KEIN client_id/user-Filter. Sie verlaesst sich vollstaendig auf die RLS-Policy 'Client team can view their jobs' (20260710130000_client_team_foundation.sql:442), die organisationsweit liest. Der Chip 'Fortsetzen' kann damit den Entwurf eines Kollegen zeigen, und resumeDraft macht darauf select('*'). Zweitens: die Kachelzahl ist falsch (AktiveJobsTile.tsx:19 count={jobs.length}, waehrend :41 einzelne Zeilen als 'In Freigabe' badged). Drittens — und das hat keiner der sieben gesehen: RecruiterActivityIndicator zeigt 'N Recruiter arbeiten' im Praesens mit pulsierendem gruenem Punkt, aber N ist die Zahl DISTINKTER recruiter_id ueber ALLE submissions des Jobs, inklusive abgelehnter und archivierter (client-dashboard-data/index.ts:279-285 + :320). Ein Recruiter, der vor 200 Tagen einmal eingereicht hat und abgelehnt wurde, erscheint dauerhaft als 'arbeitet'.


**Zielzustand:** (1) .eq('client_id', user.id) in die Draft-Abfrage, unabhaengig von RLS. (2) count aus jobs.filter(status==='published'); Freigaben als eigene Zeile. (3) RecruiterActivityIndicator: uniqueRecruiters nur ueber submissions mit aktivem Status, und Beschriftung ins Perfekt ('N Recruiter haben eingereicht'). Erst danach ueber Aktivierungszahlen reden.


**conversion-behavioral** (zu starr) — (a) NeueStelleBar.tsx:103 — `openStudio('pdf')` muss im Studio den Dateidialog oeffnen: in JobIntakeStudio.tsx:284 neben `setShowUrl(initialSource === 'url')` ein `if (initialSource === 'pdf') queueMicrotask(() => fileRef.current?.click())`. (b) Draft-Chip (NeueStelleBar.tsx:117-126) um `intake_completeness` erweitern, Wortlaut: „Cloud Architect · noch 3 Fragen" statt nur des Titels. (c) AktiveJobsTile.tsx:19 — `count` nur ueber `jobs.filter(j => j.status === 'published')`; die pending_approval-Zeilen bekommen eine eigene Zeile unter der Kachel: „3 warten seit 12 Tagen auf Freigabe" mit Deeplink.
  
*Vorbild:* BEWIESEN NeueStelleBar.tsx:103 + JobIntakeStudio.tsx:284 (kein 'pdf'-Zweig); BEWIESEN AktiveJobsTile.tsx:19 vs :41. BELEGT: Restaufwand am Wiedereinstieg ist in Steuer-/Onboarding-Software (Taxfix, Typeform) Standard.

**live-daten** (solide) — (1) Jede BentoTile bekommt eine zweite Zeile mit dem 7-Tage-Delta aus dem bereits geladenen Datensatz: 'Bewerbungen 10 · +3 diese Woche' bzw. bei 0 ehrlich 'unverändert seit 14 Tagen'. Datenquelle: die bereits im Hook vorhandenen submitted_at je Submission, kein neuer Query. (2) activeRecruiters in useJobStats.ts:54 umbenennen in 'einreichendeRecruiter' und den Health-Faktor 3 entweder streichen oder mit einer echten Aktivierungszahl speisen (Feature 6). (3) Fusszeile der NeueStelleBar ersetzen durch die wahre Erwartung: 'Profil in Sekunden · danach ca. 8-12 Fragen · jederzeit abbrechbar'.
  
*Vorbild:* src/hooks/useJobStats.ts:54; src/components/dashboard/bento/AktiveJobsTile.tsx:46-52; src/components/jobs/JobHealthIndicator.tsx:38-61. Vorbild fuer Delta-Zeilen: Stripe-Dashboard-Kacheln ('vs. previous period').

### S2 · Studio · Eingabe

**Urteil:** 7x zu starr · 1x solide

> **Red Team (zu starr):** BEWIESEN: handleBuild (JobIntakeStudio.tsx:265-268) kennt genau zwei Wege, beide ueber Edge Functions. useJobParsing.parseJobText ruft NICHT eine Text-Function, sondern ebenfalls 'parse-job-url' (useJobParsing.ts:88) — und die antwortet produktiv HTTP 404 mit sb-error-code: NOT_FOUND_FUNCTION_BLOB. Das ist kein 'noch nicht deployed', das ist eine registrierte Function ohne Code-Blob, also ein kaputter Deploy. Folge: startBuild bekommt null, wirft den Toast 'Konnte keine Stelle erkennen' und setzt zurueck auf 'input'. In Produktion ist Stufe 'built' vom Einstieg aus UNERREICHBAR.


**Zielzustand:** Vierter Primaerknopf 'Ohne Vorlage starten' → startBuild mit BuiltJob{title: seed} direkt auf 'built'. Das ist ein Zehnzeiler und macht das gesamte Studio erstmals unabhaengig vom Deploy-Zustand. Alle Vorschlaege der sieben zu S4/S5 sind bis dahin unbaubar bzw. unpruefbar.


**live-daten** (zu starr) — Unter der Textarea eine Zeile mit dem, was Matchunt ueber genau diese Rolle schon weiss, sobald der Titel getippt ist: 'Sie hatten 2026 bereits eine Stelle mit diesem Titel — 26 Profile geprueft, 0 freigegeben. Wir zeigen Ihnen unterwegs, woran es lag.' Query: jobs WHERE client_id = auth.uid() AND title ILIKE …, dann match_outcomes WHERE job_id IN (…). Wenn der Kunde noch keine Historie hat: nichts anzeigen, statt einen generischen Satz zu erfinden.
  
*Vorbild:* RLS-Policy 'Clients can view match outcomes for their jobs' existiert bereits: supabase/migrations/20251213030355_2b592422-1978-4c82-b080-c073cb44d732.sql:86-88.

**conversion-behavioral** (zu starr) — Drei Startkarten statt einer Textarea, in der Reihenfolge des Aufwands: „Ich habe eine Anzeige" (PDF/Link/Text) · „Ich habe nur den Titel" (ein Feld, direkt zu built) · „Ich fange bei Null an". Unter der Textarea eine Zeile im Wortlaut: „Ein Satz reicht. „Senior SAP-Berater, Frankfurt, hybrid" ist genug — den Rest fragen wir." Und: wenn `initialSource === 'pdf'`, darf der Primaerknopf nicht „Profil bauen" heissen, sondern „PDF auswaehlen".
  
*Vorbild:* BEWIESEN JobIntakeStudio.tsx:269-273 (handleBuild wirft toast.error bei leerem Feld). NEU: die Drei-Karten-Staffelung nach Aufwand.

### S3 · Studio · Aufbau-Animation

**Urteil:** 8x schaedlich

> **Red Team (schaedlich):** Die Inszenierung ist real, aber alle drei Agenten, die sie beschreiben, uebertreiben sie an einer Stelle. BEWIESEN: buildFromText setzt stage='building' VOR dem await (JobIntakeStudio.tsx:253) — der Spinner waehrend des echten Calls ist ehrlich. Erfunden ist nur der Schwanz: startBuild setzt setReveal(0) + stage='building' erneut, und der useEffect (:316-324) deckt facts.length=7 Zeilen a 280 ms plus 350 ms auf = ca. 2,3 s auf fertigen Daten. conversion-behavioral schreibt 'startBuild setzt built VOR dem Umschalten auf building' und suggeriert, die ganze Stufe sei Theater — das ist falsch und wuerde zur falschen Reparatur fuehren (Stufe loeschen statt Timer loeschen).


**Zielzustand:** Nur den Reveal-Timer (:316-324) entfernen und stage direkt auf 'built' setzen. Die Zeile 'Tagessatz: noch ergaenzen' (:194) aus der Faktenliste nehmen — sie traegt ein Haekchen fuer eine offene Aufgabe. Kein Ersatz-Feature, keine 'echten Pruefungen in der Wartezeit' (senior-headhunter): eine Wartezeit, die man abschaffen kann, fuellt man nicht.


**live-daten** (schaedlich) — Animation ersatzlos streichen (JobIntakeStudio.tsx:317-323 entfernen, direkt setStage('built')). Stattdessen im built-Zustand jede Faktenzeile mit einem Herkunfts-Badge versehen: 'aus Ihrer Anzeige' / 'aus Ihrem Firmenprofil' / 'geschaetzt' / 'offen'. Die Datenbasis dafuer existiert bereits — profileFacts (Zeile 167-169) und docFacts (Zeile 172-183) unterscheiden bereits die Herkunft, sie wird nur zu einer Summenzahl aggregiert statt pro Feld angezeigt. Tagessatz-Zeile: `isFreelance ? (dayRateLabel || 'noch ergänzen')`.
  
*Vorbild:* src/components/dashboard/JobIntakeStudio.tsx:195, 317-323. Vorbild fuer Feld-Provenienz: Notion-AI und Gmail Smart Compose markieren maschinell erzeugte Felder statt Ladebalken zu zeigen.

**conversion-behavioral** (schaedlich) — Den Reveal-Effekt loeschen (JobIntakeStudio.tsx:316-324) und `startBuild` direkt auf 'built' setzen. Die frei werdende Aufmerksamkeit in den Beleg investieren, der beim Oeffnen von 'built' einmalig einblendet: „Aus Ihrer Anzeige gelesen: 13 Angaben. 4 davon haben wir geschaetzt — sie sind gelb markiert." Zeilen ohne Wert bekommen kein Haekchen, sondern einen offenen Kreis und den Text „von Ihnen zu ergaenzen".
  
*Vorbild:* BEWIESEN JobIntakeStudio.tsx:244-250, :316-324, :195. BELEGT: kuenstliche Ladezeit erhoeht wahrgenommenen Wert nur bei UNSICHTBARER Arbeit; hier ist die Arbeit sichtbar vorher passiert (der Parse-Call), die Animation wird als Verzoegerung gelesen.

### S4 · Studio · Profil + Briefing (Festanstellung)

**Urteil:** 7x zu starr · 1x schaedlich

> **Red Team (schaedlich):** Nicht 'zu starr' — schaedlich, und aus einem Grund, den keiner der sieben zu Ende gedacht hat: der Screen erzeugt in Produktion eine Stelle OHNE JEDES BRIEFING, in beiden Spalten. BEWIESEN: (a) intake_payload existiert produktiv nicht (REST 42703), also faellt insertJobWithIntake auf den Basis-Insert zurueck (intakeCapture.ts:52-57) und verwirft briefing_dynamic, skill_requirements, flexibility, contracting, draft_state. (b) briefing_notes wird aus serializeBriefing(answers) gebaut (JobIntakeStudio.tsx:349) — 'answers' wird im KI-Pfad aber NIE gefuellt, es enthaelt nur prefillFromBuilt (IntakeBriefing.tsx:25-45). (c) Selbst wenn es gefuellt waere: recruiter_jobs_view fuehrt briefing_notes ausdruecklich nicht ('bewusst NICHT Teil dieser View', 20260725120000:100). Zweiter uebersehener Befund: die einzige Rechtspruefung des Produkts ist im Premium-Pfad tot. QualityCheck.tsx:26 + :55 testet AGG_PATTERN ausschliesslich gegen answers.exclusion_criteria — also gegen das statische Briefing. Im KI-Pfad kann diese Warnung strukturell nie feuern. Dritter Befund: persistSkillRequirements (:412-420) speist sich nur aus dyn.skillRequirements; im Fallback-Pfad — dem einzigen, der produktiv laeuft — bekommt job_skill_requirements NULL Zeilen, obwohl must_haves bekannt sind. Und weight ist hart 1.0/0.5, die Flexibilitaetsmatrix wird also nicht bloss 'nicht gescort', sie wird von einer Konstant


**Zielzustand:** (1) Kein Feld ohne Ziel: Felder, deren Spalte fehlt, werden ausgeblendet oder sichtbar als 'wird noch nicht gespeichert' markiert; extendedPersisted (liegt bereits im Rueckgabewert von insertJobWithIntake) auswerten und im Erfolgsbildschirm ehrlich melden. (2) AGG_PATTERN zusaetzlich gegen dyn.answers laufen lassen — drei Zeilen. (3) persistSkillRequirements zusaetzlich aus built.must_haves/nice_to_haves speisen und weight aus flexibility ableiten (fix 1.0 / verhandelbar 0.6 / flexibel 0.3). (4) BEIDE Fortschrittszahlen streichen und durch Namen ersetzen ('offen: Vakanzgrund, Erfolg nach 12 Monaten'). Nicht 'eine Zahl mit Schwelle' (interaction-design) und nicht 'vier Reifestufen' (conversion-behavioral): beide erfinden ihre Schwelle. Ein Score, der bei 0 Antworten und vollem Formular schon 40/100 und 'mittel' steht, misst Formularausfuellen, nicht Briefing-Qualitaet.


**conversion-behavioral** (zu starr) — Fuenf Eingriffe, alle in DynamicBriefing/QualityCheck/JobIntakeStudio. (A) Aufwandsvertrag: Kopfzeile ersetzt „42 %" durch „Frage 3 · noch etwa 4 · ca. 2 Minuten"; vor Frage 1 einmalig im Fragen-Panel: „7 Fragen, etwa 4 Minuten. Danach sucht ein Recruiter fuer Sie, ohne Rueckfrage. Abbrechen geht jederzeit — Ihre Antworten bleiben gespeichert." Waechst die Schaetzung, wird sie benannt statt still korrigiert: „Ihre Antwort hat ein Thema aufgemacht (Fuehrungsverantwortung). Das kostet 2 Fragen mehr — dafuer sucht der Recruiter nicht am Profil vorbei." (B) Antwort-Echo: unter der beantworteten Frage 3 Sekunden lang „→ Steht jetzt im Profil: Erfolg nach 12 Monaten = „Migration live, Altsystem aus".", gleichzeitig erscheint der Satz sichtbar links. Die linke Spalte darf nie stillstehen, waehrend rechts gefragt wird. (C) „Weiss ich nicht" verliert die Chip-Form: als muted Textlink UNTER dem Fr
  
*Vorbild:* BEWIESEN: DynamicBriefing.tsx:235/239-246/183/264-272, IntakeBriefing.tsx:417/438-443/462/476, QualityCheck.tsx:79/113-115/117, JobIntakeStudio.tsx:632/641/735, intake-questions/index.ts Regel 4 + 7. Nachgerechnet: 42*0,6+100*0,4 = 65. BELEGT: benannter Fortsc

**interaction-design** (zu starr) — ZIELSTRUKTUR der rechten Spalte, von oben: (1) Eine rahmenlose Statuszeile, ca. 40 px: horizontale Kette der 11 Kapitel als Punkte (erledigt gefuellt, aktuell als Ring, offen als 2-px-Punkt) plus rechts EINE Zahl 'Reife 65 · reicht ab 60'. (2) DIE FRAGE als einziger Karten-Container mit Rahmen, position:sticky top-0, Schriftgrad eine Stufe groesser als der Rest der Spalte (text-base statt text-sm), Antwortchips als Primaerelemente, 'Weiss ich nicht' als Textlink UNTER dem Freitextfeld statt als gleich grosser Chip, darunter der leise Ausstieg 'Reicht mir so — uebergeben (fehlt dann: Vakanzgrund, Erfolg nach 12 Monaten)'. (3) Trennlinie, darunter die sekundaere Zone: der gruene Vertrauensblock schrumpft auf eine Zeile ohne Rahmen; die Kapitelliste mit den 9 grauen Kreisen entfaellt vollstaendig (die Kette oben ersetzt sie) und ist nur ueber 'Kapitel anzeigen' erreichbar; die Reife-Karte e
  
*Vorbild:* BELEGT — one-question-at-a-time mit Schrittkette und Restanzahl ist die etablierte Form (Typeform, Stripe-Onboarding). Sticky-Fokus mit sekundaerer Zone darunter: Linear Issue-Erstellung.

### S5 · Studio · Contracting

**Urteil:** 4x schaedlich · 4x zu starr

> **Red Team (schaedlich):** BEWIESEN: jobs hat weder day_rate_min/max noch duration_months (REST 42703), und intake_payload.contracting existiert ebenfalls nicht. Der gesamte Konditionsblock (ProfileSections.tsx:139-182) schreibt ins Nichts, still, mit Erfolgsmeldung. Der Fragenbaum ist in intake-questions/index.ts:39-51 eine einzige CHAPTERS-Konstante fuer beide Vertragsarten; die Gabelung ist eine Prompt-Zeile. Nebenbefund gegen die Beobachtung: der statische Katalog, der produktiv als einziger laeuft, hat 10 Kapitel ('Kontext'…'Sichtbarkeit', IntakeBriefing.tsx:58), nicht die beobachteten 11.


**Zielzustand:** Reihenfolge gegen drei Agenten: ZUERST fuenf Spalten (day_rate_min, day_rate_max, duration_months, utilization_days_per_week, extension_possible), DANN der Kapitelbaum. Bis die Spalten stehen: den Block ausblenden oder sichtbar als 'wird noch nicht gespeichert' kennzeichnen (so senior-headhunter, richtig) — nicht ihn um AUeG-Fragen erweitern (so feature-benchmark P0 'M'), die dann ebenfalls verschwinden. Die AUeG-/Scheinselbstaendigkeits-Fragen sind fachlich zwingend, aber eine juristisch heikle Antwort, die still verworfen wird, ist schlimmer als eine ungestellte Frage.


**conversion-behavioral** (zu starr) — In intake-questions/index.ts zwei Kapitel-Konstanten (CHAPTERS_PERM / CHAPTERS_CONTRACT) und `enum: CHAPTERS` im OUTPUT_SCHEMA aus dem gewaehlten Satz speisen. Contracting-Kapitel: Deliverables & Abnahme · Skill-Tiefe · Tagessatz & Budgetdecke · Auslastung, Dauer, Verlaengerung · Equipment & Zugaenge · Selbstaendigkeits-Abgrenzung · Triple-Blind. Im Studio der Aufwandsvertrag in Contracting-Sprache: „4 Fragen, keine 3 Minuten. Danach kann ein Recruiter Ihnen Profile schicken, die morgen starten koennen." Und ProfileSections.tsx:195 — die Zeile „Tagessatz" im Reveal darf kein Haekchen bekommen, solange sie leer ist.
  
*Vorbild:* BEWIESEN intake-questions/index.ts:39-51 (eine Kapitelliste fuer beide Vertragsarten) + :26 (Fork nur als Prompt-Regel); BEWIESEN JobIntakeStudio.tsx:195. NEU: der Contracting-Kapitelsatz.

**ai-capability** (schaedlich) — Die Konstante CHAPTERS in intake-questions:39-51 auf zwei Sets aufteilen und je nach `contract_type` das passende in Schema-Enum und Prompt einsetzen: für freelance „Leistung & Abnahme", „Weisung & Abgrenzung (AÜG)", „Equipment & Zugänge", „Laufzeit & Verlängerung" statt „Vergütung & Flexibilität", „Sell & Story (EVP)", „Prozess & Entscheider". Das ist ein reiner Prompt- und Enum-Eingriff in einer Datei, kein neues Modell und keine neue Datenquelle. Zusätzlich den hartcodierten String „noch ergänzen" (JobIntakeStudio.tsx:195) durch den echten Wert aus `freelance.dayRateMin/Max` ersetzen, sobald er gesetzt ist.
  
*Vorbild:* BEWIESEN: intake-questions:39-51 (feste Kapitelliste) gegen Regel 1 im System-Prompt. NEU: das Contracting-Kapitelset.

### S6 · Alter Pfad · Einstieg

**Urteil:** 8x schaedlich

> **Red Team (schaedlich):** Unstrittig zwischen allen sieben und von mir bestaetigt: drei prominente Import-Kacheln, deren Functions 404 liefern, und der funktionierende Weg klein darunter (CreateJob.tsx:910). Ergaenzung: die Ueberschrift verspricht 'In unter 60 Sekunden – dank KI-Import' fuer genau die drei toten Wege.


**Zielzustand:** Kacheln deaktivieren mit Grund, manuell nach oben. Die von vier Agenten geforderte Umleitung von /dashboard/jobs/new auf das Studio ist heute FALSCH und wuerde den Kunden in eine Sackgasse leiten: das Studio ist ohne parse-job-url nicht ueber Stufe 'input' hinaus zu bringen. Reihenfolge: erst der manuelle Studio-Einstieg (S2), dann die Umleitung, dann CreateJob loeschen.


**conversion-behavioral** (schaedlich) — /dashboard/jobs/new auf das Studio umleiten (App.tsx:165-169) und CreateJob.tsx nur so lange als Notfallpfad behalten, bis das Studio ohne Edge Function auskommt. Bis dahin: Ueberschrift ehrlich machen — statt „In unter 60 Sekunden fertig" der Wortlaut „Anzeige einlesen oder selbst ausfuellen — beides fuehrt zum selben Briefing." Und die Kachel-Hierarchie umkehren: der funktionierende Weg wird die grosse Karte.
  
*Vorbild:* BEWIESEN CreateJob.tsx:712, :910, :980; App.tsx:165. BELEGT: Versprechen mit Zeitangabe im Hero sind nur tragfaehig, wenn der Median gemessen ist.

**senior-headhunter** (schaedlich) — /dashboard/jobs/new auf das Studio umleiten und das manuelle Formular als Reiter „Alle Felder" innerhalb des Studios weiterverwenden — dort sitzen die Felder (Team-Größe, Kernarbeitszeit, Überstunden, Entscheider), die die Spalten jobs.team_size/core_hours/overtime_policy/decision_makers füllen können, die produktiv existieren und heute niemand beschreibt.
  
*Vorbild:* BELEGT — ein zweiter, halb toter Anlegepfad ist in jedem ATS die Hauptquelle für Datenmüll; Personio/Greenhouse führen genau einen.

### S7 · Alter Pfad · manuelles Formular

**Urteil:** 5x solide · 2x zu starr · 1x schaedlich

> **Red Team (solide):** Hier widersprechen sich die Agenten, und beide Seiten haben teilweise unrecht. BEWIESEN: vacancy_reason, hiring_urgency, reports_to, onsite_days_required und team_size existieren produktiv (REST 200) — und das Studio SCHREIBT vier davon bereits (JobIntakeStudio.tsx:349-352). Falsch ist also die von drei Agenten wiederholte Behauptung, das Studio erhebe diese Felder nicht und schreibe sie nur nach intake_payload: die Felder existieren im BuiltJob-Typ und treffen echte Spalten. Was fehlt, ist ausschliesslich, dass jemand DANACH FRAGT — sie werden heute nur befuellt, wenn die Anzeige sie zufaellig enthaelt. Der Grammatikfehler in CreateJob.tsx:1587 ist bestaetigt; zusaetzlich duzt auch dieser Screen (CreateJob.tsx:573 'Bitte fuelle die Pflichtfelder aus') — das Duzen ist also kein reines Settings-Problem.


**Zielzustand:** Drei deterministische Chip-Fragen (Vakanzgrund, Dringlichkeit, Entscheider) VOR dem KI-Briefing in S4, direkt auf die vorhandenen Spalten. Das ist Aufwand S, nicht M — kein Schema, keine Function, keine Migration. Mehrere Agenten haben es als groesseren Umbau eingepreist.


**conversion-behavioral** (solide) — (a) CreateJob.tsx:1587 auf „{n} von {gesamt} Pflichtfeldern fehlen" korrigieren. (b) Die sechs Quick Questions als garantierten Pflichtblock in den Studio-Aufwandsvertrag heben: sie sind endlich, zaehlbar und in 40 Sekunden beantwortet — genau der Einstieg, der den unendlichen KI-Korridor ertraeglich macht. Wortlaut vor dem Block: „Sechs Klicks, dann kennen wir Ihren Rahmen. Danach fragt die KI nur noch das, was in Ihrer Anzeige wirklich fehlt." (c) `candidates_in_pipeline` in den Studio-Fragenkatalog uebernehmen und die Antwort im Uebergabe-Beleg spiegeln: „Sie haben bereits 1-3 Kandidaten im Prozess — die Recruiter wissen das und liefern erst, wenn es dort haengt."
  
*Vorbild:* BEWIESEN QuickQuestionsSection.tsx:24-83 + :110-112; CreateJob.tsx:1587. BELEGT: ein kurzer, endlicher Block vor einem offenen Block (Anker-Effekt) ist Standard in mehrstufigen Formularen.

**feature-benchmark** (zu starr) — Die sechs Quick Questions als gesetzte Pflicht-Chips in das Studio ziehen: sie werden VOR dem KI-Briefing gestellt (sie sind billig, immer beantwortbar und steuern die Priorisierung der KI-Fragen), und ihr Ergebnis geht als Kontext in jobDraft (JobIntakeStudio.tsx:203-236) ein. 'Anzahl finaler Entscheider' und 'Kandidaten aktuell im Prozess' gehören zusätzlich in die Recruiter-Sicht — sie sagen dem Recruiter, wie schnell hier entschieden wird.
  
*Vorbild:* BELEGT — Vakanzgrund, Entscheider-Anzahl und Prozess-Timeline sind der Kern jedes klassischen Headhunter-Intakes und stehen in Greenhouse-Scorecards bzw. Ashby-Job-Setups an erster Stelle.

### S8 · Einstellungen · Firmenprofil

**Urteil:** 7x schaedlich · 1x solide

> **Red Team (schaedlich):** Bestaetigt: Duzen (ProfileCompletenessCard.tsx:65/68/89, ClientSettings.tsx:197/214/304/344/401), und der Nutzensatz ist unwahr — company_profiles hat SELECT nur fuer auth.uid()=user_id und Admins (20251204182100:89-104), recruiter_jobs_view joint die Tabelle nicht. Der eigentliche Konflikt liegt aber zwischen zwei Agenten: feature-benchmark will den Satz WAHR machen, indem Firmenfakten in die recruiter-sichtbare Klasse gehoben werden; senior-headhunter sagt, Mitarbeiterzahl + Jahresumsatz + Gruendungsjahr sind in Kombination mit Branche und Region genau die Enttarnungs-Trias.


**Zielzustand:** senior-headhunter gewinnt, und der View-Text gibt ihm recht: recruiter_jobs_view fuehrt company_size_band, funding_stage, tech_environment und benefits (20260725120000:64-75) — BAENDER, keine Exaktwerte. Also: Baender erheben, annual_revenue und founded_year aus der Vollstaendigkeitsrechnung streichen, durchgaengig siezen, und den Satz durch die belegbare Wirkung ersetzen ('fuellt Ihre Jobaufnahme vor' — JobIntakeStudio.tsx:146-167 liest genau das). Die Domain-Anreicherung, die feature-benchmark als P0 setzt, gehoert NICHT hierher: enrich-company-from-domain antwortet produktiv 404, wird ausschliesslich vom Outreach-Hook aufgerufen und schreibt nach outreach_companies, nicht nach company_profiles.


**feature-benchmark** (schaedlich) — (1) Auf Sie umstellen. (2) Den Satz entweder wahr machen (Firmenfakten in die reveal-gated Klasse der recruiter_jobs_view aufnehmen) oder durch die tatsächliche Wirkung ersetzen ('fließt in das anonyme Exposé, das Recruiter lesen'). (3) Neben dem Website-Feld ein 'Aus Website übernehmen' — ruft enrich-company-from-domain (bereits im Repo, produktiv genutzt über useCompanyEnrichment.ts:62) und füllt headcount, founding_year, revenue_range, industry, description und technologies vor, jedes Feld als Vorschlag markiert und einzeln bestätigbar. (4) Gewichtung: USP und Beschreibung zählen doppelt, Umsatz halb.
  
*Vorbild:* BELEGT — Stripe, Ramp, Brex und HubSpot füllen das Firmenprofil aus der Domain vor und lassen den Kunden nur bestätigen. Die Function dafür liegt hier bereits fertig im Repo.

**conversion-behavioral** (schaedlich) — (a) Durchgaengig siezen: „Ihr Firmenprofil ist zu 43 % vollstaendig". (b) Die Falschaussage ersetzen durch das, was das Produkt wirklich tut: „Jede Angabe hier spart Ihnen bei jeder neuen Stelle eine Frage. Zuletzt uebernommen: Branche, Standort, No-Go-Firmen." (c) `annual_revenue` aus requiredFields (:34) streichen — ein anonymes Mandat darf Umsatz nicht als Vollstaendigkeitspflicht fuehren; wenn ueberhaupt, dann als optionales Feld mit Begruendung. (d) Nach dem Speichern ein Beleg statt einer Bestaetigung: „Gespeichert. Bei Ihrer naechsten Stelle sind damit 3 Fragen weniger zu beantworten."
  
*Vorbild:* BEWIESEN ProfileCompletenessCard.tsx:34, :65, :68, :89; Gegenbeleg fuer die echte Wirkung: JobIntakeStudio.tsx:151-167 (profileFacts) und :608-624 (Anzeige „aus Ihrem Firmenprofil"). BELEGT: Vervollstaendigungs-Fortschritte konvertieren nur mit benanntem Nutze

### S9 · Job-Detail (Cockpit)

**Urteil:** 5x schaedlich · 3x zu starr

> **Red Team (schaedlich):** Bestaetigt: diagnoseJob kennt im 'laeuft'-Zweig keine Zeitschwelle (jobCockpit.ts:174-181), days wird berechnet und nur als Textparameter benutzt; leer_lang greift nur bei active.length===0 (:161). Bestaetigt: fuenf Akkordeons ohne defaultValue (ClientJobDetail.tsx:775). Bestaetigt: 'Firmen-Reveal: Nach dem 1. Interview' ist ein Fallback auf einen nicht existierenden Wert (raw.reveal_trigger ist undefined, ClientJobDetail.tsx:551 faellt in den letzten Zweig). Bestaetigt und am schwersten: JobBoostDialog.tsx:58-78 ist setTimeout(1000) + toast.success('Recruiter wurden benachrichtigt!') mit 'TODO' im Code. Ergaenzend zu allen sieben: der Reveal-Widerspruch ist nicht nur eine fehlende Spalte, sondern ein aktiver Trigger — reveal_company_on_opt_in (20260122110726:20-34) setzt company_revealed BEDINGUNGSLOS beim Opt-In, unabhaengig von jeder Kundenwahl. Selbst nach dem Deploy der Spalte wuerde das Dropdown weiter luegen.


**Zielzustand:** (1) Schwellen in diagnoseJob: >21 Tage 'warn', >45 Tage 'crit' — reine Logik, zwei i18n-Keys. (2) toast.success im Boost-Dialog sofort entfernen (2 Zeilen), Dialog vorerst durch eine echte notifications-Zeile an Matchunt ersetzen. (3) Akkordeon-Trigger mit Vorschauwerten, Stellendetails offen. (4) Reveal-Zeile ausblenden, bis reveal_trigger existiert UND der Trigger sie respektiert. Die Marktrueckmeldung ('9 Recruiter aktiviert, 2 eingereicht') ist richtig und baubar, aber NACH Punkt (1)-(2): eine neue Zahl neben einer falschen Zahl repariert nichts.


**conversion-behavioral** (schaedlich) — (a) jobCockpit.ts:174-181: vor dem 'laeuft'-Zweig eine Stillstandsregel — `days > 21` ⇒ tone 'warn' mit Schluessel 'stillstand', `days > 45` ⇒ 'crit'. Wortlaut de.ts: „Seit {{days}} Tagen keine Bewegung. {{name}} steckt seit dem {{date}} im Schritt „Interview"." Aktion: Deeplink in die Inbox, plus zweite Aktion „Mit Matchunt sprechen". (b) JobBoostDialog.tsx:58-78 ersatzlos entfernen oder auf echte Wirkung verdrahten; solange nichts passiert, darf kein `toast.success` erscheinen — bis dahin lautet die Karte ehrlich: „Diese Stelle bekommt keine Kandidaten. Wir schauen sie uns an und melden uns innerhalb von 24 Stunden." mit einem Klick, der eine echte Aufgabe erzeugt. (c) Statt fuenf zugeklappter Akkordeons ein offener Block „Was seit der Uebergabe passiert ist": Zahl der Recruiter, die das Mandat geoeffnet haben, Datum des letzten Vorschlags, letzte Marktrueckmeldung.
  
*Vorbild:* BEWIESEN jobCockpit.ts:160-181 (keine Zeitgrenze im 'laeuft'-Zweig), de.ts:808, JobBoostDialog.tsx:66-69 (`await new Promise(resolve => setTimeout(resolve, 1000))` + `toast.success`), JobsList.tsx:434-443 (Boost ist die einzige Primaeraktion fuer stale Jobs). 

**feature-benchmark** (zu starr) — Über die Akkordeons eine Marktleiste mit drei belegten Zahlen: aktivierte Recruiter (neue client-sichere Aggregat-View auf recruiter_job_activations, Schwelle ≥3 gegen Rückschlüsse), Vorschläge pro Woche im Trend, und — neu erhoben — Recruiter-Einwände in Kategorien ('Budget zu niedrig', 'Muss-Kriterien unrealistisch', 'Standort'). Das leer_lang-Banner (jobCockpit.ts:162-169) greift heute nur, wenn NULL aktive Bewerber existieren; die Regel muss zusätzlich 'kein neuer Vorschlag seit N Tagen' erfassen, sonst bleibt 'Alles in Arbeit' nach 187 Tagen stehen. rejection_reason als Banner ausspielen. Akkordeon 'Konditionen & Anonymität' um die echte Recruiter-Ansicht erweitern (siehe Feature 1).
  
*Vorbild:* BELEGT — Indeed und LinkedIn Employer zeigen Sichtbarkeits- und Reaktionszahlen pro Anzeige; Upwork und Malt zeigen 'X Anbieter haben sich Ihr Projekt angesehen'; Hired liefert strukturierte Marktrückmeldung zum Budget.

---

## Baureihenfolge — die 17 Massnahmen, die standgehalten haben

Reihenfolge des Red Teams. Alle P0 sind Aufwand S und **ohne Deploy oder Migration** machbar.

| # | Prio | Aufw. | Screen | Massnahme | Was der Kunde erlebt | Machbarkeit |
|---|---|---|---|---|---|---|
| 1 | P0 | S | S2 | **Manueller Studio-Einstieg ohne Edge Function** | Ein vierter Knopf 'Ohne Vorlage starten': Titel eintippen, sofort im zweispaltigen Profil stehen, alles von Hand editierbar. | heute mit Bordmitteln |
| 2 | P0 | S | S4 / S5 | **Kein Feld ohne Speicherziel** | Felder, die nirgends ankommen, sind nicht da. Beim Uebergeben steht, was wirklich gespeichert wurde — nicht nur 'Stelle eingereicht!'. | heute mit Bordmitteln |
| 3 | P0 | S | S4 | **Die drei Auftragsfragen deterministisch, vor der KI** | Drei Chip-Fragen in 20 Sekunden: Warum ist die Stelle offen? Wie dringend? Wer entscheidet? Danach erst die KI-Fragen. | heute mit Bordmitteln |
| 4 | P0 | S | S4 | **Die AGG-Pruefung im Premium-Pfad einschalten** | Nichts — bis er 'keine Berufsanfaenger ueber 45' tippt. Dann warnt das Produkt, in beiden Briefing-Pfaden. | heute mit Bordmitteln |
| 5 | P0 | S | S1 / S9 | **Die Recruiter-Zahl aufhoeren zu faelschen** | Statt '1 Recruiter arbeitet' (pulsierend gruen) steht 'zuletzt eingereicht vor 187 Tagen · aktuell niemand aktiv'. | heute mit Bordmitteln |
| 6 | P0 | S | S9 | **Alterung im Zug-Banner statt Dauergruen** | Ab 21 Tagen ohne Bewegung wird aus 'Alles in Arbeit — nichts zu tun' ein bernsteinfarbenes 'Seit 187 Tagen keine Bewegung' mit einer Aktion; ab 45 Tagen rot mit genau einer erzwungenen Entscheidung. | heute mit Bordmitteln |
| 7 | P0 | S | S4 | **Verhandelbarkeit sichtbar — und erstmals folgenreich** | Neben jedem Muss-Kriterium drei Segmente: Muss · Verhandelbar · Nice. Ein Klick setzt direkt. | heute mit Bordmitteln |
| 8 | P1 | S | S4 / S5 | **Geldfelder mit Waehrung, Trennung und Toleranz** | Im Feld steht '€ 75.000'. '75k', '75 000', '75.000' werden verstanden; beim Verlassen sauber formatiert. | heute mit Bordmitteln |
| 9 | P1 | M | S4 | **Ein Fokus, keine Zahl** | Rechts steht eine Frage, gross und klebend. Darueber eine duenne Zeile: 'beantwortet: 3 · offen: Vakanzgrund, Erfolg nach 12 Monaten, Absagegruende'. Keine Prozentzahl, kein Score. | heute mit Bordmitteln |
| 10 | P1 | S | S4 | **'Reicht mir so' im Fragefluss — ohne erfundenen Preis** | Unter jeder Frage: 'Reicht mir so — uebergeben. Offen bleiben dann: Vakanzgrund, Erfolg nach 12 Monaten.' | heute mit Bordmitteln |
| 11 | P1 | M | S4 / S9 | **Redaktions-Vorschau ueber die Function, die wirklich laeuft** | Ein Knopf 'So liest ein Recruiter Ihre Stelle' erzeugt die redigierte Fassung und zeigt daneben, welche Felder bis zum Reveal leer bleiben. | heute mit Bordmitteln |
| 12 | P1 | S | S8 | **Firmenprofil: wahre Gegenleistung, Baender statt Kennzahlen** | 'Ihr Firmenprofil ist zu 43 % vollstaendig. Jede Angabe spart Ihnen bei jeder neuen Stelle eine Frage. Zuletzt uebernommen: Branche, Standort, No-Go-Firmen.' Umsatz und Gruendungsjahr werden nicht mehr verlangt. | heute mit Bordmitteln |
| 13 | P1 | S | S4 (Vorbedingung fuer Reichweite und Gehaltsvergleich) | **Marktmessung VOR jeder Marktzahl** | Zunaechst nichts. Danach entweder eine belastbare Zahl oder dauerhaft keine. | Forschung |
| 14 | P1 | S | S4 | **Erfundene Marktzahlen aus dem KI-Prompt entfernen** | Der Spannungs-Hinweis nennt den Zielkonflikt, aber keine Marktzahl mehr. | nach Deploy vorhandener Functions |
| 15 | P1 | L | S4 / S9 | **Reveal-Regel, die haelt — oder gar keine** | Entweder drei Optionen, die die Datenbank durchsetzt, plus eine Zeile 'Ihre Identitaet wurde 2 Recruitern gezeigt, am 14.03. und 19.03.' — oder bis dahin gar kein Dropdown. | braucht neue Datenquelle |
| 16 | P2 | M | S9 | **Marktrueckmeldung: aktiviert vs. eingereicht** | '6 Recruiter haben Ihre Stelle aktiviert, 1 hat eingereicht. Letzte Aktivierung vor 3 Tagen.' | heute mit Bordmitteln |
| 17 | P2 | L | S5 | **Contracting: erst Spalten, dann Kapitel** | Zuerst: der Konditionsblock verschwindet oder traegt 'wird noch nicht gespeichert'. Danach: eigene Kapitel zu Deliverables, Abnahme, Weisungsbindung, Equipment, AUeG-Abgrenzung. | braucht neue Datenquelle |

### Warum jede Massnahme wirkt


**1. Manueller Studio-Einstieg ohne Edge Function** — P0/S, S2
- *Wirkung:* Weil ohne ihn nichts von allem anderen existiert. parse-job-url antwortet produktiv 404/NOT_FOUND_FUNCTION_BLOB, parseJobText benutzt dieselbe Function (useJobParsing.ts:88), und startBuild bricht bei null ab (JobIntakeStudio.tsx:238-243). Stufe 'built' ist heute vom Einstieg aus unerreichbar. Jedes S4-Feature der sieben Agenten steht auf diesem Zehnzeiler.
- *Datenvoraussetzung:* Keine. startBuild({title: seed, ...leere Defaults}) direkt aufrufen, stage auf 'built' setzen.

**2. Kein Feld ohne Speicherziel** — P0/S, S4 / S5
- *Wirkung:* BEWIESEN: intake_payload, reveal_envelope, reveal_trigger, search_difficulty, target_companies, nogo_companies, visa_sponsorship, experience_min/max — alle neun 'erweiterten' Spalten fehlen produktiv (REST 42703). intakeCapture.ts:52-57 verwirft sie als Block in einem console.warn und liefert extendedPersisted=false, das JobIntakeStudio.tsx:461 nicht auswertet. Der Kunde stellt Triple-Blind ein, beantwortet Fragen, bekommt eine Erfolgsmeldung — und die Stelle enthaelt kein Briefing, auch nicht in briefing_notes, weil serializeBriefing(answers) im KI-Pfad nur den Prefill sieht.
- *Datenvoraussetzung:* Keine neuen Daten. extendedPersisted auswerten; eine Feldliste 'braucht Migration X' im Code, die die betroffenen UI-Bloecke ausblendet.

**3. Die drei Auftragsfragen deterministisch, vor der KI** — P0/S, S4
- *Wirkung:* Es sind die einzigen Briefing-Antworten, die produktiv in echten Spalten landen (vacancy_reason, hiring_urgency, reports_to — alle REST 200), und das Studio SCHREIBT sie bereits (JobIntakeStudio.tsx:349-351). Heute werden sie nur befuellt, wenn die Anzeige sie zufaellig enthaelt. Korrektur an drei Agenten: das ist kein Migrations- oder Function-Thema und kein M — es fehlt ausschliesslich die Frage.
- *Datenvoraussetzung:* Nichts Neues. Felder existieren im BuiltJob-Typ (intake/types.ts) und in der Tabelle.

**4. Die AGG-Pruefung im Premium-Pfad einschalten** — P0/S, S4
- *Wirkung:* BEWIESEN und von keinem der sieben bemerkt: QualityCheck.tsx:26/55 prueft AGG_PATTERN ausschliesslich gegen answers.exclusion_criteria, also gegen das statische Briefing. Im KI-Pfad bleibt 'answers' beim Prefill (IntakeBriefing.tsx:25-45) — die einzige Rechtspruefung der Jobaufnahme kann dort strukturell nie ausloesen. Das ist kein UX-Mangel, das ist ein Haftungsloch in einem Produkt, das Anzeigentexte an Dritte weitergibt.
- *Datenvoraussetzung:* Keine. AGG_PATTERN zusaetzlich ueber dyn.answers und ueber built.must_haves/nice_to_haves laufen lassen.

**5. Die Recruiter-Zahl aufhoeren zu faelschen** — P0/S, S1 / S9
- *Wirkung:* BEWIESEN: activeRecruiters ist die Zahl distinkter recruiter_id ueber ALLE submissions eines Jobs, inklusive abgelehnter und archivierter (client-dashboard-data/index.ts:279-285, :320), und RecruiterActivityIndicator.tsx:27 rendert das im Praesens. Zwei Agenten wollen eine zusaetzliche Aktivierungszahl einfuehren, ohne zu bemerken, dass die bereits angezeigte Zahl falsch ist. Eine zweite Zahl neben einer falschen Zahl macht das Dashboard nicht ehrlicher.
- *Datenvoraussetzung:* Keine. Filter auf aktive Submission-Status, Zeitform korrigieren.

**6. Alterung im Zug-Banner statt Dauergruen** — P0/S, S9
- *Wirkung:* jobCockpit.ts:178 berechnet days und benutzt es nur als Textparameter; leer_lang (:161) greift nur bei null aktiven Bewerbern. Das Produkt ist strenger mit der leeren als mit der steckengebliebenen Stelle. Einziger Punkt, in dem alle sieben Agenten uebereinstimmen — und der einzige P0, der ohne jeden Deploy auskommt.
- *Datenvoraussetzung:* Keine. Zwei Schwellen, zwei i18n-Keys.

**7. Verhandelbarkeit sichtbar — und erstmals folgenreich** — P0/S, S4
- *Wirkung:* 'fix' ist ein Wort in einer Pille (ProfileSections.tsx:222-228), der Erklaersatz steht sechs Zeilen darueber, der 3er-Zyklus hat keinen Rueckwaertsweg (:93-97). Wichtiger als die UI ist aber der Teil, den nur ich geprueft habe: persistSkillRequirements (JobIntakeStudio.tsx:412-420) setzt weight hart auf 1.0/0.5 und speist sich ausschliesslich aus dyn.skillRequirements — im Fallback-Pfad, dem einzigen, der produktiv laeuft, bekommt job_skill_requirements NULL Zeilen. Die Matrix ist also nicht 'nicht gescort', sie wird von einer Konstanten ueberschrieben und im Livepfad gar nicht erst geschrieben.
- *Datenvoraussetzung:* job_skill_requirements existiert produktiv (REST 200) mit weight. Zusaetzlich aus built.must_haves speisen, weight aus flexibility ableiten.

**8. Geldfelder mit Waehrung, Trennung und Toleranz** — P1/S, S4 / S5
- *Wirkung:* numOrNull = Number(v.replace(/\D/g,'')) || null (ProfileSections.tsx:85) macht aus '75k' die Zahl 75 und aus '0' null — bei der wichtigsten Zahl der Stelle, ohne jede Rueckformatierung, die den Fehler sichtbar machen wuerde.
- *Datenvoraussetzung:* Keine.

**9. Ein Fokus, keine Zahl** — P1/M, S4
- *Wirkung:* Ich uebernehme die Umsortierung von interaction-design und verwerfe beide Zahl-Vorschlaege. 42 % und 65/100 sind rechnerisch dieselbe Groesse (0,6*42 + 0,4*100 = 65,2, nachgerechnet). Aber 'Reife 65 · reicht ab 60' (interaction-design) und die vier Stufen 'anzeigenreif/suchfertig/pitch-fertig' (conversion-behavioral) erfinden ihre Schwellen genauso frei wie die heutige Formel: ein Score, der bei NULL Antworten und vollstaendigem Formular schon bei 40 steht und 'mittel' heisst, misst Formularausfuellen. Namen offener Kapitel sind pruefbar, jede Zahl waere geraten.
- *Datenvoraussetzung:* chapterProgress mit state 'open' liefert die Namen bereits (DynamicBriefing.tsx:38) — aber nur im KI-Pfad; im statischen Pfad liefert openBriefingQuestions() dasselbe. Beide Pfade bedienen.

**10. 'Reicht mir so' im Fragefluss — ohne erfundenen Preis** — P1/S, S4
- *Wirkung:* Der Ausstieg existiert nur in der Fusszeile; der auffindbare Ausstieg ist Escape, und der verwirft. Ich uebernehme den Vorschlag, streiche aber conversion-behaviorals Zusatz 'das kostet erfahrungsgemaess 2-3 Tage': diese Zahl ist nirgends gemessen. Einen Ausstieg mit einer erfundenen Strafe zu versehen ist dasselbe Muster wie die Ladeanimation, nur teurer.
- *Datenvoraussetzung:* Keine.

**11. Redaktions-Vorschau ueber die Function, die wirklich laeuft** — P1/M, S4 / S9
- *Wirkung:* Korrektur an feature-benchmark: die Vorschau kann NICHT ueber recruiter_jobs_view laufen. Die View traegt 'WHERE has_role(auth.uid(),"recruiter") AND j.status = "published"' im Rumpf (20260725120000:113-114) — keine RLS-Policy der Welt gibt einem Kunden Zugriff, und ein Entwurf ist ohnehin nie enthalten. Zusaetzlich existiert formatted_content zum Aufnahmezeitpunkt gar nicht: es wird erst bei der Admin-Freigabe (JobApprovalDialog.tsx:92) oder beim ersten Recruiter-Aufruf erzeugt (recruiter/JobDetail.tsx:145-148). Der einzige heute gangbare Weg: format-job-for-recruiters direkt auf den Entwurf aufrufen — diese Function IST deployed (HTTP 400 auf leeren Body, kein 404) — und das Ergebnis anzei
- *Datenvoraussetzung:* format-job-for-recruiters (deployed, verifiziert). Aufruf mit dem Entwurf statt mit einer job_id; Maskierungsliste clientseitig aus derselben Feldliste wie die View.

**12. Firmenprofil: wahre Gegenleistung, Baender statt Kennzahlen** — P1/S, S8
- *Wirkung:* Der heutige Satz ist nachweislich unwahr (SELECT auf company_profiles nur fuer Eigentuemer und Admins, 20251204182100:89-104). Die wahre Wirkung existiert im Code (JobIntakeStudio.tsx:146-167). Und der Streit zwischen feature-benchmark ('Fakten fuer Recruiter sichtbar machen') und senior-headhunter ('das enttarnt') ist durch die View entschieden: sie fuehrt company_size_band, funding_stage, tech_environment, benefits — Baender, keine Exaktwerte.
- *Datenvoraussetzung:* Keine neue Quelle. annual_revenue und founded_year aus requiredFields (ProfileCompletenessCard.tsx:29-37) entfernen, Text auf Sie umstellen, deaktivierten Logo-Knopf entfernen.

**13. Marktmessung VOR jeder Marktzahl** — P1/S, S4 (Vorbedingung fuer Reichweite und Gehaltsvergleich)
- *Wirkung:* Vier Agenten planen Pool-Zaehler und Gehaltsbaender (aufwand L bis XL). Meine Pruefung: salary_benchmarks und market_data existieren NICHT (REST 404/PGRST205). candidates, candidate_skills, jobs und placements sind mit dem anon-Key nicht zaehlbar (RLS → 0 sichtbare Zeilen), also hat NIEMAND — auch keiner der sieben — je eine Zahl zur Bestandsgroesse vorgelegt. Lesbar sind nur skill_taxonomy (103 Zeilen) und skill_synonyms (113) — eine Starttaxonomie, kein Marktmodell. Eine Zahl, die eine Kundenentscheidung steuert ('streichen Sie das 8. Muss-Kriterium'), auf ungemessener Basis zu bauen, ist exakt das KI-Theater, das dieselben Agenten in S3 anprangern. Deshalb steht hier eine Messung, kein Fe
- *Datenvoraussetzung:* Service-Role-Zugang (liegt nicht bei mir). Ergebnis entscheidet ueber zwei L/XL-Features.

**14. Erfundene Marktzahlen aus dem KI-Prompt entfernen** — P1/S, S4
- *Wirkung:* BEWIESEN: intake-questions/index.ts:131 verlangt vom Modell fuer tension_flags.message ausdruecklich 'konkret mit Zahlen', ohne ihm irgendeine Marktdatenquelle mitzugeben. Das Produkt fordert also von der KI erfundene Zahlen an und zeigt sie einem HR-Entscheider als Beratung. Nur conversion-behavioral hat das gesehen; es gehoert vor jeden Deploy dieser Function erledigt, nicht danach.
- *Datenvoraussetzung:* Keine — eine Zeile im Prompt. Muss allerdings zusammen mit dem Deploy der Function passieren, die heute 404 ist.

**15. Reveal-Regel, die haelt — oder gar keine** — P1/L, S4 / S9
- *Wirkung:* Das ist der einzige Punkt im ganzen Set, der ueber Produktqualitaet hinausgeht. Nicht nur fehlt jobs.reveal_trigger produktiv (REST 42703): der Trigger reveal_company_on_opt_in (20260122110726:20-34) setzt company_revealed BEDINGUNGSLOS beim Opt-In. Selbst nach dem Deploy der Spalte wuerde das Dropdown weiter das Gegenteil dessen versprechen, was passiert. Ein Kunde, der eine besetzte Position vertraulich nachbesetzt, verliert damit genau das, wofuer er zahlt. Solange beides offen ist, ist das Weglassen des Dropdowns die ehrlichere Produktentscheidung als jede Verbesserung daran.
- *Datenvoraussetzung:* Migration 20260619120000 (reveal_trigger, reveal_envelope) UND Umbau von reveal_company_on_opt_in auf den Job-Trigger. identity_unlock_logs existiert produktiv (REST 200) fuer die Audit-Zeile.

**16. Marktrueckmeldung: aktiviert vs. eingereicht** — P2/M, S9
- *Wirkung:* Das ist die Diagnose, die 'niemand schaut hin' von 'alle schauen hin und keiner reicht ein' trennt — zwei voellig verschiedene Ursachen, heute beide gruen. Aufwand-Korrektur gegen drei Agenten: das ist M, nicht L, und es braucht keine neue Tabelle — recruiter_job_activations existiert produktiv (REST 200) mit activated_at, has_submitted, first_submission_at. Es braucht eine SECURITY-DEFINER-RPC, die ausschliesslich Zahlen und Zeitstempel liefert, nie recruiter_id. Voraussetzung bleibt: erst die falsche Zahl aus S1 reparieren.
- *Datenvoraussetzung:* recruiter_job_activations (vorhanden), eine Aggregat-RPC. Die von zwei Agenten zusaetzlich geforderte Tabelle fuer strukturierte Recruiter-Einwaende ist ein separates, spaeteres Feature — sie setzt voraus, dass Recruiter ueberhaupt antworten, was niemand gemessen hat.

**17. Contracting: erst Spalten, dann Kapitel** — P2/L, S5
- *Wirkung:* Die fachliche Notwendigkeit ist unstrittig und belegt. Die Reihenfolge ist es nicht: day_rate_min, duration_months und intake_payload fehlen alle produktiv (REST 42703). Sieben neue Kapitel in ein Formular zu bauen, dessen fuenf bestehende Felder still verworfen werden, erzeugt mehr verlorene Antworten, nicht weniger — und bei AUeG-Fragen sind die verlorenen Antworten juristisch relevante.
- *Datenvoraussetzung:* Fuenf neue Spalten auf jobs, danach ein zweiter CHAPTERS-Satz in intake-questions (index.ts:39-51) — die Function ist heute 404, also ohnehin nach dem Deploy.

---

## Gestrichen und zurueckgestellt

- Die Reveal-Animation in S3 (JobIntakeStudio.tsx:316-324) — aber nur der Timer, nicht die Stufe. Der Spinner waehrend des echten Calls ist ehrlich (stage='building' wird bereits vor dem await gesetzt, :253); erfunden sind die 7 x 280 ms + 350 ms danach.
- Der tote 'Fertig'-Knopf (DynamicBriefing.tsx:268) und 'Weiter zur Uebergabe' (IntakeBriefing.tsx:380), beide an onDone={() => undefined} (JobIntakeStudio.tsx:632).
- Der Satz 'Keine Auffaelligkeiten — die Recruiter haben, was sie brauchen' (QualityCheck.tsx:113-115) — im KI-Pfad zwingend bei null Antworten, weil openQuestions hart auf [] gesetzt wird (JobIntakeStudio.tsx:641).
- BEIDE Fortschrittszahlen in S4, nicht nur eine: der Kopf-Balken (:517-520) UND die Briefing-Reife (QualityCheck.tsx:92). Gegen interaction-design, feature-benchmark und senior-headhunter, die eine der beiden retten wollen: die Formel 0,6*progress + 0,4*Formularpunkte misst Formularausfuellen und steht bei null Antworten schon bei 40/100.
- Die erfundene Marktzahl-Anweisung im Prompt (intake-questions/index.ts:131 'konkret mit Zahlen') — vor dem Deploy der Function, nicht danach.
- Die toast.success-Zeile im JobBoostDialog (JobBoostDialog.tsx:66-69) samt setTimeout(1000) und 'TODO: Implement actual boost notification'. Zwei Zeilen, sofort, unabhaengig von jeder Roadmap.
- Die Reveal-Zeile in S9 (ClientJobDetail.tsx:551) und das Reveal-Dropdown in S4, solange reveal_trigger fehlt UND reveal_company_on_opt_in (20260122110726:20-34) bedingungslos freigibt.
- Die harten SLA-Zusagen 'ca. 4 Std' (JobIntakeStudio.tsx:666-674) gegen 'unter 24 Std' (JobsList.tsx:427) — Faktor 6 fuer denselben Pruefschritt, beide ungemessen.
- annual_revenue und founded_year als Vollstaendigkeitspflicht (ProfileCompletenessCard.tsx:29-37) in einem Produkt, das Anonymitaet verkauft.
- AUS DEN VORSCHLAEGEN GESTRICHEN — feature-benchmark, 'Kommentare und @-Erwaehnungen' (P1, M): braucht die Tabelle job_comments (REST 404), einen Mitgliederpicker, der heute UUIDs rendert, und veraendert keine einzige Suchentscheidung des Kunden. Billigere Fassung: ein Freitextfeld 'Notiz an den Fachbereich' im vorhandenen notifications-Insert (JobIntakeStudio.tsx:441-448).
- AUS DEN VORSCHLAEGEN GESTRICHEN — feature-benchmark, 'Versionsverlauf' (P2) und 'Geteilter Vorschau-Link' (P2): job_versions und job_share_tokens existieren beide produktiv nicht (REST 404). Drei neue Tabellen fuer Zusammenarbeit an einem Entwurf, der sich heute nicht einmal selbst speichern kann.
- AUS DEN VORSCHLAEGEN GESTRICHEN — feature-benchmark, 'Firmenprofil aus der Domain' als P0: enrich-company-from-domain antwortet 404, wird ausschliesslich vom Outreach-Hook aufgerufen (grep: genau eine Stelle, useCompanyEnrichment.ts:62) und schreibt nach outreach_companies. Die Behauptung 'produktiv genutzt' ist falsch.
- AUS DEN VORSCHLAEGEN GESTRICHEN — feature-benchmark, 'rejection_reason als Banner ausspielen': jobs.rejection_reason existiert produktiv NICHT (REST 42703, Migration 20260710120000 nicht angewandt). Der Vorschlag baut auf einer Spalte, die es nur im Repo gibt.
- AUS DEN VORSCHLAEGEN GESTRICHEN — feature-benchmark, 'Gegenseiten-Vorschau ueber eine Policy auf recruiter_jobs_view': technisch unmoeglich. Die Rollenpruefung steht im View-Rumpf (WHERE has_role(auth.uid(),'recruiter') AND status='published'), keine Policy hebt sie auf, und ein Entwurf ist nie in der View.
- AUS DEN VORSCHLAEGEN GESTRICHEN — feature-benchmark, 'Briefing per Tastatur' (P3): der Agent begruendet selbst, dass es keine Entscheidung verbessert.
- AUS DEN VORSCHLAEGEN GESTRICHEN — conversion-behavioral, die Zeitangabe '2-3 Tage' im Ausstiegssatz und der Zusagesatz 'Danach sucht ein Recruiter fuer Sie, ohne Rueckfrage'. Beides ungemessen bzw. unhaltbar (die Stelle geht zuerst in pending_approval). Der Ausstieg bleibt, die Strafe geht.
- AUS DEN VORSCHLAEGEN GESTRICHEN — conversion-behavioral, 'Uebergabe-Beleg' ('11 Rueckfragen, die niemand mehr stellen muss') und das 'Antwort-Echo' als Belohnungsmomente: das Briefing erreicht heute keinen Recruiter (recruiter_jobs_view fuehrt briefing_notes ausdruecklich nicht, 20260725120000:100) und wird ueberdies gar nicht gespeichert. Arbeit zu feiern, deren Ergebnis verworfen wird, ist das schaedlichste Muster im gesamten Vorschlagsset — schaedlicher als die Ladeanimation, weil es explizit luegt.
- AUS DEN VORSCHLAEGEN GESTRICHEN — conversion-behavioral, die vierstufige Reifeskala 'Rohentwurf → anzeigenreif → suchfertig → pitch-fertig'. Ersetzt eine unbelegte Zahl durch vier unbelegte Labels und fuegt Gamification-Druck hinzu.
- AUS DEN VORSCHLAEGEN ZURUECKGESTELLT — interaction-design 'Live-Pool-Zaehler' (XL), feature-benchmark 'Gehaltsband im Marktvergleich' (L), senior-headhunter 'Markt-Realitaetscheck' (L), conversion-behavioral 'Marktanker' (L): vier Varianten desselben Features, zusammen ueber 40 Personentage, auf einer Datenbasis, die niemand gemessen hat. Erst die Messung (siehe Feature 'Marktmessung VOR jeder Marktzahl'), dann hoechstens EINE dieser vier.
- AUS DEN VORSCHLAEGEN ZURUECKGESTELLT — senior-headhunter 'Arbeitgeber-Spiegel' aus employer_scores: die Tabelle existiert (REST 200), aber im gesamten Repo findet sich kein Job, der avg_response_time_hours oder offer_acceptance_rate befuellt. Ohne Befuellung ist es eine leere Karte mit Plattform-Durchschnitten, die es nicht gibt.
- Die Umleitung von /dashboard/jobs/new auf das Studio (vier Agenten, P0): richtig als Ziel, heute schaedlich als Schritt. Ohne parse-job-url endet das Studio auf Stufe 'input' mit einer Fehlermeldung — der Kunde haette dann gar keinen funktionierenden Weg mehr, eine Stelle anzulegen.

---

## Konflikte zwischen den Agenten und ihre Aufloesung


- FUNDAMENTAL — Der Durchklick gegen Produktion kann so nicht stattgefunden haben. conversion-behavioral sagt es als Einziger, ich bestaetige es haerter: parse-job-url antwortet 404 mit sb-error-code NOT_FOUND_FUNCTION_BLOB (registriert, Code fehlt), intake-questions 404 NOT_FOUND, parse-job-pdf 404. Da parseJobText dieselbe Function benutzt (useJobParsing.ts:88), erreicht kein Kunde Stufe 'built'. Zusaetzlich hat der statische Fallback-Katalog 10 Kapitel ('Kontext'…'Sichtbarkeit', IntakeBriefing.tsx:58), nicht die beobachteten 11 — die 11 stammen aus intake-questions/index.ts:39-51, also aus der nicht deployten Function. MEINE ENTSCHEIDUNG: bevor irgendein S4/S5-Feature geplant wird, muss geklaert werden, gegen welches Backend geklickt wurde. Sechs der sieben Agenten haben ihre Empfehlungen auf einen Screen gestuetzt, den sie fuer produktiv hielten.

- Fortschrittszahl — interaction-design: 'eine Zahl mit Schwelle (Reife 65 · reicht ab 60)'. feature-benchmark und senior-headhunter: 'Briefing-Reife behalten, Kopf-Balken weg'. conversion-behavioral: 'beide weg, vier benannte Stufen'. MEINE ENTSCHEIDUNG: beide Zahlen weg, keine Stufen, keine Schwelle. Die Formel (QualityCheck.tsx:79) ist 0,6*Briefing + 0,4*Formularpunkte; bei null Antworten und vollem Formular ergibt sie 40 und 'mittel'. Jede Schwelle darauf waere geraten. Ersatz: die Namen der offenen Kapitel.

- S3-Animation — conversion-behavioral: 'startBuild setzt built VOR dem Umschalten auf building', also sei die ganze Stufe Theater. interaction-design/feature-benchmark/senior-headhunter: nur der Reveal-Timer sei Theater. MEINE ENTSCHEIDUNG: die drei haben recht. buildFromText setzt stage='building' vor dem await (:253). Wer die Stufe streicht statt des Timers, entfernt die einzige ehrliche Rueckmeldung waehrend eines echten Calls.

- S7-Urteil — senior-headhunter und conversion-behavioral: 'solide', inhaltlich dem Studio ueberlegen. interaction-design und feature-benchmark: 'schaedlich', zweite Wahrheit. MEINE ENTSCHEIDUNG: beide Haelften stimmen, aber die gemeinsame Praemisse ist falsch. Alle vier behaupten, das Studio erhebe Vakanzgrund/Dringlichkeit/Entscheider nicht und schreibe seine Antworten nur nach intake_payload. Tatsaechlich schreibt buildRecord vacancy_reason, reports_to, hiring_urgency und onsite_days_required in echte, produktiv existierende Spalten (JobIntakeStudio.tsx:349-352). Es fehlt ausschliesslich die Frage. Damit ist die 'Uebernahme der Quick Questions' Aufwand S, nicht M — mehrere Agenten haben sie zu gross eingepreist.

- S8-Richtung — feature-benchmark: 'den Satz wahr machen, Firmenfakten in die Recruiter-Sicht heben'. senior-headhunter: 'genau diese Kennzahlen heben die Anonymitaet auf'. MEINE ENTSCHEIDUNG: senior-headhunter, und die View entscheidet es: recruiter_jobs_view fuehrt company_size_band, funding_stage, tech_environment, benefits — Baender. Baender erheben, Exaktwerte streichen.

- Reveal-Cockpit — feature-benchmark und interaction-design behandeln den Reveal als Design-Aufgabe (Freitext → Schalter, Vorschau). senior-headhunter behandelt ihn als Durchsetzungsproblem. MEINE ENTSCHEIDUNG: senior-headhunter, mit Verschaerfung. reveal_company_on_opt_in (20260122110726:20-34) gibt die Firma bedingungslos beim Opt-In frei. Ein schoeneres Bedienelement ueber einem Trigger, der die Einstellung ignoriert, macht die Falschaussage nur glaubwuerdiger. Solange beides offen ist: Dropdown entfernen.

- 'Neu starten' — conversion-behavioral und feature-benchmark: 'unbestaetigte Zerstoeraktion in Reichweite des Primaerbuttons'. MEINE PRUEFUNG: der Knopf macht ausschliesslich setStage('input') (JobIntakeStudio.tsx:733); built, answers, dyn und flexibility bleiben im State. Er zerstoert nichts — aber es gibt keinen Weg zurueck nach 'built' ausser einem Rebuild, der alles nullt. ENTSCHEIDUNG: Sackgasse, nicht Zerstoerer. Fix ist ein 'zurueck zum Entwurf'-Knopf, nicht ein Bestaetigungsdialog.

- Marktzahlen — vier Agenten fordern Reichweiten- oder Gehaltsvergleichszahlen, drei davon markieren sie korrekt als 'braucht neue Datenquelle', einer (interaction-design) schreibt selbst 'Bestand dafuer heute vermutlich zu duenn'. MEINE ENTSCHEIDUNG: keiner der sieben hat eine einzige Bestandszahl vorgelegt, und ich kann sie mit dem anon-Key auch nicht ermitteln (RLS liefert 0 sichtbare Zeilen fuer candidates, candidate_skills, jobs, placements; salary_benchmarks und market_data existieren gar nicht). Lesbar sind nur skill_taxonomy (103) und skill_synonyms (113). Vor der Messung wird keine dieser vier Varianten gebaut. Eine erfundene Marktzahl ist in einem Beratungsprodukt teurer als gar keine.

- Aktivierungszahlen — interaction-design ('M'), feature-benchmark ('L'), senior-headhunter ('M') fordern eine neue Kunden-Sicht auf recruiter_job_activations. KEINER bemerkt, dass das Dashboard bereits eine Recruiter-Zahl anzeigt und dass sie falsch ist: activeRecruiters zaehlt distinkte recruiter_id ueber ALLE submissions inklusive abgelehnter (client-dashboard-data/index.ts:279-285) und wird im Praesens mit pulsierendem Punkt gerendert (RecruiterActivityIndicator.tsx:27). MEINE ENTSCHEIDUNG: erst die falsche Zahl korrigieren (S), dann die richtige ergaenzen (M).

- Contracting — feature-benchmark setzt den Fork auf P0/M, senior-headhunter auf P0/L mit 'bis dahin kennzeichnen', interaction-design auf 'zu starr' mit neuem Kapitelbaum. MEINE ENTSCHEIDUNG: senior-headhunters Zwischenschritt gewinnt. Fuenf Felder, die still ins Nichts schreiben, um sieben Kapitel zu erweitern, vervielfacht den Verlust — und bei AUeG-Fragen sind die verlorenen Antworten juristisch relevant.

- Zwei Agenten (interaction-design, feature-benchmark) empfehlen, die Muss-Kriterien-Warnung ab 8 Kriterien durch eine Poolzahl zu ersetzen. MEINE ENTSCHEIDUNG: die Warnung bleibt vorerst, aber die dringlichere Reparatur liegt darunter: persistSkillRequirements (JobIntakeStudio.tsx:412-420) schreibt weight hart 1.0/0.5 und laeuft nur im KI-Pfad — im produktiv laufenden Fallback-Pfad bekommt job_skill_requirements gar keine Zeilen. Die Flexibilitaetsmatrix schoener zu bedienen, aendert nichts, solange ihr Ergebnis von einer Konstante ueberschrieben wird.

- Uebersehen von allen sieben, Nummer 1: Die AGG-Pruefung (QualityCheck.tsx:26/55) testet ausschliesslich answers.exclusion_criteria und ist damit im KI-Pfad strukturell tot, weil 'answers' dort nur den Prefill enthaelt. Die einzige Rechtspruefung des Aufnahmeprozesses laeuft ausgerechnet nur im Notfallpfad.

- Uebersehen von allen sieben, Nummer 2: Die Entwurfs-Abfrage in NeueStelleBar.tsx:38-44 filtert nur auf status='draft', ohne client_id — sie verlaesst sich vollstaendig auf eine organisationsweit lesende RLS-Policy. Ein 'Fortsetzen'-Chip kann den Entwurf eines Kollegen sein, und resumeDraft laedt ihn mit select('*').

- Uebersehen von allen sieben, Nummer 3: In Produktion entsteht aus dem Studio eine Stelle ganz ohne Briefing — nicht nur ohne intake_payload. briefing_notes wird aus serializeBriefing(answers) gebaut (JobIntakeStudio.tsx:349), und 'answers' bleibt im KI-Pfad beim Prefill. Es gibt also keinen Fallback-Speicherort; der Satz 'das Briefing erreicht keinen Recruiter' ist zu freundlich formuliert — es existiert nicht.

- Uebersehen von sechs der sieben: der Import-Zaehler 'Aus Ihrer Anzeige uebernommen: 13 Angaben' ist ein useMemo auf 'built' (JobIntakeStudio.tsx:171-183) und zaehlt weiter, waehrend der Kunde selbst tippt — die Maschine nimmt die Gutschrift fuer seine Arbeit (so conversion-behavioral, korrekt). Deren zweite Behauptung ist aber falsch: remote_type und experience_level sind NICHT Teil von docFacts, die Defaults werden also nicht mitgezaehlt. Richtig bleibt: 'aus Ihrem Firmenprofil: Groesse' ist ein reines merged.push('Groesse') ohne jeden patch (:160-161) — es wird nichts uebernommen.

---

## Kernthesen der acht Linsen


**feature-benchmark** — Das Studio ist ein Formular mit KI-Anstrich: es sammelt Angaben, gibt dem Kunden aber an keiner Stelle die zwei Rückkopplungen, die ein erstklassiges Aufnahmeprodukt ausmachen — was seine Eingabe im Markt kostet (Reichweite, Gehaltsvergleich, Recruiter-Einwand) und was die Gegenseite am Ende wirklich zu lesen bekommt; ohne diese beiden Spiegel bleibt jede Zusatzfrage eine Bringschuld statt eines Angebots.

**mobile-a11y** — Nein — ein Kunde kann die Jobaufnahme heute auf dem Smartphone nicht sinnvoll abschließen: das Studio ist ein Desktop-Dialog mit `h-[90vh]` ohne `dvh` und ohne `env(safe-area-inset-bottom)` (JobIntakeStudio.tsx:499; die einzige safe-area-Zeile im ganzen src liegt im ALTEN Pfad, CreateJob.tsx:1580), es bricht erst bei `lg` um (Zeile 594), sodass das Briefing rund zwei Bildschirme unter dem Formular beginnt, jedes Eingabefeld ist mit `h-8 text-xs` unter 16px und löst damit den iOS-Fokus-Zoom aus (obwohl input.tsx:11 mit `text-base md:text-sm` genau das verhindern will), und es gibt im gesamten Intake kein einziges `aria-live`, `role="progressbar"` oder `aria-valuenow` — der Fortschritt ist auf

**ai-capability** — Die KI-Infrastruktur für ein erstklassiges Produkt ist zu ~80% schon gebaut und wird nicht aufgerufen: der Intake erzeugt eine `red_list`, die nirgends geprüft wird (intake-questions/index.ts:121-122, kein einziger Consumer in src/ oder supabase/functions/), `assertNoLeak` mit `companyTokens`/`cityTokens` liegt getestet bereit (_shared/pii-redaction.ts:334-353), die k-anonymen Banding-Funktionen `anon_region_broad/experience_band/salary_band` sind deployed und an `authenticated` granted (20260616104941…sql:1-53) — und der gesamte Studio-Flow ruft trotzdem exakt EINE Function auf (DynamicBriefing.tsx:92). Das Ergebnis ist ein Screen, der inszeniert statt zu rechnen: 2,3 s Fake-Ladeanimation n

**senior-headhunter** — Diese Screens nehmen eine Stellenanzeige auf, aber keinen Suchauftrag — und geben dem Kunden danach drei Zusagen (triple-blind, Fortschritt, „alles in Arbeit"), die die Produktionsdatenbank nachweislich nicht deckt; erstklassig wird das erst, wenn jede Zusage auf einer gespeicherten, prüfbaren Regel steht und der Kunde an jeder Stelle die Marktfolge seiner eigenen Entscheidungen in Zahlen sieht.

**interaction-design** — Die rechte Spalte in S4 hat keine Hierarchie — fuenf visuell gleichwertige Karten konkurrieren, die einzige Handlung (Frage beantworten) steht an dritter Stelle hinter einer Liste aus 9 grauen Kreisen, und drei Zahlen behaupten drei Wahrheiten; erstklassig wird der Screen erst, wenn genau EINE Frage im Fokus steht, genau EINE Zahl gilt und alles andere zu einer Statuszeile schrumpft.

**conversion-behavioral** — Der Kunde bricht das Briefing nicht ab, weil es zu lang ist, sondern weil es nie sagt, wie lang es ist, nie etwas zurueckgibt und das Aufgeben belohnt — die einzige Stelle, an der das Produkt „Sie sind fertig" sagt (QualityCheck.tsx:114), erscheint bei NULL beantworteten Fragen, und jeder Knopf, mit dem der Kunde das Briefing stolz beenden koennte, ist auf eine leere Funktion verdrahtet (JobIntakeStudio.tsx:632 `onDone={() => undefined}`).

**live-daten** — Matchunt besitzt die Marktantwort auf jede einzelne Stelle bereits — BEWIESEN: 369 entdoppelte Profil-x-Stellen-Prüfungen über 14 echte Jobs, davon 149 (40 %) mit 100 % Muss-Kriterien-Erfüllung, aber nur 2 (0,5 %) jemals für Recruiter freigegeben — und zeigt dem Kunden stattdessen einen grünen Haken mit "Alles in Arbeit — nichts zu tun" (src/i18n/locales/de.ts:808); die Screens sind nicht zu starr, weil Daten fehlen, sondern weil die vorhandenen Daten nirgends an die Oberfläche gelassen werden.

**red-team-challenger** — Die sieben Agenten planen Premium-Features fuer einen Bildschirm, den in Produktion niemand erreichen kann: parse-job-url antwortet NOT_FOUND_FUNCTION_BLOB (kaputter Deploy), intake-questions NOT_FOUND — ohne parse-job-url kommt startBuild nie an ein Job-Objekt, also existieren S3/S4/S5 heute schlicht nicht, und selbst wenn sie existierten, landet das gesamte Briefing in intake_payload, einer Spalte, die produktiv fehlt; solange das so ist, ist jedes Fortschritts-, Reichweiten- und Belohnungs-Feature nur eine teurere Version derselben Inszenierung, die alle sieben in S3 zu Recht anprangern.