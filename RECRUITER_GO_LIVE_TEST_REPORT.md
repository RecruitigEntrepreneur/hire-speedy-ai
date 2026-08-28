# Recruiter-Dashboard — Live-Testbericht & Go-Live-Readiness

**Datum:** 2026-07-25
**Methode:** Live-Durchklick im Preview (localhost:8080), eingeloggt als Recruiter (Marko Benko, 20 Jobs / 37 Kandidaten / 29 Submissions). Jede Seite geöffnet, Interaktionen getestet, Konsole + Netzwerk + Datenbank gegengeprüft.
**Nicht ausgelöst (bewusst):** Kontolöschung, DSGVO-Datenexport, Stripe-Konto-Anlage, echte Kandidaten-Einreichung — alles Aktionen mit Außenwirkung oder irreversibler Wirkung.

---

## 1. Ampel-Übersicht

| # | Seite | Route | Status |
|---|-------|-------|--------|
| 1 | Übersicht | `/recruiter` | 🟡 lädt, KPIs widersprüchlich |
| 2 | Aufgaben | `/recruiter/influence` | 🟢 stärkste Seite, kleine Inkonsistenzen |
| 3 | Interviews | `/recruiter/interviews` | 🔴 Doppel-Einträge, keine Reschedule-Aktion |
| 4 | Offene Jobs | `/recruiter/jobs` | 🔴 Anonymisierungs-Leck |
| 5 | Job-Detail | `/recruiter/jobs/:id` | 🟡 sehr gut gebaut, Anonymität durch Freitext ausgehebelt |
| 6 | Meine Kandidaten | `/recruiter/candidates` | 🟡 lädt, KPI „Aktive Jobs 0" falsch |
| 7 | Kandidaten-Detail | `/recruiter/candidates/:id` | 🔴 KI-Matching zeigt nie Treffer |
| 8 | Pipeline | `/recruiter/submissions` | 🔴 verliert Kandidaten, Layout-Overflow |
| 9 | Submission-Detail | `/recruiter/submissions/:id` | 🟡 gute Timeline, aber read-only |
| 10 | Talent Pool | `/recruiter/talent-pool` | 🔴 leer, kein Befüllungsweg |
| 11 | Verdienste | `/recruiter/earnings` | 🟡 lädt, Kette endet bei 0 |
| 12 | Auszahlungen | `/recruiter/payouts` | 🟡 Stripe nicht verbunden, zwei parallele Wege |
| 13 | Benachrichtigungen | `/recruiter/notifications` | 🟢 funktioniert |
| 14 | Nachrichten | `/recruiter/messages` | 🔴 kein Einstieg, faktisch tot |
| 15 | Profil | `/recruiter/profile` | 🟡 „verifiziert" ohne Pflichtdaten |
| 16 | Datenschutz | `/recruiter/privacy` | 🟡 Cookie-Defaults DSGVO-widrig |
| 17 | **Einstellungen** | `/recruiter/settings` | 🔴 **404 — Seite existiert nicht** |
| 18 | Integrationen | `/recruiter/integrations` | 🟢 fertig, nur nicht in Sidebar |
| 19 | Onboarding | `/recruiter/onboarding` | 🟢 leitet korrekt um |

**Rollentrennung:** `/admin/*` und `/dashboard/*` leiten den Recruiter korrekt zurück. ✅ Einzige Ausnahme: `/settings` (siehe P1-2).

---

## 2. P0 — Go-Live-Blocker

### P0-1 · Triple-Blind ist gebrochen — echte Firmennamen gehen an jeden Recruiter
Die Anonymisierung ist **rein kosmetisch im Frontend**. `src/pages/recruiter/RecruiterJobs.tsx:281` lädt `from('jobs').select('*')` — der Browser bekommt alle Spalten.

