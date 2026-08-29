# Kunden-Onboarding & KI-Jobaufnahme — Masteranalyse

**Stand:** 2026-08-29 · **Auftrag:** Ist-Zustand beweisen, Schwächen aufdecken, State-of-the-Art-Zielzustand entwickeln
**Methode:** 17 unabhängige Fachagenten (Phase 1 Code-Audit, Phase 2 Question Design Council, Phase 3 Red Team), anschließend Synthese
**Umfang der Erhebung:** 2,1 Mio Token, 593 Werkzeugaufrufe, 105 Befunde, 114 inventarisierte Fragen, 122 Question Cards
**Es wurde nichts programmiert, deployed, migriert oder geschrieben.**

Begleitdokumente:
- [INTAKE_EVIDENCE_MAP.md](INTAKE_EVIDENCE_MAP.md) — alle 105 Befunde mit Beleg, Auswirkung, Empfehlung, Akzeptanzkriterium
- [INTAKE_FRAGENKATALOG.md](INTAKE_FRAGENKATALOG.md) — der vollständige Fragenkatalog, 122 Question Cards in sechs Rollenvarianten

---

## Beweisstufen

Jede Aussage in diesen Dokumenten trägt genau eine Stufe:

| Stufe | Bedeutung | Anteil |
|---|---|---|
| **BEWIESEN** | Datei:Zeile zitiert, REST-Antwort gegen Produktion, oder git-Ausgabe | 82 von 105 |
| **ABGELEITET** | aus Code-Logik oder Policy-Definition gefolgert, nicht ausgeführt | 20 von 105 |
| **ANNAHME** | mit den vorhandenen Zugängen nicht prüfbar | 3 von 105 |

### Was tatsächlich zugänglich war

| Zugang | Status |
|---|---|
| Repository (git, `gh`, authentifiziert) | ✅ |
| Supabase REST mit **anon-Key** — Spalten-Existenz via `42703`, Function-Deploy via 404/400-Fingerprint | 🟡 nur lesend, nur öffentlich |
| Ausgeliefertes Produktions-Bundle über HTTPS | ✅ |
| Supabase CLI / Service-Role / `psql` | ❌ — **RLS-Policies sind daher aus Migrationsdateien ABGELEITET, nicht getestet** |
| HubSpot, Sentry, PostHog/Statsig, Playwright, eingeloggter Browser | ❌ — **jede Conversion-Zahl in diesem Dokument ist eine Hypothese, keine Messung** |

Der Fingerprint für Edge Functions wurde validiert: deployte Funktionen antworten auf `POST {}` mit 400 oder 500 (`assess-candidate-fit` → 400, `send-email` → 500), nicht deployte mit 404 `NOT_FOUND_FUNCTION_BLOB`, Kontrolle mit erfundenem Namen → 404.

### Umgebungsbeweis

| Umgebung | Stand | Beleg |
|---|---|---|
| **Produktion** `matchunt.ai` | Bundle **zwischen 16.06. und 11.07.2026** — älter als der letzte Commit | i18n-Marker aus `152584f` vorhanden, sämtliche Marker aus `cfdd238` (11.07.) fehlen |
| **Produktions-DB** | dem Frontend teils **voraus**, teils zurück — Migrationen selektiv angewandt | REST-Proben, siehe unten |
| **Lokal** | Commit `d305a93`, ungepusht | git |
| `matchunt.de` | registriert, **null DNS-Einträge** | dig |

---

# A · Executive Verdict

## Wo wir wirklich stehen

**Es gibt in Produktion keinen durchgehenden Pfad von der Akquise bis zum Suchauftrag.** Nicht „einen mit Schwächen" — keinen.

Der Kunde kann sich registrieren und im alten Formular (`/dashboard/jobs/new`) einen Job mit Titel, Firmenname und Gehaltsspanne anlegen. Das ist alles, was funktioniert. Jeder Schritt darüber hinaus fällt aus:

- **Die drei Import-Wege sind tot.** `parse-job-url`, `parse-job-pdf`, `parse-pdf`, `enrich-job-data` → 404. Einziger funktionierender Einstieg ist „Manuell erstellen".
- **Beide Briefing-Systeme sind unerreichbar.** Das KI-Briefing (`intake-questions`) ist 404. Das statische Briefing als Fallback lebt nur innerhalb des Studios — und das Studio ist im ausgelieferten Bundle nicht enthalten. **Kein Kunde hat je eine Briefing-Frage gesehen.**
- **Es gibt keinen Codepfad, der eine Organisation anlegt.** `createOrganization` ([useOrganization.ts:69](src/hooks/useOrganization.ts:69)) hat null Aufrufer. Für jeden nach dem 10.07. registrierten Kunden bleibt `jobs.organization_id` NULL — Team, Rollen, interne Freigabe, Job-Scoping existieren für ihn nicht.
- **Team-Einladungen sind an beiden Enden tot.** `validate-invite` und `organization-invite` → beide 404, und die frühere Fallback-Policy wurde gelöscht.
- **Das Outreach-Modul hat noch nie eine E-Mail versendet.** Alle 11 Zeilen in `outreach_emails` haben `sent_at = null`. 7 von 8 Edge Functions sind 404.

## Der größte einzelne Defekt

**Das Briefing hat keinen Empfänger.** Selbst wenn morgen alles deployed wäre, würde der Kunde 34 Fragen beantworten, deren Antworten kein Recruiter je zu sehen bekommt.

`jobs.briefing_notes` und `intake_briefing` sind aus `recruiter_jobs_view` **bewusst entfernt** ([Migration:98-101](supabase/migrations/20260725120000_recruiter_jobs_view_hardening.sql:98)). `description` und `requirements` sind bis zum Reveal NULL. Und der einzige redigierende Kanal — `format-job-for-recruiters`, deployed — nimmt das Briefing gar nicht erst in seinen Prompt auf ([index.ts:65-107](supabase/functions/format-job-for-recruiters/index.ts:65)).

Das ist kein Deploy-Problem und keine fehlende Migration. Es ist eine **Architekturlücke**: Der teuerste Arbeitsschritt des Kunden hat keinen Auslieferungskanal. Der Kunde merkt es erst, wenn die ersten Kandidaten kommen und offensichtlich nichts vom Briefing berücksichtigt wurde — also genau an dem Punkt, an dem er über Weiternutzung entscheidet.

## Der größte Conversion-Hebel

**Die Reihenfolge umdrehen.** Heute unterschreibt der Kunde in Minute 2 einen Vermittlungsvertrag mit einem Preis, den die Landingpage nie genannt hat — 7 Klicks und 4 Pflichteingaben, bevor er irgendetwas Nützliches gesehen hat. Der erste echte Nutzen ist laut eigener Anzeige „Ø 3–5 Tage" entfernt.

Das ist der klassische Commitment-vor-Wert-Fehler, verschärft durch drei sich widersprechende Preisaussagen: Landingpage sagt „kostenlos", Onboarding sagt „20 %", die verlinkte AGB sagt, es gebe keinen festen Satz.

## Der größte Qualitätshebel für Recruiting und Matching

**Die Flexibilitätsmatrix an das Scoring anschließen.** Der Kunde markiert heute pro Muss-Kriterium, ob es fix, verhandelbar oder flexibel ist — und diese Aussage landet in einem Blob, den kein Matcher liest.

Der Matcher wirft bei `mustHaveCoverage < 0.40` komplett aus ([v3-1:846](supabase/functions/calculate-match-v3-1/index.ts:846)). Bei fünf Muss-Kriterien reicht das Fehlen von drei **explizit als flexibel markierten**, um den Kandidaten zu eliminieren. Der Kanal dafür existiert bereits: `job_skill_requirements.weight`.

Dahinter zweitrangig, aber ebenfalls teuer: Die drei Hard-Kill-Felder `required_languages`, `required_certifications`, `onsite_required` **existieren als Spalten** und werden vom Matcher gelesen — der Intake schreibt sie in einen JSONB-Blob. Sprach-, Präsenz- und Zertifikats-Kill feuern nie.

## Was keinesfalls direkt gebaut oder deployed werden darf

1. **`process-outreach-queue` deployen, bevor die offenen RLS-Policies entfernt sind.** Anonyme Nutzer können — abgeleitet aus `FOR ALL USING (true)` — Zeilen in `outreach_send_queue` einstellen. Mit deployter Queue wird daraus ein offenes Mail-Relay auf der Absenderdomain, an der die Zustellbarkeit des gesamten Vertriebs hängt. **Reihenfolge ist zwingend: erst Policies, dann Deploy.**

