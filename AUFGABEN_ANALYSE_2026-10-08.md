# Aufgaben-Bereich (Headhunter) — Gesamtanalyse und drei Varianten

Stand: 08.10.2026 · Grundlage: `AUFGABEN_GODMODE_ANALYSE.md` (11.09.) plus fünf Spezialisten-Berichte (Headhunter-Praxis, Produktdesign, Daten/Backend, Triple-Blind/Sicherheit, Code-Forensik) · verifiziert im Code, Live-Screens auf localhost (Vite) · nichts geändert.

---

## 0. Auftrag und Methode

**Auftrag (geschärft):** Den Bereich „Aufgaben“ vollständig analysieren (Quellen, Oberflächen, Klickpfade, Daten, Nachbarbereiche), kritisch aus Sicht des arbeitenden Headhunters bewerten, jede Aussage belegen, und drei klar unterscheidbare Varianten vorlegen, die **einfacher** sind als heute. Leitplanken: nur Werkzeuge, die es gibt, oder klar als „zu bauen“ markiert; Triple-Blind bleibt dicht; Konsistenz mit der bereits abgenommenen Interviews-Seite.

**Team und Reichweite:** fünf unabhängige Analysen, zusammengeführt und auf Widersprüche geprüft. Wo die Berichte sich widersprachen (z. B. Migration anwenden vs. verwerfen), steht hier die aufgelöste Position mit Begründung.

---

## 1. Kurzfassung

1. **Von zehn Arbeitsmomenten entlang des Deals hat genau einer (Opt-In) einen echten Handgriff in der Aufgabenliste.** Die Momente, die Geld sichern (Kandidat zum Termin bewegen, Kundenfeedback, Angebot, Absage, Garantiezeit), kommen dort nicht vor.
2. **Alle P0 vom 11.09. sind unverändert offen:** „+ Aufgabe“ stürzt die App ab, die Engine schreibt seit 05.04. nichts, „Debrief fällig“ prüft die Kundenspalte, Snooze geht still verloren, Dashboard-Klick landet im Profil.
3. **Die Debrief-Regel ist in beide Richtungen falsch:** Boris Becker bleibt offen, obwohl sein Debrief seit 30.07. vorliegt; umgekehrt verschwindet „Debrief fällig“, sobald der **Kunde** Feedback gibt, auch ohne Debrief des Headhunters (`src/hooks/useUnifiedTaskInbox.ts:349`, `src/hooks/useRecruiterInterviewAgenda.ts:228`).
4. **Es gibt keinen Kanal zum Kunden.** Die Seite „Nachrichten“ hat live null Unterhaltungen, und niemand kann eine starten. „Kunde nachfassen“ ist heute eine Vorwurfszeile ohne Werkzeug.
5. **Die Migration vom 25.02. darf so nie angewendet werden:** ihre View läuft mit Besitzerrechten und ohne Recruiter-Filter, jeder Nutzer sähe alle Aufgaben aller Recruiter inkl. Kandidaten-Kontakt und Firmenname (`supabase/migrations/20260225200000_unified_task_inbox.sql:46-129`); ihre Cron-Jobs lesen Einstellungen, die es im Projekt nicht gibt.
6. **Sicherheits-P0 außerhalb der Liste:** `process-rejection` prüft keine Berechtigung, jeder eingeloggte Nutzer kann per Einreichungs-ID jede Einreichung „als Kunde“ ablehnen (`supabase/functions/process-rejection/index.ts:42-47`).
7. **Die Absage-Mail an den Kandidaten geht heute nicht raus** (Template `rejection_notification` existiert nicht, Fehler verschluckt), die Oberfläche behauptet aber „benachrichtigt“. Latentes Firmennamen-Leck plus Lüge in der UI.
8. **Refetch-Sturm bei jeder Tab-Rückkehr:** `src/lib/auth.tsx:32` erzeugt bei jedem Auth-Ereignis ein neues `user`-Objekt, alle Aufgaben-Hooks laden neu (7 Queries, 2 Channels). Das ist auch die Ursache des bekannten Dialog-Neuaufbaus aus dem Interview-Test.
9. **Rund 1.900 Zeilen toter Code** in `src/components/influence/` (9 Komponenten + 1 Hook ohne Aufrufer), 7 verschiedene Kopien der Typ-zu-Label-Zuordnung, 0 Tests für den Bereich, Typecheck sauber nur dank `as any` an 6 Stellen.
10. **Empfehlung:** Welle 0 „Blutung stoppen“ (≤ 1 Tag, nur Frontend-Publish) sofort; danach Variante B „Eine Liste, ein Panel“ im Muster der Interviews-Seite, mit einer serverseitigen Lese-View als Quelle der Wahrheit statt Engine.

---

## 2. Woher Aufgaben heute kommen

