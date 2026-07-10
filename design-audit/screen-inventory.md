# Screen-Inventar — Phase 0 (Design-Audit)

**Stand:** 2026-07-11 · **Fokus:** Bewerber-Seite (`/dashboard/candidates`) — weitere Screens werden später einzeln inventarisiert.
**Mission:** Zero-Training-Usability für Enterprise-HR-Kontakte und Hiring Manager (deutsch, nicht tech-affin, oft mobil).

---

## 1. App-Kontext

- **Stack:** React 18 + Vite + TypeScript, shadcn/ui (44 Komponenten), Tailwind, react-router v6, TanStack Query, Supabase (RLS + reveal-gated Views), react-i18next (de/en, Default de).
- **Theme:** Dark-Mode ist Default (`:root` = dark, `.light` als Override). Monochrome Basis (Schwarz/Weiß), Akzente: `--success` grün, `--warning` orange, `--destructive` rot. Font: Inter.
- **Layout:** `DashboardLayout` — sticky Header (Logo, GlobalSearch ⌘K, NotificationBell, User-Menü) + fixe Sidebar 256px mit 9 Client-Nav-Items (Dashboard, Meine Jobs, Bewerber, Interviews, Angebote, Placements, Analytics, Team, Nachrichten) + Einstellungen/Theme unten. **Mobile: Sidebar ist `hidden md:block` — es gibt keine mobile Navigation.**
- **Triple-Blind:** Kandidaten-Identität ist bis zum Opt-In serverseitig maskiert. Anzeigename ist ein Code (`PR-XXXXXX`), Stadt/Berufsjahre/Arbeitgeber sind gated, nur Bänder sichtbar (z. B. „6–10 Jahre", „Süddeutschland").
- **i18n-Realität:** Bewerber-Seite ist komplett hartcodiert Deutsch (kein `t(...)`), app-weit ~40 % i18n / ~60 % hartcodiert, Analytics teils Englisch.

## 2. Fokus-Screen: Bewerber

| | |
|---|---|
| **Route** | `/dashboard/candidates` |
| **Dateien** | [ClientBewerberPage.tsx](../src/pages/dashboard/ClientBewerberPage.tsx) (280 Z.) · [BewerberInboxView.tsx](../src/components/candidates/BewerberInboxView.tsx) (109 Z.) · [BewerberGridView.tsx](../src/components/candidates/BewerberGridView.tsx) (187 Z.) · [BewerberListView.tsx](../src/components/candidates/BewerberListView.tsx) (216 Z.) · [BewerberPreviewPanel.tsx](../src/components/candidates/BewerberPreviewPanel.tsx) · [useBewerber.ts](../src/hooks/useBewerber.ts) (237 Z.) |
| **Zweck** | Alle aktiven Bewerbungen (Submissions) über alle Jobs sichten und die nächste Pipeline-Entscheidung treffen. |
| **Primäre Nutzeraktion** | Pro Kandidat entscheiden: **„Interview anfragen"** (heller Button) oder **„Ablehnen"** (roter Button) im Preview-Panel; sekundär „Vollständiges Profil →" (`/dashboard/candidates/:id`). |

### Aufbau (top-down)

