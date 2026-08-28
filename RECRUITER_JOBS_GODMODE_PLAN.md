# RecruiterJobs → Champions League: Feature- & Redesign-Plan

> Stand: 2026-07-18 · Ergänzt RECRUITER_DASHBOARD_GODMODE_ANALYSE.md (Abschnitt 3.2) und RECRUITER_COCKPIT_WIDGET_PLAN.md
> Auslöser: Live-Screenshot `/recruiter/jobs` — solide Basis (KPI-Strip, aktive Jobs, Tabs, Feed), aber die Seite beantwortet die Kernfrage des Headhunters nicht.

---

## 1. Die Kernfrage, die die Seite nicht beantwortet

Ein Headhunter wählt Jobs wie ein Investor Assets: **„Wo ist die höchste Abschlusswahrscheinlichkeit pro investierter Stunde?"** Dafür braucht er pro Job vier Informationen — keine davon steht heute auf der Karte:

1. **Habe ich passende Kandidaten?** (Match) — wichtigstes Kriterium, komplett abwesend.
2. **Reagiert dieser Client überhaupt?** (Antwortzeit, Feedback-Quote, Interview→Offer-Konversion) — Headhunter hassen Black-Hole-Submissions; heute unsichtbar.
3. **Wie ist meine Konkurrenzsituation?** („1 · 20 %" und „Erster! 0 %" sind kryptisch — Recruiter-Zahl und Pipeline-Füllstand ohne Erklärung).
4. **Lebt der Job noch?** — Meine aktiven Jobs zeigen „vor 5 Monaten" mit Stage „Opt-In"/„Angefr.": das ist ein Friedhof, kein aktives Portfolio. Kein Stale-Signal, kein Hinweis, den knappen Trust-Level-Slot freizugeben.

Weitere Screenshot-Befunde:
- Tab „Top 20" bei 20 Jobs gesamt = filtert nichts; „Neu 0" bei 5–6 Monate alten Jobs = Marktstillstand ohne Einordnung.
- Filter-Dropdowns dreimal „Alle" ohne Beschriftung (Remote/Level/Branche nicht erkennbar).
- Keine Skills, keine Gehaltsspanne, kein Fee-% auf der Karte → jede Bewertung erfordert Klick ins Panel.
- Keine Sortierung wählbar; Dringend nur Badge statt gepinnt; „teststadt" = Testdaten im Live-Stand.

## 2. Was schon da ist (Ausbau statt Neubau)

| Baustein | Status | Nutzen für diesen Plan |
|---|---|---|
| `useJobSubmissionStats` | liefert bereits submissionCount + recruiterCount pro Job | Konkurrenz-Anzeige = nur UI-Arbeit |
| `calculate-match-v3-1` | Batch-Match Kandidat × 50 Jobs, Triple-Blind-konform | Motor für den Match-Layer |
| `recruiter_trust_levels` | max_active_slots, active_count | Slot-Kapital-Anzeige |
| `recruiter_job_activations` | has_submitted, first_submission_at | Stale-Erkennung aktiver Jobs |
| Submissions-Timestamps | submitted_at vorhanden, `stage_changed_at` fehlt | Client-Antwortzeit (Synergie: Migration aus Cockpit-Plan Phase 2) |

## 3. Umsetzungsplan (Phasen, einzeln freigebbar)

### Phase A — Karten-Intelligenz & Feed-Hygiene ✅ GEBAUT 2026-07-19