| Quelle | Basis | Schreiber | Wo sichtbar | „Erledigt“ | Zustand |
|---|---|---|---|---|---|
| Engine-Alerts (`influence_alerts`) | Opt-In 24/48 h, Interview <48 h ohne „Readiness“, Interview <24 h unbestätigt, Gehalt >20 % über Budget, keine Mail-Öffnung >5 Tage, Engagement niedrig, Closing-Score ≥80 | `supabase/functions/influence-engine/index.ts:395-545`, Upsert `:165-170` | Liste, Dashboard, Akte, Einreichung | `action_taken` | **tot** seit 05.04.: Upsert ohne passenden Index, zusätzlich `impact_score` im Insert ohne Spalte (`:409-413`); Fehler verschluckt |
| Opt-In-Alerts | Interview-Einladung verschickt | `send-interview-invitation/index.ts:344-353` **und** `src/pages/recruiter/RecruiterDashboard.tsx:240-287` bei jedem Mount | wie oben | wie oben | Dreifach je Anfrage (Alert, Dashboard-Alert, Notification) |
| Eigene Aufgaben (`recruiter_tasks`) | Recruiter tippt | `src/hooks/useRecruiterTasks.ts:98-116` | Liste, Akte | `status = completed` | Dialog crasht (`CreateTaskDialog.tsx:226,246`), Insert sendet drei Spalten, die live fehlen (`:111-113`); Tabelle nicht in Realtime-Publikation |
| Abgeleitet im Browser | Einreichung ≥3 Tage ohne Kundenreaktion (`status`, nicht `stage`); Interview vorbei und `interviews.feedback` leer | `useUnifiedTaskInbox.ts:193-233, 336-349` | Liste, Dashboard, Akte | 3 Tage localStorage (`:600-602`) | alle 5 sichtbaren Aufgaben; Debrief in beide Richtungen falsch |
| Exposé-Pflicht | Gehalt, Skills, Erfahrung fehlen | `src/components/candidates/CandidateTasksSection.tsx:127-189` | nur Akte | Feld gefüllt | funktioniert; ist eine Akten-Checkliste, kein Deal-Schritt; die Karte „Bereit zum Einreichen“ deckt es bereits ab (`:86-87`) |
| Benachrichtigungen | Kundenaktion / Systemereignis | Edge (`interview-service.ts:689,1004,1025,1038,1225,1323`, `process-rejection:96-105`, `process-offer-response`, `schedule-interview`) **und** Kunden-Frontend direkt (`ClientInterviews.tsx:182-195`, `PendingRequestStatus.tsx:50`, `useInterviewActions.ts:48`) | Glocke, Seite | gelesen | 20 ungelesen; Handlungsbedarf (Kunde bittet um Erinnerung, Kandidat abgelehnt, Umbuchung, No-Show) ist dort keine Aufgabe; Klick markiert gelesen und springt weg (`RecruiterNotifications.tsx:142-163,260`) |
| Interviews-Seite „Debrief fällig“ | wie „abgeleitet“ | `useRecruiterInterviewAgenda.ts:228` | Interviews | nie | gleiche falsche Spalte |

Oberflächen, die daraus schöpfen: Aufgabenseite, Dashboard-Karte, Kandidatenakte (die Sektion ist **dreimal** montiert: `CandidateHeroHeader.tsx:234`, `CandidateProcessTab.tsx:50`, `CandidateDetailSheet.tsx:300`), Einreichungsseite („Alerts (X offen)“, `SubmissionDetail.tsx:688-691`), Interviews-Seite, Session-Overlay. Sechs Orte, zwei Klickverhalten.

---

## 3. Der Tag eines Headhunters auf Matchunt

| # | Moment | Handgriff | Werkzeug heute |
|---|---|---|---|
| 1 | Stelle aktiviert, 30-Tage-Uhr läuft | erste Einreichung | keins; Frist nur als Kommentar (`useJobActivation.ts:25`, `recruiter_job_activations.ends_at/slot_until`) |
| 2 | Eingereicht, Kunde schweigt (Tag 3/7/14) | Kunde anstoßen, notfalls zurückziehen | Zeile ohne Kanal, Dialog ohne Formular (`TaskDetailDialog.tsx:917-927`), kein Zurückziehen (Rechte wären da: `20251204171610:210-211`) |
| 3 | Kunde will Interview → Opt-In | Kandidat anrufen, Zustimmung festhalten | Opt-In-Haken (`TaskDetailDialog.tsx:185-194`, `CandidateTasksSection.tsx:385-425`); einziger echter Handgriff; Checkbox ohne Fehlerprüfung, Alert bleibt offen (`:862-886`) |
| 4 | Kandidat wählt keinen Slot, Kunde drückt „Erinnern“ | Kandidat anrufen, Slot wählen lassen | nur Benachrichtigung; kein stellvertretendes Wählen, keine neue Einladung (`RecruiterTerminSheet.tsx:66-70`) |
| 5 | Termin steht / wird umgebucht | Kandidat briefen | Agenda; Engine-Regel „unbestätigt“ ist in v2 tot (`candidate_confirmed` immer true, `interview-service.ts:1068`) |
| 6 | Interview vorbei → Debrief | Eindruck notieren | Formular existiert (`RecruiterTerminSheet.tsx:329-367` → `interview_feedback`); die Aufgabe prüft die falsche Spalte; der Kunde liest das Debrief nie |
| 7 | Kunde gibt Feedback / nächste Runde | Kandidat informieren | keine Benachrichtigung; Feedback liegt als Roh-JSON im Sheet (`InterviewFeedbackForm.tsx:62-73` → `RecruiterTerminSheet.tsx:318-325`) |
| 8 | Angebot | Kandidat begleiten | Recruiter sieht `offers` nirgends (Leserecht vorhanden: `20251209203346:18-28`) |
| 9 | Absage | Kandidat schonend informieren, Talent-Pool | Benachrichtigung; Automail scheitert still, UI behauptet das Gegenteil |
| 10 | Placement + Garantiezeit | Check Woche 1/4/12 | nichts (`RecruiterEarnings.tsx:339` nur ein Satz) |

