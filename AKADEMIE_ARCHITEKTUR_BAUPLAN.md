> Quelle: Godmode-Workflow "academy-technical-architecture" (18 Agenten, 1,39 Mio Tokens)
> Erstellt: 18. Juni 2026 · Hinweis: 1 Research-Domain (security-rls) fiel durch API-Overload aus; Security ist dennoch durchgaengig im Plan behandelt.

# Matchunt Akademie — Technischer Bauplan (State of the Art)

## 1. Executive Summary

- **Mandantentrennung ist die oberste Invariante:** `account_type='academy'` erzeugt KEINE `user_roles`-Zeile (im Phase-0-`handle_new_user`-Branch bereits korrekt umgesetzt); Andocken bleibt eine `has_role`-gegatete Admin-Aktion und ist niemals aus `academy_*`-Tabellen ableitbar — abgesichert per pgTAP- UND E2E-Negativtest.
- **Server-autoritative Lernökonomie:** `progress_pct`, `score`/`passed`, XP, SRS-`stability`/`difficulty`, Video-Completion und Entitlements werden ausschließlich in SECURITY-DEFINER-RPCs/Edge Functions berechnet; Quiz-Antwortschlüssel liegen in einer separaten default-deny-Tabelle. Ohne das ist jedes Zertifikat (= der Moat) fälschbar.
- **Kohorten als Default-Hebel** (85–96% vs 3–15% Completion): `academy_cohorts` + Offset-Drip + pro-Enrollment materialisiertes `unlock_at`/`deadline_at`, Pods (5er), Peer-Review als State-Machine — von Tag 1 mitgedacht, evergreen self-paced läuft parallel.
- **RLS vor Skalierung härten:** `(select auth.uid())`-Wrapping, geschachtelte EXISTS-Joins der Phase-0-`read_published`-Policies durch SECURITY-DEFINER-Helfer/denormalisierte Spalten ersetzen, jede Policy-Spalte indizieren. Die Phase-0-Migration verletzt das aktuell auf allen Punkten.
- **EU-Datenhoheit hart:** Claude über AWS Bedrock `eu-central-1` für PII-nahe Tutor-Chats, Bunny Stream (Video in EU) statt Mux-US, Sentry EU, Web Push self-hosted (VAPID), Supabase-EU-Region, AVVs. PII nie an Nicht-EU-Dienste.
- **Stripe-Webhook-Härtung (P0-Sicherheitsleck):** Der `JSON.parse`-Fallback ohne Signaturprüfung im bestehenden `stripe-webhooks` muss ersatzlos weg; `constructEventAsync` + `createSubtleCryptoProvider`, Idempotenz-Guard über `stripe_event_id UNIQUE`, Entitlement-Cache als RLS-Wahrheit (nie Live-Stripe im Request-Pfad).
- **Geteiltes Backend = Blast Radius:** Migrationen auf Branch/Preview testen, selektiver `functions deploy` nur für `academy-*`, Topic-Namespacing (`acad:*`) für Realtime, CCU-Monitoring.
- **Minimalinvasiv & wiederverwendend:** `academy_*`-Namensraum, ESLint-Import-Boundary, Wiederverwendung von `pgvector`/HNSW, `has_role`, `generate-cv-pdf` (pdf-lib), `pii-redaction.ts`, `stripe-webhooks`, `pg_cron`.

---

## 2. Zielarchitektur

**Komponenten & Datenfluss in Worten:** Host-Split routet `akademie.matchunt.de` auf eine lazy geladene `AcademyApp` (Phase-2 optional eigener Vite-Entry). Frontend spricht ausschließlich über (a) RLS-geschützte PostgREST-Reads, (b) `academy-*`-Edge-Functions für alle schreibenden/sicherheitskritischen Aktionen, (c) einen Realtime-Channel `acad:notif:<uid>` der NUR TanStack-Query-Caches invalidiert. Postgres ist die Wahrheit: append-only Ledger (XP/SRS/Credentials/Learning-Events) speisen per Trigger/RPC schnelle Read-Modelle. `pg_cron` ist nur Taktgeber für idempotente set-based Mutationen; externe Side-Effects (Mail/Push/Stripe/Bunny/Badge) laufen über `pgmq` + Edge-Worker. KI läuft über eine Provider-Abstraktion (Bedrock EU für PII-nah, Lovable-Gateway nur für PII-arme Quiz-Gen). Stripe/Bunny/Zoom sind über verifizierte Webhooks angebunden; deren Status wird in lokale Caches gespiegelt.

```
                          akademie.matchunt.de (DNS/Cloudflare-Proxy: WAF, Turnstile, Rate-Limit)
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │   AcademyApp (React/Vite, lazy)             │
                    │   TanStack Query · i18n · shadcn/Radix      │
                    └───┬───────────────┬──────────────────┬─────┘
       PostgREST (RLS)  │   Edge Fns    │   Realtime        │  Bunny iframe / Mux Player
       read-only        │ academy-*     │ acad:notif:<uid>  │  (signed token playback)
                    ┌───▼───────────────▼──────────────────▼──────────────────────────┐
                    │                    SUPABASE (EU-Region)                          │
                    │  Postgres + RLS (academy_* Namensraum)                           │
                    │   ├─ Katalog: courses/versions/modules/lessons/lesson_blocks     │
                    │   ├─ Kohorten: cohorts/schedule/enrollments/lesson_unlock/pods   │
                    │   ├─ Ledger (append-only): learning_events/xp_events/srs_reviews │
                    │   │     /credential_grants/state_transitions   ──▶ Read-Modelle   │
                    │   │     (user_stats/srs_cards/lesson_progress/leaderboard-MV)     │
                    │   ├─ Quiz: quizzes/questions + answer_keys(default-deny)/attempts │
                    │   ├─ Billing: billing_customers/subscriptions/entitlements        │
                    │   ├─ KI: content_chunks(vector 1536, HNSW)/ai_usage/eval_cases   │
                    │   └─ Audit/Notif: notifications/reminders_sent/web_push_subs      │
                    │  pg_cron (Takt) ─▶ pgmq (Queues) ─▶ Edge-Worker (Side-Effects)   │
                    │  Storage (privat): certificates · transcripts/VTT               │
                    └───┬──────────┬──────────┬───────────┬──────────┬────────────────┘
                        │          │          │           │          │
                  Bunny Stream  Stripe    AWS Bedrock   Zoom      Resend/Postmark
                  (Video EU)  Billing+    eu-central-1  (Live)    (E-Mail-Transport)
                              Connect+Tax (Claude)
                        │          │
                  externer cross-region Storage-Backup (rclone → R2)
```

