# Lovable-Prompts für die DB-Änderungen (Welle 1)

**Reihenfolge einhalten.** Prompt 1 ist additiv und sofort gefahrlos. Prompt 2 nimmt
Zugriff weg und darf erst laufen, wenn das umgestellte Frontend live ist.

    Prompt 1  →  Frontend-Release  →  Prompt 2

Beide SQL-Blöcke sind idempotent (`DROP ... IF EXISTS`), können also gefahrlos
mehrfach laufen. Falls Lovable eine eigene Migrationsdatei mit eigenem Zeitstempel
anlegt: unschädlich, unsere Dateien im Repo laufen dann höchstens ein zweites Mal
ohne Effekt.

---

## Prompt 1 — jetzt (additiv, nimmt niemandem Zugriff weg)

> Bitte führe diese Migration auf Supabase aus. Sie ersetzt die bestehende View
> `public.recruiter_jobs_view` durch eine vollständige, gehärtete Fassung.
> Ändere sonst nichts am Code.
>
> ```sql
> DROP VIEW IF EXISTS public.recruiter_jobs_view;
>
> CREATE VIEW public.recruiter_jobs_view AS
> SELECT
>   j.id, j.title, j.status, j.industry, j.location,
>   j.remote_type, j.employment_type, j.experience_level,
>   j.salary_min, j.salary_max, j.fee_percentage, j.recruiter_fee_percentage,
>   j.skills, j.must_haves, j.nice_to_haves, j.screening_questions,
>   j.company_size_band, j.funding_stage, j.hiring_urgency, j.urgency,
>   j.tech_environment, j.required_languages, j.required_certifications,
>   j.onsite_required, j.onsite_days_required, j.remote_policy,
>   j.benefits, j.deadline, j.created_at, j.updated_at,
>   j.formatted_content, j.job_summary,
>   j.embedding,
>   CASE WHEN rev.revealed THEN j.company_name    ELSE NULL END AS company_name,
>   CASE WHEN rev.revealed THEN j.company_culture ELSE NULL END AS company_culture,
>   CASE WHEN rev.revealed THEN j.description     ELSE NULL END AS description,
>   CASE WHEN rev.revealed THEN j.requirements    ELSE NULL END AS requirements,
>   COALESCE(rev.revealed, false) AS company_revealed
> FROM jobs j
> LEFT JOIN LATERAL (
>   SELECT true AS revealed
>   FROM submissions s
>   WHERE s.job_id = j.id
>     AND s.recruiter_id = auth.uid()
>     AND s.company_revealed = true
>   LIMIT 1
> ) rev ON true
> WHERE public.has_role(auth.uid(), 'recruiter')
>   AND j.status = 'published';
>
> GRANT SELECT ON public.recruiter_jobs_view TO authenticated;
> ```
>
> Wichtig: Die View muss mit den Rechten des Owners laufen — setze **nicht**
> `security_invoker = true`. Sie erzwingt Rollenprüfung und Maskierung selbst.
> Lege die View nicht als `SECURITY DEFINER function` an, sondern genau so als View.

**Danach prüfen:** Auf `/recruiter/jobs` müssen wieder 20 Jobs erscheinen, und bei
nicht enthüllten Jobs muss die Firma anonymisiert bleiben.

---

## Prompt 2 — erst NACH dem Frontend-Release

> Bitte führe diese Migration auf Supabase aus. Sie entzieht Recruitern den
> direkten Lesezugriff auf `public.jobs`; Recruiter lesen Jobs ab jetzt
> ausschließlich über `public.recruiter_jobs_view`. Ändere sonst nichts am Code.
>
> ```sql
> DROP POLICY IF EXISTS "Recruiters can view published jobs" ON public.jobs;
>
> DO $$
> DECLARE leftover text;
> BEGIN
>   SELECT string_agg(policyname, ', ') INTO leftover
>     FROM pg_policies
>    WHERE schemaname = 'public' AND tablename = 'jobs'
>      AND policyname ILIKE '%recruiter%';
>   IF leftover IS NOT NULL THEN
>     RAISE EXCEPTION 'Es existieren weiterhin Recruiter-Policies auf public.jobs: %', leftover;
>   END IF;
> END $$;
> ```

**Danach prüfen (das ist der eigentliche Beweis):** Als Recruiter eingeloggt in der
Browser-Konsole ausführen —

```js
const { supabase } = await import('/src/integrations/supabase/client.ts');
const { data, error } = await supabase.from('jobs').select('company_name').limit(5);
console.log({ error: error?.message, rows: data?.length });
```

Erwartet: **0 Zeilen** (oder ein Policy-Fehler). Kommen weiterhin Firmennamen
zurück, ist die Policy nicht weg oder es existiert eine zweite.

---

## Prompt 3 — Client-Benachrichtigung bei Opt-In (Welle 1, noch offen)

> Bitte führe die Migration aus Datei
> `supabase/migrations/20260725120200_notify_client_on_opt_in_response.sql`
> auf Supabase aus. Sie legt die Funktion
> `public.notify_client_on_opt_in_response()` und den Trigger
> `trg_notify_client_on_opt_in_response` auf `public.submissions` an.
> Ändere sonst nichts am Code.

**Warum nötig:** Die Benachrichtigung an den Kunden schrieb bisher der
Recruiter-Client selbst und brauchte dafür `jobs.client_id` — genau den
Identitätsvektor, den Welle 1 geschlossen hat. Ohne diesen Trigger bleibt der
Kunde bei einer Opt-In-Antwort unbenachrichtigt.

---

## Prompt 4 — Welle 2: stage wird die Wahrheit

> Bitte führe die Migration aus Datei
> `supabase/migrations/20260725130000_submissions_stage_single_source_of_truth.sql`
> auf Supabase aus. Sie normalisiert `submissions.stage`, ergänzt den CHECK
> `submissions_stage_check`, legt `public.submissions_status_from_stage()` und
> den Trigger `trg_sync_submission_status` an und gleicht den Bestand an.
> Ändere sonst nichts am Code.

**Erwartete sichtbare Wirkung — nicht erschrecken:** Die Migration korrigiert
16 Submissions, deren `stage` noch auf einem aktiven Wert stand, obwohl der
Kunde sie längst abgelehnt hatte (14 davon mit `rejection_reason`). In der
Pipeline wandern diese aus „Eingereicht" nach „Vom Kunden abgelehnt".
„Eingereicht" fällt dadurch von 13 auf etwa 2. **Das ist keine Regression,
sondern die Wahrheit** — vorher hat die Oberfläche 16 abgelehnte Kandidaten als
aktiv ausgewiesen.

**Danach prüfen:** In der Konsole als Recruiter —

```js
const { supabase } = await import('/src/integrations/supabase/client.ts');
const { data } = await supabase.from('submissions').select('stage,status');
const bad = data.filter(d => !d.stage || !d.status);
console.log({ gesamt: data.length, ohneWert: bad.length });
```

Erwartet: kein Datensatz ohne Werte. Die Migration selbst bricht mit einer
Exception ab, falls danach noch ein Widerspruch existiert.

---

## Was Lovable NICHT tun soll

- Keine RLS-Policy auf `jobs` neu anlegen, die Recruitern SELECT gibt — das würde
  das Leck sofort wieder öffnen.
- Die Frontend-Umstellung auf `recruiter_jobs_view` ist bereits im Repo erledigt.
  Lovable soll den Code dafür nicht noch einmal anfassen.
- `submissions.status` nicht mehr direkt beschreiben — der Trigger leitet den
  Wert aus `stage` ab und überschreibt jeden direkten Write.
- Keine eingebetteten `jobs(...)`-Joins in `submissions`-Queries für Recruiter
  wieder einführen. Sie werfen keinen Fehler, sondern liefern still `null` —
  das war die Ursache für leere Job-Titel und „€0"-Kennzahlen.

## Bekannte Restlücke (nicht Teil dieser Migrationen)

In 4 von 20 veröffentlichten Jobs stehen Ortsdetails („Rhein-Main", „Taunus") auch
in der redigierten Fassung `formatted_content`. Der Firmenname selbst steckt in
keiner. Das Bereinigen dieser Texte ist eine eigene Aufgabe (KI-Redaktionslauf).

---

## Prompt 5 — RLS-Härtung (DRINGEND, vor allem anderen)

**Warum zuerst:** Mit dem öffentlichen anon-Key aus dem ausgelieferten Browser-Bundle
sind ohne Login **48 Tabellen** lesbar, davon 9 mit Daten — darunter `match_outcomes`
mit **10.081 Zeilen** (`candidate_id` × `job_id` × `rejection_reason`, also genau die
Verknüpfung, die Triple-Blind schützen soll). Gemessen am 2026-08-29.

**Warum die Migration im Katalog sucht statt Namen aufzuzählen:** Eine Zählung gegen die
laufende Datenbank ergab **83** solcher Policies, während in den Migrationsdateien nur 54
stehen. Der Rest ist außerhalb des Migrationspfads entstanden. Eine namentliche Liste würde
diese übersehen.

> Bitte führe die Migration aus Datei
> `supabase/migrations/20260829110000_rls_close_open_policies.sql`
> auf Supabase aus. Sie durchsucht `pg_policies` nach permissiven Policies für
> PUBLIC/anon, deren `qual` oder `with_check` unbedingt `true` ist, und entfernt
> sie — mit vier namentlichen Ausnahmen für Token-Flows. Drei Nachschlagetabellen
> bekommen stattdessen eine `TO authenticated`-Policy. Am Ende steht eine
> Gegenprobe, die mit einer Exception abbricht, falls etwas übrig bleibt.
> Ändere sonst nichts am Code.

**Danach prüfen** — mit demselben öffentlichen Key, ohne Login:

```bash
curl -sS -I "https://dngycrrhbnwdohbftpzq.supabase.co/rest/v1/match_outcomes?select=id" -H "apikey: $(grep VITE_SUPABASE_PUBLISHABLE_KEY .env | cut -d= -f2-)" -H "Prefer: count=exact" | grep -i content-range
```

Erwartet: `*/0`.

**Bitte die NOTICE-Ausgabe mitschicken.** Der letzte Block meldet Tabellen, die danach gar
keine Policy mehr haben — bei aktivem RLS heißt das „nur noch service_role". Für reine
Systemtabellen ist das richtig; steht dort etwas, das das Frontend liest, fehlt eine Policy
und wir ergänzen sie gezielt.