Live gegen die DB verifiziert:
- **20 von 20** veröffentlichten Jobs liefern `company_name` im Klartext (z. B. „FITSEVENELEVEN GmbH", „Bluewater & Bridge GmbH")
- **20 von 20** liefern `client_id`
- **7 von 20** liefern zusätzlich die exakte Büroadresse (z. B. „Altmarkt 10, 01067 Dresden")

Jeder Recruiter liest das mit zwei Klicks in den DevTools aus. Das UI zeigt brav „[Beratungsunternehmen, Immobilienwirtschaft]" — die Daten liegen daneben offen. Das ist das zentrale Produktversprechen und zugleich ein DSGVO-/Vertraulichkeitsproblem gegenüber den Kunden.

**Fix-Richtung:** Recruiter dürfen `jobs` nicht direkt lesen. Stattdessen eine reveal-gatede View oder Edge Function, die `company_name`, `client_id`, `office_address`, `office_lat/lng` serverseitig entfernt, solange kein Reveal vorliegt.

### P0-2 · „Aktiviert" wird wie „Enthüllt" behandelt
`RecruiterJobs.tsx:383–388`: `isJobRevealed()` liefert `true`, sobald der Job *aktiviert* ist — nicht erst, wenn der Kunde enthüllt hat. `getRevealedCompanyName()` greift dann direkt auf `jobs.company_name` zu.

Live sichtbar: Der Job „Data & Dashboard Engineer" erscheint in der Kachel oben anonymisiert als „[Beratungsunternehmen, …]", zwei Zentimeter darunter in der Liste im Klartext als **„AIS Management"** — und zählt nicht zu den 2 als „Enthüllt" markierten Jobs. Dieselbe Seite widerspricht sich selbst.

### P0-3 · Die Pipeline verliert Kandidaten
`RecruiterSubmissions.tsx:102–109` definiert die Kanban-Spalten mit den Keys `submitted, reviewing, interview_scheduled, interviewed, offer, hired, rejected`. Gruppiert wird in Zeile 244 nach `sub.status`.

Die tatsächlichen `status`-Werte in der DB sind aber nur: `rejected` (19), `interview` (8), `submitted` (2).

Ergebnis: Die **8 Kandidaten im Interview-Prozess fallen in keine einzige Spalte und verschwinden aus der Ansicht**. Die Spalten `reviewing`, `interview_scheduled`, `interviewed`, `offer`, `hired` sind strukturell immer leer. Der Header sagt „29 Kandidaten in Bearbeitung", sichtbar sind 2.

### P0-4 · Status und Stage laufen auseinander (Split-Brain)
Gemessen über die 29 Submissions des Recruiters:

| `stage` | Anzahl | | `status` | Anzahl |
|---|---|---|---|---|
| submitted | 13 | | rejected | **19** |
| interview_requested | 7 | | interview | 8 |
| candidate_opted_in | 4 | | submitted | 2 |
| rejected / client_rejected | 3 | | | |
| interview_1 | 1 | | | |
| offer | 1 | | | |

**19 Submissions tragen `status='rejected'`, aber nur 3 eine abgelehnte `stage`.** 16 Kandidaten sind also faktisch abgelehnt, während ihre Stage noch „eingereicht" oder „Interview angefragt" sagt.

Live im Submission-Detail sichtbar: `Status: interview` bei `Stage: candidate_opted_in`, während die Fortschrittsleiste auf „Opt-In" steht.

Weil verschiedene Widgets unterschiedliche Felder lesen (Dashboard und Kanban → `status`, KPI-Kacheln → `stage`), widersprechen sich die Zahlen quer durchs Produkt:

| Kennzahl | Ort A | Ort B |
|---|---|---|
| Angebote | Dashboard: **0** | Pipeline-KPI: **1** |
| Kandidaten in Pipeline | Dashboard: **10** | Pipeline-Header: **29** |
| Pipeline-Wert | Dashboard: **€37.450** | Pipeline-KPI: **~€145.9k** |
| Interview-Quote | Profil: **0 %** | Verdienste: **34,5 %** |
| Aktive Jobs | Dashboard: **5** | Kandidatenseite: **0** |

Solange das nicht vereinheitlicht ist, kann kein Headhunter der Oberfläche trauen — und keine Auswertung stimmt.

### P0-5 · Das KI-Matching liefert praktisch nie einen Treffer
Die Engine `calculate-match-v3-1` läuft und antwortet korrekt — aber die Gates multiplizieren sich gegenseitig kaputt. Beispiel aus dem Live-Call: `salary 0.3 × seniority 0.6 × techDomain 0.6 = 0.108`. Ein Fit-Score von 57 wird damit zu einem Gesamtscore von 7 → `policy: "hidden"`.

Batch über **4 Kandidaten × 20 Jobs = 80 Paare**:

| Policy | Anzahl |
|---|---|
| hidden | **76** |
| standard | 2 |
| maybe | 2 |
| **hot** | **0** |

Auf der Kandidatenseite steht deshalb „KI-Matching V3.1 — Keine passenden Matches gefunden", selbst bei einem Senior-Vertriebler mit 25 Jahren Erfahrung. Das Kernversprechen des Produkts ist im Live-Zustand unsichtbar.

**Fix-Richtung:** Gates additiv/gewichtet statt multiplikativ, oder Dealbreaker-Faktoren nach unten begrenzen (Floor). Danach die Policy-Schwellen neu kalibrieren.

### P0-6 · Render-Endlosschleife auf jeder Seite
`Warning: Maximum update depth exceeded` — reproduzierbar bei jedem Reload, ausgelöst in `src/components/layout/NotificationBell.tsx:32`. Die Komponente sitzt im Layout-Header, betrifft also **alle** Seiten. Ein Reload erzeugt ~50 KB Konsolen-Ausgabe.

Wahrscheinliche Ursache: `useRealtimeNotifications` hat `useEffect(…, [user, fetchNotifications])`, wobei `fetchNotifications` von `user` abhängt und der `AuthContext`-Value bei jedem Render neu erzeugt wird (`auth.tsx:97`).

---

## 3. P1 — Vor Go-Live beheben

**P1-1 · „Einstellungen" führt auf jeder Seite in einen 404.** Die Sidebar verlinkt `settingsHref = '/recruiter/settings'` (`DashboardLayout.tsx:144`) — diese Route existiert in `App.tsx` nicht. Recruiter haben damit **überhaupt keine Einstellungen**: keine Benachrichtigungs-Präferenzen, keine Sprache, kein Passwortwechsel, kein 2FA.

**P1-2 · `/settings` rendert das Kunden-Dashboard.** `App.tsx:477` hängt `ClientDashboard` an eine `ProtectedRoute` ohne Rollenprüfung. Als Recruiter sieht man dort „Stelle ausschreiben" und ein KYC-Verifikationsbanner — mit Recruiter-Sidebar drumherum. Kundendaten leaken nicht (die Queries laufen auf `client_id = user.id` ins Leere), aber die Rollengrenze ist offen und das UI ist irreführend.

**P1-3 · Globale Suche (⌘K) ist für Recruiter funktionslos.** `GlobalSearch.tsx:70` sucht Jobs mit `.eq('client_id', user.id)`, Kandidaten über `client_candidate_view` — reine Kunden-Logik. Für einen Recruiter ist das Ergebnis strukturell immer leer. Live getestet: Suche nach „Buchhalter", während der Job „Buchhalter (m/w/d)" geöffnet war → „Keine Ergebnisse gefunden".

**P1-4 · Nachrichten sind eine Sackgasse.** `RecruiterMessages.tsx:69` baut Konversationen aus vorhandenen `messages`-Zeilen. Es gibt keinen „Neue Nachricht"-Button und keinen anderen Einstieg im Recruiter-UI — ein Recruiter kann also **nie** ein Gespräch beginnen, nur antworten. Nebenbefund: pro Konversation eine eigene `profiles`-Abfrage in der Schleife (N+1).

**P1-5 · Talent Pool ist leer und unbefüllbar.** 0 Einträge in allen Kategorien. Der Leerzustand sagt „Fügen Sie abgelehnte Kandidaten hinzu" — aber es gibt auf der Seite keinen Hinzufügen-Button, und die 19 abgelehnten Submissions fließen nicht automatisch ein.

**P1-6 · Interviews: keine Handlungsmöglichkeit, widersprüchliche Einordnung.** Alle 5 Einträge unter „Warten auf Terminierung" stehen auf „Slots abgelaufen", teils seit 5–6 Monaten. Die Terminvorschläge im Detail (3.2.–9.2.) liegen ein halbes Jahr in der Vergangenheit, Status weiter „Pending Response". Es gibt keine Aktion „neu terminieren" oder „eskalieren". Zusätzlich erscheint **Boris Becker gleichzeitig unter „Debrief fällig" und unter „Warten auf Terminierung"** — zwei sich ausschließende Zustände.

**P1-7 · Submission-Detail ist read-only.** Die Timeline ist wirklich gut. Aber es gibt keinen Weg, den Prozess von dort weiterzubewegen — kein Debrief erfassen, kein Termin neu vorschlagen, kein Status setzen. Der Recruiter sieht das Problem und kann nichts tun.

**P1-8 · Anonymisierung wird durch Freitext ausgehebelt.** Beim Job „Buchhalter" steht „Firma anonym", der Beschreibungstext nennt aber „über 30 exklusive Standorte im Rhein-Main-Gebiet", „Fitness und Lifestyle" und „Taunus-Blick". Der Kunde (FITSEVENELEVEN GmbH) ist damit in 10 Sekunden identifiziert. Eine technische Maskierung nützt nichts, solange der Fließtext ungeprüft durchläuft.

**P1-9 · Cookie-Einwilligungen stehen auf AN.** Unter Datenschutz → Einwilligungen sind **Analyse- und Marketing-Cookies standardmäßig aktiviert**. Nach DSGVO/TTDSG ist das opt-in-pflichtig, Default muss AUS sein. Angesichts der bereits investierten Arbeit an Impressum/Datenschutz/AGB ist das ein vermeidbares Risiko.

**P1-10 · „Verifizierter Recruiter" ohne Pflichtdaten.** Das Profil zeigt „Du hast alle erforderlichen Dokumente akzeptiert und bist als aktiver Recruiter freigeschaltet" — obwohl Telefon, Firmenname, Firmenadresse, Steuernummer/USt-IdNr., IBAN und BIC allesamt leer sind. Für Rechnungsstellung und Auszahlung reicht das nicht. Die akzeptierten Dokumente (AGB, NDA, Rahmenvertrag) sind zudem ohne Version, ohne Datum und ohne Download hinterlegt — juristisch nicht belastbar.

---

## 4. P2 — Politur

- **Layout-Overflow Pipeline:** Desktop 1656 px Inhalt bei 1440 px Viewport; mobil 900 px Überhang, Kacheln rechts abgeschnitten, Zahlen unlesbar.
- **Sprachmix:** „Earnings & Payouts", „Submitted", „Forwarded", „Screening", „1st Interview", „Hired", „Pending Response" in einer sonst deutschen Oberfläche. Die 404-Seite ist komplett englisch („Oops! Page not found") und ungestyled.
- **A11y-Fehler in der Konsole:** `DialogContent requires a DialogTitle` (Task-Detail-Dialog).
- **Aufgaben-Filter inkonsistent:** Task-Badge sagt „Sonstige", der Filter-Chip „Sonstige (0)" zählt null.
- **Integrationen fehlen in der Sidebar** — erreichbar nur über ein Dashboard-Dropdown und einen Link auf der Kandidatenseite.
- **Zwei konkurrierende Auszahlungswege:** IBAN/BIC im Profil *und* Stripe Connect unter Auszahlungen. Unklar, was gilt.
- **Einreichen-Button ohne Begründung:** Der Button ist korrekt deaktiviert, sagt aber nicht, welches Feld fehlt.
- **Pseudonymisierung uneinheitlich:** Benachrichtigungen mischen Klarnamen („Silvio Schneider") und Codes („Kandidat PR-A146A3", „Kandidat #85578741").
- **Datenqualität:** Job als „EdTech" getaggt, Text beschreibt Fitness/Lifestyle. Testdaten im Live-Bestand („teststadt", eigener Name als Kandidat). Erinnerungs-Benachrichtigungen laufen seit 144–165 Tagen ohne Eskalation oder Auto-Abschluss.