---

## 4. Kritische Befunde (konsolidiert)

### 4.1 Wahrheit und Logik

| # | Befund | Beleg | Wirkung | Schwere | Fix |
|---|---|---|---|---|---|
| W1 | Debrief prüft `interviews.feedback` statt `interview_feedback` (evaluator = Recruiter); Status `pending`/`completed` nicht ausgeschlossen | `useUnifiedTaskInbox.ts:336-349`, `useRecruiterInterviewAgenda.ts:228` | falsch positiv (Boris Becker), falsch negativ (nach Kundenfeedback), ewige Aufgaben aus manuell erfassten Telefon-Interviews (`CandidateInterviewsCard.tsx:134-137`) | P0 | S |
| W2 | Nachfassen auf `status` mit `updated_at`-Anker; keine Obergrenze; kein Ausweg | `useUnifiedTaskInbox.ts:193-233, 333` | „8 Monate überfällig“ als rote Karte; jede Nebenänderung setzt die Uhr zurück | P1 | S (in View) |
| W3 | Opt-In dreifach erzeugt; nach Opt-In wird der Basis-Alert nicht geschlossen; Recruiter-Opt-In setzt `opt_in_response` nie | `RecruiterDashboard.tsx:240-287`, `send-interview-invitation:344-353`, `influence-engine:417` | bis zu 3 Karten je Kandidat; nach Engine-Reparatur Falschalarme „48 h ausstehend“ nach erteiltem Opt-In | P1 | M |
| W4 | „Erledigt“ auf abgeleiteten = 3 Tage localStorage, ohne User-Scope, nicht geräteübergreifend | `useUnifiedTaskInbox.ts:71-96, 600-602` | Aufgabe kommt wieder; Handy zeigt sie weiter | P1 | S (DB-Tabelle) |
| W5 | Snooze auf Alerts schreibt `snoozed_until` (fehlt live), UI entfernt Item trotzdem; Snooze auf eigene Aufgaben setzt `due_at` → Realtime → sofort wieder da | `useUnifiedTaskInbox.ts:609-618`, `useActionSession.ts:195`, `CandidateTasksSection.tsx:898` | „Gesnoozed“ blinkt, Karte kehrt zurück | P1 | S |
| W6 | Eigene Aufgaben: Dialog crasht (Radix `value=""`), kein ErrorBoundary; Insert sendet nicht existierende Spalten | `CreateTaskDialog.tsx:226,246`, `useRecruiterTasks.ts:111-113` | schwarzer Screen; selbst ohne Crash scheitert das Anlegen | P0 | S |
| W7 | Engine-Schreibpfad tot (zwei Ursachen: Upsert ohne Index, `impact_score` ohne Spalte); Fehler werden gezählt statt geloggt | `influence-engine:165-175, 409-413` | keine Systemaufgaben seit 05.04. | P0 | S (abschalten) |
| W8 | Engine-Regeln messen Mail-Öffnungen und Scores, nicht Kontakt | `influence-engine:315-347, 504-530`; `candidate_behavior.last_engagement_at` nur aus `track-candidate-engagement:98` | wer telefoniert, ist nach 5 Tagen „Ghosting-Risiko“ | P1 | S (abschalten) |
| W9 | Influence-Score: zwei Schreiber mit verschiedenen Formeln, beide ohne JWT-Prüfung; Formel belohnt Klickquote | `influence-engine:589-622`, `calculate-influence-score:126-155`, `config.toml:79-86` | Vanity, manipulierbar | P2 | S |
| W10 | SLA/Escalation-Engine ohne Deadlines aus dem v2-Interview-Fluss | `track-event:203-210` nur aus `useEventTracking.ts:33`; `interview-service` ruft es nie | Papier-Regeln | P2 | S (stilllegen) |
| W11 | Niemand setzt `interview_completed`; Recruiter hat auf `interviews` nur SELECT | `20260710230444:447-466` | Stage bleibt nach dem Termin stehen | P1 | S (Debrief setzt Stage via RPC) |
| W12 | Kundenfeedback löst keine Benachrichtigung aus und liegt als JSON-String | `InterviewFeedbackForm.tsx:49-90`, `RecruiterTerminSheet.tsx:318-325` | Headhunter erfährt das Wichtigste nicht | P1 | S |

### 4.2 Fehlende Handgriffe (Werkzeuge, die es nicht gibt)

