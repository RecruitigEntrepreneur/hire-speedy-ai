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