1. **Header:** H1 „Bewerber" + Zähler „13 aktive Bewerber in der Pipeline".
2. **Stage-Tabs** (Custom-Buttons, keine shadcn-Tabs): Alle / Neu (`submitted`) / Screening / Interview 1 / Interview 2 / Angebot — mit Count-Pills, Count nur wenn > 0.
3. **Filterzeile:** Suchfeld („Suchen…", client-seitig über Code, Rolle, Jobtitel, Stadt, Skills) · Job-Select („Alle Jobs") · Sortier-Select (Neueste zuerst / Bester Match / Längste Wartezeit) · View-Switcher (Inbox/Grid/List-Icons, `title`-Attribute, Präferenz in localStorage).
4. **Aktive View:**
   - **Inbox (Default):** Master-Detail. Links Liste (fix 340/380px): Urgency-Punkt (grün <24h, amber ≥24h, rot ≥48h), Code-Name, Match-%-Badge (grün ≥85, amber ≥70), Rolle, Ziel-Job, Wartezeit („Vor 151d"). Rechts `BewerberPreviewPanel`: Avatar-Initialen, Code, Rolle, Job, Fakten-Chips (Erfahrungsband, Region, Gehaltsband „Nicht freigegeben", Verfügbarkeit, Seniorität), Aktionsbuttons, Skills-Chips, „Passung zur Stelle" (KI-Text mit Disclaimer), Recruiter-Notiz, „Letzte Stationen" (Karriere, Arbeitgeber maskiert als „Unternehmen"), Footer „Vollständiges Profil →". Doppelklick auf Listeneintrag navigiert ebenfalls zum Profil.
   - **Grid:** 2-spaltige Karten mit denselben Infos in voller Länge (KI-Text komplett ausgeschrieben), Buttons pro Karte.
   - **List:** Tabelle (Kandidat / Job / Match / Wartezeit / Standort / Aktionen), expandierbare Zeilen.

### States (implementiert vs. beobachtet)

| State | Implementierung | Beobachtung im Test |
|---|---|---|
| Loading | 3 Skeletons (Titel, Zeile, 500px-Block) | erfasst (`desktop-00-loading`) |
| Geladen | Inbox/Grid/List | erfasst (13 Kandidaten, Wartezeiten 134–169 Tage) |
| Leerer Tab | Zentriertes Icon + „Keine Bewerber gefunden" + „Versuchen Sie andere Filter oder Suchbegriffe." — kein CTA | Screening/Interview 1/Interview 2/Angebot sind leer (alle 13 im Stage „Neu"; Tab „Neu" zeigt Count 4 ≠ 13 → Stage-Werte inkonsistent zwischen `stage`/`status`) |
| Suche ohne Treffer | gleicher Empty State | erfasst |
| Error | „Fehler beim Laden der Bewerber" + Retry-Button ([ClientBewerberPage.tsx:84](../src/pages/dashboard/ClientBewerberPage.tsx)) | **nicht erreicht** — bei blockiertem Netzwerk blieben dauerhaft Skeletons stehen (React-Query-Retries; `desktop-10-error`) |
| Mobile (390px) | kein eigenes Layout — Master-Detail wird gequetscht: Liste fix 340px → Preview-Panel stark gestaucht, Inhalte umbrechen extrem | erfasst (`mobile-01…04`) |

### Datenfluss

- `useBewerber` liest `client_candidate_view` (reveal-gated, max. 50 Zeilen, Rejected/Hired ausgeblendet) + `client_candidate_experiences_view` (Werdegang) + `jobs` (Filter-Dropdown). Polling alle 60 s, staleTime 30 s.
- Wartezeit/Urgency werden clientseitig berechnet; Suche und „Längste Wartezeit"-Sortierung ebenfalls clientseitig.
- Stage-Counts aus ungefilterten Daten; Tab-Filter serverseitig via `stage`-Spalte.

### Faktische Auffälligkeiten (ohne Bewertung — Input für Phase 1)

- Tab „Alle" zeigt 13, Tab „Neu" zeigt 4, alle anderen Tabs 0 → 9 Einträge haben einen `stage`-Wert außerhalb der 5 Tab-Keys.
- Tippfehler: „Wahlen Sie einen Bewerber aus der Liste" ([BewerberInboxView.tsx:103](../src/components/candidates/BewerberInboxView.tsx)).
- Match-Badge-Farben nutzen `text-green-700`/`text-amber-700` auf dunklem Grund (Inline-Tailwind, nicht Token-basiert).
- Urgency-Legende (grün/amber/rot-Punkt) existiert nirgends im UI.
- Wartezeiten der Testdaten: 134–169 Tage, alle als „critical" (rot) markiert.
- Keine Bulk-Aktionen, keine Pagination (hartes Limit 50 ohne Hinweis).
- Kein `t(...)` auf der gesamten Seite; Empty-State-Text der leeren Stage-Tabs suggeriert Filter-Problem statt „hier ist noch niemand".

## 3. Screenshot-Index (`design-audit/screenshots/bewerber/`)

| Datei | Inhalt |
|---|---|
| `desktop-00-loading.png` | Loading-Skeletons (1440×900) |
| `desktop-01-inbox-alle-fold.png` / `-full.png` | Inbox-View, Tab „Alle", above-the-fold / volle Seite |
| `desktop-02-tab-neu.png` | Tab „Neu" (4 Einträge) |
| `desktop-03-tab-screening.png` | Tab „Screening" — Empty State |
| `desktop-04-tab-interview1.png` | Tab „Interview 1" — Empty State |
| `desktop-05-tab-interview2.png` | Tab „Interview 2" — Empty State |
| `desktop-06-tab-angebot.png` | Tab „Angebot" — Empty State |
| `desktop-07-suche-keine-treffer.png` | Suche ohne Treffer |
| `desktop-08-grid.png` | Grid-View (volle Länge) |
| `desktop-09-list.png` | List-View (Tabelle) |
| `desktop-10-error.png` | Netzwerk blockiert → hängende Skeletons (Error-UI nicht erreicht) |
| `mobile-01-inbox-alle-fold.png` / `-full.png` | Mobile 390×844, Inbox |
| `mobile-02-tab-neu.png` | Mobile, Tab „Neu" |
| `mobile-03-grid.png` | Mobile, Grid-View |
| `mobile-04-list.png` | Mobile, List-View |
| `console-log.txt` | Browser-Console: nur React-Router-v7-Future-Flag-Warnungen; im Error-Test erwartete Fetch-Fehler |

**Reproduktion:** Scripts in `/tmp/matchunt-bewerber-shots.mjs` und `/tmp/matchunt-bewerber-views.mjs` (playwright-core + Chrome, Login-Session via localStorage-Injection aus `/tmp/matchunt-auth.json`).
