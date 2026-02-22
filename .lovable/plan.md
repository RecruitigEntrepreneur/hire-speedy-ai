

# Job Detail Page: Finales UI/UX Upgrade

## Zusammenfassung eurer Entscheidungen

- **Hero**: Mit Fortschrittsanzeige (Lebenszyklus-Stepper)
- **Leerer Zustand**: Alles gleichwertig (Quality Score, Next Steps, Summary)
- **Neue Komponenten**: Kommunikations-Log + weitere sinnvolle Ergaenzungen
- **Bei Kandidaten**: Kandidaten-zentriert (Top-3 gross, Pipeline kompakt)
- **Executive Summary**: Tabs beibehalten
- **Company Info**: In Hero integrieren (separate Karte entfernen)
- **Recruiter-Hilfe**: Selling Points/USPs + anonymes Expose das generiert und versendet werden kann
- **Quality Score**: Beibehalten wie jetzt

---

## Aenderungen im Detail

### 1. Hero Section: Fortschrittsanzeige + Company Info Integration

**Datei: `src/components/client/ClientJobHero.tsx`**

- Einen horizontalen Lifecycle-Stepper unter den Titel einbauen:
  ```text
  [Entwurf] --> [Aktiv] --> [Kandidaten] --> [Interviews] --> [Besetzt]
  ```
  Der aktuelle Schritt wird farbig hervorgehoben, vergangene Schritte erhalten ein Haekchen
- Company-Info (Branche, Standort, Remote-Type, Beschaeftigungsart) direkt unter den Stepper als kleine Badge-Reihe integrieren -- die separate CompanyInfoCard entfaellt dadurch
- Logik: Der Stepper-Schritt wird aus `job.status`, `totalSubmissions`, `interviews.length` und `hired` abgeleitet

### 2. Leerer Zustand: Gleichwertiges 3-Spalten-Layout

**Datei: `src/pages/dashboard/ClientJobDetail.tsx`**

Bei 0 Kandidaten (Phase 1) das Layout aendern auf:

```text
[ Job-Qualitaet (1/3) | Naechste Schritte (1/3) | Selling Points (1/3) ]
[                Executive Summary (volle Breite)                       ]
[        Kommunikations-Log (1/2)  |  Recruiter Aktivitaet (1/2)       ]
```

- Alle drei oberen Karten gleich gross (lg:grid-cols-3)
- CompanyInfoCard wird entfernt (ist jetzt im Hero)
- Selling Points Card und Kommunikations-Log kommen dazu

### 3. Kandidaten-Phase: Kandidaten-zentriert

**Datei: `src/pages/dashboard/ClientJobDetail.tsx`**

Bei 1+ Kandidaten (Phase 2) das Layout aendern auf:

```text
[          Top Kandidaten (volle Breite, prominent)                    ]
[ Pipeline (1/3) kompakt  | Recruiter Aktivitaet (1/3) | Next Steps (1/3) ]
[                Executive Summary (volle Breite)                       ]
[        Kommunikations-Log (1/2)  |  Interviews (1/2)                  ]
```

- TopCandidatesCard wandert nach ganz oben, direkt unter Hero
- Pipeline wird kompakter dargestellt (eine der drei Spalten)
- CompanyInfoCard entfaellt (ist im Hero)

### 4. Neue Komponente: SellingPointsCard

**Neue Datei: `src/components/client/SellingPointsCard.tsx`**

Auto-generierte USPs basierend auf den vorhandenen Job-Daten:

- Gehalt vorhanden und ueber 50k? --> "Wettbewerbsfaehige Verguetung"
- Remote/Hybrid? --> "Flexibles Arbeitsmodell"  
- Skills definiert? --> "Klares technisches Profil"
- Benefits in Summary? --> "Attraktives Benefits-Paket"
- Bekannte Branche? --> "Etablierte Branche: [Branche]"

Darstellung: Card mit Stern-Icon im Header, USPs als Chips/Pills. Darunter ein CTA-Button "Anonymes Expose generieren" der das Expose per KI erstellt.

Props: `job` (Gehalt, Skills, Remote-Type, Branche), `hasBenefits`, `onGenerateExpose`

### 5. Neue Komponente: CommunicationLogCard

