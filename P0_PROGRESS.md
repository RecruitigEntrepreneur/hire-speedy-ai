# P0 Triple-Blind — Fortschritt & Wiedereinstieg

> Stand: 2026-06-10 · Branch: `fix/auth-privilege-escalation` · **Noch NICHT deployed.**
> Vollanalyse: `MATCHUNT_GODMODE_ANALYSIS.md` (Kap. 3/3b).

## Ziel & Modell (bestätigt mit dem Auftraggeber)

**Binäres Reveal-Modell:** Der Kunde sieht den Kandidaten zuerst **komplett anonym**
(alle Fakten, aber kein Name/Arbeitgeber/Kontakt). **Sobald der Kandidat die
Terminanfrage des Kunden bestätigt** → `submissions.identity_unlocked = true` →
**alles offen** (Name, Arbeitgeber, Kontakt). Echte Daten werden **nie gelöscht**,
nur am Lese-Boundary verborgen.

**Entscheidung Fit-Analyse-Prosa = Option 2:** Text wird ROH (mit Namen) gespeichert
und erst beim Lesen reveal-gated (vor Bestätigung gescrubbt, danach Klartext).

## ✅ Gebaut (auf dem Branch, additiv, nichts deployt)

| Datei | Inhalt |
|---|---|
| `supabase/migrations/20260608120000_auth_hardening_privilege_escalation.sql` | Schließt Privilege-Escalation: Signup-Rolle auf `client`/`recruiter` whitelisten (kein `admin`), self-insert-Policy auf `user_roles` droppen. |
| `supabase/migrations/20260608121000_triple_blind_views_wave_a.sql` | SQL-Anonymisierer (`anon_region_broad/_experience_band/_salary_band`) + reveal-gated Views `client_candidate_view`, `client_candidate_experiences_view`, `recruiter_jobs_view`. |
| `supabase/migrations/20260608122000_client_fit_assessment_view.sql` | `scrub_identity_tokens()` + `client_fit_assessment_view` (Fit-Analyse reveal-gated, alle Spalten, nur Freitext gegated). |
| `src/hooks/useCandidateFitAssessment.ts` | Liest jetzt aus `client_fit_assessment_view` statt direkt aus der Tabelle (nur Client nutzt diesen Hook). |

`assess-candidate-fit/index.ts` = **unverändert/original** (speichert bewusst roh).

## ⏭️ Offen (nächste Schritte)

1. **DEPLOY (Gate!):** Migrationen + Frontend über Lovable einspielen. Vorher ist nichts sichtbar; lokal lädt die Fit-Karte bis dahin nicht (kein Bug). **Nur der Auftraggeber kann deployen.**
2. **Verifikation nach Deploy:** Client-Detailseite öffnen → vor Bestätigung „der Kandidat", nach Bestätigung echter Name (Vorher/Nachher im Preview zeigen).
3. **Welle B (restliche Bildschirme):** `useClientCandidateView` → `client_candidate_view`; Werdegang-Komponente → `client_candidate_experiences_view`; Recruiter-Jobseiten (`RecruiterJobs`/`JobDetail`/`SubmissionDetail`) → `recruiter_jobs_view`; `ClientCandidates`-Liste.
4. **Welle C (eigentliche Härtung):** Direkten Client-`SELECT` auf `candidates`, `candidate_experiences`, `candidate_fit_assessments` entziehen; die ungenutzten/leakenden `client_submissions_view`/`client_interviews_view`/`client_offers_view` droppen.
5. **Reveal-Auslöser scharfschalten:** „Kandidat bestätigt Termin" muss `identity_unlocked` zuverlässig setzen (Bugs: `status` vs. `stage` §3.5, zwei Flags `identity_unlocked` vs `identity_revealed` §3.6, Spalten-Drift §3.7) **und** dabei einen DSGVO-Consent-Record schreiben (§3.8).
6. **`_shared/scrub.ts`** zentral + in `client-candidate-summary` und `format-job-for-recruiters` einbinden (gleiche §3.11-Klasse von KI-Text-Lecks).

## Parallel offen (aus der Godmode-Analyse, nicht P0)
Auth `suspended`/`verified` erzwingen; fehlende Einnahme-Seite/Stripe-Checkout (Escrow); Embeddings 64-dim vs `vector(1536)`; invertierte `darkMode`-Config; Render-Loop in `NotificationBell`/`useRealtimeNotifications`; zwei Git-Linien auf einem Supabase-Projekt; `.env` im Repo.