**Nicht enthalten (bewusst):** die vier Token-Flow-Policies auf `reference_requests`,
`reference_responses`, `organization_invites` und `interview_participants`. Sie erlauben
ebenfalls anonymen Zugriff auf alle Zeilen statt nur auf die zum Token gehörende, tragen
aber öffentliche Seiten. Sie sauber zu machen heißt, den Zugriff in eine Edge Function zu
verlegen — eigene Aufgabe mit eigenem Test.

---

## Prompt 6 — Contracting-Konditionen und Entwurfsstand

**Warum nötig:** Eine Contracting-Stelle geht heute **ohne jede Vergütungsangabe** an die
Recruiter. Das Studio setzt `salary_min/max` bei `freelance` auf NULL und legt Tagessatz,
Laufzeit und Auslastung in `intake_payload.contracting` ab — einer Spalte, die produktiv
fehlt. Dasselbe beim Entwurf: „Später weiter" schreibt den Studio-Zustand nach
`intake_payload.draft_state` und verliert ihn still.

> Bitte führe die Migration aus Datei
> `supabase/migrations/20260829120000_contracting_terms_and_draft_state.sql`
> auf Supabase aus. Sie ergänzt auf `public.jobs` die Spalten `day_rate_min`,
> `day_rate_max`, `contract_duration_months`, `utilization_days_per_week`,
> `extension_possible` und `draft_state`, legt zwei CHECK-Constraints an und
> erneuert `public.recruiter_jobs_view`, damit die Konditionen beim Recruiter
> ankommen. Die View muss weiterhin mit Owner-Rechten laufen — setze **nicht**
> `security_invoker = true`. Ändere sonst nichts am Code.

**Danach prüfen:** `jobs?select=day_rate_min` und `recruiter_jobs_view?select=day_rate_min`
müssen beide antworten; `recruiter_jobs_view?select=draft_state` muss mit 42703 scheitern.

---

## Prompt 7 — Die drei liegengebliebenen Migrationen ✅ ERLEDIGT (2026-08-29)

Diese drei Dateien liegen seit Wochen im Repo und sind nie angewandt worden. Jede
verursacht einen konkreten Defekt:

| Datei | Was heute kaputt ist |
|---|---|
| `20260619120000_intake_hybrid_foundation.sql` | `intake_payload` fehlt → das gesamte Briefing wird beim Speichern verworfen |
| `20260710120000_job_review_feedback.sql` | `rejection_reason` fehlt → der Ablehnungsgrund wird beim Ergänzen gelöscht, und die interne Freigabe ist unerreichbar |
| `20260716120000_job_close_reason.sql` | `closed_reason` fehlt → „über Matchunt besetzt" wird verworfen |

> Bitte führe diese drei Migrationen in genau dieser Reihenfolge auf Supabase aus:
> `20260619120000_intake_hybrid_foundation.sql`,
> `20260710120000_job_review_feedback.sql`,
> `20260716120000_job_close_reason.sql`.
> Alle drei sind additiv. Ändere sonst nichts am Code.

**Wichtig vorher zu klären:** Warum wurden sie übersprungen, während spätere Migrationen
liefen? Solange die Ursache offen ist, wiederholt sich das beim nächsten Deploy.

---

## Prompt 8 — Kundenseitiger Einstieg über Jobaufnahme-Links ✅ 8a + 8b ERLEDIGT (2026-08-31)

**Stand:** Alle sechs Migrationen sind angewandt, alle 13 Edge Functions deployt —
gegen die Produktion verifiziert: die neun neuen Tabellen und Views existieren und
liefern an `anon` durchweg leer; die sieben Brückenspalten auf `jobs` sind vorhanden;
die acht Gast-Endpunkte antworten mit dem Fehlervertrag, die fünf geschützten mit
`401 Missing authorization header`. **Offen: 8c** (Secret + Redirect-URL) und die
Abnahmeprobe.

Das Fundament für die login-freie Jobaufnahme: Links, Gast-Entwürfe, E-Mail-Verifizierung,
Rate-Limit, Konditionsvorlagen, Vermittlungsvereinbarung, der Übergang in `jobs` und der
Statusguard.

Drei Teile, in dieser Reihenfolge: **8a** (Datenbank) → **8b** (Edge Functions) → **8c**
(zwei Handgriffe im Supabase-Dashboard, die Lovable nicht erledigen kann).

Alle sechs Migrationen sind idempotent (`IF NOT EXISTS`, `DROP … IF EXISTS`) und können
gefahrlos mehrfach laufen. Sie sind additiv: keine bestehende Policy und keine bestehende
View wird verändert.

---

### 8a — Migrationen (in Lovable ausführen)

> Bitte führe diese sechs Migrationen aus `supabase/migrations/` in **genau dieser
> Reihenfolge** auf Supabase aus:
>
> 1. `20260901100000_intake_links_foundation.sql`
> 2. `20260901100100_intake_drafts.sql`
> 3. `20260901100200_commercial_terms_and_mandates.sql`
> 4. `20260901100300_jobs_intake_bridge_and_guard.sql`
> 5. `20260901100400_accept_intake_and_funnel.sql`
> 6. `20260901100500_mandate_documents_bucket.sql`
>
> Die Reihenfolge ist zwingend: jede Datei setzt über Fremdschlüssel und
> Funktionsaufrufe auf der vorigen auf.
>
> Alle sechs sind additiv und idempotent. Sie legen neue Tabellen an
> (`intake_links`, `intake_link_events`, `intake_drafts`, `intake_draft_tokens`,
> `intake_email_verifications`, `intake_rate_limits`, `commercial_terms_templates`,
> `commercial_mandates`), ergänzen additive Spalten auf `jobs` und `organizations`,
> legen einen BEFORE-UPDATE-Trigger auf `jobs` an und erzeugen den privaten
> Storage-Bucket `mandate-documents`.
>
> Wichtig: **Ändere sonst nichts am Code.** Insbesondere nicht die bestehenden
> RLS-Policies auf `jobs`, nicht die View `recruiter_jobs_view` und keine
> Frontend-Datei. Die Migrationen enthalten alles Nötige.
>
> Führe danach anschließend `npx supabase gen types typescript` aus bzw. generiere
> `src/integrations/supabase/types.ts` neu, damit die neuen Tabellen in den Typen stehen.

**Danach prüfen** (als angemeldeter Admin in der Browser-Konsole oder über den
SQL-Editor):

```sql
-- 1) Die Tabellen existieren
select count(*) from public.intake_links;          -- 0
select count(*) from public.intake_drafts;         -- 0

-- 2) Genau eine aktive Konditionsregel, aus den heutigen Werten geseedet
select key, version, fee_percentage, recruiter_fee_percentage,
       min_fee_percentage, max_fee_percentage, requires_signature, agb_version
  from public.commercial_terms_templates where is_active;
-- erwartet: standard | 1 | 20.00 | 15.00 | 15.00 | 30.00 | true | 2026-06

-- 3) Die Brückenspalten auf jobs sind da
select column_name from information_schema.columns
 where table_name = 'jobs'
   and column_name in ('mandate_id','intake_draft_id','intake_link_id','source',
                       'owner_user_id','day_rate_min','draft_state');
-- erwartet: 7 Zeilen

-- 4) Der Statusguard hängt
select tgname from pg_trigger where tgrelid = 'public.jobs'::regclass
   and tgname = 'trg_jobs_guard';
-- erwartet: 1 Zeile

-- 5) Kein anon-Zugriff auf die neuen Tabellen
select tablename, policyname, roles from pg_policies
 where tablename in ('intake_links','intake_drafts','intake_draft_tokens','commercial_mandates');
-- erwartet: ausschliesslich {authenticated}, nirgends {anon} oder {public}
```

Und die schärfste Probe — sie muss **fehlschlagen**:

```sql
-- Als normaler Kunde (nicht Admin) ausgeführt:
update public.jobs set fee_percentage = 5 where id = '<eine eigene Job-ID>';
select fee_percentage from public.jobs where id = '<dieselbe ID>';
-- erwartet: der ALTE Wert. Der Guard hat zurückgeschrieben.
```

---

### 8b — Edge Functions deployen (in Lovable ausführen)

> Bitte deploye diese Supabase Edge Functions. Elf sind neu, zwei bestehende sind
> geändert bzw. waren nie deployt:
>
> **Neu:** `intake-start`, `intake-draft`, `intake-ai`, `intake-verify-email`,
> `intake-terms`, `intake-submit`, `intake-forward`, `intake-resume`,
> `intake-link-admin`, `intake-admin`, `generate-mandate-pdf`
>
> **Geändert / nachzuziehen:** `parse-job-url` (SSRF-Härtung), `intake-questions`
>
> Die `verify_jwt`-Einstellungen stehen bereits in `supabase/config.toml` und dürfen
> nicht verändert werden: die acht Gast-Endpunkte laufen auf `verify_jwt = false` und
> prüfen stattdessen selbst einen Token samt Rate-Limit; `intake-link-admin`,
> `intake-admin` und `generate-mandate-pdf` laufen auf `verify_jwt = true` und prüfen
> zusätzlich serverseitig die Admin-Rolle. `intake-questions`, `parse-job-url` und
> `parse-job-pdf` bleiben ausdrücklich auf `verify_jwt = true` — der Gast erreicht sie
> nur über den Proxy `intake-ai`.
>
> Die Functions teilen sich Module unter `supabase/functions/_shared/`
> (`http.ts`, `tokens.ts`, `domain.ts`, `intake-limits.ts`, `app-url.ts`,
> `intake-mail.ts`, `intake-core.ts`, `intake-mapping.ts`, `admin-auth.ts`) — die
> müssen mit deployt werden.
>
> **Ändere sonst nichts am Code.**

**Danach prüfen:** `/admin/intake-links` öffnen und einen persönlichen Testlink anlegen.
Erscheint der Link mit Klartext-Token, laufen Migrationen und Functions. Den Link in einem
privaten Fenster öffnen — es muss die Aufnahme erscheinen, nicht „noch nicht
freigeschaltet".

---

### 8d — Nachträge (nach dem ersten Betrieb entstanden)

Zwei kleine Migrationen und ein Secret. Beide Migrationen sind additiv und idempotent.

