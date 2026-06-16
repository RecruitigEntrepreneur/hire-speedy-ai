# Kernprozess-Audit & Plan: Triple-Blind, Opt-In-Email, Interview-Steuerung, Pipeline

*Erstellt: 2026-06-16 · Methode: 4 parallele Audit-Agenten (Code + Edge Functions + RLS + vorhandene Godmode-Analyse). Quelle: `tasks/w97yoev1x.output`.*

---

## ⚠️ Der wichtigste Befund

**Triple-Blind ist heute rein kosmetisch.** Die Datenbank (RLS) liefert die „verborgenen" Daten — Klarname, E-Mail, Telefon, CV-Link, LinkedIn, echte Stadt, Firmenname, Arbeitgeber-Historie — **ungefiltert an den Browser**. Nur JavaScript versteckt sie. **Jeder mit den Browser-DevTools sieht vor jedem Opt-In alle Klardaten.** Der Blind ist eine UI-Konvention, keine Sicherheitsgrenze.

→ Das macht den **USP technisch unwahr** und ist ein **DSGVO-Risiko**.

**Die gute Nachricht:** Deine eigene Vorarbeit (Branch `fix/auth-privilege-escalation`) hat die server-seitige Lösung **bereits gebaut** (SECURITY-DEFINER-Views `client_candidate_view`, `recruiter_jobs_view` etc. mit `CASE WHEN identity_unlocked`). Sie ist nur **nicht deployed** und **nicht im Frontend verdrahtet**.

---

## Die 4 Themen — Ist-Zustand & Gaps

### 1. Triple-Blind end-to-end
**Funktioniert:** UI-Maskierung ist konsistent; Anonymisierungs-Helfer sauber; Firmen-Anonymisierung für Recruiter ok; server-seitige Lösung ist fertig konzipiert.