| Handgriff | Stand | Aufwand |
|---|---|---|
| Kunden anstoßen (Prüfung hängt, Feedback fehlt) | kein Kanal; `messages` braucht `conversation_id`, keine Tabelle dafür; Profil-Lookup liefert „Unbekannt“ | M (Plattform-Erinnerung per RPC) oder L (Nachrichten) |
| Einreichung zurückziehen | Rechte vorhanden, UI fehlt | S |
| Einladung erneut senden / Termin stellvertretend wählen | `interview-request` kennt nur `withdraw` | M |
| Angebote sehen | Leserecht vorhanden, UI fehlt | S–M |
| Frist auf aktivierter Stelle | Daten vorhanden (`ends_at`, `has_submitted`), keine Zeile | S |
| Garantiezeit-Checks | Daten in `placements` (`start_date`, `retention_release_date`), keine Zeile | S |
| „Kandidat gebrieft“ | nichts | S |

### 4.3 Sicherheit, Triple-Blind, Datenschutz

| # | Befund | Beleg | Schwere | Fix |
|---|---|---|---|---|
| S1 | **Absage ohne Berechtigungsprüfung**: nur `auth.getUser`, kein `can_access_job`; Service-Role schreibt `client_rejected` | `process-rejection/index.ts:42-47, 82-84` | **P0 Rechte** | S |
| S2 | Absage-Mail an Kandidat mit `company_name` im Payload; Template fehlt → scheitert still; UI meldet „benachrichtigt“ | `process-rejection:108-124`, `send-email:43-240` (nur `rejection_notice`), `RejectionDialog.tsx:61` | P1 (latent) | S |
| S3 | Recruiter-Benachrichtigungen/Mails bei Kundenaktionen nennen die Firma ohne Reveal-Prüfung | `interview-service.ts:674, 689-691, 1000, 1023` | P1 (seit Aktivierungsregel 28.09. meist faktisch gedeckt, im Code ungeprüft) | S |
| S4 | INSERT `WITH CHECK (true)` auf `influence_alerts`, `notifications`, `candidate_behavior`, `email_events`; elf Client-Inserts hängen daran | `20251204212224:213-215, 188-194`, `20251204173818:29-31`, `20251204193757:22-25` | P1 Rechte (Phishing über vertrauten Kanal, Score-Manipulation) | M (RPC `notify_submission_recruiter` mit `can_access_job`) |
| S5 | View `unified_task_inbox` der nicht angewendeten Migration: kein `security_invoker`, kein Recruiter-Filter, liefert Telefon/E-Mail/Firma | `20260225200000:46-129` | P0 latent | **Migration verwerfen** |
| S6 | Kandidaten-PII in Alert-/Notification-Texten ohne Löschkette und Frist; `gdpr-deletion` deckt diese Tabellen nicht | `influence-engine:439-546`, `gdpr-deletion:158-175` | P1 DSGVO | M |
| S7 | WhatsApp-Handoff ohne `whatsapp_opt_in`; Engine empfiehlt WhatsApp | `ActionSession.tsx:268`, `influence-engine:457`, Spalte `20251204215330:9` ungenutzt | P1 DSGVO | S |
| S8 | Toter Pfad `process-talent-hub-action` mailt Firmenname an Recruiter; deployt, kein Aufrufer | `process-talent-hub-action:101-108, 210-216, 288-296` | P2 | S (entfernen) |
| S9 | Aktivitätslog löschbar und auf fremde Kandidaten schreibbar | `20251211212741:25-27, 34-37` | P2 | S |
| S10 | Kunde liest `candidate_behavior` (Profiling anonymer Kandidaten); Recruiter liest Kunden-Feedback inkl. `cons` und umgekehrt | `20251204212224:177-185`, `20260710230444:521-531` | P2 | S (entscheiden) |
| S11 | Engine ohne JWT-Prüfung | `config.toml:79-80` | P2 | S |

In Ordnung: Engine-Texte enthalten keinen Firmennamen; `safeCompany` wird in allen Mappern genutzt; Akte und Einreichung lesen die Firma nur aus `recruiter_jobs_view` (reveal-gated).

### 4.4 Code und Performance

| # | Befund | Beleg | Schwere |
|---|---|---|---|
| C1 | Neues `user`-Objekt bei jedem Auth-Event → alle Hooks refetchen (7 Queries + 2 Channels je Tab-Rückkehr) | `src/lib/auth.tsx:32`, `useUnifiedTaskInbox.ts:486,526` | P1 |
| C2 | Render-Loop „Maximum update depth“ im Interview-Fenster (Ziel des Dashboard-Klicks) | `InterviewCardSlider.tsx:107-112`, `useInterviewNotes.ts:190` | P1 |
| C3 | Dialog setzt Kontext beim Item-Wechsel nicht zurück (zeigt vorherigen Kandidaten) | `TaskDetailDialog.tsx:716-721` | P1 |
| C4 | „Erledigt“/Snooze auf der Akte wirken bei eigenen Aufgaben nicht (falsche Tabelle, No-op) | `CandidateTasksSection.tsx:376-383, 887-903` | P1 |
| C5 | `markDone/snooze/dismiss` ignorieren Fehler; Seite toastet immer Erfolg | `useUnifiedTaskInbox.ts:581-642`, `RecruiterInfluence.tsx:67-98` | P2 |
| C6 | Query-Bilanz: Aufgabenseite ≈ 11 Queries, Dashboard ≈ 20, Akte ≈ 14 nur für die Aufgabenzeile; Channel-Namen statisch → doppelte Bindings | Bericht Forensik §3 | P2 |
| C7 | 7 Typ-zu-Label-Maps, alle verschieden, mit toten Typen | `TaskCard.tsx:21-48`, `TaskDetailDialog.tsx:99`, `CompactTaskList.tsx:35`, `ActionSession.tsx:69`, `RecruiterDashboard.tsx:143`, `SessionStartDialog.tsx:55`, `useUnifiedTaskInbox.ts:38-45` | P2 |
| C8 | 9 Komponenten + 1 Hook ohne Aufrufer (≈ 1.900 Zeilen): ActionCenterPanel, CandidateEngagementPanel, CandidatePipelineCard, CandidateScoreCard, CandidateSupportViewer, CompactTaskList, InfluenceAlertCard, PowerThreeActions, TeamLeaderboard, useInfluenceAlerts | Bericht Forensik §2 | P3 |
| C9 | Hover-only-Aktionen, Karten ohne Tastaturzugang, drei Dialoge ohne Titel, Dialog mobil gequetscht | `RecruiterDashboard.tsx:736`, `TaskCard.tsx:75-83`, `TaskDetailDialog.tsx:955-957,1262` | P2 |
| C10 | Session: Esc doppelt behandelt (2 Events), Einbuchstaben-Shortcuts global, natürliches Ende nicht geloggt | `ActionSession.tsx:364-405, 400-403, 442` | P3 |
| C11 | 0 Tests für den Bereich; tsc 0 Fehler nur dank `as any` an 6 Stellen | — | P2 |