> Bitte führe diese beiden Migrationen auf Supabase aus:
>
> 1. `20260901180000_intake_funnel_security_invoker.sql`
>    Legt die View `public.intake_link_funnel` identisch neu an, diesmal mit
>    `WITH (security_invoker = true)`. Behebt das `security_definer_view`-Finding:
>    die Absicherung kommt danach aus der Admin-RLS der Basistabellen statt aus
>    den Owner-Rechten der View. **Nicht** dasselbe bei `recruiter_jobs_view`
>    machen — die muss die RLS umgehen, weil Recruiter kein SELECT auf `jobs` haben.
>
> 2. `20260901190000_intake_link_token_recoverable.sql`
>    Ergänzt `intake_links` um `token_encrypted`, `token_rotated_at` und
>    `token_rotated_by`, damit ein Aufnahme-Link erneut angezeigt werden kann.
>
> Ändere sonst nichts am Code.

**Secret prüfen** — *Project Settings → Edge Functions → Secrets*:

| Name | Wofür |
|---|---|
| `ENCRYPTION_KEY` | 64 Zeichen hex (32 Byte). Wird bereits für die OAuth-Token der CRM-Integrationen benutzt — ist er gesetzt, ist nichts zu tun. Fehlt er, funktionieren neue Links, lassen sich aber nicht erneut anzeigen; die Oberfläche sagt das dann ausdrücklich. |

Erzeugen, falls nicht vorhanden:

```bash
openssl rand -hex 32
```

**Danach neu deployen:** `intake-link-admin` (Anzeigen und Erneuern),
`parse-job-url` und `normalize-skills` (Skill-Aufbereitung), `intake-ai` und
`parse-job-pdf` (PDF-Weg) — sowie das Frontend.

**Hinweis zu bestehenden Links:** Links, die vor dieser Migration angelegt wurden,
haben keinen verschlüsselten Token und lassen sich nicht anzeigen. Im Zeilenmenü
steht für sie „Link erzeugen (alter wird ungültig)" — das erzeugt einen neuen
Token; bereits begonnene Aufnahmen bleiben davon unberührt, sie hängen an einem
eigenen Zugang.

---

### 8c — Zwei Handgriffe im Supabase-Dashboard

Diese beiden kann Lovable nicht übernehmen.

**1. Secret setzen** — *Project Settings → Edge Functions → Secrets*

| Name | Wert |
|---|---|
| `INTAKE_TOKEN_PEPPER` | ein zufälliger String, mindestens 32 Zeichen |

Ohne ihn wären die sechsstelligen Bestätigungscodes aus einem Datenbank-Dump per
Rainbow-Table auflösbar — der Suchraum ist nur eine Million. **Das ist der einzige
kritische Punkt der ganzen Liste.**

Erzeugen z. B. mit:

```bash
openssl rand -base64 48
```

Zusätzlich prüfen, dass diese beiden bereits gesetzt sind (sonst greifen brauchbare
Vorgaben, aber Mails kämen unter der Resend-Sandbox-Adresse an):

| Name | Wert |
|---|---|
| `RESEND_FROM` | `Matchunt <noreply@matchunt.ai>` |
| `APP_URL` | `https://matchunt.ai` |

`MANDATE_VENDOR_NAME`, `-_ADDRESS` und `-_REGISTER` sind **nicht nötig**: die Firmierung
steht als Vorgabe im Code (Bluewater & Bridge GmbH, Adlzreiterstraße 2, 80337 München,
Amtsgericht München HRB 288632). Nur bei einem Sitzwechsel setzen.

**2. Redirect-URL eintragen** — *Authentication → URL Configuration → Redirect URLs*

```
https://matchunt.ai/passwort
```

Ohne diesen Eintrag lehnt Supabase den Zugangslink aus der Annahme-Mail ab, und ein
frisch angelegtes Kundenkonto käme nicht ins Dashboard — einen anderen Passwort-Weg gibt
es im Projekt nicht.

---

### Reihenfolge und Risiko

8a, 8b und der Frontend-Release sind in beliebiger Reihenfolge gefahrlos: Die Migrationen
sind additiv, und das Frontend meldet bei fehlenden Functions ehrlich „noch nicht
freigeschaltet" statt still zu scheitern. Empfohlen trotzdem **8a → 8b → 8c → Frontend**,
damit ein versendeter Link vom ersten Klick an funktioniert.

**Vorher zu klären:** Prompt 5 (RLS-Härtung, `20260829110000_rls_close_open_policies.sql`)
trägt keinen Erledigt-Marker. Solange die offenen `USING(true)`-Policies leben, sind
`match_outcomes`, `outreach_emails` und `outreach_send_queue` mit dem anon-Key erreichbar.
Ein Feature, das Links per E-Mail verteilt, sollte nicht davor live gehen.

---

## Prompt 9 — Nachlauf der Aufnahme (Drei-Paket-Modell, Verträge, Abrechnung)

Acht Migrationen, in dieser Reihenfolge. Sie bauen aufeinander auf: 9b braucht die
Pakettabelle aus 9a, 9c die Rahmenvertragstabelle aus 9b, und 9g füllt die Vertragstexte,
ohne die 9b und 9c zwar stehen, aber jede Anfrage mit „not_deployed" abbricht.

Geprüft: alle acht laufen von Null auf eine frische Postgres-17-Datenbank durch
(153 Migrationen des Repos, dieselben 10 vorbestehenden Ausfälle wie davor), danach
72 pgTAP-Tests grün.

### 9a — Die drei Pakete

```
Führe die Migration supabase/migrations/20260902100000_commercial_packages.sql aus.
```

Legt `commercial_packages` an und füllt Core (20 %), Continuity 90 (23 %) und
Continuity 180 (26 %). Beide Verteilungsinvarianten stehen als CHECK, ein viertes Paket
ist nicht anlegbar. Dazu die View `commercial_packages_public`, die dem Kunden Honorarsatz
und Fristen zeigt, aber Recruiter-Anteil, Marge, Einbehalt und Auslobung nicht führt.

### 9b — Rahmenvertrag und Einzelauftrag

```
Führe die Migration supabase/migrations/20260902100100_framework_and_assignment.sql aus.
```

`contract_templates` (Vertragstexte zentral, mit dem Bluewater-&-Bridge-Block),
`client_framework_agreements` (Rahmenvertrag, einer je Kunde), und der Umbau von
`commercial_mandates` zum Einzelauftrag mit Paket, Preis-Snapshot und beiden
Unterschriften. Schaltet das Bandmodell ab: der Trigger `trg_intake_links_fee_band`
fällt weg, abweichende Prozentsätze am Link werden auf NULL gesetzt.

### 9c — Prozesszustände und Veröffentlichungssperre

```
Führe die Migration supabase/migrations/20260902100200_intake_process_states.sql aus.
```

Firmenprüfung als eigene Spur, Paketwahl am Entwurf, `company_verification_reports`,
`intake_clarifications`. Und die **schärfere Veröffentlichungssperre**: bisher genügte
`signature_status = 'signed'`, jetzt müssen Einzelauftrag angenommen, vom Kunden
unterzeichnet und von Matchunt gegengezeichnet sein — plus ein wirksamer Rahmenvertrag.

Setzt `commercial_state = 'discussion_requested'` auf `'not_started'` zurück, bevor die
Constraint enger wird. Ohne diesen Schritt würde die Migration bei jedem Kunden scheitern,
der auf „Konditionen besprechen" gedrückt hat.

### 9d — Abrechnung, Continuity, Ersatzsuche

```
Führe die Migration supabase/migrations/20260902100300_placement_settlement.sql aus.
```

`placements` bekommt Paket, Abrechnungsgrundlage, Fristen und fünf getrennte
Statusspuren. Dazu `continuity_claims`, `research_assignments`,
`recruiter_payout_tranches` und die fehlenden Felder an `invoices`.

### 9e — Fix: jedes UPDATE auf `placements` scheitert

```
Führe die Migration supabase/migrations/20260902100400_fix_log_activity_missing_status.sql aus.
```

**Das ist ein Fehler im Bestand, kein Teil des neuen Features.** `log_activity` liest im
UPDATE-Zweig ungeprüft `OLD.status`. `placements` hat keine solche Spalte — sie heißt dort
`payment_status`. Folge: jedes Update auf `placements` bricht ab, auch „als bezahlt
markieren" in AdminPlacements. Steckt seit `20251212185019` im Code.

Diese Migration ist unabhängig von den übrigen und kann auch allein gefahren werden.

### 9f — Ereignistypen für den Trichter

```
Führe die Migration supabase/migrations/20260902100500_intake_event_types.sql aus.
```

Firmenprüfung, Rückfragen, Freigabe zur Unterschrift und Gegenzeichnung bekommen eigene
Typen. `contract_signed` (Kunde) und `contract_countersigned` (Matchunt) bleiben getrennt:
dazwischen liegt unsere eigene Bearbeitungszeit, und die will man im Trichter sehen.

### 9g — Die Vertragstexte

```
Führe die Migration supabase/migrations/20260902100600_seed_contract_templates.sql aus.
```

Rahmenvertrag und Einzelauftrag im Volltext. **Ohne diesen Schritt scheitert jede
Beauftragungsanfrage** — `intake-submit` und `contract-admin` verlangen beide eine aktive
Fassung.

### 9g2 — Die Firmenprüfung darf nicht entscheiden

```
Führe die Migration supabase/migrations/20260902100700_company_check_does_not_decide.sql aus.
```

Korrektur an 9c: dort ließ die Constraint zum Absenden nur `verified` und `needs_review` zu.
Ein `failed` hätte den Kunden endgültig blockiert — und `failed` entsteht schon bei einer
USt-IdNr., die nicht zum Ländermuster passt, also bei einem Tippfehler. Ohne diese Migration
ist eine vertippte Steuernummer eine Sackgasse.

### 9h — Edge Functions

Neu zu deployen:

- `intake-packages` (`verify_jwt = false`) — die drei Pakete zeigen und wählen
- `verify-company` (`verify_jwt = true`) — Firmenprüfung
- `contract-admin` (`verify_jwt = true`) — der zweistufige Unterschriftslauf
- `intake-clarify` (`verify_jwt = false`) — Rückfragen

Neu zu deployen, weil geändert:

- `intake-submit`, `intake-start`, `intake-draft`, `intake-verify-email`, `intake-admin`
- `_shared/intake-core.ts`, `_shared/app-url.ts` (von mehreren Functions genutzt)

**Zu entfernen: `intake-terms`.** Sie ist abgelöst. Bleibt sie deployt, schlägt ihre
Aktion `request_discussion` an der neuen Constraint fehl — das ist ungefährlich, aber
unnötig.

### 9i — Frontend

Neuer Schritt „Paket" statt „Konditionen" im Gastfluss, neue Antwortseite unter
`/aufnahme/rueckfrage/:token`, Vertragsbereich und Prüfbericht im Admin.

