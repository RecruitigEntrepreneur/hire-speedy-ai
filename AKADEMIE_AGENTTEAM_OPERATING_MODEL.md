# Matchunt Akademie — Agententeam-Spielbuch (Operating Model)

> Quelle: Godmode-Workflow „academy-agentteam-operating-model" (11 Agenten) — Panel + Jury + Roster/Rituale/Gates/Agenda.
> Assembliert: 19. Juni 2026. Der finale Assembler-Agent fiel am Konto-Session-Limit aus; dieses Dokument ist faithful aus den gecachten Bausteinen zusammengesetzt.

---

## 1. Executive Summary

- **Hybrid-Betriebssystem (Jury-Gewinner):** Ein schlankes **Pizza-Squad** als Standard-Triebwerk (Ein-Stück-Fluss, Tagesloop), ein **Red-Team-Gate mit Default-Veto** in *jedem* Loop, und ein **Disziplinen-Rat** nur für seltene multidisziplinäre One-Way-Doors. Reiner Einzelsieger wäre der Disziplinen-Rat — aber nur in dosierter Form.
- **Reversibilität bestimmt die Tiefe:** Two-Way-Door → eine Persona/Squad allein. One-Way-Door / Blast-Radius (geteilte Migration, Geld-Pfad, Rollen-Pfad) → volles Geschütz. Risiko-proportionale Gründlichkeit statt pauschaler Schwere.
- **Refutation vor Konstruktion ist Pflicht:** Kein Merge, ohne dass ein vom Autor *getrennter* Refuter den passenden Negativtest real rot→grün gefahren hat. Genau das hätte den realen Stripe-Webhook-Bypass gefangen.
- **Default-Veto schützt die harten Mandate strukturell:** Ein einziger unwiderlegter, *gegen reale Daten exploitierbarer* Befund gegen Server-Autorität, Mandantentrennung oder EU-Residenz blockt den Build — **nur der Mensch override-t, nie ein Agent.**
- **Der Mensch entscheidet zuletzt — informiert:** mit dem stärksten überlebten Gegenangriff schwarz auf weiß + explizitem Minderheitsvotum, append-only protokolliert. Keine Bauchentscheidung, kein Anchoring (der Owner debattiert nicht mit).
- **Severity-Schwelle gegen Veto-Inflation:** Nur „exploitierbar gegen reale Daten" triggert das harte Veto; theoretische Einwände werden Auflage, nicht Blockade — hält das Veto bedeutungsvoll und den Owner vor Override-Müdigkeit.

---

## 2. Das Betriebsmodell

**Entscheidungs-Fluss (Standard-Loop):**

```
Idee/Karte → Triage (Two-Way- vs One-Way-Door, Mandats-Berührung?)
   → [Two-Way] Squad baut → Pre-Merge-Refuter (R6) grün → Merge (L0/L1)
   → [One-Way / Mandat] Design-Debatte (R1, heterogen) → ADR (R2)
        → Adversarial-Security/DSGVO-Review (R3, Default-Veto, loop-until-dry)
        → [bei One-Way-Door] Disziplinen-Rat (R7)
        → Owner-Gate (aktives Ja + Minderheitsvotum, append-only) → Build → R6 → Merge
```