---

## 5. Was gestrichen werden kann (in jeder Variante)

Influence-Score und Badge · Performance Intel (Speed Tier aus Klickquote, „Placements durch Influence“ = 0) · Session-Modus (Start-Dialog, Overlay, Summary, 8 Tastenkürzel) · Playbooks mit `[Firma]`-Platzhalter · 6 Filter-Chips für 2 reale Typen · Impact-Balken (konstant 50/60/70) · Zeitgruppe „Überfällig & dringend“ als Sammelbecken · Snooze per localStorage · Zahnrad ohne Funktion · Engine-Regeln Ghosting, Engagement, Closing, Gehalt, Prep, Interview-unbestätigt · Exposé-Pseudo-Aufgaben aus der Aufgaben-Sektion (bleiben in „Bereit zum Einreichen“) · tote Komponenten (C8) · `process-talent-hub-action` samt Templates.

---

## 6. Drei Varianten

Gemeinsame Mikro-Regeln (gelten überall): Primäraktion immer sichtbar als Text, nie Hover-only · das Badge nennt die Tat, nicht die Regel · Erledigt nur bei eigenen Aufgaben, alles andere verschwindet durch Zustandsänderung · Alter ≥ 21 Tage ist eine Frage („Noch aktiv?“), keine rote Karte · kein Detail ohne Tat · Anlegen in drei Feldern · Firma nur nach Reveal, sonst Branche mit Schloss, eine Quelle · gleiche Zeile, gleiche Öffnung an jedem Ort · Zahlen zeigen Rest, nicht Leistung · Snooze ist Vertagen (serverseitig), nicht Verstecken.

### Variante A — „Reparieren und entrümpeln“

Struktur bleibt (Kopf, Zeitgruppen, Kartenraster, zentraler Dialog). Session, Score, Performance Intel, Filter fliegen raus. Jede Karte bekommt genau einen benannten Primärknopf, der Dialog wird einspaltig und führt für Debrief/Opt-In/Nachfassen zur echten Tat.

- Aufgabenseite: Untertitel „Was jetzt den Deal bewegt“; Gruppen „Heute fällig“, „Diese Woche“, „Später“, neu „Noch aktiv?“ unten (≥ 21 Tage); Karte mit Tat-Badge, Kandidat, Stelle · Branche, ~€, Warum-Satz, Primärknopf als Text + „…“-Menü (Später, Löschen).
- Dialog: eine Spalte; Tat-Block je Typ: Debrief → `RecruiterTerminSheet` Variante debrief; Opt-In → „Opt-In bestätigen“ + Anrufen; Nachfassen → Anrufen/Mail + Aktivität loggen + „Deal schließen“ [zu bauen, S].
- Dashboard-Karte: Zahnrad weg, „Alle Aufgaben“ immer, Klick öffnet denselben Dialog, Aktionen sichtbar.
- Akte: Sektion nur im Prozess-Tab, gleiche Karte. Interviews: Debrief-Wahrheit aus `interview_feedback`.
- Entfällt: SessionStartDialog, ActionSession, SessionSummary, PerformanceIntel, InfluenceScoreBadge, Playbook-Link.

| | Heute | A |
|---|---|---|
| Konzepte | 11 | 6 |
| Klicks bis zur Tat (Debrief) | 4–5 | 1–2 |
| Oberflächen | 6 | 4 |

Risiko: Karten + zentraler Dialog bleiben ein eigenes Muster neben Zeilen + Panel der Interviews-Seite; der Dialog nimmt die Liste weg. Aufwand: S–M.

### Variante B — „Eine Liste, ein Panel“

Die Aufgabenseite übernimmt das Muster der Interviews-Seite: Kennzahlen-Streifen, „Jetzt dran“-Hero, Zeilen in Gruppen, Klick öffnet ein Panel rechts, die Liste bleibt sichtbar. Das Panel enthält die Tat selbst. Dieselbe Zeile und dasselbe Panel auf Dashboard und in der Akte.