---

## 3. Vollständiges Datenmodell — neue `academy_*`-Tabellen

Phase-0 bestehend (bleibt, wird erweitert): `academy_profiles`, `academy_courses`, `academy_modules`, `academy_lessons`, `academy_enrollments`, `academy_lesson_progress`.

**RLS-Kürzel:** `own`=eigene Zeile (`(select auth.uid())=user_id`) · `admin`=`has_role(uid,'admin')` · `pub-pub`=published lesbar (anon+authenticated) · `def-deny`=keine SELECT-Policy für authenticated/anon · `entl`=Entitlement-gegated · `pod`=Pod-Mitglieder · `svc`=nur service_role/Webhook schreibt.

### 3.1 Katalog & Versionierung
| Tabelle | Zweck | Schlüssel-Spalten | RLS |
|---|---|---|---|
| `academy_course_versions` | Immutable Versions-Snapshots eines Kurses (draft/published/archived) | `id`, `course_id→courses`, `version_no`, `status CHECK`, `published_at`, `created_by` | pub-pub (nur published) / admin |
| `academy_lesson_blocks` | Geordneter, typisierter Lektions-Inhalt statt `body TEXT` | `id`, `lesson_version_id`, `block_type CHECK`, `payload jsonb`, `rank TEXT` (fractional) | pub-pub via Helper / admin |
| `academy_lesson_transcripts` | VTT/Volltext je Lektion+Sprache (RAG/Suche/BFSG) | `lesson_id`, `lang`, `vtt_storage_path`, `body`, `search tsvector GEN` | pub-pub / admin |
| *(Erweiterung)* `academy_courses` | `+published_version_id→versions`, `+rank TEXT`, `+search_de tsvector GEN`, `+published`-Index | — | — |
| *(Erweiterung)* `academy_lessons` | `+course_id` (denormalisiert für RLS), `+rank TEXT`, `+video_provider/external_id/playback_id/status`, `+embedding vector(1536)`, `+embedding_model` | — | — |

### 3.2 Kohorten & Accountability
| Tabelle | Zweck | Schlüssel-Spalten | RLS |
|---|---|---|---|
| `academy_cohorts` | Kohorten-Lauf mit Start/Kapazität/Drip-Modus | `id`, `course_id`, `start_date`, `enrollment_close_at`, `capacity`, `drip_mode CHECK(cohort\|relative)`, `status CHECK` | pub-pub / admin |
| `academy_cohort_schedule` | Offset-Drip-Regeln (Source of Truth) | `cohort_id`, `lesson_id`, `unlock_offset_days`, `deadline_offset_days`, `is_assignment` | pub-pub / admin |
| `academy_cohort_enrollments` | Teilnahme + Pod + Status-Maschine | `id`, `cohort_id`, `user_id`, `pod_id`, `status CHECK(active\|at_risk\|completed\|dropped)`, `enrolled_at` | own / admin |
| `academy_lesson_unlock` | Materialisiertes `unlock_at`/`deadline_at` je Enrollment (DST-sicher, RLS-trivial) | `enrollment_id`, `lesson_id`, `unlock_at timestamptz`, `deadline_at timestamptz` | own (via enrollment) / admin |
| `academy_pods` | Accountability-Pods (5er-Default) | `id`, `cohort_id`, `name` | pod / admin |
| `academy_assignments` | Aufgaben mit Rubrik | `id`, `lesson_id`, `rubric jsonb`, `reviews_required int` | pub-pub / admin |
| `academy_submissions` | Einreichung, State-Machine | `id`, `assignment_id`, `user_id`, `content`, `status CHECK(draft\|submitted\|under_review\|reviewed)` | own + pod / admin |
| `academy_peer_reviews` | Round-Robin Peer-Review im Pod | `submission_id`, `reviewer_id`, `scores jsonb`, `completed_at` | reviewer + own-submission / admin |
| `academy_state_transitions` | Append-only Audit aller Statuswechsel | `entity`, `entity_id`, `from_state`, `to_state`, `actor`, `created_at` | admin (read) / svc |

### 3.3 Gamification, Streaks & SRS
| Tabelle | Zweck | Schlüssel-Spalten | RLS |
|---|---|---|---|
| `academy_xp_events` | **Append-only XP-Ledger**, Anti-Farm | `id`, `user_id`, `reason`, `ref_id`, `amount`, **`UNIQUE(user_id,reason,ref_id)`** | own read, **kein** user-write / svc |
| `academy_user_stats` | Read-Modell: total_xp/level/streak | `user_id PK`, `total_xp`, `level`, `current_streak`, `longest_streak`, `last_active_date`, `tz` | own read / svc |
| `academy_learning_events` | **Append-only, RANGE-partitioniert** (pg_partman), xAPI-orientiert | `event_uuid` (idem), `user_id`, `verb`, `lesson_id`, `occurred_at` | own read / svc |
| `academy_srs_items` | Wiederholbare Items (entkoppelt von lessons) | `id`, `lesson_id`, `kind`, `prompt jsonb`, `answer jsonb`, `locale` | pub-pub / admin |
| `academy_srs_cards` | Read-Modell pro (user,item), FSRS-fähig | `user_id`,`item_id`, `stability`, `difficulty`, `state`, `due`, `last_review`, `reps`, `lapses` | own / svc |
| `academy_srs_reviews` | **Append-only Review-Ledger** | `id`, `user_id`, `item_id`, `grade CHECK 1..4`, `pre/post_stability`, `reviewed_at` | own read / svc |
| `academy_review_tokens` | Single-Use Anti-Bot-Token | `token PK`, `user_id`, `item_id`, `issued_at`, `expires_at`, `consumed_at` | own / svc |
| `academy_league_tiers` / `academy_cohort_members` + MV `academy_cohort_ranks` | Sharded ~30er-Ligen, Promotion/Relegation | `tier`, `(cohort_id,user_id)`, `weekly_xp`; MV `rank() OVER` + UNIQUE-Index | eigene Kohorte / svc |