---

## 5. Fehlende Seiten & Prozesse

Was gebaut werden muss, damit der Kreis sich schließt:

| Lücke | Warum kritisch |
|---|---|
| **Recruiter-Einstellungen** | Route existiert nicht, Link läuft ins 404. Benachrichtigungen, Sprache, Passwort, 2FA fehlen komplett. |
| **Abschluss-Flow Offer → Hired** | 1 Angebot liegt an, `placements` ist leer, „Hire-to-Interview Rate 0,0 %". Es gibt keinen Weg, eine Vermittlung im UI abzuschließen. Damit endet die Umsatzkette **immer** bei 0 €. |
| **Rechnung / Gutschrift für Recruiter** | Unter Verdienste steht nur der Auszahlungszyklus als Fließtext. Keine Belegansicht, kein Download — für Selbstständige nicht ausreichend. |
| **Strukturiertes Debrief** | Die Aufgabe „Debrief fällig" existiert, die Erfassung ist aber nur ein Freitext-Notizfeld. Kein Kunden-Feedback, kein Ergebnis, keine Auswirkung auf die Stage. |
| **Interview-Reschedule / Eskalation** | Abgelaufene Slots bleiben monatelang liegen, ohne dass der Recruiter etwas anstoßen kann. |
| **Nachrichten-Einstieg** | Ohne Compose-Funktion ist das Modul faktisch tot. |
| **Talent-Pool-Befüllung** | Weder manuell noch automatisch aus Absagen. |
| **Hilfe / Support im eingeloggten Bereich** | `/help` und `/docs` existieren nur öffentlich, sind aus dem Dashboard nicht verlinkt. |

