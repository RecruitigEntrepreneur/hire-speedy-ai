# Jobaufnahme — Next-Level Framework (KI-dynamisches Client-Intake)

**Stand:** 2026-06-19 · Quelle: 4-Strang-Research (Recruiter-Realität, aktuelles Modell, harte + weiche Bedarfe)
**Ziel:** Vom Kunden **alle** Infos bekommen, die ein Recruiter braucht, um *triple-blind* zu besetzen — als kurzes, intelligentes, adaptives Gespräch statt Formular.

---

## 0. Warum das „Next Level" ist (der strategische Hebel)

Das Intake erzeugt drei Outputs auf einmal:
1. **Besseres Matching** — harte K.O.-Kriterien gaten den Match (heute prüft der Matcher nur `must_haves` gegen eine hardcodierte Finance/IT-Keyword-Liste).
2. **Fertiger anonymer Pitch** — der „Sell" + die Reveal-Envelope ergeben die Outreach-Story, ohne den Kunden zu nennen.
3. **Recruiter-Briefing** — schließt die Schleife: der Recruiter sieht endlich, *warum* die Stelle offen ist, was Erfolg ist, wie das Team aussieht.

**Es ist kein Greenfield.** Heutige Defekte, die wir mitfixen:
- ~13 von der KI extrahierte Felder werden beim `jobs.insert` verworfen (haben aber DB-Spalten): `failure_profile`, `decision_makers`, `unique_selling_points`, `position_advantages`, `department_structure`, `bonus_structure`, `team_avg_age`, `core_hours`, `overtime_policy`, `industry_challenges/opportunities`, `benefits`, …
- `intake_briefing` speichert `company_culture` statt des getippten Briefings (Briefing-Text geht verloren).
- `candidates_in_pipeline`: `parseInt('1-3')` → `1` (lossy).
- `intake_completeness` = fixe 10-Feld-Checkliste, nur über KI-Daten; manuelle Antworten & 15 weitere Felder zählen nicht.
- Recruiter-UI liest `jobs.*`, mappt aber nur ~15 Felder; `RecruiterQuickFacts` erfindet Teamgröße/Kultur/Prozess per LLM.

---

## 1. Die vollständige Intake-Taxonomie

13 Blöcke. **★ = immer fragen / triple-blind-kritisch.** Sonst adaptiv (nur bei Lücke × Impact).
Jedes Item = ein Frage-Knoten mit Antwort-Chips im KI-Engine.