| Schwere | Gap |
|---|---|
| 🔴 kritisch | RLS liefert volle Kandidaten-PII an Client vor Opt-In (Blind nur im Browser) |
| 🔴 kritisch | RLS liefert `company_name` ungefiltert an Recruiter |
| 🟠 hoch | `candidate_experiences` leakt echte Arbeitgebernamen (z.B. „Siemens") an Client |
| 🟠 hoch | Stufe-1-Firmen-Reveal-Trigger **feuert nie** (prüft `status`, Code schreibt `stage`) |
| 🟠 hoch | Zwei parallele Reveal-Flags (`identity_unlocked` vs. `identity_revealed`) driften |
| 🟡 mittel | DSGVO-Consent wird **nie** persistiert; Reveal hängt am Recruiter/Interview statt am Kandidaten-Consent |
| 🟡 mittel | Re-Identifikation trotz Namens-Blind (seltene Skill-Kombis voll sichtbar) |

### 2. Opt-In-Email an Bewerber (Klick-Flow)
**Funktioniert:** Der **Wizard**-Pfad (`ProfessionalInterviewWizard` → `send-interview-invitation`) erzeugt eine `interviews`-Row mit Token, baut korrekte Accept/Counter/Decline-Links und versendet eine **anonymisierte** Mail via Resend.

| Schwere | Gap |
|---|---|
| 🔴 kritisch | **Bewerber-Landingpage kann die `interviews`-Row nicht lesen** — keine anon-RLS-Policy für Token-Zugriff → der Klick läuft für nicht-eingeloggte Bewerber ins Leere |
| 🔴 kritisch | **Zwei Einstiege „Interview anfragen"** — der meistgenutzte (`InterviewRequestWithOptInDialog`, in 7 Widgets) **sendet GAR KEINE Mail** |
| 🟠 hoch | DSGVO-Einwilligung wird nicht protokolliert (Checkbox blockt nur den Button) |
| 🟠 hoch | Token via `Math.random()` — nicht kryptografisch sicher (einziger Schutz eines öffentlichen PII-Portals) |
| 🟡 mittel | Stille E-Mail-Fehler im Slot-Flow; teils falsche Absenderdomain (`onboarding@resend.dev`) |

### 3. Interview-Steuerung & Überblick (Kunde)
**Funktioniert:** Zentrale Übersicht `ClientInterviews` (Liste + Kalender, Stats-Karten, Suche, Tabs), Umplanen, Feedback, Abschluss-Aktionen, Task-Aggregation, Next-Interview-Banner.

| Schwere | Gap |
|---|---|
| 🔴 kritisch | Klarname + E-Mail im Interview-Überblick **vor Opt-In sichtbar** (gleicher Triple-Blind-Bruch) |
| 🟠 hoch | Card-Status deckt reale Werte nicht ab — Kunde sieht nicht, ob Kandidat geantwortet/abgelehnt hat |
| 🟠 hoch | **Kein Umgang mit Gegenvorschlägen** (`counter_proposed`) im Kunden-UI |
| 🟠 hoch | **Keine automatischen Erinnerungen** (kein Cron-Job) |
| 🟡 mittel | Zwei konkurrierende Scheduling-Systeme; das mächtigere ist tot |
| 🟡 mittel | Zwei konkurrierende Feedback-Speicher (JSON vs. Tabelle `interview_feedback`) |
| 🟡 mittel | Recruiter wird nicht benachrichtigt, wenn Kunde abschließt/ablehnt/No-Show/Feedback |
| 🟡 mittel | Kein konsolidierter Pipeline-Überblick aller Kandidaten je Phase |

### 4. Gesamt-Pipeline (Zustandsmaschine)
**Funktioniert:** Happy-Path Interview-Accept sauber; Offer-Accept ist der kanonische Placement-Pfad (Honorar/Escrow); Orphan-Cleanup; Fit-Assessment-Vorgenerierung; ML-Feedback-Loop.

| Schwere | Gap |
|---|---|
| 🔴 kritisch | **`status` UND `stage`** sind zwei freie Textfelder ohne Enum/Constraint → driften systematisch |
| 🔴 kritisch | Stufe-1-Reveal-Trigger feuert nie (status vs. stage) |
| 🔴 kritisch | **Dualer Placement-Pfad**: Direkt-Hire erzeugt Placement **ohne Honorar/Escrow** und kollidiert mit UNIQUE-Constraint |
| 🟠 hoch | Reveal-Flags hängen allein an Interview-Accept; der Opt-In-Schritt wird übersprungen |
| 🟡 mittel | Fit-Assessment-Trigger feuert ungedrosselt auf jeden Insert (LLM-Kosten) |

---

## Vorgeschlagene Reihenfolge

### P0 — Triple-Blind WIRKLICH erzwingen (Sicherheit/DSGVO, das Fundament)
1. WIP-Views (`client_candidate_view`, `client_candidate_experiences_view`, `recruiter_jobs_view`) **deployen**
2. Frontend-Lesepfade auf die Views umstellen (Welle B): `useClientCandidateView`, `useExposeData`, `ClientCandidates`, `ClientInterviews`, Recruiter-Pfade
3. Rohe Client-/Recruiter-Policies auf `candidates`/`candidate_experiences`/`jobs` **entziehen** (Welle C) — *erst das ist der eigentliche Fix*
4. CV-Zugriff nach Reveal über kurzlebige signierte URL

### P0 — Reveal-Logik & Status sauber machen
5. **Ein** kanonisches Statusfeld (status **oder** stage) + Postgres-Enum/CHECK
6. Stage-1-Reveal-Trigger fixen (auf das kanonische Feld)
7. `identity_unlocked`/`identity_revealed` zusammenführen, alle Reveal-Writes in einen `_shared/reveal.ts`-Helper
8. DSGVO-Consent atomar persistieren (Zeitstempel, Quelle, ggf. IP/UA)

### P1 — Opt-In-Email-Flow end-to-end klickbar
9. **Ein** kanonischer Einstieg „Interview anfragen" (der mit Mail) — die 7 Widgets darauf umstellen
10. Anon-Lesezugriff für Bewerber-Token (SECURITY-DEFINER-RPC `get_interview_by_token`)
11. Krypto-sichere Tokens + Ablauf + One-Time-Use
12. RESEND_API_KEY prüfen, einheitliche verifizierte Absenderdomain, sichtbare Versandfehler

### P1 — Placement-Integrität
13. Direkt-Hire über den kanonischen Honorar/Escrow-Pfad kanalisieren; UNIQUE-Guard

### P2 — Interview-Steuerung & Überblick
14. Card-Status für alle realen Werte; Gegenvorschlag-UI; Pipeline-/Kanban-Überblick; Recruiter-Notifications bei Kunden-Aktionen; ein Feedback-System; Reminder via Cron

---

## ⚖️ Entscheidungen, die ich VOR dem Bauen von dir brauche

1. **Deployment:** Die DB-Migrationen kann laut `P0_PROGRESS.md` nur der Auftraggeber (du, via Lovable/Supabase) ausrollen. Sollen wir den `fix/auth-privilege-escalation`-Branch nach `main` mergen und die Migrationen einspielen — das ist die Voraussetzung für echtes Triple-Blind?
2. **Reveal-Auslöser:** Identität freigeben, wenn der Kandidat die **Terminanfrage bestätigt** (aktuell), ODER über einen **separaten expliziten Consent** (Magic-Link „Ja, meine Daten freigeben")? Letzteres ist DSGVO-sauberer.
3. **Kanonischer Einstieg:** Wizard (mit Mail) als der eine Weg — und `InterviewRequestWithOptInDialog` darauf umbauen/abschaffen?
4. **Statusfeld:** Auf `status` oder `stage` als Single-Source-of-Truth konsolidieren?
5. **k-Anonymity** (Re-ID-Schutz: seltene Skill-Kombis vor Reveal gröber zeigen) — Teil von P0 oder später?