---

## 6. Empfohlene Reihenfolge

**Welle 1 — Vertrauen & Sicherheit (Blocker)**
1. P0-1 + P0-2: Job-Daten serverseitig maskieren, Aktivierung ≠ Enthüllung
2. P1-8: Freitext-Prüfung, sonst ist Welle 1 wertlos
3. P1-9: Cookie-Defaults auf AUS

**Welle 2 — Datenwahrheit**
4. P0-4: Ein Feld als Wahrheit festlegen (Empfehlung: `stage`), `status` daraus ableiten, Altbestand migrieren
5. P0-3: Kanban-Spalten auf die echten Werte mappen
6. Alle KPI-Widgets auf dieselbe Quelle umstellen

**Welle 3 — Kernwert**
7. P0-5: Gate-Multiplikator entschärfen und neu kalibrieren
8. P0-6: Render-Loop schließen

**Welle 4 — Handlungsfähigkeit**
9. P1-1: Einstellungsseite bauen, P1-2: `/settings` absichern
10. P1-6 + P1-7: Aktionen ins Submission-/Interview-Detail
11. Abschluss-Flow Offer → Hired → Placement → Auszahlung
12. P1-3 Suche, P1-4 Nachrichten, P1-5 Talent Pool

**Welle 5 — Politur**
13. Layout-Overflow, Sprachmix, A11y, Testdaten bereinigen

---

## 7. Was gut ist

Damit das nicht untergeht — diese Teile sind auf Produktniveau:

- **Aufgaben-Seite:** Priorisierung nach Impact, Session-Modus, Task-Detail mit Kandidat, Job, Impact-Score und Aktivitätsverlauf. Das ist echte Headhunter-Ergonomie.
- **Job-Detail:** Verdienstberechnung, Kultur- und Prozessinfos, „Firma anonym"-Badge, klare Handlungsaufforderung.
- **Submission-Timeline:** Alerts, Einladungen, Bestätigungen chronologisch — genau das, was man im Debrief braucht.
- **DSGVO-Block bei der Kandidatenanlage:** drei getrennte Bestätigungen (Rechtsgrundlage, Information des Kandidaten, Datenminimierung). Vorbildlich.
- **Rollentrennung** bei `/admin/*` und `/dashboard/*` greift sauber.
- **Integrationsseite** ist fertig und wartet nur auf einen Sidebar-Eintrag.
