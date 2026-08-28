# Recruiter-Dashboard → Deal-Cockpit: Widget-Plan

> Stand: 2026-07-18 · Ergänzt RECRUITER_DASHBOARD_GODMODE_ANALYSE.md (Abschnitt 3.1)
> Auslöser: Live-Screenshot des Dashboards — Aufgaben-Widget zeigt „Alles erledigt", während 3 Einreichungen unbeantwortet liegen und 8 Kandidaten im Interview-Stage stehen.

---

## 1. Der Headhunter-Blick auf den Ist-Zustand

Was ein Headhunter morgens wissen will, in dieser Reihenfolge:
1. **Welche Termine habe ich heute — und bin ich (und mein Kandidat) vorbereitet?**
2. **Welcher Deal stirbt gerade, wenn ich nichts tue?** (unbeantwortete Einreichungen, ausstehende Debriefs, kippende Kandidaten)
3. **Wo ist der schnellste Weg zum nächsten Abschluss?** (Interviews → Offers konvertieren schlägt alles andere)
4. **Für welche neuen Jobs habe ich bereits passende Kandidaten?**
5. Erst danach: Bestandszahlen.

Der Screenshot gegen diese Brille:

| Widget | Ist | Problem aus Headhunter-Sicht |
|---|---|---|
| Aufgaben | „Alles erledigt – Zeit, neue Kandidaten einzureichen!" | **Dreifach falsch.** (a) 3 Einreichungen ohne Client-Reaktion = 3 Nachfass-Aufgaben. (b) 8 Interviews = Prep, Debriefs, Client-Feedback — nichts davon erscheint. (c) Die Empfehlung „neue Kandidaten einreichen" ist die *schwächste* Aktion (~10 % Closing) während 8 Deals bei ~40–65 % Closing Betreuung brauchen. Das Widget optimiert Aktivität statt Abschluss. |
| Pipeline | 4 Balken (3/0/8/0), „Erwartbar €38.470 (€0–€123k)" | Bestände statt Deals. Ein Headhunter denkt in Namen, nicht in Balken: *Wer* hängt *wie lange* wo? 0 Angebote bei 8 Interviews ist die wichtigste Anomalie der Seite — wird nicht thematisiert. Spanne €0–€123k ist informationsfrei. Keine Bewegung sichtbar (was hat sich seit gestern getan?). |
| (Interviews) | Im Screenshot leer/nicht sichtbar | Termine sind das Top-Element eines Recruiter-Morgens. Filter nur `status='scheduled'` verschluckt pending-Opt-In-Termine; Sektion ist unter der Pipeline versteckt. |
| Top Jobs | 4 neueste Jobs mit €-Potenzial | Falsches Sortierkriterium. Ein Job ist für mich nur so viel wert wie mein bester Kandidat dafür. „Habe ich jemanden dafür?" wird nicht beantwortet. (Nebenbefund: „teststadt" = Testdaten im Live-Stand.) |
| Übersicht | 20 Jobs / 37 Kandidaten / 11 Pipeline / **Verdient €0** | Vanity-Zähler ohne Handlung. „Verdient €0" prominent grün gerahmt ist demotivierend — und bleibt wegen des defekten Payout-Flows auf absehbare Zeit €0. Die 3 Buttons duplizieren die Sidebar. |
| Greeting | „Alles erledigt – Zeit, neue Kandidaten einzureichen!" | Subtext hängt am leeren Alert-Widget und gibt darum die falsche Tagesempfehlung. |

## 2. Code-Ursache (verifiziert)