### 3.4 Prüfung & Zertifikate
| Tabelle | Zweck | Schlüssel-Spalten | RLS |
|---|---|---|---|
| `academy_quizzes` | Quiz-Konfig (Schwelle, Limits) | `id`, `lesson_id`, `passing_score`, `num_questions`, `time_limit_sec`, `max_attempts`, `cooldown_seconds` | pub-pub / admin |
| `academy_quiz_questions` | Frage-Stems + Optionen (OHNE Lösung) | `id`, `quiz_id`, `stem`, `options jsonb`, `points` | pub-pub (View ohne Lösung) / admin |
| `academy_quiz_answer_keys` | **Lösung getrennt, default-deny** | `question_id PK`, `correct_index`, `explanation` | **def-deny** / admin |
| `academy_quiz_attempts` | Attempt mit Seed/Permutation, server-getimed | `id`, `user_id`, `quiz_id`, `seed`, `presented jsonb`, `answers jsonb`, `score`, `passed`, `started_at`, `submitted_at`, `honor_code_accepted_at`, `proctor_signals jsonb` | own / svc |
| `academy_certificates` | **DB = Single Source of Truth** (regenerierbar) | `id`, `user_id`, `course_id`, `certificate_no UNIQUE`, `content_hash`, `issued_payload jsonb`, `signature` (Ed25519), `credential_json jsonb`, `status CHECK(valid\|revoked)`, `pdf_path`, **`UNIQUE(user_id,course_id)`** | own / svc; View `academy_cert_public` (anon, ohne PII) |
| `academy_cert_status_list` | Bitstring Status List (Revocation) | `list_id`, `bitstring`, `signed_credential jsonb` | anon read / svc |

### 3.5 Billing & Entitlements
| Tabelle | Zweck | Schlüssel-Spalten | RLS |
|---|---|---|---|
| `academy_billing_customers` | 1 Stripe-Customer je User | `user_id PK`, `stripe_customer_id UNIQUE` | own read / svc |
| `academy_subscriptions` | Gespiegelter Abo-Status | `user_id PK`, `stripe_subscription_id UNIQUE`, `status`, `current_period_end`, `cancel_at_period_end` | own read / svc |
| `academy_entitlements` | **RLS-Wahrheit fürs Gating** (nur aus Webhook) | `(user_id,lookup_key) PK`, `active`, `updated_at` | own read / svc |
| `academy_invoices` | Rechnungsarchiv (Fernabsatz) | `user_id`, `stripe_invoice_id`, `hosted_invoice_url`, `invoice_pdf` | own read / svc |
| `academy_attribution` | Andock-Moat-Attribution (kein Geldfluss) | `academy_user_id`, `recruiter_user_id UNIQUE`, `cohort_id`, `attributed_by`, `attributed_at` | admin / svc |

### 3.6 Community, Notifications & KI
| Tabelle | Zweck | Schlüssel-Spalten | RLS |
|---|---|---|---|
| `academy_threads` / `academy_posts` | Pod-Wall/Forum-MVP | `id`, `pod_id`/`thread_id`, `author_id`, `body`; BEFORE-INSERT-Rate-Trigger | pod / own-write / admin |
| `academy_notifications` | Fan-out-on-write In-App | `id`, `user_id`, `type`, `title`, `body`, `link`, `read_at`, `dedupe_key`, **`UNIQUE(user_id,dedupe_key)`** | own / svc |
| `web_push_subscriptions` | VAPID Web Push (kein FCM) | `user_id`, `endpoint UNIQUE`, `p256dh`, `auth` | own / svc |
| `academy_reminders_sent` | Idempotenz-Gate Reminder | `(enrollment_id,kind,period_key) PK` | svc |
| `academy_content_chunks` | RAG-Chunks (gleiches Modell wie Plattform) | `id`, `lesson_id`, `course_id`, `chunk_index`, `content`, `fts tsvector GEN`, `embedding vector(1536)`, `embedding_model`, `token_count` | entl/pub via Helper, RPC `SECURITY INVOKER` |
| `academy_ai_usage` | Token-/Kostenbudget (Freemium-Abuse) | `user_id`, `task`, `model`, `input/output_tokens`, `cost_usd`, `created_at` | own read / svc |
| `academy_skill_mastery` | Deterministisches Knowledge-Tracing | `(user_id,skill) PK`, `mastery 0..1`, `evidence_count` | own / svc |
| `academy_eval_cases` | KI-Regressions-Evalset | `id`, `kind`, `input`, `expected jsonb`, `must_cite_lesson` | admin |
| `academy_feature_flags` | Rollout-Toggles (NIE Geld-Gating) | `key PK`, `enabled`, `rollout_pct`, `cohort` | authenticated read / admin write |

---

## 4. Engines

