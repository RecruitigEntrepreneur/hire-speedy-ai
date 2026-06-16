## 0. Executive Summary

> Aufbau-Dokument fuer die Recruiting-Plattform **Matchunt** (matchunt.ai).
> Quelle = Quellcode dieses Repos (intern `matchunt`, GitHub `RecruitigEntrepreneur/hire-speedy-ai`), Stand der Analyse: 2026-06-08.
> Verifizierter Kontext: Frontend ueber **Lovable** (Projekt `7a26b296-848c-4f57-af34-75297cbf024b`), Backend = **Supabase**-Projekt `dngycrrhbnwdohbftpzq`.
> Diese Zusammenfassung verdichtet die Detail-Kapitel 01–13. Belege stehen dort; hier zaehlt die Fuehrungssicht.

---

### 0.1 Was ist Matchunt

Matchunt ist eine KI-gestuetzte Recruiting-Plattform, die drei Personas auf einer Infrastruktur verbindet: **Clients** (Unternehmen, `/dashboard/*`) schreiben Stellen aus, **Recruiter** (`/recruiter/*`) liefern Kandidaten, **Admins** (`/admin/*`) steuern Freigaben, Honorare und Plattform-Betrieb.

Das Geschaeftsmodell ist **erfolgsbasiert**: Honorar entsteht erst bei Angebotsannahme als `placement` (Default 20 % des Jahresgehalts, davon 75 % an den Recruiter), gefolgt von einer 90-Tage-Escrow-Periode und Auszahlung via Stripe Connect. Kein Vermittlungserfolg, keine Rechnung.

Der **Kern-USP ist das Triple-Blind-Verfahren**: Der Client sieht die Kandidaten-Identitaet erst nach Opt-In/Interview-Bestaetigung, der Recruiter sieht den Firmennamen erst nach gestuftem Reveal, der Recruiter besitzt seinen Kandidaten und bleibt ungeblindet. Anonymisiertes Matching, KI-Eignungsgutachten und ein vollstaendiger Pipeline-Flow (Submission → Interview → Offer → Placement) bilden das Produkt darum herum.

**Vision:** schnelleres, fairer anonymisiertes, KI-beschleunigtes Recruiting, bei dem Bias durch Verblindung reduziert wird und die Plattform nur am tatsaechlichen Vermittlungserfolg verdient.

---

### 0.2 Tech-Realitaet (in einem Absatz)

Matchunt ist eine **reine React-18-SPA** (Vite 5, TypeScript, Tailwind/shadcn) **ohne SSR, ohne Code-Splitting** — `src/App.tsx` importiert alle ~80 Pages statisch und zentralisiert Routing samt einzigem Auth-Gate. Es gibt **kein eigenes API-Backend**: das gesamte Backend liegt in **einem** Supabase-Projekt (Postgres 15 mit Row Level Security, ~115 Tabellen, ~79–81 Edge Functions in Deno, 93 Migrationen). Das Frontend spricht ausschliesslich (a) direkt mit Postgres ueber den Supabase-Client unter RLS und (b) ueber `supabase.functions.invoke()` mit Edge Functions; 75 von 79 Functions laufen mit dem Service-Role-Key (RLS-Bypass), abgesichert nur durch `verify_jwt` plus funktionseigene Autorisierungslogik. **KI laeuft fast durchgaengig ueber das Lovable AI Gateway** (`google/gemini-2.5-flash`), nicht ueber direkte OpenAI-Keys. Persona-Gating erfolgt zentral via `ProtectedRoute` gegen die Tabelle `user_roles` (reine UX — die echte Sicherheit liegt in RLS). Backend-Verdrahtung laeuft ueber DB-Trigger und `pg_cron`/`pg_net` (Auto-Fit-Assessment, Influence-/Escalation-Engines), Live-Updates ueber Supabase Realtime.

---

### 0.3 Reifegrad pro Subsystem

Skala Reife: **Produktiv** (live & verdrahtet) · **Funktional** (laeuft, mit Luecken) · **Fragil** (lauffaehig, aber kritische Defekte/Drift) · **Defekt** (Kernfunktion nicht erfuellt) · **Nicht ausgerollt** (Backend live, Frontend fehlt).

