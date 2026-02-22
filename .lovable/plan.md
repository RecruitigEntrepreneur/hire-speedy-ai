

# CRM-Style Kandidaten-Detailseite: Kompletter Strukturumbau

## Kern-Idee

Weg vom "Report"-Layout (alles untereinander) hin zu einem CRM-Kontakt-Layout: Linke Sidebar mit Stammdaten, rechts der Content-Bereich mit Tabs/Sektionen. Der Kandidat steht im Mittelpunkt, nicht die KI.

## Neues Layout (CRM-Style)

```text
+====================================================================+
| <- Zurueck zu Bewerbungen                                          |
+====================================================================+
|                    |                                                |
| LINKE SIDEBAR      |  HAUPTBEREICH (scrollbar)                     |
| (sticky, 320px)    |                                               |
|                    |  +------------------------------------------+ |
| [Avatar gross]     |  | QUICK-FACTS BAR                          | |
| Kandidat #A7FA     |  | [Rolle] [Senio] [Region] [Gehalt] [Verf] | |
| fuer Product Mgr   |  +------------------------------------------+ |
|                    |                                               |
| Status: Interview  |  +------------------------------------------+ |
| angefragt          |  | KARRIERE-TIMELINE                        | |
|                    |  |                                          | |
| [Interview anfr.]  |  | 2024  Sr. Fullstack Developer            | |
| [Ablehnen]         |  |  |    TechCorp GmbH, Muenchen            | |
|                    |  |  |    * React, Node.js, AWS               | |
| ─────────────────  |  |  |                                      | |
|                    |  | 2021  Frontend Engineer                  | |
| KOMPETENZEN        |  |  |    StartupXY, Berlin                  | |
| [React] [Node.js]  |  |  |    * Vue.js, TypeScript               | |
| [AWS] [TypeScript]  |  |  |                                      | |
| [Docker] [K8s]     |  | 2019  Junior Developer                   | |
| +6 weitere         |  |       Agency123, Hamburg                 | |
|                    |  +------------------------------------------+ |
| ZERTIFIZIERUNGEN   |                                               |
| [AWS Solutions]    |  +------------------------------------------+ |
| [Scrum Master]     |  | KI-EINSCHAETZUNG (kompakt)               | |
|                    |  | [Badge] Empfehlung · Gute Passung        | |
| SPRACHEN           |  | "Der Kandidat bringt 10+ Jahre..."       | |
| Deutsch (C2)       |  | Staerken: 3 | Risiken: 0                | |
| Englisch (C1)      |  | [Details einblenden v]                   | |
|                    |  +------------------------------------------+ |
| ─────────────────  |                                               |
|                    |  +------------------------------------------+ |
| RAHMENBEDINGUNGEN  |  | RECRUITER-EMPFEHLUNG (wenn vorhanden)    | |
| Region   DACH      |  | "Starker Kandidat fuer die Rolle..."     | |
| Modell   Hybrid    |  +------------------------------------------+ |
| Gehalt   75-86k    |                                               |
| Verfuegb. Maerz 26 |  +------------------------------------------+ |
|                    |  | NOTIZEN                                  | |
| ─────────────────  |  | [Textarea] [Speichern]                   | |
|                    |  | Notiz 1 - 02.02.26                       | |
| KONTAKT (unlocked) |  | Notiz 2 - 01.02.26                       | |
| mail@example.de    |  +------------------------------------------+ |
| +49 170 ...        |                                               |
| [CV] [LinkedIn]    |  +------------------------------------------+ |
|                    |  | COMPLIANCE FOOTER                        | |
| ─────────────────  |  | EU AI Act + Anonymitaet                  | |
| KARRIEREZIELE      |  +------------------------------------------+ |
| Principal Eng.     |                                               |
|                    |                                                |
+====================================================================+
```

## Was sich aendert gegenueber heute

### 1. Komplett neues Layout: Sidebar + Main
- **Sidebar (links, 320px, sticky)**: Alle Stammdaten, Skills, Kontakt, CTAs
- **Hauptbereich (rechts, scrollbar)**: Quick-Facts, Karriere-Timeline, KI-Einschaetzung, Notizen
- Auf Mobile: Sidebar wird zum oberen Block, Main darunter

### 2. Karriere-Timeline (NEU fuer Client)
- `CandidateExperienceTimeline` existiert bereits, wird aber nur im Recruiter-View genutzt
- Wird jetzt auch auf der Client-Seite eingebunden
- **Anonymisierung beachten**: Wenn `identityUnlocked === false`, werden Firmennamen anonymisiert (z.B. "IT-Unternehmen" statt "TechCorp GmbH") oder die Timeline wird erst nach Unlock gezeigt
- Entscheidung: Timeline nur zeigen wenn `identityUnlocked === true` (Firmen sind PII)

### 3. KI-Einschaetzung wird kompakter
- Nicht mehr das Hero-Element, sondern eine collapsible Card
- Standardmaessig zeigt sie: Badge + 1-Satz-Summary + Staerken/Risiken-Count
- Per Klick aufklappbar fuer Details (Selling Points, Motivation, volle Staerken/Risiken)
- EU AI Act Disclaimer bleibt im aufgeklappten Zustand sichtbar

### 4. Quick-Facts Bar (NEU)
- Horizontale Leiste mit den wichtigsten Fakten als kompakte Tiles
- Rolle, Senioritaet, Region, Gehalt, Verfuegbarkeit -- auf einen Blick
- Ersetzt die bisherige "Profil"-Card im Hauptbereich