### 4.1 Kohorten-Engine (Drip-Materialisierung + Re-Materialisierung)
Offsets sind Wahrheit; `unlock_at`/`deadline_at` werden pro Enrollment materialisiert, damit RLS/UI ohne Datums-Arithmetik filtern.
```sql
CREATE FUNCTION academy_materialize_unlocks(p_enrollment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record;
BEGIN
  SELECT ce.id, ce.enrolled_at, c.start_date, c.drip_mode
    INTO e FROM academy_cohort_enrollments ce
    JOIN academy_cohorts c ON c.id=ce.cohort_id WHERE ce.id=p_enrollment;
  INSERT INTO academy_lesson_unlock(enrollment_id, lesson_id, unlock_at, deadline_at)
  SELECT p_enrollment, s.lesson_id,
    -- DST-sicher: date + Tageszeit in Europe/Berlin -> timestamptz
    ((CASE WHEN e.drip_mode='cohort' THEN e.start_date ELSE e.enrolled_at::date END
       + s.unlock_offset_days) || ' 06:00 Europe/Berlin')::timestamptz,
    CASE WHEN s.deadline_offset_days IS NULL THEN NULL ELSE
      ((CASE WHEN e.drip_mode='cohort' THEN e.start_date ELSE e.enrolled_at::date END
       + s.deadline_offset_days) || ' 22:00 Europe/Berlin')::timestamptz END
  FROM academy_cohort_schedule s WHERE s.cohort_id=(SELECT cohort_id FROM academy_cohort_enrollments WHERE id=p_enrollment)
  ON CONFLICT (enrollment_id, lesson_id) DO UPDATE
    SET unlock_at=EXCLUDED.unlock_at, deadline_at=EXCLUDED.deadline_at; -- Re-Mat. bei Schedule-Änderung
END; $$;
```
Status-Übergänge DB-erzwungen (Cron, Peer-Review, Admin, At-Risk schreiben denselben Status):
```sql
CREATE FUNCTION enforce_cohort_enr_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status=OLD.status THEN RETURN NEW; END IF;
  IF NOT (OLD.status,NEW.status) IN (('active','at_risk'),('at_risk','active'),
     ('active','completed'),('at_risk','completed'),('active','dropped'),('at_risk','dropped'))
  THEN RAISE EXCEPTION 'illegal transition % -> %', OLD.status, NEW.status; END IF;
  INSERT INTO academy_state_transitions(entity,entity_id,from_state,to_state,actor)
    VALUES('cohort_enrollment',NEW.id,OLD.status,NEW.status,COALESCE(auth.uid()::text,'system'));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_enr_state BEFORE UPDATE OF status ON academy_cohort_enrollments
  FOR EACH ROW EXECUTE FUNCTION enforce_cohort_enr_transition();
```
`pg_cron` `academy-drip-tick` (minütlich): set-based at_risk-Markierung + `pgmq.send` für Reminder (kein I/O im Cron).

### 4.2 Progress / Completion (zweischichtig, server-autoritativ)
`academy_lesson_progress` bleibt einfacher Upsert, ABER `completed` wird serverseitig gesetzt: Video ≥90% watched (aus `academy_lesson_video_progress`, nie Client-`ended`) ODER Quiz `passed` ODER manuell. `enrollment.progress_pct` per Trigger/RPC aus completed-Lessons neu berechnet — nie vom Client.

### 4.3 Gamification + SRS (Ledger → Read-Modell, FSRS-fähig)
Ein RPC-Roundtrip schreibt Review-Ledger, updatet Card, vergibt XP, bumpt weekly_xp — atomar, idempotent, token-gegated:
```sql
CREATE FUNCTION academy_srs_review(p_token uuid, p_grade smallint)
RETURNS academy_srs_cards LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tok record; card academy_srs_cards;
BEGIN
  SELECT * INTO tok FROM academy_review_tokens
   WHERE token=p_token AND user_id=(select auth.uid())
     AND consumed_at IS NULL AND now()<expires_at FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid token'; END IF;
  IF now()-tok.issued_at < interval '0.8 sec' THEN RAISE EXCEPTION 'too fast'; END IF;
  UPDATE academy_review_tokens SET consumed_at=now() WHERE token=p_token;
  INSERT INTO academy_srs_reviews(user_id,item_id,grade) VALUES (tok.user_id,tok.item_id,p_grade);
  -- SM-2 cold-start, Schema FSRS-fähig (stability/difficulty/state/due)
  UPDATE academy_srs_cards SET ... WHERE user_id=tok.user_id AND item_id=tok.item_id RETURNING * INTO card;
  -- XP idempotent (UNIQUE(user_id,reason,ref_id) verhindert Farming)
  INSERT INTO academy_xp_events(user_id,reason,ref_id,amount)
    VALUES (tok.user_id,'srs_review',tok.item_id,5) ON CONFLICT DO NOTHING;
  RETURN card;
END; $$;
```
`level := floor(sqrt(total_xp/50))+1` per AFTER-INSERT-Trigger auf `academy_xp_events`. Streaks aus Kalendertag in `Europe/Berlin`. Ligen: MV `REFRESH ... CONCURRENTLY` (UNIQUE-Index Pflicht), Rollover Mo 02:00 UTC. Korrekturen = kompensierende Negativbuchung, **nie DELETE**.

### 4.4 Prüfung + Zertifikat
Zwei Edge Functions: `academy-start-attempt` (liefert Stems+Optionen ohne `correct_index`, fixiert `seed`+seeded Fisher-Yates-Permutation in `presented`, Server-`started_at`); `academy-grade-quiz` (lädt Keys via SERVICE_ROLE, prüft `time_limit`/`max_attempts`/`cooldown` server-seitig, gibt nur `passed`+`score` zurück, nicht welche Frage falsch war). Zertifikat-Issuance idempotent (`UNIQUE(user_id,course_id)`), nur nach verifiziert bestandenem Attempt, `content_hash` über kanonisiertes `issued_payload` + Ed25519-Signatur (Key in Vault), PDF via `pdf-lib` (eingebettete TTF für Umlaute) im **privaten** Bucket + signed URL. **Bestandener Test vergibt NIE eine Plattform-Rolle.**

