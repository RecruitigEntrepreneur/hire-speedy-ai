# Kundenseitiger Einstieg über Jobaufnahme-Links

Stand: 2026-08-31 · Gebaut, typgeprüft, getestet. **Noch nicht deployt** — die
Migrationen und Edge Functions müssen einzeln angestoßen werden, siehe
[Was noch fehlt](#was-noch-fehlt).

---

## Der Ablauf

**Kunde** (ohne Login, `matchunt.ai/start/<token>`)

Position aufnehmen (KI, Autosave) → Kontakt- und Firmendaten → Geschäfts-E-Mail per
sechsstelligem Code bestätigen → Konditionen und AGB prüfen → Beauftragungsanfrage
absenden.
Jederzeit möglich: *Konditionen besprechen*, *an Entscheider weiterleiten*, *später
fortsetzen*.

**Matchunt** (`/admin/intakes`)

Aufnahme prüfen → Auftrag annehmen (Kundenkonto, Organisation und Stelle entstehen) →
Vertragsdokument aus dem bestätigten Snapshot erzeugen → manuell über DocuSign versenden
→ „versendet" vermerken → Unterschrift vermerken → **erst dann** ist die Stelle
freigebbar.

Die Freigabe erzwingt die **Datenbank**, nicht der Dialog: ein Trigger auf `jobs` lässt
`status = 'published'` für eine Stelle aus einer Beauftragungsanfrage nur zu, wenn die
Vermittlungsvereinbarung angenommen und unterzeichnet ist. Auch für Admins.

---

## Die drei Linktypen

| Typ | Wofür | Besonderheit |
|---|---|---|
| `personal` | bekanntes Unternehmen / Ansprechpartner | Vorbelegung (Firma, Branche, Region, Kontakt, Aufhänger), fester Betreuer, eigene Konditionsvorlage, optionaler Direktversand per Mail |
| `campaign` | LinkedIn, Outbound, Partner | `campaign_key` + `source` für die Auswertung, kein Personenbezug |
| `public` | Website, organisch | keine Vorbelegung; private E-Mail-Adressen werden abgelehnt (pro Link übersteuerbar) |

Alle drei sind mehrfach zu öffnen. Jeder Aufruf erzeugt einen **eigenen Entwurf mit
eigenem Zugangstoken**. Die Sessionbindung aus `ONBOARDING_INTAKE_MASTERANALYSE.md` J.2.4
sitzt damit am Entwurf statt am Link — der Link trägt nur Vorbelegung, der Entwurf trägt
Gehaltsbänder und gescheiterte Suchversuche. So kann derselbe Ansprechpartner eine zweite
Stelle aufnehmen, ohne dass ein weitergereichter Link je fremde Entwürfe öffnet.

---

## Was wiederverwendet wurde

Der Gast benutzt **denselben** Aufnahmedialog wie das Dashboard — nicht eine Kopie:

| Baustein | Wie |
|---|---|
| `intake/ProfileSections`, `intake/QualityCheck`, `intake/types`, `IntakeBriefing` (36-Fragen-Katalog) | unverändert eingebunden; sie greifen weder auf `useAuth` noch auf Supabase zu |
| `intake/DynamicBriefing` | eine neue optionale Prop `askAi`. Ohne sie läuft der Dashboard-Weg wie bisher; der Gast reicht den token-geprüften Proxy herein |
| `intake-questions` | **unverändert**, bleibt `verify_jwt = true` und bleibt stateless. Der Gast erreicht sie nur über `intake-ai` |
| `JobApprovalDialog` | unverändert im Ablauf; ergänzt um Vertragsblock und Freigabesperre |
| Token-Muster aus `organization-invite` / `validate-invite` | 32 Byte CSPRNG → base64url, nur SHA-256 in die DB, vier getrennte Absagegründe |
| `consents`, `email_events`, `notifications`, `activity_logs`, `organizations` | bestehende Tabellen, keine Parallelstrukturen |

Herausgezogen statt dupliziert: `src/lib/intakeMapping.ts` enthält jetzt die reinen
Abbildungen (`fromParsedJobData`, `toBriefBuilt`, `buildAiJobDraft`, `buildIntakePayload`)
— `JobIntakeStudio` importiert sie von dort. Das serverseitige Gegenstück liegt in
`supabase/functions/_shared/intake-mapping.ts` (Deno kann nicht aus `src/` importieren);
beide werden von `src/lib/intakeMapping.test.ts` gemeinsam geprüft.

---

## Was neu ist

### Migrationen (6, idempotent, Reihenfolge zwingend)

| Datei | Inhalt |
|---|---|
| `20260901100000_intake_links_foundation.sql` | `intake_links`, `intake_link_events` |
| `20260901100100_intake_drafts.sql` | `intake_drafts`, `intake_draft_tokens`, `intake_email_verifications`, `intake_rate_limits` + Zähl- und Aufräumfunktionen |
| `20260901100200_commercial_terms_and_mandates.sql` | `commercial_terms_templates`, `commercial_mandates`, Unveränderlichkeits-Trigger, Bandbreiten-Trigger, Seed |
| `20260901100300_jobs_intake_bridge_and_guard.sql` | Brückenspalten auf `jobs`, `jobs_status_check`, Statusguard + Freigabe-Gate, Contracting-Spalten (idempotent nachgeholt) |
| `20260901100400_accept_intake_and_funnel.sql` | `accept_intake_draft()`, `organizations.primary_domain`, View `intake_link_funnel` |
| `20260901100500_mandate_documents_bucket.sql` | privater Bucket `mandate-documents` |

### Edge Functions

**Gast (`verify_jwt = false`, jeweils mit Tokenprüfung und Rate-Limit):**
`intake-start`, `intake-draft`, `intake-ai`, `intake-verify-email`, `intake-terms`,
`intake-submit`, `intake-forward`, `intake-resume`

**Admin (`verify_jwt = true` **und** serverseitige `has_role`-Prüfung):**
`intake-link-admin`, `intake-admin`, `generate-mandate-pdf`

**Geändert:** `parse-job-url` — SSRF-Härtung (Schema-Whitelist, Denylist für private und
Link-Local-Bereiche, Timeout). Sie war über den Proxy mittelbar aus dem offenen Netz
erreichbar und fetchte die Body-URL bis dahin ungeprüft.

**Geteilt, neu:** `_shared/http.ts` (CORS, Antwortgründe), `tokens.ts` (CSPRNG, gepfefferte
Hashes, zeitkonstanter Vergleich), `domain.ts`, `intake-limits.ts`, `app-url.ts`,
`intake-mail.ts`, `intake-core.ts`, `intake-mapping.ts`, `admin-auth.ts`.

### Frontend

`/start/:token`, `/aufnahme/:draftToken`, `/passwort` · Admin: `/admin/intakes`,
`/admin/intakes/:id`, `/admin/intake-links`.

Die Gastseite bekommt in `main.tsx` ein **eigenes Bundle** (56 kB statt 2 MB): sie wird
kalt aus einer Mail geöffnet, oft mobil, und hat mit Dashboard, Admin und Academy nichts
zu tun.

---

## Getroffene Entscheidungen

**Der Klick des Kunden ist sein Angebot, nicht der Vertragsschluss.** Die dargestellten
Konditionen sind freibleibend; Matchunt nimmt gesondert an. Andernfalls wäre Matchunt an
jeden gebunden, der das Formular ausfüllt. Der Kunde bekommt sofort eine
Eingangsbestätigung, die das ausdrücklich sagt.

**Gast-Aufnahmen leben in `intake_drafts`, nie in `jobs`.** `jobs.client_id` ist
`NOT NULL REFERENCES auth.users` — ein Job kann vor dem Konto nicht existieren.
`client_id` nullable zu machen hätte `can_access_job`/`can_edit_job` gebrochen. Zusätzlich
war gefordert, dass unvollständige Vorgänge die Prüfliste nicht überladen.

**Fünf getrennte Zustandsachsen** (Aufnahme / Identität / kommerziell / Prüfung /
Veröffentlichung) statt einer Sammelspalte. Nur so ist „im Approval sichtbar, auch bei
offener Konditionsklärung" ohne Widerspruch abbildbar.

**Eine aktive Konditionsvorlage mit Bandbreite** (Ihre Entscheidung). Der Trigger
`intake_links_check_fee_band` lässt Abweichungen nur innerhalb der veröffentlichten
Bandbreite zu. Der bisherige Gebühren-Tab in `AdminSettings` war eine Attrappe — er lud
nichts, speicherte nichts, und `JobApprovalDialog` nahm seine Werte aus hartkodierten
Konstanten. Beides ist ersetzt.

**Freemail wird am öffentlichen Link abgelehnt** (Ihre Entscheidung), an persönlichen und
Kampagnenlinks zugelassen und markiert. Pro Link übersteuerbar. Durchgesetzt im Formular
*und* in `intake-verify-email`.

**Keine automatischen Rechte per Domain.** Eine Übereinstimmung wird als Hinweis in
`intake_drafts.matched_*` vermerkt und dem Admin angezeigt. Das Verknüpfen mit einer
bestehenden Organisation ist eine ausdrückliche Admin-Handlung — sonst bekäme jeder mit
einer Adresse auf `acme.de` über `can_access_job()` Lesezugriff auf alle Stellen dieser
Organisation.

**Freigabe-Gate ohne Signatur-Zwang für Bestandsjobs.** Der Trigger greift nur, wenn
`mandate_id` oder `intake_draft_id` gesetzt ist. Stellen aus dem Dashboard laufen
unverändert.

**Bei Frage 2 („Freigabe-Gate") ohne Ihre Präferenz** habe ich die Empfehlung gebaut:
verifizierte Geschäfts-E-Mail + protokollierte AGB-Zustimmung + angenommene Konditionen +
unterzeichneter Vertrag. Vertragspflicht und KYB sind **Flags an der Konditionsvorlage**
(`requires_signature`, `requires_kyb`) — eine Verschärfung ist eine Konfigurationsänderung,
kein Release.

---

## Nebenbefunde, die mitrepariert wurden

Alle drei standen dem Vorhaben direkt im Weg:

1. **Der Kunde konnte seine eigene Fee setzen.** `FOR UPDATE USING can_edit_job(id)` ohne
   Spaltenbeschränkung, kein Trigger, und Postgres-RLS kennt keine Spaltenrechte. Ein PATCH
   auf `fee_percentage` oder `status='published'` ging durch. Der neue Statusguard schreibt
   `client_id`, `organization_id` (nur wenn schon gesetzt), beide Fee-Spalten, `approved_by`
   und `approved_at` für Nicht-Admins auf den alten Wert zurück.
2. **`AdminJobs` kannte `pending_client_approval` und `filled` nicht** und zeigte sie stumm
   als „Entwurf" — solche Jobs tauchten in keiner Liste auf. Ergänzt.
   Der Inline-Status-Select bot außerdem „Veröffentlichen" an und umging damit den
   Freigabe-Dialog (ohne Fee, `approved_by`, `formatted_content` und Kundenbenachrichtigung).
   Entfernt.
3. **Es gab keinen Passwort-Weg im Projekt** — kein `resetPasswordForEmail`, kein
   `signInWithOtp`, keine „Passwort vergessen"-Strecke. Ein bei der Annahme angelegtes
   Kundenkonto hätte keinen Weg ins Dashboard gehabt. Neu: `/passwort` plus ein
   Zugangslink in der Annahme-Mail.

---

## Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 0 Fehler |
| `npx vitest run` | 66 Tests grün (27 bestehende + 39 neue) |
| `npm run build` | grün; Gastseite als eigenes 56-kB-Bundle |
| SQL-Syntax, echter Postgres-Parser (`pglast`) | alle 6 Migrationen + pgTAP-Datei parsen; alle 9 plpgsql-Rümpfe separat geprüft |
| Edge-Function-Syntax (esbuild) | 22 Dateien fehlerfrei |
| Kundenflow im Browser | alle fünf Schritte durchgespielt, Desktop und Mobil (375 px, kein horizontaler Überlauf) |
| `supabase/tests/002_intake_link_permissions_test.sql` | 24 pgTAP-Prüfungen — **noch nicht ausgeführt**, braucht Docker |

Sieben Fehler wurden bei der Selbstprüfung gefunden und behoben, darunter: eine
CHECK-Constraint, die dem Kunden nach einer Rückfrage die Korrektur seiner E-Mail-Adresse
verboten hätte; ein Guard, der den bestehenden Org-Backfill-Trigger ausgehebelt hätte; eine
Funnel-Abfrage, die aus der Service-Role-Function immer leer geblieben wäre; und
Eingabefelder im Kontaktschritt, die bei jedem Tastenanschlag auf den vorigen Wert
zurücksprangen.

---

## Was noch fehlt

### Deploy (nichts davon läuft automatisch)

1. **Migrationen anstoßen** — `LOVABLE_DB_PROMPTS.md`, Prompt 8. Migrationsdateien aus Git
   werden bei Lovable nie automatisch angewandt.
2. **Secrets setzen**: `INTAKE_TOKEN_PEPPER` (ohne ihn wären sechsstellige Codes aus einem
   DB-Dump per Rainbow-Table auflösbar), `RESEND_FROM`, `APP_URL`,
   `MANDATE_VENDOR_NAME`/`-_ADDRESS`/`-_REGISTER`.
3. **Redirect-URL** `https://matchunt.ai/passwort` in Supabase → Authentication → URL
   Configuration eintragen.
4. **Edge Functions deployen** (11 neue + `parse-job-url`). Ohne sie meldet der Link
   ehrlich „noch nicht freigeschaltet" statt still zu scheitern — das ist geprüft.
5. **`supabase test db`** einmal laufen lassen.

### Vor dem ersten echten Link — nicht von mir entscheidbar

| Punkt | Warum |
|---|---|
| **Vertragspartner festlegen** | Die AGB nennen die Bluewater & Bridge GmbH, `RecruiterOnboarding.tsx:254` eine „MatchHub GmbH". Auf der Vermittlungsvereinbarung darf nur eine Firmierung stehen — sie kommt aus `MANDATE_VENDOR_NAME`. |
| **Formfreiheit im Contracting-Zweig** | Bei Festanstellung ist die Sache klar. Bei Freelance ist die Abgrenzung Vermittlung ↔ Arbeitnehmerüberlassung der Risikopunkt: greift das AÜG, gilt Schriftform (§ 12 AÜG) und der DocuSign-Lauf muss das abbilden. |
| **Datenschutzerklärung ergänzen** | `intake-questions` postet an `openrouter.ai` (Drittland); die Erklärung beschreibt nur das Lovable-Gateway. Beim Gast-Draft kommt der Transfer zu Daten hinzu, für die noch keine Kundenbeziehung besteht. |
| **Eigene Sendedomain für Kaltakquise** | Gelockt in der Masteranalyse: `mail.matchunt.ai` mit eigenem SPF/DKIM/DMARC, damit die unbelastete Hauptdomain nicht verbrannt wird. |
| **Prompt 5 (RLS-Härtung) anwenden** | Trägt keinen Erledigt-Marker. Solange die offenen `USING(true)`-Policies leben, sind `match_outcomes`, `outreach_emails` und `outreach_send_queue` mit dem anon-Key erreichbar. Ein Feature, das Links per Mail verteilt, sollte nicht davor live gehen. |
| **Öffentlichen Link auf der Landingpage verdrahten** | Die elf Unternehmens-CTAs zeigen auf `/auth?mode=signup&role=client`, versprechen aber „Job in 60 Sekunden posten". Sobald der öffentliche Link angelegt ist, gehört seine URL in `HeroSection.tsx:47` und `FinalCTASection.tsx:42`. Ein Token lässt sich nicht vorab in den Code schreiben. |

### Bewusst nicht gebaut

- **DocuSign-API-Anbindung.** Auf Ihren Wunsch manuell. Die Zustände (`pending` → `sent` →
  `signed`) sind so gewählt, dass ein späterer Connect-Webhook sie unverändert setzt — die
  Ablösung ist ein Austausch, kein Umbau.
- **`enrich-company-from-domain` im Gast-Pfad.** Ein Aufruf löst bis zu drei Firecrawl-Calls
  plus einen LLM-Call aus. Am öffentlichen Link wäre das eine Kostenbombe.
- **Automatisches Aufräumen der Entwürfe.** `intake_drafts_purge_expired()` existiert und
  ist getestet, braucht aber einen `pg_cron`-Job oder einen Admin-Knopf. Bis dahin läuft die
  30-Tage-Löschung nicht von selbst.
- **`recruiter_jobs_view` gibt weiterhin beide Fee-Spalten ungated an jeden Recruiter.**
  Bekannter Bestandsbefund (Ebene 0.4), hier bewusst nicht angefasst — er wiegt jetzt
  allerdings schwerer, weil die Kondition kundenseitig bestätigt und damit bindend ist.