### Reihenfolge und Risiko

**9a → 9b → 9c → 9d → 9e → 9f → 9g → 9g2 → 9h → 9i.** Die Reihenfolge ist nicht optional:
9b legt Fremdschlüssel auf die Pakettabelle aus 9a, 9c schärft die Sperre auf die
Tabellen aus 9b, und 9g füllt Texte in die Tabelle aus 9b.

**Zwischen 9c und 9h liegt ein Fenster**, in dem die alte `intake-terms` noch deployt ist,
`discussion_requested` aber schon verboten. Ein Kunde, der in diesem Fenster auf
„Konditionen besprechen" drückt, bekommt einen Fehler. Das Fenster ist harmlos, aber es
spricht dafür, 9h zügig nach 9c zu fahren.

**Nach 9g, vor 9i:** Der Gastfluss verlangt ab 9c eine Paketwahl. Entwürfe, die vorher
begonnen wurden und schon `pending_admin` sind, bleiben davon unberührt — die Constraint
greift nur bei neuen Übergängen.

---

## 10 — Kundenzugang nach der Gegenzeichnung (25.09.2026)

Befund Kanna Medics: Matchunt hatte in DocuSign gegengezeichnet, die Datenbank erfuhr es
nie, der Kunde bekam weder Konto noch Zugang. Jetzt: DocuSign meldet Kundenverträge per
Connect, und `docusign-sync` fragt alle 15 Minuten nach. Mit der Gegenzeichnung geht die
Mail „Ihre Position ist auf Matchunt“ mit persönlichem Link auf `/anmelden` raus.

### 10a — Migration

> Bitte die Migration `supabase/migrations/20260925160000_client_envelope_sync.sql`
> ausführen. Sie ergänzt `commercial_mandates.envelope_last_synced_at`, einen Teilindex
> und den Cron-Job `docusign-client-sync` (alle 15 Minuten, ruft die Edge Function
> `docusign-sync` mit dem Service-Schlüssel auf, gleiches Muster wie
> `recruiter-evidence-reminder`). Keine Daten werden verändert.

### 10b — Edge Functions

> Bitte diese Edge Functions deployen: `client-login` (neu), `docusign-sync` (neu),
> `intake-admin`, `contract-admin`, `docusign-send`, `docusign-webhook`,
> `docusign-status`. `client-login` und `docusign-sync` haben `verify_jwt = false`
> (steht in `supabase/config.toml`); beide prüfen selbst.

Die Headhunter-Anmeldung teilt jetzt ihren Code-Kern mit der Kundenanmeldung
(`_shared/login-code.ts`), ohne Verhaltensänderung. Ihre Functions müssen dafür nicht neu
deployt werden.

### 10c — Secret

`DOCUSIGN_HMAC_KEY`: in DocuSign unter Einstellungen › Connect › HMAC-Schlüssel einen
Schlüssel anlegen, den Wert in Lovable als Secret hinterlegen. Ohne ihn läuft alles über
den 15-Minuten-Abgleich; mit ihm meldet DocuSign sofort (auch die Headhunter-Verträge).

### 10d — Frontend

Publish. Neu: `/anmelden`, Hinweis auf `/auth`, Block „Zugang des Kunden“ in der
Jobaufnahme, Rundgang beim ersten Besuch.

**Reihenfolge: 10a → 10b → 10c → 10d.** `docusign-status` schreibt ab 10b in die neue
Spalte; ohne 10a schlägt nur dieses Schreiben still fehl.

---

## 11 — Cron ohne app.settings, Firma am Rahmenvertrag (26.09.2026)

Befund: Der Cron `docusign-client-sync` scheiterte bei jedem Lauf (app.settings fehlt im
Projekt), und `framework_guard` verbot nach der Kundenunterschrift, die Firma am
Rahmenvertrag nachzutragen. Reihenfolge: erst die Migrationen, dann Function, dann die
Datenkorrektur.

> 1. Migration `supabase/migrations/20260926150000_framework_org_once.sql` ausführen
>    (framework_guard: Firma darf einmal von leer auf eine Firma gesetzt werden).
> 2. Migration `supabase/migrations/20260926151000_cron_token_docusign_sync.sql` ausführen
>    (Schema private mit Cron-Schlüssel, Funktion cron_token_valid, Cron-Job neu).
> 3. Edge Function `docusign-sync` deployen.
> 4. `UPDATE public.client_framework_agreements SET organization_id = '7dd3982f-7f02-409a-8d3c-4f2231f11212' WHERE agreement_number = 'RV-2026-001002' AND organization_id IS NULL;`
> 5. Nach 15 Minuten prüfen: `select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'docusign-client-sync') order by start_time desc limit 3;`

---

## 12 — Interview-Terminierung v2: ein Fenster, Outlook, Teams (02.10.2026)

Befund Live-Test Bluewater: Die Einladung zeigte in der Mail UTC (10:00 → 08:00), der
Name blieb nach der Zusage gesperrt (falsche Spalte `identity_unlocked_at`), Benachrichtigungen
scheiterten still (`notifications.metadata` gibt es nicht), Teams-Links wurden nie erzeugt, und
Gegenvorschläge oder Absagen erreichten den Kunden nicht. Neu: ein Anfrage-Fenster mit festen
Terminvorschlägen und Kollegen (Pflicht/optional), Outlook-Verbindung mit frei/belegt, andere
Zeit durch den Kandidaten, echte Kalendereinladungen je Person, Teams-Link automatisch.

### 12a — Migration
> Bitte die Migration `supabase/migrations/20261002120000_interview_scheduling_v2.sql`
> ausführen. Sie ergänzt Spalten an `interviews` (Runde, Antragsteller, gehashte Links,
> Organisator, Teams-Quelle) und legt die Tabellen `interview_attendees`, `interview_invites`,
> `client_interview_hours`, `calendar_connections`, `calendar_oauth_states` und
> `calendar_it_requests` an, dazu einen nächtlichen Cron zum Aufräumen abgelaufener
> OAuth-States. Bestehende Daten werden nicht verändert.

### 12b — Edge Functions
> Bitte diese Edge Functions deployen: `interview-request` (neu), `interview-client-link` (neu),
> `calendar-connect` (neu), `calendar-oauth-callback` (neu), `get-interview-by-token`,
> `process-interview-response`.
> `interview-client-link`, `calendar-oauth-callback`, `get-interview-by-token` und
> `process-interview-response` haben `verify_jwt = false` (steht in `supabase/config.toml`);
> sie prüfen selbst über einmalige, gehashte Links bzw. den OAuth-state.

### 12c — Secrets (für Outlook und Teams; ohne sie läuft alles außer Outlook/Teams-Link)
- `MS_CLIENT_ID`, `MS_CLIENT_SECRET`: aus der App-Registrierung im Microsoft-Entra-Portal
  (Anleitung: `INTERVIEW_KALENDER_EINRICHTUNG.md`).
- `ENCRYPTION_KEY` muss gesetzt sein (64 Hex-Zeichen; existiert bereits für die CRM-Integrationen).
- Optional für Kunden ohne Outlook-Verbindung: `MS_APP_TENANT_ID` und `MS_ORGANIZER_USER_ID`
  (Matchunt-Konto mit Teams-Lizenz). Fehlen sie, steht in der Einladung „Den Teams-Link
  bekommen Sie rechtzeitig vor dem Termin“.
- Optional: `INTERVIEW_FROM_EMAIL` (Standard `termine@matchunt.ai`; die Adresse muss als
  Postfach oder Weiterleitung existieren, sonst laufen Antworten aus Kalendern ins Leere).

### 12d — Frontend
Publish. Neu: Fenster „Interview anfragen“ (ersetzt den 4-Schritte-Assistenten),
Einstellungen › „Kalender und Interview-Zeiten“ (`/dashboard/settings#kalender`), Karte
„Kalender verbinden“ auf dem Dashboard, Kandidatenseite `/interview/respond/:token`,
Bestätigen aus der Mail `/interview/bestaetigen/:token`, statische Seiten
`/kalender-datenblatt.html` und `/kalender-freigabe.html`.

**Reihenfolge: 12a → 12b → 12c → 12d.** Ohne 12a melden die neuen Functions „Die Migration
für die Interview-Terminierung ist noch nicht installiert“; ohne 12b zeigt das neue Fenster
beim Öffnen einen Ladefehler.

---

## 13 — Interview anfragen: Telefon, Vor Ort, Kollegen einladen (02.10.2026)

Befund Live-Test: Im neuen Fenster gab es nur Teams, Kollegen ließen sich nicht einladen
(„Noch keine Kollegen in Ihrem Team“), und ohne Microsoft-App stand in der Checkliste
„Die Kalender-Verbindung wird gerade eingerichtet“.

> 1. Migration `supabase/migrations/20261002150000_interview_formats_and_invites.sql` ausführen
>    (Rückrufnummer und Ortshinweis an `interviews`, Entscheider/Funktion/Einladung an
>    `interview_attendees`; keine Daten werden verändert).
> 2. Edge Functions deployen: `interview-request`, `get-interview-by-token`,
>    `process-interview-response`, `interview-client-link`.
> 3. Publish.

**Reihenfolge einhalten: erst 1, dann 2, dann 3.** Die Interview-Übersicht liest ab dem Publish
die neue Spalte `call_phone`; ohne Migration bleibt sie sonst leer.

---

## 14 — Outlook-Termine im Interview-Raster, Puffer wählt der Kunde (02.10.2026)

Befund Live-Test: Outlook verbunden (Marko.Benko@bluewater-bridge.de), Login bei Matchunt mit
Gmail — Matchunt fragte frei/belegt mit der Login-Adresse ab, alle Zeiten waren grün. Commit
`003ae17`. **Keine Migration.**

> 1. Edge Functions deployen: `interview-request`, `get-interview-by-token`,
>    `process-interview-response`, `interview-client-link`.
> 2. Publish.

---

## 15 — Interview anfragen: eigene Uhrzeit je Tag, geprüft gegen Outlook (06.10.2026)

Kunde will z. B. 14:30 anbieten (Raster zeigt bei 60 Min. nur volle Stunden). Neu: „+ Uhrzeit“
unter jeder Tagesspalte, sofortige Prüfung über die neue Aktion `check_time`; der alte Link
„Uhrzeit frei eingeben“ (Monatskalender ohne Prüfung) entfällt. **Keine Migration.**

> 1. Edge Functions deployen: `interview-request`, `process-interview-response`.
> 2. Publish.

---