2. **Die von `backend-security` vorgeschlagene `WITH CHECK`-Subquery.** Das Red Team hat nachgewiesen: Namensverdeckung macht die Bedingung wirkungslos und Postgres bricht mit `infinite recursion detected in policy for relation jobs` ab. Umgesetzt könnte anschließend **kein Kunde mehr irgendeine Stelle ändern**. Stattdessen die Trigger-Variante.

3. **`draft_state` oder den Tagessatz in `briefing_notes` ablegen.** Zwei Agenten haben das vorgeschlagen. In diesem Feld liegen bereits drei Bedeutungen (Briefingtext, `[ABGELEHNT]`-Präfix, freie Notiz), und der Studio überschreibt es bedingungslos bei jedem Speichern. Richtig ist eine additive Spalte `jobs.draft_state jsonb`.

4. **Das Studio live schalten, ohne den manuellen Ausweg zu ergänzen.** Der alte Flow hat einen „Manuell erstellen"-Button, der neue nicht. Bei toter Edge Function ist der neue Flow eine Endlosschleife: Der Nutzer landet nach jedem Versuch wieder im leeren Textfeld, mit einer Fehlermeldung, die ihm die Schuld gibt. **Der neue Pfad ist strikt fragiler als der, den er ersetzen soll.**

5. **Nichts an den Rechtstexten „nur schnell korrigieren".** Vier divergierende AGB-Fassungen, ein Recruiter-Vertrag mit einer fremden Gesellschaft, eine Datenschutzerklärung, die ein nicht ausgeliefertes Produkt beschreibt. Das gehört anwaltlich geprüft, nicht patchweise editiert.

---

# B · Ist-Flow, Screen für Screen

> **Wichtige Korrektur zur Vorabanalyse.** Ich hatte angenommen, das statische `IntakeBriefing` sei der Fallback, der heute real läuft. **Das ist falsch.** `IntakeBriefing.tsx` wird ausschließlich von `DynamicBriefing.tsx:137` gerendert, das nur in `JobIntakeStudio.tsx:626` lebt, das wiederum aus Commit `cfdd238` (11.07.) stammt — also aus dem nicht ausgelieferten Bundle. **Heute läuft in Produktion weder das KI-Briefing noch das statische.**

## B.0 Einstieg — Landing `/`

| | |
|---|---|
| **Ziel** | Interesse wecken, in die Registrierung führen |
| **CTA** | „Job kostenlos ausschreiben" ([de.ts:186](src/i18n/locales/de.ts:186)) |
| **Preisangabe** | **keine** — `PricingSection.tsx` enthält null Treffer auf `%`, `Prozent`, `Gebühr` |
| **Akquise-Link** | **existiert nicht.** Ein grep über das gesamte Outreach-Modul nach `acquisition\|akquise\|referral\|invite_token\|tracking_link\|utm_\|short_link\|signup_link` liefert **null Treffer**. Der einzige CTA der KI-Mails ist eine manuelle Bitte um einen 15-Minuten-Termin. |
| **Problem** | „kostenlos" trifft auf 20 % Erfolgshonorar im Onboarding und auf „kein fester Satz" in der AGB. Drei Aussagen, die sich gegenseitig widersprechen. |

## B.1 Registrierung — `/auth`

| | |
|---|---|
| **Felder** | Voller Name (min. 2), Rolle (Radio Unternehmen/Recruiter), E-Mail, **Passwort min. 6 Zeichen** ([Auth.tsx:16](src/pages/Auth.tsx:16)) |
| **Nicht erfragt** | Firmenname, Domain, Telefon |
| **Danach** | Client → `navigate('/onboarding')` ([Auth.tsx:46](src/pages/Auth.tsx:46)) |
| **Fehlt** | **Kein Passwort-Reset im gesamten Flow.** Kein „E-Mail bestätigen"-Zustand; der Bestätigungslink führt auf die Marketing-Startseite. |
| **Schreibt** | `auth.users`, `profiles`, `user_roles` — **nicht** `organizations`, **nicht** `company_profiles` |

## B.2 Onboarding — `/onboarding`, vier Schritte

**Schritt 0 · AGB.** Vier Absätze **hardcodiert im Component** ([ClientOnboarding.tsx:171-190](src/pages/onboarding/ClientOnboarding.tsx:171)), nennen „standardmäßig 20 % des Jahresgehalts". Checkbox → `acceptTerms('1.0')`. Gespeichert wird der String `'1.0'`, der auf kein identifizierbares Dokument zeigt. Der akzeptierte Text wird **nicht archiviert**.

**Schritt 1 · „Vertrag digital unterzeichnen".** Der Nutzer tippt seinen Namen in ein Textfeld mit `font-serif italic` ([Zeile 232](src/pages/onboarding/ClientOnboarding.tsx:232)). Kein Dokument, keine Version, kein Download, keine Vertretungsprüfung. Der Erklärungstext lautet „Hiermit bestätige ich, dass ich berechtigt bin, im Namen meines Unternehmens Verträge abzuschließen" — ein HR-Leiter mit Prokura-Bewusstsein bricht hier ab.

**Schritt 2 · Firmendaten.** HRB-Nummer und USt-IdNr., **beide als „(optional)" beschriftet**, Button „Abschließen" nie deaktiviert → `kyc_status = 'in_review'`.

**Schritt 3 · „Verifizierung abgeschlossen!"** — behauptet *„Ihr Account ist jetzt vollständig verifiziert"* ([Zeile 307](src/pages/onboarding/ClientOnboarding.tsx:307)), während `kyc_status` auf `'in_review'` steht. `isFullyVerified` verlangt `'verified'`; das setzt ausschließlich ein Admin.

> **Sicherheitsbefund (BEWIESEN):** `client_verifications` ist **selbst-schreibbar**. Die Policy ([20251204204702:43](supabase/migrations/20251204204702_1ad0b5f8-6ad4-4a0c-8b70-df9d13f36d05.sql:43)) hat kein `WITH CHECK` und keine Spalten-Whitelist. Ein `PATCH` auf `kyc_status='verified', contract_signed=true` macht jeden Account voll verifiziert — ohne Vertrag, ohne Registerprüfung.

**Was hier nicht passiert:** Es wird **kein `company_profiles`** angelegt und **keine `organizations`**-Zeile. Beides ist verifiziert per grep.

## B.3 Unternehmensprofil — `/dashboard/settings`

Existiert, wird aber **nirgends aktiv angeboten**. 14 Felder, davon eines Pflicht (Firmenname).

> **Folgewirkung (BEWIESEN):** Das Studio liest `company_profiles`, um Doppelfragen zu vermeiden ([JobIntakeStudio.tsx:122-136](src/components/dashboard/JobIntakeStudio.tsx:122)). Für jeden Neukunden ist die Abfrage strukturell leer. Der Vertrauensblock „aus Ihrem Firmenprofil: …" erscheint nie, `company_defaults` für die Briefing-KI bleibt dauerhaft `undefined`. **Das gebaute Anti-Doppelfragen-Feature kann für Neukunden nie greifen.** Zusätzlich: `company_profiles` hat **kein `organization_id`** — das Profil hängt am User, der Job an der Org. Und die gelesenen Felder `excluded_companies` und `company_size` existieren produktiv nicht.

## B.4 Der Live-Pfad — `/dashboard/jobs/new`

| | |
|---|---|
| **Modi** | `?mode=pdf\|text\|url` — **alle drei tot** (404) |
| **Einziger Weg** | „Manuell erstellen" ([CreateJob.tsx:906](src/pages/dashboard/CreateJob.tsx:906)) |
| **Pflichtfelder** | Jobtitel, Firmenname, Gehalt min+max ([getMissingRequiredFields](src/pages/dashboard/CreateJob.tsx:195)) |
| **Nicht Pflicht** | Standort, Skills, Must-Haves, Beschreibung, Anforderungen, Anstellungsart, Remote-Modell, Dringlichkeit, Vakanzgrund — **ein Job ist mit Titel + Firma + Gehaltsspanne einreichbar** |
| **Gate** | `canPublishJobs = terms_accepted && contract_signed` ([Zeile 589](src/pages/dashboard/CreateJob.tsx:589)) |
| **Folgefehler** | Der Block „KI-analysierte Firmeninfos" rendert nur bei `enrichmentData \|\| industry \|\| company_size_band \|\| funding_stage` — alle vier hängen an 404-Functions, andere Eingabefelder existieren nicht |

## B.5 Der nicht ausgelieferte Pfad — das Intake-Studio

