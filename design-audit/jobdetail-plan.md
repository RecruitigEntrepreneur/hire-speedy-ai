# Umbau-Plan: Client-Job-Detailseite (/dashboard/jobs/:id)

Stand: 2026-07-16 · Konzept vom Nutzer freigegeben (Widget-Prototyp)
Basis: 3-Agenten-Research (Inventur, Adversarial-Kritik, HR-Workflow/JTBD)

## Gelockte Entscheidungen

1. **Konzept freigegeben:** Jobseite = job-gefilterte Kommandozentrale der Bewerber-Inbox
   (Zug-Banner + Funnel-Leiste + Engpass-Diagnose aus `useBewerber({jobId})`), Progressive
   Disclosure für Stelle/Konditionen/Team/Verlauf/Verwalten.
2. **Fee anzeigen: ja, aber rollenbasiert** — nur Hauptaccount (owner/admin, plus finance),
   NICHT hiring_manager/viewer/hr. Achtung: RLS liefert die ganze jobs-Zeile an alle
   Team-Mitglieder (kein Column-Level-Grant) → UI-Gating, echte Absicherung später.
3. **Kandidaten-Aktionen komplett raus** von der Jobseite: kein Stage-Dropdown, kein eigener
   Interview-/Ablehnen-Dialog, kein Vergleichs-Modal. Alle Entscheidungen laufen über die
   Bewerber-Inbox / CandidateDetail (sichere Flows, Opt-In-Gate). Schließt Triple-Blind-Bypass.