---

## 5. Integrationen

- **Bunny Stream (Video, EU-Default, provider-agnostisch):** 3 Edge Functions — `academy-video-upload-url` (Admin-Auth → pre-signed TUS resumable, Direktupload Client→Bunny, **nie** Bytes durch Edge proxien), `academy-video-webhook` (HMAC-verifiziert + idempotent → spiegelt `video_status`/`playback_id`/`duration` nach `academy_lessons`), `academy-video-sign` (signiert SHA256-Embed-Token NUR nach Enrollment+`unlock_at`+Entitlement-Check; `BUNNY_TOKEN_AUTH_KEY` nur in Vault). Free-Tier auf 720p baseline gedeckelt. Auto-Captions (VTT) → `academy_lesson_transcripts` (tsvector). `gdpr-deletion` um Bunny-Video-Delete erweitern. Mux<->Bunny-Wechsel = Edge-Function-Änderung.
- **Stripe Billing:** `academy-checkout` (mode=subscription, `automatic_tax`, `tax_id_collection`, Trial ohne Karte via `payment_method_collection='if_required'`+`trial_settings.end_behavior.missing_payment_method='cancel'`), Customer Portal für Plan/Kündigung. Entitlement-Cache `academy_entitlements` NUR aus Webhook `entitlements.active_entitlement_summary.updated`. Gating per `academy_has_entitlement(uid,key)` in RLS. **Webhook-Härtung am bestehenden `stripe-webhooks`:** `constructEventAsync`+`createSubtleCryptoProvider`, `JSON.parse`-Fallback entfernen (fehlendes Secret → hart 500), Idempotenz-Guard `payment_events.stripe_event_id` (Insert-before-process → bei `23505` sofort 200), Side-Effects erst nach DB-Commit, API-Version auf gepinnte `2025-06-30.basil+` synchron Client+Webhook. Entitlement-Entzug erst bei `canceled`/`unpaid`, nicht `payment_failed`.
- **Stripe Connect (2. Umsatzbein):** **Beim bestehenden Separate-Charges-&-Transfers/Escrow-Modell bleiben** (90-Tage `escrow_release_date`). Andock-Erfolgsanteil nur als `application_fee`/reduzierter Transfer + Metadata (`source_academy_cohort`), KEIN Destination-Charge-Umbau. Refund-Pfad (anteilige Fee-Rücknahme + Transfer-Reversal) explizit testen.
- **Stripe Tax/OSS:** `automatic_tax` auf Session UND Recurring-Invoices; B2B Reverse-Charge nur mit validierter USt-IdNr. OSS-Filing = Steuerberater (nicht Engineering). Marketplace-VAT/„deemed supplier" vor Go-Live klären.
- **Zoom (Live-Kohorten, BUY):** Server-to-Server-OAuth Edge Function legt Meetings je `cohort_schedule`-Live-Session an, speichert `join_url`; Presence über Realtime nur im Live-Raum. Cloud-Recording → Bunny-Mirror.
- **KI/pgvector+Claude:** `_shared/ai-provider.ts` routet pro Task; Bedrock `eu-central-1` (SigV4) für PII-nah. RAG über `academy_content_chunks` (gleiches `text-embedding-3-small`/1536, HNSW cosine, hybrid RRF), Befüllung über bestehende `embedding_queue` (neuer `entity_type='academy_lesson'`). `match_academy_chunks` als `SECURITY INVOKER` (RLS greift).

---

## 6. Security, RLS & DSGVO

- **EU-Datenresidenz:** Supabase EU-Region; Claude über Bedrock `eu-central-1`/Vertex EU für PII-nah (nie Anthropic-Direct/Lovable-Gateway für PII); Bunny (Video in EU) statt Mux-US; Sentry EU + maskiert; Web Push VAPID self-hosted (kein FCM); Mux/Bunny/Stripe/Zoom nur mit AVV in der Akademie-Datenschutzerklärung. Verify-Credentials pseudonymisiert/gehasht.
- **RLS-Härtung (vor Skalierung, Pflicht):** `(select auth.uid())` überall; geschachtelte EXISTS-Joins der Phase-0-`modules/lessons_read_published`-Policies durch SECURITY-DEFINER-Helfer `academy_lesson_published(id)` + denormalisierte `lessons.course_id`/`published` ersetzen; `TO anon/authenticated` explizit; Indizes auf jede Policy-/Join-Spalte (`user_id, course_id, module_id, published, cohort_id, pod_id, unlock_at`).
- **Entitlement-Gating:** Premium-Lessons-Policy `is_premium=false OR academy_has_entitlement(uid,'academy_premium') OR has_role(uid,'admin')` (SECURITY DEFINER). `academy_entitlements` nur Webhook-beschreibbar (kein Client-INSERT/UPDATE).
- **Rollengrenze (oberste Invariante):** `account_type='academy'` → keine `user_roles`-Zeile (Phase-0 korrekt). Jede SECURITY-DEFINER-Funktion prüft intern `auth.uid()`/`has_role`. Andocken ausschließlich Admin. Realtime-Payloads nur Invalidierung, nie Daten.
- **Audit:** append-only Ledger + `academy_state_transitions`; Event-Tabellen RANGE-partitioniert (pg_partman) für DSGVO-Löschfristen.
- **Löschkonzept (Art. 17/32):** `gdpr-deletion` erweitern um Bunny-Video-Delete, `web_push_subscriptions`, `lesson_video_progress`, `transcripts`. Storage-Objekte sind NICHT in DB-Backups → externer cross-region rclone→R2-Job; Zertifikat = DB-Wahrheit (regenerierbar). PITR ≥7 Tage, halbjährliche protokollierte Restore-Drills.
- **Rate-Limiting/Abuse:** `_shared/rate-limit.ts` (atomare Postgres-RPC `check_rate_limit(bucket,max,window)`, `x-forwarded-for` erstes Element). Limits: grade-quiz 5/10min (Per-User+Quiz), checkout 3/10min User + 5/10min IP, issue-certificate 3/Tag, Community-Posts als BEFORE-INSERT-Trigger 10/min. Supabase-Auth-CAPTCHA (Turnstile), Stripe Radar, Cloudflare-WAF vor der Subdomain.