**Neue Datei: `src/components/client/CommunicationLogCard.tsx`**

Chronologischer Log aller Ereignisse und Nachrichten fuer diesen Job:

- Zeigt automatische Events: "Job erstellt", "Summary generiert", "Status geaendert"
- Zeigt Recruiter-Interaktionen: "Recruiter hat Kandidat eingereicht", "Kandidat in Interview-Phase verschoben"
- Leerer Zustand: "Noch keine Aktivitaeten -- sobald Recruiter aktiv werden, sehen Sie hier alle Updates"

Datenquelle: Zusammengesetzt aus `submissions` (submitted_at, stage changes) und `job` (created_at, paused_at). Keine neue DB-Tabelle noetig fuer V1 -- wir leiten die Events aus den vorhandenen Daten ab.

Props: `job` (created_at, status, paused_at), `submissions` (submitted_at, stage, candidate anonymous ID), `interviews` (scheduled_at)

### 6. Neue Komponente: AnonymousExposeDialog

**Neue Datei: `src/components/client/AnonymousExposeDialog.tsx`**

Ein Dialog/Modal das ein anonymes Kandidaten-Expose generiert:

- Nutzt die Executive Summary + Job-Daten
- Generiert per KI (Lovable AI / Gemini Flash) ein professionelles 1-Seiten Expose
- Anonymisiert: Kein Firmenname, stattdessen Branchen-Beschreibung ("Fuehrender Hersteller im Bereich Militaer & Maschinenbau")
- Inhalte: Rolle, Aufgaben (kompakt), Anforderungen, Benefits, USPs
- Copy-to-Clipboard Button + "Als PDF" Option (spaeter)

**Neue Edge Function: `supabase/functions/generate-job-expose/index.ts`**

- Nimmt jobId entgegen
- Laed Job-Daten + Summary aus der DB
- Generiert per Lovable AI ein anonymisiertes Expose
- Gibt formatierten Text zurueck

### 7. CompanyInfoCard entfernen

**Datei: `src/pages/dashboard/ClientJobDetail.tsx`**

- CompanyInfoCard Import und beide Verwendungen (Phase 1 + Phase 2) entfernen
- Die relevanten Infos (Branche, Standort, Remote, Employment-Type) werden stattdessen im Hero angezeigt

### 8. Recruiter-Checkliste im Quality Score

**Datei: `src/components/client/JobQualityScoreCard.tsx`**

Kleine Ergaenzung: Unter den Verbesserungsvorschlaegen eine "Recruiter-Checkliste" mit Haekchen:
- Gehalt angegeben
- Skills definiert
- Beschreibung vorhanden
- Benefits beschrieben

Bereits erfuellte Punkte erhalten ein gruenes Haekchen, fehlende ein graues X. Das macht den Score transparenter.

---

## Technische Uebersicht

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `src/components/client/ClientJobHero.tsx` | Lifecycle-Stepper + Company-Info Badges | M |
| `src/pages/dashboard/ClientJobDetail.tsx` | Layout-Umbau (gleichwertig / kandidaten-zentriert), CompanyInfoCard entfernen | M |
| `src/components/client/SellingPointsCard.tsx` | **Neue Komponente**: Auto-USPs + Expose-CTA | S |
| `src/components/client/CommunicationLogCard.tsx` | **Neue Komponente**: Event-Timeline aus vorhandenen Daten | M |
| `src/components/client/AnonymousExposeDialog.tsx` | **Neue Komponente**: KI-generiertes anonymes Expose | M |
| `supabase/functions/generate-job-expose/index.ts` | **Neue Edge Function**: Expose-Generierung via Lovable AI | M |
| `src/components/client/JobQualityScoreCard.tsx` | Recruiter-Checkliste ergaenzen | S |

### Implementierungsreihenfolge

1. Hero umbauen (Stepper + Company-Info Integration)
2. Neue Komponenten erstellen (SellingPointsCard, CommunicationLogCard)
3. ClientJobDetail.tsx Layout umbauen + CompanyInfoCard entfernen
4. Edge Function fuer Expose erstellen
5. AnonymousExposeDialog bauen + in SellingPointsCard integrieren
6. JobQualityScoreCard mit Recruiter-Checkliste erweitern