| Subsystem | Reife | Risiko | Kernbefund |
|---|---|---|---|
| Architektur & Deployment | Fragil | **Hoch** | Publish-Gap: Live-Frontend laeuft hinter Git/Backend her; zwei Git-Linien auf einem Supabase-Projekt |
| Datenmodell & RLS | Funktional | **Hoch** | ~115 Tabellen, sauberes Trigger-Geruest; RLS setzt Triple-Blind-Stufen aber NICHT durch |
| Triple-Blind (USP) | Fragil | **Kritisch** | Anonymisierung nur clientseitig/im Prompt; PII per DevTools vor Opt-In abgreifbar |
| Auth, Rollen & Zugriff | Fragil | **Kritisch** | Privilege-Escalation ueber Signup-Metadaten + offene `user_roles`-Insert-Policy |
| Kandidaten-Intake | Funktional | **Hoch** | 4 Eingangskanaele live; Embeddings defekt (64-dim in `vector(1536)`) |
| Job-Lifecycle & Anreicherung | Funktional | Mittel | 3-Phasen-Flow funktioniert; Anonymisierung nur per LLM-Prompt, kein Scrub |
| Matching-Engine & ML | Fragil | **Hoch** | v3.1 produktiv, aber 4 Versionen parallel; "ML" ohne Trainingsschleife; Vektorsuche tot |
| Fit-Assessment (KI) | Nicht ausgerollt | Mittel | Backend live & auto-getriggert; Client-Card im publizierten Frontend nicht enthalten |
| Pipeline (Submission→Placement) | Funktional | **Hoch** | Kern-Flow steht; dualer Placement-Pfad, zwei Scheduling-Systeme, Reminder feuern nie |
| Finanzen, Stripe & Payout | Defekt | **Kritisch** | Auszahlung verdrahtet, aber Einnahme-Seite fehlt → Escrow springt nie auf `held` |
| Integrationen | Funktional | **Hoch** | OAuth/E-Mail/Outreach gebaut; Webhooks signaturlos, Sandbox-Absender, kein Scheduler |
| Automation Engines | Funktional | Mittel | Influence-/Escalation-Engines via `pg_cron` aktiv; abhaengig von DB-Settings (GUCs) |
| Frontend & Design-System | Fragil | **Hoch** | Kein Code-Splitting; invertierte `darkMode`-Config; verifizierter Render-Loop |

---

### 0.4 Die 5 wichtigsten Staerken

1. **Konsistente, schlanke Architektur.** Ein Frontend-Pattern (Supabase-Client) + ein Backend (Supabase) + ein KI-Gateway (Lovable). Keine Microservice-Zersplitterung, keine eigene Server-Flotte — das senkt Betriebslast und macht das System fuer ein kleines Team beherrschbar.

2. **Durchgaengige ereignisgetriebene Verdrahtung.** Das Muster DB-Trigger → `pg_net`/`pg_cron` → Edge Function → DB-Write zieht sich konsistent durch (Auto-Fit-Assessment, Influence-/Escalation-Engines, ML-Datenerfassung). Kern-Automationen laufen bereits ohne manuelles Zutun.

3. **Reicher, funktionsfaehiger Produkt-Kern.** Der gesamte Pipeline-Flow (Submission → Interview → Offer → Placement) inkl. Token-Portalen fuer Kandidaten, Honorar-/Escrow-Berechnung und ML-Feedback-Erfassung ist gebaut und im Backend lauffaehig — die Plattform ist deutlich mehr als ein Prototyp.

4. **Klares, sauber getrenntes Rollen- und Datenmodell.** `user_roles` ist bewusst von `profiles` getrennt (Privilege-Escalation-Schutz im Design), `has_role()` ist die einzige Autorisierungs-Quelle, und der Hub `submissions` buendelt fast die gesamte operative Logik per FK — eine wartbare Grundstruktur.

5. **Differenzierendes Produktkonzept.** Triple-Blind + erfolgsbasiertes Honorar + KI-Eignungsgutachten ist ein echter Markt-USP. Die fachliche Idee ist konsistent durchdacht; die Luecken liegen in der Durchsetzung, nicht im Konzept.

---

### 0.5 Die 5 groessten Risiken / Luecken

1. **Live-Publish-Gap (verifiziert) — Backend aktuell, Frontend veraltet.** Lovable koppelt Git-Push und Backend-Migration NICHT an den Live-Deploy; "Publish" ist ein manueller Klick. Folge: **matchunt.ai ist ein aelterer Build ohne Fit-Analyse, Trust-Gate und Task-Inbox**, waehrend Backend-Trigger und Cron diese Features bereits produktiv feuern. Funktionalitaet ist im Backend live, im Frontend unsichtbar — auto-generierte Assessments sammeln sich (und kosten LLM-Geld), ohne dass ein Nutzer sie sieht. *Sofort: Publish in den Release-Prozess aufnehmen, Versions-/Commit-Hash im UI sichtbar machen, neue Backend-Features hinter Feature-Flags legen.*