## 16 — Kandidaten-Mail: eine Firma, ein Gesprächspartner mit Namen (06.10.2026)

Befund Live-Test (Mail-Vorschau): Betreff „… bei DataDriven GmbH“, Gesprächspartner „Bluewater &
Bridge GmbH , Talent Acquisition Manager“. Jetzt: Firmenname überall aus den Firmendaten des
Kunden (Vollständige Firmierung), Namen bereinigt; steht im Konto kein Personenname, fragt das
Fenster „Ihr Name für die Einladung“ (Aktion `set_name`) und Senden wartet darauf. Dazu Hinweis
zum Vorlauf unter dem Raster und Schritt 3 bei verbundenem Outlook. **Keine Migration.**
Abschnitt 15 kann im selben Durchgang mit erledigt werden.

> 1. Edge Functions deployen: `interview-request`, `get-interview-by-token`,
>    `process-interview-response`, `interview-client-link`.
> 2. Publish.

---

## 17 — Interview-Fenster: alles zum Termin, Verschieben, KI-Leitfaden (06.10.2026)

Ein Klick auf ein Interview öffnet ein großes Fenster (Überblick, Kandidat, Leitfaden, Notizen,
Feedback). „Verschieben“ läuft im Fenster; der gebuchte Termin bleibt, bis der Kandidat eine neue
Zeit bestätigt. Leitfaden per KI aus Muss-Kriterien und Headhunter-Notiz. `generate-interview-prep`
prüft jetzt, ob der Aufrufer zum Interview gehört.

> 1. Migration `supabase/migrations/20261006120000_interview_reschedule_and_guide.sql` ausführen
>    (`interviews`: `reschedules_interview_id`, `guide`, `guide_generated_at`; keine Daten werden verändert).
> 2. Edge Functions deployen: `interview-request`, `get-interview-by-token`,
>    `process-interview-response`, `interview-client-link`, `generate-interview-prep`.
> 3. Publish.

**Reihenfolge einhalten: erst 1, dann 2, dann 3.** Die Interview-Agenda liest ab dem Publish die
neue Spalte `reschedules_interview_id`; ohne Migration bleibt die Seite leer.

---

## 18 — Verschieben: Leitfaden und Notizen ziehen mit um (07.10.2026)

Live-Befund: nach der Verschiebung war der Leitfaden neu (Haken weg), und die KI-Fragen nannten
„Aus der Headhunter-Notiz geht hervor …“. Jetzt wandern Leitfaden und Notizen beim Bestätigen der
neuen Zeit mit, Fragen ohne Quellenverweis. **Keine Migration.**

> 1. Edge Functions deployen: `interview-request`, `process-interview-response`, `interview-client-link`.
> 2. Publish.

---

## 19 — Interview: Wechselmotivation versteht eigene Worte, Wunsch-Unternehmen, lernendes Wörterbuch (19.10.2026)

„Was stört“ versteht beim Tippen eigene Worte („mein Chef entscheidet alles allein“ →
Vorschläge), bei der Führungskraft gibt es „Wie genau?“. Der Kundentext „Warum wechseln“
zeigt jedem Satz seine Herkunft und entsteht erst mit einem Wechselgrund. Die früheren
Zusatzknöpfe (Mittelstand, Branchenwechsel, Umzug, international) sind jetzt die Frage
„Wie soll das neue Unternehmen sein?“ in „Ziele“ und werden als Felder gespeichert.
Bestätigte KI-Vorschläge landen im lernenden Wörterbuch (ohne Kandidatenbezug).
**Zwei Migrationen, eine neue Edge Function.**

> 1. Migration `supabase/migrations/20261016100000_interview_gehaltsbasis_wettbewerbsverbot.sql` ausführen
>    (`candidate_interview_notes`: `salary_basis`, `non_compete`; keine Daten werden verändert).
> 2. Migration `supabase/migrations/20261019100000_interview_umfeld_lernwoerterbuch.sql` ausführen
>    (`candidate_interview_notes`: `company_size_pref`, `industry_change`, `international_pref`;
>    neue Tabelle `interview_phrase_learnings` mit RLS; keine Daten werden verändert).
> 3. Edge Function deployen: `interview-understand` (neu).
> 4. Publish.

**Reihenfolge: erst 1 und 2, dann 3, dann 4.** Ohne Migration speichert das Interview die
neuen Felder nicht (es zeigt einen gelben Hinweis) und zieht alte Zusatz-Sätze nicht um; ohne
Deploy von `interview-understand` bleibt es beim festen Wörterbuch, ohne KI-Rückfall.

Falls Lovable die Dateien nicht findet, hier das SQL zum Einfügen:

> ```sql
> -- ============================================================================
> -- Interview: Gehaltsbasis und Wettbewerbsverbot (16.10.2026)
> -- ============================================================================
> -- salary_basis: Bezieht sich das genannte Gehalt auf das Fixum oder das Gesamt
> --   mit Bonus? Wichtig bei Geschäftsführung und Vertrieb, sonst werden Fix und
> --   Gesamt vermischt.
> -- non_compete: Gibt es ein Wettbewerbsverbot oder eine Freistellung? Kann den
> --   Start um Monate verschieben. Nur intern, nie für den Kunden.
> -- Fehlen die Spalten, speichert die App ohne sie (NEW_NOTE_COLUMNS).
> -- ============================================================================
>
> ALTER TABLE public.candidate_interview_notes
>   ADD COLUMN IF NOT EXISTS salary_basis text,
>   ADD COLUMN IF NOT EXISTS non_compete text;
>
> ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_salary_basis_check;
> ALTER TABLE public.candidate_interview_notes
>   ADD CONSTRAINT candidate_interview_notes_salary_basis_check CHECK (salary_basis IS NULL OR salary_basis IN ('fix', 'total'));
>
> ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_non_compete_check;
> ALTER TABLE public.candidate_interview_notes
>   ADD CONSTRAINT candidate_interview_notes_non_compete_check CHECK (non_compete IS NULL OR non_compete IN ('none', 'non_compete', 'garden_leave', 'negotiable'));
>
> COMMENT ON COLUMN public.candidate_interview_notes.salary_basis IS 'fix | total – Gehaltsangaben als Fixum oder Gesamt mit Bonus';
> COMMENT ON COLUMN public.candidate_interview_notes.non_compete IS 'none | non_compete | garden_leave | negotiable – nur intern';
> ```

> ```sql
> -- ============================================================================
> -- Interview: Wunsch-Unternehmen und lernendes Wörterbuch (19.10.2026)
> -- ============================================================================
> -- 1) „Wie soll das neue Unternehmen sein?“ (Phase Ziele) als echte Felder statt
> --    Sätze in der Wechselmotivation. Daraus schreibt sich der Kundentext, später
> --    nutzbar für Matching und Filter. Fehlen die Spalten, speichert die App ohne
> --    sie (NEW_NOTE_COLUMNS).
> --      company_size_pref   corporate | midsize | startup | any
> --      industry_change     same | open
> --      international_pref  yes | no
> --
> -- 2) interview_phrase_learnings: Bestätigt ein Headhunter einen KI-Vorschlag
> --    („Jour fixes“ → „Mehr Termine als Arbeit“), wird nur dieses Paar gespeichert –
> --    ohne Kandidat, ohne Namen, ohne Zahlen (die App kürzt auf höchstens 6 Wörter).
> --    Danach erkennt das Interview die Wendung bei allen Headhuntern sofort.
> -- ============================================================================
>
> ALTER TABLE public.candidate_interview_notes
>   ADD COLUMN IF NOT EXISTS company_size_pref text,
>   ADD COLUMN IF NOT EXISTS industry_change text,
>   ADD COLUMN IF NOT EXISTS international_pref text;
>
> ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_company_size_pref_check;
> ALTER TABLE public.candidate_interview_notes
>   ADD CONSTRAINT candidate_interview_notes_company_size_pref_check CHECK (company_size_pref IS NULL OR company_size_pref IN ('corporate', 'midsize', 'startup', 'any'));
>
> ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_industry_change_check;
> ALTER TABLE public.candidate_interview_notes
>   ADD CONSTRAINT candidate_interview_notes_industry_change_check CHECK (industry_change IS NULL OR industry_change IN ('same', 'open'));
>
> ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_international_pref_check;
> ALTER TABLE public.candidate_interview_notes
>   ADD CONSTRAINT candidate_interview_notes_international_pref_check CHECK (international_pref IS NULL OR international_pref IN ('yes', 'no'));
>
> COMMENT ON COLUMN public.candidate_interview_notes.company_size_pref IS 'corporate | midsize | startup | any – gewünschte Unternehmensgröße';
> COMMENT ON COLUMN public.candidate_interview_notes.industry_change IS 'same | open – in der Branche bleiben oder offen für einen Wechsel';
> COMMENT ON COLUMN public.candidate_interview_notes.international_pref IS 'yes | no – internationale Aufgaben gewünscht';
>
> -- ----------------------------------------------------------------------------
> -- Lernendes Wörterbuch
> -- ----------------------------------------------------------------------------
> CREATE TABLE IF NOT EXISTS public.interview_phrase_learnings (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   side text NOT NULL CHECK (side IN ('pos', 'neg', 'goal')),
>   phrase text NOT NULL CHECK (char_length(phrase) BETWEEN 3 AND 60 AND phrase !~ '[0-9@]'),
>   label text NOT NULL CHECK (char_length(label) BETWEEN 2 AND 80),
>   family text,
>   recruiter_id uuid NOT NULL DEFAULT auth.uid(),
>   created_at timestamptz NOT NULL DEFAULT now(),
>   UNIQUE (side, phrase, label, recruiter_id)
> );
>
> COMMENT ON TABLE public.interview_phrase_learnings IS 'Vom Headhunter bestätigte Paare „Wendung → Knopf“ für gefällt, stört und Karriereziel im Interview. Kein Kandidatenbezug.';
>
> CREATE INDEX IF NOT EXISTS interview_phrase_learnings_side_idx ON public.interview_phrase_learnings (side);
>
> ALTER TABLE public.interview_phrase_learnings ENABLE ROW LEVEL SECURITY;
>
> DROP POLICY IF EXISTS "Headhunter lesen gelernte Wendungen" ON public.interview_phrase_learnings;
> CREATE POLICY "Headhunter lesen gelernte Wendungen"
>   ON public.interview_phrase_learnings FOR SELECT TO authenticated
>   USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
>
> DROP POLICY IF EXISTS "Headhunter speichern eigene Wendungen" ON public.interview_phrase_learnings;
> CREATE POLICY "Headhunter speichern eigene Wendungen"
>   ON public.interview_phrase_learnings FOR INSERT TO authenticated
>   WITH CHECK (recruiter_id = auth.uid() AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')));
>
> DROP POLICY IF EXISTS "Headhunter löschen eigene Wendungen" ON public.interview_phrase_learnings;
> CREATE POLICY "Headhunter löschen eigene Wendungen"
>   ON public.interview_phrase_learnings FOR DELETE TO authenticated
>   USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
> ```