- Aufgabenseite: Streifen „Heute · Wartet auf Kunden · Debrief · Opt-In“ (Klick filtert); Hero „Jetzt dran · seit 3 Tagen“ mit Primärknopf; Gruppen „Heute / Diese Woche / Später / Noch aktiv? (eingeklappt)“; Zeile wie `InterviewRow` (Zeitblock, Kandidat + Tat-Badge, Stelle · Branche, ~€, Primärknopf, Chevron); „Erledigt (n)“ eingeklappt; keine rechte Spalte, kein Raster, keine Filter.
- Panel rechts [zu bauen, M]: nicht-modal, ~30 rem, über der App-Leiste (wie Kunden-Interview-Fenster); Kopf, Warum-Satz, Deal-Block (Stage, seit X Tagen, ~€), Tat-Block je Typ (Debrief-Formular wiederverwendet aus `RecruiterTerminSheet.tsx:329-366`; Opt-In; Nachfassen mit Aktivität loggen + „Noch aktiv?“ Ja/Nein, Nein = Zurückziehen [zu bauen, S]); Notiz; Fuß: Später, Zur Akte, Zur Einreichung. Keine Tabs.
- Dashboard: Top 5 als dieselbe Zeile, Klick → `/recruiter/influence?task=<id>` öffnet das Panel (Deeplink wie `?interview=`); „Alle Aufgaben“ immer.
- Akte: Zeilen statt Scroll-Karten, Klick → Panel. Interviews: unverändert, Debrief aus derselben Quelle.
- Benachrichtigungen mit Handlungsbedarf (Erinnerungsbitte, Absage, Umbuchung, No-Show) werden Zeilen [M]; die Benachrichtigungsseite bleibt Chronik.
- Entfällt: Session (3), Score, Performance Intel, Filter, TodayInterviewsRail, TaskCard, TaskDetailDialog, Playbook.

| | Heute | B |
|---|---|---|
| Konzepte | 11 | 5 |
| Klicks bis zur Tat | 4–5 | 1–2 |
| Oberflächen | 6 | 3, alle mit derselben Zeile + demselben Panel |

Risiko: Neubau von Zeile, Streifen, Panel (M–L in Summe); Versuchung, das Panel wieder zum 900-px-Dialog aufzublasen. Aufwand: M–L.

### Variante C — „Keine Aufgabenseite“

Eine Aufgabe ist eine Eigenschaft des Deals: Jede Einreichung trägt ihren „Nächsten Schritt“, sichtbar dort, wo der Deal liegt (Pipeline-Karte, Interviews, Akte, Einreichung). Das Dashboard zeigt als „Heute“ nur die Spitze (Hero + 5 Zeilen); `/recruiter/influence` entfällt.

- Dashboard: Zelle „Heute (n)“ mit Hero und bis 5 Zeilen; Primärknopf führt am Ort aus; „Alle anzeigen“ = Zelle in voller Breite, keine eigene Route.
- Pipeline: Kanban-Karte mit „Nächster Schritt: Nachfassen · 12 Tg“ + Knopf [M]; Spalten nach Wartezeit; ≥ 21 Tage „Noch aktiv?“ [M].
- Einreichungsseite: „Alerts (X offen)“ → „Nächster Schritt“ [M]. Interviews: unverändert. Akte: Sektion entfällt, `CandidateActiveProcesses` zeigt je Prozess den nächsten Schritt [M]; eigene Aufgabe wird „Erinnerung“ am Kandidaten [S].
- Entfällt: gesamte Influence-Suite, Nav-Eintrag „Aufgaben“, Route → Redirect.

| | Heute | C |
|---|---|---|
| Konzepte | 11 | 3 |
| Klicks bis zur Tat | 4–5 | 1–2 |
| Oberflächen | 6 eigene | 0 eigene; Tat an 4 bestehenden Orten |

Risiko: „Wo ist meine Liste?“ bei > 5 offenen Taten; Pipeline-Karten sind schon dicht; größter Umbau an vier Seiten; Kandidatenseite hat den Render-Loop. Aufwand: L.

### Vergleich und Empfehlung

| | A Reparieren | B Liste + Panel | C Am Ort des Deals |
|---|---|---|---|
| Einfachheit (Konzepte) | mittel (6) | hoch (5) | sehr hoch (3), aber verteilt |
| Deal-Wirkung | mittel | hoch | sehr hoch, ohne Gesamtsicht |
| Konsistenz mit Interviews-Seite | gering | hoch | hoch |
| Aufwand | S–M | M–L | L |
| Risiko | gering, löst Grundproblem nicht | mittel | hoch |

**Empfehlung: B, gebaut in zwei Wellen, mit A als Welle 0.** B beantwortet „wirkt nur komplizierter“ direkt: eine Liste, ein Panel, ein Verhalten an allen drei Orten, im Muster, das auf der Interviews-Seite schon abgenommen ist. Sie streicht mehr als A, ohne wie C die Gesamtsicht aufzugeben, die ein Headhunter mit 20 laufenden Prozessen morgens braucht. Die Streichliste aus A plus die P0 lassen sich in Tagen als Welle 0 ausliefern, bevor eine Zeile Panel geschrieben ist. Den „Jetzt dran“-Hero aus C übernimmt B; „Nächster Schritt“ auf der Pipeline-Karte kann später additiv folgen.

