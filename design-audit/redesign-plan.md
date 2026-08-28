# Redesign-Plan: Bewerber-Seite → Entscheidungs-Inbox

**Stand:** 2026-07-11 · **Status:** Approved (interaktiver Prototyp v2 im Chat = visuelle Spec) · **Scope:** `/dashboard/candidates`, restliche Screens später einzeln.

## Gelockte Entscheidungen

1. Konzept „Entscheidungs-Inbox": Kopfzeile = Zuständigkeits-Bilanz, Default-Tab „Neu", Master-Detail, EINE stage-abhängige Primäraktion, Status-Pills Wort+Farbe.
2. Nur Inbox-Ansicht — Grid-/List-View entfallen.
3. Interview 1+2 im UI zu „Interview" zusammengefasst (Datenmodell unverändert).
4. Hell als Default-Theme für Clients (Dark bleibt wählbar).
5. Archiv als abgesetzter Tab: Abgelehnte / Eingestellte / Zurückgezogene / Abgelaufene. Kein stilles Unreject — Aktion: „Recruiter um erneute Ansprache bitten".
6. „In Prüfung" ersetzt „Screening"; Rolle statt PR-Code als Identität (Code bleibt Referenz).
7. AGG-sicherer Ablehnen-Dialog (nur stellenbezogene Gründe, `culture_fit` entfällt), Absage-Versand mit 60-s-Verzögerung für echtes Undo.
8. Team-Notizen (candidate_comments) mit @Mentions im Detail-Panel; Entscheidungs-Doku (wer/wann/warum).
9. Eskalationsfarben (gelb ≥7 d, rot ≥21 d) NUR wenn der Kunde am Zug ist; sonst neutrale „Wartet auf …"-Pille.
10. Mobile: Drill-down (Liste → Vollbild-Detail) + Bottom-Nav (neu, heute existiert keine mobile Navigation).

## Tab-Mapping (zentral, ersetzt Legacy-Filter)

| Tab | stage-Werte | bzw. status |
|---|---|---|
| Neu | `new`, `submitted`, null/unbekannt | — |
| In Prüfung | `screening`, `shortlisted`, `in_review`, `qc_review` | — |
| Interview | `interview_requested`, `candidate_opted_in`, `interview`, `interview_1`, `interview_2`, `interview_scheduled`, `second_interview`, `interview_counter_proposed` | — |
| Angebot | `offer` | — |
| **Archiv** | (stage `hired`/`placed`) | `rejected`, `client_rejected`, `withdrawn`, `expired`, `hired`, `placed` |

Status hat Vorrang vor Stage. „Alle" = alle Nicht-Archiv.

## Inkremente (jeweils: implementieren → Screenshots → Design-Critic → Before/After an User → Go)

1. **Datenfundament** — `useBewerber` neu: Tab-Mapping statt Legacy-Stages, Archiv-Gruppe sichtbar (Zombie-Fix: withdrawn/expired/client_rejected raus aus Aktiv), `identity_unlocked`+`full_name` gemappt, Limit 200 + ehrlicher „x von y"-Zähler, Tabs/Kopfzeile in der Page, Grid/List-Ansicht entfernt, Archiv-CTA-Gating im Preview-Panel. Neue Strings via i18n (`bewerber.*`).
2. **Liste & Pillen** — Karten-Redesign (Rolle als Titel, Status-Pille pro Zustand, Zuständigkeits-Sektionen „Sie sind am Zug / Wartet auf andere"), Interviews+Offers-Join für Zustands-Pillen (pending_response/counter_proposed/declined/completed; sent/viewed/negotiating).
3. **Detail-Panel** — Entscheidungs-Kopf, eine Primäraktion pro Zustand, CTAs verdrahten (Interview-Wizard + Rejection-Dialog in der Inbox nutzbar), Chips inkl. Gehaltsband immer sichtbar + Schloss nur für exakte Angabe, KI-3-Bullets, Team-Notizen, Rückfrage an Recruiter.
4. **Ablehnen-Flow v2** — AGG-Grundliste, korrekter `rejection_stage`, Duplikat-Scope-Zeile, 60-s-Versand-Queue (Edge Function `process-rejection`), Archiv-Eintrag mit wer/wann/Grund.
5. **Archiv-Detail** — Entscheidungs-Doku-Zeile, „Recruiter um erneute Ansprache bitten"-Flow, neutraler Aufbewahrungs-Hinweis.
6. **Empty States + i18n-Vollmigration + Copy-Pass** (Umlaute, „Wahlen Sie" etc.).
7. **Mobile** — Drill-down-Layout + Bottom-Nav (Flag: Bottom-Nav berührt DashboardLayout global).
8. **Hell-Default für Clients** (Flag: Theme-Init berührt App-Ebene).

## Backend-Fixes (Pflicht, aus Kritiker-Findings)

- K1 Zombie-Status: `withdrawn`/`expired`/`client_rejected` aus Aktiv-Liste (Inkrement 1).
- K2 Legacy-Tab-Filter → zentrales Mapping (Inkrement 1).
- K3 Undo-Attrappe: 60-s-Versand-Delay in `process-rejection` (Inkrement 4).
- K4 Wartezeit ab Kunden-Zug statt `submitted_at`; Eskalation nur bei turn=me (Inkrement 2; sauber: `stage_changed_at`-Spalte + Trigger, bis dahin Approximation).
- K5 Zähler-Lüge ab 51: Limit 200 + exakter Count (Inkrement 1), serverseitige Suche/Sortierung später.
- K7 „Feedback fällig" = Interview `completed` ohne Folgeentscheidung (Inkrement 2), Drei-Wege-Feedback-Dialog (Inkrement 3+).
- K8 Rollen: `hiring_manager` → „Ablehnung vorschlagen" statt Ablehnen; Viewer read-only (Inkrement 3/4).
- W5/W6 AGG: `culture_fit` entfernen, `rejection_stage` dynamisch (Inkrement 4).
- W8 Kein Löschfristen-Versprechen im UI, bis Automatik existiert (separates Ticket: 6-Monate-Löschjob, Begründung §15 AGG + §61b ArbGG).
- Offen zu klären: RLS auf `rejections` für Client-Lesezugriff (wer/wann/Grund im Archiv), `full_name`-Anzeige nach Opt-In.

## Kann-Liste (bewusst nicht in v1)

Bulk-Aktionen, Kandidaten-Vergleich auf dieser Seite, Talent-Pool mit Einwilligung, Nurture-Mails, Erinnerungs-Automatik an Kandidaten.

## Verifikation

Pro Inkrement: Playwright-Screenshots (Desktop 1440 + Mobile 390, hell/dunkel) nach `design-audit/screenshots/bewerber-v2/`, Design-Critic-Subagent gegen diese Spec + Zero-Training-Bar (pass/fail), Before/After an den User. Referenz-Screenshots „Before": `design-audit/screenshots/bewerber/`.