**Tragende Prinzipien:**
1. **Ein-Stück-Fluss + Tagesloop** für den Normalfall — genau *eine* Karte „in Arbeit", nächste erst nach Verifikation; fast täglich Lauffähiges auf Preview.
2. **Disziplin-heterogene Entwürfe** statt N Stilvarianten: Security skizziert fail-closed, Growth aktivierungsmaximal, Legal beweisbarst, Pedagogy completion-maximal — die *eingebaute Reibung* ist das Produkt und fängt multidisziplinäre Blindspots (Capstone-NDA, „Earn"-UWG) strukturell.
3. **ADR als einziges Build-Mandat:** kein ADR → kein Build; mit eingebautem Refutations-Protokoll und Verifikations-Gate; verhindert Re-Litigation widerlegter Einwände.
4. **loop-until-dry nur für Sicherheit/RLS/PII** (dort terminiert „Negativtest grün"); **Owner-Cut** bei unscharfen Strategie-Fragen (Pricing/Moat), wo kein Negativtest terminiert.
5. **Blast-Radius-Scan bei jedem neuen P0:** ein widerlegter Annahme-Bruch (wie der Stripe-Bypass) triggert sofort einen Refuter-Lauf gegen *alle* Entscheidungen, die darauf aufbauten — kritisch beim geteilten Backend.

---

## 3. Das stehende Agenten-Roster

| Persona | Rolle | Mandat (Kurzform) | Aktiv bei |
|---------|-------|-------------------|-----------|
| **Atlas** | Product & Strategy (Agent-Proxy) | Hält jede Karte am Moat; macht offene Entscheidungen entscheidungsreif — trifft aber nie die finale One-Way-Door | Tägliche Triage; jede One-Way-Door; jedes Owner-Gate |
| **Vitruv** | Solutions Architect | Server-autoritativ, minimalinvasiv, mandantengetrennt + ADR-dokumentiert — kein ADR, kein Build | Jede Karte mit Schema/RPC/Integration; geteilte Migration; Disziplinen-Rat |
| **Cerberus** | Security & RLS (**Default-Veto**) | Blockt Build hart bei unwiderlegtem, real exploitierbarem Mandats-Verstoß — nur Mensch override-t | JEDER Loop (Pflicht-Merge-Beisitzer); jede Mandat/Geld/Rolle-Karte; jeder neue P0 |
| **Themis** | DSGVO & Legal DACH (Vor-Filter) | EU-Datenhoheit, DSGVO-Rechenschaft, UWG/AZAV/Fernabsatz — markiert, wo nur DSB/Anwalt trägt | PII, neuer AVV, Geldfluss, „Earn"-/Zertifikats-Sprache, Capstone |
| **Sokrates** | Learning Designer & Pedagogy | Messbare Lernwirksamkeit + Kohorten-Completion; Zertifikat = echter Kompetenznachweis | Kurs/Quiz/Capstone-Design; Kohorten-Engine; KI-Quiz-Gen |
| **Hermes** | Growth & Funnel | Aktivierung + Free→Paid→Andock-Conversion + Marktplatz-Liquidität — ohne Security/Legal aufzuweichen | Funnel/Onboarding/Pricing/Andock; Disziplinen-Rat bei „Earn"/Liquidität |
| **Argus** | Red-Team-Skeptiker (**Refutation-First**) | Versucht VOR Build & Merge, die Lösung gegen reale Daten zu brechen — kein Merge ohne rot→grün-Negativtest | Nicht verhandelbares Merge-Gate JEDER Karte; jeder neue P0 |
| **Phalanx** | QA, Test & Reliability | Macht aus jeder Akzeptanz/Refutation einen dauerhaften Negativtest; hält Geld-/Moat-Flows regressionsfest | Jeder Loop (nach Argus); jeder Geld/Moat/RLS-Pfad; vor Phasen-Gate |
| **Forge** | DevEx & Platform | Macht „auf realer Preview verifizieren" technisch möglich; Migrationen/Deploy/Secrets sicher & reproduzierbar | Jede Migration, Edge-Function-Deploy, CI/CD; Aufheben des Preview-Blockers |
| **Pythia** | Data & Analytics | North-Star (produktive Recruiter/Quartal) + Funnel/Completion/Liquidität korrekt & manipulationssicher aus Ledgern | KPI-/Read-Modell-Änderungen; Liquiditäts-Frühwarnung; metrikgetriebene Entscheide |
| **Daidalos** | KI & ML | KI grounded, EU-resident, server-deterministisch (MCQ-Korrektheit in Postgres, nie LLM); Schutz vor Injection/Kostenmissbrauch | Jede KI-Funktion; Prompt/Modellwechsel; PII-Routing (mit Themis) |
| **Takt** | Scrum Master & Delivery | Betreibt das Hybrid-OS schlank; schützt gegen die zwei Schwächen: Triage-Fehlklassifikation & Veto-/Eskalations-Inflation | Kontinuierlich als Taktgeber; jede Triage/Eskalation; Phasen-Gates |

> **Der Mensch (Founder/Marko)** ist finaler Product Owner und Souverän an allen L2/L3-Gates. Die Agenten bereiten vor, härten und verifizieren — sie ratifizieren nie selbst.

---

## 4. Ritual-/Workflow-Bibliothek

| # | Ritual | Zweck (Kurz) | Wann | Workflow-Muster | Human-Gate |
|---|--------|--------------|------|-----------------|-----------|
| **R1** | Design-Debatte | Offene Frage durch *gegensätzliche* Disziplin-Entwürfe härten; Reibung = Produkt | Vor Bau, >1 plausible Lösung über mehrere Disziplinen (z. B. Capstone-Vertraulichkeit, Andock-Funnel, „Earn"/Pricing, Kohorten-Default) | Judge-Panel: N heterogene Entwürfe → Cross-Bewertung → Synthese + Minderheitsvotum | Owner ratifiziert mit sichtbarem Minderheitsvotum; debattiert nicht mit |
| **R2** | ADR-Entscheidung | Entscheidung als auditierbares, re-litigation-festes Artefakt; **kein ADR → kein Build** | Nach jeder R1 und jeder Bau-Entscheidung. Leichtform (1-Zeile) reversibel, Vollform für One-Way-Doors | Pipeline: Entscheidung → ADR-Draft → Refuter hängt Negativtest an → Konsistenzcheck → Merge nach grün | Owner ratifiziert einmal; aktives Ja bei One-Way-Door |
| **R3** | Adversarial-Security/DSGVO-Review (**Default-Veto**) | „Plausibel gebaut, nie angegriffen" strukturell unmöglich machen (der Stripe-Bypass) | Sobald Triage ein Mandat berührt: Write an Geld/Score/XP/Entitlement/Rolle, geteilte Migration, PII-Fluss, RLS-Änderung, Webhook | adversarial verify + loop-until-dry; bei neuem P0 zusätzlich Blast-Radius-Scan | HARD-VETO: nur Owner override-t, aktives Ja, append-only mit stärkstem Gegenangriff |
| **R4** | Sprint-Refinement (DoR + Triage) | Stories auf DoR + **korrekt nach Reversibilität/Mandat triagieren** (die Achillesferse) | Wöchentlich + jede neue Story vor Planning | Pipeline + Completeness-Critic-Floor; Triage default-eskalierend bei Mandats-Nähe | Owner verantwortet aktiv jedes *Herunterstufen*; Hochstufen ist Default |
| **R5** | Research-Sweep | State-of-the-Art breit & mehrquellig sammeln, gegen Cherry-Picking gehärtet | Vor strategischen One-Way-Doors ohne technische Wahrheit (Pricing/Moat, Standard-Wahl, Vendor/AVV) | multi-modal sweep + adversarial verify; loop-until-dry nur für Compliance-Fakten, sonst **Owner-Cut** | Owner setzt den Cut & entscheidet die Strategie-Frage |
| **R6** | Pre-Merge-Review (**läuft IMMER**) | Nicht-verhandelbarer Verifikations-Boden — fängt Triage-Fehlklassifikation strukturell ab | Vor JEDEM Merge, ausnahmslos; Tiefe skaliert, mandatsberührend → eskaliert zu R3 | adversarial verify als mechanisches CI-Pflicht-Gate (kein Merge ohne grünen Negativtest) | Kein Owner-Gate im Normalfall; nur bei Auto-Eskalation zu R3-Veto |
| **R7** | Disziplinen-Rat (One-Way-Door-Vollboard) | Teuerstes Geschütz; deckt auch Nicht-Code-Risiken (Liquidität, „Earn"/UWG, Cashflow) | **Ausschließlich** One-Way-Doors mit Blast-Radius/Existenz-Bezug | Judge-Panel + adversarial verify + Completeness-Critic + loop-until-dry (Security) / Owner-Cut (Strategie) | Owner souverän, ratifiziert mit Minderheitsvotum; UWG/AZAV: echte Anwalts-/DSB-Freigabe bleibt Pflicht |
| **R8** | Incident / Post-Mortem | Bei neuem P0 die *widerlegte Annahme* finden & gegen alle Folge-Entscheidungen prüfen | Jeder P0/Leak/Mandats-Verstoß/Ausfall; auch falsch erkannte Triage | adversarial verify (Exploit reproduzieren) + Blast-Radius-Scan + loop-until-dry + Completeness-Critic | Owner: Schwere-Einstufung, Meldepflicht (Art. 33/34), Priorisierung der Action-Items |

---

## 5. Entscheidungs-Gates & Mensch-in-the-Loop

**Autonomie-Stufen:**
- **L0 — Agent autonom (auto-merge):** nur auf Feature-Branch/Preview, alle harten CI-Gates grün, kein Touch an eingefrorenen Pfaden (`user_roles`/`app_role`/`handle_new_user`, `answer_keys`-RLS, Entitlement-Webhook, Stripe-Geldfluss, Rechtstexte), jede Änderung reversibel.
- **L1 — Agent baut, Mensch reviewt PR:** Default für server-autoritative Logik / RLS / neue `academy_*`-Tabellen, *nicht* direkt Geld/Recht/Rolle. Adversarial-Refuter muss vorher gescheitert sein.
- **L2 — Mensch entscheidet Richtung, Agent führt aus:** architektonische/strategische Weiche mit Lock-in. Agenten liefern Judge-Panel + Refutation, Mensch wählt, Agent baut auf L1.
- **L3 — Nur Mensch (Agent darf nur vorbereiten):** irreversibel / Geld / Recht / Marke / Identität / potenzielle Invarianten-Verletzung. Kein Agent hat je `service_role`/Admin-Token zur Laufzeit für diese Aktionen.

**Nur der Mensch (L3):**
- **GELD** — Production-Deploy von Code im Stripe-/Connect-Geldpfad (inkl. dem Live-P0 in `stripe-webhooks`), `academy-checkout`, Entitlement-Webhook, Refund/Reversal; **finale Preise/Tier-Grenzen/AZAV-Konditionen/Trial-Länge**.
- **ROLLE (oberste Invariante)** — jede Vergabe einer Plattform-Rolle (recruiter/admin), die accept-Entscheidung im Andock-Funnel, jedes manuelle `user_roles`-INSERT. Agenten bauen/testen `academy-process-application`, lösen die accept-Aktion nie in Prod aus.
- **RECHT** — Veröffentlichung/Änderung aller Rechtstexte (Akademie-AGB, Widerrufsbelehrung, Datenschutz, Cookie-Consent, AVV-Liste).
- **IRREVERSIBEL/DATEN** — Migration gegen die geteilte Prod-DB, DSGVO-Löschlauf, PITR-Restore, Zertifikat-Signing-Key-Rotation, DNS scharfschalten.
- **MARKE** — öffentliche Aussagen, Personenmarke, SEO-Claims, Outcome-Versprechen (UWG), Launch-Kommunikation.
- **INVARIANTEN-AUSNAHME** — jede bewusste Abweichung von Server-Autorität oder Mandantentrennung; per Default verboten, nur dokumentierte/getestete Owner-Ausnahme.
- **GO/NO-GO der Milestone-Gates M0–M4** auf realen Daten.

**Agent-autonom (ohne Rückfrage):** Frontend ohne Sicherheitslogik (Renderer/Editoren/Cockpits/States), alle Tests schreiben/ausführen, Adversarial-Verify, verhaltensneutrales Refactoring, i18n/Doku/ADR-Notizen, Migrationen/Edge-Functions **gegen Preview/Branch** anwenden (nie Prod), Completeness-Critic/loop-until-dry, Content-/Quiz-Drafts (bleiben draft bis Admin-Review), Recherche/Risiko-Dossiers/Entscheidungsvorlagen.

**Kadenzen:**
| Termin | Frequenz | Agenda |
|--------|----------|--------|
| Daily Async Standup | werktags | Agenten posten: gemergt (L0) / wartende L1-PRs / rote CI-Gates / blockierte L2-L3. Mensch triagiert <15 Min. Kein roter Eskalations-/IDOR-/`answer_keys`-pgTAP über Nacht. |
| Sprint Planning | alle 2 Wochen | Nächsten ~18-Punkte-Sprint ziehen; je Story L0–L3 labeln; Preview-Demo-Kriterium + Exit-AC; Geld/Recht/Rollen-Berührung markieren. Scope-Cut = Mensch. |
| **Akademie-Council** | wöchentlich (90 Min) | Die 1–2 wichtigsten L2/L3-Weichen adversarial härten (N Entwürfe → Bewertung → Refutation → Synthese → Mensch-Entscheid). Stehende Frage: wurde eine harte Invariante angekratzt? Was bringt uns aufs nächste Level? |
| Architektur-/Security-Board | alle 2 Wochen + ad hoc | Diff-Review aller neuen RLS/SECURITY-DEFINER/`academy_*` gegen die zwei Mandate; `pg_policies` auf nested-EXISTS/Indizes; beweisen: academy-Signup = 0 `user_roles`. |
| Milestone Go/No-Go | je Milestone (M0–M4) | Maschinelle Verifikation aller Exit-Kriterien; Skeptiker widerlegt jedes; dann gibt der Mensch Prod/Realdaten frei. |
| Backlog-Refinement | wöchentlich (60 Min) | Nächste 1–2 Sprints schärfen; fehlende Negativtests/DoD-Lücken (loop bis trocken); L2/L3 für den Council vorbereiten. |

---

## 6. Next-Level-Debattenagenda

| ID | Debatte | Schärfste Frage | Ritual | Entscheider |
|----|---------|-----------------|--------|-------------|
| **D01** | Migration-Go-Live & Demo→Prod-Cutover | Wie genau einspielen (Dashboard, Preview-zuerst, Idempotenz) ohne dass `handle_new_user`/Triple-Blind auf der Plattform driftet? | adversarial verify + pipeline | Founder (Go-Live-Gate) |
| **D02** | Stripe-Webhook-P0 schließen | `JSON.parse(body)`-Fallback ersatzlos raus + `constructEventAsync` + Idempotenz — blockierendes Gate für jede Billing-Story? | adversarial verify + Completeness-Critic | Founder |
| **D03** | Server-Autorität Phase 2 | Progress/Quiz/Zertifikat aus dem Client herausreißen; bestandener Test vergibt garantiert nie eine `user_roles`-Zeile | Judge-Panel + adversarial verify | Architect / Founder (M1) |
| **D04** | Kohorten-Default vs. self-paced | Ist der Launch eine getaktete Kohorte (85–96 % Completion) oder zuerst self-paced? | Judge-Panel | Founder |
| **D05** | Entitlements als RLS-Wahrheit | Premium-Gating ausschließlich serverseitig (Entitlement-Cache nur aus Webhook) statt UI-Flag | adversarial verify + Completeness-Critic | Architect / Founder |
| **D06** | Andock-Funnel ohne Self-Service-Schlupfloch | Zertifiziert → Admin-Review → Grant nur bei accepted+admin; account_type=academy leitet nie eine Rolle ab | adversarial verify + pipeline | Founder / Security |
| **D07** | RLS-Härtung vor Skalierung | nested-EXISTS-Policies + fehlende Indizes ersetzen — blockierendes Gate vor Mehr-Kohorten-Last? | loop-until-dry + adversarial verify | Architect |
| **D08** | KI-Tutor: grounded RAG mit EU-Hoheit — oder vorerst nicht | grounded-RAG via Bedrock EU + fail-closed PII + Eval-Gate, oder M3/M4 vertagen? | Judge-Panel + adversarial verify | Founder |
| **D09** | Content-Skalierung | `body`-TEXT → `lesson_blocks` + `course_versions` vor Skalierung; wer produziert Kurstiefe im Kohorten-Takt? | Completeness-Critic + pipeline | Founder |
| **D10** | Pricing-Kalibrierung | Tier-Struktur + offenes Freemium vs. zeitbegrenzter Trial vs. Einmalkauf/B2B-first gegen Cashflow-Timing | Judge-Panel + adversarial verify | Founder |
| **D11** | Recht/AZAV/Widerruf | Welche Akademie-Rechtstexte sind harte Go-Live-Voraussetzung; AZAV nur mit echter Zulassung | Completeness-Critic + adversarial verify | Founder + Legal/DSB |

*(Vollständige Fragen, „warum jetzt", Teilnehmer und Erfolgsmetriken je Debatte in den Workflow-Transkripten.)*

---

## 7. Die erste Sitzung — was wir als Nächstes ausführen

**Sofort-Block (M0-Gate, blockiert alles andere) — zwei Debatten zuerst:**

1. **D02 — Stripe-Webhook-P0** *(unabhängig vom Migration-Blocker, sofort lösbar):* `adversarial verify` fährt den Angriff (manipulierter Body, fehlendes Secret), dann der Fix (`constructEventAsync` + Idempotenz). **Exit:** `grep 'JSON.parse(body)'` = 0, unsignierter Webhook → 400, doppelter `stripe_event_id` → genau 1× verarbeitet. *(Liegt bereits als Task-Chip `task_1c13bfcc`.)*
2. **D01 — Migration-Go-Live-Cutover:** `adversarial verify` („was bricht auf der Plattform?") + `pipeline` (Preview-Apply → `pg_policies`/`\d`-Verify → Smoke → Prod-Apply). **Exit:** `academy_courses ≥ 2 published` auf Prod, Plattform-`handle_new_user` byte-identisch (Blast-Radius 0), `academyDbAvailable()` schaltet Demo→DB nachweislich um.

Danach (M1): **D03 (Server-Autorität Phase 2)** als Judge-Panel — der Moat hängt am fälschungssicheren Zertifikat.

**Reihenfolge-Logik:** D02 ist ein reiner Code-Fix ohne Abhängigkeit → zuerst. D01 ist das Tor zu allem Datengetriebenen. D03 sichert den Moat, sobald die DB live ist.

---

## 8. So rufst du es auf

Du steuerst das Team in Klartext — ich übersetze in den passenden Workflow:

- **Eine Weiche entscheiden:** „Führe **R1 Design-Debatte** zu **D04** (Kohorten-Default)." → Ich starte ein Judge-Panel mit heterogenen Entwürfen (Sokrates/Hermes/Vitruv), Jury + Refutation, und gebe dir **eine synthetisierte Empfehlung + Minderheitsvotum** zur Ratifikation zurück.
- **Etwas härten/angreifen:** „Führe **R3 Adversarial-Review** auf den Andock-Funnel." → Argus + Cerberus versuchen Self-Grant/IDOR/Privilege-Escalation bis loop-until-dry; du bekommst die Befunde + nötige Negativtests.
- **Breit recherchieren:** „Führe **R5 Research-Sweep** zu Pricing." → multi-modal sweep, du setzt den Owner-Cut.
- **Sprint vorbereiten:** „Führe **R4 Refinement** für den nächsten Sprint." → DoR + Triage (L0–L3) + Completeness-Critic.
- **Council abhalten:** „Akademie-Council: D01 + D02." → die zwei Sofort-Debatten, adversarial gehärtet, zur Entscheidung vorgelegt.

**Was du zurückbekommst:** je nach Gate entweder ein fertiges Artefakt (Code/Test/ADR, bei L0/L1 nach grünem Refuter) oder eine **Entscheidungsvorlage mit überlebtem Gegenangriff + Minderheitsvotum** (bei L2/L3), die nur du ratifizierst. Append-only protokolliert.