**Nicht aufgelöst durch Layout:** „Kunde nachfassen“ braucht ein Werkzeug. Optionen: (1) Plattform-Erinnerung per RPC an den Kundenkontakt, höchstens einmal je Stufe, ab Tag 14 Matchunt-Eskalation [M]; (2) Nachrichten reparieren (Unterhaltung je Einreichung, Rollen statt Namen) [L]; (3) nur Matchunt fasst nach [S]. Ohne Entscheidung bleibt die Zeile in jeder Variante „Anrufen/Mail + Aktivität loggen“.

---

## 7. Backend-Zielbild: eine Lese-View statt Engine

**Warum View:** alle verlässlichen Aufgaben sind Zustände (Stage, Interview-Zeit, Feedback-Zeile, Benachrichtigung + Entitätszustand). Eine Engine müsste Zustände in Events übersetzen, Duplikate vermeiden, Alerts beim Zustandswechsel schließen und per Cron laufen; genau dort bricht es heute. Eine View hat keinen Schreibpfad, kein „veraltet“, keinen Cron; „Erledigt“ ist der Zustandswechsel.

`CREATE VIEW public.recruiter_open_actions WITH (security_invoker = true)` (Muster `20251211135325:21`), zusätzlich `WHERE recruiter_id = auth.uid()`. Firma **nur** über `LEFT JOIN recruiter_jobs_view` (reveal-gated), nie `public.jobs`. Spalten: `action_key` (`<typ>:<entity_id>`), `action_type`, Referenzen (submission, candidate, job, interview, notification, task), `since_at`, `due_at`, `age_hours`, `priority`, `stage`, Kandidat (Name/Telefon/E-Mail), `job_title`, `company_label`, `company_revealed`, `fee_estimate`, `mark_kind`, `snoozed_until`, `is_hidden`.

| Typ | offen | erledigt (Zustand) | Prio |
|---|---|---|---|
| `opt_in_due` | `stage = interview_requested`; Anker `COALESCE(opt_in_requested_at, interview.created_at)` | Stage ≠ `interview_requested` | >48 h 1, >24 h 2, sonst 3 |
| `debrief_due` | Interview vorbei, Status nicht declined/cancelled/no_show, kein `interview_feedback` des Recruiters, Submission offen, jünger als 60 Tage | Feedback-Zeile existiert; sonst → `deal_stale` | >72 h 1, sonst 2 |
| `client_follow_up` | `stage IN (submitted, in_review)`, kein Interview, `now - submitted_at ≥ 3 d` (Anker nur `submitted_at`) | Stage wechselt | 3–6 d 3, 7–13 d 2, 14–20 d 1 |
| `deal_stale` | wie oben ≥ 21 Tage; Debrief > 60 Tage | Stage wechselt oder `withdrawn` | 4 (Frage) |
| `reminder_requested` | Notification `interview_reminder_requested` und Interview noch `pending_response/counter_proposed` | Interview-Status bewegt sich oder Mark `done` nach Notification | 2 |
| `rejected_inform` | Notification `candidate_rejected`, `stage = client_rejected`, keine Aktivität (call/email) nach der Notification | Aktivität geloggt oder Mark `done` | 3 |
| `no_show_follow_up` | analog mit `interview_no_show` | analog | 2 |
| `offer_expiring` | Angebot offen, `expires_at < now + 48 h` | Entscheidung oder Ablauf | 2 |
| `first_submission_due` | Aktivierung aktiv, nicht eingereicht, `ends_at < now + 7 d` | `has_submitted` oder beendet | 3, <48 h 2 |
| `manual` | `recruiter_tasks.status = pending` | completed/cancelled (eigener Knopf) | aus Priorität |

Nicht aufnehmen: `interview_reminder`, `interview_prep_missing`, `salary_mismatch`, `ghosting_risk`, `engagement_drop`, `closing_opportunity`.

**Vertagen/Verstecken:** Tabelle `recruiter_action_marks (recruiter_id, action_key, kind ∈ snooze|done|dismiss, until, note, created_at)`, RLS `recruiter_id = auth.uid()`. „Done“ auf Zustandsaufgaben verfällt, sobald der Anker nach dem Mark liegt. Aufräumen per täglichem SQL-Cron (Muster `20261002120000:195`, kein GUC).

**Bestand:** `influence_alerts` bleibt Chronik, Schreiber abschalten (Engine-Loop, `send-interview-invitation`, Dashboard-Mount), danach Policy auf `auth.uid() = recruiter_id`. `recruiter_tasks` behalten, Insert-Felder streichen, Realtime-Publikation nachholen. **Migration 20260225 verwerfen** (nach `supabase/migrations_archive/`). Engine-/Score-Cron stilllegen; Escalation-Engine ohne Cron lassen.

**Realtime:** `submissions`, `notifications`, `recruiter_action_marks`, `recruiter_tasks` abonnieren; `interviews`/`interview_feedback` ohne Recruiter-Feld → Polling 60 s + Fokus-Refetch wie die Agenda. Erwartung < 100 Zeilen je Recruiter, < 50 ms.