> **Korrektur:** Das Studio hat nicht einen, sondern **drei** Einstiegspunkte: [NeueStelleBar.tsx:138](src/components/dashboard/NeueStelleBar.tsx:138), [JobsList.tsx:528](src/pages/dashboard/JobsList.tsx:528) (Entwurf fortsetzen) und [ClientJobDetail.tsx:556](src/pages/dashboard/ClientJobDetail.tsx:556) (**bestehenden Job nachbriefen**). Der letzte ist der gefährlichste: Dort führt der Datenverlust zum Überschreiben eines echten Jobs, nicht nur eines Entwurfs.

**`input`** → **`building`** → **`built`** → **`submitted`**

Die `building`-Stufe ist **reine Inszenierung**: Der KI-Aufruf läuft vollständig ab, *bevor* die Animation startet ([Zeile 253-257](src/components/dashboard/JobIntakeStudio.tsx:253)); die sieben Häkchen im 280-ms-Takt zeigen keinen Fortschritt.

**Vier P0-Defekte in diesem Pfad:**

1. **Kein manueller Ausweg.** `setBuilt` wird ausschließlich in `startBuild` aufgerufen — ohne KI-Antwort ist `built` unerreichbar.
2. **„Später weiter" löscht alles.** `draft_state` liegt in `intake_payload` ([Zeile 392](src/components/dashboard/JobIntakeStudio.tsx:392)) — die Spalte existiert produktiv nicht, [intakeCapture.ts:45-57](src/lib/intakeCapture.ts:45) speichert dann still ohne sie. Der Fortschrittsbalken steht beim Zurückkommen wieder auf 0.
3. **Kein Autosave, kein Verlassen-Schutz.** Escape oder ein Klick auf das Overlay verwirft die Sitzung.
4. **Contracting verliert die Vergütung komplett.** `salary_min/max` werden bei `freelance` hart auf `null` gesetzt ([Zeile 342](src/components/dashboard/JobIntakeStudio.tsx:342)), der Tagessatz landet nur in `intake_payload`.

**Und ein vom Red Team gefundener, den kein Fachagent sah:** Der Weg „Ergänzen & einreichen" für einen **zurückgegebenen** Job ([JobsList.tsx:457](src/pages/dashboard/JobsList.tsx:457)) überschreibt `briefing_notes` mit `serializeBriefing({})` = `null` — und **löscht damit den Ablehnungsgrund**, wegen dem der Kunde den Weg überhaupt geht. Er kann nie wieder nachsehen, was beanstandet wurde, reicht denselben Mangel erneut ein, wird erneut abgelehnt.

## B.6 Statusmaschine

```
draft ──┬──► pending_client_approval ──► pending_approval ──► published ──► paused
        └────────────────────────────────►                              └──► closed
                                                                        └──► filled (?)
```

> **Korrektur:** Die Maschine ist unvollständiger als angenommen.
> - `'filled'` wird von [ClientJobDetail.tsx:226](src/pages/dashboard/ClientJobDetail.tsx:226) geschrieben, kommt in `supabase/` aber **null Mal** vor. Der Admin sieht besetzte Stellen als „Entwurf". Das Umsatzsignal „über Matchunt besetzt" wird ersatzlos verworfen. *(Red Team präzisiert: `jobCockpit.ts:15,58` und `ClientJobDetail.tsx:599` behandeln `filled` sehr wohl — ein ersatzloses Streichen bräche drei Client-UI-Pfade.)*
> - Es gibt **zwei konkurrierende Pause-Wahrheiten**: der Kunde setzt `paused_at`, der Admin setzt `status='paused'`.
> - `pending_client_approval` ist über die Job-Detailseite **produktiv unerreichbar**: Weil `rejection_reason` fehlt, schlägt der erste UPDATE immer fehl und der Fallback setzt hart `'pending_approval'` — die interne Freigabe wird umgangen, obwohl der Kunde sie eingeschaltet hat.

> **Und die Maschine ist serverseitig nicht durchgesetzt (ABGELEITET):** Die UPDATE-Policy prüft nur `can_edit_job(id)` ohne Spalten- oder Statusbeschränkung, und es gibt keinen Statusguard-Trigger. Ein Kunde kann per `PATCH` `status='published'` plus eigene `fee_percentage` setzen. **Der einzige kommerzielle Kontrollpunkt der Plattform ist umgehbar.**

## B.7 Migrationsstand — selektiv, nicht hinterherhinkend

> **Wichtigste Korrektur der gesamten Analyse.** Migrationen sind in Produktion **selektiv und außer der Reihe** angewandt. Die Annahme „wenn Migration N läuft, lief auch N−1" ist ungültig.

| Migration | Status in Produktion | Beleg |
|---|---|---|
| `20260710130000_client_team_foundation` | ✅ **angewandt** | `jobs.organization_id`, `client_approval_note`, `client_approved_by/at` → je 200; `rpc/can_access_job` → 200 |
| `20260710120000_job_review_feedback` (**älter**) | ❌ nicht angewandt | `jobs.rejection_reason`, `rejected_at` → 400 |
| `20260716120000_job_close_reason` | ❌ nicht angewandt | `jobs.closed_reason`, `closed_at` → 400 |
| `20260619120000_intake_hybrid_foundation` | ❌ nicht angewandt | `intake_payload` u. a. → 400 |
| `20260718150000_match_v4_foundation` | ✅ angewandt | `requirements_normalized_at`, `match_events` → 200 |
| `20260725120000/132524` recruiter_jobs_view | ✅ angewandt | `company_revealed` → 200, `client_id` → 400 |

**Die Ursache dieses Musters muss vor dem nächsten Deploy geklärt werden, sonst wiederholt es sich.**

---

# C · Technische Evidence Map

Vollständig in **[INTAKE_EVIDENCE_MAP.md](INTAKE_EVIDENCE_MAP.md)** — 105 Befunde mit Beleg, Problem, Auswirkung, Empfehlung und Akzeptanzkriterium, sortiert nach Priorität.

**Verteilung:** 35 × P0 · 42 × P1 · 24 × P2 · 4 × P3

**Die zehn schwersten:**

| # | Befund | Stufe |
|---|---|---|
| 1 | **RLS-Leck:** `match_outcomes` (10.081 Zeilen), `outreach_emails`, `outreach_send_queue`, `outreach_rate_limits` anonym lesbar | BEWIESEN |
| 2 | Recruiter unterzeichnen live einen Vertrag mit **„MatchHub GmbH, Musterstraße 1, 10115 Berlin"** | BEWIESEN |
| 3 | Kandidaten-Einwilligung produktiv nicht erfassbar (`process-interview-response` 404), zwei Pfade heben sie ohne den Kandidaten auf | BEWIESEN |
| 4 | Kein Codepfad legt eine Organisation an — Mandantenmodell unerreichbar | BEWIESEN |
| 5 | Das gesamte Briefing erreicht keinen Recruiter | BEWIESEN |
| 6 | Kunde kann `status='published'` + eigene Fee selbst setzen | ABGELEITET |
| 7 | Flexibilitätsmatrix erreicht kein Scoring — flexible Muss-Kriterien killen wie fixe | BEWIESEN |
| 8 | DSGVO-Selbstbedienung (Export/Löschung) sind tote Buttons | BEWIESEN |
| 9 | Honorar: Kunde stimmt 20 % zu, Admin setzt einseitig 15–30 % | BEWIESEN |
| 10 | **Recruiter können die Marge von Matchunt auslesen** — `fee_percentage` und `recruiter_fee_percentage` stehen unmaskiert nebeneinander in `recruiter_jobs_view` | BEWIESEN |

Befund 10 fand kein Fachagent, nur das Red Team. Der Fix ist ein `CREATE OR REPLACE VIEW` ohne Frontend-Änderung.

---

# D · Fragen- und Daten-Audit

## D.1 Das Ist-Inventar — 114 Fragen

| Herkunft | Anzahl | Läuft heute? |
|---|---|---|
| Onboarding | 4 | ✅ ja |
| Firmenprofil (ClientSettings) | 14 | ✅ ja, aber nie angeboten |
| CreateJob-Formular | 30 | ✅ ja (nur manuell) |
| ProfileSections (Studio) | 17 | ❌ nicht ausgeliefert |
| Statisches Briefing | 34 | ❌ nicht ausgeliefert |
| KI-Briefing (11 Kapitel) | 15 Themenvorgaben | ❌ 404 |

**Was der Kunde heute real beantwortet: 4 Onboarding-Felder, optional 14 Firmenprofil-Felder, 20 Formularfelder + 6 Quick Questions + 1 Freitext.**