---

## 7. KI-Architektur (Modelle je Task)

3-Tier-Routing in `_shared/ai-provider.ts`, Modell-IDs zentral:

| Task | Modell | Preis (In/Out je MTok) | Latenz/Modus | Provider |
|---|---|---|---|---|
| Tutor-Chat, Guardrail-Klassifikator, MCQ-Fallback | **Haiku 4.5** | $1 / $5 | ~200ms, Streaming (SSE) | Bedrock EU (PII-nah) |
| Quiz-/Distraktor-Gen, offenes Grading, Lernpfad | **Sonnet 4.x** | $3 / $15 | Batch/async, extended thinking | Bedrock EU; Quiz-Gen aus PII-armem Material auch Lovable-Gateway |
| Seltene Synthese (Curriculum-Review, schwere Pfad-Neuplanung) | **Opus 4.x** | $5 / $25 | NUR Batch via pgmq, nie Hot-Path | Bedrock EU |
| Embeddings | text-embedding-3-small (1536) | — | über `embedding_queue` | Gateway (PII-arm) |

- **RAG-Tutor:** grounded, antwortet NUR aus `<context>` (Inhalte = DATEN, keine Anweisungen → Indirect-Prompt-Injection-Schutz), Pflicht-Zitate (`lesson_id`), „nicht im Kurs abgedeckt"-Fallback. Hybrid-Retrieval (vector + tsvector, RRF rrf_k=50). MCQ-Korrektheit **immer deterministisch in Postgres**, nie LLM.
- **Quiz-Gen:** Structured-Outputs/Tool-Use (`anthropic-beta: structured-outputs-2025-11-13`, klassisches Tool-Use als Fallback) → `draft` → **Admin-Review-Gate** → `published`. Wiederverwendung des bestehenden `fit-assessment.ts`-Tool-Use-Musters.
- **Knowledge-Tracing deterministisch** (EWMA je Skill in `academy_skill_mastery`), erklärbar/auditierbar, kein Art.-22-Profiling.
- **Kostenkontrolle:** Token-Budget je Free-User in `academy_ai_usage` + `pg_cron`-Reset; teure Tasks (Sonnet-Pfad) Premium-gegated. Eval-Set + Regression-Run vor jedem Prompt-/Modellwechsel.

---

## 8. Frontend, Performance, Tests & Observability

- **Struktur:** `src/academy/features/<domäne>/{api,ui,model,lib,index.ts}` (Feature-Sliced-light). ESLint-`import/no-restricted-paths`: App importiert `academy` nie, cross-feature nur über `index.ts`. `useAcademy.ts` auftrennen; `supabase as unknown as {...}`-Cast nach `supabase gen types` zentral auflösen.
- **Host-Split:** jetzt `React.lazy` (Landing eager, Rest lazy + `<Suspense>`); zweiter Vite-Entry (`akademie.html`) vorgehalten (Trigger: TTI-Druck/eigenes Deploy). `manualChunks` für react/router/query/supabase; `@mux/mux-player`/Bunny-Embed/recharts/Zertifikat-Renderer lazy am Mount, Route-Prefetch onHover.
- **State:** TanStack Query mit Query-Key-Factory + `queryOptions()`, Defaults (`staleTime 30s`, `retry 1`). Realtime nur `invalidateQueries`, nie Payload in Cache.
- **a11y/i18n:** Skip-Link + globaler `aria-live`-Announcer + Focus-Reset in `AcademyLayout`; Captions deklarativ (WCAG 1.2.2/BFSG); bestehende i18next-Infra, Akademie-Namespace; 14 shadcn-Komponenten WCAG-2.2-Nacharbeit.
- **Tests:** **pgTAP** (Pflicht) — `rls_enabled`, Owner-Isolation (A sieht nicht B), `correct_index` für authenticated `is_empty`, **Akademie-Signup schreibt keine `user_roles`-Zeile** + Akademie-User kann keine Rolle schreiben (`throws_ok`). Vitest (jsdom+RTL, Browser-Mode für Player/Quiz/a11y). Playwright-E2E der Geld-/Moat-Flows (Signup-ohne-Rolle, Freemium-Gate, Lesson→Progress, Quiz→Zertifikat, Stripe-Test-Mode→Unlock, Andock-Bewerbung).
- **CI/CD:** lint→typecheck→vitest→`supabase db reset`+`supabase test db` (pgTAP)→`vite build`→Playwright; Supabase-Branching/Preview-DB pro PR als required check; Deploy nur geänderte `academy-*`-Functions; `supabase gen types` mit `git diff --exit-code`.
- **Observability:** Sentry `@sentry/react` EU-Region (`de.sentry.io`), `reactRouterV6BrowserTracingIntegration`, `sendDefaultPii:false`+`beforeSend`-Scrubbing, Replay maskiert (`maskAllText/blockAllMedia`), `build.sourcemap:'hidden'`. DR: PITR ≥7 Tage (RPO≤2min), externer cross-region Storage-Backup, Forward-only-Revert-Migrationen, halbjährliche Restore-Drills.
- **Suche:** Postgres-nativ (`tsvector`+GIN+`websearch_to_tsquery`, `pg_trgm`-Fallback, optional pgvector-Hybrid). Kein externer Such-Service (RLS-Leak-Risiko, Over-Engineering).
- **CDN:** Katalog über Edge Function mit `Cache-Control public,max-age=60,s-maxage=300,swr=60`+ETag (PostgREST mit anon-JWT ist nicht edge-cachebar); Storage `cacheControl` explizit je Asset-Klasse (Cover/PDF immutable 31536000, VTT 604800 `text/vtt`); `index.html` no-cache, gehashte Assets immutable.

