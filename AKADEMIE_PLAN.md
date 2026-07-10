# Matchunt Akademie — Bau- & Architekturplan

> Erstellt: 16. Juni 2026
> Ziel: Separate Headhunter-Akademie (`akademie.matchunt.de`), die geprüfte
> Absolventen später als Recruiter an Matchunt andockt.

---

## 1. Entscheidungen (vom Auftraggeber bestätigt)

| Frage | Entscheidung |
|-------|--------------|
| **Architektur** | Eigene Subdomain `akademie.matchunt.de`, **geteiltes Supabase-Backend** (Auth + DB) |
| **Kern-Scope** | LMS (Kurse/Lektionen) · Prüfung & Zertifikat · Community & Coaching · Praxis-Onboarding |
| **Geschäftsmodell** | **Freemium** — Basis gratis, Premium-Module + Zertifikat kostenpflichtig |
| **Andocken** | **Bewerbung/Einladung** → Admin-Freigabe → Recruiter-Rolle |

---

## 2. Architektur-Realisierung

### 2.1 Ein Repo, Host-basierter App-Split (empfohlen)

Statt zweitem Repo oder zweiter Supabase: **dieselbe Codebase, getrennt nach Hostname**.

```
main.tsx
 └─ hostname startet mit "akademie."  ?  <AcademyApp/>   (lazy)   :   <App/>  (bestehend)
```

- `akademie.matchunt.de` → eigener Router, eigenes `AcademyLayout`, eigenes Branding
- `app.matchunt.de` / `matchunt.de` → bestehende App **unverändert**
- **Geteilt:** Supabase-Client, generierte Typen, i18n-Infrastruktur, shadcn/ui
- **Bundle-Trennung:** Academy-Baum wird `lazy()` geladen → Akademie-Nutzer ziehen nicht das ganze Matchunt-Bundle
- **Deploy:** ein Vite-Build, beide Hosts zeigen per DNS/Rewrite auf dasselbe Artefakt

Alternative (später, falls echte Bundle-Isolation gewünscht): zweiter Vite-Entry
(`akademie.html` + `academy-main.tsx`) → getrennter Build im selben Repo.

### 2.2 Auth & Rollen — bewusst minimalinvasiv

**Kritisch:** Es läuft Auth-Hardening gegen Privilege Escalation. Der Signup-/Rollen-Pfad
(`app_role`-Enum, `handle_new_user`, `user_roles`) wird **nicht** angefasst.

- Akademie-Mitgliedschaft lebt in **eigenen Tabellen** (`academy_profiles` / `academy_enrollments`),
  **nicht** als neue `app_role`.
- Akademie-Signup erzeugt **keine** Plattform-Rolle (kein Self-Service-Recruiter).
- „Andocken" = **Admin** legt nach Freigabe eine `recruiter`-Zeile in `user_roles` an
  (Edge Function, SECURITY DEFINER, geprüft).
- Ein gedockter Recruiter behält den Akademie-Zugang (Community, Weiterbildung).

### 2.3 Session über Subdomains

- Heute: `localStorage` → Session **pro Origin**. Gleiche Accounts/DB, aber getrennter Login je Subdomain. **Für Start ok.**
- Später optional: Supabase-Auth auf Cookie-Storage mit `domain=.matchunt.de` → echtes SSO
  (ein Login spannt beide Subdomains). Eigener, klar abgegrenzter Umbau.

---

## 3. Datenmodell (`academy_*` Tabellen)

Alle mit RLS. Konvention wie Bestand: `YYYYMMDDHHMMSS_*.sql`.

### LMS
- `academy_profiles` — `user_id`, display_name, erfahrung_jahre, spezialisierung, plan (`free|premium`), created_at
- `academy_courses` — slug, titel, beschreibung, level, is_premium, published, sort_order
- `academy_modules` — course_id, titel, sort_order
- `academy_lessons` — module_id, titel, content_type (`video|text|quiz`), body, video_url, dauer_min, is_premium, sort_order
- `academy_enrollments` — user_id, course_id, status, progress_pct, started_at, completed_at
- `academy_lesson_progress` — user_id, lesson_id, status (`not_started|in_progress|completed`), completed_at