1. **Das Aufgaben-Widget hört auf die falsche Quelle.** `RecruiterDashboard` nutzt `useInfluenceAlerts` (nur `influence_alerts`). Es existiert aber bereits `useUnifiedTaskInbox` (376 Z., von `RecruiterInfluence` genutzt): merged Alerts + manuelle Tasks, liefert Kandidatenname/Telefon/E-Mail, Job, Firma, `impact_score`, Snooze, Playbook-Verknüpfung, Kategorien-Mapping.
2. **Die Engine hat blinde Flecken.** `influence-engine` (Cron */15) erzeugt genau 8 Alert-Typen: `opt_in_pending_48h/24h`, `interview_prep_missing`, `interview_reminder`, `salary_mismatch`, `ghosting_risk`, `engagement_drop`, `closing_opportunity` (supabase/functions/influence-engine/index.ts:425-537). **Es fehlen:** „Client reagiert nicht auf Einreichung", „Interview vorbei, Debrief fällig", „Offer anstoßen". Die Interview-Typen hängen zudem an `candidate_behavior`-Daten, die oft leer sind → Widget bleibt leer trotz voller Pipeline.
3. **„Hängt seit X Tagen" ist heute nicht messbar.** `submissions` hat kein `stage_changed_at`. Ohne das kann keine Stalled-Regel sauber feuern. (Verzahnung: Die geplante Stage-Transition-RPC aus der Godmode-Roadmap Welle 1 ist der natürliche Ort, diesen Zeitstempel zu schreiben.)

## 3. Ziel-Bild: Das Deal-Cockpit

Leitprinzip: Das Dashboard beantwortet **eine** Frage — *„Was ist jetzt die Aktion mit dem höchsten €-Impact?"* Jede Aufgabe = Kandidat + Kontext + Grund + 1-Klick-Aktion + €-Wert.

```
┌────────────────────────────────────────────────────────────────┐
│ Guten Tag, Marko — 8 Interviews laufen, 2 brauchen heute       │
│ ein Debrief. Nächster erwarteter Abschluss: ~€11k              │
├──────────────────────────────┬─────────────────────────────────┤
│ HEUTE (Termine + Prep)       │ NÄCHSTE AKTIONEN (Unified Inbox)│
│ 14:00 M. Weber → Sr. AI Arch.│ 🔴 3 Einreichungen ohne Client- │
│   Prep ✓ · Link · Briefing   │    Reaktion seit 4 Tagen        │
│ 16:30 T. Braun → Data Eng.   │    → [Nachfassen] je ~€15k      │
│   Prep ⚠ fehlt → [Vorbereiten]│ 🟠 Debrief K. Maier fällig      │
├──────────────────────────────┤    → [Anrufen] [Notiz]          │
│ PIPELINE (Deals, nicht Balken)│ 🟡 Opt-In S. Kranz offen 36h    │
│ Interview (8) ▾  2 stalled 🔴│    → [Erinnern] [Snooze]        │
│  K. Maier · 9 T. o. Bewegung ├─────────────────────────────────┤
│ Eingereicht (3) ▾ alle >3 T. │ JOBS MIT DEINEN KANDIDATEN      │
│ Erwartbar €38k (aus KI-Probs)│ Data Eng. — 2 Kand. ≥80 %       │
│ Seit gestern: 1 → Interview  │    → [Quick-Submit] €16k        │
├──────────────────────────────┴─────────────────────────────────┤
│ MOMENTUM: Woche 4 Subs (+2) · 3 Interviews (+3) · 0 Offers (→) │
│ Trust: Silber — noch 2 Placements bis Gold                     │
└────────────────────────────────────────────────────────────────┘
```

## 4. Umsetzungsplan (Phasen, einzeln freigebbar)

### Phase 1 — Aufgaben-Widget auf UnifiedTaskInbox umstellen (~0,5–1 Tag)
- `RecruiterDashboard`: `useInfluenceAlerts` → `useUnifiedTaskInbox` (gleiche Quelle wie `/recruiter/influence` — eine Wahrheit, Vorgriff auf die beschlossene Inbox-Konsolidierung).
- Zeilen-Layout: Prio-Punkt · Kandidat → Job @ Firma (Triple-Blind-konform via `formatAnonymousCompany`) · Grund · €-Wert · Aktionen [Anrufen] [E-Mail] [Erledigt] [Snooze] (Telefon/E-Mail liefert der Hook bereits).
- Sortierung `priority × impact_score × dueAt` statt created_at.
- Ehrlicher Empty-State: „Alles erledigt" nur, wenn auch keine offenen Deals Betreuung brauchen; sonst Fallback „N Jobs passen zu deinen Kandidaten" (Link Matching).
- Greeting-Subtext an die tatsächliche Top-Aufgabe koppeln.