---

## 9. Architecture Decision Records (kompakt)

- **ADR-001 LMS-Datenmodell:** typisierte 3-Ebenen-Hierarchie behalten; `body TEXT`→`academy_lesson_blocks` (JSONB-Payload + Zod); `sort_order INT`→`rank TEXT` (fractional index); immutable `course_versions` + Enrollment-Pinning; Publish = atomare RPC.
- **ADR-002 Kohorten first-class:** `cohorts/schedule/enrollments/lesson_unlock` + Pods/Peer-Review früh; Offsets→materialisiertes `unlock_at`; Status = CHECK-TEXT + Transition-Guard-Trigger + Audit.
- **ADR-003 Gamification/SRS server-autoritativ:** append-only XP/SRS/Credential-Ledger → projizierte Read-Modelle; SM-2 cold-start, FSRS-fähiges Schema; sharded ~30er-Ligen; Single-Use-Review-Token; Korrektur = Negativbuchung.
- **ADR-004 Prüfung/Zertifikate:** default-deny `answer_keys`; zwei Edge Functions (start/grade); seeded Permutation persistiert; OB-3.0/VC-2.0-Schema, `content_hash`+Ed25519, Bitstring Status List; Honor-Code statt Webcam (Art.-9-Vermeidung); `eddsa-jcs-2022` evaluieren.
- **ADR-005 Video Bunny (DSGVO-Default):** provider-agnostisches Schema; signed-token-Playback für alle Videos; Completion server-seitig ≥90%; Captions ab Tag 1.
- **ADR-006 Billing Stripe:** Checkout/Portal BUY; Entitlement-Cache RLS-Wahrheit nur aus Webhook; Webhook-Härtung (constructEventAsync, Idempotenz, kein JSON.parse-Fallback); API-Version gepinnt synchron; Trial ohne Karte.
- **ADR-007 KI/RAG:** Provider-Abstraktion, Bedrock EU für PII-nah; 3-Tier-Routing; grounded RAG + `<context>`-Isolation + Zitate; deterministisches KT; `match`-RPC SECURITY INVOKER.
- **ADR-008 Security/RLS/DSGVO:** Mandantentrennung oberste Invariante; RLS vor Skalierung härten; generische Rate-Limit-Schicht; EU-Datenhoheit hart; Andocken nur Admin.
- **ADR-009 Frontend/Host-Split:** Feature-Sliced + ESLint-Boundary; lazy jetzt, 2. Vite-Entry vorgehalten; Query-Key-Factory; Gating nie Client-Flag.
- **ADR-010 Tests/Observability/CI:** pgTAP für RLS-Negativtests; Sentry EU; selektiver Deploy auf Preview; PITR + externer Storage-Backup + Restore-Drills.

---

## 10. Engineering-Roadmap (auf 6 Phasen gemappt, mit PR-Reihenfolge)

**Phase 0 — Fundament (gebaut, Migration noch nicht angewandt) → ZUERST härten, dann skalieren:**
- **PR-1 (P0-Security, blockierend):** RLS-Härtung der Phase-0-Policies: `(select auth.uid())`, SECURITY-DEFINER-Helfer `academy_lesson_published`, denormalisierte `lessons.course_id`, Indizes auf alle Policy-Spalten, `TO anon/authenticated` explizit. + pgTAP-Suite (Owner-Isolation, **keine user_roles-Zeile bei academy-Signup**). + Stripe-Webhook-Härtung am bestehenden `stripe-webhooks` (constructEventAsync, JSON.parse-Fallback raus, Idempotenz-Guard). Migration auf Branch/Preview testen.
- **PR-2:** `body`→`academy_lesson_blocks` + `sort_order`→`rank` (fractional) + `course_versions`/`published_version_id` + Enrollment-Pinning + Block-Renderer + Zod-Schemas; `useAcademy.ts` aufsplitten, `supabase gen types`, Cast auflösen. CI-Pipeline (pgTAP+Vitest+Playwright-Skeleton+selektiver Deploy).

**Phase 1 — Kohorten & Progress:** `cohorts/schedule/enrollments/lesson_unlock` + Materialisierungs-RPC + Transition-Guards + Audit; `academy-drip-tick`-Cron + `pgmq`-Reminder-Worker (Vault-Secrets, `reminders_sent`-Idempotenz); server-autoritatives `lesson_progress`/`progress_pct`.

**Phase 2 — Video & Prüfung & Zertifikat:** Bunny-Integration (3 Edge Functions + `lesson_video_progress`); Quiz-Engine (`answer_keys` default-deny, `start-attempt`/`grade-quiz`, seeded Permutation); Zertifikat-Engine (`certificates` DB-Wahrheit, `content_hash`+Ed25519, pdf-lib, privater Bucket, Verify-Seite + Status List).

**Phase 3 — Gamification/SRS & Community & Notifications:** XP/SRS-Ledger + Read-Modelle + Review-Token + Ligen-MV; Pods/Peer-Review-State-Machine; `notifications`/Realtime-Broadcast/VAPID-Web-Push; Engagement-Score + At-Risk-Outreach (pg_cron).

**Phase 4 — Billing & Freemium:** `academy-checkout`/Portal, `entitlements`/`subscriptions`/`billing_customers`, Entitlement-Gating in RLS, Stripe Tax/Trial-ohne-Karte, Dunning/Smart-Retries.

**Phase 5 — KI & Andock-Moat:** RAG-Tutor (Bedrock EU, `content_chunks`, hybrid RRF), Quiz-Gen mit Admin-Gate, deterministisches KT, `ai_usage`-Budget; Andock-Funnel (`attribution`, Admin-only Rollenvergabe, Connect-Erfolgsanteil als Metadata).