---

## 20 — Feedback-Lasche und Ticket-Eingang (19.10.2026)

Alle Kunden, Headhunter und Aufnahme-Links bekommen am rechten Rand eine Lasche „Feedback“:
Rahmen ziehen (das Element darunter wird erkannt), Vertrauliches schwärzen, Satz schreiben, senden.
Bild, Seite, Datei, Klickpfad, Netzwerk- und Konsolenfehler gehen mit. Jedes Feedback wird ein
Ticket (FB-0001) mit KI-Briefing für das Entwickler-Team (die KI sieht nur die markierten
Ausschnitte). Admin › Feedback: Kennzahlen, Ansichten, Tabelle, Ticketseite mit Status
Neu → In Arbeit → Gebaut (wartet auf Deploy) → Live erledigt, Duplikate, Kommentare und
„Für Claude Code kopieren“. Bei „Live erledigt“ bekommen alle Absender die Glocke.
Schalter unter Admin › Feedback startet **an** (nur Notaus). Bilder werden nach 90 Tagen gelöscht.
**Eine Migration, eine neue Edge Function, eine geänderte Shared-Datei.**

> 1. Migration `supabase/migrations/20261019150000_feedback_lasche.sql` ausführen
>    (neue Tabellen `product_feedback`, `product_feedback_events`, `feedback_settings` mit RLS,
>    Funktionen `my_feedback()` und `feedback_team()`, Trigger für Verlauf und Glocke,
>    Lese-Policy für den Bucket `feedback-screenshots`, Cron `feedback-screenshot-purge` täglich 03:50;
>    keine bestehenden Daten werden verändert).
> 2. Edge Function deployen: `product-feedback` (verify_jwt = false, prüft selbst).
>    Optional Secret `FEEDBACK_NOTIFY_TO` setzen; ohne geht die Mail an marko.benko@bluewater-bridge.de.
>    `_shared/ai.ts` kann jetzt Bilder mitschicken (rein additiv, andere Functions unverändert).
> 3. Publish.

Den privaten Bucket `feedback-screenshots` legt die Function beim ersten Bild selbst an.

---

## 21 — Firmenlogo automatisch von der Website, Jobliste und Briefing neu (19.10.2026)

Sobald die Website einer Firma bekannt ist (Firma beantragt/geändert, Aufnahme angenommen,
Einstellungen, Admin › Firmen prüfen), holt Matchunt das Logo von dort und speichert es im
Bucket `company-logos`. Hochgeladene Logos gehen immer vor. Headhunter sehen das Logo wie den
Firmennamen erst nach „Ich suche“. Dazu: Jobliste ruhiger (Karte, Vorschau, Filter), „Anzeige &
Ansprache“ im Mandatsbriefing statt auf eigener Seite (alter Link leitet weiter).
**Eine Migration, eine neue Edge Function, zwei geänderte Shared-Dateien / Functions.**

> 1. Migration `supabase/migrations/20261019170000_firmenlogo.sql` ausführen
>    (neue Spalten `logo_url`, `logo_source`, `logo_checked_at`, `logo_check` an `client_companies`;
>    übernimmt das schon hochgeladene Logo der Hauptfirma aus `company_profiles`;
>    neue Funktion `client_set_company_logo(uuid, text)`; Storage-Policy „Admins laden Firmenlogos hoch“
>    für den bestehenden Bucket `company-logos`; `recruiter_jobs_view` neu mit angehängter Spalte
>    `company_logo_url` – sonst gleiche Spalten wie 20261008120000; keine Daten gehen verloren).
>    Der Bucket `company-logos` existiert schon (öffentlich) – bitte NICHT neu anlegen.
> 2. Edge Function deployen: `firmenlogo-holen` (neu, verify_jwt = true, prüft selbst Kunde/Admin).
>    Nutzt das vorhandene Secret `FIRECRAWL_API_KEY` (nur wenn die Seite direkt nichts hergibt).
> 3. Edge Function neu deployen: `intake-admin` (holt bei der Annahme das Logo im Hintergrund;
>    `_shared/firmenprofil.ts` und neu `_shared/firmenlogo.ts`).
> 4. Publish.

Danach einmal: Admin › Dashboard › Kasten „Firmenlogos“ › **Logos holen** (Bestand nachholen).

---

## 24 — Aufgaben „Kunde prüft“: eine Mail für mehrere Kandidaten (20.10.2026)

Die Aufgabenseite bündelt „Kunde prüft“ je Stelle; „Kunden erinnern“ schickt für alle wartenden
Kandidaten (auch anderer Stellen desselben Kunden) EINE Mail je Teammitglied, je Stelle eine
Benachrichtigung, je Einreichung weiter einen Beleg im Aktivitätslog. Sperre unverändert: je
Einreichung höchstens einmal in 3 Tagen. **Keine Migration, nur eine Function.**

> 1. Edge Function neu deployen: `recruiter-notify` (nimmt jetzt auch `submissionIds: string[]`;
>    der bisherige Aufruf mit `submissionId` funktioniert unverändert).
> 2. Publish.

---

## 22 — Einreichen nur mit Arbeitsmodell, Wohnort/Pendelzeit und Sprachen (19.10.2026)

„Bereit zum Einreichen“ ist jetzt die eine Pflichtliste: Arbeitsmodell, Wohnort mit Pendelzeit
(entfällt bei „nur remote“ oder Umzugsbereitschaft) und mindestens eine Sprache sind dazugekommen
und Pflicht zum Abschließen des Interviews. Die Datenbank prüft dasselbe beim Einreichen.
**Eine Migration, sonst nur Frontend.**

> 1. Migration `supabase/migrations/20261019180000_einreichen_rahmen_pflicht.sql` ausführen
>    (ersetzt die Funktion `enforce_submission_interview()` – Interview-Regel aus 20261012120000
>    unverändert, dazu die Rahmenprüfung – und legt den Trigger `trg_enforce_submission_interview`
>    auf `submissions` (BEFORE INSERT) neu an; bestehende Einreichungen bleiben unberührt,
>    Admins und Hintergrundprozesse sind ausgenommen). Läuft auch, falls 20261012120000 live fehlt.
> 2. Publish.

---

## 23 — Mails kommen an: Team-Einladung, Angebot, Referenz, Vorlagen (20.10.2026)

Team-Einladungen, Angebote an Kandidaten, Referenzanfragen und die Vorlagen-Mails liefen über
nicht bestätigte Absender (Resend-Testadresse, lovable.app, recruitflow.app) und kamen nicht an.
Jetzt gehen alle über `Matchunt <noreply@matchunt.ai>` (oder das Secret `RESEND_FROM`) mit
matchunt.ai-Links. Commit `ca0ad0d`. **Keine Migration.**

> 1. Edge Functions neu deployen: `organization-invite`, `send-offer`, `request-reference`, `send-email`
>    (gemeinsame Datei `_shared/intake-mail.ts` nur ergänzt, andere Functions unverändert).
> 2. Publish.

Danach: unter Team die alte Einladung an linn.orneskog@hotmail.com (Link auf localhost) zurückziehen und neu einladen.

---

## 25 — Nachgespräch statt Debrief, Aufgaben-Karte im Dashboard wie die Aufgabenseite (20.10.2026)

Nach dem Interview ruft der Headhunter den Kandidaten an und hält fest: wie es lief, Bauchgefühl,
Ansprechpartner, Gehalt (Kandidat/Firma genannt), wie ein Angebot aussehen müsste,
Starttermin, ob er weiter will. Abgleich mit Akte und Stelle („Übernehmen“ in die Akte), danach
die Frage an den Kunden nach seinem Eindruck. Gespeichert in einer eigenen Tabelle, die nur der
Headhunter und Admins lesen – das alte Debrief (`interview_feedback`) durfte das Kundenteam lesen.
Die Aufgabe wird ab dem Tag nach dem Interview rot (vorher nach 3 Tagen).

> 1. Migration `supabase/migrations/20261020100000_nachgespraech.sql` ausführen (neue Tabelle
>    `interview_nachgespraeche` mit RLS: lesen nur eigener Headhunter + Admin, anlegen/ändern nur
>    eigene; Trigger `nachgespraech_zuordnen` setzt Einreichung und Kandidat aus dem Interview und
>    lässt nur den Headhunter dieser Einreichung zu). Mehrfach ausführbar.
> 2. Edge Function `recruiter-notify` neu deployen (deckt Nr. 24 mit ab; neu: Betreff und
>    Schlusssatz für „Kunden nach Interview-Eindruck fragen“, `intent: 'interview_feedback'`).
> 3. Publish.

Ohne Schritt 1 lässt sich ein Nachgespräch nicht speichern (Hinweis im Fenster), alles andere läuft.

---

## 26 — Aufnahme: sieben Muss-Fragen für den Headhunter (20.10.2026)

Die Kunden-Aufnahme fragt neu: Gehaltsspielraum (links, Vergütung), längste abwartbare Kündigungsfrist
(Zeile an „Bis wann besetzt“), Arbeitserlaubnis/Visum und Abwerbeschutz (Rahmendaten, einmal je Kunde),
Auswahlprozess (nach „An wen berichtet …“), Zielfirmen (neues Kapitel Sourcing nach „Wer hat Erfolg“) und
was Kandidaten kritisch sehen samt Antwort des Kunden (nach „Sensible Themen“). Die Antworten landen in
der Stelle und im Briefing des Headhunters; Zielfirmen, Abwerbeschutz und Einwände erst nach „Ich suche“.

> 1. **Erst Nr. 21 (Firmenlogo)**, denn diese Migration baut die Headhunter-Sicht auf deren Fassung auf.
> 2. Migration `supabase/migrations/20261020110000_aufnahme_mussfragen.sql` ausführen (fünf neue Spalten
>    in `jobs`, `accept_intake_draft` neu mit diesen Spalten, `recruiter_jobs_view` mit acht angehängten
>    Spalten). Mehrfach ausführbar.
> 3. Edge Functions neu deployen: `intake-admin` (gemeinsame Dateien `_shared/brief-columns.ts` und
>    `_shared/intake-mapping.ts` geändert; nimmt die neuen Antworten an und lässt die Kundenantwort zu
>    Visum, Zielfirmen und Abwerbeschutz über dem alten KI-Wert stehen).
> 4. Publish.