4. **Entwurfsphase bleibt** (folgt schon der Ziellogik); nur Stepper-Label angleichen
   („Besetzt" raus — Status ≠ Funnel).
5. **Eine Seite, zwei Zustände** (Entwurf/Live) — URL bleibt stabil.

## Bestandsanalyse: Was wird wiederverwendet (verifiziert)

| Baustein | Beleg | Verwendung neu |
|---|---|---|
| `useBewerber({jobId})` — Counts sind JOB-gefiltert | useBewerber.ts:239-241 (Filter vor Count-Berechnung 402-417) | Funnel-Leiste, Zug-Banner, Engpass-Diagnose |
| `tabOf()/computeState()/StatePill` | useBewerber.ts, BewerberStatusPill.tsx | Kandidaten-Zeilen + Diagnose-Regeln |
| `primaryActionFor()` | BewerberPreviewPanel.tsx:47-61 | Routing der Banner-Aktion |
| `useTeamData()` — Rollen owner/admin/hr/hiring_manager/viewer/finance | useTeamData.ts:7 | Fee-Gating + Team-&-Zugriff-Sektion |
| RLS `can_access_job()` auf jobs | Migration 20260710130000:441-449, 157-178 | Team-Lockout-Fix: `.eq('client_id')` einfach weglassen (JobsList.tsx:88-93 macht das schon so) |
| `useClientInterviewAgenda()` (inkl. Feedback-Feld) | useClientInterviewAgenda.ts:10-99 | Termine & Feedback-fällig (job-gefiltert, VERGANGENE inkl.) |
| `JobExecutiveSummary`, `InviteMemberDialog`, `JobEditDialog` | exklusiv in ClientJobDetail | bleiben (Akkordeons Stellendetails/Team, Bearbeiten) |
| Entwurfsphase (Zeilen ~554-809) | ClientJobDetail.tsx | bleibt fast unverändert |

## Wird gelöscht (alle exklusiv von ClientJobDetail verwendet, verifiziert)

- `ClientJobHero.tsx` (Stepper mit Schrittnummern ③④⑤, 5-Spalten-Stats, toter Boost-Button)
- `TopCandidatesCard.tsx` (4. Anonymisierungs-Schema „GR-5FB3", reveal-inkonsistent)
- `UpcomingInterviewsCard.tsx` (Dublette, „Kalender"-Button führt zur Command-Ansicht)
- `RecruiterActivityCard.tsx` (Kennzahl dauerhaft 0 — recruiter wird auf null gesetzt)
- `PipelineSnapshotCard.tsx` (kennt neue Stages nicht, Pseudo-Prozente)
- `NextStepsCard.tsx` (falsche Anweisungen bei closed, Schritt ohne Button)
- `CommunicationLogCard.tsx` (synthetischer Log, „Kandidat eingereicht: Kandidat...")
- `JobQualityScoreCard.tsx` (Score-Konkurrenz)
- `src/lib/jobPipelineStatus.ts` (nur von ClientJobHero + PipelineSnapshotCard importiert)
- In ClientJobDetail.tsx: handleStageChange, handleScheduleInterview, Inline-Reject-Dialog
  (inkl. „Keine Kulturpassung"/AGG), Interview-Dialog, Compare-Modal, alle
  `/dashboard/command`-Links
- `CandidateQuickView`/`CandidateCompareView` bleiben als Dateien (TalentHub nutzt sie),
  fliegen nur aus der Jobseite

## Neue Seite (Live-Phase) — Aufbau

1. **Kopf:** Breadcrumb · Titel + JobStatePill (computeJobState: aktiv/pausiert/besetzt/
   geschlossen; StatePill-Tonsprache) · Meta-Zeile (Firma, Ort, Modell, Gehaltsband,
   Live-seit) · „Verwalten"-Menü
2. **Zug-Banner (Engpass-Diagnose):** erste zutreffende Regel gewinnt, ein Satz + EINE Aktion:
   1. crit&me (≥21d / Feedback überfällig) → rot, „Jetzt entscheiden/Feedback geben"
   2. terminvorschlag/offer offen → gelb, „Vorschlag prüfen"
   3. myTurnCount>0 → Akzent, „Jetzt prüfen"
   4. 0 Submissions & >14d live → gelb, „Briefing schärfen" (lehrender Text)
   5. pausiert → neutral, „Reaktivieren" + Konsequenz-Klartext
   6. sonst → grün „Alles in Arbeit — letzter Vorschlag vor X Tagen", keine Aktion
3. **Funnel-Leiste:** Neu/Prüfung/Interview/Angebot + abgesetztes Archiv, Zahlen =
   `tabCounts`, Akzentpunkt = isMyTurn vorhanden, Klick →
   `/dashboard/candidates?job=<id>&tab=<tab>` (ClientBewerberPage bekommt useSearchParams)
4. **Termine & Feedback:** nächstes Interview + überfällige Feedbacks (rot), Quelle
   useClientInterviewAgenda job-gefiltert, PR-Code einheitlich aus useBewerber
5. **Akkordeons:** Stellendetails · Konditionen & Anonymität (Gehaltsband, Fee rollenbasiert,
   Reveal-Regel, „So sehen Recruiter Ihre Firma" auch live) · Team & Zugriff (Mitglieder +
   Collaborators + Einladen) · Verlauf (schlank) · Verwalten (Bearbeiten / Pausieren mit
   Konsequenz-Dialog / **Schließen-Flow neu** mit Grund)

## Inkremente (je mit Critic-Loop + Before/After-Screenshots)

- **J1 — Fundament & Sicherheit:** Team-Lockout-Fix (client_id-Filter raus),
  useBewerber({jobId}) einbinden, alle unsicheren Kandidaten-Aktionen + tote Features
  entfernen, /dashboard/command-Links ersetzen
- **J2 — Kopf, Zug-Banner, Funnel:** JobStatePill + computeJobState, Engpass-Diagnose,
  Funnel-Leiste, ClientJobHero ersetzen, Inbox-URL-Params (?job=&tab=)
- **J3 — Termine & Akkordeons:** Termine/Feedback-Block, Konditionen (Fee-Gating),
  Recruiter-Vorschau live, Team & Zugriff, Verwalten inkl. Schließen-Flow,
  Entwurfs-Stepper-Fix
- **J4 — i18n, Mobile, Critic:** komplette Copy nach de/en, 390px-Pass, Screenshots +
  Design-Critic-Abnahme

## Stand

- **J1 FERTIG (2026-07-16):** Team-Lockout-Fix, unsichere Aktionen entfernt (~300 Zeilen),
  Command-Links → Inbox, Inbox versteht ?job=&tab= Deep-Links. Im Preview verifiziert.
- **J2 FERTIG + Critic FAIL→PASS (2026-07-16):** src/lib/jobCockpit.ts (computeJobState,
  diagnoseJob-Kaskade, myTurnTabs), src/components/client/JobCockpit.tsx (JobStatePill,
  JobZugBanner, JobFunnel, JobWaitList), Live-Phase neu (max-w-4xl: Kopf+Pille+Meta,
  Banner, Funnel, WaitList, ExecutiveSummary), jobdetail.* i18n de+en. Alte Karten/Hero
  aus der Seite raus (Dateien werden nach J3 gelöscht). Critic-Pflicht-Fixes umgesetzt:
  Terminalzustände closed/filled (eigener Banner, kein "Live seit", kein Pausieren),
  i18n-Hardcodes der Live-Phase, useBewerber-Error-State mit Retry, Singular "1 Tag",
  dringend_* statt falschem "21 Tage" bei Absagen, feedback-Deeplink tab=interview.
- **Critic-Nice-to-haves (offen, für J4):** Touch-Targets ≥40px, sr-only-Text am
  Funnel-Punkt, severity/daysSince-Duplikate konsolidieren, jobsQuery im Hook abschaltbar,
  Funnel-Divider-Umbruch.
- **J3 FERTIG + Critic FAIL→PASS (2026-07-16):** JobDetailSections.tsx (JobTermineCard mit
  crit→warn→neutral-Reihung, JobKonditionen mit Fee-Gating, JobTeam via useTeamData,
  JobVerlauf, JobVerwalten mit Konsequenz-Dialogen + Schließen-Flow → status filled/closed
  + closed_reason/closed_at mit Missing-Column-Fallback), Migration 20260716120000 (nicht
  deployt), Akkordeon-Gruppe, Agenda job-gefiltert (useClientInterviewAgenda),
  candidateAnonCode() zentral (useBewerber/Agenda/CandidateDetail), Entwurfs-Stepper ohne
  "Besetzt", 8 alte Karten + jobPipelineStatus.ts GELÖSCHT. Critic-Pflicht-Fixes: Viewer-
  Gating (Verwalten/Bearbeiten/Banner-Aktionen versteckt), ehrliche Toasts via
  .select()-Verifikation (0-Zeilen-RLS-Updates → Fehler), Fee-Race (orgLoading abwarten),
  JobEditDialog-Lifecycle-Buttons entfernt (inkl. Freigabe-Bypass via "publish").
  Spawn-Tasks erstellt: fee_percentage Server-Gating (task_9527c7ea), Anonym-Code-
  Vereinheitlichung Alt-Dashboard (task_9e65d0e4).

## Offene Punkte / bewusste Grenzen

- „Live seit": ehrliches Datum klären (approved/published-Timestamp statt created_at,
  sonst zählt Draft-Zeit mit) — in J2 prüfen
- Fee-Gating ist UI-only (RLS gibt ganze Zeile); Column-Level-Absicherung = späteres Backend-Thema
- Vereinheitlichung der Anonymisierung außerhalb der Jobseite (TalentHub etc.) = eigener Task
- Echter Aktivitäts-Feed braucht Event-Tabelle → nicht in diesem Umbau