### 5. Sidebar-Gruppen
Die Sidebar organisiert alle Daten in klare Gruppen:
- **Header**: Avatar, Name, Job, Status
- **CTAs**: Interview anfragen, Ablehnen
- **Kompetenzen**: Skills (Badges), Zertifizierungen, Sprachen
- **Rahmenbedingungen**: Region, Arbeitsmodell, Gehalt, Verfuegbarkeit
- **Kontakt**: Nur wenn unlocked (Mail, Telefon, CV, LinkedIn)
- **Karriereziele**: Wenn vorhanden

## Technische Umsetzung

### Datei 1: `src/pages/dashboard/CandidateDetail.tsx`

Kompletter Strukturumbau:

**Layout-Aenderung:**
- Aeusserer Container: `flex` statt `space-y-6` (Sidebar + Main nebeneinander)
- Sidebar: `w-80 shrink-0 sticky top-0 h-screen overflow-y-auto` mit `border-r`
- Main: `flex-1 overflow-y-auto p-6 space-y-6`
- Mobile: `flex-col` statt `flex-row`, Sidebar nicht sticky

**Sidebar-Inhalt (von oben nach unten):**
1. Zurueck-Link
2. Avatar (h-16 w-16) + Name + Job + Status-Badge
3. CTA-Buttons (volle Breite, gestapelt)
4. Separator
5. Kompetenzen-Gruppe: Skills als Badges, Zertifizierungen, Sprachen
6. Separator
7. Rahmenbedingungen: Region, Arbeitsmodell, Gehalt, Verfuegbarkeit als key-value Paare
8. Separator (conditional)
9. Kontakt (wenn unlocked): Mail, Phone, CV-Button, LinkedIn-Button
10. Separator (conditional)
11. Karriereziele (wenn vorhanden)

**Hauptbereich-Inhalt (von oben nach unten):**
1. Quick-Facts Bar: 5-6 kompakte Tiles horizontal
2. Karriere-Timeline: `CandidateExperienceTimeline` Komponente (nur wenn unlocked, da Firmennamen PII sind)
3. KI-Einschaetzung: Kompakte, collapsible Version der `ClientCandidateSummaryCard`
4. Recruiter-Empfehlung (wenn vorhanden): Dezenter Callout
5. Notizen: Textarea + bisherige Kommentare
6. Compliance-Footer

**Neue Imports:**
- `CandidateExperienceTimeline` aus `@/components/candidates/CandidateExperienceTimeline`
- `Collapsible, CollapsibleContent, CollapsibleTrigger` aus `@/components/ui/collapsible`
- `Briefcase`, `GraduationCap`, `Globe`, `MapPin`, `Banknote`, `Clock3`, `ChevronDown` aus `lucide-react`

**Entfernte Elemente:**
- `ProfileGroup` und `ProfileField` Helper-Komponenten (in Sidebar-spezifische Darstellung umgewandelt)
- Die bisherige Profil-Card (3-Spalten Grid mit Notizen) -- wird aufgeloest in Sidebar + Main

### Datei 2: `src/components/candidates/ClientCandidateSummaryCard.tsx`

**Collapsible-Modus hinzufuegen:**
- Neue optionale Prop: `compact?: boolean`
- Wenn `compact === true`:
  - Zeigt nur: Recommendation Badge + Executive Summary (erste 150 Zeichen) + Staerken/Risiken Count
  - Collapsible-Trigger zum Aufklappen
  - Im aufgeklappten Zustand: Alles wie bisher (Selling Points, Motivation, Details, Disclaimer)
- Wenn `compact === false` (default): Verhalt wie bisher, keine Aenderung

**Implementierung:**
- State `expanded` fuer Collapsible
- Oberer Teil (immer sichtbar): Banner + Badge + Summary-Preview
- Unterer Teil (nur wenn expanded): Key Insights, Motivation, Staerken/Risiken Grid, Disclaimer
- Toggle-Button: "Details einblenden / ausblenden"

### Datei 3: `src/hooks/useClientCandidateView.ts`

Keine Aenderung noetig -- alle benoetigten Daten sind bereits vorhanden.

### Dateiaenderungen-Uebersicht

| Datei | Aenderung |
|---|---|
| `src/pages/dashboard/CandidateDetail.tsx` | Kompletter Umbau zu CRM-Layout: Sticky Sidebar (Stammdaten, Skills, CTAs) + scrollbarer Hauptbereich (Quick-Facts, Karriere-Timeline, kompakte KI-Card, Notizen) |
| `src/components/candidates/ClientCandidateSummaryCard.tsx` | Neuer `compact` Modus: Collapsible Card die standardmaessig nur Badge + Summary-Preview zeigt |

### Responsive Verhalten

- **Desktop (lg+)**: Sidebar links (320px fixed), Main rechts (flex-1)
- **Tablet (md)**: Sidebar oben (volle Breite), Main darunter
- **Mobile (sm)**: Alles gestapelt, Sidebar-Gruppen als collapsible Sections

### Anonymisierungs-Regeln fuer Timeline

Die Karriere-Timeline (`CandidateExperienceTimeline`) zeigt Firmennamen, die als PII gelten. Daher:
- **Wenn `identityUnlocked === false`**: Timeline wird NICHT gezeigt. Stattdessen ein Platzhalter: "Karriere-Stationen werden nach Interview-Zustimmung sichtbar."
- **Wenn `identityUnlocked === true`**: Volle Timeline mit Firmennamen, Positionen, Daten, Beschreibungen

### EU AI Act Konformitaet

Bleibt vollstaendig erhalten:
- KI-Kennzeichnung im Card-Header
- Modell-Version sichtbar
- Disclaimer im aufgeklappten Zustand
- Compliance-Footer am Seitenende