Ohne Schritt 2 und 3 werden die neuen Fragen zwar gestellt, die Antworten gehen beim Annehmen der Stelle
aber verloren.

---

## 27 — Matchunt Liga: Saisonwertung, Top-Performer-Abzeichen, Wochenstand (21.10.2026)

Headhunter mit Partnerstatus sammeln je Quartal Punkte für Ergebnisse beim Kunden (Interview, Angebot,
Einstellung, Einstellung hält) mit Abzügen (Nichterscheinen, Einstellung endet früh). Eigene Seite
„Matchunt Liga“ mit Tabelle, Meine Punkte, Regeln, Preise, Ehrentafel; schmale Karte auf der Übersicht.
Admin legt unter „Matchunt Liga“ Saisons, Preise und Punkteregeln fest, korrigiert mit Grund, nimmt bei
Verstößen aus der Saison und schließt nach der Nachfrist ab. Danach: Glückwunsch-Fenster, Abzeichen im
Partnerstatus, im Signatur-Baustein, auf Urkunde und Prüfseite und beim Kunden unter „Wer sucht für Sie“.
Montags geht der Wochenstand per Mail raus (abbestellbar). Nur Anerkennung, keine Wirkung auf Plätze.

> 1. Migration `supabase/migrations/20261021090000_matchunt_liga.sql` ausführen (Tabellen `liga_*` mit RLS,
>    Rechenfunktionen, Cron „liga-daily“ 03:50 und „liga-weekly“ montags 06:00 UTC mit eigenem Schlüssel in
>    `private.cron_tokens`). Mehrfach ausführbar. Legt **keine** Saison an; die erste Saison legt der Admin an.
> 2. Edge Function **`liga-weekly` neu** deployen (Wochenstand, Vorschau, Glückwunsch-Mails).
> 3. Edge Functions neu deployen, weil gemeinsame Dateien geändert sind (`_shared/recruiter-partner.ts`,
>    `_shared/recruiter-partner-service.ts`, `_shared/recruiter-partner-pdf.ts`, neu `_shared/liga.ts`):
>    `partner-check`, `recruiter-onboarding`, `recruiter-onboarding-admin`.
> 4. Publish.

Ohne Schritt 1 melden die Liga-Seiten „nicht erreichbar“; Karte, Abzeichen und Liga-Abschnitt im
Partnerstatus bleiben still weg. Ohne Schritt 2 läuft der Montags-Cron ins Leere.

---

## 28 — Stellenseite neu: Anzeige & Ansprache, Briefing auf einer Seite, KI-Texte geprüft (21.10.2026)

Der erste Reiter heißt „Anzeige & Ansprache“: die Anzeige allein in der Mitte, rechts Kacheln für LinkedIn,
E-Mail und Telefon (öffnen ein Fenster von rechts, mit Vorname und Aufhänger), Anzeige kopieren, Exposé und
Verdienst. Das Briefing zeigt nur Angaben des Kunden, geordnet nach den fünf Arbeitsschritten des Headhunters
(Lohnt es sich · Wen und wo · Überzeugen · Gespräch · Abschluss), Vertrauliches mit Schloss, alle Benefits an
einer Stelle; der Gesprächsleitfaden öffnet an Schritt 4. Die Dreier-Leiste oben ist weg. „Kunden fragen“
schickt die offenen Fragen der Aufnahme an das Kundenteam. Der Kopf der Stellenseite sieht aus wie eine klassische
Stellenanzeige (Fakten als Zeile, Verdienst als Spalte, Reiter als Unterstreichung). Neu für alle Headhunter:
„Honorar ausblenden“ – das Auge oben in der Kopfleiste verdeckt jeden eigenen Betrag (Verdienst, Honorar, %,
Auszahlungen), gemerkt pro Gerät; Gehalt und Tagessatz des Kandidaten bleiben sichtbar. Dafür reicht Publish.
Der Anzeigen-Generator schreibt keine Marktstellung, keine geschätzten Zahlen und kein „von Vorteil“ als
Pflicht mehr; was er doch schreibt, korrigiert er selbst und streicht den Rest.

> 1. Keine Migration.
> 2. Edge Functions neu deployen:
>    - `format-job-for-recruiters` (schärfere Regeln, Korrekturdurchlauf, neue Prüfung in `_shared/recruiter-anzeige.ts`)
>    - `recruiter-notify` (neu: `job_questions` für „Kunden fragen“; deckt Nr. 24 und 25 mit ab)
>    - `parse-job-url` (neue Regel: echte Umlaute und ß in allen Textwerten der Aufnahme)
> 3. Publish.
> 4. Danach, nur mit Markos OK: bestehende Anzeigen einmal neu erzeugen (Admin › Jobs bzw. Freigabe-Dialog,
>    „Neu erzeugen“), zuerst den Tax Manager. Bis dahin blendet die Seite KI-Zusätze schon beim Anzeigen aus.

Ohne Schritt 2 sieht die Seite schon neu aus, aber „Kunden fragen“ meldet einen Fehler, neue Anzeigen
werden noch nach den alten Regeln geschrieben, und neue Aufnahmen können noch „ue/oe/ae“ enthalten (bekannte
Wörter repariert die Seite beim Anzeigen).

---

## 29 — Kunde: Bewerberprofil mit Gespräch und Frage an den Headhunter, Liste mit Angefragt/Abgelehnt (21.10.2026)

Commit `a02e3f7`. Das Profil zeigt „Aus dem Gespräch mit <Headhunter>“, die Einschätzung zur Stelle
entsteht von selbst (ohne Zahl, ohne Wertung, ohne Gehalt). Dazu kommen der Absender, die Empfehlung
und „Frage an <Headhunter>“ mit Glocke und Mail; Antworten werden geschwärzt. Die Bewerberliste hat
Reiter für Angefragt, Abgelehnt und Beendet.
**Eine Migration, drei Edge Functions.**

> 1. Migration `supabase/migrations/20261009140000_kandidatenprofil_kunde.sql` ausführen
>    (private.app_settings mit functions_url, private.cron_tokens 'fit-assessment', Trigger
>    `trg_generate_fit_assessment` auf submissions, Cron `fit-assessment-fill` alle 10 Minuten,
>    Funktionen salary_wish_band / employer_tokens / notify_candidate_mention, Ansichten
>    client_candidate_interview_view, client_candidate_education_view, client_candidate_experiences_view neu;
>    bestehende Daten bleiben unverändert). Braucht die Erweiterungen pg_net und pg_cron.
> 2. Edge Functions deployen:
>    - `assess-candidate-fit` (jetzt **verify_jwt = false**, prüft selbst: Cron-Schlüssel oder Zugriff auf die Einreichung)
>    - `client-candidate-summary` (ohne Mindestgehalt und ohne Jobhopper-Etikett)
>    - `client-question` (neu, verify_jwt = true)
> 3. Publish.

Danach: Bestehende Einschätzungen bleiben, wie sie sind. Ältere Texte mit Wertungen
(z. B. „passt hervorragend“) entstehen erst neu, wenn die Zeile in candidate_fit_assessments gelöscht wird.

---

## 30 — Terminseite für Headhunter und LinkedIn-Beitrag mit Buchungslink (21.10.2026)

Headhunter richten unter Profil › Terminseite ihre eigene Buchungsseite ein (`matchunt.ai/t/<name>`):
Outlook verbinden, Zeiten, Dauer, Teams/Telefon, Adresse. Kandidaten sehen nur Zeiten, die im Outlook
wirklich frei sind, buchen ohne Konto, laden optional den Lebenslauf hoch und können per Link aus der Mail
verschieben oder absagen. Jede Buchung legt den Kandidaten sofort im Talent Pool an (Akte vorbefüllt), trägt
den Termin ins Outlook des Headhunters ein und meldet ihn per Mail und Glocke. Auf der Stellenseite gibt es den
blauen Knopf „Posten“: anonymer Beitragstext, Bild, Buchungslink, Anonym-Prüfung; nach „Freigeben“ geht der
Beitrag direkt auf das LinkedIn des Headhunters (Text kopieren + Bild herunterladen bleibt als Ausweg).
**Eine Migration, drei neue Edge Functions, zwei Secrets.**

> 1. Migration `supabase/migrations/20261021150000_terminseite_linkedin.sql` ausführen
>    (neue Tabellen recruiter_booking_pages, recruiter_bookings, booking_cv_uploads, recruiter_linkedin,
>    linkedin_oauth_states, job_linkedin_posts mit RLS; Funktionen booking_slug_free, my_linkedin,
>    my_job_post_status; bestehende Daten bleiben unverändert).
> 2. Edge Functions deployen:
>    - `termin-seite` (neu, **verify_jwt = false**, öffentliche Terminseite, prüft selbst mit Rate-Limits und Token)
>    - `linkedin` (neu, verify_jwt = true, nur Headhunter: verbinden, posten, löschen)
>    - `linkedin-callback` (neu, **verify_jwt = false**, Rücksprung von LinkedIn)
> 3. Secrets setzen: `LINKEDIN_CLIENT_ID` und `LINKEDIN_CLIENT_SECRET` aus der LinkedIn-App
>    (Produkte „Sign In with LinkedIn using OpenID Connect“ und „Share on LinkedIn“). In der LinkedIn-App als
>    Redirect-URL eintragen: `<SUPABASE_URL>/functions/v1/linkedin-callback`. Optional `LINKEDIN_API_VERSION`
>    (Standard 202509). **`TERMIN_TEST_KALENDER` niemals setzen** – das ist nur der lokale Test-Kalender.
> 4. Publish.

Ohne Schritt 3 funktioniert alles außer dem direkten Posten: der Knopf bietet dann nur Text kopieren und Bild
herunterladen an. Ohne verbundenes Outlook lässt sich die Terminseite nicht einschalten.

---

## SAMMELAUFTRAG 22.10.2026 — alles Offene aus Nr. 21 bis 30 in einem Lauf

Lovable hat zuletzt am 19.10. Migrationen ausgeführt (`drizzle/migrations` bis
`0032_interview_umfeld_lernwoerterbuch`), Nr. 23 lief am 20.10. ohne Migration. Alles aus
Nr. 21, 22, 24, 25, 26, 27, 28, 29 und 30 liegt im Repo, ist aber noch nicht ausgerollt.
Dieser Auftrag fasst es zusammen; die Einzelheiten stehen bei den Nummern oben.