2. **Triple-Blind ist nicht erzwungen — der USP ist technisch umgehbar.** Die Anonymisierung lebt ausschliesslich client- bzw. prompt-seitig; **RLS liefert Kandidaten-PII und echte Arbeitgebernamen an Clients vor jedem Opt-In, und den Firmennamen an Recruiter vor dem Reveal** — beides per DevTools/Network-Tab sichtbar und im direkten Widerspruch zum Marketing-Claim. *Sofort: PII erst nach Reveal ueber SECURITY-DEFINER-Views/RPCs ausliefern, Reveal-Flags in die RLS-Bedingungen ziehen, Firmenname serverseitig aus AI-Output scrubben.*

3. **Auth-Privilege-Escalation — jeder kann sich Admin geben.** `handle_new_user()` uebernimmt die Rolle ungeprueft aus client-kontrollierten Signup-Metadaten, und die Policy *"Users can insert their own role"* erlaubt jedem User, sich selbst `admin` in `user_roles` zu schreiben. Zusaetzlich sind `suspended`/`verified` wirkungslos (nirgends erzwungen). *Sofort: Trigger auf `client`/`recruiter` whitelisten und `admin` ablehnen, die offene Insert-Policy entfernen, Suspend/Verify in `ProtectedRoute` und RLS durchsetzen.*

4. **Einnahme-Seite fehlt — der Geldfluss ist blockiert.** Es existiert **kein Code, der Rechnungen erzeugt oder einen Stripe-PaymentIntent/Checkout fuer den Client anlegt**. Dadurch wird `invoices.stripe_payment_intent_id` nie gesetzt, der Webhook feuert nie, `escrow_status` bleibt auf `pending`, und der regulaere Auszahlungsfluss ist ohne manuelle DB-Eingriffe vollstaendig blockiert. Verschaerfend: ein clientseitig manipulierbarer Auszahlungsbetrag und drei divergierende Placement-Pfade (zwei davon fehlerhaft). *Sofort: `create-invoice`/Checkout-Function ergaenzen, Payout-Betrag serverseitig aus `placement.recruiter_payout` ableiten, Placement-Erzeugung auf einen Pfad konsolidieren.*

5. **Defekte Such-/Match-Foundation + strukturelle Frontend-Fragilitaet.** Die semantische Suche ist tot (`generate-embeddings` schreibt 64-dim Vektoren in eine `vector(1536)`-Spalte; keine Match-Version nutzt Embeddings ueberhaupt), das Matching laeuft in **vier parallelen Versionen** mit divergierenden Scores, und die "ML"-Schleife sammelt nur Daten ohne zu lernen. Im Frontend invertiert eine fehlerhafte `darkMode`-Config alle 314 `dark:`-Varianten, und ein verifizierter Render-Loop (*Maximum update depth exceeded*) sitzt in fragilen Effekt-Dependencies. *Sofort: Embedding-Dimension/Modell angleichen oder Vektorsuche entfernen, v3.1 als Single Source of Truth festlegen, `darkMode`-Config korrigieren, Loop per Profiler einkreisen.*

---

### 0.6 Querschnitts-Risiko: Backend-Drift durch zwei Git-Linien

Unabhaengig von den fuenf Punkten oben besteht ein **organisatorisches Grundrisiko**: Zwei parallele Repos — `hire-speedy-ai` (aktiv) und `matchunt-platform` (eingefroren Feb 2026) — teilen sich **dasselbe** Supabase-Projekt `dngycrrhbnwdohbftpzq` (identische `project_id`) ohne technischen Schutz gegen widerspruechliche Migrationen oder Deploys. Zusaetzlich ist `.env` mit `VITE_SUPABASE_URL` und anon-Key im Git eingecheckt, was das gesamte Sicherheitsgewicht implizit auf RLS + `verify_jwt` verschiebt. *Empfehlung: kanonisches Repo festlegen und dokumentieren, `matchunt-platform` vom Backend entkoppeln/archivieren, `.env` aus Historie entfernen und Keys rotieren.*

---

### 0.7 Fuehrungs-Fazit

Matchunt hat ein **starkes Konzept und einen ueberraschend vollstaendigen Backend-Kern**, aber die Plattform ist heute **nicht release-reif**: Der USP (Triple-Blind) ist technisch umgehbar, der Auth-Layer erlaubt Selbst-Promotion zum Admin, der Geldfluss ist blockiert, und das, was im Backend laeuft, ist im Live-Frontend gar nicht sichtbar. Die gute Nachricht: Es sind ueberwiegend **gezielte, abgrenzbare Korrekturen** (RLS-Durchsetzung, eine Checkout-Function, Trigger-Whitelist, Embedding-/Theme-Fix, Publish-Disziplin) — kein Architektur-Umbau. Priorisierung in dieser Reihenfolge: **(1) Auth & Triple-Blind absichern → (2) Geldfluss schliessen → (3) Publish-Gap & Drift beseitigen → (4) Such-/Match- und Frontend-Stabilitaet.**