---

## 8. Umsetzungsplan in Wellen

**Welle 0 — Blutung stoppen (≤ 1 Tag, nur Frontend-Publish + 2 Function-Fixes, keine Migration)**
1. `CreateTaskDialog` Sentinel statt `""`; ErrorBoundary um `DashboardLayout` mit „Neu laden“.
2. `useRecruiterTasks.ts:111-113`: die drei Felder streichen.
3. Debrief-Wahrheit: `interview_feedback` (evaluator = Recruiter) in Inbox und Agenda laden und ausschließen; Status-Whitelist; Debrief-Klick → `RecruiterTerminSheet` Variante debrief.
4. Snooze auf Alerts auf `expires_at` umstellen (Spalte existiert, Filter greift); Snooze-Filter für eigene Aufgaben; Fehler aus `markDone/snooze/dismiss` zurückgeben, Toast nur bei Erfolg.
5. `src/lib/auth.tsx` / Hook-Deps auf `user?.id` (beendet Refetch-Sturm und Dialog-Neuaufbau); `useCallback` um `getFormData` (Render-Loop).
6. Dashboard: Zahnrad weg, „Alle Aufgaben“ immer, Klick öffnet die Aufgabe; Hover-only aufheben; drei `VisuallyHidden`-Titel.
7. `ensureInterviewAlerts` aus dem Dashboard entfernen; Opt-In-Zeile client-seitig aus `stage = interview_requested`.
8. **Sicherheit:** `process-rejection` mit `can_access_job` absichern, Mail-Block entfernen, Toast korrigieren; Firmenname in `interview-service`-Benachrichtigungen hinter Reveal-Prüfung.
9. Streichliste aus Abschnitt 5 (Score, Session, Performance Intel, Filter, tote Komponenten).

**Welle 1 — Lovable-Migration A:** `recruiter_action_marks` + RLS, Realtime-Publikation (`recruiter_tasks`, `recruiter_action_marks`), vier Indizes, `canonical_stage()`. Frontend: Marks statt localStorage, mit Fallback bis live.

**Welle 2 — Lovable-Migration B + Variante B UI:** View `recruiter_open_actions`; `useUnifiedTaskInbox` liest eine View; Zeile, Streifen, Hero, Panel; Dashboard-Deeplink; Akte-Zeilen; Benachrichtigungen mit Handlungsbedarf als Zeilen; Zurückziehen mit Grund.

**Welle 3 — Abschalten und Rechte:** Engine-Alert-Loop und `send-interview-invitation`-Insert aus; Engine-/Score-Cron still; Policies `influence_alerts`/`notifications` auf service_role + RPC `notify_submission_recruiter`; WhatsApp nur mit Opt-in; Löschkette und Retention; `process-talent-hub-action` entfernen; Tests für Mapper und View.

Reihenfolge-Abhängigkeit: Welle 3 erst nach Live-Test von Welle 2, sonst verschwinden Opt-In-Aufgaben übergangsweise.

---

## 9. Offene Entscheidungen

1. **Variante** A / B / C (Empfehlung B mit Welle 0).
2. **Kundenkanal** für „Nachfassen“: Plattform-Erinnerung per RPC / Nachrichten reparieren / nur Matchunt.
3. **Zurückziehen** durch den Recruiter: ja mit Pflichtgrund / nur über Matchunt / nein.
4. **Absage an den Kandidaten:** keine Automatik, Headhunter informiert / Automatik ohne Firmenname / so lassen (heute faktisch keine Mail).
5. **Angebot und Garantiezeit** als Aufgaben: jetzt / nur Angebot / später.
6. **Score:** entfernen (Empfehlung) / ergebnisbasiert neu / behalten.
7. **Sichtbarkeit über Kreuz** (Kunde ↔ Recruiter-Feedback, Kunde ↔ `candidate_behavior`): explizit festlegen.

---

## Anhang A — Löschliste `src/components/influence/`

ActionCenterPanel.tsx (137) · CandidateEngagementPanel.tsx (129) · CandidatePipelineCard.tsx (140) · CandidateScoreCard.tsx (162) · CandidateSupportViewer.tsx (251) · CompactTaskList.tsx (263) · InfluenceAlertCard.tsx (210) · PowerThreeActions.tsx (268) · TeamLeaderboard.tsx (190) · `src/hooks/useInfluenceAlerts.ts` (158). Mit Variante B zusätzlich: SessionStartDialog, ActionSession, SessionSummary, PerformanceIntel, InfluenceScoreBadge, TodayInterviewsRail, TaskCard, TaskDetailDialog (nach Übernahme der Debrief-/Opt-In-Blöcke ins Panel).

## Anhang B — Query-Bilanz heute

Aufgabenseite ≈ 11 Queries, 3 Abos · Dashboard ≈ 20 Queries (Kachel zeigt 5 Zeilen), schreibt eigene Alerts und löst damit seinen Refetch aus · Kandidatenakte ≈ 14 Queries nur für die Aufgabenzeile, `recruiter-tasks-changes` doppelt gebunden (Task-Event = 9 Queries) · Tab-Rückkehr = 7 Queries + 2 Channel-Neuaufbauten je Seite.