**Phase 6 — Betrieb & Skalierung:** pg_partman-Partitionierung der Event-Tabellen, PITR + externer Storage-Backup + Restore-Drill, Sentry EU, Cloudflare-WAF/Turnstile, Postgres-Volltextsuche, CDN-Header-Policy, 2. Vite-Entry bei TTI-Druck.

---

## 11. Quellen

- Supabase RLS/Performance: https://supabase.com/docs/guides/database/postgres/row-level-security · https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv · https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- Supabase Cron/Queues/pg_net: https://supabase.com/docs/guides/cron · https://supabase.com/docs/guides/queues/pgmq · https://supabase.com/docs/guides/database/extensions/pg_net · https://supabase.com/blog/supabase-cron
- Supabase AI/RAG/Embeddings: https://supabase.com/docs/guides/ai/automatic-embeddings · https://supabase.com/docs/guides/ai/hybrid-search · https://supabase.com/docs/guides/ai/rag-with-permissions · https://supabase.com/docs/guides/database/extensions/pgvector
- Supabase Realtime: https://supabase.com/docs/guides/realtime/limits · https://supabase.com/docs/guides/realtime/broadcast · https://supabase.com/docs/guides/realtime/benchmarks
- Supabase Storage/CDN/Backups/Tests/DR: https://supabase.com/docs/guides/storage/cdn/smart-cdn · https://supabase.com/docs/guides/storage/serving/image-transformations · https://supabase.com/docs/guides/platform/backups · https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery · https://supabase.com/docs/guides/local-development/testing/pgtap-extended · https://github.com/usebasejump/supabase-test-helpers · https://supabase.com/docs/guides/deployment/branching/github-integration
- Stripe: https://docs.stripe.com/billing/subscriptions/build-subscriptions · https://docs.stripe.com/billing/entitlements · https://docs.stripe.com/payments/checkout/free-trials · https://docs.stripe.com/tax/supported-countries/european-union · https://docs.stripe.com/connect/separate-charges-and-transfers · https://docs.stripe.com/webhooks · https://docs.stripe.com/disputes/prevention/card-testing · https://docs.stripe.com/billing/revenue-recovery/smart-retries
- Video (Bunny/Mux): https://docs.bunny.net/docs/stream-embed-token-authentication · https://bunny.net/blog/bunny-stream-introducing-pre-signed-and-resumable-uploads/ · https://www.mux.com/docs/guides/secure-video-playback · https://www.mux.com/dpa · https://developers.cloudflare.com/data-localization/regional-services/
- KI/Claude: https://platform.claude.com/docs/en/about-claude/models/overview · https://platform.claude.com/docs/en/about-claude/pricing · https://platform.claude.com/docs/en/build-with-claude/structured-outputs · https://genai.owasp.org/ · https://compound.law/en-DE/tools/claude-eu-hosting/
- Credentials/Standards: https://www.imsglobal.org/spec/ob/v3p0/ · https://www.w3.org/TR/vc-data-model-2.0/ · https://www.w3.org/TR/vc-bitstring-status-list/ · https://w3c.github.io/vc-di-eddsa/
- SRS/Gamification: https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler · https://expertium.github.io/Algorithm.html · https://blog.duolingo.com/duolingo-leagues-leaderboards/
- Frontend/Tests/Observability: https://feature-sliced.design/docs/get-started/overview · https://github.com/javierbrea/eslint-plugin-boundaries · https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation · https://vitest.dev/guide/browser/ · https://playwright.dev/docs/best-practices · https://docs.sentry.io/platforms/javascript/guides/react/ · https://vite.dev/guide/build
- Postgres/Partitionierung/Suche: https://www.postgresql.org/docs/current/textsearch-controls.html · https://www.postgresql.org/docs/current/pgtrgm.html · https://www.crunchydata.com/blog/time-partitioning-and-custom-time-intervals-in-postgres-with-pg_partman · https://supabase.com/blog/postgres-full-text-search-vs-the-rest
- DSGVO: https://gdpr-info.eu/art-32-gdpr/ · https://supabase.com/docs/guides/auth/auth-captcha · https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile

---

**Relevante Dateipfade (alle absolut):**
- Bestehende Foundation-Migration: `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/migrations/20260616130000_academy_foundation.sql` (Phase-0-Tabellen + `handle_new_user`-academy-Branch — RLS härten in PR-1)
- Wiederverwendbare Edge Functions: `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/stripe-webhooks/` (Webhook-Härtung), `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/stripe-connect/`, `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/generate-cv-pdf/` (pdf-lib-Muster für Zertifikate), `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/generate-embeddings/`, `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/gdpr-deletion/` (um Video/Push/Transcripts erweitern)
- Wiederverwendbare Shared-Utils: `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/_shared/pii-redaction.ts`, `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/_shared/fit-assessment.ts` (Tool-Use-Muster für Quiz-Gen), `/Users/markobenkomac/Projekte/hire-speedy-ai/supabase/functions/_shared/provider-config.ts`
- Frontend-Refactor: `/Users/markobenkomac/Projekte/hire-speedy-ai/src/academy/lib/useAcademy.ts` (auftrennen + `supabase as unknown`-Cast auflösen), `/Users/markobenkomac/Projekte/hire-speedy-ai/src/academy/AcademyApp.tsx` (QueryClient-Defaults + lazy), `/Users/markobenkomac/Projekte/hire-speedy-ai/src/academy/components/AcademyLayout.tsx` (a11y-Announcer/Focus-Reset)
- Neue Artefakte: `supabase/functions/_shared/rate-limit.ts`, `supabase/functions/_shared/ai-provider.ts`, `supabase/tests/*.sql` (pgTAP), `akademie.html` (Phase-2-Entry)