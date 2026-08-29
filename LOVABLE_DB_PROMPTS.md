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

> Bitte führe die Migration aus Datei
> `supabase/migrations/20260829110000_rls_close_open_policies.sql`
> auf Supabase aus. Sie entfernt 54 Policies vom Muster
> `FOR ALL USING (true)` ohne `TO`-Klausel, die für PUBLIC (inkl. anon) gelten
> und alle korrekten Policies derselben Tabelle per ODER aushebeln.
> Ändere sonst nichts am Code.

**Danach prüfen** — mit demselben öffentlichen Key, ohne Login:

```bash
curl -sS -I "https://dngycrrhbnwdohbftpzq.supabase.co/rest/v1/match_outcomes?select=id" -H "apikey: $(grep VITE_SUPABASE_PUBLISHABLE_KEY .env | cut -d= -f2-)" -H "Prefer: count=exact" | grep -i content-range
```

Erwartet: `*/0`. Kommen weiterhin Zeilen, ist eine Policy übrig geblieben.

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

## Prompt 7 — Die drei liegengebliebenen Migrationen

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