### Phase 2 — Blinde Flecken der Engine schließen (~1–2 Tage) ⭐ der eigentliche Fix
Neue Regeln in `influence-engine` (idempotent via bestehendem UNIQUE `submission_id+alert_type`):
- `client_review_stalled`: Submission in submitted/reviewing > 3 Werktage ohne Übergang → „Beim Client nachfassen" (Prio high, €-Wert = potenzielle Fee).
- `interview_debrief_due`: Interview `scheduled_at` < jetzt, binnen 24 h kein Feedback/keine Aktivität → „Debrief Kandidat + Client-Feedback einholen".
- `offer_push`: Deal > X Tage im Interview-Stage bzw. nach 2. Interview ohne Offer → „Angebot anstoßen".
- Kategorien in `useUnifiedTaskInbox.FILTER_CATEGORIES` ergänzen.
- **Voraussetzung Stalled-Messung:** `stage_changed_at` auf `submissions` (kleine Migration; ab Welle 1 von der Transition-RPC gepflegt). Übergangsweise Ableitung aus `candidate_activity_log`, falls Migration warten soll.
- Ergebnis: Der Screenshot-Zustand (volle Pipeline + „Alles erledigt") wird strukturell unmöglich.

### Phase 3 — Pipeline-Widget: Deals statt Balken (~1–2 Tage)
- Stages aufklappbar → Deals mit Name, Job, Tage-in-Stage, Stalled-Flag (rot ab Schwelle).
- „Heute"-Block (Interviews heute/morgen) an die Spitze der Seite; Filter erweitert (`scheduled` + `pending_opt_in`), Prep-Status + Meeting-Link, „+N weitere" statt hartem Limit 3.
- Erwartbar-Wert: `candidate_behavior.closing_probability` pro Deal, Stage-Default nur als Fallback; €0–€123k-Spanne ersetzen (P10–P90 oder weglassen).
- „Seit gestern"-Zeile (Bewegungen aus activity_log).

### Phase 4 — Top Jobs → „Jobs mit deinen Kandidaten" (~1–2 Tage)
- Nächtlicher Batch-Match (calculate-match-v3-1) aktive Kandidaten × neue Jobs → Cache-Tabelle; Dashboard liest nur.
- Karte: „2 Kandidaten ≥80 %" + [Quick-Submit]; Sortierung Match-Chance > Fee > Neuheit; Urgent gepinnt.

### Phase 5 — Übersicht → Momentum (~0,5–1 Tag)
- Woche-vs-Vorwoche (Submissions/Interviews/Offers) + Trust-Level-Fortschritt („2 Placements bis Gold").
- „Verdient €0" entfernen, solange der Payout-Flow tot ist → „Pipeline-Wert"; nach Geldfluss-Fix: „nächste erwartete Auszahlung".
- Die 3 Sidebar-Duplikat-Buttons streichen.

## 5. Abgrenzung & Verzahnung
- Phasen 1–2 sind unabhängig vom großen Stage-Modell-Umbau lauffähig (nur `stage_changed_at` überschneidet sich — bewusst so gebaut, dass die spätere Transition-RPC ihn übernimmt).
- Phase 4 wartet nicht auf den Match-Marktplatz (Welle 4 der Godmode-Roadmap), sondern ist dessen erster Baustein.
- Kein i18n-Retrofit in diesen Phasen; neue Komponenten bekommen aber direkt i18n-Keys (beschlossene Regel).

## 6. Offene Entscheidungen
1. Start mit Phase 1+2 im Paket? (Empfehlung: ja — behebt exakt den Screenshot-Fehler.)
2. `stage_changed_at` sofort als Mini-Migration oder übergangsweise aus dem Activity-Log ableiten? (Empfehlung: Mini-Migration, die RPC übernimmt sie später.)
3. Batch-Match per nächtlichem Cron + Cache-Tabelle statt Live-Berechnung pro Dashboard-Load? (Empfehlung: Cron — Kosten & Latenz.)