### Block 1 — Warum & Kontext ★ (Root)
- **Auslöser** (Wachstum / Nachbesetzung / Ablösung / neue Funktion / Elternzeit / Reorg)
- **Vorgänger-Story** *(nur bei Nachbesetzung/Ablösung)* — höchstes Signal, am seltensten gefragt: warum ist der/die Letzte gegangen/gescheitert?
- **Business-Narrativ** („warum jetzt") → Opening jeder Outreach.

### Block 2 — Rolle & Scope
Titel (intern **+** marktüblich) · Seniorität (kalibriert, nicht nur Label) · Top-5-Verantwortung/Outcomes (12 Mon.) · berichtet an + Manager-Profil · Teamgröße & Zusammensetzung (führt vs. baut) · Budget/Headcount/P&L · **Such-Schwierigkeit** (wie selten? schon mal versucht?).

### Block 3 — Muss / Kann / Anti-Persona
- **Muss-Kriterien force-ranked (max 5)** — die echten, nicht die JD-15.
- **Kann-Kriterien** (Tie-Breaker).
- **Das #1-Kriterium** („wenn du nur auf eins screenen dürftest").
- **Anti-Persona** — wer mit Top-CV hier trotzdem scheitert (oft schärfer als die Muss-Liste).

### Block 4 — Skills: Pflicht vs. trainierbar
Day-one-Pflicht-Skills · **trainierbar / Ramp ok** (großer Pool-Hebel) · Soft-Skills (verhaltensnah) · Domäne/Branche (Muss oder transferierbar?) · Tools (exakt vs. äquivalent).

### Block 5 — Harte K.O.-Kriterien ★ (binäre Gates, vor dem Scoring)
Arbeitserlaubnis/Visum/Sponsoring · Standort-/Pendelradius · Sprachen **+ Level** (was spricht das Team wirklich?) · Zertifikate/Lizenzen (gesetzlich vs. nice) · Clearance/Vetting · Abschluss als echtes Gate? · **Non-Compete/Conflicts** *(triple-blind: Recruiter muss vor Reveal prüfen)* · Tenure/Job-Hopping.

### Block 6 — Vergütung & Flexibilität ★ (für triple-blind am wichtigsten)
Basis-Band (min/Ziel/**echtes Max**) · Bonus/Variable · Equity (echte Terms) · **Was flext + die Decke je Hebel** (Base, Sign-on, Titel, Equity, Remote-Tage) = das Closing-Budget des Recruiters · Benefits/Perks · Sign-on/Relocation/Buyout · *(Freelance:* Tagessatz-Band all-in vs. + Spesen).

### Block 7 — Arbeitsmodell & Logistik
Remote/Hybrid/Onsite **mit exakter Tage-Kadenz** (fixe Tage?) · Büro-Standort(e) · Relocation + Support · Reise-% (Art) · Arbeitszeiten/Zeitzone/On-Call · **Team-Umfeld & Kultur** *(triple-blind-Sell-Asset)* · *(Freelance:* Onsite-/Remote-Split).

### Block 8 — Timing & Vertrag (FORK)
Startdatum/Dringlichkeit · **Kündigungsfristen-Toleranz** (mit Startdatum abgleichen!) · **Vertragsart = Master-Fork** (Festanstellung / befristet / Freelance / temp-to-perm) · *(Freelance:* Dauer/Enddatum · Verlängerungs-Wahrscheinlichkeit · Auslastung) · Vertragsspezifika (Probe, IP, Exklusivität, Compliance/Scheinselbstständigkeit).

### Block 9 — Der Sell / EVP
Mission/Produkt · Team & Manager (anonymisierbar: „ex-FAANG-Lead") · Stack *(nur stack-relevante Rollen)* · Karrierepfad (2–3 J.) · Comp-Struktur · Flexibilität · **Der X-Faktor** („die EINE Sache") — höchstes Gewicht im Pitch; fehlt er → dünne EVP-Warnung.

### Block 10 — Prozess & Entscheider
Runden & Format · **Entscheider (wer & wie viele, wer hat Veto)** · Geschwindigkeit/Kadenz · Dringlichkeit/Deadline. *(Auto-Flag: 4+ Runden + langsam = Funnel-Drop-Risiko.)*

### Block 11 — Sourcing-Intelligenz (höchster Hebel, am meisten unterinvestiert)
**Ziel-Firmen** (wo wachsen genau diese Leute) · **No-Go-Firmen** (Kunden/Partner/No-Poach) · **aktuelle Jobtitel** (Title-Mapping → Boolean) · adjazente Profile (wenn Pool trocken) · Geografie/Markt-Realität.

### Block 12 — Versteckte Risiken & Red Flags
Strukturell/legal (Betriebsrat, fixe Bänder, Visum, Tarif) · Team-Politik (interne:r Kandidat:in? übernommenes Low-Performer-Team?) · warum bisherige Kandidaten abgelehnt wurden (entlarvt die *echte* Latte) · nicht-offensichtliche Deal-Breaker · **die ehrliche Schattenseite** (jede Rolle hat einen Haken → Gegen-Frame vorbereiten).

### Block 13 — Triple-Blind-Steuerung ★ (das Herzstück)
- **Reveal-Envelope (Green-List):** was darf anonym gesagt werden (Branche/Größe/Stage/Region/Perks/Comp-Band)? *Default-deny.*
- **Geschützte Identifier (Red-List):** Name, Gründer, Flagship-Produkt, exakter Standort, markanter Investor.
- **Anonymer Descriptor:** die eine Zeile („eine schnell wachsende Series-B-Fintech").
- **Reveal-Trigger/-Zeitpunkt** → mappt direkt auf die bestehende Reveal-/Opt-In-Gate-Logik.
- **Kandidaten-seitiger Blind** (die dritte Blindheit).

---

## 2. Wie die dynamische KI-Engine fragt (Orchestrierung)

- **Root-first:** Block 1 (warum offen) zuerst — pre-fillt/branched Karrierepfad, Dringlichkeit, Success-Profil, Ziel-Firmen.
- **Fork auf Vertragsart (Block 8):** schaltet Freelance- vs. Festanstellungs-Zweige (Tagessatz/Dauer/Auslastung vs. Gehalt/Kündigung/Probe).
- **Gate auf Seniorität + Schwierigkeit:** je schwerer, desto härter drängt die KI, **Muss-Kriterien zu kürzen**, **Trainierbares zu erweitern**, **Comp-Decke zu mappen**.
- **Conditional firing:** Vorgänger-Story nur bei Nachbesetzung; Stack nur bei stack-relevanten Rollen; Betriebsrat nur EU/Großorg.
- **Tension-Detection (Auto-Flag an Kunden):** viele Runden + langsame Kadenz · ASAP + lange Kündigungsfristen im Zielpool · 12-Monats-Ziele schwerer als Comp/Seniorität · Büro-Pflicht + Nischen-Skill + kleiner Markt · zu lange Muss-Liste.
- **De-Anonymisierungs-Guardrail:** prüft Green-List gegen Red-List; wenn Branche+Region+Größe+Stage auf <~3 Firmen kollabieren → Band verbreitern lassen, bevor ein Pitch generiert wird.
- **Frage-Ökonomie:** Pflicht = Muss-Kriterien, Reveal/Protect-Listen, Ziel-/No-Go-Firmen. Alles andere degradiert elegant (mit sinnvollen Defaults überspringbar) — aber **immer flaggen, was angenommen wurde**.
- **Nie blockieren, nur nudgen** (Entscheidung des Auftraggebers).

**Completeness neu definiert:** gewichteter Impact-Score über die ganze Taxonomie (Pflicht-Items zählen mehr), nicht die fixe 10-Feld-Liste. Manuelle Antworten zählen mit.

---

## 3. Was das für den Build heißt

**A. Erfassung reparieren & erweitern**
- Alle extrahierten Felder persistieren (die ~13 Drop-Felder); `intake_briefing`-Bug fixen; `candidates_in_pipeline`-Coercion fixen.
- Neue Capture-Pfade für Taxonomie-Items ohne Quelle (Sourcing-Intel, Reveal-Envelope, Flex-Decke, Anti-Persona, Vorgänger-Story, Entscheider).
- Ggf. wenige neue Spalten (z. B. `reveal_envelope` jsonb, `protected_identifiers`, `target_companies[]`, `nogo_companies[]`, `comp_flex` jsonb, `search_difficulty`).

**B. KI-Frage-Engine** (Edge-Function `intake-questions`)
- Input: aktueller Job-Entwurf + bisherige Antworten → Output: nächste Fragen + Chips + aktualisierte (gewichtete) Completeness, gemäß Orchestrierung oben.

**C. Recruiter-Schleife schließen** (zweite Hälfte!)
- Erfasste Felder an den Recruiter ausspielen statt LLM-Halluzination: echte Teamgröße/Kultur/Prozess/Success-Profil/Sell/Benefits.
- Reveal-Envelope speist den anonymen Pitch + den `generate-job-expose`-Output.
- Completeness-Badge im Recruiter-Feed (briefing-Qualität sichtbar).

**D. Matching anschließen**
- Harte K.O.-Kriterien (Sprache, Visum, Onsite-Radius, Zertifikate) als echte Gates in den Match/Submit-Check (heute ungeprüft).

---

## 4. Offene Entscheidungen
1. **Build-Reihenfolge:** erst Client-Intake (Erfassen) oder gleich beide Hälften (inkl. Recruiter-Ausspielung)?
2. **Neue Spalten vs. ein `intake_payload` jsonb** für die neuen Dimensionen (schemaärmer, flexibler) — vs. typisierte Spalten (matching-freundlicher).
3. **Wie viele Fragen max.** pro Sitzung als „perfekt" (Richtwert 5–8 adaptiv, Rest optional/später durch Recruiter ergänzbar?).

*Referenzen: Research-Output `tasks/wgvnvj0gt.output`; bestehende Bausteine `useIntakeBriefing`, `extract-intake-briefing`, `format-job-for-recruiters`, `jobs`-Schema.*