| Befund | Anzahl |
|---|---|
| Zielfeld **existiert in Produktion nicht** → stiller Verlust | **58 von 114** |
| Antwort landet **nirgends** | 1 |
| **Kein erkennbarer Nutzen** für Matching, Sourcing, Beratung, Vertrag oder Prozess | 6 |
| Pflichtfragen | 20 |

Nach Nutzen: Matching 53 · Sourcing 27 · Prozess 10 · Beratung 9 · Vertrag 9 · **kein erkennbarer 6**

**Und die Gegenprobe:** Von den zwölf Entscheidungen, die ein Personalberater vor dem ersten Anruf treffen muss, wird heute genau eine erfragt. Die wichtigste fehlende Frage im gesamten System lautet: **„Ist die Stelle intern freigegeben und das Budget eingeplant?"** — der teuerste einzelne Informationsmangel, an keiner Stelle des Inventars vorhanden.

## D.2 Streichen, vorbefüllen, später fragen

Vollständig in **[INTAKE_EVIDENCE_MAP.md](INTAKE_EVIDENCE_MAP.md#d2)**: 146 Streich-Empfehlungen aus acht Fachkatalogen, 107 Empfehlungen zur automatischen Vorbefüllung. Fragen, die **mehrere Agenten unabhängig** streichen wollen, sind gesondert markiert — das ist das stärkste Signal im ganzen Datensatz.

## D.3 Der Ziel-Fragenkatalog — 122 Question Cards

Vollständig in **[INTAKE_FRAGENKATALOG.md](INTAKE_FRAGENKATALOG.md)**. Sechs Varianten auf einem gemeinsamen kanonischen Kern:

| Katalog | Cards | Kernthese in einem Satz |
|---|---|---|
| **Kern (alle Rollen)** | 12 | Von zwölf Entscheidungen vor dem ersten Anruf wird heute eine erfragt |
| **IT & Digital** | 16 | Das Problem ist nicht zu wenig Information, sondern zu viel undifferenzierte — jeder genannte Begriff wird zum gleichgewichtigen Muss |
| **Finance & Controlling** | 16 | Nicht der Titel entscheidet, sondern welchen Abschluss die Person eigenständig unterschreibt, nach welchem Standard, über wie viele Gesellschaften, in welchem System |
| **Führung & Executive** | 15 | Es fehlen nicht Fragen, sondern eine Senioritätsebene oberhalb von „Lead" und ein Feld für Vertraulichkeit |
| **Contracting & Interim** | 15 | Contracting ist heute kein eigener Pfad, sondern eine Festanstellung mit abgeschalteter Vergütung |
| **Gesprächsführung** | 16 | Das heutige Instrument **belohnt Ausweichen** — „Weiß ich nicht" zählt 50 % in die Vollständigkeit |
| **Sourcing-Wirksamkeit** | 16 | Die Jobaufnahme erzeugt keine Suche, sondern eine Stellenanzeige |
| **Dialoglogik** | 16 | Der Prompt ist als Fragen-Autor gut, als Dialog-Maschine unbrauchbar — er delegiert vier Dinge an das Modell, die ein Modell prinzipiell nicht garantieren kann |

Jede Card enthält: internes Informationsziel · exakter kundensichtbarer Wortlaut · Kontexteinleitung bei sensiblen Themen · Trigger · Skip-Bedingung · Antworttyp und Optionen · Verhalten bei „Weiß ich nicht" · Zielfeld · Folgefragen · Widerspruchsregel · starke und schwache Beispielantwort · Konsequenz bei fehlender Antwort · Zweck · Sensitivitätsklasse.

---

# E · Der Ziel-Flow

**Leitprinzip: Der Wert kommt zuerst, das Konto entsteht nebenbei, die Verpflichtung kommt zuletzt.**

## ① Akquise-Link — `matchunt.ai/start/:token`

Personalisierte Landingpage. Der Token trägt vorangereicherten Kontext aus dem Outreach-Modul: Firma, Branche, Größe, Region, und — wo der Career-Page-Crawl etwas gefunden hat — die konkrete offene Stelle.

Der Kunde landet nicht auf einem leeren Formular, sondern auf: *„Sie suchen einen Senior Cloud Architect in Frankfurt — stimmt das?"*

**Sichtbar ab der ersten Sekunde:** das Erfolgshonorar in Prozent, „keine Fixkosten, kein Retainer", und wer der Absender ist.

## ② Sofort die Aufnahme, ohne Konto

Ein Feld, drei Alternativen (PDF, Link, ATS), plus **immer** ein sichtbarer manueller Weg. Erste Frage nach spätestens 15 Sekunden. Alles wird ab dem ersten Tastendruck am Token gespeichert.

## ③ Das Briefing

Der Katalog aus D.3, gesteuert von der Dialoglogik. Fünf Regeln, die heute alle verletzt sind:

- **Nie zweimal fragen.** Was aus Anzeige, Firmenprofil, Anreicherung oder einem früheren Job bekannt ist, wird **bestätigt, nicht gefragt** — und dem Kunden wird gesagt, wie viele Fragen dadurch entfielen.
- **„Weiß ich nicht" ist eine echte Antwort**, kein halber Fortschritt. Es erzeugt eine benannte offene Aufgabe mit Zuständigem und Frist.
- **Sichtbarer Rest-Aufwand** („noch ~3 Fragen, 2 Minuten") und jederzeit „Reicht mir, so einreichen".
- **Widersprüche werden benannt, nicht bevormundet**: konkret mit Zahlen, mit Vorschlag, mit „Lassen"-Option.
- **Die Reihenfolge ist deterministisch**, nicht dem Modell überlassen. Der heutige Prompt delegiert Nicht-Wiederholung und Terminierung an das LLM — beides kann ein Modell prinzipiell nicht garantieren.

## ④ Das Profil wächst mit — echter Fortschritt

Keine Animation nach getaner Arbeit. Jede Antwort verändert sichtbar Profil und Score, und zwar mit ehrlicher Konsequenz:

> *„Mit diesen 6 Muss-Kriterien und 75k erreichen wir schätzungsweise 12 Kandidaten im DACH-Raum. Ein Kriterium weniger: 40."*

Der heutige Score ist ein Motivations-Placebo — er steigt beim Überspringen und wird grün bei einer unvollständigen Aufnahme. Der Ziel-Score misst **Sourcing-Fähigkeit**, nicht Klickzahl.

## ⑤ Firmenprofil als Nebenprodukt

Aus Antworten und Anreicherung vorbefüllt, vom Kunden nur bestätigt. Wird beim Signup **serverseitig** angelegt — zusammen mit `organizations` und `organization_members`, per Trigger, nicht per UI-Aufruf.

## ⑥ Konto-Aktivierung am Punkt des höchsten Werts

Das fertige Profil liegt vor. Darüber: *„Um Ihre Stelle zu veröffentlichen, aktivieren Sie Ihren Zugang."* Nur E-Mail + Magic Link. Der Gast-Draft wird serverseitig auf den neuen Nutzer übertragen.

## ⑦ Konditionen als eigener, protokollierter Schritt

Nach der Admin-Festsetzung geht der Job in den Status **`pending_client_terms`**. Der Kunde nimmt **Prozentsatz, Bemessungsgrundlage, Fälligkeit und Rückerstattungsregel** per protokolliertem Klick an. Erst dann `published`.

Damit verschwindet der heutige Zustand, dass der Kunde 20 % zustimmt und der Admin danach 15–30 % festsetzt.

## ⑧ AGB und Vertrag: eine Quelle, versioniert

`/agb` bekommt eine harte Versions-ID. Das Onboarding zeigt keinen eigenen Text mehr, sondern ein Vollzitat derselben Quelle. Bei Annahme werden Versions-ID, Zeitstempel, IP, User-Agent und ein **unveränderlicher Snapshot** gespeichert.

## ⑨ KYC entkoppelt

Läuft parallel, blockiert die Aufnahme nicht, sondern höchstens die Rechnungsstellung. Die Statusfelder werden serverseitig geschützt.

---

# F · Kanonisches Daten- und Statusmodell

## F.1 Sieben getrennte Objektklassen

Heute liegt alles in `jobs` und `intake_payload`. Der Zielzustand trennt:

| Klasse | Beispiel | Eigenschaft |
|---|---|---|
| **Unternehmensfakten** | Branche, Größe, Standorte, Kultur | gilt firmenweit, wird **einmal** bestätigt, an `organization_id` |
| **Positionsanforderungen** | Titel, Level, Scope, Berichtslinie | pro Job |
| **Skills** | mit `kind`, `min_years`, `proficiency`, `recency` | strukturiert in `job_skill_requirements` |
| **K.O.-Kriterien** | Sprache+Niveau, Visa, Präsenzpflicht, Zertifikat | **eigene Spalten**, nie JSONB |
| **Flexibilität** | pro Muss-Kriterium fix/verhandelbar/flexibel | → `weight` (1.0 / 0.6 / 0.3) |
| **Präferenzen** | Zielunternehmen, No-Gos, Anti-Persona | Sourcing-relevant |
| **Reveal-Regeln** | Descriptor, green_list, red_list, Trigger | eigene Struktur |
| **Intake-Narrativ** | O-Töne, Kontext, Beratungshinweise | recruiter-privat, aber **ausgeliefert** |

## F.2 Source und Confidence — pro Fakt, nicht pro Job

Jeder Fakt trägt: `source` ∈ {`client`, `document`, `enrichment`, `ai_intake`, `ai_normalizer`, `previous_job`} und `confidence` (numerisch).

**Ohne das ist der Normalizer gefährlich:** `normalize-job-requirements` löscht heute alle `job_skill_requirements` und ersetzt sie durch KI-Ableitungen ([:148-155](supabase/functions/normalize-job-requirements/index.ts:148)) — die bewusst gesetzte Muss/Kann-Trennung des Kunden wird still überschrieben. Mit `source` darf der Normalizer nur Zeilen mit `source LIKE 'ai_%'` anfassen.

*(ABGELEITET: `MATCH_V4_ENABLED` steht in Produktion offenbar auf `true` — das Flag-Gate liegt in beiden V4-Functions **vor** der Argumentprüfung, und beide antworten mit 400 statt 403. Der Normalizer ist also scharf.)*

## F.3 Statusmaschine, serverseitig durchgesetzt

```
draft ──► pending_client_approval ──► pending_approval ──► pending_client_terms ──► published
   ▲              │                          │                                        │
   └──────────────┴── returned (mit Grund) ──┘                            paused ◄────┤
                                                                          closed ◄────┤
                                                                          filled ◄────┘
```

Durchgesetzt durch **einen** `BEFORE UPDATE`-Trigger auf `public.jobs`, der für Nicht-Admins `client_id`, `organization_id`, `fee_percentage`, `recruiter_fee_percentage`, `approved_by`, `approved_at` auf `OLD` zurückschreibt und Statusübergänge auf eine Whitelist beschränkt.

**Ausdrücklich nicht** über eine `WITH CHECK`-Subquery — das Red Team hat nachgewiesen, dass diese Variante durch Namensverdeckung wirkungslos ist und mit `infinite recursion detected in policy for relation jobs` jedes UPDATE lahmlegt.

## F.4 Token-Lebenszyklus und Draft-Transfer

| Phase | Eigentümer | Schutz |
|---|---|---|
| Link erzeugt | Verkäufer | `intake_invitations`, Token gehasht, Ablauf, Einmal-Bindung an erste Session |
| Gast-Intake | Token-Session | eigene Tabelle `intake_drafts`, **nie** `jobs` — Rate Limit pro IP, keine Rohdaten Dritter |
| Aktivierung | neuer User | serverseitiger Transfer per Edge Function, atomar |
| Danach | `organization_id` | normale RLS |

**Kritisch, weil es heute schon falsch ist:** `resumeDraft` ([NeueStelleBar.tsx:51](src/components/dashboard/NeueStelleBar.tsx:51)) lädt **jede** Job-Zeile ohne Ownership-Prüfung, und `buildRecord` schreibt beim Speichern blind `client_id: user.id`. Der Gast-Draft-Transfer muss das genaue Gegenteil tun: `client_id` ausschließlich im INSERT-Pfad setzen, nie im UPDATE.

## F.5 Abgrenzung zu CRM-Daten

**Produkt** besitzt: Unternehmensfakten, Job, Briefing, Kandidaten, Prozess.
**CRM** besitzt: Lead, Verkäufer-Owner, Deal, Pipeline-Stage, Aktivitätshistorie.
**Brücke** ist genau ein Feld: die `intake_invitations.token` → `organization_id`-Zuordnung.

Heute liegt die Anreicherung bereits im falschen Objekt und `outreach_leads` hat **kein Eigentümer-Feld** — Verkäufer-Attribution ist strukturell unmöglich.

---

# G · Event- und Messkonzept

> **Alle Zielwerte sind ANNAHMEN.** Es gibt keinen Analytics-Zugang. Der erste Schritt ist Instrumentierung, nicht Optimierung.
> **Struktureller Blocker (BEWIESEN):** `platform_events.user_id` ist `NOT NULL` — anonyme Akquise-Ereignisse können heute gar nicht gespeichert werden.

## G.1 Event-Schema

| Event | Wichtigste Properties | DSGVO |
|---|---|---|
| `acquisition_link.created` | token_id, seller_id, company_id | intern |
| `acquisition_link.sent` | channel, campaign_id | intern |
| `acquisition_link.opened` | token_id, referrer, device | **einwilligungspflichtig, wenn Pixel** |
| `intake.started` | token_id, entry_type (text/url/pdf/ats/guided) | Vertragsanbahnung |
| `intake.import_succeeded` / `.failed` | source, error_class, duration_ms | intern |
| `intake.first_value` | **time_to_first_value_ms** — Sekunden bis zum ersten befüllten Profil | Nordstern-Zulieferer |
| `intake.question_answered` | question_id, chapter, answer_type, `is_dont_know` | pseudonym |
| `intake.chapter_completed` / `.skipped` | chapter, completeness_delta | pseudonym |
| `intake.abandoned` | last_question_id, elapsed_ms, completeness | pseudonym |
| `intake.resumed` | gap_hours, device_changed | pseudonym |
| `intake.ai_suggestion_corrected` | field, source, confidence_before | **Qualitätssignal** |
| `account.activated` | method (magic_link), time_since_intake_start | Vertrag |
| `terms.accepted` | agb_version_id, snapshot_id, ip, user_agent | **Nachweispflicht** |
| `fee.confirmed` | fee_pct, basis, due_rule | **Nachweispflicht** |
| `intake.submitted` | completeness, question_count, dont_know_count | — |
| `intake.internally_approved` | approver_role | — |
| `job.published` | admin_id, time_in_review_ms | — |

## G.2 Metriken

**North Star:** *Vollständige, sourcing-fähige Suchaufträge pro Woche* — nicht „angelegte Jobs". Ein Job ohne beantwortete K.O.-Kriterien zählt nicht.

| Klasse | Metrik | Zielwert (Annahme) |
|---|---|---|
| **Conversion** | Link geöffnet → Intake gestartet | > 40 % |
| | Intake gestartet → übermittelt | > 55 % |
| | **Time-to-first-value** | < 15 s |
| **Qualität** | Anteil Jobs mit allen K.O.-Feldern belegt | > 90 % |
| | „Weiß ich nicht"-Quote pro Intake | < 15 % |
| | Anteil korrigierter KI-Vorschläge | 10–25 % *(darunter: der Kunde prüft nicht; darüber: die Extraktion taugt nicht)* |
| **Reliability** | Import-Erfolgsquote | > 95 % |
| | Edge-Function-Verfügbarkeit im Intake-Pfad | 99,5 % |
| **Guardrail** | Abbruchquote am Konditionen-Schritt | < 10 % |
| | Fragen pro Intake | **Median < 14** |

Die letzte Zahl ist die wichtigste Selbstkontrolle: Der Katalog umfasst 122 Cards, aber **kein Kunde soll je mehr als etwa 14 Fragen sehen**. Steigt der Median, ist die Skip-Logik defekt.

---

# H · Security, Datenschutz, Recht

## H.1 Sofort — das offene Leck

**BEWIESEN, live, ohne Login, mit dem öffentlichen Key aus dem Bundle:**

| Tabelle | Zeilen | Inhalt |
|---|---|---|
| `match_outcomes` | **10.081** | `candidate_id` × `job_id` × `rejection_reason` — **genau die Verknüpfung, die Triple-Blind schützen soll** |
| `outreach_emails` | 11 | Betreff, Body, Prompt, Empfängerrolle |
| `outreach_rate_limits` | 5 | `sender_email`, `target_domain` |
| `outreach_send_queue` | 3 | Versandwarteschlange |
| 9 weitere | offen, leer | füllen sich im Betrieb |

**Ursache:** `CREATE POLICY "System can manage X" ON X FOR ALL USING (true) WITH CHECK (true);` ohne `TO`-Klausel. Gilt für `PUBLIC` inklusive `anon`, und weil permissive Policies mit **ODER** verknüpft werden, hebt diese eine Regel alle korrekten auf.

**Fix:** `DROP POLICY`. Alle Schreiber nutzen `SERVICE_ROLE_KEY` und umgehen RLS ohnehin.

## H.2 Threat Model — die fünf realistischen Angriffe

| # | Angriff | Heute möglich? | Gegenmaßnahme |
|---|---|---|---|
| 1 | Anonymes Auslesen von `match_outcomes` | **ja, bewiesen** | `DROP POLICY` |
| 2 | Anonymes Einstellen in `outreach_send_queue` → Mail-Relay auf verifizierter Domain | abgeleitet; heute latent, weil Queue-Function 404 | **Policies vor jedem Queue-Deploy** |
| 3 | Selbst-Verifizierung per `PATCH client_verifications` | ja, bewiesen | Spalten-Whitelist + Trigger |
| 4 | Selbst-Publish mit eigener Fee | abgeleitet | Statusguard-Trigger |
| 5 | Recruiter liest Matchunt-Marge aus `recruiter_jobs_view` | ja, bewiesen | `fee_percentage` und `embedding` aus der View entfernen |

**Für den geplanten Gast-Draft zusätzlich:** weitergeleiteter Link (Token an erste Session binden), Token-Ablauf, Rate Limit pro IP, doppelte Domains (bestehende Organisation erkennen statt zweite anlegen), und der Transfer selbst muss atomar und serverseitig laufen.

## H.3 Rechtliche Befunde

**Alles hier ist Produktbefund, keine Rechtsberatung. Jeder Punkt braucht anwaltliche Prüfung.**

| # | Befund | Beleg |
|---|---|---|
| 1 | **Recruiter-Rahmenvertrag mit fremder Gesellschaft** — „MatchHub GmbH, Musterstraße 1, 10115 Berlin", Gerichtsstand Berlin, gegen Impressum „Bluewater & Bridge GmbH" | [RecruiterOnboarding.tsx:254,404,294](src/pages/onboarding/RecruiterOnboarding.tsx:254) |
| 2 | **Kandidaten-Einwilligung nicht erfassbar** — die Datenschutzerklärung verspricht Protokollierung, der einzige Pfad läuft in 404; zwei andere Pfade setzen `identity_unlocked` **ohne den Kandidaten** | REST + [Datenschutz.tsx:219-226](src/pages/public/Datenschutz.tsx:219) |
| 3 | **Betroffenenrechte tot** — `gdpr-export` und `gdpr-deletion` 404, Buttons sind live verlinkt | [DataExportRequest.tsx:23](src/components/gdpr/DataExportRequest.tsx:23) |
| 4 | **Vier AGB-Fassungen**, keine Versionierung, akzeptierter Text nicht archiviert | 4 Fundstellen |
| 5 | **Einseitige Honorarfestsetzung** — 20 % zugestimmt, 15–30 % gesetzt; bei 24 % statt 20 % auf 90.000 € sind das 3.600 € ohne Einigung | [JobApprovalDialog.tsx:316](src/components/admin/JobApprovalDialog.tsx:316) |
| 6 | **KI-Verarbeitung nicht gedeckt** — `intake-questions` postet direkt an `openrouter.ai`, die Datenschutzerklärung beschreibt nur das Lovable AI Gateway | [index.ts:190](supabase/functions/intake-questions/index.ts:190) |
| 7 | **EU AI Act** — Matchunt stuft sich selbst als Anbieter eines Hochrisiko-KI-Systems ein; die Anbieterartefakte (Risikomanagement, Protokollierung, menschliche Aufsicht, technische Dokumentation) existieren nicht | ABGELEITET, Aufwand XL |
| 8 | **Falschaussage „vollständig verifiziert"** bei `kyc_status='in_review'` | [ClientOnboarding.tsx:307](src/pages/onboarding/ClientOnboarding.tsx:307) |
| 9 | Rollenverteilung widerspricht sich zwischen `/datenschutz` und `/agb`; weder AVV noch Art.-26-Vereinbarung vorhanden | BEWIESEN |
| 10 | Tracking-Pixel im Outreach ohne Einwilligung, Widerspruch nur als Fließtext | BEWIESEN |

---

# I · Umsetzungsplan

## Ebene 0 · Sofortige Blocker — diese Woche

| # | Paket | Betrifft | Risiko | Aufwand | Akzeptanzkriterium |
|---|---|---|---|---|---|
| 0.1 | **`USING(true)`-Policies entfernen** | 13 Tabellen | niedrig (Service-Role umgeht RLS) | S | anon-Probe liefert `*/0` auf allen betroffenen Tabellen |
| 0.2 | **Meldepflicht nach Art. 33 prüfen lassen** | DSB | — | S | dokumentierte Entscheidung mit Datum |
| 0.3 | **Recruiter-Vertragstext korrigieren** + Altbestand anwaltlich bewerten | RecruiterOnboarding | hoch, wenn nicht | M | ein versionierter Text gegen die echte Gesellschaft |
| 0.4 | **`fee_percentage` + `embedding` aus `recruiter_jobs_view`** | 1 View | niedrig | S | `select=fee_percentage` → 400 |
| 0.5 | **DSGVO-Buttons ausblenden oder Functions deployen** — nicht beides offen lassen | 2 Komponenten | mittel | S | kein toter Betroffenenrechte-Button |

**Reihenfolge zwingend: 0.1 vor jedem Outreach-Deploy.**

## Ebene 1 · Datenwahrheit und Deploy-Disziplin

| # | Paket | Aufwand | Akzeptanzkriterium |
|---|---|---|---|
| 1.1 | **Ursache der selektiven Migrationen klären** | M | reproduzierbarer Deploy-Weg dokumentiert |
| 1.2 | Fehlende Migrationen nachziehen: `job_review_feedback`, `job_close_reason`, `intake_hybrid_foundation` | M | alle referenzierten Spalten → 200 |
| 1.3 | **CI-Gate:** jede per `functions.invoke()` referenzierte Function gegen die deployte Liste prüfen | S | Build bricht bei fehlender Function |
| 1.4 | `parse-job-url` deployen — **repariert Text und Link in einem Schritt** | S | Import erzeugt ein Profil |
| 1.5 | `intake-questions`, `parse-job-pdf`, `validate-invite`, `organization-invite`, `generate-job-summary` deployen | M | je 4xx statt 404 |
| 1.6 | **Statusguard-Trigger** auf `jobs` | M | `PATCH status='published'` als Client → Fehler |
| 1.7 | `client_verifications` Spalten-Whitelist | S | `PATCH kyc_status` als Client → Fehler |

## Ebene 2 · Das Studio stabilisieren — vor dem Livegang

| # | Paket | Aufwand |
|---|---|---|
| 2.1 | **Manueller Ausweg** in der Input-Stufe | S |
| 2.2 | `extendedPersisted` auswerten — der stille Verlust ist bereits gemeldet, nur nirgends gelesen | S |
| 2.3 | Additive Spalte `jobs.draft_state jsonb` + Autosave + Verlassen-Schutz | M |
| 2.4 | `briefing_notes` nur schreiben, wenn nicht leer; `[ABGELEHNT]`-Präfix erhalten | S |
| 2.5 | **Hard-Kill-Felder in echte Spalten**: `required_languages`, `required_certifications`, `onsite_required` | S |
| 2.6 | `industry`, `company_size_band`, `funding_stage`, `tech_environment` persistieren | S |
| 2.7 | **Flexibilität → `job_skill_requirements.weight`**, Coverage-Gate gewichtet | M |
| 2.8 | `min_years`/`proficiency`/`recency` persistieren, `source`+`confidence` ergänzen | M |
| 2.9 | Contracting: Tagessatz in echte Felder | M |
| 2.10 | Bau-Animation an echten Fortschritt binden oder entfernen | S |
| 2.11 | Screenreader, Tastatur, Mobile | L |

## Ebene 3 · Ein kanonischer Flow

3.1 `/dashboard/jobs/new` auf das Studio umleiten · 3.2 die drei verbliebenen Verlinkungen umhängen · 3.3 `CreateJob.tsx` ausbauen (**1695 Zeilen weniger**) · 3.4 gemeinsame Validierung

## Ebene 4 · Unternehmensprofil und Mandantenmodell

4.1 **DB-Trigger legt bei Client-Signup `organizations` + `organization_members` an** · 4.2 Backfill für alle seit dem 10.07. registrierten Kunden · 4.3 `company_profiles.organization_id` · 4.4 Profil aus dem Intake vorbefüllen · 4.5 „X Fragen übersprungen" sichtbar machen

## Ebene 5 · Akquise-Link und Gast-Draft

5.1 `intake_invitations` + `intake_drafts` · 5.2 Route `/start/:token` · 5.3 `platform_events.user_id` nullable · 5.4 Magic-Link-Aktivierung · 5.5 atomarer Draft-Transfer · 5.6 Link in die Outreach-Mails

## Ebene 6 · Konditionen und Vertragslogik

6.1 Status `pending_client_terms` · 6.2 protokollierte Fee-Annahme · 6.3 eine versionierte AGB-Quelle mit Snapshot · 6.4 Vertrag als PDF · 6.5 Preis auf die Landingpage

## Ebene 7 · Analytics

7.1 Event-Schema implementieren · 7.2 Instrument anschließen · 7.3 Baseline messen · 7.4 **erst danach** Experimente

## Ebene 8 · Differenzierung

8.1 Reichweiten-Schätzung live · 8.2 ATS-Import · 8.3 Sprach-Intake · 8.4 EU-AI-Act-Artefakte

---

# J · Entscheidungslog

## J.1 Entschiedene Konflikte

| # | Konflikt | Entscheidung | Begründung |
|---|---|---|---|
| 1 | `WITH CHECK`-Subquery vs. Trigger | **Trigger** | Subquery legt jedes UPDATE lahm (Namensverdeckung + Rekursion) |
| 2 | `draft_state` in `briefing_notes` vs. neue Spalte | **neue Spalte** | `briefing_notes` trägt bereits drei Bedeutungen und wird bedingungslos überschrieben |
| 3 | `filled` streichen vs. einführen | **einführen** | Streichen bräche `jobCockpit.ts:15,58` und `ClientJobDetail.tsx:599` |
| 4 | Alles deployen vs. Minimalpfad | **Minimalpfad**, `parse-job-url` zuerst | repariert zwei von drei Importwegen |
| 5 | Migration abwarten vs. Frontend-Fix | **beides, in dieser Reihenfolge**: `extendedPersisted` sofort auswerten, Migration nachziehen | der Verlust ist heute schon gemeldet, nur ungelesen |
| 6 | Statisches Briefing als Fallback | **verworfen** — es ist selbst nicht ausgeliefert | Inventar-Agent, BEWIESEN |

## J.2 Die sechs Grundsatzentscheidungen — beantwortet

### 1 · Domain: `matchunt.ai` bleibt kanonisch

Die Marke ist bereits ausgeliefert — das Logo im Produkt trägt „Matchunt.ai", Produktion läuft dort. `matchunt.de` hat null DNS-Einträge, also auch null SEO-Substanz, die ein Wechsel retten würde. Ein Domainwechsel jetzt kostet Markenkonsistenz und bringt nichts zurück.

**Aber drei Dinge müssen mit:**

- **`matchunt.de` per 301 auf `.ai`**, dauerhaft gehalten. Deutsche Einkäufer tippen `.de`, und eine unbenutzte Domain ohne Records ist ein Übernahmerisiko, sobald sie ausläuft. Dasselbe für `matchunt.com`.
- **Die vier toten Akademie-Links korrigieren** ([AcademyLayout.tsx:25,47-49](src/academy/components/AcademyLayout.tsx:25)) — sie zeigen heute auf ein Ziel ohne A-Record.
- **Kaltakquise niemals von der Hauptdomain versenden.** Eine eigene Sendedomain (z. B. `mail.matchunt.ai`) mit eigenem SPF, DKIM und DMARC. Grund: Wenn die Outreach-Reputation leidet, dürfen davon nicht die transaktionalen Mails betroffen sein — Interview-Einladungen, Opt-In-Anfragen, Passwort-Reset. **Der Zeitpunkt ist ideal, weil noch nie eine Outreach-Mail versendet wurde: Die Domain-Reputation ist unbelastet.**

Der Akquise-Link läuft als `matchunt.ai/start/<token>` — auf der kanonischen Domain, kein URL-Shortener. Shortener kosten in DACH-Firmenfiltern Zustellbarkeit und Vertrauen.

### 2 · Fee: bestätigen, nicht verhandeln — aber die Regel vorher veröffentlichen

Ein Verhandlungsschritt im Produkt erzeugt unbegrenzte Vertriebsarbeit und zerstört die Preisintegrität des Marktplatzes. Ein reines Friss-oder-stirb am Ende ist der Conversion-Killer, den ihr heute habt. Der State of the Art liegt dazwischen:

1. **Die Regel wird veröffentlicht, bevor der Kunde Arbeit investiert** — Standardsatz plus die Staffelung, nach der er sich ändert (Gehaltsband, Volumen, Exklusivität). Auf der Landingpage, nicht im Onboarding.
2. **Der Admin darf sich nur innerhalb der veröffentlichten Regel bewegen.** Heute ist es ein freier Slider von 15 bis 30 % ([JobApprovalDialog.tsx:319](src/components/admin/JobApprovalDialog.tsx:319)).
3. **`pending_client_terms` ist ein Ja/Nein-Gate**, kein Verhandlungsschritt: Prozentsatz, Bemessungsgrundlage, Fälligkeit, Rückerstattungsregel — ein protokollierter Klick.
4. **Abweichungen sind Sonderkonditionen außerhalb des Produkts**, gegengezeichnet, nicht per Slider.

### 3 · EU AI Act: Die Frage ist bereits beantwortet — von euch selbst, öffentlich

[Datenschutz.tsx:314-317](src/pages/public/Datenschutz.tsx:314) sagt es wörtlich: Bluewater & Bridge GmbH ist **Anbieterin** (Art. 3 Nr. 3), Recruiter und Kundenunternehmen sind **Betreiber** (Art. 3 Nr. 4, Art. 26), Einordnung nach **Anhang III Nr. 4 lit. a und b**.

Das ist rechtlich richtig — ihr entwickelt das Matching selbst und bringt es unter eigenem Namen in Verkehr. Die eigentliche Frage ist also nicht die Rolle, sondern die **Lücke zwischen dem veröffentlichten Anspruch und dem Zustand**.

Ihr habt in Ziffer 12a Abs. 2 konkrete Governance-Maßnahmen zugesagt: Versionierung der Modelle und Vorgaben, Protokollierung der Bewertungserstellung, evidenzbasierte Bewertungsvorgaben. **Das ist eine Selbstbindung.** Eine Aufsichtsbehörde würde genau daran messen — und Teile davon existieren tatsächlich (`prompt_version` in `candidate_fit_assessments`, `match_version` in `match_outcomes`), andere nicht.

**Die Fristenlage:** Nach der Verordnung in der verabschiedeten Fassung gelten die Anbieterpflichten für Anhang-III-Hochrisikosysteme **seit dem 2. August 2026**. Es gab politische Diskussionen über eine Verschiebung von Teilen der Verordnung; **den aktuellen Stand muss euer Anwalt bestätigen** — ich kann das nicht.

**Das größte konkrete Produktproblem ist nicht die Dokumentation, sondern eine Funktion:** Die Policy `hidden` blendet heute 76 von 80 Paaren aus der menschlichen Sicht aus. Das ist automatisiertes Filtern von Bewerbungen im Sinne von Anhang III Nr. 4 lit. b — und Art. 14 verlangt, dass die menschliche Aufsicht eingreifen kann. **Heute kann sie das nicht: Sie sieht die ausgeblendeten Kandidaten gar nicht.**

Minimalpaket, in dieser Reihenfolge:

| # | Maßnahme | Warum zuerst |
|---|---|---|
| 1 | **Übersteuerungs-Sicht**: „auch ausgeschlossene Kandidaten anzeigen" mit Ausschlussgrund | schließt die Art.-14-Lücke, ist ein UI-Fix und behebt gleichzeitig P0-5 des Matchings |
| 2 | Vollständige, manipulationssichere Protokollierung | `match_outcomes` ist die Grundlage — sie ist nur gerade anonym lesbar |
| 3 | Durchgängige Modell- und Prompt-Versionierung | teilweise vorhanden, nicht flächendeckend |
| 4 | Technische Dokumentation nach Anhang IV | |
| 5 | Bias-Testprotokoll | `audit/04-ai-matching.md` ist der Anfang |
| 6 | Betreiber-Instruktionen für Kunden (Art. 13) | |
| 7 | Auskunftsprozess nach Art. 86 | |

**Und ein Perspektivwechsel:** Punkt 6 ist kein Kostenblock, sondern ein Verkaufsargument. Die Betreiberpflichten aus Art. 26 treffen euren Kunden. Wenn ihr sie ihm abnehmt, ist das im DACH-Enterprise-Einkauf ein Differenzierungsmerkmal — dort sitzen Betriebsräte und Compliance-Abteilungen, die genau danach fragen werden.

### 4 · Gast-Draft: 14 Tage Token, 30 Tage Draft, nie Kandidatendaten

| Frage | Antwort |
|---|---|
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b für die Person, die selbst tippt (vorvertragliche Maßnahme auf ihre Anfrage). Die vorangereicherten Firmendaten aus dem Outreach laufen über lit. f. Für die Ansprache selbst gilt zusätzlich § 7 Abs. 2 Nr. 2 UWG — B2B-Werbemail braucht mutmaßliche Einwilligung, das ist ein enger Rahmen. |
| **Token-Gültigkeit** | **14 Tage**, an die erste Session gebunden. Ein weitergeleiteter Link erzeugt einen neuen Token, statt Zugriff zu gewähren. |
| **Draft-Aufbewahrung** | **30 Tage ab letzter Aktivität**, dann harte Löschung. Eine Erinnerung an Tag 7 mit Ein-Klick-Abmeldung. |
| **Bei Aktivierung** | Draft wird atomar auf den neuen Nutzer übertragen, danach gilt die normale Aufbewahrung der Kundenbeziehung. |
| **Protokoll** | erstellt / geöffnet / konvertiert. IP nur gehasht; roh maximal 7 Tage. |
| **Harte Regel** | **Niemals Kandidatendaten in einem Gast-Draft.** Nur Job- und Firmendaten. Das hält die Risikoklasse niedrig und macht den ganzen Mechanismus datenschutzrechtlich beherrschbar. |

Die Sessionbindung ist kein Detail: Ein Gast-Draft enthält Gehaltsbänder, interne Probleme und gescheiterte Suchversuche. Das ist Firmengeheimnis. Ein bloß unrat-barer Link reicht dafür nicht.

### 5 · `fee_percentage`: Die eigentliche Entscheidung liegt eine Ebene tiefer

**Variable Marge und Transparenz sind unvereinbar.** Heute habt ihr das Schlechteste aus beidem: Der Admin setzt Kunden- und Recruiter-Satz frei ([Defaults 20 % / 15 %](src/components/admin/JobApprovalDialog.tsx:76)), und beide Zahlen stehen unmaskiert nebeneinander in `recruiter_jobs_view`. Jeder Recruiter kann eure Marge pro Stelle berechnen und über alle Jobs aggregieren.

Es gibt zwei saubere Auflösungen:

- **(A) Feste Take Rate, veröffentlicht.** „Matchunt behält 5 Prozentpunkte." Dann ist `fee_percentage` ohnehin ableitbar, die Sichtbarkeit ist egal, und der Marktplatz wird berechenbar. Recruiter vertrauen einer Plattform, deren Take Rate sie kennen — undurchsichtige Margen sind der Hauptgrund, warum Recruiter Marktplätze umgehen.
- **(B) Variable Marge.** Dann muss `fee_percentage` sofort aus der View, und die Marge bleibt Geschäftsgeheimnis.

**Meine Empfehlung ist (A)** — feste Take Rate als Plattformkonstante, veröffentlicht. Sie beseitigt gleichzeitig die einseitige Honorarfestsetzung aus Frage 2 und macht die Recruiter-Fee zu einem Versprechen statt zu einer Admin-Laune.

**Unabhängig von der Entscheidung, sofort:**
- Dem Recruiter den **Betrag in Euro** zeigen, nicht den Prozentsatz. Das ist die Zahl, nach der er entscheidet.
- **`embedding` aus der View entfernen** — kein Frontend-Pfad liest ihn, das Matching läuft serverseitig.

### 6 · `kyc_status = 'verified'`: KYB mit Kriterienkatalog, überwiegend automatisch

Es geht um **Know Your Business**, nicht Know Your Customer. Der Katalog:

| Kriterium | Nachweis | Automatisierbar |
|---|---|---|
| Gesellschaft existiert und der Unterzeichner ist vertretungsberechtigt | Handelsregisterauszug o. Ä., nicht älter als 3 Monate | über Anbieter |
| USt-IdNr. gültig | **VIES-Abfrage** | ✅ sofort, vollautomatisch |
| E-Mail-Domain = Firmendomain | Abgleich; Ausnahme dokumentationspflichtig | ✅ |
| Keine Sanktionslistentreffer | EU-Konsolidierte Liste | ✅ |
| Abweichung von einem der obigen Punkte | **Vier-Augen-Prinzip**, dokumentierte Begründung | nein |

**Protokolliert wird: wer, wann, auf welcher Grundlage, mit Dokumentreferenz.** Heute ist es ein Klick ohne Kriterium und ohne Spur ([AdminClients.tsx:149](src/pages/admin/AdminClients.tsx:149)).

Ziel: über 80 % ohne menschliches Zutun, der Admin nur für Ausnahmen. Und: **`verified` blockiert die Jobaufnahme nicht** — es blockiert Rechnungsstellung und Auszahlung. Das entkoppelt die Prüfung vom Conversion-Pfad, ohne das Missbrauchsrisiko zu erhöhen.

Voraussetzung für alles: Die Statusfelder dürfen nicht mehr selbst-schreibbar sein (P0, Ebene 1.7).

---

# K · Qualitäts-Gates

Bewertung des **Zielentwurfs** aus Abschnitt E gegen die geforderten Gates:

| Gate | Ziel-Flow | Heute |
|---|---|---|
| Erster produktiver Schritt in ≤ 15 s | ✅ | ❌ ~90–150 s |
| Sichtbarer Nutzen vor Registrierung | ✅ | ❌ Vertrag in Minute 2 |
| Bekanntes wird nachweislich nicht erneut gefragt | ✅ | ❌ Firmenprofil strukturell leer |
| Antworten überstehen Abbruch, Reload, Gerätewechsel | ✅ | ❌ Totalverlust |
| Jede Antwort hat Feld und Quelle | ✅ | ❌ 58 von 114 verlieren ihr Ziel |
| Unrealistische Parameter erkannt, ohne zu bevormunden | ✅ | ❌ Flexibilität erreicht kein Scoring |
| Erweiterbar für IT/Finance/Leadership/Contracting | ✅ | ❌ Contracting verliert die Vergütung |
| Bestehende Orgs, doppelte Domains, weitergeleitete Links sicher | ✅ | ❌ keine Org wird je angelegt |
| Klar, wann Draft / übermittelt / freigegeben / veröffentlicht | ✅ | ❌ `filled` heimatlos, `paused` doppelt, Freigabe umgehbar |
| Gebühren, Vertrag, KI transparent und nachweisbar | ✅ | ❌ vier AGB, einseitige Fee, KI nicht gedeckt |
| Conversion und Datenqualität objektiv messbar | ✅ | ❌ kein Instrument, `platform_events` blockiert |
| Happy und Failure Paths automatisiert testbar | ✅ | ❌ kein Playwright, keine Frontend-Tests |

**Zwölf von zwölf Gates sind heute nicht erfüllt. Der Zielentwurf erfüllt sie — unter der Voraussetzung, dass Ebene 0 bis 2 vorher abgearbeitet sind.**

---

## Anhang · Korrekturen an der Vorabanalyse

Die Agenten waren beauftragt, den vorgegebenen Kontext zu widerlegen. Sie haben ihn an **32 Stellen** korrigiert. Die zehn folgenreichsten:

1. **Migrationen sind selektiv angewandt**, nicht hinterherhinkend. `20260710130000` ist drin, die ältere `20260710120000` nicht.
2. **Das statische Briefing ist ebenfalls nicht ausgeliefert.** Kein Kunde hat je eine Briefing-Frage gesehen.
3. **Es gibt keinen Codepfad, der eine Organisation anlegt.**
4. **Nicht 6, sondern mindestens 20 Edge Functions sind nicht deployed** — darunter `gdpr-export`, `gdpr-deletion`, `process-interview-response`, `validate-invite`, `organization-invite`, `generate-job-summary` und 7 Outreach-Functions.
5. **Das Studio hat drei Einstiegspunkte**, nicht einen — einer davon überschreibt echte Jobs.
6. **Text und Link teilen sich eine Function.** Ein Deploy repariert zwei Wege.
7. **Der Client-Team-Stand im Projektgedächtnis war falsch** — die Migration ist längst live.
8. **Die Statusmaschine kennt `filled`**, die Datenbank nicht.
9. **Der stille Speicherverlust ist bereits gemeldet** (`extendedPersisted`), nur nirgends ausgewertet.
10. **`fee_percentage` steht unmaskiert in `recruiter_jobs_view`** — fand nur das Red Team.

Zusätzlich hat das Red Team **zwei P0-Empfehlungen anderer Agenten verworfen**, deren Umsetzung die Produktion beschädigt hätte, und vier Befunde gefunden, die keinem Fachagenten aufgefallen sind.