### Prüfung & Zertifikat
- `academy_quizzes` — course_id|lesson_id, titel, passing_score
- `academy_quiz_questions` — quiz_id, frage, options (jsonb), correct_index, punkte  *(Antworten nie an Client ausliefern)*
- `academy_quiz_attempts` — user_id, quiz_id, score, passed, answers (jsonb), attempted_at
- `academy_certificates` — user_id, course_id, zertifikatsnummer (unique), issued_at, pdf_url

### Community & Coaching
- `academy_threads` — author_id, kategorie, titel, body, pinned, created_at
- `academy_posts` — thread_id, author_id, body, created_at
- `academy_sessions` — titel, beschreibung, scheduled_at, meeting_link, host, kapazität (Live-Coaching)
- `academy_session_signups` — session_id, user_id, status

### Freemium / Zahlung
- `academy_subscriptions` — user_id, plan, status, stripe_subscription_id, current_period_end
  *(nutzt bestehende Stripe-Integration: `stripe-webhooks`, Muster aus `stripe-connect`)*

### Andocken (Recruiter-Funnel)
- `academy_recruiter_applications` — user_id, status (`draft|submitted|under_review|accepted|rejected`),
  motivation, erfahrung, reviewed_by, reviewed_at, decision_note

**RLS-Leitlinien:** Studierende sehen nur eigene Enrollments/Progress/Attempts; published Kurse lesbar;
Premium-Inhalte gated über `academy_subscriptions`; Admin Vollzugriff.

---

## 4. Edge Functions (neu / wiederverwendet)

| Function | Zweck |
|----------|-------|
| `academy-grade-quiz` | **Server-seitige** Bewertung (correct_index nie an Client) |
| `academy-issue-certificate` | PDF-Zertifikat erzeugen (Muster: `generate-cv-pdf`) |
| `academy-checkout` | Stripe-Checkout für Premium |
| `academy-process-application` | Bei `accepted`: `recruiter`-Rolle granten + Recruiter-Onboarding anstoßen + Mail |
| *(reuse)* `send-email`, `stripe-webhooks` | Benachrichtigungen, Subscription-Status |

---

## 5. Phasen-Roadmap

| Phase | Inhalt | Ergebnis |
|-------|--------|----------|
| **0 — Fundament** | Host-Split + `AcademyApp`/`AcademyLayout`/Branding · Core-Migration (profiles, courses, modules, lessons, enrollments, progress) + RLS · Akademie-Landing + Signup (ohne Plattform-Rolle) | Subdomain steht, Mitglied kann sich registrieren |
| **1 — LMS-Kern** | Kurskatalog · Kursdetail · Lektion-Player (Video/Text) · Fortschritt · Freemium-Gating | Lernen funktioniert |
| **2 — Prüfung & Zertifikat** | Quiz-UI · `academy-grade-quiz` · Attempts · `academy-issue-certificate` · Zertifikatsseite | Abschluss messbar |
| **3 — Community & Coaching** | Forum (Threads/Posts) · Live-Session-Kalender + Anmeldung | Bindung/Begleitung |
| **4 — Freemium-Monetarisierung** | Stripe-Checkout · Subscription-Tabelle · Webhook · Premium-Gating end-to-end | Umsatz |
| **5 — Andocken** | Bewerbungsformular · Admin-Review (`/admin/academy-applications`) · `academy-process-application` (Recruiter-Grant) · Kontinuität des Akademie-Zugangs | Absolvent → Recruiter |

---

## 6. Offene Punkte vor Go-Live

- **DNS/Hosting:** `akademie.matchunt.de` einrichten (Wildcard oder Rewrite auf bestehendes Artefakt)
- **Recht:** eigene AGB/Datenschutz für die Akademie? (Verkauf von Kursen = Fernabsatz, Widerrufsrecht)
- **Branding:** eigenes Logo/Farben oder Matchunt-Look mit „Academy"-Subbrand
- **Zahlung:** Stripe-Produkt/Preis für Premium anlegen
- **SSO:** ob/wann Cookie-Storage-Umbau für nahtlosen Subdomain-Login