> Bitte genau in dieser Reihenfolge ausführen. Vorher in `drizzle/migrations/meta/_journal.json`
> nachsehen: Was dort schon steht, überspringen.
>
> 1. Migrationen, jede einzeln und in dieser Reihenfolge:
>    a. `supabase/migrations/20261019170000_firmenlogo.sql` (Nr. 21; Bucket `company-logos` gibt es schon, nicht neu anlegen)
>    b. `supabase/migrations/20261019180000_einreichen_rahmen_pflicht.sql` (Nr. 22)
>    c. `supabase/migrations/20261020100000_nachgespraech.sql` (Nr. 25)
>    d. `supabase/migrations/20261020110000_aufnahme_mussfragen.sql` (Nr. 26; braucht a)
>    e. `supabase/migrations/20261021090000_matchunt_liga.sql` (Nr. 27; nutzt pg_cron und pg_net)
>    f. `supabase/migrations/20261009140000_kandidatenprofil_kunde.sql` (Nr. 29; älterer Zeitstempel, aber erst jetzt fertig; nutzt pg_cron und pg_net)
>    g. `supabase/migrations/20261021150000_terminseite_linkedin.sql` (Nr. 30)
> 2. Edge Functions, verify_jwt jeweils wie in `supabase/config.toml`:
>    - neu: `firmenlogo-holen`, `liga-weekly` (false), `client-question`, `termin-seite` (false),
>      `linkedin`, `linkedin-callback` (false)
>    - neu deployen: `intake-admin`, `recruiter-notify`, `format-job-for-recruiters`, `parse-job-url`,
>      `partner-check`, `recruiter-onboarding`, `recruiter-onboarding-admin`,
>      `assess-candidate-fit` (jetzt **false**), `client-candidate-summary`
> 3. Secrets: `LINKEDIN_CLIENT_ID` und `LINKEDIN_CLIENT_SECRET` setzen, sobald die LinkedIn-App angelegt
>    ist (Redirect-URL dort: `<SUPABASE_URL>/functions/v1/linkedin-callback`). Ohne sie läuft alles,
>    nur das direkte Posten nicht. **`TERMIN_TEST_KALENDER` niemals setzen.**
> 4. Publish.

Danach (nur mit Markos OK): bestehende Anzeigen neu erzeugen (siehe Nr. 28) und die erste Liga-Saison
im Admin anlegen (siehe Nr. 27).

**Stand 22.10. vormittags:** a und b sind gelaufen (`0033_firmenlogo`, `0034_einreichen_rahmen_pflicht`).
Lovable hielt bei c an: Es fehlten Tabellenrechte für `service_role` (c, e) bzw. alle Tabellenrechte (g),
und g verwies mit Fremdschlüsseln auf `auth.users`. Korrigiert: c und e mit `GRANT ALL … TO service_role`;
g ohne Fremdschlüssel auf `auth.users` (Nutzer-ID als `uuid` wie bei der Liga), mit Rechten passend zu den
RLS-Regeln; f gibt die drei Kunden-Ansichten zusätzlich an `service_role`. Weiter ab c.

**Nachtrag 22.10. (2. und 3. Prüfung durch Lovable):** f ohne `BEGIN;`/`COMMIT;`, Ansichten mit
`DROP VIEW IF EXISTS`. Keine Daten-Einfügungen mehr in Migrationen: Cron-Schlüssel entstehen beim
ersten Gebrauch über `private.cron_token_for(name)` (e und f), die Functions-Adresse steht als Standard
in `request_fit_assessment` (`private.app_settings` bleibt leer, nur zum lokalen Überschreiben). Der
Nachhol-Lauf `fit-assessment-fill` läuft nicht mehr dauerhaft: Eine neue Einreichung startet ihn
(`private.ensure_fit_assessment_fill`), `run_fit_assessment_fill` schaltet ihn ab, sobald nichts mehr
offen ist. Ältere offene Einreichungen arbeitet er beim nächsten Start mit ab.

---

## 31 — Einstellungsprozess Teil 1: Interviews bis zur Entscheidung, Empfehlung und Angebot (22.10.2026)

Paket 1: Ein Feedback-Fenster mit vier Wegen (nächste Runde, Angebot, unsicher, Absage); der Headhunter
bekommt Glocke und Mail. Runde 2 vor Ort mit Ansprechpartner und Telefon, bis 4 Stunden, ohne neue
Einwilligung und ohne falsche „Opt-In“-Aufgabe. Texte je Runde, ehrlicher Hinweis ohne Teams-Link, Link
nachtragen, Erinnerung am Vortag an Kandidat und Kunde.
Paket 2: Der Headhunter schickt eine Empfehlung (hakt an, was der Kunde sieht; die Schmerzgrenze nie).
Der Kunde macht das Angebot im Bewerberprofil, es geht an den Headhunter. Der trägt die Antwort ein:
Zusage, überlegt noch, Gegenwunsch, Absage. Beim Gegenwunsch passt der Kunde an (Version 2 ersetzt
Version 1), bleibt dabei oder sagt ab. Neue Aufgaben: „Empfehlung schreiben“, „Angebot überbringen“,
„Kunde antwortet nicht auf Gegenwunsch“.
**Zwei Migrationen, zwei neue Edge Functions, acht neu zu deployen.**

> 1. Migrationen, einzeln und in dieser Reihenfolge (vorher `drizzle/migrations/meta/_journal.json` prüfen):
>    a. `supabase/migrations/20261022150000_interview_runde2_feedback.sql`
>       (zwei Spalten in `interviews`; täglicher Cron `interview-reminders` um 15:00 UTC, Schlüssel über
>       `private.cron_token_for`, keine Daten-Einfügungen)
>    b. `supabase/migrations/20261022160000_angebot_empfehlung.sql`
>       (neue Spalten in `offers`, neue Tabelle `offer_recommendations` mit RLS und Rechten für
>       `authenticated` (lesen) und `service_role` (alles), kein Bezug auf `auth.users`)
> 2. Edge Functions, verify_jwt wie in `supabase/config.toml`:
>    - neu: `interview-reminders` (**verify_jwt = false**, prüft selbst den Cron-Schlüssel),
>      `offer` (verify_jwt = true)
>    - neu deployen (nutzen die geänderten gemeinsamen Dateien `_shared/interview-service.ts`,
>      `_shared/interview-mails.ts`, `_shared/interview-ics.ts`): `interview-request`,
>      `get-interview-by-token`, `process-interview-response`, `interview-client-link`,
>      `calendar-connect`, `calendar-oauth-callback`, `recruiter-notify`, `termin-seite`
> 3. Publish.

Keine neuen Secrets. Teams-Links entstehen erst wieder, wenn `MS_CLIENT_SECRET` in Azure/Supabase
stimmt; bis dahin zeigen alle Texte ehrlich „Link folgt“, und der Kunde kann ihn im Interview-Fenster
nachtragen.

---

## 32 — Einstellungsprozess Teil 2: Arbeitsvertrag und Unterschrift (22.10.2026)

Nach der Zusage schickt der Kunde den Arbeitsvertrag: digital über Matchunt (Vertrag hochladen,
DocuSign, erst die Firma, dann der Kandidat; abgeschlossen = verbindlich) oder selbst (Vertragsdaten als
PDF/Kopieren, Unterschrift melden). Melden darf jede Seite: Kunde (24 h rückgängig, Headhunter macht die
Gegenprobe), Headhunter (Kunde bestätigt), Matchunt (mit Beleg direkt). Ohne Meldung: Tag 7 Mail an den
Kunden, Tag 10 Aufgabe für den Headhunter, Tag 21 Fall für Matchunt (Admin › Unterschriften).
Befristung und Wettbewerbsverbot sperren den digitalen Weg (Schriftform).
**Eine Migration, drei neue Edge Functions, eine neu zu deployen.** Setzt Nr. 31 voraus.

> 1. Migration `supabase/migrations/20261023090000_arbeitsvertrag.sql` ausführen
>    (neue Tabellen `employment_contracts` und `employment_contract_events` mit RLS und Rechten,
>    Funktion `my_contract_tasks` (SECURITY DEFINER), täglicher Cron `contract-followups` um 07:00 UTC
>    über `private.cron_token_for`; keine Daten-Einfügungen, kein Bezug auf `auth.users`).
> 2. Edge Functions, verify_jwt wie in `supabase/config.toml`:
>    - neu: `employment-contract` (verify_jwt = true), `employment-docusign-webhook` (**verify_jwt = false**,
>      prüft die DocuSign-HMAC-Signatur selbst), `contract-followups` (**verify_jwt = false**, Cron-Schlüssel)
>    - neu deployen: `offer` (legt mit der Zusage den Vertrag an)
> 3. Keine neuen Secrets: genutzt werden die vorhandenen `DOCUSIGN_*` und `DOCUSIGN_HMAC_KEY`.
>    **`DOCUSIGN_FAKE` niemals setzen** – das ist nur der lokale Testmodus (greift ohnehin nur bei lokaler Adresse).
>    Den privaten Speicher `employment-contracts` legt die Function beim ersten Upload selbst an.
> 4. Publish.

Solange DocuSign im Demo-Betrieb läuft (`DOCUSIGN_API_BASE` = demo), zeigt das Fenster: „nicht
rechtsverbindlich, für echte Einstellungen bitte selbst verschicken“. Placement, Rechnung und „Stelle als
besetzt schließen“ kommen mit Paket 4 genau an den Punkt „verbindlich“.

---

## Wichtig: wie Migrationen bei diesem Projekt überhaupt laufen

Lovable führt Migrationen **nicht per Dateiscan** aus, sondern nur die, die explizit über
den Migrations-Flow angestoßen werden. Dateien, die direkt per Git in
`supabase/migrations/` landen, werden **nie automatisch angewandt**.

Das erklärt den gesamten Rückstand: `intake_hybrid_foundation` (19.06.),
`job_review_feedback` (10.07.) und `job_close_reason` (16.07.) lagen wochenlang im Repo,
während spätere, über Lovable angestoßene Migrationen längst liefen — daher der Eindruck,
Migrationen würden „selektiv und außer der Reihe" angewandt.

**Konsequenz für jede neue Migration:** erst pushen, dann hier einen Prompt dafür anlegen
und ihn in Lovable ausführen. Ohne den zweiten Schritt passiert nichts.