> Umgesetzt: `JobActionCard` neu (Gehalts-Chip, Top-3-Skills, Fee-% unter dem €-Wert, lesbare Konkurrenz „N Recruiter · M Einreichungen" bzw. „Noch kein Recruiter — Erster!", Frische „Aktiv vor X" aus updated_at; kryptischer Pipeline-%-Balken entfernt). Filter beschriftet („Remote/Level/Branche: alle"), Sortier-Dropdown (Neueste / Höchste Fee / Wenig Konkurrenz), Dringend-Jobs gepinnt, Tab „Top" = echte Top-10 nach Fee, „Neu" = 14-Tage-Fenster, Mobile-Preview als Sheet. Im Preview verifiziert (Desktop + Mobile 375px).
> Dazu: Repair-Migration `20260719120000_fix_activation_count_repair.sql` (Trigger für active_count neu + Delete-Gegenstück für Phase D + Backfill) — **noch nicht deployed**; bis dahin greift ein Frontend-Fallback (effectiveActiveCount aus echten Aktivierungen) für Slot-Anzeige und Limit-Check.
- **Karten-Redesign:** Skills-Chips, Gehaltsspanne, Fee-% + €-Wert, Konkurrenz lesbar („2 Recruiter · 4 Einreichungen" statt „1 · 20 %"), Job-Frische („Aktivität vor 2 T" aus updated_at/Submissions).
- Filter beschriften, Sortier-Control (Beste Chancen / Höchste Fee / Neueste), Dringend-Jobs oben gepinnt.
- Tab-Logik fixen: „Top" = echte Top-N nach Fee, „Neu" mit 14-Tage-Fenster; Testdaten raus.
- Mobile: Preview-Panel als Sheet statt versteckt.

### Phase A.2 — Aktivierungs-Dialog 2.0 ✅ GEBAUT 2026-07-19 (Match-Vorschau folgt mit Phase B)

> Umgesetzt: Zwei-Schritt-Dialog in `ActivationConfirmDialog.tsx` (Business-Case-Chips, Slot-Anzeige, Spielregel-Box statt Drohung; Schritt 2 mit Firmen-Reveal + Top-3-Kandidaten + Quick-Submit), `initialCandidateId`-Prop in `CandidateSubmitForm.tsx`, Quick-Submit-Dialog in `RecruiterJobs.tsx`. Schritt 1 im Preview verifiziert; Schritt 2 typgeprüft (Live-Test erfordert echte Aktivierung).
> ⚠ Dabei gefunden: `recruiter_trust_levels.active_count` steht auf 0 trotz 5 Aktivierungen → das Slot-Limit greift nie (Zähler wird beim Insert in `recruiter_job_activations` nicht gepflegt). Fix gehört zu Phase D / Backend.

Der Flow „Job aktivieren → Bestätigungsfenster → Kandidaten einreichen" existiert (`ActivationConfirmDialog.tsx`), ist aber als **Drohung statt als Verkaufsmoment** gebaut: Amber-Warnung „kann nicht rückgängig gemacht werden", Pflicht-Checkbox, und nach der Bestätigung schließt der Dialog ins Leere — der Recruiter muss den Einreichen-Button selbst suchen. Kein Business-Case (Fee, Dringlichkeit, Konkurrenz), keine Match-Vorschau, und die Unumkehrbarkeit erzeugt genau den Aktive-Jobs-Friedhof aus dem Screenshot (5 Monate alte Slots ohne Ausweg).

**Umbau auf 2 Schritte:**
- **Schritt 1 — Commitment mit Business-Case:** Job + Anonym-Label, Chips (Fee ≈ €X, Dringlichkeit, „2 Recruiter aktiv"), Match-Vorschau („3 deiner Kandidaten passen, beste 87 %" — ab Phase B), Slot-Anzeige („belegt Slot 4/5"), und **klare Spielregeln statt Drohung**: „Ziel: erste Einreichung binnen 14 Tagen. Deine Aktivierungsquote zählt für dein Trust-Level." Checkbox + CTA bleiben (bewusstes Commitment ist richtig — Backend trackt `has_submitted`/`first_submission_at` bereits).
- **Schritt 2 — Reveal + sofortige Aktion:** Der emotionale Höhepunkt des Triple-Blind („Firma enthüllt: KNDS Group" mit Logo + Quick Facts) wird gefeiert statt in einem Nebensatz erledigt. Direkt darunter: die Top-3 passenden Kandidaten mit Score und [Einreichen]-Button (öffnet CandidateSubmitForm vorbefüllt). Sekundär: „Später einreichen → Job-Details". Kein toter Moment mehr zwischen Aktivierung und erster Submission.

### Phase B — Match-Layer „Für dich" (~2 Tage) ⭐ Killer-Feature
- Nächtlicher Batch-Match (aktive Kandidaten × published Jobs) → Cache-Tabelle `job_candidate_matches` (gleiche Infrastruktur wie Cockpit-Plan Phase 4 — einmal bauen, zweimal nutzen).
- Neuer Tab **„Für dich (N)"**: Jobs mit ≥1 Kandidat ≥75 %, sortiert nach bestem Match.
- Pro Karte Match-Zeile: „3 Kandidaten passen · beste 87 %" + [Einreichen]-Quick-Action (öffnet CandidateSubmitForm vorbefüllt).
- Standardsortierung des Feeds wird „Beste Chancen" (Match × Fee × Dringlichkeit).

### Phase C — Client-Response-Intelligence (~1–2 Tage)
- Abgeleitete Metriken pro Client/Job aus Submission-Historie: Ø Antwortzeit auf Einreichungen, Feedback-Quote, Interview→Offer-Konversion. (Präzise ab `stage_changed_at`-Migration; Übergang: submitted_at → erster Statuswechsel aus activity_log.)
- Anzeige auf Karte + JobDetail: „Client antwortet Ø 1,8 T · 82 % Feedback".
- Feed-Ranking-Faktor: langsame Clients werden abgewertet, der Recruiter investiert automatisch dort, wo Reaktion kommt.

### Phase D — Slot-Kapital & Portfolio-Pflege (~1 Tag)
- Header-Chip „3/5 Slots belegt"; aktive Jobs mit Stage-Zählern statt Einzel-Badge.
- Stale-Alarm auf aktiven Jobs („5 Monate ohne Bewegung") + „Slot freigeben"-Flow (Deaktivierung mit Grund).
- Slot-Empfehlung: „Dieser Slot bringt seit 90 T nichts — 2 ‚Für dich'-Jobs warten."

### Phase E — Merkliste, gespeicherte Suchen & Job-Alerts (~1–2 Tage)
- `job_watchlist`-Tabelle + Merken-Icon auf Karte + Tab „Merkliste".
- `saved_searches` + Alert bei neuem Treffer (Notification/Push): „Neuer FinTech-Job ≥90k in München".

## 4. Verzahnung
- Phase B teilt Cron + Cache mit Cockpit-Plan Phase 4 (dort „Jobs mit deinen Kandidaten"-Widget) — als ein Arbeitspaket bauen.
- Phase C hängt an derselben `stage_changed_at`-Mini-Migration wie Cockpit-Plan Phase 2.
- Neue Komponenten bekommen direkt i18n-Keys (beschlossene Regel); Designsprache = Client-Bento-Niveau.

## 5. Offene Entscheidungen
1. **Reihenfolge:** A → B → C → D → E? (Empfehlung: ja — A liefert sofort sichtbaren Sprung ohne neue Infrastruktur, B ist das Differenzierungs-Feature.)
2. **Client-Antwortzeiten offen zeigen?** Transparenz diszipliniert Clients und ist für Recruiter Gold — kann aber Client-Beziehungen belasten. (Empfehlung: ja, aber gebändert: „reagiert schnell / mittel / langsam" statt exakter Tage.)
3. **„Erster!"-Exklusivfenster als Produkt-Feature?** Z. B. 48 h Exklusivität für den Erst-Aktivierer eines Jobs — starker Aktivierungsanreiz, aber neues Geschäftsmodell-Element. (Entscheidung nötig, bevor die UI es verspricht.)
4. **Commitment-Regeln der Aktivierung:** Bleibt sie unumkehrbar, oder gibt es einen „Suche beenden"-Weg (Phase D), der in die Aktivierungsquote einfließt? Und: 14-Tage-Ziel für die erste Einreichung als kommunizierte Regel — mit automatischer Slot-Freigabe oder nur als Soft-Erwartung? (Empfehlung: Suche beendbar mit Quoten-Konsequenz + 14-Tage-Ziel als Soft-Regel, automatische Freigabe erst nach 30 Tagen Inaktivität.)
